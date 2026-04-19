/**
 * ChatGPT Provider Module
 * Complete interception and streaming implementation
 */

import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { Logger } from '../../core/logging/Logger.js';
import { ChatGPTAuthStore } from './ChatGPTAuthStore.js';
import { ChatGPTStealthInterceptor } from './ChatGPTStealthInterceptor.js';
import { StreamingManager } from '../../core/streaming/StreamingManager.js';
import { ChatGPTDataFeedStudy } from './ChatGPTDataFeedStudy.js';

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
      },
      stealth: {
        enabled: true,
        preferContentScript: true,
        contentScriptHosts: ['chatgpt.com', 'chat.com']
      },
      storageKey: 'chatgpt_auth',
      maxRetries: 3,
      baseRetryDelay: 1000
    });

    this.logger = new Logger('ChatGPTProvider');
    this.authStore = new ChatGPTAuthStore();
    this.interceptor = new ChatGPTStealthInterceptor(this.authStore, this.config);
    this.streamingManager = null;
    this.dataFeedStudy = new ChatGPTDataFeedStudy({ enabled: true });
  }

  onAuthDataLoaded(secureAuth) {
    this.authStore.setPrimary(secureAuth.authorization);
    if (secureAuth.extraHeaders) {
      this.authStore.setMultiple(secureAuth.extraHeaders);
    }
  }

  matchRequest(ctx) {
    const pattern = this.interceptPatterns?.request;
    if (!pattern) return ctx.url?.includes('/backend-api/');
    return this.matchesPattern(ctx.url, pattern);
  }

  onRequest(ctx) {
    this.logger.debug('onRequest called:', ctx.url);

    // Enhanced debug capture
    if (window.sidePanelController?.debugManager) {
      window.sidePanelController.debugManager.captureEvent('provider_request', {
        provider: 'chatgpt',
        url: ctx.url,
        method: ctx.method,
        hasBody: !!ctx.body,
        bodySize: ctx.body ? (typeof ctx.body === 'string' ? ctx.body.length : ctx.body.byteLength) : 0
      }, { category: 'connection' });
    }

    if (window.dataFeedManager?.isEnabled()) {
      window.dataFeedManager.emit('provider:request', {
        provider: 'chatgpt',
        url: ctx.url,
        method: ctx.method,
        headers: ctx.headers,
        bodySize: ctx.body ? (typeof ctx.body === 'string' ? ctx.body.length : ctx.body.byteLength) : 0
      });
    }

    this.interceptor.processRequest(ctx);
    this.interceptor.handleUserPrompt(ctx, (userPrompt) => {
      this.logger.info(`Extracted user prompt (${userPrompt.content.length} chars)`);

      // Capture user prompt event
      if (window.sidePanelController?.debugManager) {
        window.sidePanelController.debugManager.captureEvent('user_prompt_extracted', {
          contentLength: userPrompt.content.length,
          conversationId: userPrompt.conversationId,
          hasContent: !!userPrompt.content
        }, { category: 'message' });
      }

      if (window.dataFeedManager?.isEnabled()) {
        window.dataFeedManager.emit('message:sent', {
          provider: 'chatgpt',
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
    this.logger.info(`Intercepted ChatGPT response: ${ctx.url}`);

    const contentType = ctx.response.headers.get('content-type');
    const isStreamingResponse = contentType && contentType.includes('text/event-stream');

    if (!isStreamingResponse) {
      this.logger.info('Skipping non-streaming response. contentType=' + contentType);
      return;
    }

    if (!this.streamingManager) {
      this.logger.debug('Initializing StreamingManager');
      this.streamingManager = new StreamingManager({
        send: (action, data) => {
          this.logger.debug(`Sending bridge action: ${action}`, data);
          this.sendToBridge(action, data);
        }
      }, { dataFeedManager: window.dataFeedManager });
    }

    const streamId = 'chatgpt_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const format = 'delta-encoding-v1';

    try {
      await this.streamingManager.processStream({
        streamId,
        response: ctx.response,
        format,
        metadata: {
          provider: 'chatgpt',
          model: 'ChatGPT',
          dataFeedStudy: this.dataFeedStudy
        }
      });

      this.logger.info(`Stream processing completed: ${streamId}`);

      // Capture successful completion
      if (window.sidePanelController?.debugManager) {
        window.sidePanelController.debugManager.captureStreamEvent('completed', {
          success: true,
          streamId
        }, streamId);
      }

    } catch (e) {
      this.logger.error(`Streaming error for ${streamId}:`, e);

      // Capture streaming error
      if (window.sidePanelController?.debugManager) {
        window.sidePanelController.debugManager.captureError(e, {
          context: 'stream_processing',
          streamId,
          url: ctx.url,
          phase: 'initialization'
        });
      }

      this.dataFeedStudy.captureError(streamId, e, {
        url: ctx.url,
        phase: 'stream_initialization'
      });

      try {
        this.logger.info(`Attempting error recovery for ${streamId}`);

        // Capture retry attempt
        if (window.sidePanelController?.debugManager) {
          window.sidePanelController.debugManager.captureEvent('stream_retry', {
            streamId,
            attempt: 1,
            originalError: e.message
          }, { category: 'stream' });
        }

        await this.handleProviderError(e, async () => {
          return await this.streamingManager.processStream({
            streamId: streamId + '_retry',
            response: ctx.response,
            format,
            metadata: {
              provider: 'chatgpt',
              model: 'unknown',
              dataFeedStudy: this.dataFeedStudy
            }
          });
        }, () => this.refreshAuthTokens());
      } catch (recoveryError) {
        this.logger.error(`Error recovery failed for ${streamId}:`, recoveryError);

        // Capture recovery failure
        if (window.sidePanelController?.debugManager) {
          window.sidePanelController.debugManager.captureError(recoveryError, {
            context: 'stream_recovery',
            streamId,
            url: ctx.url,
            phase: 'recovery'
          });
        }

        this.dataFeedStudy.captureError(streamId, recoveryError, {
          url: ctx.url,
          phase: 'error_recovery'
        });
        this.sendToBridge('streamComplete', { streamId, error: recoveryError.message });
      }
    }
  }

  getAuthHeaders() {
    const auth = this.authStore.getLatest();
    return {
      'Authorization': auth.authorization,
      ...auth.extraHeaders
    };
  }

  async refreshAuthTokens() {
    try {
      this.logger.info('Attempting to refresh ChatGPT auth tokens');

      const tabs = await chrome.tabs.query({ url: "https://chatgpt.com/*" });
      if (tabs.length === 0) {
        throw new Error('No ChatGPT tab found for token refresh');
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: () => {
          const token = localStorage.getItem('accessToken') ||
                       sessionStorage.getItem('accessToken');

          const headers = {};
          const chatgptHeaders = Object.keys(localStorage)
            .filter(key => key.startsWith('chatgpt-'))
            .reduce((acc, key) => {
              acc[key] = localStorage.getItem(key);
              return acc;
            }, {});

          return { token, headers: chatgptHeaders };
        }
      });

      const { token, headers } = results?.[0]?.result || {};
      if (token) {
        this.authStore.setPrimary(token);
      }
      if (Object.keys(headers).length > 0) {
        this.authStore.setMultiple(headers);
      }

      this.logger.info('Auth tokens refreshed successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to refresh auth tokens:', error);
      return false;
    }
  }
}

export default ChatGPTProvider;