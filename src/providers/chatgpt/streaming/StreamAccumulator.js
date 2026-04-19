/**
 * StreamAccumulator - Accumulates streaming state
 */

export class StreamAccumulator {
  constructor() {
    this.id = null;
    this.model = null;
    this.created = null;
    this.system_fingerprint = null;
    
    this.role = 'assistant';
    this.content = '';
    this.refusal = null;
    
    this.tool_calls = [];
    
    this.finish_reason = null;
    this.usage = null;
  }
  
  applyChunk(chunk) {
    if (!chunk || !chunk.choices) return;
    
    for (const choice of chunk.choices) {
      this.applyChoice(choice);
    }
    
    if (chunk.choices.length === 0 && chunk.usage) {
      this.usage = chunk.usage;
    }
    
    if (chunk.id && !this.id) this.id = chunk.id;
    if (chunk.model && !this.model) this.model = chunk.model;
    if (chunk.created && !this.created) this.created = chunk.created;
    if (chunk.system_fingerprint) this.system_fingerprint = chunk.system_fingerprint;
  }
  
  applyChoice(choice) {
    const delta = choice.delta || {};
    const finish_reason = choice.finish_reason;
    
    if (delta.role) {
      this.role = delta.role;
    }
    
    if (delta.content != null) {
      this.content += delta.content;
    }
    
    if (delta.refusal != null) {
      this.refusal = (this.refusal || '') + delta.refusal;
    }
    
    if (delta.tool_calls) {
      this.applyToolCalls(delta.tool_calls);
    }
    
    if (finish_reason) {
      this.finish_reason = finish_reason;
    }
  }
  
  applyToolCalls(deltas) {
    for (const tc of deltas) {
      const idx = tc.index;
      
      if (!this.tool_calls[idx]) {
        this.tool_calls[idx] = {
          id: tc.id || '',
          type: tc.type || 'function',
          function: {
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || ''
          }
        };
      }
      
      const slot = this.tool_calls[idx];
      
      if (tc.id) slot.id = tc.id;
      if (tc.type) slot.type = tc.type;
      if (tc.function?.name) slot.function.name += tc.function.name;
      if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
    }
  }
  
  toMessage() {
    return {
      id: this.id,
      model: this.model,
      role: this.role,
      content: this.content,
      refusal: this.refusal,
      tool_calls: this.tool_calls.filter(Boolean),
      finish_reason: this.finish_reason,
      usage: this.usage
    };
  }
  
  reset() {
    this.content = '';
    this.refusal = null;
    this.tool_calls = [];
    this.finish_reason = null;
    this.usage = null;
  }
}

export default StreamAccumulator;