import { Logger } from '../logging/Logger.js';

/**
 * Data Feed Storage Service
 * Automatically captures and stores all data flows regardless of session or provider
 * Users can configure storage location and enable/disable the feed
 */
export class DataFeedStorage {
  constructor(options = {}) {
    this.logger = new Logger('DataFeedStorage');
    this.enabled = false;
    this.storageBackend = null;
    this.dataBuffer = [];
    this.flushInterval = options.flushInterval || 5000; // 5 seconds
    this.maxBufferSize = options.maxBufferSize || 100; // Max items before flush
    this.flushTimer = null;
    this.eventListeners = new Map();

    // Storage backends
    this.backends = {
      fileSystem: new FileSystemStorageBackend(),
      indexedDB: new IndexedDBStorageBackend(),
      chromeStorage: new ChromeStorageBackend()
    };
  }

  /**
   * Initialize the data feed storage
   */
  async initialize() {
    try {
      // Load configuration from settings
      const config = await this.loadConfiguration();
      this.enabled = config.enabled || false;
      this.selectedBackend = config.backend || 'indexedDB';

      if (this.enabled) {
        await this.initializeBackend(this.selectedBackend, config.backendConfig);
        this.startCollection();
        this.logger.info('Data feed storage initialized and enabled');
      } else {
        this.logger.info('Data feed storage initialized but disabled');
      }
    } catch (error) {
      this.logger.error('Failed to initialize data feed storage:', error);
      throw error;
    }
  }

  /**
   * Load configuration from extension settings
   */
  async loadConfiguration() {
    // This would load from chrome.storage.sync or similar
    const config = await chrome.storage.sync.get({
      dataFeedEnabled: false,
      dataFeedBackend: 'indexedDB',
      dataFeedBackendConfig: {}
    });

    return {
      enabled: config.dataFeedEnabled,
      backend: config.dataFeedBackend,
      backendConfig: config.dataFeedBackendConfig
    };
  }

  /**
   * Initialize the selected storage backend
   */
  async initializeBackend(backendName, config) {
    const backend = this.backends[backendName];
    if (!backend) {
      throw new Error(`Unknown storage backend: ${backendName}`);
    }

    await backend.initialize(config);
    this.storageBackend = backend;
    this.logger.info(`Initialized ${backendName} backend`);
  }

  /**
   * Start data collection
   */
  startCollection() {
    if (!this.enabled || !this.storageBackend) {
      return;
    }

    // Set up event listeners for all data sources
    this.setupEventListeners();

    // Start periodic flush
    this.startFlushTimer();

    this.logger.info('Data collection started');
  }

  /**
   * Stop data collection
   */
  stopCollection() {
    this.removeEventListeners();
    this.stopFlushTimer();
    this.logger.info('Data collection stopped');
  }

  /**
   * Set up event listeners for all data sources
   */
  setupEventListeners() {
    // Provider events (API requests/responses)
    this.addEventListener('provider:request', this.handleProviderRequest.bind(this));
    this.addEventListener('provider:response', this.handleProviderResponse.bind(this));

    // Message events
    this.addEventListener('message:sent', this.handleMessageSent.bind(this));
    this.addEventListener('message:received', this.handleMessageReceived.bind(this));

    // UI events
    this.addEventListener('ui:action', this.handleUIAction.bind(this));

    // Conversation events
    this.addEventListener('conversation:created', this.handleConversationEvent.bind(this));
    this.addEventListener('conversation:updated', this.handleConversationEvent.bind(this));

    // Error events
    this.addEventListener('error:occurred', this.handleErrorEvent.bind(this));
  }

  /**
   * Add event listener
   */
  addEventListener(eventType, handler) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(handler);
  }

  /**
   * Remove all event listeners
   */
  removeEventListeners() {
    this.eventListeners.clear();
  }

  /**
   * Emit event to be captured
   */
  emit(eventType, data) {
    if (!this.enabled) return;

    const eventData = {
      timestamp: Date.now(),
      eventType,
      sessionId: this.getCurrentSessionId(),
      provider: data.provider || 'unknown',
      data: data
    };

    this.captureEvent(eventData);
  }

  /**
   * Capture event data
   */
  captureEvent(eventData) {
    this.dataBuffer.push(eventData);

    // Flush if buffer is full
    if (this.dataBuffer.length >= this.maxBufferSize) {
      this.flushBuffer();
    }
  }

  /**
   * Start periodic flush timer
   */
  startFlushTimer() {
    this.flushTimer = setInterval(() => {
      this.flushBuffer();
    }, this.flushInterval);
  }

  /**
   * Stop flush timer
   */
  stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  /**
   * Flush buffered data to storage
   */
  async flushBuffer() {
    if (this.dataBuffer.length === 0 || !this.storageBackend) {
      return;
    }

    try {
      const dataToFlush = [...this.dataBuffer];
      this.dataBuffer = [];

      await this.storageBackend.store(dataToFlush);
      this.logger.debug(`Flushed ${dataToFlush.length} events to storage`);
    } catch (error) {
      this.logger.error('Failed to flush data buffer:', error);
      // Re-queue failed data
      this.dataBuffer.unshift(...this.dataBuffer);
    }
  }

  /**
   * Get current session ID
   */
  getCurrentSessionId() {
    // Generate or retrieve session ID
    // This could be based on browser session, user login, etc.
    return 'session_' + Date.now();
  }

  /**
   * Event handlers - capture all data without filtering
   */
  handleProviderRequest(data) {
    this.emit('provider:request', data);
  }

  handleProviderResponse(data) {
    this.emit('provider:response', data);
  }

  handleMessageSent(data) {
    this.emit('message:sent', data);
  }

  handleMessageReceived(data) {
    this.emit('message:received', data);
  }

  handleUIAction(data) {
    this.emit('ui:action', data);
  }

  handleConversationEvent(data) {
    this.emit('conversation:created', data);
  }

  handleErrorEvent(data) {
    this.emit('error:occurred', data);
  }

  /**
   * Enable/disable the data feed
   */
  async setEnabled(enabled) {
    this.enabled = enabled;

    if (enabled) {
      await this.initializeBackend(this.selectedBackend);
      this.startCollection();
    } else {
      this.stopCollection();
    }

    // Save configuration
    await chrome.storage.sync.set({
      dataFeedEnabled: enabled
    });
  }

  /**
   * Set storage backend
   */
  async setBackend(backendName, config = {}) {
    await this.initializeBackend(backendName, config);
    this.selectedBackend = backendName;

    // Save configuration
    await chrome.storage.sync.set({
      dataFeedBackend: backendName,
      dataFeedBackendConfig: config
    });
  }

  /**
   * Export data for user access
   */
  async exportData(format = 'json', dateRange = null) {
    if (!this.storageBackend) {
      throw new Error('No storage backend initialized');
    }

    return await this.storageBackend.export(format, dateRange);
  }

  /**
   * Clean up old data
   */
  async cleanup(retentionDays = 30) {
    if (!this.storageBackend) return;

    const cutoffDate = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    await this.storageBackend.cleanup(cutoffDate);
  }
}