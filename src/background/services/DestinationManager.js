import { MessageTypes } from '../../core/messaging/MessageTypes.js';

/**
 * Destination Manager - Handles message broadcasting to multiple targets
 */
export class DestinationManager {
  constructor(messageBus) {
    this.messageBus = messageBus;
    this.destinations = new Map();
    this.logger = console;

    this.bindEvents();
  }

  bindEvents() {
    this.messageBus.on(MessageTypes.REGISTER_DESTINATION, this.handleRegisterDestination.bind(this));
    this.messageBus.on(MessageTypes.UNREGISTER_DESTINATION, this.handleUnregisterDestination.bind(this));
    this.messageBus.on(MessageTypes.LIST_DESTINATIONS, this.handleListDestinations.bind(this));
  }

  /**
   * Register a destination
   */
  handleRegisterDestination(message, sender, sendResponse) {
    const { id, config } = message;
    this.registerDestination(id, config);
    sendResponse({ ok: true });
  }

  /**
   * Unregister a destination
   */
  handleUnregisterDestination(message, sender, sendResponse) {
    const { id } = message;
    this.unregisterDestination(id);
    sendResponse({ ok: true });
  }

  /**
   * List all destinations
   */
  handleListDestinations(message, sender, sendResponse) {
    sendResponse({ destinations: Array.from(this.destinations.keys()) });
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

    this.logger.log(`[DestinationManager] Registered destination: ${id}`, capabilities);
  }

  /**
   * Unregister a destination
   * @param {string} id - Destination ID
   */
  unregisterDestination(id) {
    const removed = this.destinations.delete(id);
    if (removed) {
      this.logger.log(`[DestinationManager] Unregistered destination: ${id}`);
    }
  }

  /**
   * Broadcast message to all matching destinations
   * @param {string} type - Message type ('chunk', 'complete', 'message')
   * @param {Object} payload - Message payload
   */
  broadcastToAllDestinations(type, payload) {
    const timestamp = Date.now();
    this.logger.log(`[DestinationManager] Broadcasting ${type} to ${this.destinations.size} destinations`, { timestamp });

    for (const [id, dest] of this.destinations) {
      this.broadcastToDestination(id, type, payload);
    }

    this.logger.log(`[DestinationManager] Broadcast complete`, {
      type,
      destinations: Array.from(this.destinations.keys()),
      timestamp
    });
  }

  /**
   * Broadcast message to specific destination
   * @param {string} id - Destination ID
   * @param {string} type - Message type
   * @param {Object} payload - Message payload
   */
  broadcastToDestination(id, type, payload) {
    const dest = this.destinations.get(id);
    if (!dest || !dest.connected) return;

    try {
      if (type === 'chunk' && dest.capabilities.receivesStreaming) {
        chrome.runtime.sendMessage({ ...payload, _destination: id }).catch((err) =>
          this.logger.warn(`[DestinationManager] Failed to send chunk to ${id}:`, err)
        );
      } else if (type === 'complete' && dest.capabilities.receivesComplete) {
        chrome.runtime.sendMessage({ ...payload, _destination: id }).catch((err) =>
          this.logger.warn(`[DestinationManager] Failed to send complete to ${id}:`, err)
        );
      } else if (type === 'message') {
        chrome.runtime.sendMessage({ ...payload, _destination: id }).catch((err) =>
          this.logger.warn(`[DestinationManager] Failed to send message to ${id}:`, err)
        );
      }
    } catch (error) {
      this.logger.error(`[DestinationManager] Error broadcasting to ${id}:`, error);
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
    // Register side panel as default destination
    this.registerDestination('sidepanel');
  }
}