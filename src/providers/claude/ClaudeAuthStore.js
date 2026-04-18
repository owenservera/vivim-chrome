import { Logger } from '../../core/logging/Logger.js';

const logger = new Logger('ClaudeAuthStore');

export class ClaudeAuthStore {
  constructor() {
    this.authorization = null;
    this.apiKey = null;
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

  setApiKey(key) {
    if (key) {
      this.apiKey = key;
      this.updatedAt = Date.now();
      logger.debug('API key set');
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
      apiKey: this.apiKey,
      updatedAt: this.updatedAt,
      extraHeaders: Object.keys(this.extraHeaders).length > 0 ? this.extraHeaders : undefined
    };
  }

  clear() {
    this.authorization = null;
    this.apiKey = null;
    this.extraHeaders = {};
    this.updatedAt = null;
    logger.debug('Auth store cleared');
  }
}

export default ClaudeAuthStore;