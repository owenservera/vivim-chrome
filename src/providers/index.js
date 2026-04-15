/**
 * Provider Bundle - All AI platform providers
 * This creates the inject-web.js bundle with all provider logic
 */

import { ProviderRegistry } from '../core/providers/ProviderRegistry.js';
import { ChatGPTProvider } from './chatgpt/ChatGPTProvider.js';

// Initialize provider registry
const providerRegistry = new ProviderRegistry();

// Register all available providers
providerRegistry.register(new ChatGPTProvider());

// Export for use in inject-web context
window.__VIVIM_PROVIDERS__ = providerRegistry;

// Set up request/response interception
function setupInterception() {
  // Hook fetch for outgoing requests
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options] = args;

    // Find matching provider
    const provider = providerRegistry.findProviderByRequest({
      url: typeof url === 'string' ? url : url?.url,
      method: options?.method || 'GET',
      headers: options?.headers || {},
      body: options?.body
    });

    // Call provider onRequest if found
    if (provider) {
      try {
        provider.onRequest({
          url: typeof url === 'string' ? url : url?.url,
          method: options?.method || 'GET',
          headers: options?.headers || {},
          body: options?.body,
          init: options
        });
      } catch (error) {
        console.warn(`[Providers] Error in ${provider.id} onRequest:`, error);
      }
    }

    // Continue with original request
    const response = await originalFetch.apply(this, args);

    // Clone response for provider processing
    const responseClone = response.clone();

    // Find provider for response handling
    const responseProvider = providerRegistry.findProviderByResponse({
      url: typeof url === 'string' ? url : url?.url,
      response,
      clone: () => responseClone
    });

    // Process response asynchronously
    if (responseProvider) {
      setTimeout(async () => {
        try {
          await responseProvider.onResponse({
            url: typeof url === 'string' ? url : url?.url,
            response,
            clone: () => responseClone
          });
        } catch (error) {
          console.warn(`[Providers] Error in ${responseProvider.id} onResponse:`, error);
        }
      }, 0);
    }

    return response;
  };

  console.log('[Providers] Fetch interception setup complete');
}

// XHR Interception (for legacy support)
function setupXHRInterception() {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._xhr_url = url;
    this._xhr_method = method;
    this._xhr_headers = {};
    return originalOpen.call(this, method, url, ...rest);
  };

  XMLHttpRequest.prototype.send = function(body) {
    const ctx = {
      protocol: 'xhr',
      method: this._xhr_method,
      url: this._xhr_url,
      headers: { ...this._xhr_headers },
      body: body
    };

    // Find provider and call onRequest
    const provider = providerRegistry.findProviderByRequest(ctx);
    if (provider) {
      try {
        provider.onRequest(ctx);
      } catch (error) {
        console.warn(`[Providers] Error in ${provider.id} onRequest:`, error);
      }
    }

    return originalSend.call(this, body);
  };

  console.log('[Providers] XHR interception setup complete');
}

// Simple bridge implementation for communication with content script
class SimpleBridge {
  constructor(communicationId, options = {}) {
    this.communicationId = communicationId;
    this.allowedIds = new Set(options.allowedIds || []);
    this.handlers = new Map();
    this.pendingRequests = new Map();
    this.requestId = 0;

    // Listen for messages from content script
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  handle(action, handler) {
    this.handlers.set(action, handler);
  }

  send(action, data) {
    const message = {
      type: 'web-bridge',
      communicationId: this.communicationId,
      id: `req_${++this.requestId}`,
      action,
      data,
      timestamp: Date.now()
    };

    console.log('[Bridge] Sending:', action, data);
    window.postMessage(message, '*');
  }

  async invoke(action, data) {
    return new Promise((resolve, reject) => {
      const id = `req_${++this.requestId}`;
      const message = {
        type: 'web-bridge',
        communicationId: this.communicationId,
        id,
        action,
        data,
        needResponse: true,
        timestamp: Date.now()
      };

      this.pendingRequests.set(id, { resolve, reject, timeout: setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error('Bridge request timeout'));
      }, 30000) });

      window.postMessage(message, '*');
    });
  }

  handleMessage(event) {
    if (event.data.type !== 'web-bridge' || event.data.communicationId !== 'saveai-extension-content') {
      return;
    }

    const { action, data, requestId, success, error } = event.data;

    // Handle responses to our requests
    if (requestId && this.pendingRequests.has(requestId)) {
      const pending = this.pendingRequests.get(requestId);
      clearTimeout(pending.timeout);
      this.pendingRequests.delete(requestId);

      if (success) {
        pending.resolve(data);
      } else {
        pending.reject(new Error(error || 'Bridge request failed'));
      }
      return;
    }

    // Handle incoming requests
    if (action && this.handlers.has(action)) {
      try {
        const handler = this.handlers.get(action);
        const result = handler(data);

        // Send response if needed
        if (event.data.needResponse) {
          window.postMessage({
            type: 'web-bridge',
            communicationId: 'inject-chat-web',
            requestId: event.data.id,
            success: true,
            data: result,
            timestamp: Date.now()
          }, '*');
        }
      } catch (err) {
        if (event.data.needResponse) {
          window.postMessage({
            type: 'web-bridge',
            communicationId: 'inject-chat-web',
            requestId: event.data.id,
            success: false,
            error: err.message,
            timestamp: Date.now()
          }, '*');
        }
      }
    }
  }
}

// Bridge setup function
function setupBridge() {
  const bridge = new SimpleBridge("inject-chat-web", { allowedIds: ["saveai-extension-content"] });
  window.__VIVIM_BRIDGE = bridge;
  console.log('[Providers] Bridge created and ready');

  // Set up auth handlers that providers can register
  window.__VIVIM_BRIDGE_AUTH_HANDLERS = new Map();
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProviders);
} else {
  initProviders();
}

function initProviders() {
  console.log('[Providers] Initializing provider system...');

  setupInterception();
  setupXHRInterception();

  // Set up bridge communication
  setupBridge();

  console.log('[Providers] All providers initialized');
}

// Export provider registry for debugging
window.VIVIM_PROVIDER_REGISTRY = providerRegistry;