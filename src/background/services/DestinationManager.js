import { Logger } from '../../core/logging/Logger.js';
import { MessageTypes } from '../../core/messaging/MessageTypes.js';

/**
 * Destination Manager - Handles message broadcasting to multiple UI targets (SidePanel, Standalone, etc.)
 */
export class DestinationManager {
  constructor(messageBus) {
    this.messageBus = messageBus;
    this.destinations = new Map();
    this.logger = new Logger('DestinationManager');

    this.bindEvents();
  }

  bindEvents() {
    this.messageBus.on(MessageTypes.REGISTER_DESTINATION, this.handleRegisterDestination.bind(this));
    this.messageBus.on(MessageTypes.UNREGISTER_DESTINATION, this.handleUnregisterDestination.bind(this));
    this.messageBus.on(MessageTypes.LIST_DESTINATIONS, this.handleListDestinations.bind(this));
  }

  /**
   * Register a destination from a message
   */
  handleRegisterDestination(message, sender, sendResponse) {
    const { id, config } = message;
    if (!id) {
      if (sendResponse) sendResponse({ ok: false, error: 'Missing destination ID' });
      return;
    }
    this.registerDestination(id, config);
    if (sendResponse) sendResponse({ ok: true });
  }

  /**
   * Unregister a destination from a message
   */
  handleUnregisterDestination(message, sender, sendResponse) {
    const { id } = message;
    this.unregisterDestination(id);
    if (sendResponse) sendResponse({ ok: true });
  }

  /**
   * List all registered destinations
   */
  handleListDestinations(message, sender, sendResponse) {
    if (sendResponse) {
      sendResponse({ destinations: Array.from(this.destinations.keys()) });
    }
  }

  /**
   * Register a new destination
   * @param {string} id - Destination ID
   * @param {Object} config - Destination configuration
   */
  registerDestination(id, config = {}) {
    const capabilities = {
      receivesStreaming: true,
      receivesComplete: true,
      canSendPrompts: false,
      ...config.capabilities
    };

    this.destinations.set(id, {
      capabilities,
      config,
      connected: true,
      registeredAt: Date.now()
    });

    this.logger.info(`Registered destination: ${id}`, capabilities);
  }

  /**
   * Unregister a destination
   * @param {string} id - Destination ID
   */
  unregisterDestination(id) {
    if (this.destinations.has(id)) {
      this.destinations.delete(id);
      this.logger.info(`Unregistered destination: ${id}`);
    }
  }

  /**
   * Broadcast message to all matching destinations
   * @param {Object} message - Message to broadcast
   */
  broadcast(message) {
    if (this.destinations.size === 0) return;

    this.logger.debug(`Broadcasting ${message.type} to ${this.destinations.size} destinations`);

    for (const [id, dest] of this.destinations) {
      this.sendToDestination(id, dest, message);
    }
  }

  /**
   * Send message to specific destination
   * @private
   */
  sendToDestination(id, dest, message) {
    // Check capabilities for certain message types
    if (message.type === MessageTypes.STREAM_UPDATE && !dest.capabilities.receivesStreaming) return;
    if (message.type === MessageTypes.STREAM_COMPLETE && !dest.capabilities.receivesComplete) return;

    try {
      chrome.runtime.sendMessage({ ...message, _destination: id }).catch((err) => {
        // Only log if it's not a "Could not establish connection" error (UI closed)
        if (!err.message?.includes('Could not establish connection')) {
          this.logger.warn(`Failed to send to ${id}:`, err.message);
        }
      });
    } catch (error) {
      this.logger.error(`Error sending to destination ${id}:`, error);
    }
  }

  /**
   * Get destination information
   * @param {string} id - Destination ID
   * @returns {Object|null} Destination info or null
   */
  getDestination(id) {
    return this.destinations.get(id) || null;
  }

  /**
   * Get all destinations
   * @returns {Map} Map of destinations
   */
  getAllDestinations() {
    return new Map(this.destinations);
  }

  /**
   * Check if destination has capability
   * @param {string} id - Destination ID
   * @param {string} capability - Capability name
   * @returns {boolean} Whether destination has capability
   */
  hasCapability(id, capability) {
    const dest = this.destinations.get(id);
    return dest ? dest.capabilities[capability] : false;
  }

  /**
   * Initialize default destinations
   */
  init() {
    this.logger.info('DestinationManager initialized');
  }
}
