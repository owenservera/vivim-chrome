import { BaseProvider } from './BaseProvider.js';
import { Logger } from '../logging/Logger.js';

export class ProviderRegistry {
  constructor(options = {}) {
    this.providers = new Map();
    this.priorities = new Map();
    this.logger = new Logger('ProviderRegistry');
    this.defaultPriority = options.defaultPriority || 100;
  }

  register(provider, priority = null) {
    if (!(provider instanceof BaseProvider)) {
      throw new Error('Provider must extend BaseProvider');
    }

    this.providers.set(provider.id, provider);
    this.priorities.set(provider.id, priority ?? this.defaultPriority);
    this.logger.info(`Registered provider: ${provider.name} (priority: ${this.getPriority(provider.id)})`);
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

  getAllProviders() {
    return Array.from(this.providers.values());
  }

  getPriority(providerId) {
    return this.priorities.get(providerId) ?? this.defaultPriority;
  }

  setPriority(providerId, priority) {
    if (!this.providers.has(providerId)) {
      throw new Error(`Provider ${providerId} not found`);
    }
    this.priorities.set(providerId, priority);
  }

  getProvidersByPriority() {
    return Array.from(this.providers.values())
      .sort((a, b) => this.getPriority(b.id) - this.getPriority(a.id));
  }

  findProviderByUrl(url) {
    const matches = Array.from(this.providers.values())
      .filter(p => p.matchesUrl(url))
      .sort((a, b) => this.getPriority(b.id) - this.getPriority(a.id));
    return matches[0] || null;
  }

  findProviderByRequest(ctx) {
    const matches = Array.from(this.providers.values())
      .filter(p => p.matchRequest(ctx))
      .sort((a, b) => this.getPriority(b.id) - this.getPriority(a.id));
    return matches[0] || null;
  }

  findProviderByResponse(ctx) {
    const matches = Array.from(this.providers.values())
      .filter(p => p.matchResponse(ctx))
      .sort((a, b) => this.getPriority(b.id) - this.getPriority(a.id));
    return matches[0] || null;
  }

  findAllMatchingProviders(ctx) {
    return Array.from(this.providers.values())
      .filter(p => p.matchRequest(ctx))
      .sort((a, b) => this.getPriority(b.id) - this.getPriority(a.id));
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