/**
 * Centralized Streaming Manager API
 * Handles streaming responses from all AI providers with format abstraction
 */

export class StreamingManager {
  constructor(messageBridge, config = {}) {
    this.messageBridge = messageBridge;
    this.activeStreams = new Map();
    this.parsers = new Map();
    this.logger = console;

    // Configuration with defaults
    this.config = {
      maxConcurrentStreams: 5,
      streamTimeout: 300000, // 5 minutes
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      enableMetrics: true,
      ...config
    };

    // Metrics tracking
    this.metrics = {
      totalStreams: 0,
      successfulStreams: 0,
      failedStreams: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0
    };

    this.registerDefaultParsers();

    // Clean up stale streams periodically
    this.cleanupInterval = setInterval(() => this.cleanupStaleStreams(), 60000);
  }

  /**
   * Register a streaming format parser
   */
  registerParser(format, parserClass) {
    this.parsers.set(format, parserClass);
  }

  /**
   * Register default parsers
   */
  registerDefaultParsers() {
    this.registerParser('delta-encoding-v1', DeltaEncodingV1Parser);
    this.registerParser('sse', SSEParser);
    this.registerParser('json-stream', JSONStreamParser);
  }

  /**
   * Process a streaming response
   * @param {Object} options
   * @param {string} options.streamId - Unique stream identifier
   * @param {Response} options.response - Fetch response object
   * @param {string} options.format - Streaming format ('delta-encoding-v1', 'sse', etc.)
   * @param {Object} options.metadata - Additional metadata (provider, model, etc.)
   * @param {boolean} options.enableRetry - Whether to retry on failure
   */
  async processStream({ streamId, response, format, metadata = {}, enableRetry = true }) {
    const startTime = Date.now();

    // Check capacity
    if (this.isAtCapacity()) {
      const error = new Error('Streaming capacity exceeded');
      this.logger.warn(`[StreamingManager] ${error.message}`);
      this.handleError(streamId, error);
      return;
    }

    try {
      const parserClass = this.parsers.get(format);
      if (!parserClass) {
        throw new Error(`Unknown streaming format: ${format}`);
      }

      const parser = new parserClass({
        streamId,
        metadata,
        onChunk: (chunk) => this.handleChunk(streamId, chunk),
        onComplete: () => this.handleComplete(streamId, startTime),
        onError: (error) => this.handleError(streamId, error, startTime, enableRetry, { streamId, response, format, metadata })
      });

      this.activeStreams.set(streamId, {
        parser,
        metadata,
        startTime,
        chunks: [],
        format
      });

      await parser.process(response);

    } catch (error) {
      this.logger.error(`[StreamingManager] Error processing stream ${streamId}:`, error);
      this.handleError(streamId, error, startTime, enableRetry, { streamId, response, format, metadata });
    }
  }

  /**
   * Handle incoming chunk
   */
  handleChunk(streamId, chunk) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.chunks.push(chunk);

    // Send via message bridge
    if (this.messageBridge) {
      this.messageBridge.send('chatChunk', {
        role: chunk.role || 'assistant',
        content: this.reconstructContent(stream.chunks),
        model: stream.metadata.model,
        seq: stream.chunks.length,
        streamId,
        cumulative: true
      });
    }
  }

  /**
   * Handle stream completion
   */
  handleComplete(streamId, startTime) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    const processingTime = Date.now() - (startTime || stream.startTime);

    // Update metrics
    this.updateMetrics(streamId, true, processingTime);

    // Send completion message
    if (this.messageBridge) {
      this.messageBridge.send('streamComplete', { streamId });
    }

    // Clean up
    this.activeStreams.delete(streamId);

    this.logger.log(`[StreamingManager] Stream ${streamId} completed successfully (${processingTime}ms)`);
  }

  /**
   * Handle stream error
   */
  async handleError(streamId, error, startTime, enableRetry = true, retryOptions = null) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    const processingTime = Date.now() - (startTime || stream.startTime);

    this.logger.error(`[StreamingManager] Stream ${streamId} error:`, error);

    // Update metrics
    this.updateMetrics(streamId, false, processingTime);

    // Attempt retry for recoverable errors
    if (enableRetry && this.isRecoverableError(error) && retryOptions) {
      this.activeStreams.delete(streamId); // Clean up before retry
      await this.retryStream(streamId, retryOptions);
      return;
    }

    // Send error completion
    if (this.messageBridge) {
      this.messageBridge.send('streamComplete', { streamId, error: error.message });
    }

    // Clean up
    this.activeStreams.delete(streamId);
  }

  /**
   * Check if error is recoverable
   */
  isRecoverableError(error) {
    const recoverableErrors = [
      'NetworkError',
      'TimeoutError',
      'TypeError', // Often network related
    ];

    return recoverableErrors.some(type => error.name?.includes(type) || error.message?.includes(type));
  }

  /**
   * Reconstruct full content from chunks
   */
  reconstructContent(chunks) {
    // Default implementation - override in parsers if needed
    return chunks.map(c => c.content || '').join('');
  }

  /**
   * Cancel active stream
   */
  cancelStream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (stream && stream.parser.cancel) {
      stream.parser.cancel();
    }
    this.activeStreams.delete(streamId);
  }

  /**
   * Get active stream info
   */
  getActiveStreams() {
    return Array.from(this.activeStreams.keys());
  }

  /**
   * Clean up stale streams that have timed out
   */
  cleanupStaleStreams() {
    const now = Date.now();
    const timeout = this.config.streamTimeout;

    for (const [streamId, stream] of this.activeStreams) {
      if (now - stream.startTime > timeout) {
        this.logger.warn(`[StreamingManager] Stream ${streamId} timed out, cleaning up`);
        this.handleError(streamId, new Error('Stream timeout'));
      }
    }
  }

  /**
   * Retry failed stream processing
   */
  async retryStream(streamId, originalOptions, attempt = 1) {
    if (attempt > this.config.retryAttempts) {
      this.logger.error(`[StreamingManager] Stream ${streamId} failed after ${attempt} attempts`);
      this.handleError(streamId, new Error('Max retry attempts exceeded'));
      return;
    }

    this.logger.log(`[StreamingManager] Retrying stream ${streamId} (attempt ${attempt})`);

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));

    try {
      await this.processStream({
        ...originalOptions,
        streamId: `${streamId}_retry_${attempt}`
      });
    } catch (error) {
      await this.retryStream(streamId, originalOptions, attempt + 1);
    }
  }

  /**
   * Update metrics
   */
  updateMetrics(streamId, success, processingTime) {
    if (!this.config.enableMetrics) return;

    this.metrics.totalStreams++;
    if (success) {
      this.metrics.successfulStreams++;
    } else {
      this.metrics.failedStreams++;
    }

    // Update average processing time
    this.metrics.totalProcessingTime += processingTime;
    this.metrics.avgProcessingTime = this.metrics.totalProcessingTime / this.metrics.totalStreams;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Check if at concurrent stream limit
   */
  isAtCapacity() {
    return this.activeStreams.size >= this.config.maxConcurrentStreams;
  }

  /**
   * Destroy the manager and clean up resources
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Cancel all active streams
    for (const streamId of this.activeStreams.keys()) {
      this.cancelStream(streamId);
    }

    this.activeStreams.clear();
    this.parsers.clear();
  }
}

/**
 * Base Stream Parser Interface
 */
export class BaseStreamParser {
  constructor({ streamId, metadata, onChunk, onComplete, onError }) {
    this.streamId = streamId;
    this.metadata = metadata;
    this.onChunk = onChunk;
    this.onComplete = onComplete;
    this.onError = onError;
    this.isCancelled = false;
  }

  /**
   * Process the response stream
   * @param {Response} response
   */
  async process(response) {
    throw new Error('process() must be implemented by subclass');
  }

  /**
   * Cancel processing
   */
  cancel() {
    this.isCancelled = true;
  }

  /**
   * Emit chunk event
   */
  emitChunk(chunk) {
    if (!this.isCancelled) {
      this.onChunk(chunk);
    }
  }

  /**
   * Emit complete event
   */
  emitComplete() {
    if (!this.isCancelled) {
      this.onComplete();
    }
  }

  /**
   * Emit error event
   */
  emitError(error) {
    if (!this.isCancelled) {
      this.onError(error);
    }
  }
}

/**
 * Delta Encoding v1 Parser (ChatGPT style)
 */
export class DeltaEncodingV1Parser extends BaseStreamParser {
  async process(response) {
    const clone = response.clone();
    const reader = clone.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    const messageParts = [];
    let currentModel = { value: 'unknown' };
    let currentRole = { value: null };
    let chunkSequence = 0;
    let lastEmittedContent = '';
    let lastEmitTime = 0;

    // SSE parsing state
    let currentEvent = 'message';
    let eventData = '';

    try {
      while (!this.isCancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed === '') {
            // Process accumulated event data
            if (eventData && currentEvent === 'delta') {
              try {
                const payload = JSON.parse(eventData);
                const hadContentChange = this.processDeltaPayload(payload, messageParts, currentModel, currentRole);
                const reconstructedText = this.reconstructContent(messageParts);

                // Only emit chunk if content actually changed and it's been at least 100ms since last emit
                // This prevents too frequent updates while still being responsive
                if (hadContentChange && reconstructedText && reconstructedText !== lastEmittedContent) {
                  const now = Date.now();
                  if (now - lastEmitTime >= 100) {
                    chunkSequence++;
                    this.emitChunk({
                      content: reconstructedText,
                      role: currentRole.value || 'assistant',
                      model: currentModel.value,
                      seq: chunkSequence,
                      timestamp: now
                    });
                    lastEmittedContent = reconstructedText;
                    lastEmitTime = now;
                  }
                }
              } catch (e) {
                console.warn(`[DeltaParser] Parse error:`, e);
              }
            }

            // Reset for next event
            currentEvent = 'message';
            eventData = '';
          } else if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim();
          } else if (trimmed.startsWith('data: ')) {
            eventData = eventData ? eventData + '\n' + trimmed.slice(6) : trimmed.slice(6);
          }
        }
      }

      // Send final complete message (only once)
      const finalText = this.reconstructContent(messageParts);
      if (finalText && finalText !== lastEmittedContent) {
        chunkSequence++;
        this.emitChunk({
          content: finalText,
          role: currentRole.value || 'assistant',
          model: currentModel.value,
          seq: chunkSequence,
          timestamp: Date.now(),
          isFinal: true
        });
      }

      this.emitComplete();

    } catch (error) {
      this.emitError(error);
    }
  }

  processDeltaPayload(payload, messageParts, currentModel, currentRole) {
    let hadContentChange = false;

    const op = payload.o;
    const path = payload.p;
    const value = payload.v;

    // Track model from metadata
    if (path === "/message/metadata" && op === "add" && value?.model_slug) {
      currentModel.value = value.model_slug;
    }
    if (path === "/message/author/role") {
      currentRole.value = value;
    }

    // Handle batched patch operations
    if (op === "patch" && Array.isArray(value)) {
      for (const subOp of value) {
        const subPath = subOp.p;
        const subOpType = subOp.o;
        const subValue = subOp.v;

        // Track role
        if (subPath === "/message/author/role") {
          currentRole.value = subValue;
        }

        // Track model
        if (subPath === "/message/metadata" && subOpType === "add" && subValue?.model_slug) {
          currentModel.value = subValue.model_slug;
        }

        // Handle content updates
        if (subPath === "/message/content/parts" && (subOpType === "replace" || subOpType === "add")) {
          const oldLength = messageParts.length;
          messageParts.splice(0, messageParts.length, ...(Array.isArray(subValue) ? subValue : [subValue]));
          if (messageParts.length !== oldLength || messageParts.some((part, i) => part !== (Array.isArray(subValue) ? subValue[i] : subValue))) {
            hadContentChange = true;
          }
        } else if (subPath && subPath.startsWith("/message/content/parts/")) {
          const match = subPath.match(/\/message\/content\/parts\/(\d+)/);
          if (match) {
            const idx = parseInt(match[1], 10);
            const oldValue = messageParts[idx];
            if (subOpType === "append") {
              messageParts[idx] = (messageParts[idx] || "") + subValue;
            } else if (subOpType === "replace" || subOpType === "add") {
              messageParts[idx] = subValue;
            }
            if (messageParts[idx] !== oldValue) {
              hadContentChange = true;
            }
          }
        }
      }
    } else {
      // Single operations
      if (path === "/message/content/parts" && (op === "replace" || op === "add")) {
        const oldLength = messageParts.length;
        messageParts.splice(0, messageParts.length, ...(Array.isArray(value) ? value : [value]));
        if (messageParts.length !== oldLength || messageParts.some((part, i) => part !== (Array.isArray(value) ? value[i] : value))) {
          hadContentChange = true;
        }
      } else if (path && path.startsWith("/message/content/parts/")) {
        const match = path.match(/\/message\/content\/parts\/(\d+)/);
        if (match) {
          const idx = parseInt(match[1], 10);
          const oldValue = messageParts[idx];
          if (op === "append") {
            messageParts[idx] = (messageParts[idx] || "") + value;
          } else if (op === "replace" || op === "add") {
            messageParts[idx] = value;
          }
          if (messageParts[idx] !== oldValue) {
            hadContentChange = true;
          }
        }
      }
    }

    return hadContentChange;
  }

  reconstructContent(messageParts) {
    return messageParts.filter(p => typeof p === 'string').join('\n\n');
  }
}

/**
 * Server-Sent Events Parser
 */
export class SSEParser extends BaseStreamParser {
  async process(response) {
    const clone = response.clone();
    const reader = clone.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    let eventData = '';
    let currentEvent = 'message';

    try {
      while (!this.isCancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed === '') {
            // Process event
            if (eventData && currentEvent === 'data') {
              try {
                const data = JSON.parse(eventData);
                this.emitChunk({
                  content: data.content || data.text || '',
                  role: data.role || 'assistant',
                  model: this.metadata.model,
                  seq: Date.now(), // Use timestamp as sequence
                  timestamp: Date.now()
                });
              } catch (e) {
                // Handle non-JSON SSE data
                this.emitChunk({
                  content: eventData,
                  role: 'assistant',
                  model: this.metadata.model,
                  seq: Date.now(),
                  timestamp: Date.now()
                });
              }
            }

            currentEvent = 'message';
            eventData = '';
          } else if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim();
          } else if (trimmed.startsWith('data: ')) {
            eventData = trimmed.slice(6);
          }
        }
      }

      this.emitComplete();

    } catch (error) {
      this.emitError(error);
    }
  }
}

/**
 * JSON Stream Parser
 */
export class JSONStreamParser extends BaseStreamParser {
  async process(response) {
    const clone = response.clone();
    const reader = clone.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';

    try {
      while (!this.isCancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Try to parse complete JSON objects
        const objects = this.extractJSONObject(buffer);
        for (const obj of objects) {
          this.emitChunk({
            content: obj.content || obj.text || '',
            role: obj.role || 'assistant',
            model: this.metadata.model,
            seq: Date.now(),
            timestamp: Date.now()
          });
        }
      }

      this.emitComplete();

    } catch (error) {
      this.emitError(error);
    }
  }

  extractJSONObject(buffer) {
    const objects = [];
    let start = 0;

    while (start < buffer.length) {
      try {
        const result = JSON.parse(buffer.slice(start));
        objects.push(result);
        break; // Successfully parsed complete object
      } catch (e) {
        // Try to find next potential JSON object
        const nextBrace = buffer.indexOf('{', start + 1);
        if (nextBrace === -1) break;
        start = nextBrace;
      }
    }

    return objects;
  }
}