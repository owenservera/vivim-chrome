import { DataFeedStorage } from './DataFeedStorage.js';

/**
 * Global Data Feed Manager
 * Singleton that manages data feed collection across the extension
 */
export class DataFeedManager {
  constructor() {
    this.dataFeedStorage = null;
    this.initialized = false;
  }

  /**
   * Initialize the data feed manager
   */
  async initialize() {
    if (this.initialized) return;

    try {
      this.dataFeedStorage = new DataFeedStorage();
      await this.dataFeedStorage.initialize();
      this.initialized = true;

      // Expose globally for providers
      if (typeof window !== 'undefined') {
        window.dataFeedManager = this;
      }
    } catch (error) {
      console.error('Failed to initialize data feed manager:', error);
      throw error;
    }
  }

  /**
   * Emit event to data feed
   */
  emit(eventType, data) {
    if (!this.initialized || !this.dataFeedStorage) return;

    this.dataFeedStorage.emit(eventType, data);
  }

  /**
   * Check if data feed is enabled
   */
  isEnabled() {
    return this.initialized && this.dataFeedStorage?.enabled;
  }

  /**
   * Enable/disable data feed
   */
  async setEnabled(enabled) {
    if (!this.dataFeedStorage) return;
    await this.dataFeedStorage.setEnabled(enabled);
  }

  /**
   * Set storage backend
   */
  async setBackend(backendName, config) {
    if (!this.dataFeedStorage) return;
    await this.dataFeedStorage.setBackend(backendName, config);
  }

  /**
   * Export data
   */
  async exportData(format, dateRange) {
    if (!this.dataFeedStorage) throw new Error('Data feed not initialized');
    return await this.dataFeedStorage.exportData(format, dateRange);
  }

  /**
   * Cleanup old data
   */
  async cleanup(retentionDays) {
    if (!this.dataFeedStorage) return;
    await this.dataFeedStorage.cleanup(retentionDays);
  }
}

// Global singleton instance
export const globalDataFeedManager = new DataFeedManager();