/**
 * DeltaEncodingV1Parser - ChatGPT delta-encoding (JSON-patch) stream format
 *
 * Fixes vs original:
 *  1. accumulator is no longer shadowed in the constructor (removed `this.accumulator = null`)
 *  2. response.clone() removed – unnecessary and breaks already-consumed streams
 *  3. Duplicate leftover-eventData try/catch extracted to _processResidualEventData()
 *  4. messageParts synced to accumulator before super.handleComplete() via _syncAccumulator()
 *  5. ROLE_RECEIVED state is now used on first role assignment
 *  6. getValToAppend() is a proper class method, not re-created per call
 *  7. Numeric op codes (0=replace, 1=append, 2=add) are centralised in _opFlags()
 *  8. dataFeedStudy calls wrapped in _study() helper – scatter eliminated
 *  9. reconstructContent() called only once in handleComplete
 */

import { BaseParser, StreamState } from './BaseParser.js';
import { StreamAccumulator } from '../streaming/StreamAccumulator.js';

/** Numeric op → semantic mapping used by the ChatGPT wire format */
const OP_NUM = { REPLACE: 0, APPEND: 1, ADD: 2 };

export class DeltaEncodingV1Parser extends BaseParser {
  /**
   * @param {Object}   options
   * @param {Object}   [options.metadata.dataFeedStudy] - Optional study hook
   */
  constructor(options) {
    super(options);
    this.messageParts   = [];
    this.currentModel   = 'unknown';
    this.currentRole    = null;
    this._roleSet       = false;
    this._study         = this._buildStudy(options.metadata?.dataFeedStudy);
  }

  createAccumulator() {
    return new StreamAccumulator();
  }

  async parse(response) {
    await this.initialize();

    const reader  = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer       = '';
    let currentEvent = 'message';
    let eventData    = '';

    try {
      while (!this.isCancelled) {
        const { done, value } = await reader.read();
        if (done) break;

        const rawChunk = decoder.decode(value, { stream: true });
        buffer += rawChunk;

        this._study('rawStream', { chunk: rawChunk, bufferLength: buffer.length, currentEvent });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        let streamDone = false;

        for (const line of lines) {
          if (this.isCancelled) break;

          const trimmed = line.trim();
          if (!trimmed) continue;

          if (trimmed.startsWith('event: ')) {
            currentEvent = trimmed.slice(7).trim();
          } else if (trimmed.startsWith('data: ')) {
            const data = trimmed.slice(6);

            if (data === '[DONE]') { streamDone = true; break; }

            eventData = eventData ? `${eventData}\n${data}` : data;

            try {
              const payload = JSON.parse(eventData);
              this._study('sseEvent', { eventType: currentEvent, payload });
              await this.processEventPayload(currentEvent, payload);
              eventData = '';
            } catch (e) {
              if (e instanceof SyntaxError) {} else {
                this.logger.error('Error processing payload:', e.message, eventData.slice(0, 200));
                this._study('parseError', { eventData, error: e });
                eventData = '';
              }
            }
          }
        }

        if (streamDone) break;
      }

      if (eventData) {
        await this._processResidualEventData(currentEvent, eventData);
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

  async processEventPayload(eventType, payload) {
    if (this.isErrorChunk(payload)) {
      this.handleError(this.extractError(payload));
      return;
    }

    let hadContentChange = false;

    if (Array.isArray(payload)) {
      this.logger.info(`[DELTA_PARSER] Array payload – ${payload.length} items`);
      this._study('arrayPayload', { length: payload.length });

      for (let i = 0; i < payload.length; i++) {
        const item = payload[i];

        if (item && typeof item === 'object' && item.o !== undefined && item.p !== undefined) {
          hadContentChange = this._processDeltaPayload(item) || hadContentChange;
        } else if (Array.isArray(item) && item.length >= 2) {
          const [op, path, value] = item;
          hadContentChange = this._processDeltaPayload({ o: op, p: path, v: value }) || hadContentChange;
        } else {
          this.logger.debug(`[DELTA_PARSER] Skipping invalid array item ${i}`);
        }
      }
    } else if (payload.o !== undefined && payload.p !== undefined) {
      hadContentChange = this._processDeltaPayload(payload);
    } else if (payload.message) {
      hadContentChange = this._processMessagePayload(payload);
    }

    if (hadContentChange) {
      const content = this.reconstructContent();
      this.transition(StreamState.STREAMING);
      this.emitChunk({
        type:      'content',
        content,
        role:      this.currentRole ?? 'assistant',
        model:     this.currentModel,
        cumulative: true,
        isDelta:   true,
      });
    }
  }

  handleComplete() {
    const finalContent = this.reconstructContent();

    this.logger.info(
      `[handleComplete] final length=${finalContent.length} preview="${finalContent.slice(0, 60)}..."`
    );

    this._syncAccumulator(finalContent);

    this.emitChunk({
      type:       'complete',
      content:    finalContent,
      role:       this.currentRole ?? 'assistant',
      model:      this.currentModel,
      cumulative: true,
      isFinal:    true,
    });

    super.handleComplete();
  }

  reconstructContent() {
    return this.messageParts
      .map((part, idx) => {
        let text = '';
        if (typeof part === 'string') {
          text = part;
        } else if (part && typeof part === 'object') {
          if (typeof part.text === 'string')     text = part.text;
          else if (Array.isArray(part.parts))    text = part.parts.join('');
        }
        this.logger.debug(`[reconstructContent] part[${idx}] len=${text.length}`);
        return text;
      })
      .join('');
  }

  _processMessagePayload(payload) {
    const msg = payload.message;
    if (!msg) return false;

    let changed = false;

    if (msg.author?.role) {
      this._setRole(msg.author.role);
    }
    if (msg.metadata?.model_slug) {
      this.currentModel = msg.metadata.model_slug;
    }
    if (msg.content?.parts) {
      const parts = msg.content.parts;
      const isDiff = parts.length !== this.messageParts.length ||
                   parts.some((p, i) => p !== this.messageParts[i]);
      if (isDiff) {
        this.messageParts.splice(0, this.messageParts.length, ...(Array.isArray(parts) ? parts : [parts]));
        changed = true;
      }
    }

    return changed;
  }

  _processDeltaPayload(payload) {
    const op    = payload.o;
    const path  = this._normalizePath(payload.p);
    const value = payload.v;
    let changed = false;

    this._study('delta', { op, path, value });

    const { isReplace, isAppend } = this._opFlags(op, value);

    if (op === 'patch' && Array.isArray(value)) {
      for (const subOp of value) {
        changed = this._applySubOp(subOp) || changed;
      }
    } else {
      changed = this._applyOp(path, op, value, isReplace, isAppend);
    }

    return changed;
  }

  _applySubOp(subOp) {
    const subPath  = this._normalizePath(subOp.p);
    const subOpVal = subOp.o;
    const subValue = subOp.v;
    const { isReplace, isAppend } = this._opFlags(subOpVal, subValue);
    return this._applyOp(subPath, subOpVal, subValue, isReplace, isAppend);
  }

  _applyOp(path, op, value, isReplace, isAppend) {
    let changed = false;

    if (path === '/message/author/role') {
      this._setRole(value);
      return false;
    }

    if (path === '/message/metadata' && (op === 'add' || op === OP_NUM.ADD || op === OP_NUM.REPLACE)) {
      if (value?.model_slug) this.currentModel = value.model_slug;
      return false;
    }

    if (path === '/message/content/parts' || path === '/message/content') {
      if (isReplace) {
        const parts = value?.parts ?? value;
        this.messageParts.splice(0, this.messageParts.length, ...(Array.isArray(parts) ? parts : [parts]));
        changed = true;
      }
      return changed;
    }

    const partMatch = typeof path === 'string' && path.match(/^\/message\/content\/parts\/(\d+)$/);
    if (partMatch) {
      const idx = parseInt(partMatch[1], 10);
      if (isAppend) {
        this._appendToPart(idx, this._extractText(value));
      } else if (isReplace) {
        this.messageParts[idx] = value;
      }
      return true;
    }

    if (path === '/message/content/text') {
      const text = this._extractText(value);
      if (isAppend) {
        this.messageParts[0] = (typeof this.messageParts[0] === 'string' ? this.messageParts[0] : '') + text;
      } else if (isReplace) {
        this.messageParts[0] = text;
      }
      return true;
    }

    if ((path === '' || path === '/') && isReplace && value?.message) {
      return this._processMessagePayload({ message: value.message });
    }

    return changed;
  }

  _normalizePath(p) {
    if (Array.isArray(p)) return '/' + p.join('/');
    if (typeof p === 'string' && p && !p.startsWith('/')) return '/' + p;
    return p ?? '';
  }

  _opFlags(op, value) {
    const isReplace =
      op === 'replace' || op === 'add' ||
      op === OP_NUM.REPLACE || op === OP_NUM.ADD;

    const isAppend =
      op === 'append' ||
      op === OP_NUM.APPEND ||
      (op === 'patch' && typeof value === 'string');

    return { isReplace, isAppend };
  }

  _extractText(v) {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) {
      return v.map(item => (typeof item === 'string' ? item : (item?.text || item?.parts?.[0] || ""))).join('');
    }
    return v?.parts?.[0] || v?.text || "";
  }

  _appendToPart(idx, text) {
    const current = this.messageParts[idx];
    if (typeof current === 'string') {
      this.messageParts[idx] = current + text;
    } else if (current && typeof current === 'object') {
      if (current.text !== undefined)         current.text += text;
      else if (Array.isArray(current.parts))  current.parts[0] = (current.parts[0] ?? '') + text;
    } else {
      this.messageParts[idx] = text;
    }
  }

  _setRole(role) {
    this.currentRole = role;
    if (!this._roleSet) {
      this._roleSet = true;
      this.transition(StreamState.ROLE_RECEIVED);
    }
  }

  _syncAccumulator(finalContent) {
    this.accumulator.setContent(finalContent);
    this.accumulator.setRole(this.currentRole ?? 'assistant');
    this.accumulator.setModel(this.currentModel);
  }

  async _processResidualEventData(eventType, eventData) {
    try {
      const payload = JSON.parse(eventData);
      this._study('residualPayload', { eventType, payload });
      await this.processEventPayload(eventType, payload);
    } catch (e) {
      if (!(e instanceof SyntaxError)) {
        this.logger.error('Error processing residual payload:', e.message);
        this._study('residualParseError', { eventData, error: e });
      }
    }
  }

  _buildStudy(study) {
    if (!study) return () => {};
    return (eventName, data) => {
      try {
        const method = {
          rawStream:      'captureRawStreamData',
          sseEvent:       'captureSSEEvent',
          parseError:     'captureJSONParseAttempt',
          arrayPayload:   'captureDeltaProcessing',
          delta:          'captureDeltaProcessing',
          residualPayload:'captureJSONParseAttempt',
          residualParseError: 'captureJSONParseAttempt',
          chunkEmit:      'captureChunkEmission',
        }[eventName];
        if (method && typeof study[method] === 'function') {
          study[method](this.streamId, data);
        }
      } catch {}
    };
  }

  emitChunk(chunk) {
    this._study('chunkEmit', { chunk, content: this.reconstructContent() });
    super.emitChunk(chunk);
  }

  async process(response) {
    return this.parse(response);
  }
}

export default DeltaEncodingV1Parser;