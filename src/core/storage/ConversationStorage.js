import { StorageManager } from './StorageManager.js';

export class ConversationStorage {
  constructor(storageManager) {
    this.storage = storageManager;
    this.CONVERSATION_PREFIX = 'conv_';
    this.TEMP_CONVERSATION_PREFIX = 'conv_temp_';
    this.contentIndex = new Map();
  }

  hashContent(content) {
    if (!content) return null;
    let hash = 0;
    const normalized = content.toLowerCase().trim().substring(0, 100);
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  findDuplicateConversation(searchContent) {
    const contentHash = this.hashContent(searchContent);
    if (!contentHash) return null;

    for (const [hash, conversationIds] of this.contentIndex) {
      if (hash === contentHash) {
        return conversationIds[0];
      }
    }
    return null;
  }

  indexConversation(conversationId, messages) {
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length === 0) return;

    const firstContent = userMessages[0].content;
    const contentHash = this.hashContent(firstContent);

    if (!this.contentIndex.has(contentHash)) {
      this.contentIndex.set(contentHash, []);
    }
    this.contentIndex.get(contentHash).push(conversationId);
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
    try {
      const key = this.getConversationKey(conversationId, isTemp);
      if (!key) return;

      const validatedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
        model: msg.model,
        streamed: msg.streamed || false,
        conversationId: msg.conversationId
      }));

      const trimmedMessages = validatedMessages.slice(-100);

      await this.storage.set(key, trimmedMessages);
    } catch (error) {
      console.error('[ConversationStorage] storeConversation failed:', error);
    }
  }

  /**
   * Get messages for a conversation
   * @param {string} conversationId - Conversation ID
   * @param {boolean} isTemp - Whether it's a temporary conversation
   * @returns {Promise<Array>} Message array
   */
  async getConversation(conversationId, isTemp = false) {
    try {
      const key = this.getConversationKey(conversationId, isTemp);
      if (!key) return [];

      const messages = await this.storage.get(key);
      return messages || [];
    } catch (error) {
      console.error('[ConversationStorage] getConversation failed:', error);
      return [];
    }
  }

  /**
   * Add a message to a conversation
   * @param {string} conversationId - Conversation ID
   * @param {Object} message - Message object
   * @param {boolean} isTemp - Whether it's a temporary conversation
   */
  async addMessage(conversationId, message, isTemp = false) {
    try {
      const existingMessages = await this.getConversation(conversationId, isTemp);

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
        this.indexConversation(conversationId, existingMessages);
      }
    } catch (error) {
      console.error('[ConversationStorage] addMessage failed:', error);
    }
  }

  async findSimilarConversations(content, threshold = 0.8) {
    const contentHash = this.hashContent(content);
    if (!contentHash) return [];

    const similar = [];
    const searchNormalized = content.toLowerCase().trim().substring(0, 100);

    for (const [hash, conversationIds] of this.contentIndex) {
      const similarity = this.calculateSimilarity(searchNormalized, hash);
      if (similarity >= threshold) {
        similar.push(...conversationIds.map(id => ({ id, similarity })));
      }
    }

    return similar;
  }

  calculateSimilarity(a, b) {
    if (a === b) return 1;
    if (!a || !b) return 0;

    const aSet = new Set(a.split(''));
    const bSet = new Set(b.split(''));
    const intersection = new Set([...aSet].filter(x => bSet.has(x)));
    const union = new Set([...aSet, ...bSet]);

    return intersection.size / union.size;
  }

  async removeDuplicateConversations() {
    const conversationIds = await this.getAllConversationIds();
    const toRemove = [];

    for (const id of conversationIds) {
      const messages = await this.getConversation(id);
      if (messages.length <= 1) {
        const userMsg = messages.find(m => m.role === 'user');
        if (userMsg) {
          const similar = await this.findSimilarConversations(userMsg.content, 0.9);
          if (similar.length > 1) {
            toRemove.push(id);
          }
        }
      }
    }

    for (const id of toRemove) {
      await this.clearConversation(id);
    }

    return toRemove.length;
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