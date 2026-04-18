import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { Logger } from '../../core/logging/Logger.js';
import { ClaudeAuthStore } from './ClaudeAuthStore.js';
import { ClaudeStealthInterceptor } from './ClaudeStealthInterceptor.js';
import { ClaudeResponseParser } from './ClaudeResponseParser.js';

export class ClaudeProvider extends BaseProvider {
  constructor() {
    super({
      id: 'claude',
      name: 'Claude',
      hosts: ['claude.ai'],
      capabilities: {
        supportsStreaming: true,
        supportsAuth: true,
        messageFormat: 'anthropic'
      },
      interceptPatterns: {
        request: /\/v1\/messages(\?|$)/
      },
      stealth: {
        enabled: true,
        preferContentScript: true,
        contentScriptHosts: ['claude.ai']
      },
      storageKey: 'claude_auth',
      maxRetries: 3,
      baseRetryDelay: 1000
    });

    this.logger = new Logger('ClaudeProvider');
    this.authStore = new ClaudeAuthStore();
    this.interceptor = new ClaudeStealthInterceptor(this.authStore, this.config);
    this.responseParser = null;
  }

  onAuthDataLoaded(secureAuth) {
    this.authStore.setPrimary(secureAuth.authorization);
    if (secureAuth.apiKey) {
      this.authStore.setApiKey(secureAuth.apiKey);
    }
  }

  matchRequest(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return ctx.url?.includes('/v1/messages');
    return this.matchesPattern(ctx.url, pattern);
  }

  onRequest(ctx) {
    this.logger.debug('onRequest called:', ctx.url);

    if (window.dataFeedManager?.isEnabled()) {
      window.dataFeedManager.emit('provider:request', {
        provider: 'claude',
        url: ctx.url,
        method: ctx.method,
        headers: ctx.headers,
        bodySize: ctx.body ? (typeof ctx.body === 'string' ? ctx.body.length : ctx.body.byteLength) : 0
      });
    }

    this.interceptor.processRequest(ctx);
    this.interceptor.handleUserPrompt(ctx, (userPrompt) => {
      this.logger.info(`Extracted user prompt (${userPrompt.content.length} chars)`);

      if (window.dataFeedManager?.isEnabled()) {
        window.dataFeedManager.emit('message:sent', {
          provider: 'claude',
          role: 'user',
          content: userPrompt.content,
          conversationId: userPrompt.sessionId,
          messageLength: userPrompt.content.length
        });
      }

      this.sendToBridge('userPrompt', {
        role: 'user',
        content: userPrompt.content,
        conversationId: userPrompt.sessionId
      });
    });
  }

  matchResponse(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return false;
    return this.matchesPattern(ctx.url, pattern);
  }

  async onResponse(ctx) {
    this.logger.info(`Intercepted Claude response: ${ctx.url}`);

    if (window.dataFeedManager?.isEnabled()) {
      window.dataFeedManager.emit('provider:response', {
        provider: 'claude',
        url: ctx.url,
        responseStatus: ctx.response.status,
        responseHeaders: Object.fromEntries(ctx.response.headers.entries()),
        contentType: ctx.response.headers.get('content-type')
      });
    }

    if (!this.responseParser) {
      this.responseParser = new ClaudeResponseParser({
        send: (action, data) => {
          this.logger.debug(`Sending bridge action: ${action}`, data);
          this.sendToBridge(action, data);
        },
        dataFeedManager: window.dataFeedManager
      });
    }

    const streamId = 'claude_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const format = 'claude-sse';

    this.logger.info(`Starting stream processing. ID: ${streamId}, Format: ${format}`);

    try {
      await this.responseParser.process({
        streamId,
        response: ctx.response,
        format,
        metadata: {
          provider: 'claude',
          model: 'unknown'
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
              provider: 'claude',
              model: 'unknown'
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
    return {
      'x-api-key': auth.apiKey || auth.authorization,
      'anthropic-version': '2023-06-01',
      ...auth.extraHeaders
    };
  }

  async refreshAuthTokens() {
    try {
      this.logger.info('Attempting to refresh Claude auth tokens');

      const tabs = await chrome.tabs.query({ url: "https://claude.ai/*" });
      if (tabs.length === 0) {
        throw new Error('No Claude tab found for token refresh');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const sessionToken = localStorage.getItem('sessionToken') ||
                           sessionStorage.getItem('sessionToken');
          const apiKey = localStorage.getItem('apiKey');

          return { sessionToken, apiKey };
        }
      });

      const { sessionToken, apiKey } = results?.[0]?.result || {};
      if (sessionToken) {
        this.authStore.setPrimary(sessionToken);
      }
      if (apiKey) {
        this.authStore.setApiKey(apiKey);
      }

      this.logger.info('Auth tokens refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to refresh auth tokens:', error);
      return false;
    }
  }
}

export default ClaudeProvider;