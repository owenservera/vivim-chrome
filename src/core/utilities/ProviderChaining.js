import { Logger } from '../logging/Logger.js';

export class ProviderChainer {
  constructor(options = {}) {
    this.registry = options.registry || null;
    this.mode = options.mode || 'fallback';
    this.maxRetries = options.maxRetries || 2;
    this.timeout = options.timeout || 30000;
    this.logger = new Logger('ProviderChainer');
  }

  setRegistry(registry) {
    this.registry = registry;
  }

  async executeChain(providerIds, operation, context) {
    if (!this.registry) {
      throw new Error('ProviderChainer: registry not set');
    }

    const errors = [];
    const attempts = [];
    let lastError = null;

    for (let i = 0; i < providerIds.length; i++) {
      const providerId = providerIds[i];
      const provider = this.registry.getProvider(providerId);

      if (!provider) {
        lastError = new Error(`Provider not found: ${providerId}`);
        errors.push({ providerId, error: lastError });
        continue;
      }

      const startTime = Date.now();

      try {
        this.logger.info(`Trying ${providerId} (${i + 1}/${providerIds.length})`);

        const operationWithTimeout = async () => operation(provider);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Timeout: ${providerId}`)), this.timeout)
        );

        const result = await Promise.race([operationWithTimeout(), timeoutPromise]);
        const elapsed = Date.now() - startTime;

        attempts.push({
          providerId,
          success: true,
          elapsed,
          result
        });

        if (this.mode === 'fallback' || i === 0) {
          return { result, providerId, attempts };
        }

      } catch (error) {
        const elapsed = Date.now() - startTime;
        lastError = error;
        errors.push({ providerId, error, elapsed });
        attempts.push({ providerId, success: false, elapsed, error: error.message });

        this.logger.warn(`${providerId} failed: ${error.message}`);
      }
    }

    const aggregateError = new Error(`All providers failed. Last error: ${lastError?.message}`);
    aggregateError.providerErrors = errors;

    throw aggregateError;
  }

  async executeWithFallback(operation, context) {
    if (!this.registry) throw new Error('Registry not set');
    const providers = this.registry.getProvidersByPriority();
    const providerIds = providers.map(p => p.id);
    return this.executeChain(providerIds, operation, context);
  }

  async executeWithEnsemble(operation, context) {
    if (!this.registry) throw new Error('Registry not set');
    const providers = this.registry.getProvidersByPriority();
    const providerIds = providers.map(p => p.id);

    const results = await this.executeChain(providerIds, operation, context);

    if (this.mode === 'ensemble') {
      return {
        results: results.attempts
          .filter(a => a.success)
          .map(a => ({ providerId: a.providerId, result: a.result })),
        attempts: results.attempts
      };
    }

    return results;
  }

  setMode(mode) {
    const validModes = ['fallback', 'ensemble', 'parallel'];
    if (!validModes.includes(mode)) {
      throw new Error(`Invalid mode: ${mode}. Valid: ${validModes.join(', ')}`);
    }
    this.mode = mode;
  }

  getMode() {
    return this.mode;
  }
}

export class ProviderChainBuilder {
  constructor(registry) {
    this.registry = registry;
    this.chain = [];
    this.mode = 'fallback';
    this.options = {};
    this.logger = new Logger('ProviderChainBuilder');
  }

  add(providerId) {
    if (this.registry && !this.registry.getProvider(providerId)) {
      throw new Error(`Provider not found: ${providerId}`);
    }
    this.chain.push(providerId);
    return this;
  }

  addByPriority(count = 3) {
    if (!this.registry) throw new Error('Registry not set');
    const providers = this.registry.getProvidersByPriority();
    const ids = providers.slice(0, count).map(p => p.id);
    this.chain.push(...ids);
    return this;
  }

  addByCapability(capability) {
    if (!this.registry) throw new Error('Registry not set');
    const providers = this.registry.getAllProviders();
    const matching = providers
      .filter(p => p.capabilities?.[capability])
      .sort((a, b) =>
        this.registry.getPriority(b.id) - this.registry.getPriority(a.id)
      )
      .map(p => p.id);

    this.chain.push(...matching);
    return this;
  }

  withMode(mode) {
    this.mode = mode;
    return this;
  }

  withOptions(options) {
    this.options = { ...this.options, ...options };
    return this;
  }

  build() {
    const chainer = new ProviderChainer({
      registry: this.registry,
      mode: this.mode,
      ...this.options
    });

    return { chainer, providerIds: this.chain };
  }

  execute(operation) {
    const { chainer, providerIds } = this.build();
    return chainer.executeChain(providerIds, operation, null);
  }
}