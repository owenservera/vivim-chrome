import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { createProviderMixin } from '../../core/providers/ProviderMixin.js';
import { createAuthStore } from '../../core/providers/AuthStore.js';
import { StreamingManager } from '../../core/streaming/StreamingManager.js';
import { Logger } from '../../core/logging/Logger.js';

const ChatGPTAuthStore = createAuthStore('authorization', 'extraHeaders');

const MixinProvider = createProviderMixin(BaseProvider);

export class ChatGPTProvider extends MixinProvider {
  constructor() {
    super({
      id: 'chatgpt',
      name: 'ChatGPT',
      hosts: ['chatgpt.com', 'chat.com'],
      capabilities: {
        supportsStreaming: true,
        supportsAuth: true,
        messageFormat: 'openai'
      },
      interceptPatterns: {
        request: /\/backend-api(\/f)?\/conversation(\?|$)/
      },
      stealth: {
        enabled: true,
        preferContentScript: true,
        contentScriptHosts: ['chatgpt.com', 'chat.com']
      },
      storageKey: 'chatgpt_auth',
      maxRetries: 3,
      baseRetryDelay: 1000
    });

    this.authStore = new ChatGPTAuthStore();
    this.streamingManager = null;
    this.logger = new Logger('ChatGPTProvider');
  }

  onAuthDataLoaded(secureAuth) {
    this.authStore.setPrimary(secureAuth.authorization);
    if (secureAuth.extraHeaders) {
      this.authStore.setMultiple(secureAuth.extraHeaders);
    }
  }

  matchRequest(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return ctx.url?.includes('/backend-api/');
    return this.matchesPattern(ctx.url, pattern);
  }

  onRequest(ctx) {
    this.logger.debug('onRequest called:', ctx.url);

    if (window.dataFeedManager?.isEnabled()) {
      window.dataFeedManager.emit('provider:request', {
        provider: 'chatgpt',
        url: ctx.url,
        method: ctx.method,
        headers: ctx.headers,
        bodySize: ctx.body ? (typeof ctx.body === 'string' ? ctx.body.length : ctx.body.byteLength) : 0
      });
    }

    const auth = ctx.headers['Authorization'] || ctx.headers['authorization'];
    if (auth) {
      this.authStore.setPrimary(auth);
      this.storeSecureAuthData(this.authStore.getLatest());
    }

    const extras = {};
    for (const [k, v] of Object.entries(ctx.headers)) {
      const lower = k.toLowerCase();
      if (lower.startsWith('chatgpt-')) {
        extras[k] = v;
      }
    }
    if (Object.keys(extras).length > 0) {
      this.authStore.setMultiple(extras);
      this.storeSecureAuthData(this.authStore.getLatest());
    }

    this.handleUserPrompt(ctx);
  }

  handleUserPrompt(ctx) {
    const pattern = this.interceptPatterns?.request;
    const isConversationEndpoint = this.matchesPattern(ctx.url, pattern);
    
    if (!isConversationEndpoint || !ctx.body) {
      return;
    }
    
    try {
      const bodyStr = typeof ctx.body === 'string' ? ctx.body : new TextDecoder().decode(ctx.body);
      const payload = JSON.parse(bodyStr);

      if (payload.messages && Array.isArray(payload.messages)) {
        const userMessages = payload.messages.filter(m => m.author?.role === 'user');
        const userMessage = userMessages[userMessages.length - 1];

        if (userMessage && userMessage.content?.parts) {
          const content = userMessage.content.parts
            .filter(p => typeof p === 'string')
            .join('\n');

          this.logger.info(`Extracted user prompt (${content.length} chars)`);

          if (content) {
            if (window.dataFeedManager?.isEnabled()) {
              window.dataFeedManager.emit('message:sent', {
                provider: 'chatgpt',
                role: 'user',
                content: content,
                conversationId: payload.conversation_id || null,
                messageLength: content.length
              });
            }

            this.sendToBridge('userPrompt', {
              role: 'user',
              content: content,
              conversationId: payload.conversation_id || null
            });
          }
        }
      }
    } catch (e) {
      this.logger.warn('Failed to parse request body:', e.message);
    }
  }

  matchResponse(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return false;
    return this.matchesPattern(ctx.url, pattern);
  }

  async onResponse(ctx) {
    this.logger.info('Intercepted streaming response');

    if (window.dataFeedManager?.isEnabled()) {
      window.dataFeedManager.emit('provider:response', {
        provider: 'chatgpt',
        url: ctx.url,
        responseStatus: ctx.response.status,
        responseHeaders: Object.fromEntries(ctx.response.headers.entries()),
        contentType: ctx.response.headers.get('content-type')
      });
    }

    if (!this.streamingManager) {
      this.streamingManager = new StreamingManager({
        send: (action, data) => this.sendToBridge(action, data)
      }, {
        dataFeedManager: window.dataFeedManager
      });
    }

    const streamId = 'chatgpt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    try {
      await this.streamingManager.processStream({
        streamId,
        response: ctx.response,
        format: 'openai-sse',
        metadata: {
          provider: 'chatgpt',
          model: 'unknown'
        }
      });
    } catch (e) {
      this.logger.error('Streaming error:', e);

      try {
        await this.handleProviderError(e, async () => {
          return await this.streamingManager.processStream({
            streamId: streamId + '_retry',
            response: ctx.response,
            format: 'openai-sse',
            metadata: {
              provider: 'chatgpt',
              model: 'unknown'
            }
          });
        }, () => this.refreshAuthTokens());
      } catch (recoveryError) {
        this.logger.error('Error recovery failed:', recoveryError);
        this.sendToBridge('streamComplete', { streamId, error: recoveryError.message });
      }
    }
  }

  getAuthHeaders() {
    const auth = this.authStore.getLatest();
    return {
      'Authorization': auth.authorization,
      ...auth.extraHeaders
    };
  }

  async refreshAuthTokens() {
    try {
      this.logger.info('Attempting to refresh ChatGPT auth tokens');

      const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
      if (tabs.length === 0) {
        throw new Error('No ChatGPT tab found for token refresh');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const token = localStorage.getItem('accessToken') ||
                       sessionStorage.getItem('accessToken');

          const headers = {};
          const chatgptHeaders = Object.keys(localStorage)
            .filter(key => key.startsWith('chatgpt-'))
            .reduce((acc, key) => {
              acc[key] = localStorage.getItem(key);
              return acc;
            }, {});

          return { token, headers: chatgptHeaders };
        }
      });

      const { token, headers } = results?.[0]?.result || {};
      if (token) {
        this.authStore.setPrimary(token);
      }
      if (Object.keys(headers).length > 0) {
        this.authStore.setMultiple(headers);
      }

      this.logger.info('Auth tokens refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to refresh auth tokens:', error);
      return false;
    }
  }
}