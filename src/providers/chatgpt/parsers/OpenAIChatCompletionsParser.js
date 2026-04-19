/**
 * OpenAIChatCompletionsParser
 *
 * Handles the standard OpenAI chat completions SSE streaming format.
 *
 * Fixes vs original:
 *   - Uses _choices Map for per-choice accumulators
 *   - Uses StreamAccumulator methods: setContent(), appendContent(), setRole(), etc.
 *   - _processChoice() for per-choice delta processing
 *   - choiceIndex tracking in emitted chunks
 */

import { BaseParser, StreamState } from './BaseParser.js';
import { StreamAccumulator } from '../streaming/StreamAccumulator.js';

export class OpenAIChatCompletionsParser extends BaseParser {
  constructor(options) {
    super(options);
    this._choices = new Map();
  }

  createAccumulator() {
    return new StreamAccumulator();
  }

  async processEventPayload(eventType, payload) {
    if (this.isErrorChunk(payload)) {
      this.handleError(this.extractError(payload));
      return;
    }

    if (payload.usage && (!payload.choices || payload.choices.length === 0)) {
      this.accumulator.setUsage(payload.usage);
      return;
    }

    if (!Array.isArray(payload.choices)) return;

    if (payload.model) {
      this.accumulator.setModel(payload.model);
      this._choiceAccumulator(0).setModel(payload.model);
    }

    for (const choice of payload.choices) {
      await this._processChoice(choice, payload);
    }
  }

  async _processChoice(choice, payload) {
    const idx        = choice.index ?? 0;
    const acc        = this._choiceAccumulator(idx);
    const delta      = choice.delta ?? {};
    let   hadContent = false;

    if (delta.role) {
      acc.setRole(delta.role);
      if (idx === 0) {
        this.accumulator.setRole(delta.role);
        this.transition(StreamState.ROLE_RECEIVED);
      }
    }

    if (typeof delta.content === 'string' && delta.content.length > 0) {
      acc.appendContent(delta.content);
      if (idx === 0) this.accumulator.appendContent(delta.content);
      hadContent = true;
      this.transition(StreamState.STREAMING);
    }

    if (typeof delta.refusal === 'string' && delta.refusal.length > 0) {
      acc.appendRefusal(delta.refusal);
      if (idx === 0) this.accumulator.appendRefusal(delta.refusal);
      hadContent = true;
    }

    if (Array.isArray(delta.tool_calls) && delta.tool_calls.length > 0) {
      for (const tcDelta of delta.tool_calls) {
        acc.applyToolCallDelta(tcDelta);
        if (idx === 0) this.accumulator.applyToolCallDelta(tcDelta);
      }
      this.transition(StreamState.TOOL_CALLING);
      hadContent = true;
    }

    if (choice.finish_reason) {
      acc.setFinishReason(choice.finish_reason);
      if (idx === 0) this.accumulator.setFinishReason(choice.finish_reason);
      this.transition(StreamState.FINISHING);
    }

    if (payload.usage) {
      acc.setUsage(payload.usage);
      if (idx === 0) this.accumulator.setUsage(payload.usage);
    }

    if (hadContent) {
      this.emitChunk({
        type:          'content',
        content:       acc.content,
        role:          acc.role,
        model:         acc.model ?? payload.model ?? null,
        tool_calls:    acc._getToolCallsArray(),
        refusal:       acc.refusal,
        finish_reason: choice.finish_reason ?? null,
        choiceIndex:   idx,
        cumulative:    true,
        isDelta:       true,
      });
    }
  }

  handleComplete() {
    const finalContent = this.accumulator.content;

    this.emitChunk({
      type:          'complete',
      content:       finalContent,
      role:          this.accumulator.role,
      model:         this.accumulator.model,
      tool_calls:    this.accumulator._getToolCallsArray(),
      finish_reason: this.accumulator.finishReason,
      usage:         this.accumulator.usage,
      cumulative:    true,
      isFinal:       true,
    });

    super.handleComplete();
  }

  _choiceAccumulator(idx) {
    if (!this._choices.has(idx)) {
      this._choices.set(idx, new StreamAccumulator());
    }
    return this._choices.get(idx);
  }
}

export default OpenAIChatCompletionsParser;