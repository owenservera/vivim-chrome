import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { StreamingManager } from '../../core/streaming/StreamingManager.js';
import { Logger } from '../../core/logging/Logger.js';
import { SecurityManager } from '../../core/security/SecurityManager.js';
import { SecureStorage } from '../../core/security/SecureStorage.js';

export class ChatGPTAuthStore {
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

export class ChatGPTProvider extends BaseProvider {
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
      }
    });

    this.authStore = new ChatGPTAuthStore();
    this.streamingManager = null;
    this.logger = new Logger('ChatGPTProvider');
    this.retryAttempts = 0;
    this.maxRetries = 3;
    this.baseRetryDelay = 1000;
    this.securityManager = null;
    this.secureStorage = null;

    this.initializeSecurity();
  }

  /**
   * Initialize security features
   */
  async initializeSecurity() {
    try {
      const storageMgr = typeof window !== 'undefined' ? window.storageManager : null;
      if (!storageMgr) {
        this.logger.warn('StorageManager not available, skipping security init');
        return;
      }
      this.securityManager = new SecurityManager(storageMgr);
      this.secureStorage = new SecureStorage(storageMgr);
      await this.securityManager.init();
      await this.secureStorage.init();
      await this.loadSecureAuthData();
      this.logger.info('Security features initialized for ChatGPT provider');
    } catch (error) {
      this.logger.warn('Failed to initialize security features:', error);
    }
  }

  /**
   * Load secure authentication data
   */
  async loadSecureAuthData() {
    try {
      const secureAuth = await this.secureStorage.retrieve('chatgpt_auth');
      if (secureAuth) {
        this.authStore.setAuthData(secureAuth.authorization);
        if (secureAuth.extraHeaders) {
          this.authStore.setExtraHeaders(secureAuth.extraHeaders);
        }
        this.logger.info('Loaded secure auth data for ChatGPT');
      }
    } catch (error) {
      this.logger.warn('Failed to load secure auth data:', error);
    }
  }

  matchRequest(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return ctx.url?.includes('/backend-api/');
    return this.matchesPattern(ctx.url, pattern);
  }

  onRequest(ctx) {
    this.logger.debug('onRequest called:', ctx.url);

    const auth = ctx.headers['Authorization'] || ctx.headers['authorization'];
    if (auth) {
      this.authStore.setAuthData(auth);
      // Securely store auth data
      this.storeSecureAuthData();
    }

    const extras = {};
    for (const [k, v] of Object.entries(ctx.headers)) {
      const lower = k.toLowerCase();
      if (lower.startsWith('chatgpt-')) {
        extras[k] = v;
      }
    }
    if (Object.keys(extras).length > 0) {
      this.authStore.setExtraHeaders(extras);
      // Update secure storage with new headers
      this.storeSecureAuthData();
    }

    this.handleUserPrompt(ctx);
  }

  /**
   * Securely store authentication data
   */
  async storeSecureAuthData() {
    if (!this.secureStorage) return;

    try {
      const authData = this.authStore.getLatest();
      await this.secureStorage.store('chatgpt_auth', {
        authorization: authData.authorization,
        extraHeaders: authData.extraHeaders
      }, {
        provider: 'chatgpt',
        storedBy: 'auth_interception'
      });

      this.logger.info('Securely stored ChatGPT auth data');
    } catch (error) {
      this.logger.warn('Failed to store secure auth data:', error);
    }
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

    if (!this.streamingManager) {
      this.streamingManager = new StreamingManager({
        send: (action, data) => this.sendToBridge(action, data)
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

      // Attempt error recovery
      try {
        await this.handleProviderError(e, async () => {
          // Retry the streaming operation
          return await this.streamingManager.processStream({
            streamId: streamId + '_retry',
            response: ctx.response,
            format: 'openai-sse',
            metadata: {
              provider: 'chatgpt',
              model: 'unknown'
            }
          });
        });
      } catch (recoveryError) {
        this.logger.error('Error recovery failed:', recoveryError);
        // Send error to UI
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

  /**
   * Check if error requires token refresh
   */
  isAuthError(error) {
    return error?.status === 401 ||
           error?.status === 403 ||
           error?.message?.includes('auth') ||
           error?.message?.includes('unauthorized');
  }

  /**
   * Check if error is rate limit
   */
  isRateLimitError(error) {
    return error?.status === 429 ||
           error?.message?.includes('rate limit') ||
           error?.message?.includes('too many requests');
  }

  /**
   * Attempt to refresh auth tokens
   */
  async refreshAuthTokens() {
    try {
      this.logger.info('Attempting to refresh ChatGPT auth tokens');

      // Get current tab and extract fresh tokens
      const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
      if (tabs.length === 0) {
        throw new Error('No ChatGPT tab found for token refresh');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          // Extract auth token from localStorage or cookies
          const token = localStorage.getItem('accessToken') ||
                       sessionStorage.getItem('accessToken');

          // Extract additional headers if available
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
        this.authStore.setAuthData(token);
      }
      if (Object.keys(headers).length > 0) {
        this.authStore.setExtraHeaders(headers);
      }

      this.logger.info('Auth tokens refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to refresh auth tokens:', error);
      return false;
    }
  }

  /**
   * Handle provider errors with recovery logic
   */
  async handleProviderError(error, retryCallback) {
    if (this.isAuthError(error)) {
      const refreshed = await this.refreshAuthTokens();
      if (refreshed && retryCallback) {
        return await this.retryWithBackoff(retryCallback);
      }
    } else if (this.isRateLimitError(error)) {
      // Wait longer for rate limits
      await this.delay(this.baseRetryDelay * 5);
      if (retryCallback) {
        return await this.retryWithBackoff(retryCallback);
      }
    } else if (this.isRecoverableError(error)) {
      if (retryCallback) {
        return await this.retryWithBackoff(retryCallback);
      }
    }

    // If we reach here, error is not recoverable
    throw error;
  }

  /**
   * Check if error is recoverable
   */
  isRecoverableError(error) {
    const recoverableStatuses = [408, 500, 502, 503, 504]; // Timeout and server errors
    return recoverableStatuses.includes(error?.status) ||
           error?.name === 'NetworkError' ||
           error?.name === 'TimeoutError';
  }

  /**
   * Retry with exponential backoff
   */
  async retryWithBackoff(callback, attempt = 1) {
    if (attempt > this.maxRetries) {
      throw new Error(`Max retry attempts (${this.maxRetries}) exceeded`);
    }

    const delay = this.baseRetryDelay * Math.pow(2, attempt - 1);
    await this.delay(delay);

    try {
      return await callback();
    } catch (error) {
      this.logger.warn(`Retry attempt ${attempt} failed:`, error);
      return await this.retryWithBackoff(callback, attempt + 1);
    }
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
