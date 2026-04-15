/**
 * Base provider class for AI platform integrations
 */
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
  }

  /**
   * Check if this provider should handle the request
   * @param {Object} ctx - Request context
   * @returns {boolean} Whether to handle the request
   */
  matchRequest(ctx) {
    return false; // Override in subclasses
  }

  /**
   * Handle outgoing request
   * @param {Object} ctx - Request context
   */
  onRequest(ctx) {
    // Override in subclasses
  }

  /**
   * Check if this provider should handle the response
   * @param {Object} ctx - Response context
   * @returns {boolean} Whether to handle the response
   */
  matchResponse(ctx) {
    return false; // Override in subclasses
  }

  /**
   * Handle incoming response
   * @param {Object} ctx - Response context
   */
  async onResponse(ctx) {
    // Override in subclasses
  }

  /**
   * Get authentication headers for this provider
   * @returns {Object} Headers object
   */
  getAuthHeaders() {
    return {};
  }

  /**
   * Check if URL belongs to this provider
   * @param {string} url - URL to check
   * @returns {boolean} Whether URL matches provider
   */
  matchesUrl(url) {
    if (!url) return false;
    return this.hosts.some(host => url.includes(host));
  }

  /**
   * Get provider metadata
   * @returns {Object} Provider info
   */
  getInfo() {
    return {
      id: this.id,
      name: this.name,
      hosts: this.hosts,
      capabilities: this.capabilities
    };
  }
}