import { ProviderRegistry } from '../core/providers/ProviderRegistry.js';
import { ChatGPTProvider } from './chatgpt/ChatGPTProvider.js';
import { createWebBridge } from '../core/bridge/index.js';

const bridge = createWebBridge({
  selfId: 'vivim-bridge',
  targetId: 'vivim-content',
  autoHandshake: true
});

const providerRegistry = new ProviderRegistry();
const chatGPTProvider = new ChatGPTProvider();
chatGPTProvider.setBridge(bridge);
providerRegistry.register(chatGPTProvider);

function setupInterception() {
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const [url, options] = args;
    const reqUrl = typeof url === 'string' ? url : url?.url;
    const method = options?.method || 'GET';
    
    const isConversationAPI = reqUrl && method === 'POST' && 
      (reqUrl.includes('/backend-api/conversation') || reqUrl.includes('/backend-api/v/conversation'));
    
    if (!isConversationAPI) {
      return originalFetch.apply(this, args);
    }
    
    console.log('[Providers] Match! Intercepting ChatGPT conversation request');
    
    try {
      chatGPTProvider.onRequest({
        url: reqUrl,
        method: method,
        headers: options?.headers || {},
        body: options?.body,
        init: options
      });
    } catch (error) {
      console.warn('[Providers] Error in provider onRequest:', error);
    }

    let response = await originalFetch.apply(this, args);
    let clonedResponse = response.clone();

    const responseProvider = providerRegistry.findProviderByResponse({
      url: reqUrl,
      response: clonedResponse,
      clone: () => clonedResponse?.clone()
    });

    if (responseProvider) {
      setTimeout(async () => {
        try {
          await responseProvider.onResponse({
            url: reqUrl,
            response: clonedResponse,
            clone: () => clonedResponse.clone()
          });
        } catch (error) {
          console.warn('[Providers] Error in provider onResponse:', error);
        }
      }, 0);
    }

    return response;
  };
}

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

    const provider = providerRegistry.findProviderByRequest(ctx);
    if (provider) {
      try {
        provider.onRequest(ctx);
      } catch (error) {
        console.warn('[Providers] Error in provider onRequest:', error);
      }
    }

    return originalSend.call(this, body);
  };
}

function initProviders() {
  console.log('[Providers] Initializing provider system with WebBridge...');
  
  try {
    setupInterception();
  } catch (e) {
    console.error('[Providers] Fetch interception failed:', e);
  }

  try {
    setupXHRInterception();
  } catch (e) {
    console.error('[Providers] XHR interception failed:', e);
  }
  
  console.log('[Providers] All providers initialized');
  window.__VIVIM_PROVIDERS_READY__ = true;
}

function init() {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProviders);
  } else {
    initProviders();
  }
}

init();

window.VIVIM_PROVIDER_REGISTRY = providerRegistry;
