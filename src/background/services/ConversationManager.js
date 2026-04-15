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
    this.logger = console;

    this.bindEvents();
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
  }

  /**
   * Send message to side panel
   */
  sendToSidePanel(message) {
    chrome.runtime.sendMessage(message).catch(() => {});
  }

  /**
   * Handle user prompt messages
   */
  async handleUserPrompt(message, sender) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      const conversationId = message.conversationId;

      console.log('[ConversationManager] USER_PROMPT received', {
        tabId,
        contentLength: message.content?.length,
        conversationId,
        message
      });

      // Store the message
      await this.storeMessage(tabId, {
        role: "user",
        content: message.content,
        conversationId,
        timestamp: message.timestamp || Date.now()
      });

      // Notify side panel
      this.sendToSidePanel({
        type: MessageTypes.MESSAGE_ADDED,
        role: "user",
        content: message.content,
        timestamp: message.timestamp || Date.now(),
        tabId
      });

    } catch (error) {
      this.logger.error('[ConversationManager] Error handling user prompt:', error);
    }
  }

  /**
   * Handle streaming chunks
   */
  async handleStreamChunk(message, sender) {
    try {
      const tabId = message.tabId || sender?.tab?.id;

      this.logger.log('[ConversationManager] STREAM_CHUNK received', {
        tabId,
        seq: message.seq,
        contentLength: message.content?.length,
        model: message.model
      });

      await this.handleStreamChunkInternal(tabId, message);

      // Notify side panel
      this.sendToSidePanel({
        type: MessageTypes.STREAM_UPDATE,
        role: message.role,
        content: message.content,
        model: message.model,
        tabId,
        seq: message.seq,
        isFinal: message.isFinal
      });

    } catch (error) {
      this.logger.error('[ConversationManager] Error handling stream chunk:', error);
    }
  }

  /**
   * Handle stream completion
   */
  async handleStreamComplete(message, sender) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      const streamId = message.streamId;

      this.logger.log('[ConversationManager] STREAM_COMPLETE received', {
        tabId,
        streamId
      });

      const streamKey = "stream_" + tabId;
      const streaming = this.streamingMessages.get(streamKey);

      if (streaming && (!streamId || streaming.streamId === streamId)) {
        await this.finalizeStreamingMessage(tabId);
        this.streamingMessages.delete(streamKey);
      }

      // Notify side panel
      this.sendToSidePanel({
        type: MessageTypes.STREAM_COMPLETE,
        tabId
      });

    } catch (error) {
      this.logger.error('[ConversationManager] Error handling stream complete:', error);
    }
  }

  /**
   * Handle get conversation requests
   */
  async handleGetConversation(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      // Implementation for getting conversation data
      const response = await this.getConversationForTab(tabId);
      sendResponse(response);
    } catch (error) {
      this.logger.error('[ConversationManager] Error getting conversation:', error);
      sendResponse({ messages: [], conversationId: null, url: null });
    }
  }

  /**
   * Handle clear conversation
   */
  async handleClearConversation(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      await this.clearConversationForTab(tabId);

      // Notify side panel
      this.sendToSidePanel({
        type: MessageTypes.CONVERSATION_CLEARED,
        tabId
      });

      sendResponse({ ok: true });
    } catch (error) {
      this.logger.error('[ConversationManager] Error clearing conversation:', error);
      sendResponse({ ok: false });
    }
  }

  /**
   * Handle start new conversation
   */
  async handleStartNewConversation(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      await this.startNewConversation(tabId);
      sendResponse({ ok: true });
    } catch (error) {
      this.logger.error('[ConversationManager] Error starting new conversation:', error);
      sendResponse({ ok: false });
    }
  }

  /**
   * Handle get conversation history
   */
  async handleGetConversationHistory(message, sender, sendResponse) {
    try {
      const history = await this.getConversationHistory();
      sendResponse({ history });
    } catch (error) {
      this.logger.error('[ConversationManager] Error getting history:', error);
      sendResponse({ history: [] });
    }
  }

  /**
   * Handle load conversation from DOM
   */
  async handleLoadConversationFromDOM(message, sender, sendResponse) {
    try {
      const tabId = message.tabId || sender?.tab?.id;
      await this.loadConversationFromDOM(tabId);
      sendResponse({ ok: true });
    } catch (error) {
      this.logger.error('[ConversationManager] Error loading from DOM:', error);
      sendResponse({ ok: false });
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
      sendResponse({ ok: true });
    } catch (error) {
      this.logger.error('[ConversationManager] Error loading conversation:', error);
      sendResponse({ ok: false });
    }
  }

  // Internal methods (extracted from original background.js)

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
        if (seq > existing.lastSeq) {
          existing.content = message.content;
          existing.lastSeq = seq;
          if (message.model) existing.model = message.model;
          if (message.isFinal) {
            existing.isFinal = true;
            // Store the final message immediately
            const finalized = {
              role: "assistant",
              content: existing.content,
              model: existing.model,
              timestamp: existing.startTime,
              streamed: true
            };
            await this.storeMessage(tabId, finalized);
          }
        }
      }

      // Notify side panel
      this.sendToSidePanel({
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

    // Check if the final message was already stored (when isFinal flag was set)
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
    // Note: UI will handle finalizing the display on STREAM_COMPLETE
  }

  getConversationKey(tabId, conversationId) {
    return conversationId || `temp_${tabId}`;
  }

  async getConversationForTab(tabId) {
    // Implementation to get conversation data for a tab
    const messages = await this.storage.getConversation(`temp_${tabId}`, true);
    return {
      messages,
      conversationId: null, // Would be retrieved from TabManager
      url: null // Would be retrieved from TabManager
    };
  }

  async clearConversationForTab(tabId) {
    await this.storage.clearConversation(`temp_${tabId}`, true);
    this.streamingMessages.delete("stream_" + tabId);
  }

  async startNewConversation(tabId) {
    // Inject script to start new conversation
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // ChatGPT specific selectors
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

          // Fallback
          if (window.location.hostname === 'chatgpt.com' || window.location.hostname === 'chat.com') {
            window.location.href = 'https://chatgpt.com/';
          }
        }
      });

      await this.clearConversationForTab(tabId);

      // Notify side panel
      this.sendToSidePanel({
        type: MessageTypes.CONVERSATION_CLEARED,
        tabId
      });

    } catch (error) {
      this.logger.error('[ConversationManager] Error starting new conversation:', error);
    }
  }

  async getConversationHistory() {
    // Implementation for conversation history
    return [];
  }

  async loadConversationFromDOM(tabId) {
    // Implementation for scraping conversation from DOM
  }

  async loadConversation(conversationId, tabId) {
    // Implementation for loading specific conversation
  }
}