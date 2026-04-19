import { BaseParser, StreamState } from './BaseParser.js';
import { StreamAccumulator } from '../streaming/StreamAccumulator.js';

export class DeltaEncodingV1Parser extends BaseParser {
  constructor(options) {
    super(options);
    this.accumulator = null;
    this.messageParts = [];
    this.currentModel = { value: 'unknown' };
    this.currentRole = { value: null };
    this.dataFeedStudy = options.metadata?.dataFeedStudy || null;
  }
  
  createAccumulator() {
    return new StreamAccumulator();
  }

  emitChunk(chunk) {
    // Capture chunk emission for study before emitting
    if (this.dataFeedStudy) {
      this.dataFeedStudy.captureChunkEmission(this.streamId, chunk, this.reconstructContent());
    }

    // Call parent emitChunk
    super.emitChunk(chunk);
  }
  
  async process(response) {
    return this.parse(response);
  }
  
  async parse(response) {
    await this.initialize();

    const reader = response.clone().body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    let currentEvent = 'message';
    let eventData = '';

    try {
      while (!this.isCancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Capture raw stream data for study
        if (this.dataFeedStudy) {
          this.dataFeedStudy.captureRawStreamData(this.streamId, chunk, {
            bufferLength: buffer.length,
            currentEvent,
            eventDataLength: eventData.length
          });
        }

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let streamDone = false;
        for (const line of lines) {
          if (this.isCancelled) break;

          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim();
          } else if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);
            if (data === '[DONE]') {
              streamDone = true;
              break;
            }

            eventData = eventData ? eventData + '\n' + data : data;

            try {
              const payload = JSON.parse(eventData);

              // Capture SSE event for study
              if (this.dataFeedStudy) {
                this.dataFeedStudy.captureSSEEvent(this.streamId, currentEvent, payload, eventData);
              }

              await this.processEventPayload(currentEvent, payload);
              eventData = ''; // Reset after successful parse
            } catch (e) {
              if (e instanceof SyntaxError) {
                // Partial JSON, keep accumulating in eventData
              } else {
                this.logger.error('Error processing payload:', e, eventData);
                if (this.dataFeedStudy) {
                  this.dataFeedStudy.captureJSONParseAttempt(this.streamId, eventData, null, false, e);
                }
                eventData = ''; // Prevent infinite accumulation on logic errors
              }
            }
          }
        }
        if (streamDone) break;
      }
      
      if (eventData) {
            try {
              const payload = JSON.parse(eventData);

              // Capture successful JSON parse for study
              if (this.dataFeedStudy) {
                this.dataFeedStudy.captureJSONParseAttempt(this.streamId, eventData, payload, true);
              }

              await this.processEventPayload(currentEvent, payload);
              eventData = ''; // Reset after successful parse
            } catch (e) {
              if (e instanceof SyntaxError) {
                // Partial JSON, keep accumulating in eventData
              } else {
                this.logger.error('Error processing payload:', e, eventData);
                if (this.dataFeedStudy) {
                  this.dataFeedStudy.captureJSONParseAttempt(this.streamId, eventData, null, false, e);
                }
                eventData = ''; // Prevent infinite accumulation on logic errors
              }
            }
      }
      
      this.handleComplete();
    } catch (error) {
      if (error.name === 'AbortError' || error.message.includes('aborted') || error.message.includes('abort')) {
        this.logger.info(`Stream aborted (${error.message}), treating as complete to flush buffer`);
        this.handleComplete();
      } else {
        this.handleError(error);
      }
    }
  }
  
  async processEventPayload(eventType, payload) {
    if (this.isErrorChunk(payload)) {
      const error = this.extractError(payload);
      this.handleError(error);
      return;
    }

    let hadContentChange = false;

    // Handle array-based JSON patches (as per fix plan)
    if (Array.isArray(payload)) {
      this.logger.info(`[DELTA_PARSER] Processing array payload with ${payload.length} items`);
      if (this.dataFeedStudy) {
        this.dataFeedStudy.captureDeltaProcessing(this.streamId, 'array_payload_processing', payload, null);
      }

      for (let i = 0; i < payload.length; i++) {
        const item = payload[i];
        this.logger.debug(`[DELTA_PARSER] Processing array item ${i}: ${JSON.stringify(item).substring(0, 100)}`);

        if (item && typeof item === 'object' && item.o && item.p) {
          // Individual patch operation
          const itemResult = this.processDeltaPayload(item);
          hadContentChange = hadContentChange || itemResult;

          if (this.dataFeedStudy && itemResult) {
            this.dataFeedStudy.captureDeltaProcessing(this.streamId, `array_item_${i}_${item.o}_${item.p}`, item, true);
          }
        } else if (Array.isArray(item) && item.length >= 3) {
          // [op, path, value] format
          const [op, path, value] = item;
          const arrayItem = { o: op, p: path, v: value };
          this.logger.debug(`[DELTA_PARSER] Converting array item to object: ${JSON.stringify(arrayItem).substring(0, 100)}`);

          const itemResult = this.processDeltaPayload(arrayItem);
          hadContentChange = hadContentChange || itemResult;

          if (this.dataFeedStudy && itemResult) {
            this.dataFeedStudy.captureDeltaProcessing(this.streamId, `array_format_${i}_${op}_${path}`, arrayItem, true);
          }
        } else {
          this.logger.debug(`[DELTA_PARSER] Skipping array item ${i}: not a valid patch operation`);
        }
      }
    } else if (payload.o && payload.p) {
      hadContentChange = this.processDeltaPayload(payload);
    } else if (payload.message) {
      hadContentChange = this.processMessagePayload(payload);
    }

    if (hadContentChange) {
      const reconstructedText = this.reconstructContent();
      this.transition(StreamState.STREAMING);
      this.emitChunk({
        type: 'content',
        content: reconstructedText,
        role: this.currentRole.value || 'assistant',
        model: this.currentModel.value,
        cumulative: true,
        isDelta: true
      });
    }
  }

  processMessagePayload(payload) {
    let hadContentChange = false;
    const msg = payload.message;
    if (!msg) return false;

    if (msg.author?.role) {
      this.currentRole.value = msg.author.role;
    }
    if (msg.metadata?.model_slug) {
      this.currentModel.value = msg.metadata.model_slug;
    }

    if (msg.content?.parts) {
      const newParts = msg.content.parts;
      if (newParts.length !== this.messageParts.length || newParts.some((p, i) => p !== this.messageParts[i])) {
        this.messageParts.splice(0, this.messageParts.length, ...(Array.isArray(newParts) ? newParts : [newParts]));
        hadContentChange = true;
      }
    }
    return hadContentChange;
  }

  processDeltaPayload(payload) {
    let hadContentChange = false;

    const op = payload.o;
    const path = Array.isArray(payload.p) ? "/" + payload.p.join("/") : payload.p;
    const value = payload.v;

    // Capture delta processing for study
    if (this.dataFeedStudy) {
      this.dataFeedStudy.captureDeltaProcessing(this.streamId, 'processDeltaPayload', payload, null);
    }

    if (op === "patch" && Array.isArray(value)) {
      for (const subOp of value) {
        const subPath = Array.isArray(subOp.p) ? "/" + subOp.p.join("/") : subOp.p;
        const subOpType = subOp.o;
        const subValue = subOp.v;

        if (subPath === "/message/author/role") {
          this.currentRole.value = subValue;
        }

        if (subPath === "/message/metadata" && subOpType === "add" && subValue?.model_slug) {
          this.currentModel.value = subValue.model_slug;
        }

        if (subPath === "/message/content/parts" || subPath === "/message/content") {
          if (subOpType === "replace" || subOpType === "add") {
            const newParts = subValue?.parts || subValue;
            this.messageParts.splice(0, this.messageParts.length, ...(Array.isArray(newParts) ? newParts : [newParts]));
            hadContentChange = true;
          }
        } else if (subPath && subPath.startsWith("/message/content/parts/")) {
          const match = subPath.match(/\/message\/content\/parts\/(\d+)/);
          if (match) {
            const idx = parseInt(match[1], 10);
            const getValToAppend = (v) => {
              if (typeof v === 'string') return v;
              if (Array.isArray(v)) {
                return v.map(item => typeof item === 'string' ? item : (item?.text || '')).join('');
              }
              return v?.parts?.[0] || v?.text || "";
            };
            const valToAppend = getValToAppend(subValue);
            if (subOpType === "append") {
              if (typeof this.messageParts[idx] === 'string') {
                this.messageParts[idx] += valToAppend;
              } else if (typeof this.messageParts[idx] === 'object' && this.messageParts[idx] !== null) {
                if (this.messageParts[idx].text !== undefined) this.messageParts[idx].text += valToAppend;
                else if (this.messageParts[idx].parts) this.messageParts[idx].parts[0] += valToAppend;
              } else {
                this.messageParts[idx] = valToAppend;
              }
            } else if (subOpType === "replace" || subOpType === "add") {
              this.messageParts[idx] = subValue;
            }
            hadContentChange = true;
          }
        } else if (subPath === "/message/content/text") {
          const valToAppend = typeof subValue === 'string' ? subValue : (subValue?.parts?.[0] || subValue?.text || "");
          if (subOpType === "append") {
            if (typeof this.messageParts[0] === 'string') {
              this.messageParts[0] += valToAppend;
            } else {
              this.messageParts[0] = valToAppend;
            }
          } else if (subOpType === "replace" || subOpType === "add") {
            this.messageParts[0] = valToAppend;
          }
          hadContentChange = true;
        } else if (subPath === "" || subPath === "/") {
          if (subOpType === "replace" && subValue?.message) {
            hadContentChange = this.processMessagePayload({ message: subValue.message });
          }
        }
      }
    } else {
      if (path === "/message/author/role") {
        this.currentRole.value = value;
      }
      if (path === "/message/metadata" && op === "add" && value?.model_slug) {
        this.currentModel.value = value.model_slug;
      }

      if ((path === "/message/content/parts" || path === "/message/content") && (op === "replace" || op === "add")) {
        const newParts = value?.parts || value;
        this.messageParts.splice(0, this.messageParts.length, ...(Array.isArray(newParts) ? newParts : [newParts]));
        hadContentChange = true;
      } else if (path && path.startsWith("/message/content/parts/")) {
        const match = path.match(/\/message\/content\/parts\/(\d+)/);
        if (match) {
          const idx = parseInt(match[1], 10);
          const getValToAppend = (v) => {
            if (typeof v === 'string') return v;
            if (Array.isArray(v)) {
              return v.map(item => typeof item === 'string' ? item : (item?.text || '')).join('');
            }
            return v?.parts?.[0] || v?.text || "";
          };
          const valToAppend = getValToAppend(value);
          if (op === "append") {
            if (typeof this.messageParts[idx] === 'string') {
              this.messageParts[idx] += valToAppend;
            } else if (typeof this.messageParts[idx] === 'object' && this.messageParts[idx] !== null) {
              if (this.messageParts[idx].text !== undefined) this.messageParts[idx].text += valToAppend;
              else if (this.messageParts[idx].parts) this.messageParts[idx].parts[0] += valToAppend;
            } else {
              this.messageParts[idx] = valToAppend;
            }
          } else if (op === "replace" || op === "add") {
            this.messageParts[idx] = value;
          }
          hadContentChange = true;
        }
      } else if (path === "/message/content/text") {
        const valToAppend = typeof value === 'string' ? value : (value?.parts?.[0] || value?.text || "");
        if (op === "append") {
          if (typeof this.messageParts[0] === 'string') {
            this.messageParts[0] += valToAppend;
          } else {
            this.messageParts[0] = valToAppend;
          }
        } else if (op === "replace" || op === "add") {
          this.messageParts[0] = valToAppend;
        }
        hadContentChange = true;
      } else if (path === "" || path === "/") {
        if (op === "replace" && value?.message) {
          hadContentChange = this.processMessagePayload({ message: value.message });
        }
      }
    }

    return hadContentChange;
  }

  reconstructContent() {
    const parts = this.messageParts.map((p, index) => {
      let val = '';
      if (typeof p === 'string') val = p;
      else if (p && typeof p === 'object') {
        if (typeof p.text === 'string') val = p.text;
        else if (Array.isArray(p.parts)) val = p.parts.join('');
      }
      this.logger.debug(`[reconstructContent] Part ${index}: length=${val.length}`);
      return val;
    });
    const finalContent = parts.join('');
    this.logger.debug(`[reconstructContent] Final joined content length: ${finalContent.length}`);
    return finalContent;
  }
  
  handleComplete() {
    const finalContent = this.reconstructContent();
    this.logger.info(`[handleComplete] Emitting final chunk, length: ${finalContent.length}, content preview: ${finalContent.substring(0, 50)}...`);
    this.emitChunk({
      type: 'complete',
      content: finalContent,
      cumulative: true,
      isFinal: true
    });
    super.handleComplete();
  }
}

export default DeltaEncodingV1Parser;