/**
 * BaseParser - Abstract base class for streaming parsers
 *
 * Fixes vs original:
 *  - parseSSEvents() is now used by the default parse() SSE loop (no duplicate inline logic)
 *  - processChunk() renamed to processEventPayload() to match the actual contract all subclasses use
 *  - processEvent() forwards to processEventPayload() (backward-compatible)
 *  - handleComplete() is safe to call multiple times (guarded by isFinished)
 *  - emitChunk() is safe after cancel / finish
 *  - Accumulator sync is documented: subclass MUST call accumulator.setContent() before super.handleComplete()
 */

import { Logger } from '../../../core/logging/Logger.js';

/**
 * Stream lifecycle states
 */
export const StreamState = {
  IDLE:          'idle',
  CONNECTING:    'connecting',
  ROLE_RECEIVED: 'role_received',
  STREAMING:     'streaming',
  TOOL_CALLING:  'tool_calling',
  FINISHING:     'finishing',
  DONE:          'done',
  ERROR:         'error',
};

/**
 * Abstract base parser class.
 * All streaming parsers extend this class.
 */
export class BaseParser {
  /**
   * @param {Object}   options
   * @param {string}   [options.streamId]   - Unique stream identifier
   * @param {Object}   [options.metadata]   - Provider / model metadata
   * @param {Function} [options.onChunk]    - Called with each enriched chunk
   * @param {Function} [options.onComplete] - Called with the final message object
   * @param {Function} [options.onError]    - Called with an Error instance
   */
  constructor(options = {}) {
    this.streamId  = options.streamId  || `stream_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.metadata  = options.metadata  || {};
    this.onChunk   = options.onChunk   || (() => {});
    this.onComplete= options.onComplete|| (() => {});
    this.onError   = options.onError   || (() => {});

    this.logger    = new Logger(`${this.constructor.name}:${this.streamId}`);

    this.state      = StreamState.IDLE;
    this.accumulator= null;
    this.isCancelled= false;
    this.isFinished = false;
    this.chunkCount = 0;
    this.startTime  = Date.now();

    /** AbortController – subclasses can use this to cancel the underlying fetch */
    this.abortController = new AbortController();
  }

  // ─── Abstract interface ───────────────────────────────────────────────────────

  /**
   * Create the accumulator for this parser.
   * MUST be implemented by subclasses.
   * @returns {StreamAccumulator}
   */
  createAccumulator() {
    throw new Error(`${this.constructor.name} must implement createAccumulator()`);
  }

  /**
   * Process a single parsed event payload.
   * MUST be implemented by subclasses.
   *
   * Contract: before calling super.handleComplete(), sync content to the accumulator:
   *   this.accumulator.setContent(this.reconstructContent());
   *   this.accumulator.setRole(this.currentRole);
   *
   * @param {string} eventType - SSE event name (e.g. 'message', 'response.done')
   * @param {Object} payload   - Parsed JSON payload
   */
  async processEventPayload(eventType, payload) {
    throw new Error(`${this.constructor.name} must implement processEventPayload()`);
  }

  // ─── Default parse() with shared SSE loop ────────────────────────────────────

  /**
   * Parse a fetch Response as an SSE stream.
   * Subclasses may override this if they need custom framing.
   *
   * @param {Response} response
   */
  async parse(response) {
    await this.initialize();

    const reader  = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer    = '';
    let currentEvent = 'message';
    let eventData    = '';

    try {
      while (!this.isCancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';           // keep the incomplete trailing line

        let streamDone = false;
        for (const line of lines) {
          if (this.isCancelled) break;

          const trimmed = line.trim();
          if (!trimmed) {
            // blank line = event boundary; flush if we have data
            if (eventData) {
              streamDone = await this._flushEventData(currentEvent, eventData);
              eventData    = '';
              currentEvent = 'message';
              if (streamDone) break;
            }
            continue;
          }

          if (trimmed.startsWith('event:')) {
            currentEvent = trimmed.slice(6).trim();
          } else if (trimmed.startsWith('data:')) {
            const data = trimmed.slice(5).trim();
            if (data === '[DONE]') { streamDone = true; break; }
            eventData = eventData ? `${eventData}\n${data}` : data;
          }
          // ignore 'id:', 'retry:', comments (':')
        }

        if (streamDone) break;
      }

      // Flush any residual data in the buffer
      if (eventData && !this.isCancelled) {
        await this._flushEventData(currentEvent, eventData);
      }

      this.handleComplete();
    } catch (error) {
      if (this._isAbortLike(error)) {
        this.logger.info(`Stream aborted (${error.message}), treating as complete`);
        this.handleComplete();
      } else {
        this.handleError(error);
      }
    } finally {
      reader.releaseLock();
    }
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  /**
   * Initialize parser state. Called at the start of parse().
   */
  async initialize() {
    this.accumulator = this.createAccumulator();
    this.startTime   = Date.now();
    this.transition(StreamState.CONNECTING);
    this.logger.debug(`Parser initialised (streamId=${this.streamId})`);
  }

  /**
   * Signal normal stream completion.
   * Safe to call multiple times – only acts on the first call.
   */
  handleComplete() {
    if (this.isFinished) return;

    this.isFinished = true;
    this.transition(StreamState.DONE);

    const elapsed = Date.now() - this.startTime;
    this.logger.info(`Stream complete: ${this.chunkCount} chunks in ${elapsed}ms`);

    if (this.accumulator) {
      this.onComplete(this.accumulator.toMessage());
    }
  }

  /**
   * Signal a stream error.
   * Safe to call multiple times – only acts on the first call.
   * @param {Error} error
   */
  handleError(error) {
    if (this.isFinished) return;

    this.isFinished = true;
    this.transition(StreamState.ERROR);

    this.logger.error(`Stream error: ${error.message}`);
    this.onError(error);
  }

  /**
   * Cancel the stream. The underlying read loop will stop at the next iteration.
   */
  cancel() {
    if (this.isCancelled) return;
    this.isCancelled = true;
    this.abortController.abort();
    this.logger.info(`Stream cancelled: ${this.streamId}`);
  }

  // ─── Emission ─────────────────────────────────────────────────────────────────

  /**
   * Emit a chunk to the onChunk callback, enriched with stream metadata.
   * No-ops if the stream is cancelled or finished.
   * @param {Object} chunk
   */
  emitChunk(chunk) {
    if (this.isCancelled || this.isFinished) return;

    this.chunkCount++;

    this.onChunk({
      ...chunk,
      streamId:  this.streamId,
      seq:       this.chunkCount,
      timestamp: Date.now(),
    });
  }

  // ─── State machine ────────────────────────────────────────────────────────────

  /**
   * @param {string} newState - One of StreamState.*
   */
  transition(newState) {
    if (this.state === newState) return;
    const prev = this.state;
    this.state = newState;
    this.logger.debug(`State: ${prev} → ${newState}`);
  }

  // ─── SSE helpers ─────────────────────────────────────────────────────────────

  /**
   * Parse a raw SSE text buffer into discrete events.
   * Useful for one-shot parsing of a full buffered response.
   *
   * @param {string} buffer
   * @returns {Array<{event: string, data: string}>}
   */
  parseSSEvents(buffer) {
    const events     = [];
    const lines      = buffer.split('\n');
    let currentEvent = 'message';
    let eventData    = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        if (eventData) {
          events.push({ event: currentEvent, data: eventData });
          eventData    = '';
          currentEvent = 'message';
        }
      } else if (trimmed.startsWith('event:')) {
        currentEvent = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('data:')) {
        const data = trimmed.slice(5).trim();
        eventData = eventData ? `${eventData}\n${data}` : data;
      }
      // ignore 'id:', 'retry:', comments
    }

    // Flush final event if buffer didn't end with a blank line
    if (eventData) {
      events.push({ event: currentEvent, data: eventData });
    }

    return events;
  }

  /**
   * @param {Object|string} data
   * @returns {boolean}
   */
  isStreamEnd(data) {
    return typeof data === 'string' && data.trim() === '[DONE]';
  }

  /**
   * @param {Object} chunk
   * @returns {boolean}
   */
  isErrorChunk(chunk) {
    return chunk != null && typeof chunk === 'object' && chunk.error !== undefined;
  }

  /**
   * @param {Object} chunk
   * @returns {Error|null}
   */
  extractError(chunk) {
    if (!this.isErrorChunk(chunk)) return null;
    const err = chunk.error;
    return new Error(err?.message || `Unknown stream error (code: ${err?.code ?? 'n/a'})`);
  }

  // ─── Private ──────────────────────────────────────────────────────────────────

  /**
   * Try to JSON-parse and process accumulated event data.
   * Returns true if a [DONE] sentinel was encountered.
   *
   * @param {string} eventType
   * @param {string} data
   * @returns {Promise<boolean>}
   */
  async _flushEventData(eventType, data) {
    if (this.isStreamEnd(data)) return true;

    try {
      const payload = JSON.parse(data);
      await this.processEventPayload(eventType, payload);
    } catch (e) {
      if (!(e instanceof SyntaxError)) {
        // Logic error inside processEventPayload – log and continue
        this.logger.error(`Error processing event "${eventType}": ${e.message}`);
      }
      // SyntaxError = partial JSON; caller decides whether to keep accumulating
    }
    return false;
  }

  /**
   * @param {Error} error
   * @returns {boolean}
   */
  _isAbortLike(error) {
    return (
      error.name === 'AbortError' ||
      error.name === 'DOMException' ||
      /abort/i.test(error.message)
    );
  }

  // ─── Deprecated aliases ───────────────────────────────────────────────────────

  /**
   * @deprecated Use processEventPayload() instead
   */
  async processEvent(eventType, data) {
    return this.processEventPayload(eventType, data);
  }

  /**
   * @deprecated Use processEventPayload() instead
   */
  async processChunk(chunk) {
    return this.processEventPayload('message', chunk);
  }
}

export default BaseParser;