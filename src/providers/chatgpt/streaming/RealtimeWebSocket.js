/**
 * RealtimeWebSocket - WebSocket client for Realtime API
 */

export class RealtimeWebSocket {
  constructor(options = {}) {
    this.model = options.model || 'gpt-4o-realtime-preview';
    this.url = `wss://api.openai.com/v1/realtime?model=${this.model}`;
    this.ws = null;
    this.apiKey = options.apiKey;
    this.sessionId = null;
    this.eventHandlers = new Map();
    this.isConnected = false;
    this.pendingResponses = [];
  }
  
  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url, [
        `Authorization: Bearer ${this.apiKey}`,
        'OpenAI-Beta: realtime=v1'
      ]);
      
      this.ws.onopen = () => {
        this.isConnected = true;
        resolve();
      };
      
      this.ws.onclose = () => {
        this.isConnected = false;
      };
      
      this.ws.onerror = (error) => {
        reject(error);
      };
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.handleServerEvent(data);
      };
    });
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
  
  on(eventType, handler) {
    this.eventHandlers.set(eventType, handler);
  }
  
  emit(eventType, data) {
    const handler = this.eventHandlers.get(eventType);
    if (handler) handler(data);
  }
  
  handleServerEvent(event) {
    switch (event.type) {
      case 'session.created':
        this.sessionId = event.session.id;
        this.emit('session.created', event);
        break;
        
      case 'session.updated':
        this.emit('session.updated', event);
        break;
        
      case 'conversation.created':
        this.emit('conversation.created', event);
        break;
        
      case 'conversation.item.created':
        this.emit('item.created', event);
        break;
        
      case 'response.created':
        this.emit('response.created', event);
        break;
        
      case 'response.done':
        this.emit('response.done', event);
        break;
        
      case 'response.output_item.added':
        this.emit('item.added', event);
        break;
        
      case 'response.output_item.done':
        this.emit('item.done', event);
        break;
        
      case 'response.text.delta':
        this.emit('text.delta', event);
        break;
        
      case 'response.text.done':
        this.emit('text.done', event);
        break;
        
      case 'response.audio.delta':
        this.emit('audio.delta', event);
        break;
        
      case 'response.audio.done':
        this.emit('audio.done', event);
        break;
        
      case 'response.function_call_arguments.delta':
        this.emit('tool_call_delta', event);
        break;
        
      case 'response.function_call_arguments.done':
        this.emit('tool_call_done', event);
        break;
        
      case 'input_audio_buffer.speech_started':
        this.emit('speech.started', event);
        break;
        
      case 'input_audio_buffer.speech_stopped':
        this.emit('speech.stopped', event);
        break;
        
      case 'error':
        this.emit('error', event);
        break;
    }
  }
  
  send(event) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }
  
  updateSession(config) {
    this.send({
      type: 'session.update',
      session: config
    });
  }
  
  appendAudio(audioBase64) {
    this.send({
      type: 'input_audio_buffer.append',
      audio: audioBase64
    });
  }
  
  commitAudio() {
    this.send({
      type: 'input_audio_buffer.commit'
    });
  }
  
  clearAudio() {
    this.send({
      type: 'input_audio_buffer.clear'
    });
  }
  
  createItem(type, content) {
    this.send({
      type: 'conversation.item.create',
      item: { type, content }
    });
  }
  
  truncateItem(itemId, audioEndMs) {
    this.send({
      type: 'conversation.item.truncate',
      item_id: itemId,
      audio_end_ms: audioEndMs
    });
  }
  
  deleteItem(itemId) {
    this.send({
      type: 'conversation.item.delete',
      item_id: itemId
    });
  }
  
  createResponse() {
    this.send({
      type: 'response.create'
    });
  }
  
  cancelResponse() {
    this.send({
      type: 'response.cancel'
    });
  }
  
  clearOutputAudio() {
    this.send({
      type: 'output_audio_buffer.clear'
    });
  }
}

export default RealtimeWebSocket;