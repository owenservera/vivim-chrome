/**
 * IndexedDB Storage Backend
 * Stores data in IndexedDB for local persistence
 */
export class IndexedDBStorageBackend {
  constructor() {
    this.db = null;
    this.dbName = 'VIVIM_DataFeed';
    this.storeName = 'events';
    this.version = 1;
    this.initialized = false;
  }

  async initialize(config = {}) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, {
            keyPath: 'id',
            autoIncrement: true
          });

          // Create indexes for efficient querying
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('eventType', 'eventType', { unique: false });
          store.createIndex('sessionId', 'sessionId', { unique: false });
          store.createIndex('provider', 'provider', { unique: false });
        }
      };
    });
  }

  async store(data) {
    if (!this.initialized || !this.db) {
      throw new Error('IndexedDB backend not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      let completed = 0;
      const total = data.length;

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);

      data.forEach(item => {
        const request = store.add(item);
        request.onsuccess = () => {
          completed++;
          if (completed === total) {
            resolve();
          }
        };
        request.onerror = () => reject(request.error);
      });
    });
  }

  async export(format = 'json', dateRange = null) {
    if (!this.initialized || !this.db) {
      throw new Error('IndexedDB backend not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        let data = request.result;

        // Filter by date range if specified
        if (dateRange) {
          data = data.filter(item => {
            const itemDate = new Date(item.timestamp);
            return itemDate >= dateRange.start && itemDate <= dateRange.end;
          });
        }

        if (format === 'json') {
          resolve(data);
        } else if (format === 'jsonl') {
          const jsonl = data.map(item => JSON.stringify(item)).join('\n');
          resolve(jsonl);
        } else {
          reject(new Error(`Unsupported export format: ${format}`));
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async cleanup(cutoffDate) {
    if (!this.initialized || !this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');

      const range = IDBKeyRange.upperBound(cutoffDate);
      const request = index.openCursor(range);

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clear() {
    if (!this.initialized || !this.db) return;

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}