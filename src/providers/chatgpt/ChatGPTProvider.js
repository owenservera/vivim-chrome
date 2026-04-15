import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { StreamingManager } from '../../core/streaming/StreamingManager.js';

/**
 * ChatGPT-specific authentication store
 */
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

/**
 * ChatGPT request/response interceptor
 */
export class ChatGPTInterceptor {
  constructor(authStore) {
    this.authStore = authStore;
    this.logger = console;
  }

  onRequest(ctx) {
    console.log('[ChatGPT] onRequest called:', ctx.url, ctx.method);

    // Extract authorization header
    const auth = ctx.headers["Authorization"] || ctx.headers["authorization"];
    if (auth) {
      this.authStore.setAuthData(auth);
    }

    // Extract extra headers (prefixed with chatgpt-)
    const extras = {};
    for (const [k, v] of Object.entries(ctx.headers)) {
      const lower = k.toLowerCase();
      if (lower.startsWith("chatgpt-")) {
        extras[k] = v;
      }
    }
    if (Object.keys(extras).length > 0) {
      this.authStore.setExtraHeaders(extras);
    }

    // Handle user prompt intercept
    this.handleUserPrompt(ctx);
  }

  handleUserPrompt(ctx) {
    const isConversationEndpoint = ctx.url?.match(/\/backend-api(\/f)?\/conversation(\?|$)/);
    if (isConversationEndpoint && ctx.body) {
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

            if (content) {
              // Send to bridge (will be injected by provider)
              if (window.__VIVIM_BRIDGE) {
                this.logger.log("[ChatGPT] Sending userPrompt to bridge", {
                  contentLength: content.length,
                  conversationId: payload.conversation_id
                });

                window.__VIVIM_BRIDGE.send("userPrompt", {
                  role: "user",
                  content: content,
                  conversationId: payload.conversation_id || null
                });
              }
            }
          }
        }
      } catch (e) {
        this.logger.warn("[ChatGPT] Failed to parse request body:", e);
      }
    }
  }

  async onResponse(ctx) {
    const isStreamingEndpoint = ctx.url?.match(/\/backend-api(\/f)?\/conversation(\?|$)/);

    if (isStreamingEndpoint) {
      this.logger.log("[ChatGPT] Intercepted streaming response");

      // Use centralized streaming manager
      if (!this.streamingManager) {
        this.streamingManager = new StreamingManager(window.__VIVIM_BRIDGE);
      }

      const streamId = "chatgpt_" + Date.now() + "_" + Math.floor(Math.random()*1000);

      await this.streamingManager.processStream({
        streamId,
        response: ctx.response,
        format: 'delta-encoding-v1',
        metadata: {
          provider: 'chatgpt',
          model: 'unknown' // Will be updated by parser
        }
      });
    }
  }


}

/**
 * ChatGPT Provider implementation
 */
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
      }
    });

    this.authStore = new ChatGPTAuthStore();
    this.interceptor = new ChatGPTInterceptor(this.authStore);
  }

  matchRequest(ctx) {
    return ctx.url?.includes("/backend-api/");
  }

  onRequest(ctx) {
    return this.interceptor.onRequest(ctx);
  }

  matchResponse(ctx) {
    const isStreamingEndpoint = ctx.url?.match(/\/backend-api(\/f)?\/conversation(\?|$)/);
    return !!isStreamingEndpoint;
  }

  async onResponse(ctx) {
    const isStreamingEndpoint = ctx.url?.match(/\/backend-api(\/f)?\/conversation(\?|$)/);

    if (isStreamingEndpoint) {
      this.logger.log("[ChatGPT] Intercepted streaming response");

      // Use centralized streaming manager
      if (!this.streamingManager) {
        this.streamingManager = new StreamingManager(window.__VIVIM_BRIDGE);
      }

      const streamId = "chatgpt_" + Date.now() + "_" + Math.floor(Math.random()*1000);

      await this.streamingManager.processStream({
        streamId,
        response: ctx.response,
        format: 'delta-encoding-v1',
        metadata: {
          provider: 'chatgpt',
          model: 'unknown' // Will be updated by parser
        }
      });
    }
  }

  // Register auth handler with bridge when available
  registerAuthHandler() {
    if (window.__VIVIM_BRIDGE && window.__VIVIM_BRIDGE_AUTH_HANDLERS) {
      window.__VIVIM_BRIDGE.handle("getChatGPTAuthHeader", () => this.authStore.getLatest());
      window.__VIVIM_BRIDGE_AUTH_HANDLERS.set('chatgpt', this);
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