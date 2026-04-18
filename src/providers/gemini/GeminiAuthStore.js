import { Logger } from '../../core/logging/Logger.js';

const logger = new Logger('GeminiAuthStore');

export class GeminiAuthStore {
  constructor() {
    this.psid = null;
    this.psidts = null;
    this.snlm0e = null;
    this.updatedAt = null;
  }

  setTokens({ psid, psidts, snlm0e }) {
    if (psid) this.psid = psid;
    if (psidts) this.psidts = psidts;
    if (snlm0e) this.snlm0e = snlm0e;
    this.updatedAt = Date.now();
    logger.debug('Tokens updated');
  }

  setExtra(key, value) {
    this[key] = value;
    this.updatedAt = Date.now();
  }

  getLatest() {
    return {
      psid: this.psid,
      psidts: this.psidts,
      snlm0e: this.snlm0e,
      updatedAt: this.updatedAt
    };
  }

  clear() {
    this.psid = null;
    this.psidts = null;
    this.snlm0e = null;
    this.updatedAt = null;
    logger.debug('Auth store cleared');
  }
}

export default GeminiAuthStore;