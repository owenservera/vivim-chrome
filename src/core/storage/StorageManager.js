import { Logger } from '../logging/Logger.js';

/**
 * Enhanced Storage Manager with caching, batching, and migration support
 */
export class StorageManager {
  constructor(storage = chrome.storage.local, options = {}) {
    this.storage = storage;
    this.cache = new Map();
    this.pendingWrites = new Map();
    this.writeTimeout = null;
    this.logger = new Logger('StorageManager');

    this.writeDelay = options.writeDelay || 500;
    this.maxRetries = options.maxRetries || 3;
    this.schemaVersion = options.schemaVersion || 1;
    this.migrations = options.migrations || [];
  }

  /**
   * Run schema migrations
   */
  async migrate() {
    const versionKey = '_schemaVersion';
    let currentVersion = await this.get(versionKey);

    if (currentVersion === undefined) {
      currentVersion = 0;
      await this.set(versionKey, this.schemaVersion);
    }

    if (currentVersion < this.schemaVersion) {
      this.logger.info(`Migrating storage from v${currentVersion} to v${this.schemaVersion}`);

      for (let v = currentVersion; v < this.schemaVersion; v++) {
        const migration = this.migrations[v];
        if (migration) {
          try {
            await migration(this);
          } catch (error) {
            this.logger.error(`Migration failed at v${v}:`, error);
            throw error;
          }
        }
      }

      await this.set(versionKey, this.schemaVersion);
      this.logger.info('Migration complete');
    }
  }

  /**
   * Legacy method for running migrations
   */
  async runMigrations() {
    return this.migrate();
  }

  /**
   * Register a migration function
   */
  registerMigration(version, migrationFn) {
    this.migrations[version] = migrationFn;
  }

  /**
   * Get value from storage with caching
   */
  async get(key) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    try {
      const result = await this.storage.get(key);
      const value = result ? result[key] : undefined;
      this.cache.set(key, value);
      return value;
    } catch (error) {
      this.logger.error(`Get failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Set value in storage with debounced batching
   */
  async set(key, value) {
    this.cache.set(key, value);
    this.pendingWrites.set(key, value);
    this.scheduleWrite();
  }

  /**
   * Remove value from storage
   */
  async remove(key) {
    this.cache.delete(key);
    this.pendingWrites.delete(key);

    try {
      await this.storage.remove(key);
    } catch (error) {
      this.logger.error(`Remove failed for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get all keys matching a simple pattern
   */
  async getKeys(pattern = '*') {
    try {
      const allData = await this.storage.get(null);
      const keys = Object.keys(allData);

      if (pattern === '*') return keys;

      const regex = new RegExp('^' + pattern.split('*').join('.*') + '$');
      return keys.filter(key => regex.test(key));
    } catch (error) {
      this.logger.error(`Get keys failed for pattern ${pattern}:`, error);
      throw error;
    }
  }

  /**
   * Clear all storage and cache
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
      this.logger.error('Clear failed:', error);
      throw error;
    }
  }

  /**
   * @private
   */
  scheduleWrite() {
    if (this.writeTimeout) return;
    this.writeTimeout = setTimeout(() => this.flushWrites(), this.writeDelay);
  }

  /**
   * @private
   */
  async flushWrites() {
    if (this.pendingWrites.size === 0) {
      this.writeTimeout = null;
      return;
    }

    const writes = Object.fromEntries(this.pendingWrites);
    const keys = Array.from(this.pendingWrites.keys());

    try {
      await this.storage.set(writes);
      this.logger.debug(`Flushed ${keys.length} writes`, { keys });
      this.pendingWrites.clear();
    } catch (error) {
      this.logger.error(`Flush failed for keys: ${keys.join(', ')}`, error);
      // Retrying logic here could be risky, but let's keep the existing simple retry
      if (this.maxRetries > 0) {
        this.logger.warn(`Retrying flush in ${this.writeDelay}ms`);
        setTimeout(() => this.flushWrites(), this.writeDelay);
      }
    } finally {
      this.writeTimeout = null;
    }
  }

  /**
   * Force immediate flush of pending writes
   */
  async flush() {
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
      this.writeTimeout = null;
    }
    await this.flushWrites();
  }

  /**
   * Get storage and cache statistics
   */
  getStats() {
    return {
      cachedKeys: this.cache.size,
      pendingWrites: this.pendingWrites.size,
      writeTimeoutActive: !!this.writeTimeout
    };
  }
}