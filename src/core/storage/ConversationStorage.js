import { StorageManager } from './StorageManager.js';

/**
 * Conversation-specific storage operations
 */
export class ConversationStorage {
  constructor(storageManager) {
    this.storage = storageManager;
    this.CONVERSATION_PREFIX = 'conv_';
    this.TEMP_CONVERSATION_PREFIX = 'conv_temp_';
  }

  /**
   * Generate conversation key
   * @param {string} conversationId - Conversation ID
   * @param {boolean} isTemp - Whether it's a temporary conversation
   * @returns {string} Storage key
   */
  getConversationKey(conversationId, isTemp = false) {
    if (isTemp) {
      return `${this.TEMP_CONVERSATION_PREFIX}${conversationId}`;
    }
    return conversationId ? `${this.CONVERSATION_PREFIX}${conversationId}` : null;
  }

  /**
   * Store messages for a conversation
   * @param {string} conversationId - Conversation ID
   * @param {Array} messages - Message array
   * @param {boolean} isTemp - Whether it's a temporary conversation
   */
  async storeConversation(conversationId, messages, isTemp = false) {
    const key = this.getConversationKey(conversationId, isTemp);
    if (!key) return;

    // Ensure messages have required fields
    const validatedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp || Date.now(),
      model: msg.model,
      streamed: msg.streamed || false,
      conversationId: msg.conversationId
    }));

    // Keep only last 100 messages to prevent unbounded growth
    const trimmedMessages = validatedMessages.slice(-100);

    await this.storage.set(key, trimmedMessages);
  }

  /**
   * Get messages for a conversation
   * @param {string} conversationId - Conversation ID
   * @param {boolean} isTemp - Whether it's a temporary conversation
   * @returns {Promise<Array>} Message array
   */
  async getConversation(conversationId, isTemp = false) {
    const key = this.getConversationKey(conversationId, isTemp);
    if (!key) return [];

    const messages = await this.storage.get(key);
    return messages || [];
  }

  /**
   * Add a message to a conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} message - Message object
   * @param {boolean} isTemp - Whether it's a temporary conversation
   */
  async addMessage(conversationId, message, isTemp = false) {
    const existingMessages = await this.getConversation(conversationId, isTemp);

    // Avoid duplicates (simple check)
    const isDuplicate = existingMessages.some(msg =>
      msg.content === message.content &&
      msg.role === message.role &&
      Math.abs((msg.timestamp || 0) - (message.timestamp || 0)) < 1000
    );

    if (!isDuplicate) {
      existingMessages.push({
        ...message,
        timestamp: message.timestamp || Date.now()
      });

      await this.storeConversation(conversationId, existingMessages, isTemp);
    }
  }

  /**
   * Clear a conversation
   * @param {string} conversationId - Conversation ID
   * @param {boolean} isTemp - Whether it's a temporary conversation
   */
  async clearConversation(conversationId, isTemp = false) {
    const key = this.getConversationKey(conversationId, isTemp);
    if (key) {
      await this.storage.remove(key);
    }
  }

  /**
   * Get all conversation keys
   * @returns {Promise<Array<string>>} Array of conversation IDs
   */
  async getAllConversationIds() {
    const allKeys = await this.storage.getKeys(`${this.CONVERSATION_PREFIX}*`);
    return allKeys.map(key => key.replace(this.CONVERSATION_PREFIX, ''));
  }

  /**
   * Migrate temporary conversations to permanent ones
   * @param {string} tempId - Temporary conversation ID (usually tabId)
   * @param {string} permanentId - Permanent conversation ID
   */
  async migrateConversation(tempId, permanentId) {
    const tempMessages = await this.getConversation(tempId, true);
    if (tempMessages.length > 0) {
      await this.storeConversation(permanentId, tempMessages, false);
      await this.clearConversation(tempId, true);
    }
  }

  /**
   * Get conversation statistics
   * @returns {Promise<Object>} Stats object
   */
  async getStats() {
    const conversationIds = await this.getAllConversationIds();
    let totalMessages = 0;
    let totalConversations = conversationIds.length;

    for (const id of conversationIds) {
      const messages = await this.getConversation(id);
      totalMessages += messages.length;
    }

    return {
      totalConversations,
      totalMessages,
      averageMessagesPerConversation: totalConversations > 0 ?
        Math.round(totalMessages / totalConversations) : 0
    };
  }
}