export class BaseProvider {
  constructor(config = {}) {
    this.id = config.id;
    this.name = config.name || config.id;
    this.hosts = config.hosts || [];
    this.capabilities = {
      supportsStreaming: false,
      supportsAuth: false,
      messageFormat: 'standard',
      ...config.capabilities
    };
    this.config = config;
    this.logger = config.logger || console;
    this.bridge = null;
    this.interceptPatterns = config.interceptPatterns || {};
    this.stealthConfig = config.stealth || {
      enabled: false,
      preferContentScript: false,
      contentScriptHosts: this.hosts
    };
  }
  
  matchRequest(ctx) {
    return false;
  }
  
  onRequest(ctx) {
  }
  
  matchResponse(ctx) {
    return false;
  }
  
  async onResponse(ctx) {
  }
  
  getAuthHeaders() {
    return {};
  }

  /**
   * Perform a stealth fetch operation
   * @param {string} url - Request URL
   * @param {object} options - Fetch options
   * @returns {Promise<Response>} Fetch response
   */
  async stealthFetch(url, options = {}) {
    if (this.stealthConfig.enabled && window.stealthFetchManager) {
      try {
        return await window.stealthFetchManager.fetch(this.id, url, options);
      } catch (error) {
        this.logger.warn(`Stealth fetch failed for ${this.id}, falling back to standard fetch:`, error.message);
        // Fall back to standard fetch
      }
    }

    // Standard fetch as fallback
    return await fetch(url, options);
  }

  /**
   * Update stealth configuration
   * @param {object} config - Stealth configuration
   */
  updateStealthConfig(config) {
    this.stealthConfig = { ...this.stealthConfig, ...config };
    this.logger.info(`Updated stealth config for ${this.id}:`, this.stealthConfig);
  }
  
  matchesUrl(url) {
    if (!url) return false;
    return this.hosts.some(host => url.includes(host));
  }
  
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      hosts: this.hosts,
      capabilities: this.capabilities
    };
  }
  
  setBridge(bridge) {
    this.bridge = bridge;
  }
  
  getBridge() {
    return this.bridge;
  }
  
  sendToBridge(action, data) {
    if (this.bridge) {
      this.bridge.send(action, data);
    }
  }
  
  invokeBridge(action, data) {
    if (this.bridge) {
      return this.bridge.invoke(action, data);
    }
    return Promise.reject(new Error('Bridge not initialized'));
  }
  
  matchesPattern(url, pattern) {
    if (!pattern || !url) return false;
    if (pattern instanceof RegExp) {
      return pattern.test(url);
    }
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return false;
  }
}