import { Logger } from '../../core/logging/Logger.js';

export class ClaudeResponseParser {
  constructor(bridgeConfig = {}) {
    this.messageBridge = bridgeConfig.send || null;
    this.dataFeedManager = bridgeConfig.dataFeedManager || null;
    this.logger = new Logger('ClaudeResponseParser');
  }

  async process(options) {
    const { streamId, response, format = 'claude-sse', metadata = {} } = options;

    this.logger.debug(`Starting process() for stream ${streamId}`);
    const clone = response.clone();
    const reader = clone.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    let eventData = '';
    let currentEvent = 'message';
    let chunkSequence = 0;
    const currentMessage = { content: [], tool_calls: [] };
    let usageData = null;
    let stopReason = null;

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
                await this.processSSEEvent(currentEvent, eventData, currentMessage, (chunk) => {
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

        if (currentEvent === 'message_stop' || currentEvent === 'error') {
          break;
        }
      }

      this.emitComplete(streamId, {
        usage: usageData,
        finish_reason: stopReason
      });

    } catch (error) {
      this.logger.error(`Error in process() for stream ${streamId}:`, error);
      this.emitError(streamId, error);
    }
  }

  async processSSEEvent(eventType, data, currentMessage, emitChunk) {
    const parsed = this.parseJSONData(data);
    if (!parsed) return;

    switch (eventType) {
      case 'message_start': {
        if (parsed.message) {
          currentMessage.id = parsed.message.id;
          currentMessage.role = parsed.message.role || 'assistant';
          if (parsed.message.usage) {
            currentMessage.usage = parsed.message.usage;
          }
        }
        break;
      }
      case 'content_block_start': {
        if (parsed.content_block) {
          const block = parsed.content_block;
          if (block.type === 'text') {
            currentMessage.content.push({ type: 'text', text: '' });
          } else if (block.type === 'tool_use') {
            currentMessage.tool_calls.push({
              id: block.id,
              name: block.name,
              arguments: ''
            });
          }
        }
        break;
      }
      case 'content_block_delta': {
        if (!parsed.delta) return;

        if (parsed.delta.type === 'text_delta') {
          const textBlock = currentMessage.content
            .slice()
            .reverse()
            .find(b => b.type === 'text');

          if (textBlock) {
            textBlock.text += parsed.delta.text;
            emitChunk({
              content: parsed.delta.text,
              role: currentMessage.role,
              model: 'claude'
            });
          }
        } else if (parsed.delta.type === 'input_json_delta') {
          const toolCall = currentMessage.tool_calls[currentMessage.tool_calls.length - 1];
          if (toolCall) {
            toolCall.arguments += parsed.delta.partial_json;
          }
        } else if (parsed.delta.type === 'thinking_delta') {
          const thinkingBlock = currentMessage.content
            .slice()
            .reverse()
            .find(b => b.type === 'thinking');

          if (!thinkingBlock) {
            currentMessage.content.push({ type: 'thinking', thinking: '' });
          }

          if (thinkingBlock) {
            thinkingBlock.thinking += parsed.delta.thinking;
            emitChunk({
              content: '',
              role: currentMessage.role,
              model: 'claude',
              metadata: {
                thinking: parsed.delta.thinking,
                thinking_type: 'delta'
              }
            });
          }
        }
        break;
      }
      case 'content_block_stop': {
        const toolCall = currentMessage.tool_calls[currentMessage.tool_calls.length - 1];
        if (toolCall && toolCall.arguments) {
          try {
            const args = JSON.parse(toolCall.arguments);
            emitChunk({
              content: '',
              role: currentMessage.role,
              model: 'claude',
              metadata: {
                tool_call: {
                  id: toolCall.id,
                  name: toolCall.name,
                  arguments: args
                }
              }
            });
          } catch (error) {
            this.logger.warn('Failed to parse tool call arguments:', error);
          }
        }
        break;
      }
      case 'message_delta': {
        if (parsed.usage) {
          usageData = { ...usageData, ...parsed.usage };
        }
        if (parsed.delta?.stop_reason) {
          stopReason = parsed.delta.stop_reason;
        }
        break;
      }
      case 'message_stop': {
        emitChunk({
          content: '',
          role: currentMessage.role,
          model: 'claude',
          metadata: {
            usage: usageData,
            finish_reason: stopReason
          },
          isFinal: true
        });
        break;
      }
      case 'error': {
        this.logger.error('Claude SSE error event:', parsed);
        this.emitError(currentMessage.id || 'unknown', new Error(parsed.error?.message || 'Claude streaming error'));
        break;
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
        role: chunk.role || 'assistant',
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
        provider: 'claude',
        role: chunk.role || 'assistant',
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

export default ClaudeResponseParser;