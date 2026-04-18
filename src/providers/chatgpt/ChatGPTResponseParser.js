import { Logger } from '../../core/logging/Logger.js';

export class ChatGPTResponseParser {
  constructor(bridgeConfig = {}) {
    this.messageBridge = bridgeConfig.send || null;
    this.dataFeedManager = bridgeConfig.dataFeedManager || null;
    this.streamingManager = null;
    this.logger = new Logger('ChatGPTResponseParser');
  }

  async process(options) {
    const { streamId, response, format = 'delta-encoding-v1', metadata = {} } = options;

    this.logger.debug(`Starting process() for stream ${streamId}`);
    const clone = response.clone();
    const reader = clone.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    const messageParts = [];
    const currentModel = { value: 'unknown' };
    const currentRole = { value: null };
    let chunkSequence = 0;
    let lastEmittedContent = '';
    let currentEvent = 'message';
    let eventData = '';

    try {
      this.logger.debug(`[DEBUG_STREAM] Starting process() for stream ${streamId}. Reader active.`);
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          this.logger.debug(`[DEBUG_STREAM] Reader signaled DONE for ${streamId}`);
          break;
        }

        if (value) {
          this.logger.debug(`[DEBUG_STREAM] Received raw chunk: ${value.length} bytes`);
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          this.logger.debug(`[DEBUG_STREAM] SSE Line: ${trimmed.substring(0, 100)}${trimmed.length > 100 ? '...' : ''}`);

          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim();
            this.logger.debug(`[DEBUG_STREAM] Event: ${currentEvent}`);
          } else if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              this.logger.debug('[DEBUG_STREAM] Stream [DONE]');
              break;
            }

            eventData = eventData ? eventData + '\n' + data : data;

            try {
              const payload = JSON.parse(eventData);
              this.logger.debug(`[DEBUG_STREAM] Successfully parsed JSON payload for ${currentEvent}`);

              let hadContentChange = false;
              if (currentEvent === 'delta') {
                hadContentChange = this.processDeltaPayload(payload, messageParts, currentModel, currentRole);
              } else if (currentEvent === 'message' || !currentEvent) {
                if (payload.message) {
                  hadContentChange = this.processMessagePayload(payload, messageParts, currentModel, currentRole);
                } else if (payload.o && payload.p) {
                  hadContentChange = this.processDeltaPayload(payload, messageParts, currentModel, currentRole);
                }
              }

              if (hadContentChange) {
                const reconstructedText = this.reconstructContent(messageParts);
                chunkSequence++;
                this.logger.debug(`[DEBUG_STREAM] Emission triggered: seq=${chunkSequence}, len=${reconstructedText.length}`);
                this.emitChunk({
                  content: reconstructedText,
                  role: currentRole.value || 'assistant',
                  model: currentModel.value,
                  seq: chunkSequence,
                  timestamp: Date.now(),
                  cumulative: true
                });
                lastEmittedContent = reconstructedText;
              }

              eventData = '';
            } catch (e) {
              this.logger.debug(`[DEBUG_STREAM] JSON partial/invalid (len=${eventData.length}): ${e.message}`);
            }
          }
        }
      }

      const finalText = this.reconstructContent(messageParts);
      if (finalText !== undefined) {
        chunkSequence++;
        this.logger.debug(`Emitting final chunk ${chunkSequence} (${finalText.length} chars)`);
        this.emitChunk({
          content: finalText,
          role: currentRole.value || 'assistant',
          model: currentModel.value,
          seq: chunkSequence,
          timestamp: Date.now(),
          isFinal: true,
          cumulative: true
        });
      }

      this.emitComplete(streamId);

    } catch (error) {
      this.logger.error(`Error in process() for stream ${streamId}:`, error);
      this.emitError(streamId, error);
    }
  }

  processMessagePayload(payload, messageParts, currentModel, currentRole) {
    let hadContentChange = false;
    const msg = payload.message;
    if (!msg) return false;

    if (msg.author?.role) {
      currentRole.value = msg.author.role;
    }
    if (msg.metadata?.model_slug) {
      currentModel.value = msg.metadata.model_slug;
    }

    if (msg.content?.parts) {
      const newParts = msg.content.parts;
      if (newParts.length !== messageParts.length || newParts.some((p, i) => p !== messageParts[i])) {
        messageParts.splice(0, messageParts.length, ...(Array.isArray(newParts) ? newParts : [newParts]));
        hadContentChange = true;
      }
    }
    return hadContentChange;
  }

  processDeltaPayload(payload, messageParts, currentModel, currentRole) {
    let hadContentChange = false;

    const op = payload.o;
    const path = payload.p;
    const value = payload.v;

    if (op === "patch" && Array.isArray(value)) {
      for (const subOp of value) {
        const subPath = subOp.p;
        const subOpType = subOp.o;
        const subValue = subOp.v;

        if (subPath === "/message/author/role") {
          currentRole.value = subValue;
        }

        if (subPath === "/message/metadata" && subOpType === "add" && subValue?.model_slug) {
          currentModel.value = subValue.model_slug;
        }

        if (subPath === "/message/content/parts" || subPath === "/message/content") {
          if (subOpType === "replace" || subOpType === "add") {
            const newParts = subValue?.parts || subValue;
            messageParts.splice(0, messageParts.length, ...(Array.isArray(newParts) ? newParts : [newParts]));
            hadContentChange = true;
          }
        } else if (subPath && subPath.startsWith("/message/content/parts/")) {
          const match = subPath.match(/\/message\/content\/parts\/(\d+)/);
          if (match) {
            const idx = parseInt(match[1], 10);
            const valToAppend = typeof subValue === 'string' ? subValue : (subValue?.parts?.[0] || subValue?.text || "");
            if (subOpType === "append") {
              if (typeof messageParts[idx] === 'string') {
                messageParts[idx] += valToAppend;
              } else if (typeof messageParts[idx] === 'object' && messageParts[idx] !== null) {
                if (messageParts[idx].text !== undefined) messageParts[idx].text += valToAppend;
                else if (messageParts[idx].parts) messageParts[idx].parts[0] += valToAppend;
              } else {
                messageParts[idx] = valToAppend;
              }
            } else if (subOpType === "replace" || subOpType === "add") {
              messageParts[idx] = subValue;
            }
            hadContentChange = true;
          }
        }
      }
    } else {
      if (path === "/message/author/role") {
        currentRole.value = value;
      }
      if (path === "/message/metadata" && op === "add" && value?.model_slug) {
        currentModel.value = value.model_slug;
      }

      if ((path === "/message/content/parts" || path === "/message/content") && (op === "replace" || op === "add")) {
        const newParts = value?.parts || value;
        messageParts.splice(0, messageParts.length, ...(Array.isArray(newParts) ? newParts : [newParts]));
        hadContentChange = true;
      } else if (path && path.startsWith("/message/content/parts/")) {
        const match = path.match(/\/message\/content\/parts\/(\d+)/);
        if (match) {
          const idx = parseInt(match[1], 10);
          const valToAppend = typeof value === 'string' ? value : (value?.parts?.[0] || value?.text || "");
          if (op === "append") {
            if (typeof messageParts[idx] === 'string') {
              messageParts[idx] += valToAppend;
            } else if (typeof messageParts[idx] === 'object' && messageParts[idx] !== null) {
              if (messageParts[idx].text !== undefined) messageParts[idx].text += valToAppend;
              else if (messageParts[idx].parts) messageParts[idx].parts[0] += valToAppend;
            } else {
              messageParts[idx] = valToAppend;
            }
          } else if (op === "replace" || op === "add") {
            messageParts[idx] = value;
          }
          hadContentChange = true;
        }
      }
    }

    return hadContentChange;
  }

  reconstructContent(messageParts) {
    return messageParts.map(p => {
      if (typeof p === 'string') return p;
      if (p && typeof p === 'object') {
        if (typeof p.text === 'string') return p.text;
        if (Array.isArray(p.parts)) return p.parts.join('');
      }
      return '';
    }).join('');
  }

  emitChunk(chunk) {
    if (this.messageBridge) {
      this.messageBridge.send('chatChunk', {
        role: chunk.role || 'assistant',
        content: chunk.content,
        model: chunk.model,
        seq: chunk.seq,
        streamId: chunk.streamId,
        cumulative: chunk.cumulative,
        isFinal: chunk.isFinal || false
      });
    }

    if (this.dataFeedManager?.isEnabled() && chunk.isFinal) {
      this.dataFeedManager.emit('message:received', {
        provider: 'chatgpt',
        role: chunk.role || 'assistant',
        content: chunk.content,
        model: chunk.model,
        streamId: chunk.streamId,
        chunkCount: chunk.seq,
        messageLength: chunk.content?.length || 0
      });
    }
  }

  emitComplete(streamId) {
    if (this.messageBridge) {
      this.messageBridge.send('streamComplete', { streamId });
    }
  }

  emitError(streamId, error) {
    if (this.messageBridge) {
      this.messageBridge.send('streamComplete', { streamId, error: error.message });
    }
  }
}

export default ChatGPTResponseParser;