import { BaseProvider } from './BaseProvider.js';

/**
 * Provider registry for managing AI platform integrations
 */
export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.logger = console;
  }

  /**
   * Register a provider
   * @param {BaseProvider} provider - Provider instance
   */
  register(provider) {
    if (!(provider instanceof BaseProvider)) {
      throw new Error('Provider must extend BaseProvider');
    }

    this.providers.set(provider.id, provider);
    this.logger.log(`[ProviderRegistry] Registered provider: ${provider.name}`);
  }

  /**
   * Unregister a provider
   * @param {string} providerId - Provider ID
   */
  unregister(providerId) {
    const provider = this.providers.get(providerId);
    if (provider) {
      this.providers.delete(providerId);
      this.logger.log(`[ProviderRegistry] Unregistered provider: ${provider.name}`);
    }
  }

  /**
   * Get provider by ID
   * @param {string} providerId - Provider ID
   * @returns {BaseProvider|null} Provider instance or null
   */
  getProvider(providerId) {
    return this.providers.get(providerId) || null;
  }

  /**
   * Get all registered providers
   * @returns {Array<BaseProvider>} Array of providers
   */
  getAllProviders() {
    return Array.from(this.providers.values());
  }

  /**
   * Find provider that matches URL
   * @param {string} url - URL to match
   * @returns {BaseProvider|null} Matching provider or null
   */
  findProviderByUrl(url) {
    for (const provider of this.providers.values()) {
      if (provider.matchesUrl(url)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Find provider that matches request context
   * @param {Object} ctx - Request context
   * @returns {BaseProvider|null} Matching provider or null
   */
  findProviderByRequest(ctx) {
    for (const provider of this.providers.values()) {
      if (provider.matchRequest(ctx)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Find provider that matches response context
   * @param {Object} ctx - Response context
   * @returns {BaseProvider|null} Matching provider or null
   */
  findProviderByResponse(ctx) {
    for (const provider of this.providers.values()) {
      if (provider.matchResponse(ctx)) {
        return provider;
      }
    }
    return null;
  }

  /**
   * Get provider capabilities
   * @param {string} providerId - Provider ID
   * @returns {Object|null} Capabilities object or null
   */
  getCapabilities(providerId) {
    const provider = this.getProvider(providerId);
    return provider ? provider.capabilities : null;
  }

  /**
   * Check if provider supports capability
   * @param {string} providerId - Provider ID
   * @param {string} capability - Capability name
   * @returns {boolean} Whether provider supports capability
   */
  hasCapability(providerId, capability) {
    const capabilities = this.getCapabilities(providerId);
    return capabilities ? capabilities[capability] : false;
  }

  /**
   * Get provider statistics
   * @returns {Object} Registry statistics
   */
  getStats() {
    const providers = this.getAllProviders();
    const capabilities = providers.map(p => p.capabilities);

    return {
      totalProviders: providers.length,
      providersWithStreaming: capabilities.filter(c => c.supportsStreaming).length,
      providersWithAuth: capabilities.filter(c => c.supportsAuth).length,
      providerIds: providers.map(p => p.id)
    };
  }
}