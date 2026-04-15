/**
 * Abstracted storage manager with caching and batching
 */
export class StorageManager {
  constructor(storage = chrome.storage.local, options = {}) {
    this.storage = storage;
    this.cache = new Map();
    this.pendingWrites = new Map();
    this.writeTimeout = null;
    this.logger = options.logger || console;

    this.writeDelay = options.writeDelay || 500; // ms
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Get value from storage with caching
   * @param {string} key - Storage key
   * @returns {Promise<any>} Stored value
   */
  async get(key) {
    // Check cache first
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    try {
      const result = await this.storage.get(key);
      const value = result[key];

      // Cache the result
      this.cache.set(key, value);

      return value;
    } catch (error) {
      this.logger.error(`[StorageManager] Get failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set value in storage with debounced batching
   * @param {string} key - Storage key
   * @param {any} value - Value to store
   */
  async set(key, value) {
    // Update cache immediately
    this.cache.set(key, value);

    // Queue write operation
    this.pendingWrites.set(key, value);
    this.scheduleWrite();
  }

  /**
   * Remove value from storage
   * @param {string} key - Storage key
   */
  async remove(key) {
    this.cache.delete(key);
    this.pendingWrites.delete(key);

    try {
      await this.storage.remove(key);
    } catch (error) {
      this.logger.error(`[StorageManager] Remove failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all keys matching pattern
   * @param {string} pattern - Key pattern (supports wildcards)
   * @returns {Promise<Array<string>>} Matching keys
   */
  async getKeys(pattern = '*') {
    try {
      const allData = await this.storage.get(null);
      const keys = Object.keys(allData);

      if (pattern === '*') {
        return keys;
      }

      // Simple pattern matching (can be enhanced)
      return keys.filter(key => key.includes(pattern.replace('*', '')));
    } catch (error) {
      this.logger.error(`[StorageManager] Get keys failed for pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Clear all storage
   */
  async clear() {
    this.cache.clear();
    this.pendingWrites.clear();
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
      this.writeTimeout = null;
    }

    try {
      await this.storage.clear();
    } catch (error) {
      this.logger.error('[StorageManager] Clear failed:', error);
      throw error;
    }
  }

  /**
   * Schedule a batched write operation
   * @private
   */
  scheduleWrite() {
    if (this.writeTimeout) return;

    this.writeTimeout = setTimeout(() => {
      this.flushWrites();
    }, this.writeDelay);
  }

  /**
   * Flush all pending writes to storage
   * @private
   */
  async flushWrites() {
    if (this.pendingWrites.size === 0) return;

    const writes = Object.fromEntries(this.pendingWrites);
    const keys = Array.from(this.pendingWrites.keys());

    try {
      await this.storage.set(writes);
      this.logger.debug(`[StorageManager] Flushed ${keys.length} writes:`, keys);
      this.pendingWrites.clear();
    } catch (error) {
      this.logger.error(`[StorageManager] Flush failed for keys ${keys}:`, error);

      // Retry logic could be added here
      if (this.maxRetries > 0) {
        this.logger.warn(`[StorageManager] Retrying flush in ${this.writeDelay}ms`);
        setTimeout(() => this.flushWrites(), this.writeDelay);
      }
    } finally {
      this.writeTimeout = null;
    }
  }

  /**
   * Force immediate flush of pending writes
   * @returns {Promise<void>}
   */
  async flush() {
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
      this.writeTimeout = null;
    }
    await this.flushWrites();
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getCacheStats() {
    return {
      cachedKeys: this.cache.size,
      pendingWrites: this.pendingWrites.size,
      writeTimeoutActive: !!this.writeTimeout
    };
  }
}