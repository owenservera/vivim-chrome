/**
 * ResponsesAPIParser
 *
 * Handles the OpenAI Responses API SSE streaming format (/v1/responses).
 *
 * Fixes vs original:
 *   - Uses _textParts Map for content tracking by outputIndex:contentIndex
 *   - Uses _fnCallArgs Map for function call argument buffers
 *   - Uses _outputItems Map for output items
 *   - _on* handler methods with consistent naming
 *   - Proper accumulator integration via setContent(), setRole(), setModel(), etc.
 */

import { BaseParser, StreamState } from './BaseParser.js';
import { StreamAccumulator } from '../streaming/StreamAccumulator.js';

export class ResponsesAPIParser extends BaseParser {
  constructor(options) {
    super(options);
    this._textParts = new Map();
    this._fnCallArgs = new Map();
    this._outputItems = new Map();
    this._responseId  = null;
    this._model       = null;
  }

  createAccumulator() {
    return new StreamAccumulator();
  }

  async processEventPayload(eventType, payload) {
    if (!eventType || !payload) return;

    switch (eventType) {
      case 'response.created':
        return this._onResponseCreated(payload);

      case 'response.output_item.added':
        return this._onOutputItemAdded(payload);

      case 'response.content_part.added':
        return this._onContentPartAdded(payload);

      case 'response.output_text.delta':
        return this._onOutputTextDelta(payload);

      case 'response.output_text.done':
        return this._onOutputTextDone(payload);

      case 'response.refusal.delta':
        return this._onRefusalDelta(payload);

      case 'response.refusal.done':
        return this._onRefusalDone(payload);

      case 'response.function_call_arguments.delta':
        return this._onFnCallArgsDelta(payload);

      case 'response.function_call_arguments.done':
        return this._onFnCallArgsDone(payload);

      case 'response.output_item.done':
        return this._onOutputItemDone(payload);

      case 'response.completed':
      case 'response.done':
        return this._onResponseCompleted(payload);

      case 'error':
        return this._onStreamError(payload);

      default:
        this.logger.debug(`[ResponsesAPI] Unhandled event: ${eventType}`);
    }
  }

  _onResponseCreated(payload) {
    const resp = payload.response ?? payload;
    this._responseId = resp.id   ?? null;
    this._model      = resp.model ?? null;
    if (this._model) this.accumulator.setModel(this._model);
    this.logger.debug(`[ResponsesAPI] Response created id=${this._responseId} model=${this._model}`);
  }

  _onOutputItemAdded(payload) {
    const item = payload.item ?? {};
    const idx  = payload.output_index ?? 0;
    this._outputItems.set(idx, item);

    if (item.type === 'message' && item.role) {
      this.accumulator.setRole(item.role);
      this.transition(StreamState.ROLE_RECEIVED);
    }
  }

  _onContentPartAdded(payload) {
    const key  = this._partKey(payload.output_index, payload.content_index);
    const part = payload.part ?? {};
    this._textParts.set(key, { type: part.type ?? 'output_text', text: part.text ?? '' });
  }

  _onOutputTextDelta(payload) {
    const key   = this._partKey(payload.output_index, payload.content_index);
    const delta = payload.delta ?? '';

    const part = this._textParts.get(key);
    if (part) {
      part.text += delta;
    } else {
      this._textParts.set(key, { type: 'output_text', text: delta });
    }

    this.accumulator.appendContent(delta);
    this.transition(StreamState.STREAMING);

    this.emitChunk({
      type:       'content',
      content:    this.accumulator.content,
      role:       this.accumulator.role,
      model:      this._model,
      cumulative: true,
      isDelta:    true,
    });
  }

  _onOutputTextDone(payload) {
    const key  = this._partKey(payload.output_index, payload.content_index);
    const text = payload.text ?? '';
    const part = this._textParts.get(key);
    if (part && part.text !== text) {
      const diff = text.slice(part.text.length);
      if (diff) {
        this.accumulator.appendContent(diff);
        part.text = text;
      }
    }
  }

  _onRefusalDelta(payload) {
    const delta = payload.delta ?? '';
    this.accumulator.appendRefusal(delta);

    this.emitChunk({
      type:       'refusal',
      refusal:    this.accumulator.refusal,
      cumulative: true,
      isDelta:    true,
    });
  }

  _onRefusalDone(payload) {
    if (payload.refusal != null) {
      this.accumulator.appendRefusal('');
    }
  }

  _onFnCallArgsDelta(payload) {
    const idx   = payload.output_index ?? 0;
    const delta = payload.delta ?? '';

    const current = this._fnCallArgs.get(idx) ?? { callId: null, name: null, args: '' };
    current.args += delta;
    this._fnCallArgs.set(idx, current);

    this.accumulator.applyToolCallDelta({
      index:    idx,
      function: { arguments: delta },
    });

    this.transition(StreamState.TOOL_CALLING);

    this.emitChunk({
      type:       'tool_call_delta',
      index:      idx,
      arguments:  current.args,
      cumulative: true,
      isDelta:    true,
    });
  }

  _onFnCallArgsDone(payload) {
    const idx  = payload.output_index ?? 0;
    const args = payload.arguments ?? '';
    const entry = this._fnCallArgs.get(idx);
    if (entry) entry.args = args;
  }

  _onOutputItemDone(payload) {
    const item = payload.item ?? {};
    const idx  = payload.output_index ?? 0;
    this._outputItems.set(idx, item);

    if (item.type === 'function_call') {
      this.accumulator.applyToolCallDelta({
        index:    idx,
        id:       item.call_id ?? item.id ?? null,
        type:     'function',
        function: { name: item.name ?? '', arguments: item.arguments ?? '' },
      });
    }

    this.transition(StreamState.FINISHING);
  }

  _onResponseCompleted(payload) {
    const resp = payload.response ?? payload;

    if (resp.usage) this.accumulator.setUsage(resp.usage);

    const outputArr = resp.output ?? [];
    for (const item of outputArr) {
      if (item.status === 'completed' || item.stop_reason) {
        this.accumulator.setFinishReason(item.stop_reason ?? 'stop');
        break;
      }
    }
  }

  _onStreamError(payload) {
    const err = payload.error ?? payload;
    this.handleError(new Error(err?.message ?? 'Responses API stream error'));
  }

  handleComplete() {
    this.emitChunk({
      type:          'complete',
      content:       this.accumulator.content,
      role:          this.accumulator.role,
      model:         this._model,
      tool_calls:    this.accumulator._getToolCallsArray(),
      finish_reason: this.accumulator.finishReason,
      usage:         this.accumulator.usage,
      cumulative:    true,
      isFinal:       true,
    });

    super.handleComplete();
  }

  _partKey(outputIndex = 0, contentIndex = 0) {
    return `${outputIndex}:${contentIndex}`;
  }
}

export default ResponsesAPIParser;