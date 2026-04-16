import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { StreamingManager } from '../../core/streaming/StreamingManager.js';
import { Logger } from '../../core/logging/Logger.js';
import { SecurityManager } from '../../core/security/SecurityManager.js';
import { SecureStorage } from '../../core/security/SecureStorage.js';

export class ClaudeAuthStore {
  constructor() {
    this.sessionKey = null;
    this.updatedAt = null;
  }

  setSessionKey(key) {
    if (key) {
      this.sessionKey = key;
      this.updatedAt = Date.now();
    }
  }

  getLatest() {
    return {
      sessionKey: this.sessionKey,
      updatedAt: this.updatedAt
    };
  }
}

export class ClaudeProvider extends BaseProvider {
  constructor() {
    super({
      id: 'claude',
      name: 'Claude',
      hosts: ['claude.ai', 'api.anthropic.com'],
      capabilities: {
        supportsStreaming: true,
        supportsAuth: true,
        messageFormat: 'anthropic'
      },
      interceptPatterns: {
        request: /\/api\/append_message/
      },
      stealth: {
        enabled: true,
        preferContentScript: true,
        contentScriptHosts: ['claude.ai']
      }
    });

    this.authStore = new ClaudeAuthStore();
    this.streamingManager = null;
    this.logger = new Logger('ClaudeProvider');
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
      this.logger.info('Security features initialized for Claude provider');
    } catch (error) {
      this.logger.warn('Failed to initialize security features:', error);
    }
  }

  /**
   * Load secure authentication data
   */
  async loadSecureAuthData() {
    try {
      const secureAuth = await this.secureStorage.retrieve('claude_auth');
      if (secureAuth) {
        this.authStore.setSessionKey(secureAuth.sessionKey);
        this.logger.info('Loaded secure auth data for Claude');
      }
    } catch (error) {
      this.logger.warn('Failed to load secure auth data:', error);
    }
  }

  matchRequest(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return ctx.url?.includes('claude.ai') && ctx.method === 'POST';
    return this.matchesPattern(ctx.url, pattern);
  }

  onRequest(ctx) {
    this.logger.debug('onRequest called:', ctx.url);

    // Extract session key from cookies or headers
    if (ctx.headers['Cookie'] || ctx.headers['cookie']) {
      const cookies = ctx.headers['Cookie'] || ctx.headers['cookie'];
      const sessionMatch = cookies.match(/sessionKey=([^;]+)/);
      if (sessionMatch) {
        this.authStore.setSessionKey(sessionMatch[1]);
        this.storeSecureAuthData();
      }
    }

    // Check for session key in request body
    if (ctx.body) {
      try {
        const bodyStr = typeof ctx.body === 'string' ? ctx.body : new TextDecoder().decode(ctx.body);
        const payload = JSON.parse(bodyStr);

        if (payload.sessionKey) {
          this.authStore.setSessionKey(payload.sessionKey);
        }

        // Extract user message
        if (payload.prompt || payload.message) {
          const content = payload.prompt || payload.message;
          this.logger.info(`Extracted Claude user prompt (${content.length} chars)`);

          this.sendToBridge('userPrompt', {
            role: 'user',
            content: content,
            conversationId: payload.conversationId || null
          });
        }
      } catch (e) {
        this.logger.warn('Failed to parse Claude request body:', e.message);
      }
    }
  }

  matchResponse(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return false;
    return this.matchesPattern(ctx.url, pattern);
  }

  async onResponse(ctx) {
    this.logger.info('Intercepted Claude streaming response');

    if (!this.streamingManager) {
      this.streamingManager = new StreamingManager({
        send: (action, data) => this.sendToBridge(action, data)
      });
    }

    const streamId = 'claude_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    try {
      await this.streamingManager.processStream({
        streamId,
        response: ctx.response,
        format: 'claude-sse',
        metadata: {
          provider: 'claude',
          model: 'claude-3'
        }
      });
    } catch (e) {
      this.logger.error('Claude streaming error:', e);

      // Attempt error recovery
      try {
        await this.handleProviderError(e, async () => {
          return await this.streamingManager.processStream({
            streamId: streamId + '_retry',
            response: ctx.response,
            format: 'claude-sse',
            metadata: {
              provider: 'claude',
              model: 'claude-3'
            }
          });
        });
      } catch (recoveryError) {
        this.logger.error('Claude error recovery failed:', recoveryError);
        this.sendToBridge('streamComplete', { streamId, error: recoveryError.message });
      }
    }
  }

  getAuthHeaders() {
    const auth = this.authStore.getLatest();
    const headers = {};

    if (auth.sessionKey) {
      headers['Cookie'] = `sessionKey=${auth.sessionKey}`;
      headers['X-Session-Key'] = auth.sessionKey;
    }

    return headers;
  }

  /**
   * Extract Claude session key from cookies
   */
  async extractSessionKey() {
    try {
      const tabs = await chrome.tabs.query({ url: "https://claude.ai/*" });
      if (tabs.length === 0) return null;

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          // Try to find session key in various places
          const cookies = document.cookie;
          const sessionMatch = cookies.match(/sessionKey=([^;]+)/);
          if (sessionMatch) return sessionMatch[1];

          // Check localStorage
          const sessionKey = localStorage.getItem('sessionKey');
          if (sessionKey) return sessionKey;

          return null;
        }
      });

      return results?.[0]?.result;
    } catch (error) {
      this.logger.warn('Failed to extract Claude session key:', error);
      return null;
    }
  }

  /**
   * Securely store authentication data
   */
  async storeSecureAuthData() {
    if (!this.secureStorage) return;

    try {
      const authData = this.authStore.getLatest();
      await this.secureStorage.store('claude_auth', {
        sessionKey: authData.sessionKey
      }, {
        provider: 'claude',
        storedBy: 'auth_interception'
      });

      this.logger.info('Securely stored Claude auth data');
    } catch (error) {
      this.logger.warn('Failed to store secure auth data:', error);
    }
  }

  /**
   * Check if error requires session key refresh
   */
  isAuthError(error) {
    return error?.status === 401 ||
           error?.status === 403 ||
           error?.message?.includes('auth') ||
           error?.message?.includes('session') ||
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
   * Attempt to refresh Claude session key
   */
  async refreshSessionKey() {
    try {
      this.logger.info('Attempting to refresh Claude session key');
      const sessionKey = await this.extractSessionKey();
      if (sessionKey) {
        this.authStore.setSessionKey(sessionKey);
        this.logger.info('Claude session key refreshed successfully');
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Failed to refresh Claude session key:', error);
      return false;
    }
  }

  /**
   * Handle provider errors with recovery logic
   */
  async handleProviderError(error, retryCallback) {
    if (this.isAuthError(error)) {
      const refreshed = await this.refreshSessionKey();
      if (refreshed && retryCallback) {
        return await this.retryWithBackoff(retryCallback);
      }
    } else if (this.isRateLimitError(error)) {
      await this.delay(this.baseRetryDelay * 5);
      if (retryCallback) {
        return await this.retryWithBackoff(retryCallback);
      }
    } else if (this.isRecoverableError(error)) {
      if (retryCallback) {
        return await this.retryWithBackoff(retryCallback);
      }
    }

    throw error;
  }

  /**
   * Check if error is recoverable
   */
  isRecoverableError(error) {
    const recoverableStatuses = [408, 500, 502, 503, 504];
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