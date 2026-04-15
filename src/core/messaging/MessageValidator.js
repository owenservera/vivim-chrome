/**
 * Message validation utilities
 */
export class MessageValidator {
  static REQUIRED_MESSAGE_TYPES = [
    'USER_PROMPT',
    'STREAM_CHUNK',
    'STREAM_COMPLETE',
    'MESSAGE_ADDED',
    'STREAM_UPDATE',
    'CONVERSATION_CLEARED',
    'CONVERSATION_LOADED',
    'TAB_DETECTED'
  ];

  /**
   * Validate message structure
   * @param {Object} message - Message to validate
   * @throws {Error} If message is invalid
   */
  static validateMessage(message) {
    if (!message || typeof message !== 'object') {
      throw new Error('Invalid message: not an object');
    }
    if (!message.type || typeof message.type !== 'string') {
      throw new Error('Invalid message: missing or invalid type');
    }
    if (!this.REQUIRED_MESSAGE_TYPES.includes(message.type)) {
      console.warn(`Unknown message type: ${message.type}`);
    }
  }

  /**
   * Validate user prompt message
   * @param {Object} message - Message to validate
   * @throws {Error} If message is invalid
   */
  static validateUserPrompt(message) {
    if (!message.content || typeof message.content !== 'string') {
      throw new Error('USER_PROMPT: invalid or missing content');
    }
    if (message.conversationId !== null && message.conversationId !== undefined &&
        typeof message.conversationId !== 'string') {
      throw new Error('USER_PROMPT: invalid conversationId type');
    }
    if (message.timestamp && typeof message.timestamp !== 'number') {
      throw new Error('USER_PROMPT: invalid timestamp type');
    }
  }

  /**
   * Validate stream chunk message
   * @param {Object} message - Message to validate
   * @throws {Error} If message is invalid
   */
  static validateStreamChunk(message) {
    if (!message.role || typeof message.role !== 'string') {
      throw new Error('STREAM_CHUNK: invalid or missing role');
    }
    if (!message.content || typeof message.content !== 'string') {
      throw new Error('STREAM_CHUNK: invalid or missing content');
    }
    if (message.model && typeof message.model !== 'string') {
      throw new Error('STREAM_CHUNK: invalid model type');
    }
    if (message.seq !== undefined && typeof message.seq !== 'number') {
      throw new Error('STREAM_CHUNK: invalid seq type');
    }
  }

  /**
   * Validate conversation message
   * @param {Object} message - Message to validate
   * @throws {Error} If message is invalid
   */
  static validateConversation(message) {
    if (!Array.isArray(message.messages)) {
      throw new Error('CONVERSATION: messages must be an array');
    }
    for (const msg of message.messages) {
      if (!msg.role || !msg.content) {
        throw new Error('CONVERSATION: invalid message structure');
      }
    }
  }
}