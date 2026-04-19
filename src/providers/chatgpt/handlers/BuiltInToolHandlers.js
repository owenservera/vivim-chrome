/**
 * BuiltInToolHandlers - Web Search, File Search, Code Interpreter
 */

export class FileSearchHandler {
  constructor() {
    this.state = 'idle';
    this.results = [];
    this.query = '';
  }
  
  handleInProgress(event) {
    this.state = 'searching';
    this.query = event.query || '';
    return { status: 'in_progress', query: this.query };
  }
  
  handleSearching(event) {
    this.state = 'searching';
    return { status: 'searching', progress: event.progress };
  }
  
  handleCompleted(event) {
    this.state = 'completed';
    this.results = event.results || [];
    return { status: 'completed', results: this.results, cited_files: event.cited_files };
  }
  
  reset() {
    this.state = 'idle';
    this.results = [];
    this.query = '';
  }
}

export class WebSearchHandler {
  constructor() {
    this.state = 'idle';
    this.results = [];
  }
  
  handleInProgress(event) {
    this.state = 'searching';
    return { status: 'in_progress', query: event.query };
  }
  
  handleSearching(event) {
    return { status: 'searching', progress: event.progress };
  }
  
  handleCompleted(event) {
    this.state = 'completed';
    this.results = event.results || [];
    return { status: 'completed', results: this.results };
  }
  
  reset() {
    this.state = 'idle';
    this.results = [];
  }
}

export class CodeInterpreterHandler {
  constructor() {
    this.state = 'idle';
    this.code = '';
    this.output = '';
    this.logs = [];
  }
  
  handleInProgress(event) {
    this.state = 'running';
    return { status: 'in_progress' };
  }
  
  handleInterpreting(event) {
    this.code += event.code || '';
    return { status: 'interpreting', code: this.code };
  }
  
  handleCompleted(event) {
    this.state = 'completed';
    this.output = event.output || '';
    this.logs = event.logs || [];
    return { status: 'completed', output: this.output, logs: this.logs };
  }
  
  reset() {
    this.state = 'idle';
    this.code = '';
    this.output = '';
    this.logs = [];
  }
}

export class MCPToolHandler {
  constructor() {
    this.state = 'idle';
    this.tools = [];
    this.callResults = {};
  }
  
  async listTools(serverUrl, headers) {
    const response = await fetch(serverUrl, { headers });
    this.tools = await response.json();
    return this.tools;
  }
  
  async callTool(serverUrl, toolName, args, headers) {
    const response = await fetch(serverUrl, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: toolName, arguments: args })
    });
    this.callResults[toolName] = await response.json();
    return this.callResults[toolName];
  }
  
  reset() {
    this.state = 'idle';
    this.tools = [];
    this.callResults = {};
  }
}

export default {
  FileSearchHandler,
  WebSearchHandler,
  CodeInterpreterHandler,
  MCPToolHandler
};