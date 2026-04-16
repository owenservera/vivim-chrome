import { Logger } from '../../core/logging/Logger.js';
import { MessageTypes } from '../../core/messaging/MessageTypes.js';

/**
 * Tab management service for tracking AI platform tabs
 */
export class TabManager {
  constructor(messageBus) {
    this.messageBus = messageBus;
    this.chatgptTabs = new Map();
    this.activeTabId = null;
    this.logger = new Logger('TabManager');

    this.bindEvents();
    this.scanExistingTabs();
  }

  bindEvents() {
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
   * Scan all open tabs to find ChatGPT sessions on startup
   */
  async scanExistingTabs() {
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (this.isChatGPT(tab.url)) {
          this.registerTab(tab.id, tab.url, tab.title);
        }
      }
      this.logger.info(`Startup scan complete. Found ${this.chatgptTabs.size} ChatGPT tabs.`);
    } catch (error) {
      this.logger.error('Failed to scan existing tabs:', error);
    }
  }

  /**
   * Check if URL belongs to ChatGPT
   */
  isChatGPT(url) {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'chatgpt.com' || parsed.hostname === 'chat.com';
    } catch {
      return false;
    }
  }

  /**
   * Handle tab update events
   */
  handleTabUpdate(tabId, changeInfo, tab) {
    // Only process when URL changes or loading completes
    if (!changeInfo.url && changeInfo.status !== 'complete') return;

    const url = changeInfo.url || tab.url;
    
    if (this.isChatGPT(url)) {
      this.registerTab(tabId, url, tab.title);
    } else if (this.chatgptTabs.has(tabId)) {
      // Tab navigated away from ChatGPT
      this.logger.info(`Tab ${tabId} navigated away from ChatGPT`);
      this.chatgptTabs.delete(tabId);
    }
  }

  /**
   * Register or update a ChatGPT tab
   */
  registerTab(tabId, url, title) {
    const isNew = !this.chatgptTabs.has(tabId);
    const tabInfo = {
      url,
      title: title || "ChatGPT",
      detectedAt: Date.now()
    };

    this.chatgptTabs.set(tabId, tabInfo);

    if (isNew) {
      this.logger.info(`Detected new ChatGPT tab: ${tabId} (${url})`);
      this.messageBus.emit({
        type: MessageTypes.TAB_DETECTED,
        tabId,
        platform: "chatgpt",
        url
      });
    }
  }

  /**
   * Handle tab removal
   */
  handleTabRemoved(tabId) {
    if (this.chatgptTabs.has(tabId)) {
      this.logger.info(`ChatGPT tab removed: ${tabId}`);
      this.chatgptTabs.delete(tabId);
    }
    if (this.activeTabId === tabId) {
      this.activeTabId = null;
    }
  }

  /**
   * Handle tab activation
   */
  async handleTabActivated(activeInfo) {
    this.activeTabId = activeInfo.tabId;
    
    // If the newly activated tab is ChatGPT but we didn't know yet, register it
    try {
      const tab = await chrome.tabs.get(activeInfo.tabId);
      if (tab && this.isChatGPT(tab.url) && !this.chatgptTabs.has(tab.id)) {
        this.registerTab(tab.id, tab.url, tab.title);
      }
    } catch (error) {
      this.logger.debug('Failed to get info for activated tab (might be closed):', error.message);
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