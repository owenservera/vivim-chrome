/**
 * StreamAccumulator - Accumulates incremental streaming state into a final message
 *
 * Fixes vs original:
 *  - Proper methods: setContent(), appendContent(), setRole(), setModel(), setFinishReason(), setUsage()
 *  - Tool call management: applyToolCallDelta(), setToolCalls(), _getToolCallsArray()
 *  - Refusal handling: appendRefusal()
 *  - reset() method for reuse
 *  - Complete toMessage() returning structured object
 */

export class StreamAccumulator {
  constructor() {
    this.role         = 'assistant';
    this.content      = '';
    this.refusal      = null;
    this.model        = null;
    this.finishReason = null;
    this.usage        = null;

    this._toolCalls = new Map();
  }

  setContent(text) {
    this.content = typeof text === 'string' ? text : String(text ?? '');
  }

  appendContent(delta) {
    this.content += typeof delta === 'string' ? delta : String(delta ?? '');
  }

  setRole(role) {
    if (role) this.role = role;
  }

  setModel(model) {
    if (model) this.model = model;
  }

  setFinishReason(reason) {
    if (reason) this.finishReason = reason;
  }

  setUsage(usage) {
    if (usage && typeof usage === 'object') {
      this.usage = { ...usage };
    }
  }

  applyToolCallDelta(delta) {
    const idx = delta.index ?? 0;

    if (!this._toolCalls.has(idx)) {
      this._toolCalls.set(idx, {
        id:       delta.id   ?? null,
        type:     delta.type ?? 'function',
        function: { name: '', arguments: '' },
      });
    }

    const entry = this._toolCalls.get(idx);

    if (delta.id)   entry.id   = delta.id;
    if (delta.type) entry.type = delta.type;

    if (delta.function) {
      if (delta.function.name      != null) entry.function.name      += delta.function.name;
      if (delta.function.arguments != null) entry.function.arguments += delta.function.arguments;
    }
  }

  setToolCalls(toolCalls) {
    this._toolCalls.clear();
    if (Array.isArray(toolCalls)) {
      for (let i = 0; i < toolCalls.length; i++) {
        this._toolCalls.set(i, toolCalls[i]);
      }
    }
  }

  appendRefusal(delta) {
    this.refusal = (this.refusal ?? '') + (delta ?? '');
  }

  toMessage() {
    const msg = {
      role:    this.role,
      content: this.content || null,
    };

    if (this.refusal != null)      msg.refusal      = this.refusal;
    if (this._toolCalls.size > 0)  msg.tool_calls   = this._getToolCallsArray();
    if (this.model)                msg.model        = this.model;
    if (this.finishReason)         msg.finish_reason = this.finishReason;
    if (this.usage)                msg.usage        = this.usage;

    return msg;
  }

  _getToolCallsArray() {
    return [...this._toolCalls.entries()]
      .sort(([a], [b]) => a - b)
      .map(([, entry]) => entry);
  }

  reset() {
    this.role         = 'assistant';
    this.content      = '';
    this.refusal      = null;
    this.model        = null;
    this.finishReason = null;
    this.usage        = null;
    this._toolCalls.clear();
  }
}

export default StreamAccumulator;