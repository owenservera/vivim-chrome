/**
 * ApiStreamService - Streams conversation data to external HTTP endpoints
 * Similar to VIVIM Mirror but integrated as a VIVIM service
 */

import { Logger } from '../../core/logging/Logger.js';
import { MessageTypes } from '../../core/messaging/MessageTypes.js';

/**
 * Configuration defaults for the API streaming service
 */
const DEFAULTS = {
  endpoint: '',
  authHeader: 'Authorization',
  authValue: '',
  customHeaders: '',
  enabled: false,
  syncMode: 'full',
  retryOnFail: true,
  maxRetries: 3,
  streamSettleMs: 1800,
};

/**
 * ApiStreamService - Handles streaming conversation data to external APIs
 */
export class ApiStreamService {
  constructor(messageBus) {
    this.messageBus = messageBus;
    this.logger = new Logger('ApiStreamService');
    this.config = { ...DEFAULTS };
    this.syncCount = 0;
    this.lastSyncTime = null;
    this.lastError = null;
    this.lastSyncedSignature = null;
    this.streamDebounceTimer = null;

    this.bindEvents();
  }

  /**
   * Bind to message bus events
   */
  bindEvents() {
    this.messageBus.on(MessageTypes.STREAM_COMPLETE, this.handleStreamComplete.bind(this));
    this.messageBus.on(MessageTypes.CONVERSATION_LOADED, this.handleConversationLoaded.bind(this));
    this.messageBus.on(MessageTypes.SAVE_FROM_DOM, this.handleSaveFromDom.bind(this));
    this.messageBus.on(MessageTypes.LOAD_CONVERSATION_FROM_DOM, this.handleLoadFromDom.bind(this));
  }

  /**
   * Load configuration from storage
   */
  async loadConfig() {
    return new Promise((resolve) => {
      chrome.storage.sync.get(DEFAULTS, (result) => {
        this.config = { ...DEFAULTS, ...result };
        this.logger.info('Config loaded:', {
          endpoint: this.config.endpoint ? '[set]' : '',
          enabled: this.config.enabled,
          syncMode: this.config.syncMode,
        });
        resolve(this.config);
      });
    });
  }

  /**
   * Save configuration to storage
   */
  saveConfig(config) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.set(config, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          this.config = { ...this.config, ...config };
          resolve();
        }
      });
    });
  }

  /**
   * Get configuration
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * Build fetch options for the API call
   */
  buildFetchOptions(payload) {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.config.authValue) {
      headers[this.config.authHeader || 'Authorization'] = this.config.authValue;
    }

    if (this.config.customHeaders) {
      try {
        const extra = JSON.parse(this.config.customHeaders);
        Object.assign(headers, extra);
      } catch (e) {
        this.logger.warn('Invalid custom headers JSON:', e.message);
      }
    }

    const body = this.config.syncMode === 'last'
      ? {
          conversation_id: payload.conversation_id,
          url: payload.url,
          timestamp: payload.timestamp,
          message_count: payload.message_count,
          last_message: payload.last_message,
        }
      : payload;

    return {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    };
  }

  /**
   * Build signature for deduplication
   */
  buildSignature(messages) {
    if (!messages || messages.length === 0) return '';
    const last = messages[messages.length - 1];
    return `${messages.length}::${last.role}::${(last.content || '').slice(-80)}`;
  }

  /**
   * Sync payload to external API with retry
   */
  async syncWithRetry(payload, attempt = 1) {
    if (!this.config.endpoint) {
      return { success: false, error: 'No endpoint configured' };
    }

    try {
      const res = await fetch(this.config.endpoint, this.buildFetchOptions(payload));

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
      }

      this.syncCount++;
      this.lastSyncTime = new Date().toISOString();
      this.lastError = null;

      this.logger.info(`Synced conversation ${payload.conversation_id} (${payload.message_count} messages)`);

      // Update badge
      chrome.action.setBadgeText({ text: String(this.syncCount) });
      chrome.action.setBadgeBackgroundColor({ color: '#00ff88' });

      // Store last sync metadata
      chrome.storage.local.set({
        apiStreamLastSync: {
          time: this.lastSyncTime,
          conversation_id: payload.conversation_id,
          message_count: payload.message_count,
          status: 'ok',
        },
        apiStreamTotalSyncs: this.syncCount,
      });

      return { success: true };

    } catch (err) {
      this.lastError = err.message;
      this.logger.error(`Sync attempt ${attempt} failed:`, err.message);

      if (this.config.retryOnFail && attempt < (this.config.maxRetries || 3)) {
        const delay = attempt * 2000;
        this.logger.info(`Retrying in ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        return this.syncWithRetry(payload, attempt + 1);
      }

      // Mark badge as error
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#ff4444' });

      chrome.storage.local.set({
        apiStreamLastSync: {
          time: new Date().toISOString(),
          conversation_id: payload.conversation_id,
          status: 'error',
          error: err.message,
        },
      });

      return { success: false, error: err.message };
    }
  }

  /**
   * Debounced dispatch for streaming detection
   */
  scheduleSyncCheck(messages) {
    clearTimeout(this.streamDebounceTimer);
    this.streamDebounceTimer = setTimeout(() => {
      this.dispatchSync(messages);
    }, this.config.streamSettleMs || 1800);
  }

  /**
   * Dispatch sync to API
   */
  dispatchSync(messages) {
    if (!this.config.enabled) return;
    if (!messages || messages.length === 0) return;

    const sig = this.buildSignature(messages);
    if (sig === this.lastSyncedSignature) return;

    this.lastSyncedSignature = sig;

    const lastMsg = messages[messages.length - 1];

    const payload = {
      conversation_id: this.lastConversationId || 'unknown',
      url: this.lastUrl || '',
      timestamp: new Date().toISOString(),
      message_count: messages.length,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      last_message: lastMsg,
    };

    this.logger.info(`Dispatching sync — ${messages.length} messages`);

    this.syncWithRetry(payload);
  }

  /**
   * Handle STREAM_COMPLETE - sync after streaming finishes
   */
  handleStreamComplete(message) {
    if (!this.config.enabled) return;

    const messages = message.messages || [];
    if (messages.length === 0) return;

    this.lastConversationId = message.conversationId || 'unknown';
    this.lastUrl = message.url || '';

    this.scheduleSyncCheck(messages);
  }

  /**
   * Handle CONVERSATION_LOADED - sync on conversation load
   */
  handleConversationLoaded(message) {
    if (!this.config.enabled) return;

    const messages = message.messages || [];
    if (messages.length === 0) return;

    this.lastConversationId = message.conversationId || 'unknown';
    this.lastUrl = message.url || '';

    this.lastSyncedSignature = null;
    this.scheduleSyncCheck(messages);
  }

  /**
   * Handle SAVE_FROM_DOM - save from web page content
   */
  handleSaveFromDom(message) {
    if (!this.config.enabled) return;

    const content = message.content;
    if (!content) return;

    const messages = [
      { role: 'user', content: message.prompt || '' },
      { role: 'assistant', content: content }
    ];

    this.lastConversationId = message.conversationId || 'dom-capture';
    this.lastUrl = message.url || '';

    this.lastSyncedSignature = null;
    this.dispatchSync(messages);
  }

  /**
   * Handle LOAD_CONVERSATION_FROM_DOM - loaded from web page
   */
  handleLoadFromDom(message) {
    if (!this.config.enabled) return;

    const messages = message.messages || [];
    if (messages.length === 0) return;

    this.lastConversationId = message.conversationId || 'dom-loaded';
    this.lastUrl = message.url || '';

    this.lastSyncedSignature = null;
    this.scheduleSyncCheck(messages);
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: this.config.enabled,
      endpoint: this.config.endpoint,
      syncCount: this.syncCount,
      lastSyncTime: this.lastSyncTime,
      lastError: this.lastError,
    };
  }

  /**
   * Force a sync with current conversation
   */
  async forceSync(messages) {
    this.lastSyncedSignature = null;
    return this.dispatchSync(messages);
  }

  /**
   * Enable/disable streaming
   */
  setEnabled(enabled) {
    this.config.enabled = enabled;
    this.saveConfig({ enabled });

    this.logger.info(`Streaming ${enabled ? 'enabled' : 'disabled'}`);

    if (enabled) {
      chrome.action.setBadgeText({ text: '' });
    }
  }

  /**
   * Initialize the service
   */
  async init() {
    await this.loadConfig();
    this.logger.info('ApiStreamService initialized', {
      enabled: this.config.enabled,
      endpoint: this.config.endpoint ? '[set]' : '',
    });
  }
}