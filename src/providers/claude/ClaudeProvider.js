import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { createProviderMixin } from '../../core/providers/ProviderMixin.js';
import { createAuthStore } from '../../core/providers/AuthStore.js';
import { StreamingManager } from '../../core/streaming/StreamingManager.js';
import { Logger } from '../../core/logging/Logger.js';

const ClaudeAuthStore = createAuthStore('sessionKey');

const MixinProvider = createProviderMixin(BaseProvider);

export class ClaudeProvider extends MixinProvider {
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
      },
      storageKey: 'claude_auth',
      maxRetries: 3,
      baseRetryDelay: 1000
    });

    this.authStore = new ClaudeAuthStore();
    this.streamingManager = null;
    this.logger = new Logger('ClaudeProvider');
  }

  onAuthDataLoaded(secureAuth) {
    this.authStore.setPrimary(secureAuth.sessionKey);
  }

  matchRequest(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return ctx.url?.includes('claude.ai') && ctx.method === 'POST';
    return this.matchesPattern(ctx.url, pattern);
  }

  onRequest(ctx) {
    this.logger.debug('onRequest called:', ctx.url);

    if (ctx.headers['Cookie'] || ctx.headers['cookie']) {
      const cookies = ctx.headers['Cookie'] || ctx.headers['cookie'];
      const sessionMatch = cookies.match(/sessionKey=([^;]+)/);
      if (sessionMatch) {
        this.authStore.setPrimary(sessionMatch[1]);
        this.storeSecureAuthData(this.authStore.getLatest());
      }
    }

    if (ctx.body) {
      try {
        const bodyStr = typeof ctx.body === 'string' ? ctx.body : new TextDecoder().decode(ctx.body);
        const payload = JSON.parse(bodyStr);

        if (payload.sessionKey) {
          this.authStore.setPrimary(payload.sessionKey);
        }

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
      }, {
        dataFeedManager: window.dataFeedManager
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
        }, () => this.refreshSessionKey());
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

  async extractSessionKey() {
    try {
      const tabs = await chrome.tabs.query({ url: "https://claude.ai/*" });
      if (tabs.length === 0) return null;

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const cookies = document.cookie;
          const sessionMatch = cookies.match(/sessionKey=([^;]+)/);
          if (sessionMatch) return sessionMatch[1];

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

  async refreshSessionKey() {
    try {
      this.logger.info('Attempting to refresh Claude session key');
      const sessionKey = await this.extractSessionKey();
      if (sessionKey) {
        this.authStore.setPrimary(sessionKey);
        this.logger.info('Claude session key refreshed successfully');
        return true;
      }
      return false;
    } catch (error) {
      this.logger.error('Failed to refresh Claude session key:', error);
      return false;
    }
  }
}