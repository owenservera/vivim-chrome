import { Logger } from '../../core/logging/Logger.js';

export class GeminiResponseParser {
  constructor(bridgeConfig = {}) {
    this.messageBridge = bridgeConfig.send || null;
    this.dataFeedManager = bridgeConfig.dataFeedManager || null;
    this.logger = new Logger('GeminiResponseParser');
    this.fullTextBuffer = '';
    this.lastEmittedLength = 0;
  }

  async process(options) {
    const { streamId, response, format = 'gemini-sse', metadata = {} } = options;

    this.logger.debug(`Starting process() for stream ${streamId}`);
    this.streamId = streamId;
    this.fullTextBuffer = '';
    this.lastEmittedLength = 0;
    this.usageMetadata = null;
    this.finishReasonData = null;

    const clone = response.clone();
    const reader = clone.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    let eventData = '';
    let currentEvent = 'message';
    let chunkSequence = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed === '') {
            if (eventData && currentEvent) {
              try {
                await this.processSSEEvent(currentEvent, eventData, (chunk) => {
                  chunkSequence++;
                  this.emitChunk({ ...chunk, seq: chunkSequence, streamId });
                });
              } catch (error) {
                this.logger.warn(`Error processing SSE event ${currentEvent}:`, error);
              }
            }

            currentEvent = 'message';
            eventData = '';
          } else if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim();
          } else if (trimmed.startsWith('data: ')) {
            eventData = trimmed.slice(5);
          }
        }
      }

      this.emitComplete(streamId, {
        usage: this.usageMetadata,
        finish_reason: this.finishReasonData
      });

    } catch (error) {
      this.logger.error(`Error in process() for stream ${streamId}:`, error);
      this.emitError(streamId, error);
    }
  }

  async processSSEEvent(eventType, data, emitChunk) {
    const parsed = this.parseJSONData(data);
    if (!parsed) return;

    if (!this.usageMetadata && parsed.usageMetadata) {
      this.usageMetadata = parsed.usageMetadata;
    }

    if (parsed.candidates && parsed.candidates.length > 0) {
      for (const candidate of parsed.candidates) {
        if (!this.finishReasonData && candidate.finishReason && candidate.finishReason !== 'STOP') {
          this.finishReasonData = candidate.finishReason;
        }

        if (candidate.content && candidate.content.parts) {
          const textContent = candidate.content.parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('');

          this.fullTextBuffer += textContent;
          const newText = this.fullTextBuffer.slice(this.lastEmittedLength);

          if (newText) {
            emitChunk({
              content: newText,
              role: candidate.content.role || 'model',
              model: candidate.content.model || 'gemini'
            });

            this.lastEmittedLength = this.fullTextBuffer.length;
          }

          if (candidate.content.parts) {
            for (const part of candidate.content.parts) {
              if (part.functionCall) {
                emitChunk({
                  content: '',
                  role: candidate.content.role || 'model',
                  model: candidate.content.model || 'gemini',
                  metadata: { tool_call: part.functionCall }
                });
              }
            }
          }
        }
      }
    }
  }

  parseJSONData(data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      this.logger.warn('Failed to parse SSE data as JSON:', data, error);
      return null;
    }
  }

  emitChunk(chunk) {
    if (this.messageBridge) {
      this.messageBridge.send('chatChunk', {
        role: chunk.role || 'model',
        content: chunk.content,
        model: chunk.model,
        seq: chunk.seq,
        streamId: chunk.streamId,
        cumulative: true,
        isFinal: chunk.isFinal || false,
        metadata: chunk.metadata
      });
    }

    if (this.dataFeedManager?.isEnabled() && chunk.isFinal) {
      this.dataFeedManager.emit('message:received', {
        provider: 'gemini',
        role: chunk.role || 'model',
        content: chunk.content,
        model: chunk.model,
        streamId: chunk.streamId,
        chunkCount: chunk.seq,
        messageLength: chunk.content?.length || 0
      });
    }
  }

  emitComplete(streamId, metadata = {}) {
    if (this.messageBridge) {
      this.messageBridge.send('streamComplete', { streamId, ...metadata });
    }
  }

  emitError(streamId, error) {
    if (this.messageBridge) {
      this.messageBridge.send('streamComplete', { streamId, error: error.message });
    }
  }
}

export default GeminiResponseParser;