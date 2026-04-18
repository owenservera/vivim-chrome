import { Logger } from '../../core/logging/Logger.js';

export class GeminiStealthInterceptor {
  constructor(authStore, config) {
    this.authStore = authStore;
    this.config = config;
    this.logger = new Logger('GeminiStealthInterceptor');
    this.interceptPatterns = {
      request: /\/(?:generateContent|streamGenerateContent)\?/
    };
  }

  processRequest(ctx) {
    const cookies = ctx.headers['Cookie'] || ctx.headers['cookie'];
    if (cookies) {
      const psidMatch = cookies.match(/__Secure-1PSID=([^;]+)/);
      const psidtsMatch = cookies.match(/__Secure-1PSIDTS=([^;]+)/);

      if (psidMatch || psidtsMatch) {
        this.authStore.setTokens({
          psid: psidMatch?.[1],
          psidts: psidtsMatch?.[1]
        });
      }
    }

    if (ctx.body) {
      try {
        const bodyStr = typeof ctx.body === 'string' ? ctx.body : new TextDecoder().decode(ctx.body);
        const snlm0eMatch = bodyStr.match(/"SNlM0e":"([^"]+)"/) || bodyStr.match(/SNlM0e=([^&]+)/);
        if (snlm0eMatch) {
          this.authStore.setTokens({ snlm0e: snlm0eMatch[1] });
        }
      } catch (e) {}
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

      if (payload.contents && Array.isArray(payload.contents)) {
        const userContents = payload.contents.filter(content => content.role === 'user').slice(-1);

        if (userContents.length > 0) {
          const userContentObj = userContents[0];
          const userContent = this.extractTextFromParts(userContentObj.parts || []);

          if (userContent && onUserPrompt) {
            onUserPrompt({
              content: userContent,
              conversationId: payload.conversationId || null
            });
          }
        }
      }
    } catch (e) {
      this.logger.warn('Failed to parse request body:', e.message);
    }
  }

  extractTextFromParts(parts) {
    if (!Array.isArray(parts)) return '';
    return parts
      .filter(part => typeof part.text === 'string')
      .map(part => part.text)
      .join(' ')
      .trim();
  }

  matchesPattern(url, pattern) {
    if (!pattern || !url) return false;
    if (pattern instanceof RegExp) return pattern.test(url);
    if (typeof pattern === 'string') return url.includes(pattern);
    return false;
  }

  async saveAuth() {
    try {
      await chrome.storage.local.set({
        gemini_auth: this.authStore.getLatest()
      });
    } catch (e) {
      this.logger.warn('Failed to persist auth:', e.message);
    }
  }
}

export default GeminiStealthInterceptor;