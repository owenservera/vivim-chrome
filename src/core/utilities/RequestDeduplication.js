import { Logger } from '../logging/Logger.js';

export class RequestDeduplication {
  constructor(options = {}) {
    this.pendingRequests = new Map();
    this.ttl = options.ttl || 30000;
    this.maxPending = options.maxPending || 50;
    this.logger = new Logger('RequestDeduplication');
  }

  hashRequest(url, method, body) {
    const content = `${method}:${url}:${JSON.stringify(body || {})}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }

  getKey(url, method, body) {
    return `${this.hashRequest(url, method, body)}`;
  }

  async deduplicate(key, operation) {
    if (this.pendingRequests.has(key)) {
      const existing = this.pendingRequests.get(key);
      this.logger.debug(`Deduplicating request for key: ${key}`);
      return existing.promise;
    }

    if (this.pendingRequests.size >= this.maxPending) {
      const oldestKey = this.pendingRequests.keys().next().value;
      this.pendingRequests.delete(oldestKey);
      this.logger.warn(`Evicted oldest request: ${oldestKey}`);
    }

    const promise = operation();
    const entry = { promise, timestamp: Date.now() };
    this.pendingRequests.set(key, entry);

    promise
      .finally(() => {
        this.pendingRequests.delete(key);
      })
      .catch(() => {
        this.pendingRequests.delete(key);
      });

    return promise;
  }

  execute(url, method, body, operation) {
    const key = this.getKey(url, method, body);
    return this.deduplicate(key, operation);
  }

  isPending(key) {
    return this.pendingRequests.has(key);
  }

  getPendingCount() {
    return this.pendingRequests.size;
  }

  clearStale() {
    const now = Date.now();
    for (const [key, entry] of this.pendingRequests) {
      if (now - entry.timestamp > this.ttl) {
        this.pendingRequests.delete(key);
      }
    }
  }

  clear() {
    this.pendingRequests.clear();
  }

  getStats() {
    return {
      pendingCount: this.pendingRequests.size,
      keys: Array.from(this.pendingRequests.keys())
    };
  }
}