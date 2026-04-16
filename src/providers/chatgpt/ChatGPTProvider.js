import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { StreamingManager } from '../../core/streaming/StreamingManager.js';
import { Logger } from '../../core/logging/Logger.js';

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
      }
    });

    this.authStore = new ChatGPTAuthStore();
    this.streamingManager = null;
    this.logger = new Logger('ChatGPTProvider');
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
        format: 'delta-encoding-v1',
        metadata: {
          provider: 'chatgpt',
          model: 'unknown'
        }
      });
    } catch (e) {
      this.logger.error('Streaming error:', e);
    }
  }

  getAuthHeaders() {
    const auth = this.authStore.getLatest();
    return {
      'Authorization': auth.authorization,
      ...auth.extraHeaders
    };
  }
}
