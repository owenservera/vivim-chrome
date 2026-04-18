import { Logger } from '../../core/logging/Logger.js';

const logger = new Logger('ChatGPTAuthStore');

export class ChatGPTAuthStore {
  constructor() {
    this.authorization = null;
    this.updatedAt = null;
    this.extraHeaders = {};
  }

  setPrimary(auth) {
    if (auth) {
      this.authorization = auth;
      this.updatedAt = Date.now();
      logger.debug('Primary auth set');
    }
  }

  setExtra(key, value) {
    this.extraHeaders[key] = value;
    this.updatedAt = Date.now();
  }

  setMultiple(headers) {
    if (headers && typeof headers === 'object') {
      for (const [key, value] of Object.entries(headers)) {
        this.extraHeaders[key] = value;
      }
      this.updatedAt = Date.now();
    }
  }

  getLatest() {
    return {
      authorization: this.authorization,
      updatedAt: this.updatedAt,
      extraHeaders: Object.keys(this.extraHeaders).length > 0 ? this.extraHeaders : undefined
    };
  }

  clear() {
    this.authorization = null;
    this.extraHeaders = {};
    this.updatedAt = null;
    logger.debug('Auth store cleared');
  }
}

export function createAuthStore(storageKey, extraStorageKey) {
  return class extends ChatGPTAuthStore {
    constructor() {
      super();
      this.storageKey = storageKey;
      this.extraStorageKey = extraStorageKey;
    }

    async save() {
      const data = this.getLatest();
      if (data.authorization) {
        await chrome.storage.local.set({ [this.storageKey]: data.authorization });
      }
      if (data.extraHeaders) {
        await chrome.storage.local.set({ [this.extraStorageKey]: data.extraHeaders });
      }
    }

    async load() {
      const results = await chrome.storage.local.get([this.storageKey, this.extraStorageKey]);
      if (results[this.storageKey]) {
        this.setPrimary(results[this.storageKey]);
      }
      if (results[this.extraStorageKey]) {
        this.setMultiple(results[this.extraStorageKey]);
      }
    }
  };
}

export default ChatGPTAuthStore;