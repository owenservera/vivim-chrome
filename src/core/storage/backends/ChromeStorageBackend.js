/**
 * Chrome Storage Backend
 * Uses chrome.storage for data persistence (limited space)
 */
export class ChromeStorageBackend {
  constructor() {
    this.storage = chrome.storage.local;
    this.keyPrefix = 'dataFeed_';
    this.initialized = false;
  }

  async initialize(config = {}) {
    this.initialized = true;
    // Chrome storage doesn't need special initialization
  }

  async store(data) {
    if (!this.initialized) {
      throw new Error('Chrome storage backend not initialized');
    }

    try {
      // Get existing data
      const existing = await this.storage.get(null);
      const existingKeys = Object.keys(existing).filter(key => key.startsWith(this.keyPrefix));

      // Create new entries
      const newEntries = {};
      data.forEach((item, index) => {
        const key = `${this.keyPrefix}${Date.now()}_${index}`;
        newEntries[key] = item;
      });

      // Check storage quota (chrome.storage.local has ~5MB limit)
      const totalSize = this.estimateSize(newEntries) + this.estimateSize(existing);
      if (totalSize > 4 * 1024 * 1024) { // 4MB limit to be safe
        // Remove oldest entries
        await this.cleanupSpace(newEntries);
      }

      await this.storage.set(newEntries);
    } catch (error) {
      throw new Error(`Failed to store data: ${error.message}`);
    }
  }

  async export(format = 'json', dateRange = null) {
    if (!this.initialized) {
      throw new Error('Chrome storage backend not initialized');
    }

    try {
      const allData = await this.storage.get(null);
      const dataFeedKeys = Object.keys(allData).filter(key => key.startsWith(this.keyPrefix));
      const data = dataFeedKeys.map(key => allData[key]);

      // Filter by date range if specified
      let filteredData = data;
      if (dateRange) {
        filteredData = data.filter(item => {
          const itemDate = new Date(item.timestamp);
          return itemDate >= dateRange.start && itemDate <= dateRange.end;
        });
      }

      if (format === 'json') {
        return filteredData;
      } else if (format === 'jsonl') {
        return filteredData.map(item => JSON.stringify(item)).join('\n');
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      throw new Error(`Failed to export data: ${error.message}`);
    }
  }

  async cleanup(cutoffDate) {
    if (!this.initialized) return;

    try {
      const allData = await this.storage.get(null);
      const keysToRemove = [];

      for (const key of Object.keys(allData)) {
        if (key.startsWith(this.keyPrefix)) {
          const item = allData[key];
          if (item.timestamp < cutoffDate) {
            keysToRemove.push(key);
          }
        }
      }

      if (keysToRemove.length > 0) {
        await this.storage.remove(keysToRemove);
      }
    } catch (error) {
      console.error('Failed to cleanup chrome storage data:', error);
    }
  }

  async clear() {
    if (!this.initialized) return;

    try {
      const allData = await this.storage.get(null);
      const keysToRemove = Object.keys(allData).filter(key => key.startsWith(this.keyPrefix));

      if (keysToRemove.length > 0) {
        await this.storage.remove(keysToRemove);
      }
    } catch (error) {
      console.error('Failed to clear chrome storage data:', error);
    }
  }

  /**
   * Estimate size of data in bytes
   */
  estimateSize(data) {
    return new Blob([JSON.stringify(data)]).size;
  }

  /**
   * Cleanup space by removing oldest entries
   */
  async cleanupSpace(newEntries) {
    try {
      const allData = await this.storage.get(null);
      const dataFeedEntries = Object.keys(allData)
        .filter(key => key.startsWith(this.keyPrefix))
        .map(key => ({ key, item: allData[key] }))
        .sort((a, b) => a.item.timestamp - b.item.timestamp);

      // Remove oldest 20% of entries
      const toRemove = Math.ceil(dataFeedEntries.length * 0.2);
      const keysToRemove = dataFeedEntries.slice(0, toRemove).map(entry => entry.key);

      if (keysToRemove.length > 0) {
        await this.storage.remove(keysToRemove);
      }
    } catch (error) {
      console.error('Failed to cleanup space:', error);
    }
  }
}