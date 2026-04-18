import { Logger } from '../../core/logging/Logger.js';

export class ChatGPTStealthInterceptor {
  constructor(authStore, config) {
    this.authStore = authStore;
    this.config = config;
    this.logger = new Logger('ChatGPTStealthInterceptor');
    this.interceptPatterns = {
      request: /\/backend-api(\/f)?\/conversation(\?|$)/
    };
  }

  processRequest(ctx) {
    const auth = ctx.headers['Authorization'] || ctx.headers['authorization'];
    if (auth) {
      this.authStore.setPrimary(auth);
      this.persistSecureAuth();
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
      this.persistSecureAuth();
    }
  }

  handleUserPrompt(ctx, onUserPrompt) {
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

          if (content && onUserPrompt) {
            onUserPrompt({
              content,
              conversationId: payload.conversation_id || null
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
        chatgpt_auth: this.authStore.getLatest()
      });
    } catch (e) {
      this.logger.warn('Failed to persist auth:', e.message);
    }
  }
}

export default ChatGPTStealthInterceptor;