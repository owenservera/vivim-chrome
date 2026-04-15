/**
 * Unified Message Bus for extension-wide communication
 * Handles routing, validation, and middleware processing
 */
export class MessageBus {
  constructor() {
    this.handlers = new Map();
    this.middlewares = [];
    this.logger = console; // Can be injected
  }

  /**
   * Register a message handler for a specific type
   * @param {string} type - Message type
   * @param {Function} handler - Handler function
   */
  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type).add(handler);
  }

  /**
   * Unregister a message handler
   * @param {string} type - Message type
   * @param {Function} handler - Handler function
   */
  off(type, handler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Add middleware to process messages
   * @param {Function} middleware - Middleware function
   */
  use(middleware) {
    this.middlewares.push(middleware);
  }

  /**
   * Emit a message to all registered handlers
   * @param {Object} message - Message object
   * @returns {Promise} Promise that resolves when all handlers complete
   */
  async emit(message) {
    try {
      const processedMessage = await this.processMessage(message);
      return processedMessage;
    } catch (error) {
      this.logger.error('[MessageBus] Error processing message:', error);
      throw error;
    }
  }

  /**
   * Process message through middlewares and route to handlers
   * @private
   * @param {Object} message - Message object
   */
  async processMessage(message) {
    let processedMessage = message;

    // Apply middlewares
    for (const middleware of this.middlewares) {
      processedMessage = await middleware(processedMessage);
    }

    // Route to handlers
    const handlers = this.handlers.get(processedMessage.type);
    if (handlers && handlers.size > 0) {
      const promises = Array.from(handlers).map(handler =>
        Promise.resolve(handler(processedMessage))
      );
      await Promise.all(promises);
    }

    return processedMessage;
  }

  /**
   * Get registered handler types (for debugging)
   * @returns {Array<string>} Array of registered message types
   */
  getRegisteredTypes() {
    return Array.from(this.handlers.keys());
  }

  /**
   * Clear all handlers (for cleanup)
   */
  clear() {
    this.handlers.clear();
    this.middlewares.length = 0;
  }
}