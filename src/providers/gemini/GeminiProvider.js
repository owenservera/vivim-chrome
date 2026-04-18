import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { Logger } from '../../core/logging/Logger.js';
import { GeminiAuthStore } from './GeminiAuthStore.js';
import { GeminiStealthInterceptor } from './GeminiStealthInterceptor.js';
import { GeminiResponseParser } from './GeminiResponseParser.js';

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
        request: /\/(?:generateContent|streamGenerateContent)\?/
      },
      stealth: {
        enabled: true,
        preferContentScript: true,
        contentScriptHosts: ['gemini.google.com']
      },
      storageKey: 'gemini_auth',
      maxRetries: 3,
      baseRetryDelay: 1000
    });

    this.logger = new Logger('GeminiProvider');
    this.authStore = new GeminiAuthStore();
    this.interceptor = new GeminiStealthInterceptor(this.authStore, this.config);
    this.responseParser = null;
  }

  onAuthDataLoaded(secureAuth) {
    if (secureAuth.psid) {
      this.authStore.setTokens({ psid: secureAuth.psid });
    }
    if (secureAuth.psidts) {
      this.authStore.setTokens({ psidts: secureAuth.psidts });
    }
    if (secureAuth.snlm0e) {
      this.authStore.setTokens({ snlm0e: secureAuth.snlm0e });
    }
  }

  matchRequest(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return ctx.url?.includes('gemini.google.com') && ctx.method === 'POST';
    return this.matchesPattern(ctx.url, pattern);
  }

  onRequest(ctx) {
    this.logger.debug('onRequest called:', ctx.url);

    if (window.dataFeedManager?.isEnabled()) {
      window.dataFeedManager.emit('provider:request', {
        provider: 'gemini',
        url: ctx.url,
        method: ctx.method,
        headers: ctx.headers,
        bodySize: ctx.body ? (typeof ctx.body === 'string' ? ctx.body.length : ctx.body.byteLength) : 0
      });
    }

    this.interceptor.processRequest(ctx);
    this.interceptor.saveAuth();
    this.interceptor.handleUserPrompt(ctx, (userPrompt) => {
      this.logger.info(`Extracted Gemini user prompt (${userPrompt.content.length} chars)`);

      if (window.dataFeedManager?.isEnabled()) {
        window.dataFeedManager.emit('message:sent', {
          provider: 'gemini',
          role: 'user',
          content: userPrompt.content,
          conversationId: userPrompt.conversationId,
          messageLength: userPrompt.content.length
        });
      }

      this.sendToBridge('userPrompt', {
        role: 'user',
        content: userPrompt.content,
        conversationId: userPrompt.conversationId
      });
    });
  }

  matchResponse(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return false;
    return this.matchesPattern(ctx.url, pattern);
  }

  async onResponse(ctx) {
    this.logger.info(`Intercepted Gemini response: ${ctx.url}`);

    if (window.dataFeedManager?.isEnabled()) {
      window.dataFeedManager.emit('provider:response', {
        provider: 'gemini',
        url: ctx.url,
        responseStatus: ctx.response.status,
        responseHeaders: Object.fromEntries(ctx.response.headers.entries()),
        contentType: ctx.response.headers.get('content-type')
      });
    }

    if (!this.responseParser) {
      this.responseParser = new GeminiResponseParser({
        send: (action, data) => {
          this.logger.debug(`Sending bridge action: ${action}`, data);
          this.sendToBridge(action, data);
        },
        dataFeedManager: window.dataFeedManager
      });
    }

    const streamId = 'gemini_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const format = 'gemini-sse';

    this.logger.info(`Starting stream processing. ID: ${streamId}, Format: ${format}`);

    try {
      await this.responseParser.process({
        streamId,
        response: ctx.response,
        format,
        metadata: {
          provider: 'gemini',
          model: this.extractModelFromUrl(ctx.url) || 'gemini-pro'
        }
      });
      this.logger.info(`Stream processing completed: ${streamId}`);
    } catch (e) {
      this.logger.error(`Streaming error for ${streamId}:`, e);

      try {
        this.logger.info(`Attempting error recovery for ${streamId}`);
        await this.handleProviderError(e, async () => {
          return await this.responseParser.process({
            streamId: streamId + '_retry',
            response: ctx.response,
            format,
            metadata: {
              provider: 'gemini',
              model: this.extractModelFromUrl(ctx.url) || 'gemini-pro'
            }
          });
        }, () => this.refreshAuthTokens());
      } catch (recoveryError) {
        this.logger.error(`Error recovery failed for ${streamId}:`, recoveryError);
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

  async refreshAuthTokens() {
    try {
      this.logger.info('Attempting to refresh Gemini auth tokens');

      const tabs = await chrome.tabs.query({ url: "https://gemini.google.com/*" });
      if (tabs.length === 0) {
        throw new Error('No Gemini tab found for token refresh');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const tokens = {};
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === '__Secure-1PSID') tokens.psid = value;
            else if (name === '__Secure-1PSIDTS') tokens.psidts = value;
          }
          const match = document.body.innerHTML.match(/"SNlM0e":"([^"]+)"/);
          if (match) tokens.snlm0e = match[1];
          return tokens;
        }
      });

      const tokens = results?.[0]?.result;
      if (tokens) {
        this.authStore.setTokens(tokens);
      }

      this.logger.info('Auth tokens refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to refresh auth tokens:', error);
      return false;
    }
  }

  extractModelFromUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const modelsIndex = pathParts.indexOf('models');
      if (modelsIndex !== -1 && modelsIndex < pathParts.length - 1) {
        return pathParts[modelsIndex + 1];
      }
    } catch (e) {}
    return null;
  }
}

export default GeminiProvider;