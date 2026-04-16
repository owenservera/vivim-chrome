import { Logger } from '../../core/logging/Logger.js';
import { MessageTypes } from '../../core/messaging/MessageTypes.js';
import { ConversationStorage } from '../../core/storage/ConversationStorage.js';
import { StorageManager } from '../../core/storage/StorageManager.js';

/**
 * Conversation management service
 */
export class ConversationManager {
  constructor(messageBus) {
    this.messageBus = messageBus;
    this.storage = new ConversationStorage(new StorageManager());
    this.streamingMessages = new Map();
    this.tabProviders = new Map(); // Track provider per tab
    this.logger = new Logger('ConversationManager');
    this.destinationManager = null;

    this.bindEvents();
  }

  /**
   * Inject DestinationManager for UI broadcasting
   */
  setDestinationManager(manager) {
    this.destinationManager = manager;
  }

  bindEvents() {
    this.messageBus.on(MessageTypes.USER_PROMPT, this.handleUserPrompt.bind(this));
    this.messageBus.on(MessageTypes.STREAM_CHUNK, this.handleStreamChunk.bind(this));
    this.messageBus.on(MessageTypes.STREAM_COMPLETE, this.handleStreamComplete.bind(this));
    this.messageBus.on(MessageTypes.GET_CONVERSATION, this.handleGetConversation.bind(this));
    this.messageBus.on(MessageTypes.CLEAR_CONVERSATION, this.handleClearConversation.bind(this));
    this.messageBus.on(MessageTypes.START_NEW_CONVERSATION, this.handleStartNewConversation.bind(this));
    this.messageBus.on(MessageTypes.GET_CONVERSATION_HISTORY, this.handleGetConversationHistory.bind(this));
    this.messageBus.on(MessageTypes.LOAD_CONVERSATION_FROM_DOM, this.handleLoadConversationFromDOM.bind(this));
    this.messageBus.on(MessageTypes.LOAD_CONVERSATION, this.handleLoadConversation.bind(this));
    this.messageBus.on(MessageTypes.PROVIDER_CHANGED, this.handleProviderChanged.bind(this));
    this.messageBus.on(MessageTypes.SAVE_FROM_DOM, this.handleSaveFromDOM.bind(this));
  }

  /**
   * Broadcast message to all UI surfaces
   */
  broadcastToUI(message) {
    if (this.destinationManager) {
      this.destinationManager.broadcast(message);
    } else {
      // Fallback
      chrome.runtime.sendMessage(message).catch(() => {});
    }
  }

  /**
   * Handle provider change messages
   */
  async handleProviderChanged(message, sender) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      const providerId = message.providerId;

      this.logger.info(`Provider changed for tab ${tabId}: ${providerId}`);
      this.tabProviders.set(tabId, providerId);

    } catch (error) {
      this.logger.error('Error handling provider change:', error);
    }
  }

  /**
   * Handle save from DOM messages
   */
  async handleSaveFromDOM(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      const content = message.content;

      this.logger.info(`SAVE_FROM_DOM received from tab ${tabId}`);

      if (!content) {
        if (sendResponse) sendResponse({ ok: false, error: 'No content' });
        return;
      }

      await this.storeMessage(tabId, {
        role: 'assistant',
        content: content,
        conversationId: null,
        timestamp: message.timestamp || Date.now()
      });

      this.broadcastToUI({
        type: MessageTypes.MESSAGE_ADDED,
        role: 'assistant',
        content: content,
        timestamp: message.timestamp || Date.now(),
        tabId
      });

      if (sendResponse) sendResponse({ ok: true });
    } catch (error) {
      this.logger.error('Error handling save from DOM:', error);
      if (sendResponse) sendResponse({ ok: false, error: error.message });
    }
  }

  /**
   * Handle user prompt messages
   */
  async handleUserPrompt(message, sender) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      const conversationId = message.conversationId;

      this.logger.info(`USER_PROMPT received from tab ${tabId}`);

      // Store the message
      await this.storeMessage(tabId, {
        role: "user",
        content: message.content,
        conversationId,
        timestamp: message.timestamp || Date.now()
      });

      // Notify UI
      this.broadcastToUI({
        type: MessageTypes.MESSAGE_ADDED,
        role: "user",
        content: message.content,
        timestamp: message.timestamp || Date.now(),
        tabId
      });

    } catch (error) {
      this.logger.error('Error handling user prompt:', error);
    }
  }

  /**
   * Handle streaming chunks
   */
  async handleStreamChunk(message, sender) {
    try {
      const tabId = message.tabId || sender?.tab?.id;

      await this.handleStreamChunkInternal(tabId, message);

      // Notify UI
      this.broadcastToUI({
        type: MessageTypes.STREAM_UPDATE,
        role: message.role,
        content: message.content,
        model: message.model,
        tabId,
        seq: message.seq,
        isFinal: message.isFinal
      });

    } catch (error) {
      this.logger.error('Error handling stream chunk:', error);
    }
  }

  /**
   * Handle stream completion
   */
  async handleStreamComplete(message, sender) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      const streamId = message.streamId;

      this.logger.info(`STREAM_COMPLETE for tab ${tabId}`, { streamId });

      const streamKey = "stream_" + tabId;
      const streaming = this.streamingMessages.get(streamKey);

      if (streaming && (!streamId || streaming.streamId === streamId)) {
        await this.finalizeStreamingMessage(tabId);
        this.streamingMessages.delete(streamKey);
      }

      // Notify UI
      this.broadcastToUI({
        type: MessageTypes.STREAM_COMPLETE,
        tabId
      });

    } catch (error) {
      this.logger.error('Error handling stream complete:', error);
    }
  }

  /**
   * Handle get conversation requests
   */
  async handleGetConversation(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      const response = await this.getConversationForTab(tabId);
      if (sendResponse) sendResponse(response);
    } catch (error) {
      this.logger.error('Error getting conversation:', error);
      if (sendResponse) sendResponse({ messages: [], conversationId: null, url: null });
    }
  }

  /**
   * Handle clear conversation
   */
  async handleClearConversation(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      await this.clearConversationForTab(tabId);

      // Notify UI
      this.broadcastToUI({
        type: MessageTypes.CONVERSATION_CLEARED,
        tabId
      });

      if (sendResponse) sendResponse({ ok: true });
    } catch (error) {
      this.logger.error('Error clearing conversation:', error);
      if (sendResponse) sendResponse({ ok: false });
    }
  }

  /**
   * Handle start new conversation
   */
  async handleStartNewConversation(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      await this.startNewConversation(tabId);
      if (sendResponse) sendResponse({ ok: true });
    } catch (error) {
      this.logger.error('Error starting new conversation:', error);
      if (sendResponse) sendResponse({ ok: false });
    }
  }

  /**
   * Handle get conversation history
   */
  async handleGetConversationHistory(message, sender, sendResponse) {
    try {
      const history = await this.getConversationHistory();
      if (sendResponse) sendResponse({ history });
    } catch (error) {
      this.logger.error('Error getting history:', error);
      if (sendResponse) sendResponse({ history: [] });
    }
  }

  /**
   * Handle load conversation from DOM
   */
  async handleLoadConversationFromDOM(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      await this.loadConversationFromDOM(tabId);
      if (sendResponse) sendResponse({ ok: true });
    } catch (error) {
      this.logger.error('Error loading from DOM:', error);
      if (sendResponse) sendResponse({ ok: false });
    }
  }

  /**
   * Handle load specific conversation
   */
  async handleLoadConversation(message, sender, sendResponse) {
    try {
      const conversationId = message.conversationId;
      const tabId = message.tabId || sender?.tab?.id;
      await this.loadConversation(conversationId, tabId);
      if (sendResponse) sendResponse({ ok: true });
    } catch (error) {
      this.logger.error('Error loading conversation:', error);
      if (sendResponse) sendResponse({ ok: false });
    }
  }

  // Internal methods

  async handleStreamChunkInternal(tabId, message) {
    const key = "stream_" + tabId;
    let existing = this.streamingMessages.get(key);

    if (message.role === "assistant") {
      const seq = message.seq || 0;
      const streamId = message.streamId;

      if (!existing || (streamId && existing.streamId !== streamId)) {
        if (existing) {
          await this.finalizeStreamingMessage(tabId);
        }
        existing = {
          content: message.content,
          model: message.model || "unknown",
          startTime: Date.now(),
          tabId,
          lastSeq: seq,
          streamId,
          isFinal: message.isFinal || false
        };
        this.streamingMessages.set(key, existing);
      } else {
        // FIX: Sequence validation - skip out-of-order chunks
        if (seq <= existing.lastSeq) {
          this.logger.debug(`Out-of-order chunk: seq=${seq}, lastSeq=${existing.lastSeq}, skipping`);
          return;
        }

        // FIX: Append content instead of replacing (for partial chunks)
        existing.content = message.content;
        existing.lastSeq = seq;
        if (message.model) existing.model = message.model;
        
        // FIX: Don't store on isFinal here - wait for STREAM_COMPLETE to avoid double storage
        if (message.isFinal) {
          existing.isFinal = true;
        }
      }

      // Notify UI
      this.broadcastToUI({
        type: MessageTypes.STREAM_UPDATE,
        role: "assistant",
        content: existing.content,
        model: existing.model,
        tabId,
        timestamp: Date.now(),
        seq: existing.lastSeq,
        isFinal: existing.isFinal
      });
    }
  }

  async storeMessage(tabId, msg) {
    await this.storage.addMessage(this.getConversationKey(tabId, msg.conversationId), msg, !msg.conversationId);
  }

  async finalizeStreamingMessage(tabId) {
    const streamKey = "stream_" + tabId;
    const streaming = this.streamingMessages.get(streamKey);
    if (!streaming) return;

    if (streaming.isFinal) {
      this.streamingMessages.delete(streamKey);
      return;
    }

    this.streamingMessages.delete(streamKey);
    const finalized = {
      role: "assistant",
      content: streaming.content,
      model: streaming.model,
      timestamp: streaming.startTime,
      streamed: true
    };

    await this.storeMessage(tabId, finalized);
  }

  getConversationKey(tabId, conversationId) {
    const providerId = this.tabProviders.get(tabId) || 'chatgpt';
    return conversationId || `temp_${tabId}_${providerId}`;
  }

  async getConversationForTab(tabId) {
    const providerId = this.tabProviders.get(tabId) || 'chatgpt';
    const messages = await this.storage.getConversation(`temp_${tabId}_${providerId}`, true);
    return {
      messages,
      conversationId: null,
      url: null,
      providerId
    };
  }

  async clearConversationForTab(tabId) {
    const providerId = this.tabProviders.get(tabId) || 'chatgpt';
    await this.storage.clearConversation(`temp_${tabId}_${providerId}`, true);
    this.streamingMessages.delete("stream_" + tabId);
  }

  async startNewConversation(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const selectors = [
            'a[href*="new"]',
            'button[aria-label*="New chat" i]',
            '[data-testid*="new-chat" i]',
            '.new-chat-button'
          ];

          for (const selector of selectors) {
            const btn = document.querySelector(selector);
            if (btn) {
              btn.click();
              return;
            }
          }

          if (window.location.hostname === 'chatgpt.com' || window.location.hostname === 'chat.com') {
            window.location.href = 'https://chatgpt.com/';
          }
        }
      });

      await this.clearConversationForTab(tabId);

      this.broadcastToUI({
        type: MessageTypes.CONVERSATION_CLEARED,
        tabId
      });

    } catch (error) {
      this.logger.error('Error starting new conversation:', error);
    }
  }

  async getConversationHistory() {
    return [];
  }

  async loadConversationFromDOM(tabId) {
    // Future implementation
  }

  async loadConversation(conversationId, tabId) {
    // Future implementation
  }
}
