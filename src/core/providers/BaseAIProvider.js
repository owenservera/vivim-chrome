/**
 * Base AI Provider Template
 * Template for implementing new AI providers using the centralized streaming API
 */

import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { StreamingManager } from '../../core/streaming/StreamingManager.js';

/**
 * Auth store template for AI providers
 */
export class BaseAuthStore {
  constructor() {
    this.authorization = null;
    this.updatedAt = null;
    this.extraHeaders = {};
  }

  setAuthData(auth) {
    if (auth) {
      this.authorization = auth;
      this.updatedAt = Date.now();
    }
  }

  setExtraHeaders(headers) {
    this.extraHeaders = { ...this.extraHeaders, ...headers };
    this.updatedAt = Date.now();
  }

  getLatest() {
    return {
      authorization: this.authorization,
      updatedAt: this.updatedAt,
      extraHeaders: Object.keys(this.extraHeaders).length > 0 ? this.extraHeaders : undefined
    };
  }
}

/**
 * Base interceptor template for AI providers
 */
export class BaseInterceptor {
  constructor(authStore, config) {
    this.authStore = authStore;
    this.config = config;
    this.logger = console;
    this.streamingManager = null;
  }

  /**
   * Initialize streaming manager
   */
  initStreamingManager() {
    if (!this.streamingManager) {
      this.streamingManager = new StreamingManager(window.__VIVIM_BRIDGE, {
        dataFeedManager: typeof window !== 'undefined' ? window.dataFeedManager : null
      });
    }
  }

  /**
   * Handle request interception
   * Override in subclasses for provider-specific logic
   */
  onRequest(ctx) {
    // Extract authorization header
    const auth = ctx.headers[this.config.authHeader || "Authorization"] ||
                 ctx.headers[this.config.authHeader?.toLowerCase()];
    if (auth) {
      this.authStore.setAuthData(auth);
    }

    // Extract extra headers
    if (this.config.extraHeaderPrefixes) {
      const extras = {};
      for (const [k, v] of Object.entries(ctx.headers)) {
        const lower = k.toLowerCase();
        for (const prefix of this.config.extraHeaderPrefixes) {
          if (lower.startsWith(prefix.toLowerCase())) {
            extras[k] = v;
          }
        }
      }
      if (Object.keys(extras).length > 0) {
        this.authStore.setExtraHeaders(extras);
      }
    }

    // Handle user prompt if applicable
    this.handleUserPrompt(ctx);
  }

  /**
   * Handle user prompt interception
   * Override in subclasses for provider-specific prompt handling
   */
  handleUserPrompt(ctx) {
    // Default implementation - override as needed
  }

  /**
   * Handle response interception
   * Override in subclasses for provider-specific response handling
   */
  async onResponse(ctx) {
    if (this.isStreamingResponse(ctx)) {
      this.initStreamingManager();

      const streamId = `${this.config.providerId}_${Date.now()}_${Math.floor(Math.random()*1000)}`;

      await this.streamingManager.processStream({
        streamId,
        response: ctx.response,
        format: this.config.streamingFormat || 'json-stream',
        metadata: {
          provider: this.config.providerId,
          model: this.extractModel(ctx) || 'unknown'
        }
      });
    }
  }

  /**
   * Check if response is streaming
   * Override in subclasses
   */
  isStreamingResponse(ctx) {
    return false; // Override in subclasses
  }

  /**
   * Extract model information from context
   * Override in subclasses
   */
  extractModel(ctx) {
    return 'unknown'; // Override in subclasses
  }
}

/**
 * Base AI Provider Template
 * Extend this class to create new AI providers
 */
export class BaseAIProvider extends BaseProvider {
  constructor(config) {
    super({
      id: config.id,
      name: config.name,
      hosts: config.hosts,
      capabilities: {
        supportsStreaming: config.supportsStreaming || true,
        supportsAuth: config.supportsAuth || true,
        messageFormat: config.messageFormat || 'openai',
        ...config.capabilities
      }
    });

    this.config = config;
    this.authStore = new (config.authStoreClass || BaseAuthStore)();
    this.interceptor = new (config.interceptorClass || BaseInterceptor)(this.authStore, config);
  }

  /**
   * Check if request matches this provider
   */
  matchRequest(ctx) {
    // Check URL patterns
    if (this.config.urlPatterns) {
      for (const pattern of this.config.urlPatterns) {
        if (typeof pattern === 'string' && ctx.url?.includes(pattern)) {
          return true;
        }
        if (pattern instanceof RegExp && pattern.test(ctx.url)) {
          return true;
        }
      }
    }

    // Check host
    const url = new URL(ctx.url);
    return this.hosts.includes(url.host);
  }

  /**
   * Handle request interception
   */
  onRequest(ctx) {
    return this.interceptor.onRequest(ctx);
  }

  /**
   * Check if response matches this provider
   */
  matchResponse(ctx) {
    return this.matchRequest(ctx) && this.interceptor.isStreamingResponse(ctx);
  }

  /**
   * Handle response interception
   */
  onResponse(ctx) {
    return this.interceptor.onResponse(ctx);
  }

  /**
   * Get auth headers for API calls
   */
  getAuthHeaders() {
    const auth = this.authStore.getLatest();
    return {
      [this.config.authHeader || 'Authorization']: auth.authorization,
      ...auth.extraHeaders
    };
  }
}

/**
 * Example: How to create a new AI provider
 *
 * export class ExampleAIProvider extends BaseAIProvider {
 *   constructor() {
 *     super({
 *       id: 'example',
 *       name: 'Example AI',
 *       hosts: ['api.example.com'],
 *       urlPatterns: ['/v1/chat/completions'],
 *       streamingFormat: 'sse', // or 'json-stream', 'delta-encoding-v1'
 *       authHeader: 'X-API-Key',
 *       extraHeaderPrefixes: ['example-'],
 *       supportsStreaming: true,
 *       supportsAuth: true,
 *       messageFormat: 'openai',
 *
 *       // Custom classes (optional)
 *       authStoreClass: ExampleAuthStore,
 *       interceptorClass: ExampleInterceptor
 *     });
 *   }
 * }
 */