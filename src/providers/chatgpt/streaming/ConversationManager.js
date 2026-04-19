/**
 * ConversationManager - Server-managed conversation state
 */

export class ConversationManager {
  constructor(baseUrl = 'https://api.openai.com/v1') {
    this.baseUrl = baseUrl;
    this.conversations = new Map();
    this.currentConversationId = null;
  }
  
  async createConversation(apiKey, initialItems = [], metadata = {}) {
    const response = await fetch(`${this.baseUrl}/conversations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ initial_items: initialItems, metadata })
    });
    
    const conversation = await response.json();
    this.conversations.set(conversation.id, conversation);
    this.currentConversationId = conversation.id;
    return conversation;
  }
  
  async getConversation(apiKey, conversationId) {
    const cached = this.conversations.get(conversationId);
    if (cached) return cached;
    
    const response = await fetch(`${this.baseUrl}/conversations/${conversationId}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    const conversation = await response.json();
    this.conversations.set(conversationId, conversation);
    return conversation;
  }
  
  async listConversations(apiKey, options = {}) {
    const params = new URLSearchParams();
    if (options.after) params.set('after', options.after);
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.order) params.set('order', options.order);
    
    const response = await fetch(`${this.baseUrl}/conversations?${params}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    return response.json();
  }
  
  async deleteConversation(apiKey, conversationId) {
    await fetch(`${this.baseUrl}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    this.conversations.delete(conversationId);
    if (this.currentConversationId === conversationId) {
      this.currentConversationId = null;
    }
  }
  
  async getConversationItems(apiKey, conversationId, options = {}) {
    const params = new URLSearchParams();
    if (options.after) params.set('after', options.after);
    if (options.limit) params.set('limit', options.limit.toString());
    
    const response = await fetch(`${this.baseUrl}/conversations/${conversationId}/items?${params}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    
    return response.json();
  }
  
  buildChainedRequest(conversationId, currentInput) {
    return {
      conversation_id: conversationId,
      input: currentInput
    };
  }
}

export default ConversationManager;