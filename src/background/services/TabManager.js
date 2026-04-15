import { MessageTypes } from '../../core/messaging/MessageTypes.js';

/**
 * Tab management service for tracking AI platform tabs
 */
export class TabManager {
  constructor(messageBus) {
    this.messageBus = messageBus;
    this.chatgptTabs = new Map();
    this.activeTabId = null;
    this.logger = console;

    this.bindEvents();
  }

  bindEvents() {
    // Listen for tab updates
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      this.handleTabUpdate(tabId, changeInfo, tab);
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoved(tabId);
    });

    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.handleTabActivated(activeInfo);
    });
  }

  /**
   * Check if URL belongs to ChatGPT
   * @param {string} url - Tab URL
   * @returns {boolean} Whether URL is ChatGPT
   */
  isChatGPT(url) {
    return /^https:\/\/(chatgpt\.com|chat\.com)\//.test(url || "");
  }

  /**
   * Handle tab update events
   */
  handleTabUpdate(tabId, changeInfo, tab) {
    if (this.isChatGPT(changeInfo.url)) {
      const tabInfo = {
        url: changeInfo.url,
        title: tab.title || "ChatGPT",
        detectedAt: Date.now()
      };

      this.chatgptTabs.set(tabId, tabInfo);

      // Notify side panel
      this.messageBus.emit({
        type: MessageTypes.TAB_DETECTED,
        tabId,
        platform: "chatgpt",
        url: changeInfo.url
      });
    }
  }

  /**
   * Handle tab removal
   */
  handleTabRemoved(tabId) {
    this.chatgptTabs.delete(tabId);
    if (this.activeTabId === tabId) {
      this.activeTabId = null;
    }
  }

  /**
   * Handle tab activation
   */
  async handleTabActivated(activeInfo) {
    this.activeTabId = activeInfo.tabId;

    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab && this.isChatGPT(tab.url)) {
        if (!this.chatgptTabs.has(tab.id)) {
          this.chatgptTabs.set(tab.id, {
            url: tab.url,
            title: tab.title || "ChatGPT",
            detectedAt: Date.now()
          });
        }
      }
    } catch (error) {
      this.logger.warn('[TabManager] Failed to get tab info:', error);
    }
  }

  /**
   * Get tab information
   * @param {number} tabId - Tab ID
   * @returns {Object|null} Tab information or null
   */
  getTabInfo(tabId) {
    return this.chatgptTabs.get(tabId) || null;
  }

  /**
   * Get all ChatGPT tabs
   * @returns {Map} Map of tabId -> tabInfo
   */
  getAllChatGPTTabs() {
    return new Map(this.chatgptTabs);
  }

  /**
   * Check if tab is ChatGPT
   * @param {number} tabId - Tab ID
   * @returns {boolean} Whether tab is ChatGPT
   */
  isTabChatGPT(tabId) {
    return this.chatgptTabs.has(tabId);
  }

  /**
   * Update conversation ID for tab
   * @param {number} tabId - Tab ID
   * @param {string} conversationId - Conversation ID
   */
  updateConversationId(tabId, conversationId) {
    const info = this.chatgptTabs.get(tabId);
    if (info) {
      info.conversationId = conversationId;
      this.chatgptTabs.set(tabId, info);
    }
  }

  /**
   * Get conversation ID for tab
   * @param {number} tabId - Tab ID
   * @returns {string|null} Conversation ID or null
   */
  getConversationId(tabId) {
    const info = this.chatgptTabs.get(tabId);
    return info?.conversationId || null;
  }

  /**
   * Get active tab ID
   * @returns {number|null} Active tab ID or null
   */
  getActiveTabId() {
    return this.activeTabId;
  }

  /**
   * Get tab status for messaging
   * @param {number} tabId - Tab ID
   * @returns {Object} Status object
   */
  getTabStatus(tabId) {
    const info = this.chatgptTabs.get(tabId);
    return {
      isChatGPT: !!info,
      conversationId: info?.conversationId || null,
      platform: "chatgpt"
    };
  }
}