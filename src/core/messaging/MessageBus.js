import { Logger } from '../logging/Logger.js';

/**
 * Unified Message Bus for extension-wide communication
 * Handles routing, validation, and middleware processing
 */
export class MessageBus {
  constructor() {
    this.handlers = new Map();
    this.middlewares = [];
    this.logger = new Logger('MessageBus');
  }

  /**
   * Register a message handler for a specific type
   */
  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type).add(handler);
  }

  /**
   * Unregister a message handler
   */
  off(type, handler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Add middleware to process messages
   */
  use(middleware) {
    this.middlewares.push(middleware);
  }

  /**
   * Emit a message to all registered handlers
   */
  async emit(message, sender = null) {
    const startTime = Date.now();
    const summary = {
      type: message.type,
      timestamp: startTime,
      processed: false,
      handlerCount: 0,
      errors: []
    };

    try {
      const processedMessage = await this.processMiddlewares(message);
      summary.processed = true;

      const results = await this.routeToHandlers(processedMessage, sender);
      summary.handlerCount = results.length;
      summary.results = results;

      return {
        success: true,
        message: processedMessage,
        summary,
        duration: Date.now() - startTime
      };
    } catch (error) {
      this.logger.error(`Message emission failed for ${message.type}:`, error);
      summary.errors.push(error.message);
      return {
        success: false,
        error: error.message,
        summary,
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * Process message through middlewares
   * @private
   */
  async processMiddlewares(message) {
    let processedMessage = { ...message };

    for (const middleware of this.middlewares) {
      try {
        const result = await Promise.resolve(middleware(processedMessage));
        if (result === false) {
          this.logger.warn(`Message blocked by middleware: ${message.type}`);
          return null;
        }
        if (result && typeof result === 'object') {
          processedMessage = result;
        }
      } catch (error) {
        this.logger.warn(`Middleware error for ${message.type}:`, error.message);
      }
    }

    return processedMessage;
  }

  /**
   * Route to handlers
   * @private
   */
  async routeToHandlers(message, sender) {
    const handlers = this.handlers.get(message.type);
    if (!handlers || handlers.size === 0) {
      return [];
    }

    const results = await Promise.allSettled(
      Array.from(handlers).map(async (handler) => {
        try {
          return await Promise.resolve(handler(message, sender));
        } catch (error) {
          this.logger.error(`Handler error for ${message.type}:`, error);
          return { error: error.message, handlerFailed: true };
        }
      })
    );

    const errors = results.filter(r => r.status === 'rejected' || r.value?.handlerFailed);
    if (errors.length > 0) {
      this.logger.warn(`MessageBus: ${errors.length} handlers failed for ${message.type}`);
    }
    
    return results.map(r => r.status === 'fulfilled' ? r.value : { error: r.reason?.message });
  }
}