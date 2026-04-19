/**
 * BaseParser - Abstract base class for streaming parsers
 * Implements state machine and common streaming logic
 */

import { Logger } from '../../../core/logging/Logger.js';

/**
 * Stream states for lifecycle tracking
 */
export const StreamState = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  ROLE_RECEIVED: 'role_received',
  STREAMING: 'streaming',
  TOOL_CALLING: 'tool_calling',
  FINISHING: 'finishing',
  DONE: 'done',
  ERROR: 'error'
};

/**
 * Abstract base parser class
 * All streaming parsers extend this class
 */
export class BaseParser {
  /**
   * @param {Object} options
   * @param {string} options.streamId - Unique stream identifier
   * @param {Object} options.metadata - Stream metadata (provider, model, etc.)
   * @param {Function} options.onChunk - Chunk callback
   * @param {Function} options.onComplete - Complete callback
   * @param {Function} options.onError - Error callback
   */
  constructor(options) {
    this.streamId = options.streamId || `stream_${Date.now()}`;
    this.metadata = options.metadata || {};
    this.onChunk = options.onChunk || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
    
    this.logger = new Logger(`BaseParser:${this.streamId}`);
    
    this.state = StreamState.IDLE;
    this.accumulator = null;
    this.isCancelled = false;
    this.isFinished = false;
    this.chunkCount = 0;
    this.startTime = Date.now();
  }
  
  /**
   * Create the accumulator (implemented by subclasses)
   */
  createAccumulator() {
    throw new Error('createAccumulator() must be implemented by subclass');
  }
  
  /**
   * Initialize the parser before streaming begins
   */
  async initialize() {
    this.accumulator = this.createAccumulator();
    this.transition(StreamState.CONNECTING);
    this.startTime = Date.now();
    this.logger.debug(`Initializing parser for stream ${this.streamId}`);
  }
  
  /**
   * Parse the response stream (implemented by subclasses)
   * @param {Response} response - Fetch Response object
   */
  async parse(response) {
    throw new Error('parse() must be implemented by subclass');
  }
  
  /**
   * Process a complete SSE event (implemented by subclasses)
   * @param {string} eventType - Event type
   * @param {string} data - Event data
   */
  async processEvent(eventType, data) {
    // Default implementation - parse as JSON and process chunk
    try {
      const chunk = JSON.parse(data);
      await this.processChunk(chunk);
    } catch (error) {
      this.logger.error(`Failed to parse event data: ${error.message}`);
    }
  }
  
  /**
   * Process a single chunk (implemented by subclasses)
   * @param {Object} chunk - Parsed chunk
   */
  async processChunk(chunk) {
    throw new Error('processChunk() must be implemented by subclass');
  }
  
  /**
   * Handle stream completion
   */
  handleComplete() {
    if (this.isFinished) return;
    
    this.isFinished = true;
    this.transition(StreamState.DONE);
    
    const elapsed = Date.now() - this.startTime;
    this.logger.info(`Stream complete: ${this.chunkCount} chunks in ${elapsed}ms`);
    
    if (this.onComplete && this.accumulator) {
      this.onComplete(this.accumulator.toMessage());
    }
  }
  
  /**
   * Handle stream error
   * @param {Error} error
   */
  handleError(error) {
    if (this.isFinished) return;
    
    this.isFinished = true;
    this.transition(StreamState.ERROR);
    
    this.logger.error(`Stream error: ${error.message}`);
    
    if (this.onError) {
      this.onError(error);
    }
  }
  
  /**
   * Cancel the stream
   */
  cancel() {
    this.isCancelled = true;
    this.logger.info(`Stream cancelled: ${this.streamId}`);
  }
  
  /**
   * Transition to a new state
   * @param {string} newState
   */
  transition(newState) {
    if (this.state === newState) return;
    
    const oldState = this.state;
    this.state = newState;
    this.logger.debug(`State: ${oldState} -> ${newState}`);
  }
  
  /**
   * Emit a chunk to the callback
   * @param {Object} chunk
   */
  emitChunk(chunk) {
    if (this.isCancelled || this.isFinished) return;
    
    this.chunkCount++;
    
    const enrichedChunk = {
      ...chunk,
      streamId: this.streamId,
      seq: this.chunkCount,
      timestamp: Date.now()
    };
    
    if (this.onChunk) {
      this.onChunk(enrichedChunk);
    }
  }
  
  /**
   * Parse SSE events from buffer
   * @param {string} buffer - Raw buffer
   * @returns {Array<{event: string, data: string}>}
   */
  parseSSEvents(buffer) {
    const events = [];
    const lines = buffer.split('\n');
    let currentEvent = 'message';
    let eventData = '';
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed === '') {
        // Blank line = event boundary
        if (eventData) {
          events.push({ event: currentEvent, data: eventData });
          eventData = '';
        }
      } else if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:')) {
        eventData = trimmed.slice(5).trim();
      } else if (trimmed.startsWith(':') || trimmed.startsWith('retry:')) {
        // Comments - ignore
      }
    }
    
    return events;
  }
  
  /**
   * Check if chunk indicates stream end
   * @param {Object|string} data
   * @returns {boolean}
   */
  isStreamEnd(data) {
    if (typeof data === 'string') {
      return data.trim() === '[DONE]';
    }
    return false;
  }
  
  /**
   * Check if chunk is an error
   * @param {Object} chunk
   * @returns {boolean}
   */
  isErrorChunk(chunk) {
    return chunk && typeof chunk === 'object' && chunk.error !== undefined;
  }
  
  /**
   * Extract error from chunk
   * @param {Object} chunk
   * @returns {Error|null}
   */
  extractError(chunk) {
    if (!this.isErrorChunk(chunk)) return null;
    
    const err = chunk.error;
    return new Error(err?.message || 'Unknown stream error');
  }
}

/**
 * Tool call delta interface
 * @typedef {Object} ToolCallDelta
 * @property {number} index
 * @property {string} [id]
 * @property {string} [type]
 * @property {Object} [function]
 * @property {string} [function.name]
 * @property {string} [function.arguments]
 */

/**
 * Delta object interface
 * @typedef {Object} Delta
 * @property {string} [role]
 * @property {string|null} [content]
 * @property {ToolCallDelta[]} [tool_calls]
 * @property {string|null} [refusal]
 */

export default BaseParser;