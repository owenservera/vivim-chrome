import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { StreamingManager } from '../../core/streaming/StreamingManager.js';
import { Logger } from '../../core/logging/Logger.js';
import { SecurityManager } from '../../core/security/SecurityManager.js';
import { SecureStorage } from '../../core/security/SecureStorage.js';

export class GeminiAuthStore {
  constructor() {
    this.psid = null;
    this.psidts = null;
    this.snlm0e = null;
    this.updatedAt = null;
  }

  setTokens({ psid, psidts, snlm0e }) {
    if (psid) this.psid = psid;
    if (psidts) this.psidts = psidts;
    if (snlm0e) this.snlm0e = snlm0e;
    this.updatedAt = Date.now();
  }

  getLatest() {
    return {
      psid: this.psid,
      psidts: this.psidts,
      snlm0e: this.snlm0e,
      updatedAt: this.updatedAt
    };
  }
}

export class GeminiProvider extends BaseProvider {
  constructor() {
    super({
      id: 'gemini',
      name: 'Gemini',
      hosts: ['gemini.google.com', 'generativelanguage.googleapis.com'],
      capabilities: {
        supportsStreaming: true,
        supportsAuth: true,
        messageFormat: 'google'
      },
      interceptPatterns: {
        request: /\/generateContent\?/
      },
      stealth: {
        enabled: true,
        preferContentScript: true,
        contentScriptHosts: ['gemini.google.com']
      }
    });

    this.authStore = new GeminiAuthStore();
    this.streamingManager = null;
    this.logger = new Logger('GeminiProvider');
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
      this.logger.info('Security features initialized for Gemini provider');
    } catch (error) {
      this.logger.warn('Failed to initialize security features:', error);
    }
  }

  /**
   * Load secure authentication data
   */
  async loadSecureAuthData() {
    try {
      const secureAuth = await this.secureStorage.retrieve('gemini_auth');
      if (secureAuth) {
        this.authStore.setTokens(secureAuth);
        this.logger.info('Loaded secure auth data for Gemini');
      }
    } catch (error) {
      this.logger.warn('Failed to load secure auth data:', error);
    }
  }

  matchRequest(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return ctx.url?.includes('gemini.google.com') && ctx.method === 'POST';
    return this.matchesPattern(ctx.url, pattern);
  }

  onRequest(ctx) {
    this.logger.debug('onRequest called:', ctx.url);

    // Extract auth tokens from request
    this.extractAuthFromRequest(ctx);

    // Extract user message from request body
    if (ctx.body) {
      try {
        const bodyStr = typeof ctx.body === 'string' ? ctx.body : new TextDecoder().decode(ctx.body);
        const payload = JSON.parse(bodyStr);

        // Extract message content from Gemini request format
        if (payload.contents && Array.isArray(payload.contents)) {
          const userContent = payload.contents
            .filter(content => content.role === 'user')
            .map(content => {
              if (content.parts && Array.isArray(content.parts)) {
                return content.parts
                  .filter(part => part.text)
                  .map(part => part.text)
                  .join(' ');
              }
              return '';
            })
            .join('\n');

          if (userContent) {
            this.logger.info(`Extracted Gemini user prompt (${userContent.length} chars)`);

            this.sendToBridge('userPrompt', {
              role: 'user',
              content: userContent,
              conversationId: payload.conversationId || null
            });
          }
        }
      } catch (e) {
        this.logger.warn('Failed to parse Gemini request body:', e.message);
      }
    }
  }

  extractAuthFromRequest(ctx) {
    let authUpdated = false;

    // Extract PSID and PSIDTS from cookies
    const cookies = ctx.headers['Cookie'] || ctx.headers['cookie'];
    if (cookies) {
      const psidMatch = cookies.match(/__Secure-1PSID=([^;]+)/);
      const psidtsMatch = cookies.match(/__Secure-1PSIDTS=([^;]+)/);

      if (psidMatch || psidtsMatch) {
        this.authStore.setTokens({
          psid: psidMatch?.[1],
          psidts: psidtsMatch?.[1]
        });
        authUpdated = true;
      }
    }

    // Extract SNlM0e from request body or query params
    if (ctx.body) {
      try {
        const bodyStr = typeof ctx.body === 'string' ? ctx.body : new TextDecoder().decode(ctx.body);
        const snlm0eMatch = bodyStr.match(/"SNlM0e":"([^"]+)"/) || bodyStr.match(/SNlM0e=([^&]+)/);
        if (snlm0eMatch) {
          this.authStore.setTokens({ snlm0e: snlm0eMatch[1] });
          authUpdated = true;
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }

    // Store securely if auth data was updated
    if (authUpdated) {
      this.storeSecureAuthData();
    }
  }

  /**
   * Securely store authentication data
   */
  async storeSecureAuthData() {
    if (!this.secureStorage) return;

    try {
      const authData = this.authStore.getLatest();
      await this.secureStorage.store('gemini_auth', {
        psid: authData.psid,
        psidts: authData.psidts,
        snlm0e: authData.snlm0e
      }, {
        provider: 'gemini',
        storedBy: 'auth_interception'
      });

      this.logger.info('Securely stored Gemini auth data');
    } catch (error) {
      this.logger.warn('Failed to store secure auth data:', error);
    }
  }

  matchResponse(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return false;
    return this.matchesPattern(ctx.url, pattern);
  }

  async onResponse(ctx) {
    this.logger.info('Intercepted Gemini streaming response');

    if (!this.streamingManager) {
      this.streamingManager = new StreamingManager({
        send: (action, data) => this.sendToBridge(action, data)
      });
    }

    const streamId = 'gemini_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    try {
      await this.streamingManager.processStream({
        streamId,
        response: ctx.response,
        format: 'gemini-sse',
        metadata: {
          provider: 'gemini',
          model: 'gemini-pro'
        }
      });
    } catch (e) {
      this.logger.error('Gemini streaming error:', e);

      // Attempt error recovery
      try {
        await this.handleProviderError(e, async () => {
          return await this.streamingManager.processStream({
            streamId: streamId + '_retry',
            response: ctx.response,
            format: 'gemini-sse',
            metadata: {
              provider: 'gemini',
              model: 'gemini-pro'
            }
          });
        });
      } catch (recoveryError) {
        this.logger.error('Gemini error recovery failed:', recoveryError);
        this.sendToBridge('streamComplete', { streamId, error: recoveryError.message });
      }
    }
  }

  getAuthHeaders() {
    const auth = this.authStore.getLatest();
    const headers = {};

    if (auth.psid) {
      headers['Cookie'] = `__Secure-1PSID=${auth.psid}`;
      if (auth.psidts) {
        headers['Cookie'] += `; __Secure-1PSIDTS=${auth.psidts}`;
      }
    }

    if (auth.snlm0e) {
      headers['X-SNlM0e'] = auth.snlm0e;
    }

    return headers;
  }

  /**
   * Extract Gemini auth tokens from browser
   */
  async extractAuthTokens() {
    try {
      const tabs = await chrome.tabs.query({ url: "https://gemini.google.com/*" });
      if (tabs.length === 0) return null;

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const tokens = {};

          // Extract cookies
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === '__Secure-1PSID') {
              tokens.psid = value;
            } else if (name === '__Secure-1PSIDTS') {
              tokens.psidts = value;
            }
          }

          // Extract SNlM0e from page content
          const match = document.body.innerHTML.match(/"SNlM0e":"([^"]+)"/);
          if (match) {
            tokens.snlm0e = match[1];
          }

          return tokens;
        }
      });

      const tokens = results?.[0]?.result;
      if (tokens && (tokens.psid || tokens.snlm0e)) {
        this.authStore.setTokens(tokens);
        return tokens;
      }

      return null;
    } catch (error) {
      this.logger.warn('Failed to extract Gemini auth tokens:', error);
      return null;
    }
  }

  /**
   * Check if error requires token refresh
   */
  isAuthError(error) {
    return error?.status === 401 ||
           error?.status === 403 ||
           error?.message?.includes('auth') ||
           error?.message?.includes('unauthorized') ||
           error?.message?.includes('token');
  }

  /**
   * Check if error is rate limit
   */
  isRateLimitError(error) {
    return error?.status === 429 ||
           error?.message?.includes('rate limit') ||
           error?.message?.includes('quota exceeded');
  }

  /**
   * Attempt to refresh Gemini auth tokens
   */
  async refreshAuthTokens() {
    try {
      this.logger.info('Attempting to refresh Gemini auth tokens');
      const tokens = await this.extractAuthTokens();
      if (tokens) {
        this.authStore.setTokens(tokens);
        this.logger.info('Gemini auth tokens refreshed successfully');
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Failed to refresh Gemini auth tokens:', error);
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