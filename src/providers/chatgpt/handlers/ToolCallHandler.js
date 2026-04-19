/**
 * ToolCallHandler - Handles streaming tool calls
 */

export class ToolCallHandler {
  constructor() {
    this.toolCalls = [];
  }
  
  processToolCalls(deltas) {
    const completed = [];
    
    for (const tc of deltas) {
      const idx = tc.index;
      
      if (!this.toolCalls[idx]) {
        this.toolCalls[idx] = {
          id: tc.id || '',
          type: tc.type || 'function',
          function: {
            name: tc.function?.name || '',
            arguments: tc.function?.arguments || ''
          }
        };
      }
      
      const slot = this.toolCalls[idx];
      
      if (tc.id) slot.id = tc.id;
      if (tc.type) slot.type = tc.type;
      if (tc.function?.name) slot.function.name += tc.function.name;
      if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
    }
    
    return completed;
  }
  
  isArgumentsComplete(index) {
    const tc = this.toolCalls[index];
    if (!tc) return false;
    
    try {
      JSON.parse(tc.function.arguments);
      return true;
    } catch {
      return false;
    }
  }
  
  getToolCalls() {
    return this.toolCalls.filter(Boolean);
  }
  
  flush() {
    const result = [...this.toolCalls];
    this.toolCalls = [];
    return result;
  }
  
  reset() {
    this.toolCalls = [];
  }
}

export default ToolCallHandler;