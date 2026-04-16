/**
 * Message validation utilities with structured error handling
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
    'TAB_DETECTED',
    'PING',
    'PONG',
    'ERROR',
    'GET_CONVERSATION',
    'LOAD_CONVERSATION',
    'BRIDGE_MESSAGE'
  ];

  static VALID_ROLES = ['user', 'assistant', 'system', 'tool'];

  // Schema definitions for validation
  static SCHEMAS = {
    USER_PROMPT: {
      required: ['content'],
      types: { content: 'string', conversationId: 'string', timestamp: 'number' }
    },
    STREAM_CHUNK: {
      required: ['role', 'content'],
      types: { role: 'string', content: 'string', model: 'string', seq: 'number', streamId: 'string' },
      enum: { role: ['user', 'assistant', 'system', 'tool'] }
    },
    STREAM_COMPLETE: {
      required: ['streamId'],
      types: { streamId: 'string', finalContent: 'string', model: 'string' }
    },
    CONVERSATION: {
      required: [],
      types: { id: 'string', title: 'string', messages: 'array', createdAt: 'number', updatedAt: 'number' }
    },
    PING: {
      required: [],
      types: { timestamp: 'number' }
    },
    ERROR: {
      required: ['message'],
      types: { message: 'string', code: 'string', details: 'object' }
    }
  };

  /**
   * Validate message structure with structured results
   * @param {Object} message - Message to validate
   * @returns {Object} Validation result { valid: boolean, errors: string[], warnings: string[] }
   */
  static validateMessage(message) {
    const result = { valid: true, errors: [], warnings: [], action: message?.action };

    // Basic structure check
    if (!message || typeof message !== 'object') {
      result.valid = false;
      result.errors.push('Invalid message: not an object');
      return result;
    }

    if (!message.type || typeof message.type !== 'string') {
      result.valid = false;
      result.errors.push('Invalid message: missing or invalid type');
      return result;
    }

    if (!this.REQUIRED_MESSAGE_TYPES.includes(message.type) && !message.action) {
      result.warnings.push(`Unknown message type: ${message.type}`);
    }

    return result;
  }

  /**
   * Full schema validation for action-specific messages
   * @param {Object} message - Message to validate
   * @param {string} action - Specific action type
   * @returns {Object} Validation result
   */
  static validateAction(message, action) {
    const result = { valid: true, errors: [], warnings: [], action };

    if (!message) {
      result.valid = false;
      result.errors.push('Message is null or undefined');
      return result;
    }

    const schema = this.SCHEMAS[action];
    if (!schema) {
      result.warnings.push(`No schema defined for action: ${action}`);
      return result;
    }

    // Check required fields
    for (const field of schema.required || []) {
      if (message[field] === undefined || message[field] === null) {
        result.valid = false;
        result.errors.push(`Missing required field: ${field}`);
      }
    }

    // Check field types
    for (const [field, expectedType] of Object.entries(schema.types || {})) {
      if (message[field] !== undefined && message[field] !== null) {
        const actualType = Array.isArray(message[field]) ? 'array' : typeof message[field];
        if (actualType !== expectedType) {
          result.valid = false;
          result.errors.push(`Field "${field}" expected ${expectedType}, got ${actualType}`);
        }
      }
    }

    // Check enum constraints
    for (const [field, allowedValues] of Object.entries(schema.enum || {})) {
      if (message[field] !== undefined && !allowedValues.includes(message[field])) {
        result.valid = false;
        result.errors.push(`Field "${field}" must be one of: ${allowedValues.join(', ')}`);
      }
    }

    return result;
  }

  /**
   * Validate user prompt message
   * @param {Object} message - Message to validate
   * @returns {Object} Validation result
   */
  static validateUserPrompt(message) {
    return this.validateAction(message, 'USER_PROMPT');
  }

  /**
   * Validate stream chunk message
   * @param {Object} message - Message to validate
   * @returns {Object} Validation result
   */
  static validateStreamChunk(message) {
    return this.validateAction(message, 'STREAM_CHUNK');
  }

  /**
   * Validate stream complete message
   * @param {Object} message - Message to validate
   * @returns {Object} Validation result
   */
  static validateStreamComplete(message) {
    return this.validateAction(message, 'STREAM_COMPLETE');
  }

  /**
   * Validate conversation message
   * @param {Object} message - Message to validate
   * @returns {Object} Validation result
   */
  static validateConversation(message) {
    return this.validateAction(message, 'CONVERSATION');
  }

  /**
   * Validate error message
   * @param {Object} message - Message to validate
   * @returns {Object} Validation result
   */
  static validateError(message) {
    return this.validateAction(message, 'ERROR');
  }

  /**
   * Unified entry point - validates any message by action
   * @param {Object} message - Message to validate
   * @returns {Object} Validation result with action detection
   */
  static validate(message) {
    const baseResult = this.validateMessage(message);
    if (!baseResult.valid) {
      return baseResult;
    }

    const action = message?.action || message?.type;
    if (!action) {
      baseResult.warnings.push('No action or type specified');
      return baseResult;
    }

    return this.validateAction(message, action);
  }

  /**
   * Assert validation - throws if invalid (for use with try-catch)
   * @param {Object} message - Message to validate
   * @throws {Error} If message is invalid
   */
  static assert(message) {
    const result = this.validate(message);
    if (!result.valid) {
      throw new Error(`Validation failed: ${result.errors.join('; ')}`);
    }
  }
}

/**
 * Validation middleware for message bus integration
 * Wraps a message handler with automatic validation
 */
export class ValidatedMessageHandler {
  constructor(handler, options = {}) {
    this.handler = handler;
    this.action = options.action || handler.name?.replace('validate', '') || null;
    this.strict = options.strict !== false;
  }

  async handle(message) {
    const result = MessageValidator.validateAction(message, this.action);

    if (!result.valid) {
      if (this.strict) {
        throw new Error(`Validation failed for ${this.action}: ${result.errors.join('; ')}`);
      }
      console.warn(`[ValidatedHandler] Invalid message:`, result.errors);
      return null;
    }

    if (result.warnings.length > 0) {
      console.warn(`[ValidatedHandler] Warnings:`, result.warnings);
    }

    return this.handler(message);
  }
}