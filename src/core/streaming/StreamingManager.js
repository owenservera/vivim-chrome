/**
 * Centralized Streaming Manager API
 * Handles streaming responses from all AI providers with format abstraction
 */

import { Logger } from '../logging/Logger.js';
import { OpenAIChatCompletionsParser } from '../../providers/chatgpt/parsers/OpenAIChatCompletionsParser.js';
import { DeltaEncodingV1Parser as NewDeltaParser } from '../../providers/chatgpt/parsers/DeltaEncodingV1Parser.js';

export class StreamingManager {
  constructor(messageBridge, config = {}) {
    this.messageBridge = messageBridge;
    this.dataFeedManager = config.dataFeedManager || (typeof window !== 'undefined' ? window.dataFeedManager : null);
    this.activeStreams = new Map();
    this.streamStateHistory = new Map();
    this.parsers = new Map();
    this.connectionPool = new Map(); // Connection pool by host
    this.streamMultiplexQueue = new Map(); // Queued streams by provider
    this.logger = new Logger('StreamingManager');

    this.config = {
      maxConcurrentStreams: 5,
      streamTimeout: 300000,
      retryAttempts: 3,
      retryDelay: 1000,
      enableMetrics: true,
      enableStateTracking: true,
      stateHistoryLimit: 50,
      enableConnectionPooling: true,
      maxConnectionsPerHost: 3,
      connectionPoolTimeout: 60000,
      enableStreamMultiplexing: true,
      multiplexingBatchSize: 10,
      ...config
    };

    this.metrics = {
      totalStreams: 0,
      successfulStreams: 0,
      failedStreams: 0,
      avgProcessingTime: 0,
      totalProcessingTime: 0,
      peakConcurrentStreams: 0,
      connectionPoolHits: 0,
      connectionPoolMisses: 0,
      multiplexedBatches: 0,
      avgChunkProcessingTime: 0,
      totalChunksProcessed: 0,
      memoryUsage: 0,
      performanceByProvider: new Map()
    };

    this.registerDefaultParsers();
    this.cleanupInterval = setInterval(() => this.cleanupStaleStreams(), 60000);
  }

  /**
   * Get or create a connection from the pool
   * @param {string} host - Host identifier
   * @returns {object} Connection object
   */
  getConnection(host) {
    if (!this.config.enableConnectionPooling) {
      return this.createNewConnection(host);
    }

    const pool = this.connectionPool.get(host) || [];
    const now = Date.now();

    // Find available connection
    const availableConnection = pool.find(conn =>
      !conn.inUse && (now - conn.lastUsed) < this.config.connectionPoolTimeout
    );

    if (availableConnection) {
      availableConnection.inUse = true;
      availableConnection.lastUsed = now;
      this.metrics.connectionPoolHits++;
      return availableConnection;
    }

    // Create new connection if pool not full
    if (pool.length < this.config.maxConnectionsPerHost) {
      const connection = this.createNewConnection(host);
      pool.push(connection);
      this.connectionPool.set(host, pool);
      this.metrics.connectionPoolMisses++;
      return connection;
    }

    // Reuse oldest connection
    const oldestConnection = pool.reduce((oldest, conn) =>
      conn.lastUsed < oldest.lastUsed ? conn : oldest
    );
    oldestConnection.inUse = true;
    oldestConnection.lastUsed = now;
    this.metrics.connectionPoolHits++;
    return oldestConnection;
  }

  /**
   * Create a new connection
   * @param {string} host - Host identifier
   * @returns {object} Connection object
   */
  createNewConnection(host) {
    return {
      host,
      inUse: true,
      lastUsed: Date.now(),
      streams: [],
      created: Date.now()
    };
  }

  /**
   * Release a connection back to the pool
   * @param {object} connection - Connection to release
   */
  releaseConnection(connection) {
    connection.inUse = false;
    connection.lastUsed = Date.now();

    // Clean up expired connections
    this.cleanupExpiredConnections(connection.host);
  }

  /**
   * Clean up expired connections for a host
   * @param {string} host - Host identifier
   */
  cleanupExpiredConnections(host) {
    const pool = this.connectionPool.get(host);
    if (!pool) return;

    const now = Date.now();
    const activePool = pool.filter(conn =>
      (now - conn.lastUsed) < this.config.connectionPoolTimeout
    );

    if (activePool.length !== pool.length) {
      this.connectionPool.set(host, activePool);
      this.logger.debug(`Cleaned up ${pool.length - activePool.length} expired connections for ${host}`);
    }
  }

  /**
   * Queue stream for multiplexing
   * @param {object} streamOptions - Stream options
   */
  queueForMultiplexing(streamOptions) {
    if (!this.config.enableStreamMultiplexing) {
      this.processStreamImmediately(streamOptions);
      return;
    }

    const { metadata } = streamOptions;
    const provider = metadata?.provider || 'unknown';
    const queue = this.streamMultiplexQueue.get(provider) || [];

    queue.push(streamOptions);
    this.streamMultiplexQueue.set(provider, queue);

    // Process batch immediately if queue has reached batch size;
    // otherwise process right away with no delay — the interactive chat
    // use-case has at most one stream at a time and should not wait 100ms
    // per chunk just to collect a batch that will never form.
    if (queue.length >= this.config.multiplexingBatchSize) {
      this.processMultiplexedBatch(provider);
    } else {
      this.processMultiplexedBatch(provider);
    }
  }

  /**
   * Process a batch of multiplexed streams
   * @param {string} provider - Provider identifier
   */
  async processMultiplexedBatch(provider) {
    const queue = this.streamMultiplexQueue.get(provider) || [];
    if (queue.length === 0) return;

    this.streamMultiplexQueue.delete(provider);
    this.metrics.multiplexedBatches++;

    this.logger.debug(`Processing multiplexed batch of ${queue.length} streams for ${provider}`);

    // Process streams with optimized batching
    const batches = this.chunkArray(queue, 3); // Process in groups of 3

    for (const batch of batches) {
      const promises = batch.map(options => this.processStreamImmediately(options));
      await Promise.allSettled(promises);

      // Small delay between batches to prevent overwhelming
      if (batches.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
  }

  /**
   * Chunk array into smaller arrays
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array} Array of chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Process stream immediately (non-multiplexed)
   * @param {object} streamOptions - Stream options
   */
  async processStreamImmediately(streamOptions) {
    const { streamId, response, format, metadata = {} } = streamOptions;

    // Get connection from pool
    const host = this.extractHostFromMetadata(metadata);
    const connection = this.getConnection(host);

    try {
      // Add stream to connection
      connection.streams.push(streamId);

      await this.processStreamWithParser({
        streamId,
        response,
        format,
        metadata: { ...metadata, connection }
      });

    } finally {
      // Release connection
      this.releaseConnection(connection);
      connection.streams = connection.streams.filter(id => id !== streamId);
    }
  }

  /**
   * Extract host from metadata
   * @param {object} metadata - Stream metadata
   * @returns {string} Host identifier
   */
  extractHostFromMetadata(metadata) {
    if (metadata.provider === 'chatgpt') return 'chatgpt.com';
    if (metadata.provider === 'claude') return 'claude.ai';
    if (metadata.provider === 'gemini') return 'gemini.google.com';
    return 'unknown';
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
    this.registerParser('delta-encoding-v1', NewDeltaParser);
    this.registerParser('openai-chat', OpenAIChatCompletionsParser);
    this.registerParser('openai-responses', OpenAIResponsesParser);
    this.registerParser('openai-sse', OpenAISSEParser);
    this.registerParser('claude-sse', ClaudeSSEParser);
    this.registerParser('gemini-sse', GeminiSSEParser);
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
  async processStream(options) {
    const { metadata = {} } = options;

    // Use multiplexing for better performance
    if (this.config.enableStreamMultiplexing && metadata.provider) {
      this.queueForMultiplexing(options);
    } else {
      await this.processStreamImmediately(options);
    }
  }

  /**
   * Process stream with parser (internal method)
   * @param {Object} options
   */
  async processStreamWithParser({ streamId, response, format, metadata = {}, enableRetry = true }) {
    const startTime = Date.now();

    // Check capacity
    if (this.isAtCapacity()) {
      this.logger.warn(`Streaming capacity exceeded for ${streamId}`);
      this.handleError(streamId, new Error('Streaming capacity exceeded'));
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
        // accumulatedContent replaces per-chunk reconstructContent() calls (O(1) append vs O(n) join)
        accumulatedContent: '',
        format
      });

      await parser.process(response);

    } catch (error) {
      this.logger.error(`Error processing stream ${streamId}:`, error);
      this.handleError(streamId, error, startTime, enableRetry, { streamId, response, format, metadata });
    }
  }

  /**
   * Handle incoming chunk
   */
  handleChunk(streamId, chunk) {
    const startTime = Date.now();
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    stream.chunks.push(chunk);
    this.metrics.totalChunksProcessed++;

    // Append the new content delta to the running accumulated string.
    // This is O(1) per chunk instead of the previous O(n) reconstructContent()
    // call, which joined ALL chunks on every single chunk event.
    const delta = chunk.content || '';
    if (chunk.cumulative) {
      // Some parsers send the full cumulative text each time — use it directly
      stream.accumulatedContent = delta;
    } else {
      stream.accumulatedContent += delta;
    }

    // Track chunk processing performance
    const processingTime = Date.now() - startTime;
    this.updateChunkMetrics(processingTime);

    // Send via message bridge
    if (this.messageBridge) {
      this.logger.info(`[handleChunk] Sending chatChunk seq=${stream.chunks.length}, length=${stream.accumulatedContent.length}, cumulative=${true}, isFinal=${chunk.isFinal || false}`);
      this.messageBridge.send('chatChunk', {
        role: chunk.role || 'assistant',
        content: stream.accumulatedContent,
        model: stream.metadata.model,
        seq: stream.chunks.length,
        streamId,
        cumulative: true,
        isFinal: chunk.isFinal || false
      });

      // Emit message received event to data feed
      if (this.dataFeedManager?.isEnabled() && chunk.isFinal) {
        this.dataFeedManager.emit('message:received', {
          provider: stream.metadata?.provider || 'unknown',
          role: chunk.role || 'assistant',
          content: stream.accumulatedContent,
          model: stream.metadata.model,
          streamId,
          chunkCount: stream.chunks.length,
          messageLength: stream.accumulatedContent.length
        });
      }
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
    this.updateProviderMetrics(stream.metadata?.provider, processingTime, stream.chunks.length);

    // Send completion message
    if (this.messageBridge) {
      this.messageBridge.send('streamComplete', { streamId });
    }

    // Clean up
    this.activeStreams.delete(streamId);

    this.logger.info(`Stream ${streamId} completed successfully (${processingTime}ms, ${stream.chunks.length} chunks)`);
  }

  /**
   * Handle stream error
   */
  async handleError(streamId, error, startTime, enableRetry = true, retryOptions = null) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return;

    const processingTime = Date.now() - (startTime || stream.startTime);

    this.logger.error(`Stream ${streamId} error:`, error);

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

  saveStreamState(streamId) {
    if (!this.config.enableStateTracking) return null;

    const stream = this.activeStreams.get(streamId);
    if (!stream) return null;

    const state = {
      streamId,
      metadata: stream.metadata,
      format: stream.format,
      chunksReceived: stream.chunks.length,
      lastChunkSeq: stream.chunks.length,
      timestamp: Date.now()
    };

    this.streamStateHistory.set(streamId, state);

    if (this.streamStateHistory.size > this.config.stateHistoryLimit) {
      const oldestKey = this.streamStateHistory.keys().next().value;
      this.streamStateHistory.delete(oldestKey);
    }

    return state;
  }

  getStreamState(streamId) {
    if (this.activeStreams.has(streamId)) {
      return this.saveStreamState(streamId);
    }
    return this.streamStateHistory.get(streamId) || null;
  }

  getStreamProgress(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (!stream) return null;

    return {
      streamId,
      chunksReceived: stream.chunks.length,
      contentLength: stream.chunks.reduce((acc, c) => acc + (c.content?.length || 0), 0),
      elapsed: Date.now() - stream.startTime
    };
  }

  /**
   * Cancel active stream
   */
  cancelStream(streamId) {
    const stream = this.activeStreams.get(streamId);
    if (stream && stream.parser.cancel) {
      stream.parser.cancel();
    }

    if (this.config.enableStateTracking) {
      this.saveStreamState(streamId);
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

    // Track peak concurrent streams
    this.metrics.peakConcurrentStreams = Math.max(
      this.metrics.peakConcurrentStreams,
      this.activeStreams.size
    );

    // Track memory usage (rough estimate)
    this.updateMemoryMetrics();
  }

  /**
   * Update chunk processing metrics
   * @param {number} processingTime - Time to process chunk
   */
  updateChunkMetrics(processingTime) {
    if (!this.config.enableMetrics) return;

    this.metrics.totalChunksProcessed++;
    this.metrics.avgChunkProcessingTime =
      (this.metrics.avgChunkProcessingTime * (this.metrics.totalChunksProcessed - 1) + processingTime) /
      this.metrics.totalChunksProcessed;
  }

  /**
   * Update provider-specific metrics
   * @param {string} provider - Provider name
   * @param {number} processingTime - Stream processing time
   * @param {number} chunkCount - Number of chunks
   */
  updateProviderMetrics(provider, processingTime, chunkCount) {
    if (!provider || !this.config.enableMetrics) return;

    const providerMetrics = this.metrics.performanceByProvider.get(provider) || {
      streams: 0,
      totalTime: 0,
      avgTime: 0,
      totalChunks: 0,
      avgChunksPerStream: 0
    };

    providerMetrics.streams++;
    providerMetrics.totalTime += processingTime;
    providerMetrics.avgTime = providerMetrics.totalTime / providerMetrics.streams;
    providerMetrics.totalChunks += chunkCount;
    providerMetrics.avgChunksPerStream = providerMetrics.totalChunks / providerMetrics.streams;

    this.metrics.performanceByProvider.set(provider, providerMetrics);
  }

  /**
   * Update memory usage metrics
   */
  updateMemoryMetrics() {
    if (typeof performance !== 'undefined' && performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const metrics = { ...this.metrics };

    // Convert Map to object for serialization
    metrics.performanceByProvider = Object.fromEntries(metrics.performanceByProvider);
    metrics.connectionPoolSize = this.connectionPool.size;
    metrics.activeConnections = Array.from(this.connectionPool.values())
      .flat()
      .filter(conn => conn.inUse).length;

    return metrics;
  }

  /**
   * Get performance report
   * @returns {object} Detailed performance report
   */
  getPerformanceReport() {
    const metrics = this.getMetrics();
    const report = {
      ...metrics,
      efficiency: {
        connectionPoolHitRate: metrics.connectionPoolHits /
          (metrics.connectionPoolHits + metrics.connectionPoolMisses) || 0,
        multiplexingEfficiency: metrics.multiplexedBatches / metrics.totalStreams || 0,
        successRate: metrics.successfulStreams / metrics.totalStreams || 0
      },
      thresholds: {
        avgProcessingTimeOk: metrics.avgProcessingTime < 5000, // < 5 seconds
        avgChunkProcessingTimeOk: metrics.avgChunkProcessingTime < 100, // < 100ms per chunk
        memoryUsageOk: metrics.memoryUsage < 50 * 1024 * 1024 // < 50MB
      }
    };

    return report;
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
 * Base SSE Parser - Common SSE parsing logic for all providers
 */
export class BaseSSEParser extends BaseStreamParser {
  constructor(options) {
    super(options);
    this.logger = new Logger('BaseSSEParser');
  }

  /**
   * Process SSE response stream
   * @param {Response} response
   */
  async process(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    let eventData = '';
    let currentEvent = 'message';
    let eventId = null;

    try {
      while (!this.isCancelled) {
        const { done, value } = await reader.read();
        if (done) {
          // Handle stream end - emit final completion
          this.handleStreamEnd();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();

          if (trimmed === '') {
            if (eventData) {
              try {
                await this.processSSEEvent(currentEvent, eventData, eventId);
              } catch (error) {
                this.logger.warn(`Error processing SSE event ${currentEvent}:`, error);
              }
            }

            currentEvent = 'message';
            eventData = '';
            eventId = null;
          } else if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5);
            eventData = eventData ? eventData + '\n' + data : data;
          } else if (trimmed.startsWith('id:')) {
            eventId = trimmed.slice(3).trim();
          } else if (trimmed.startsWith(':') || trimmed.startsWith('retry:')) {
          }
        }
      }

      this.emitComplete();

    } catch (error) {
      this.emitError(error);
    }
  }

  /**
   * Process a complete SSE event - to be implemented by subclasses
   * @param {string} eventType - The event type (e.g., 'data', 'error', 'done')
   * @param {string} data - The event data
   * @param {string} eventId - The event ID if provided
   */
  async processSSEEvent(eventType, data, eventId) {
    throw new Error('processSSEEvent() must be implemented by subclass');
  }

  /**
   * Handle stream end - check for completion detection
   */
  handleStreamEnd() {
    // Default: assume completion on stream end
    // Subclasses can override for custom completion logic
  }

  /**
   * Parse JSON data safely
   * @param {string} data
   * @returns {object|null}
   */
  parseJSONData(data) {
    try {
      return JSON.parse(data);
    } catch (error) {
      this.logger.warn('Failed to parse SSE data as JSON:', data, error);
      return null;
    }
  }

  /**
   * Extract text content from various SSE data formats
   * @param {object} data - Parsed SSE data
   * @param {string[]} textPaths - Array of dot-notation paths to check for text
   * @returns {string}
   */
  extractTextContent(data, textPaths = ['content', 'text', 'message']) {
    if (!data || typeof data !== 'object') return '';

    for (const path of textPaths) {
      const value = this.getNestedValue(data, path);
      if (typeof value === 'string' && value.trim()) {
        return value;
      }
    }

    return '';
  }

  /**
   * Get nested object value by dot-notation path
   * @param {object} obj
   * @param {string} path
   * @returns {any}
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Emit a standardized chunk with optional metadata
   * @param {object} options
   * @param {string} options.content - The text content
   * @param {string} [options.role] - Message role
   * @param {string} [options.model] - Model name
   * @param {object} [options.metadata] - Additional metadata (usage, tool_calls, etc.)
   * @param {boolean} [options.isFinal] - Whether this is the final chunk
   */
  emitChunkWithMetadata({ content, role = 'assistant', model, metadata = {}, isFinal = false }) {
    const chunk = {
      content,
      role,
      model: model || this.metadata.model,
      seq: Date.now(),
      timestamp: Date.now(),
      ...metadata,
      isFinal
    };

    this.emitChunk(chunk);
  }
}

/**
 * Delta Encoding v1 Parser (ChatGPT style)
 */
export class DeltaEncodingV1Parser extends BaseStreamParser {
  constructor(options) {
    super(options);
    this.logger = new Logger('DeltaEncodingV1Parser');
  }

  async process(response) {
    this.logger.info(`[DELTA_PARSER] === START streamId=${this.streamId} ===`);
    const clone = response.clone();
    const reader = clone.body.getReader();
    const decoder = new TextDecoder('utf-8');

    let buffer = '';
    let totalBytesRead = 0;
    let totalLinesProcessed = 0;
    const messageParts = [];
    let currentModel = { value: 'unknown' };
    let currentRole = { value: null };
    let chunkSequence = 0;
    let lastEmittedContent = '';

    let currentEvent = 'message';
    let eventData = '';
    let eventsSeen = new Set();
    let payloadTypesSeen = new Set();

    try {
      this.logger.info(`[DELTA_PARSER] Reader started, beginning stream consumption`);
      while (!this.isCancelled) {
        const { done, value } = await reader.read();
        
        if (done) {
          this.logger.info(`[DELTA_PARSER] Reader DONE signal received`);
          break;
        }

        if (value) {
          const rawBytes = value.byteLength || value.length;
          totalBytesRead += rawBytes;
          const decoded = decoder.decode(value, { stream: true });
          buffer += decoded;
          this.logger.debug(`[DELTA_PARSER] READ ${rawBytes} bytes, buffer now ${buffer.length} chars`);
        }

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        this.logger.debug(`[DELTA_PARSER] Split into ${lines.length} lines, buffer residue ${buffer.length} chars`);

        for (const line of lines) {
          totalLinesProcessed++;
          const trimmed = line.trim();
          if (!trimmed) continue;

          const linePreview = trimmed.substring(0, 150);
          this.logger.debug(`[DELTA_PARSER] LINE ${totalLinesProcessed}: "${linePreview}${trimmed.length > 150 ? '...' : ''}"`);

          if (trimmed.startsWith('event: ')) {
            const prevEvent = currentEvent;
            currentEvent = trimmed.slice(7).trim();
            eventsSeen.add(currentEvent);
            this.logger.info(`[DELTA_PARSER] EVENT CHANGE: "${prevEvent}" -> "${currentEvent}"`);
          } else if (trimmed.startsWith('data: ')) {
            const rawData = trimmed.slice(6);
            this.logger.debug(`[DELTA_PARSER] DATA prefix, ${rawData.length} chars`);
            
            if (rawData === '[DONE]') {
              this.logger.info(`[DELTA_PARSER] *** STREAM END MARKER [DONE] ***`);
              break;
            }
            
            eventData = eventData ? eventData + '\n' + rawData : rawData;
            this.logger.debug(`[DELTA_PARSER] eventData buffer now ${eventData.length} chars`);

            try {
              const payload = JSON.parse(eventData);
              const payloadKeys = Object.keys(payload).join(', ');
              payloadTypesSeen.add(payloadKeys);
              this.logger.info(`[DELTA_PARSER] JSON PARSED OK: keys=[${payloadKeys}], eventType="${currentEvent}"`);
              
              if (this.logger.isDebugEnabled()) {
                this.logger.debug(`[DELTA_PARSER] FULL PAYLOAD: ${JSON.stringify(payload).substring(0, 500)}`);
              }

              let hadContentChange = false;
              if (currentEvent === 'delta') {
                this.logger.debug(`[DELTA_PARSER] Processing as delta event`);
                hadContentChange = this.processDeltaPayload(payload, messageParts, currentModel, currentRole);
              } else if (currentEvent === 'delta_encoding') {
                this.logger.debug(`[DELTA_PARSER] Processing as delta_encoding event`);
                hadContentChange = this.processDeltaEncodingPayload(payload, messageParts, currentModel, currentRole);
              } else if (currentEvent === 'message' || !currentEvent) {
                if (payload.message) {
                  this.logger.debug(`[DELTA_PARSER] Processing as message event`);
                  hadContentChange = this.processMessagePayload(payload, messageParts, currentModel, currentRole);
                } else if (payload.o && payload.p) {
                  this.logger.debug(`[DELTA_PARSER] Processing as implicit delta (o/p present)`);
                  hadContentChange = this.processDeltaPayload(payload, messageParts, currentModel, currentRole);
                } else if (Array.isArray(payload)) {
                  this.logger.debug(`[DELTA_PARSER] Processing as array payload`);
                  hadContentChange = this.processDeltaEncodingPayload(payload, messageParts, currentModel, currentRole);
                } else {
                  this.logger.debug(`[DELTA_PARSER] No message.o/p, skipping`);
                }
              } else {
                this.logger.debug(`[DELTA_PARSER] Unhandled event type "${currentEvent}", skipping`);
              }

              if (hadContentChange) {
                const reconstructedText = this.reconstructContent(messageParts);
                const prevLen = lastEmittedContent.length;
                chunkSequence++;
                this.logger.info(`[DELTA_PARSER] *** EMIT CHUNK #${chunkSequence}: ${reconstructedText.length} chars (delta: ${reconstructedText.length - prevLen}) ***`);
                this.logger.debug(`[DELTA_PARSER] Content preview: "${reconstructedText.substring(0, 100)}..."`);
                
                this.emitChunk({
                  content: reconstructedText,
                  role: currentRole.value || 'assistant',
                  model: currentModel.value,
                  seq: chunkSequence,
                  timestamp: Date.now(),
                  cumulative: true
                });
                lastEmittedContent = reconstructedText;
              } else {
                this.logger.debug(`[DELTA_PARSER] No content change detected`);
              }
              
              eventData = '';
            } catch (e) {
              this.logger.debug(`[DELTA_PARSER] JSON parse partial/invalid: ${e.message}, keeping buffer`);
            }
          } else {
            this.logger.debug(`[DELTA_PARSER] Non-event/data line: "${trimmed.substring(0, 50)}"`);
          }
        }
      }

      this.logger.info(`[DELTA_PARSER] Stream loop done. Events seen: ${Array.from(eventsSeen).join(', ')}`);
      this.logger.info(`[DELTA_PARSER] Payload types: ${Array.from(payloadTypesSeen).join(', ')}`);

      const finalText = this.reconstructContent(messageParts);
      this.logger.info(`[DELTA_PARSER] Final reconstruction: ${finalText.length} chars`);
      this.logger.debug(`[DELTA_PARSER] Final content: "${finalText.substring(0, 200)}..."`);
      
      if (finalText !== undefined) {
        chunkSequence++;
        this.logger.info(`[DELTA_PARSER] *** EMIT FINAL CHUNK #${chunkSequence} ***`);
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

      this.logger.info(`[DELTA_PARSER] === COMPLETE: ${totalBytesRead} bytes, ${totalLinesProcessed} lines, ${chunkSequence} chunks ===`);
      this.emitComplete();

    } catch (error) {
      this.logger.error(`[DELTA_PARSER] ERROR: ${error.message}`, error.stack);
      this.emitError(error);
    }
  }

  processMessagePayload(payload, messageParts, currentModel, currentRole) {
    let hadContentChange = false;
    const msg = payload.message;
    if (!msg) {
      this.logger.debug(`[DELTA_PARSER] processMessagePayload: no message field`);
      return false;
    }

    this.logger.debug(`[DELTA_PARSER] processMessagePayload: author.role="${msg.author?.role}", model="${msg.metadata?.model_slug}"`);
    if (msg.author?.role) {
      currentRole.value = msg.author.role;
      this.logger.debug(`[DELTA_PARSER] Role set to: ${currentRole.value}`);
    }
    if (msg.metadata?.model_slug) {
      currentModel.value = msg.metadata.model_slug;
      this.logger.debug(`[DELTA_PARSER] Model set to: ${currentModel.value}`);
    }

    if (msg.content?.parts) {
      const newParts = msg.content.parts;
      this.logger.debug(`[DELTA_PARSER] messageParts: ${newParts.length} parts`);
      if (this.logger.isDebugEnabled()) {
        this.logger.debug(`[DELTA_PARSER] Parts: ${JSON.stringify(newParts).substring(0, 200)}`);
      }
      if (newParts.length !== messageParts.length || newParts.some((p, i) => p !== messageParts[i])) {
        messageParts.splice(0, messageParts.length, ...(Array.isArray(newParts) ? newParts : [newParts]));
        hadContentChange = true;
        this.logger.info(`[DELTA_PARSER] messageParts updated, ${messageParts.length} parts now`);
      }
    } else {
      this.logger.debug(`[DELTA_PARSER] No content.parts in message`);
    }
    return hadContentChange;
  }

  processDeltaPayload(payload, messageParts, currentModel, currentRole) {
    let hadContentChange = false;

    const op = payload.o;
    const path = payload.p;
    const value = payload.v;
    
    this.logger.debug(`[DELTA_PARSER] processDeltaPayload: op="${op}", path="${path}"`);

    if (op === "patch" && Array.isArray(value)) {
      this.logger.debug(`[DELTA_PARSER] Batch patch with ${value.length} operations`);
      for (const subOp of value) {
        const subPath = subOp.p;
        const subOpType = subOp.o;
        const subValue = subOp.v;
        
        if (subPath === "/message/author/role") {
          currentRole.value = subValue;
          this.logger.debug(`[DELTA_PARSER] Role set to: ${currentRole.value}`);
        }

        if (subPath === "/message/metadata" && subOpType === "add" && subValue?.model_slug) {
          currentModel.value = subValue.model_slug;
          this.logger.debug(`[DELTA_PARSER] Model set to: ${currentModel.value}`);
        }

        if (subPath === "/message/content/parts" || subPath === "/message/content") {
          this.logger.debug(`[DELTA_PARSER] Batch: content path matched`);
          if (subOpType === "replace" || subOpType === "add") {
            const newParts = subValue?.parts || subValue;
            this.logger.debug(`[DELTA_PARSER] Batch: replacing with ${Array.isArray(newParts) ? newParts.length : 1} parts`);
            messageParts.splice(0, messageParts.length, ...(Array.isArray(newParts) ? newParts : [newParts]));
            hadContentChange = true;
          }
        } else if (subPath && subPath.startsWith("/message/content/parts/")) {
          const match = subPath.match(/\/message\/content\/parts\/(\d+)/);
          if (match) {
            const idx = parseInt(match[1], 10);
            const valToAppend = typeof subValue === 'string' ? subValue : (subValue?.parts?.[0] || subValue?.text || "");
            this.logger.debug(`[DELTA_PARSER] Batch: parts[${idx}] op=${subOpType}, valLen=${valToAppend.length}`);
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
        this.logger.debug(`[DELTA_PARSER] Single op: role="${value}"`);
      }
      if (path === "/message/metadata" && op === "add" && value?.model_slug) {
        currentModel.value = value.model_slug;
        this.logger.debug(`[DELTA_PARSER] Single op: model="${value.model_slug}"`);
      }
      
      if ((path === "/message/content/parts" || path === "/message/content") && (op === "replace" || op === "add")) {
        const newParts = value?.parts || value;
        this.logger.debug(`[DELTA_PARSER] Single op: content replace/add, ${Array.isArray(newParts) ? newParts.length : 1} parts`);
        messageParts.splice(0, messageParts.length, ...(Array.isArray(newParts) ? newParts : [newParts]));
        hadContentChange = true;
      } else if (path && path.startsWith("/message/content/parts/")) {
        const match = path.match(/\/message\/content\/parts\/(\d+)/);
        if (match) {
          const idx = parseInt(match[1], 10);
          const valToAppend = typeof value === 'string' ? value : (value?.parts?.[0] || value?.text || "");
          this.logger.debug(`[DELTA_PARSER] Single op: parts[${idx}] op=${op}, val="${valToAppend.substring(0, 50)}..."`);
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
      } else {
        this.logger.debug(`[DELTA_PARSER] Single op: unhandled path="${path}", op="${op}"`);
      }
    }

    this.logger.debug(`[DELTA_PARSER] processDeltaPayload result: hadContentChange=${hadContentChange}, parts=${messageParts.length}`);
    return hadContentChange;
  }

  processDeltaEncodingPayload(payload, messageParts, currentModel, currentRole) {
    let hadContentChange = false;
    
    this.logger.info(`[DELTA_PARSER] processDeltaEncodingPayload called, isArray=${Array.isArray(payload)}`);
    
    if (Array.isArray(payload)) {
      this.logger.info(`[DELTA_PARSER] Array payload with ${payload.length} elements`);
      
      for (let i = 0; i < payload.length; i++) {
        const item = payload[i];
        this.logger.info(`[DELTA_PARSER] Array item[${i}]: type=${typeof item}, isArray=${Array.isArray(item)}`);
        
        if (Array.isArray(item)) {
          this.logger.info(`[DELTA_PARSER]   item[${i}] is array, len=${item.length}, contents=${JSON.stringify(item).substring(0, 200)}`);
          
          if (item.length >= 3) {
            const op = item[0];
            const path = item[1];
            const value = item[2];
            this.logger.info(`[DELTA_PARSER]   Numeric item: op="${op}", p="${path}", v=${JSON.stringify(value).substring(0, 100)}`);
            
            if (op === "patch" && Array.isArray(value)) {
              this.logger.info(`[DELTA_PARSER]   Batch patch with ${value.length} ops`);
              for (const subOp of value) {
                const subResult = this.processDeltaPayload(subOp, messageParts, currentModel, currentRole);
                hadContentChange = hadContentChange || subResult;
              }
            } else {
              const subResult = this.processDeltaPayload({ o: op, p: path, v: value }, messageParts, currentModel, currentRole);
              hadContentChange = hadContentChange || subResult;
            }
          }
        } else if (item && typeof item === 'object') {
          const itemKeys = Object.keys(item).join(', ');
          this.logger.info(`[DELTA_PARSER]   item[${i}] is object, keys: ${itemKeys}`);
          
          if (item.o !== undefined && item.p !== undefined) {
            this.logger.info(`[DELTA_PARSER]   Has o/p: o="${item.o}", p="${item.p}"`);
            const itemResult = this.processDeltaPayload({ o: item.o, p: item.p, v: item.v }, messageParts, currentModel, currentRole);
            hadContentChange = hadContentChange || itemResult;
          } else {
            this.logger.info(`[DELTA_PARSER]   No o/p, skipping object`);
          }
        } else {
          this.logger.info(`[DELTA_PARSER]   item[${i}] is primitive: ${JSON.stringify(item).substring(0, 100)}`);
        }
      }
    } else {
      this.logger.info(`[DELTA_PARSER] Non-array payload in delta_encoding, trying as regular delta`);
      hadContentChange = this.processDeltaPayload(payload, messageParts, currentModel, currentRole);
    }
    
    this.logger.info(`[DELTA_PARSER] processDeltaEncodingPayload result: hadContentChange=${hadContentChange}, parts=${messageParts.length}`);
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

/**
 * OpenAI SSE Parser - Handles OpenAI-compatible streaming format
 * Supports: choices[].delta, finish_reason, usage, tool_calls
 */
export class OpenAISSEParser extends BaseSSEParser {
  constructor(options) {
    super(options);
    this.toolCallBuffer = new ToolCallBuffer();
    this.usageData = null;
    this.finishReason = null;
  }

  async processSSEEvent(eventType, data, eventId) {
    if (eventType === 'data') {
      if (data.trim() === '[DONE]') {
        // Handle completion
        await this.handleCompletion();
        return;
      }

      const parsed = this.parseJSONData(data);
      if (!parsed) return;

      await this.processOpenAIChunk(parsed);
    }
  }

  async processOpenAIChunk(chunk) {
    // Extract usage if present (usually in final chunk)
    if (chunk.usage) {
      this.usageData = chunk.usage;
    }

    // Extract finish_reason
    if (chunk.choices && chunk.choices[0]?.finish_reason) {
      this.finishReason = chunk.choices[0].finish_reason;
    }

    // Process choices
    if (chunk.choices && chunk.choices.length > 0) {
      for (const choice of chunk.choices) {
        const delta = choice.delta || {};

        // Handle content
        const content = delta.content || '';
        if (content) {
          this.emitChunkWithMetadata({
            content,
            role: delta.role || 'assistant',
            model: chunk.model || this.metadata.model
          });
        }

        // Handle tool calls
        if (delta.tool_calls) {
          const toolCallChunks = this.toolCallBuffer.processToolCalls(delta.tool_calls);
          for (const toolChunk of toolCallChunks) {
            this.emitChunkWithMetadata({
              content: '', // Tool calls don't have content
              role: 'assistant',
              model: chunk.model || this.metadata.model,
              metadata: { tool_call: toolChunk }
            });
          }
        }
      }
    }
  }

  async handleCompletion() {
    // Emit any remaining tool calls
    const remainingToolCalls = this.toolCallBuffer.flush();
    for (const toolCall of remainingToolCalls) {
      this.emitChunkWithMetadata({
        content: '',
        role: 'assistant',
        model: this.metadata.model,
        metadata: { tool_call: toolCall },
        isFinal: true
      });
    }

    // Emit final chunk with usage metadata
    if (this.usageData) {
      this.emitChunkWithMetadata({
        content: '',
        role: 'assistant',
        model: this.metadata.model,
        metadata: {
          usage: this.usageData,
          finish_reason: this.finishReason
        },
        isFinal: true
      });
    }

    this.emitComplete();
  }

  handleStreamEnd() {
    // OpenAI streams should end with [DONE], but handle unexpected disconnection
    if (!this.finishReason) {
      this.logger.warn('Stream ended without proper completion signal');
      this.handleCompletion();
    }
  }
}

/**
 * Claude SSE Parser - Handles Anthropic Claude streaming format
 * Supports: event sequences, content_block_delta, message_stop, tool calls
 */
export class ClaudeSSEParser extends BaseSSEParser {
  constructor(options) {
    super(options);
    this.currentMessage = { content: [], tool_calls: [] };
    this.toolCallBuffer = new ToolCallBuffer();
    this.usageData = null;
  }

  async processSSEEvent(eventType, data, eventId) {
    const parsed = this.parseJSONData(data);
    if (!parsed) return;

    switch (eventType) {
      case 'message_start':
        this.handleMessageStart(parsed);
        break;
      case 'content_block_start':
        this.handleContentBlockStart(parsed);
        break;
      case 'content_block_delta':
        this.handleContentBlockDelta(parsed);
        break;
      case 'content_block_stop':
        this.handleContentBlockStop(parsed);
        break;
      case 'message_delta':
        this.handleMessageDelta(parsed);
        break;
      case 'message_stop':
        this.handleMessageStop(parsed);
        break;
      case 'error':
        this.handleErrorEvent(parsed);
        break;
      case 'ping':
        break;
    }
  }

  handleMessageStart(data) {
    this.currentMessage = {
      id: data.message?.id,
      role: data.message?.role || 'assistant',
      content: [],
      tool_calls: []
    };

    if (data.message?.usage) {
      this.usageData = data.message.usage;
    }
  }

  handleContentBlockStart(data) {
    const block = data.content_block;
    if (block.type === 'text') {
      this.currentMessage.content.push({ type: 'text', text: block.text || '' });
    } else if (block.type === 'tool_use') {
      this.currentMessage.tool_calls.push({
        id: block.id,
        name: block.name,
        arguments: ''
      });
    }
  }

  handleContentBlockDelta(data) {
    const delta = data.delta;
    if (!delta) return;

    if (delta.type === 'text_delta') {
      const textBlock = this.currentMessage.content
        .slice()
        .reverse()
        .find(block => block.type === 'text');

      if (textBlock) {
        textBlock.text += delta.text;
        this.emitChunkWithMetadata({
          content: delta.text,
          role: this.currentMessage.role,
          model: this.metadata.model
        });
      }
    } else if (delta.type === 'input_json_delta') {
      const toolCall = this.currentMessage.tool_calls[this.currentMessage.tool_calls.length - 1];
      if (toolCall) {
        toolCall.arguments += delta.partial_json;
      }
    } else if (delta.type === 'thinking_delta') {
      const thinkingBlock = this.currentMessage.content
        .slice()
        .reverse()
        .find(block => block.type === 'thinking');

      if (!thinkingBlock) {
        this.currentMessage.content.push({ type: 'thinking', thinking: '' });
      }

      if (thinkingBlock) {
        thinkingBlock.thinking += delta.thinking;
        this.emitChunkWithMetadata({
          content: '',
          role: this.currentMessage.role,
          model: this.metadata.model,
          metadata: {
            thinking: delta.thinking,
            thinking_type: 'delta'
          }
        });
      }
    }
  }

  handleContentBlockStop(data) {
    // Content block completed - emit tool calls if any
    const toolCall = this.currentMessage.tool_calls[this.currentMessage.tool_calls.length - 1];
    if (toolCall && toolCall.arguments) {
      try {
        const args = JSON.parse(toolCall.arguments);
        this.emitChunkWithMetadata({
          content: '',
          role: this.currentMessage.role,
          model: this.metadata.model,
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
  }

  handleMessageDelta(data) {
    // Accumulate usage data
    if (data.usage) {
      this.usageData = { ...this.usageData, ...data.usage };
    }

    // Handle stop reason
    if (data.delta?.stop_reason) {
      this.currentMessage.stop_reason = data.delta.stop_reason;
    }
  }

  handleMessageStop(data) {
    // Emit final usage and completion
    this.emitChunkWithMetadata({
      content: '',
      role: this.currentMessage.role,
      model: this.metadata.model,
      metadata: {
        usage: this.usageData,
        finish_reason: this.currentMessage.stop_reason
      },
      isFinal: true
    });

    this.emitComplete();
  }

  handleErrorEvent(data) {
    this.logger.error('Claude SSE error event:', data);
    this.emitError(new Error(data.error?.message || 'Claude streaming error'));
  }
}

/**
 * Gemini SSE Parser - Handles Google Gemini streaming format
 * Supports: full responses per chunk, candidates[].content.parts[], finishReason, usageMetadata
 */
export class GeminiSSEParser extends BaseSSEParser {
  constructor(options) {
    super(options);
    this.fullTextBuffer = '';
    this.lastEmittedLength = 0;
    this.usageData = null;
    this.finishReason = null;
  }

  async processSSEEvent(eventType, data, eventId) {
    if (eventType === 'data') {
      const parsed = this.parseJSONData(data);
      if (!parsed) return;

      await this.processGeminiChunk(parsed);
    }
  }

  async processGeminiChunk(chunk) {
    // Extract usage metadata (present on every chunk)
    if (chunk.usageMetadata) {
      this.usageData = chunk.usageMetadata;
    }

    // Process candidates
    if (chunk.candidates && chunk.candidates.length > 0) {
      for (const candidate of chunk.candidates) {
        // Extract finish reason
        if (candidate.finishReason && candidate.finishReason !== 'STOP') {
          this.finishReason = candidate.finishReason;
        }

        // Extract text content
        if (candidate.content && candidate.content.parts) {
          const textContent = candidate.content.parts
            .filter(part => part.text)
            .map(part => part.text)
            .join('');

          // Gemini sends full responses per chunk, so we need to diff
          this.fullTextBuffer += textContent;
          const newText = this.fullTextBuffer.slice(this.lastEmittedLength);

          if (newText) {
            this.emitChunkWithMetadata({
              content: newText,
              role: candidate.content.role || 'model',
              model: this.metadata.model
            });

            this.lastEmittedLength = this.fullTextBuffer.length;
          }
        }

        // Handle function calls (full object per chunk)
        if (candidate.content && candidate.content.parts) {
          for (const part of candidate.content.parts) {
            if (part.functionCall) {
              this.emitChunkWithMetadata({
                content: '',
                role: candidate.content.role || 'model',
                model: this.metadata.model,
                metadata: { tool_call: part.functionCall }
              });
            }
          }
        }
      }
    }
  }

  handleStreamEnd() {
    // Gemini streams end on connection close
    // Emit final usage metadata if available
    if (this.usageData) {
      this.emitChunkWithMetadata({
        content: '',
        role: 'model',
        model: this.metadata.model,
        metadata: {
          usage: this.usageData,
          finish_reason: this.finishReason
        },
        isFinal: true
      });
    }

    this.emitComplete();
  }
}

/**
 * OpenAI Responses API Parser - Handles new semantic event streaming format
 * Supports: response.created, response.output_text.delta, response.completed, etc.
 */
export class OpenAIResponsesParser extends BaseSSEParser {
  constructor(options) {
    super(options);
    this.currentText = '';
    this.lastEmittedLength = 0;
    this.usageData = null;
    this.finishReason = null;
    this.functionCallBuffer = new Map();
  }

  async processSSEEvent(eventType, data, eventId) {
    if (eventType === 'data') {
      if (data.trim() === '[DONE]') {
        await this.handleCompletion();
        return;
      }

      const parsed = this.parseJSONData(data);
      if (!parsed) return;

      await this.processResponseEvent(parsed);
    } else if (eventType === 'ping') {
      // Ping events are keep-alive, ignore
    }
  }

  async processResponseEvent(event) {
    const eventType = event.type;

    switch (eventType) {
      case 'response.created':
        this.handleResponseCreated(event);
        break;
      case 'response.in_progress':
        this.handleResponseInProgress(event);
        break;
      case 'response.output_item_added':
        this.handleOutputItemAdded(event);
        break;
      case 'response.output_text_delta':
        this.handleTextDelta(event);
        break;
      case 'response.output_text_done':
        this.handleTextDone(event);
        break;
      case 'response.function_call_arguments_delta':
        this.handleFunctionCallDelta(event);
        break;
      case 'response.function_call_arguments_done':
        this.handleFunctionCallDone(event);
        break;
      case 'response.completed':
        this.handleResponseCompleted(event);
        break;
      case 'response.failed':
        this.handleResponseFailed(event);
        break;
      case 'error':
        this.handleErrorEvent(event);
        break;
    }
  }

  handleResponseCreated(event) {
    this.usageData = event.usage || null;
    this.emitChunkWithMetadata({
      content: '',
      role: 'assistant',
      model: event.response?.model || this.metadata.model,
      metadata: { event: 'response_created', response: event.response }
    });
  }

  handleResponseInProgress(event) {
    this.emitChunkWithMetadata({
      content: '',
      role: 'assistant',
      model: event.response?.model || this.metadata.model,
      metadata: { event: 'response_in_progress' }
    });
  }

  handleOutputItemAdded(event) {
    const item = event.item;
    if (item?.type === 'message') {
      this.emitChunkWithMetadata({
        content: '',
        role: item.role || 'assistant',
        model: event.response?.model || this.metadata.model,
        metadata: { event: 'output_item_added', item }
      });
    }
  }

  handleTextDelta(event) {
    const delta = event.delta;
    if (!delta) return;

    this.currentText += delta;
    const newText = this.currentText.slice(this.lastEmittedLength);

    if (newText) {
      this.emitChunkWithMetadata({
        content: newText,
        role: 'assistant',
        model: event.response?.model || this.metadata.model
      });
      this.lastEmittedLength = this.currentText.length;
    }
  }

  handleTextDone(event) {
    this.emitChunkWithMetadata({
      content: '',
      role: 'assistant',
      model: event.response?.model || this.metadata.model,
      metadata: { event: 'text_done' },
      isFinal: false
    });
  }

  handleFunctionCallDelta(event) {
    const callId = event.call_id;
    const name = event.function_name;
    const argsDelta = event.arguments_delta;

    if (!this.functionCallBuffer.has(callId)) {
      this.functionCallBuffer.set(callId, {
        call_id: callId,
        name: name || '',
        arguments: ''
      });
    }

    const funcCall = this.functionCallBuffer.get(callId);
    if (name) funcCall.name = name;
    if (argsDelta) funcCall.arguments += argsDelta;

    const partialArgs = funcCall.arguments;
    let parsedArgs = null;
    try {
      parsedArgs = partialArgs ? JSON.parse(partialArgs) : {};
    } catch {
      parsedArgs = { __partial: true, raw: partialArgs };
    }

    this.emitChunkWithMetadata({
      content: '',
      role: 'assistant',
      model: event.response?.model || this.metadata.model,
      metadata: {
        event: 'function_call_delta',
        call_id: callId,
        name: funcCall.name,
        arguments: parsedArgs,
        isPartial: true
      }
    });
  }

  handleFunctionCallDone(event) {
    const callId = event.call_id;
    const funcCall = this.functionCallBuffer.get(callId);
    if (!funcCall) return;

    try {
      const parsedArgs = funcCall.arguments ? JSON.parse(funcCall.arguments) : {};
      this.emitChunkWithMetadata({
        content: '',
        role: 'assistant',
        model: event.response?.model || this.metadata.model,
        metadata: {
          event: 'function_call_done',
          call_id: callId,
          name: funcCall.name,
          arguments: parsedArgs
        },
        isFinal: true
      });
    } catch (e) {
      this.logger.warn('Failed to parse function call arguments:', e);
    }

    this.functionCallBuffer.delete(callId);
  }

  handleResponseCompleted(event) {
    this.finishReason = event.finish_reason || 'stop';
    if (event.usage) {
      this.usageData = event.usage;
    }
    this.emitChunkWithMetadata({
      content: '',
      role: 'assistant',
      model: event.response?.model || this.metadata.model,
      metadata: {
        event: 'response_completed',
        finish_reason: this.finishReason,
        usage: this.usageData
      },
      isFinal: true
    });
    this.emitComplete();
  }

  handleResponseFailed(event) {
    const errorMsg = event.error?.message || 'Response failed';
    this.emitError(new Error(errorMsg));
  }

  handleErrorEvent(event) {
    const errorMsg = event.error?.message || 'Stream error';
    this.emitError(new Error(errorMsg));
  }

  handleStreamEnd() {
    if (!this.finishReason) {
      this.logger.warn('Stream ended without completion event');
      this.handleResponseCompleted({ finish_reason: 'unknown', usage: this.usageData });
    }
  }
}

/**
 * Tool Call Buffer - Handles incremental tool call construction
 */
export class ToolCallBuffer {
  constructor() {
    this.activeToolCalls = new Map();
  }

  processToolCalls(toolCalls) {
    const completedChunks = [];

    for (const toolCall of toolCalls) {
      const id = toolCall.id || toolCall.index?.toString();
      if (!id) continue;

      if (!this.activeToolCalls.has(id)) {
        this.activeToolCalls.set(id, {
          id: toolCall.id,
          index: toolCall.index,
          name: '',
          arguments: ''
        });
      }

      const active = this.activeToolCalls.get(id);

      if (toolCall.function?.name) {
        active.name += toolCall.function.name;
      }

      if (toolCall.function?.arguments) {
        active.arguments += toolCall.function.arguments;
      }

      if (active.name && active.arguments) {
        const parsed = this.tryParseJSON(active.arguments);
        if (parsed !== null) {
          completedChunks.push({
            id: active.id,
            index: active.index,
            name: active.name,
            arguments: parsed
          });
          this.activeToolCalls.delete(id);
        }
      }
    }

    return completedChunks;
  }

  tryParseJSON(str) {
    try {
      return JSON.parse(str);
    } catch {
      return null;
    }
  }

  /**
   * Flush any remaining incomplete tool calls
   * @returns {Array} - Array of flushed tool calls
   */
  flush() {
    const remaining = Array.from(this.activeToolCalls.values())
      .filter(call => call.name && call.arguments)
      .map(call => ({
        id: call.id,
        index: call.index,
        name: call.name,
        arguments: call.arguments.startsWith('{') ?
          JSON.parse(call.arguments) : call.arguments
      }));

    this.activeToolCalls.clear();
    return remaining;
  }
}