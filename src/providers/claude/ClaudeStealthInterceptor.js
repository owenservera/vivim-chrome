import { Logger } from '../../core/logging/Logger.js';

export class ClaudeStealthInterceptor {
  constructor(authStore, config) {
    this.authStore = authStore;
    this.config = config;
    this.logger = new Logger('ClaudeStealthInterceptor');
    this.interceptPatterns = {
      request: /\/v1\/messages(\?|$)/
    };
  }

  processRequest(ctx) {
    if (ctx.headers['Cookie'] || ctx.headers['cookie']) {
      const cookies = ctx.headers['Cookie'] || ctx.headers['cookie'];
      const sessionMatch = cookies.match(/sessionKey=([^;]+)/);
      if (sessionMatch) {
        this.authStore.setPrimary(sessionMatch[1]);
        this.persistSecureAuth();
      }
    }

    const apiKey = ctx.headers['x-api-key'] || ctx.headers['X-API-Key'];
    if (apiKey) {
      this.authStore.setApiKey(apiKey);
      this.persistSecureAuth();
    }
  }

  handleUserPrompt(ctx, onUserPrompt) {
    const pattern = this.interceptPatterns?.request;
    const isMessageEndpoint = this.matchesPattern(ctx.url, pattern);

    if (!isMessageEndpoint || !ctx.body) {
      return;
    }

    try {
      const bodyStr = typeof ctx.body === 'string' ? ctx.body : new TextDecoder().decode(ctx.body);
      const payload = JSON.parse(bodyStr);

      if (payload.prompt || payload.message) {
        const content = payload.prompt || payload.message;
        if (content && onUserPrompt) {
          onUserPrompt({
            content,
            sessionId: payload.conversationId || null
          });
        }
      }

      if (payload.messages && Array.isArray(payload.messages)) {
        const userMessages = payload.messages.filter(m => m.role === 'user');
        const userMessage = userMessages[userMessages.length - 1];

        if (userMessage && onUserPrompt) {
          let content = '';
          if (typeof userMessage.content === 'string') {
            content = userMessage.content;
          } else if (userMessage.content && Array.isArray(userMessage.content)) {
            content = userMessage.content
              .filter(c => typeof c === 'string' || c.type === 'text')
              .map(c => typeof c === 'string' ? c : c.text)
              .join('\n');
          }

          if (content) {
            onUserPrompt({
              content,
              sessionId: payload.conversationId || null
            });
          }
        }
      }
    } catch (e) {
      this.logger.warn('Failed to parse request body:', e.message);
    }
  }

  matchesPattern(url, pattern) {
    if (!pattern || !url) return false;
    if (pattern instanceof RegExp) {
      return pattern.test(url);
    }
    if (typeof pattern === 'string') {
      return url.includes(pattern);
    }
    return false;
  }

  async persistSecureAuth() {
    try {
      await chrome.storage.local.set({
        claude_auth: this.authStore.getLatest()
      });
    } catch (e) {
      this.logger.warn('Failed to persist auth:', e.message);
    }
  }
}

export default ClaudeStealthInterceptor;