/**
 * Pure UI Logic - Testable business logic extracted from SidePanelController
 * These functions work without DOM - safe for unit testing
 */

export class UILogic {
  constructor() {
    this.currentProvider = { id: 'chatgpt', name: 'ChatGPT', color: '#10A37F' };
    this.availableProviders = [
      { id: 'chatgpt', name: 'ChatGPT', color: '#10A37F' },
      { id: 'claude', name: 'Claude', color: '#8B5CF6' },
      { id: 'gemini', name: 'Gemini', color: '#F59E0B' }
    ];
    this.messageList = [];
  }

  // ==================== Provider Logic ====================

  switchProvider(provider) {
    const oldProvider = this.currentProvider;
    this.currentProvider = provider;
    return {
      previous: oldProvider,
      current: provider,
      changed: oldProvider.id !== provider.id
    };
  }

  isValidProvider(providerId) {
    return this.availableProviders.some(p => p.id === providerId);
  }

  getProviderById(id) {
    return this.availableProviders.find(p => p.id === id);
  }

  // ==================== Message Logic ====================

  addMessage(role, content, model, timestamp) {
    if (!role || !content) return false;
    const message = { role, content, model, timestamp: timestamp || Date.now() };
    this.messageList.push(message);
    return message;
  }

  clearMessages() {
    const wasEmpty = this.messageList.length === 0;
    this.messageList = [];
    return { cleared: true, count: this.messageList.length, wasEmpty };
  }

  filterMessages(query) {
    if (!query) return [...this.messageList];
    const lowerQuery = query.toLowerCase();
    return this.messageList.filter(m => 
      m.content.toLowerCase().includes(lowerQuery)
    );
  }

  // ==================== Formatting Logic ====================

  sanitizeHtml(text) {
    if (!text) return '';
    // Comprehensive HTML sanitization
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  formatMessage(text) {
    if (!text) return '';
    const sanitized = this.sanitizeHtml(text);
    return sanitized
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  escapeHtml(text) {
    return this.sanitizeHtml(text);
  }

  formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // ==================== Export Logic ====================

  prepareExport(format) {
    const messages = this.messageList;
    let content = '';
    let mimeType = 'text/plain';
    let extension = 'txt';

    switch (format) {
      case 'json':
        content = JSON.stringify(messages, null, 2);
        mimeType = 'application/json';
        extension = 'json';
        break;
      case 'md':
        content = messages.map(m => `## ${m.role === 'user' ? 'User' : 'Assistant'}\n\n${m.content}`).join('\n\n---\n\n');
        mimeType = 'text/markdown';
        extension = 'md';
        break;
      default:
        content = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
    }

    return { content, mimeType, extension };
  }

  // ==================== Validation Logic ====================

  validateMessage(message) {
    if (!message) return { valid: false, error: 'null message' };
    if (!message.role) return { valid: false, error: 'missing role' };
    if (!message.content) return { valid: false, error: 'missing content' };
    if (!['user', 'assistant', 'system'].includes(message.role)) {
      return { valid: false, error: 'invalid role' };
    }
    return { valid: true };
  }

  canSendPrompt(text, tabId) {
    const hasText = text && text.trim().length > 0;
    const hasTab = !!tabId;
    return {
      canSend: hasText && hasTab,
      hasText,
      hasTab,
      reason: !hasText ? 'empty text' : !hasTab ? 'no tab' : 'ready'
    };
  }

  // ==================== Search Logic ====================

  search(query) {
    if (!query || query.trim() === '') {
      return { results: [...this.messageList], query: '', count: this.messageList.length };
    }
    
    const results = this.filterMessages(query);
    return {
      results,
      query,
      count: results.length,
      total: this.messageList.length
    };
  }

  // ==================== Provider Menu Logic ====================

  getProviderMenuItems() {
    return this.availableProviders.map(p => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isSelected: p.id === this.currentProvider.id
    }));
  }

  // ==================== State Serialization ====================

  getState() {
    return {
      currentProvider: this.currentProvider,
      availableProviders: this.availableProviders,
      messageCount: this.messageList.length,
      messages: [...this.messageList]
    };
  }

  loadState(state) {
    if (state.currentProvider) this.currentProvider = state.currentProvider;
    if (state.messageList) this.messageList = [...state.messageList];
    return { loaded: true };
  }
}

// Named export for compatibility
export default UILogic;