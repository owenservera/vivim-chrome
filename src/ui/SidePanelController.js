import { MessageTypes } from '../core/messaging/MessageTypes.js';

/**
 * Side Panel Controller - Main UI orchestrator
 * Coordinates all UI components and handles user interactions
 */
export class SidePanelController {
  constructor() {
    this.currentTabId = null;
    this.currentProvider = { id: 'chatgpt', name: 'ChatGPT', color: '#10A37F' };
    this.availableProviders = [
      { id: 'chatgpt', name: 'ChatGPT', color: '#10A37F' },
      { id: 'claude', name: 'Claude', color: '#8B5CF6' },
      { id: 'gemini', name: 'Gemini', color: '#F59E0B' }
    ];
    this.messageList = [];
    this.streamingMessage = null;
    this.streamingModel = null; // Store model for streaming completion
    this.logger = console;
    this.lastSentTime = 0;
    this.rateLimitMs = 1000;

    this.init();
  }

  init() {
    this.messagesArea = document.getElementById('messagesArea');
    this.emptyState = document.getElementById('emptyState');
    this.promptInput = document.getElementById('promptInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.statusDot = document.getElementById('statusDot');
    this.statusText = document.getElementById('statusText');
    this.providerSelect = document.getElementById('providerSelect');
    this.providerName = document.getElementById('providerName');
    this.providerDot = document.getElementById('providerDot');
    this.msgCountEl = document.getElementById('msgCount');

    this.bindEvents();
    this.initializeWithCurrentTab();
    this.updateConnectionStatus('connecting');
    this.updateProviderDisplay();

    // Register the runtime message listener so the side panel receives
    // broadcasts from the background (STREAM_UPDATE, MESSAGE_ADDED, etc.).
    // This was previously missing — the side panel was completely deaf.
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  flushPendingUpdates() {
    if (this.pendingStreamUpdates && this.pendingStreamUpdates.length > 0 && this.messagesArea) {
      console.log('[SidePanel] Flushing pending stream updates:', this.pendingStreamUpdates.length);
      const updates = [...this.pendingStreamUpdates]; // Copy to avoid modification during iteration
      this.pendingStreamUpdates = [];
      for (const update of updates) {
        this.updateStreamingMessage(update.content, update.model, update.seq, update.isFinal);
      }
    }
  }

  updateConnectionStatus(status) {
    if (!this.statusDot || !this.statusText) return;
    
    this.statusDot.className = 'status-dot';
    
    switch (status) {
      case 'connected':
        this.statusDot.classList.add('status-dot--connected');
        this.statusText.textContent = 'Connected';
        break;
      case 'streaming':
        this.statusDot.classList.add('status-dot--streaming');
        this.statusText.textContent = 'Streaming...';
        break;
      case 'error':
        this.statusText.textContent = 'Error';
        break;
      default:
        this.statusText.textContent = 'Connecting...';
    }
  }

  bindEvents() {
    if (this.promptInput) {
      this.promptInput.addEventListener('input', () => this.onInputChange());
      this.promptInput.addEventListener('keydown', (e) => this.onInputKeyDown(e));
    }

    if (this.sendBtn) {
      this.sendBtn.addEventListener('click', () => this.sendPrompt());
    }

    if (this.providerSelect) {
      this.providerSelect.addEventListener('click', () => this.showProviderMenu());
    }

    if (chrome.tabs && chrome.tabs.onActivated) {
      chrome.tabs.onActivated.addListener(activeInfo => {
        if (this.currentTabId !== activeInfo.tabId) {
          this.switchTab(activeInfo.tabId);
        }
      });
    }

    if (chrome.tabs && chrome.tabs.onUpdated) {
      chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (tabId === this.currentTabId && changeInfo.status === 'complete') {
          this.logger.info(`[SidePanel] Tab ${tabId} refreshed/updated, reloading conversation...`);
          this.loadConversation();
        }
      });
    }

    this.bindHeaderButtons();
    this.bindToolbar();
    this.flushPendingUpdates();
  }

  bindHeaderButtons() {
    const newChatBtn = document.getElementById('newChatBtn');
    const historyBtn = document.getElementById('historyBtn');
    const exportBtn = document.getElementById('exportBtn');
    const privacyBtn = document.getElementById('privacyBtn');
    const reloadBtn = document.getElementById('reloadBtn');
    const clearBtn = document.getElementById('clearBtn');

    if (newChatBtn) {
      newChatBtn.addEventListener('click', () => this.startNewConversation());
    }

    if (historyBtn) {
      historyBtn.addEventListener('click', () => this.showHistory());
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.showExportMenu());
    }

    if (privacyBtn) {
      privacyBtn.addEventListener('click', () => this.showPrivacySettings());
    }

    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => this.reloadConversation());
    }

    const testBtn = document.getElementById('testBtn');
    if (testBtn) {
      testBtn.addEventListener('click', () => this.testCommunication());
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearConversation());
    }
  }

  bindToolbar() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => this.onSearch(e.target.value));
    }
  }

async initializeWithCurrentTab() {
    try {
      console.log('[SidePanel] Querying for current tab...');
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[SidePanel] Found tabs:', tabs.length, tabs.map(t => ({ id: t.id, url: t.url })));

      if (tabs[0] && tabs[0].id) {
        this.currentTabId = tabs[0].id;
        console.log('[SidePanel] Set currentTabId to:', this.currentTabId, 'URL:', tabs[0].url);
      } else {
        console.error('[SidePanel] No active tab found or tab has no ID');
      }
    } catch (err) {
      console.error('[SidePanel] Failed to get current tab:', err);
    }

    // Establish background connection first, then load conversation
    // checkBackgroundConnection() with retry — the first sendMessage may fail if
    // the service worker just woke up. Retry up to 3 times with 500ms backoff.
    await this._connectWithRetry(0);

    // Now that we're connected, load the conversation
    if (this.currentTabId) {
      await this.loadConversation();
    } else {
      console.warn('[SidePanel] No currentTabId, skipping conversation load');
    }
  }

  async _connectWithRetry(attempt) {
    const MAX_ATTEMPTS = 4;
    const DELAY_MS = 500;
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'REGISTER_DESTINATION',
        id: 'sidepanel',
        config: {
          capabilities: {
            receivesStreaming: true,
            receivesComplete: true,
            canSendPrompts: true
          }
        }
      });
      if (resp && resp.ok) {
        this.updateConnectionStatus('connected');
        console.log('[SidePanel] Registered with background on attempt', attempt + 1);
        this._startHeartbeat();
        return;
      }
    } catch (err) {
      console.warn(`[SidePanel] Registration attempt ${attempt + 1} failed:`, err.message);
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      setTimeout(() => this._connectWithRetry(attempt + 1), DELAY_MS * (attempt + 1));
    } else {
      this.updateConnectionStatus('error');
    }
  }

  _startHeartbeat() {
    // Re-register every 30s to survive MV3 service worker restarts
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(async () => {
      try {
        await chrome.runtime.sendMessage({
          type: 'REGISTER_DESTINATION',
          id: 'sidepanel',
          config: {
            capabilities: {
              receivesStreaming: true,
              receivesComplete: true,
              canSendPrompts: true
            }
          }
        });
      } catch {
        // SW may have restarted — next heartbeat tick will re-register
      }
    }, 30_000);
  }

  handleMessage(message, sender, sendResponse) {
    try {
      console.log('[SidePanel] Received message:', message.type, message);

      // Filter messages not addressed to this tab (but allow global broadcasts)
      const isBroadcast = message.tabId === undefined || message.tabId === null;
      if (!isBroadcast && message.tabId !== this.currentTabId) {
        console.log('[SidePanel] Ignoring message for different tab:', message.tabId, 'current:', this.currentTabId);
        return false;
      }

      switch (message.type) {
        case MessageTypes.MESSAGE_ADDED:
          this.updateConnectionStatus('connected');
          this.addMessage(message.role, message.content, message.model, message.timestamp);
          break;

        case MessageTypes.STREAM_UPDATE:
          this.updateConnectionStatus('streaming');
          this.streamingModel = message.model; // Store model for completion
          this.updateStreamingMessage(message.content, message.model, message.seq, message.isFinal);
          break;

        case MessageTypes.STREAM_COMPLETE:
          this.updateConnectionStatus('connected');
          this.finalizeStreamingMessage(this.streamingModel);
          this.streamingModel = null; // Reset
          break;

        case MessageTypes.ERROR:
          this.updateConnectionStatus('error');
          this.cleanupStreamingMessage();
          this.showToast(message.error || 'An error occurred');
          break;

        case MessageTypes.CONVERSATION_CLEARED:
          this.clearMessages();
          break;

        case MessageTypes.CONVERSATION_LOADED:
          this.updateConnectionStatus('connected');
          this.loadMessages(message.messages);
          break;

        case MessageTypes.TAB_DETECTED:
          console.log('[SidePanel] Tab detected:', message.tabId, message.url);
          if (this.currentTabId === message.tabId) {
            this.loadConversation();
          }
          break;
      }
    } catch (error) {
      console.error('[SidePanel] Error handling message:', error);
      this.updateConnectionStatus('error');
    }

    // Return false — none of the handled message types require an async sendResponse
    // from the side panel side. Returning false lets the channel close immediately.
    return false;
  }

  async switchTab(tabId) {
    console.log('[SidePanel] Switching to tab:', tabId);
    this.currentTabId = tabId;
    this.loadConversation();
  }

  async sendPrompt() {
    const text = this.promptInput?.value?.trim();
    if (!text || !this.currentTabId) {
      console.log('[SidePanel] Cannot send: text empty or no currentTabId', { text: !!text, currentTabId: this.currentTabId });
      return;
    }

    const now = Date.now();
    if (now - this.lastSentTime < this.rateLimitMs) {
      this.showToast('Please wait before sending another message');
      return;
    }
    this.lastSentTime = now;

    console.log('[SidePanel] Sending prompt:', text, 'to tab:', this.currentTabId);

    // Emit UI action event to data feed
    if (window.dataFeedManager?.isEnabled()) {
      window.dataFeedManager.emit('ui:action', {
        action: 'send_message',
        content: text,
        contentLength: text.length,
        provider: this.currentProvider?.id,
        tabId: this.currentTabId
      });
    }

    // Send USER_PROMPT to background for display
    console.log('[SidePanel] Sending USER_PROMPT to background...');
    chrome.runtime.sendMessage({
      type: MessageTypes.USER_PROMPT,
      content: text,
      conversationId: null,
      timestamp: Date.now(),
      tabId: this.currentTabId
    }).then(() => {
      console.log('[SidePanel] USER_PROMPT sent successfully');
      // Clear input only after successful sending
      this.promptInput.value = '';
      this.onInputChange();
    }).catch((error) => {
      console.error('[SidePanel] Failed to send USER_PROMPT:', error);
      this.showToast('Failed to send: ' + error.message);
    });

    // Only attempt injection if we have a valid tab ID
    if (!this.currentTabId) {
      this.logger.error('[SidePanel] No currentTabId available for injection');
      // Try to find a valid provider tab as fallback
      const providerTabs = await chrome.tabs.query({ url: [`https://*/*${this.currentProvider.id}*`, "https://chatgpt.com/*", "https://chat.com/*", "https://claude.ai/*", "https://gemini.google.com/*"] });
      if (providerTabs.length > 0) {
        this.currentTabId = providerTabs[0].id;
        this.logger.info(`[SidePanel] Found fallback provider tab: ${this.currentTabId}`);
      } else {
        this.showToast('No active AI provider tab found. Please open ChatGPT, Claude, or Gemini.');
        return;
      }
    }

    try {
      this.logger.info(`[SidePanel] Attempting injection into tab ${this.currentTabId} for ${this.currentProvider.id}`);
      
      // Ping the content script first to see if it's alive
      try {
        const ping = await chrome.tabs.sendMessage(this.currentTabId, { type: 'PING' });
        this.logger.debug('[SidePanel] Content script ping success:', ping);
      } catch (pingError) {
        this.logger.warn('[SidePanel] Content script not responding:', pingError.message);
        this.showToast('Connection lost. Please refresh the AI provider page (ChatGPT/Claude/Gemini).');
        return;
      }

      // Send message to content script to inject the prompt into the webpage
      const response = await chrome.tabs.sendMessage(this.currentTabId, {
        type: 'INJECT_PROMPT',
        provider: this.currentProvider.id,
        prompt: text
      });

      this.logger.info('[SidePanel] Prompt injection response:', response);
      if (response && response.success) {
        this.promptInput.value = '';
        this.onInputChange();
      } else if (response && response.error) {
        this.showToast('Injection failed: ' + response.error);
      }
    } catch (error) {
      this.logger.error('[SidePanel] Injection failed:', error);
      this.showToast('Could not connect to page. Please refresh the tab.');
    }
  }

  addMessage(role, content, model, timestamp) {
    if (!this.messagesArea) {
      console.warn('[SidePanel] messagesArea not available, queuing message');
      this.messageList.push({ role, content, model, timestamp });
      return;
    }
    this.messageList.push({ role, content, model, timestamp });
    this.renderMessages();
  }

  updateStreamingMessage(content, model, seq, isFinal = false) {
    if (!this.messagesArea || !this.emptyState) {
      if (!this.pendingStreamUpdates) this.pendingStreamUpdates = [];
      this.pendingStreamUpdates.push({ content, model, seq, isFinal });
      return;
    }

    if (!this.streamingMessage) {
      this.streamingMessage = document.createElement('div');
      this.streamingMessage.className = 'msg msg--assistant msg--streaming';
      this.streamingMessage.dataset.seq = '0';
      const contentEl = document.createElement('div');
      contentEl.className = 'msg__content';
      this.streamingMessage.appendChild(contentEl);
      this.messagesArea?.appendChild(this.streamingMessage);
      this.emptyState?.classList.add('hidden');
      this.chunkBuffer = [];
    }

    const currentSeq = parseInt(this.streamingMessage.dataset.seq || '0', 10);
    
    if (seq > currentSeq) {
      this.chunkBuffer = this.chunkBuffer.filter(c => c.seq > currentSeq);
      this.chunkBuffer.push({ content, seq });
      this.chunkBuffer.sort((a, b) => a.seq - b.seq);
      
      let lastSeq = currentSeq;
      for (const chunk of this.chunkBuffer) {
        if (chunk.seq === lastSeq + 1) {
          lastSeq = chunk.seq;
          this.applyChunkToStream(chunk.content);
        }
      }
      this.streamingMessage.dataset.seq = String(lastSeq);
    }
    
    this.messagesArea?.scrollTo({
      top: this.messagesArea.scrollHeight,
      behavior: 'auto'
    });

    if (isFinal) {
      this.finalizeStreamingMessage(model);
      this.chunkBuffer = [];
    }
  }

  applyChunkToStream(content) {
    const contentEl = this.streamingMessage?.querySelector('.msg__content');
    if (contentEl) {
      contentEl.innerHTML = this.formatMessage(content);
    }
  }

  finalizeStreamingMessage(model) {
    if (this.streamingMessage) {
      this.streamingMessage.classList.remove('msg--streaming');

      if (!this.streamingMessage.querySelector('.msg__meta')) {
        const metaEl = document.createElement('div');
        metaEl.className = 'msg__meta';
        metaEl.innerHTML = `<span>${model || 'AI'}</span> • <span>${this.formatTime(Date.now())}</span>`;
        this.streamingMessage.appendChild(metaEl);
      }

      this.streamingMessage = null;
    }
  }

  cleanupStreamingMessage() {
    if (this.streamingMessage) {
      this.streamingMessage.remove();
      this.streamingMessage = null;
    }
  }

  clearMessages() {
    const messageCount = this.messageList.length;

    // Emit UI action event to data feed
    if (window.dataFeedManager?.isEnabled()) {
      window.dataFeedManager.emit('ui:action', {
        action: 'clear_messages',
        messageCount,
        provider: this.currentProvider?.id,
        tabId: this.currentTabId
      });
    }

    this.messageList = [];
    this.renderMessages();
  }

  loadMessages(messages) {
    this.messageList = messages || [];
    this.renderMessages();
  }

  renderMessages() {
    if (!this.messagesArea) return;

    // If a stream is in progress, detach it before wiping the DOM so it
    // is not destroyed. We will re-attach it after rendering history.
    const activeStream = this.streamingMessage;
    if (activeStream) {
      activeStream.remove();
    }

    // Detach emptyState to preserve it before clearing innerHTML
    const emptyStateDetached = this.emptyState && this.emptyState.parentNode;
    if (emptyStateDetached) {
      this.emptyState.remove();
    }

    this.messagesArea.innerHTML = '';

    if (this.messageList.length === 0 && !activeStream) {
      this.messagesArea.appendChild(this.emptyState);
      this.emptyState?.classList.remove('hidden');
    } else {
      this.emptyState?.classList.add('hidden');
      const fragment = document.createDocumentFragment();

      this.messageList.forEach(msg => {
        const msgEl = document.createElement('div');
        msgEl.className = `msg msg--${msg.role}`;
        msgEl.innerHTML = `
          <div class="msg__content">${this.formatMessage(msg.content)}</div>
          <div class="msg__meta">
            <span>${msg.model || (msg.role === 'user' ? 'You' : 'AI')}</span> •
            <span>${this.formatTime(msg.timestamp)}</span>
          </div>
        `;
        fragment.appendChild(msgEl);
      });

      this.messagesArea.appendChild(fragment);

      // Re-attach the active streaming bubble after history
      if (activeStream) {
        this.messagesArea.appendChild(activeStream);
      }

      this.messagesArea.scrollTo(0, this.messagesArea.scrollHeight);
    }

    // Keep the status bar message count accurate
    if (this.msgCountEl) {
      this.msgCountEl.textContent = `${this.messageList.length} message${this.messageList.length !== 1 ? 's' : ''}`;
    }
  }

  async loadConversation() {
    if (!this.currentTabId) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageTypes.GET_CONVERSATION,
        tabId: this.currentTabId
      });
      if (response && response.messages) {
        this.loadMessages(response.messages);
      }
    } catch (err) {
      console.error('[SidePanel] loadConversation failed:', err);
    }
  }

  sanitizeHtml(text) {
    if (!text) return '';
    // Comprehensive HTML sanitization
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  formatMessage(text) {
    if (!text) return '';
    // Basic markdown-ish formatting with sanitization
    const sanitized = this.sanitizeHtml(text);
    return sanitized
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code>$1</code>');
  }

  onInputChange() {
    if (this.sendBtn) {
      this.sendBtn.disabled = !this.promptInput?.value?.trim();
    }
  }

  onInputKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendPrompt();
    }
  }

  formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateProviderDisplay() {
    if (this.providerName) {
      this.providerName.textContent = this.currentProvider.name;
    }
    if (this.providerDot) {
      this.providerDot.style.background = this.currentProvider.color;
    }
  }

  showProviderMenu() {
    // Remove existing menu if present
    const existingMenu = document.querySelector('.provider-menu');
    if (existingMenu) {
      existingMenu.remove();
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'provider-menu';

    this.availableProviders.forEach(provider => {
      const option = document.createElement('button');
      option.className = 'provider-option';
      option.innerHTML = `
        <span class="provider-dot" style="background: ${provider.color}"></span>
        ${provider.name}
      `;
      option.addEventListener('click', () => {
        this.switchProvider(provider);
        menu.remove();
      });
      menu.appendChild(option);
    });

    // Position menu below the provider select button
    const rect = this.providerSelect.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.zIndex = '1000';

    document.body.appendChild(menu);

    // Close menu when clicking outside
    const closeMenu = (e) => {
      if (!menu.contains(e.target) && e.target !== this.providerSelect) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
  }

  async switchProvider(provider) {
    try {
      // Emit UI action event to data feed
      if (window.dataFeedManager?.isEnabled()) {
        window.dataFeedManager.emit('ui:action', {
          action: 'switch_provider',
          fromProvider: this.currentProvider?.id,
          toProvider: provider.id,
          tabId: this.currentTabId
        });
      }

      await Promise.all([
        chrome.runtime.sendMessage({
          type: 'PROVIDER_CHANGED',
          providerId: provider.id,
          tabId: this.currentTabId
        }),
        chrome.runtime.sendMessage({
          type: 'CLEAR_CONVERSATION',
          tabId: this.currentTabId
        })
      ]);
      this.currentProvider = provider;
      this.updateProviderDisplay();
      this.clearMessages();
      this.showToast(`Switched to ${provider.name}`);
    } catch (err) {
      console.error('[SidePanel] switchProvider failed:', err);
      this.showToast(`Failed to switch to ${provider.name}`);
    }

    this.logger.info(`Switched to provider: ${provider.name}`);
  }

  showToast(message) {
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
      existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    document.body.appendChild(toast);

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    
    this.toastTimeout = setTimeout(() => {
      toast.remove();
      this.toastTimeout = null;
    }, 3000);
  }

  async startNewConversation() {
    this.clearMessages();
    this.showToast('New conversation started');
    try {
      await chrome.runtime.sendMessage({
        type: 'START_NEW_CONVERSATION',
        tabId: this.currentTabId
      });
    } catch (err) {
      console.error('[SidePanel] startNewConversation failed:', err);
    }
  }

  async showHistory() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CONVERSATION_HISTORY',
        tabId: this.currentTabId
      });
      if (response && response.conversations) {
        this.displayHistoryModal(response.conversations);
      }
    } catch (err) {
      console.error('[SidePanel] showHistory failed:', err);
    }
  }

  displayHistoryModal(conversations) {
    const existing = document.querySelector('.history-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.className = 'history-modal';
    modal.innerHTML = `
      <div class="history-overlay"></div>
      <div class="history-content">
        <h3>Conversation History</h3>
        <div class="history-list">
          ${conversations.map(c => `
            <div class="history-item" data-id="${this.sanitizeHtml(c.id)}">
              <div class="history-title">${this.sanitizeHtml(c.title || 'Untitled')}</div>
              <div class="history-meta">${new Date(c.timestamp).toLocaleString()}</div>
            </div>
          `).join('')}
        </div>
        <button class="history-close" style="margin-top:12px;padding:8px 16px;background:var(--vivim-primary);color:white;border:none;border-radius:6px;cursor:pointer;">Close</button>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.history-overlay').addEventListener('click', () => modal.remove());
    modal.querySelector('.history-close').addEventListener('click', () => modal.remove());
    modal.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        this.loadConversationById(item.dataset.id);
        modal.remove();
      });
    });
  }

  async loadConversationById(conversationId) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'GET_CONVERSATION',
        conversationId: conversationId
      });
      if (response && response.messages) {
        this.loadMessages(response.messages);
      }
    } catch (err) {
      console.error('[SidePanel] loadConversationById failed:', err);
    }
  }

  showExportMenu() {
    const existing = document.querySelector('.export-menu');
    if (existing) {
      existing.remove();
      return;
    }

    const menu = document.createElement('div');
    menu.className = 'export-menu';
    menu.innerHTML = `
      <button data-format="json">Export as JSON</button>
      <button data-format="md">Export as Markdown</button>
      <button data-format="txt">Export as Text</button>
    `;

    const rect = document.getElementById('exportBtn').getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = `${rect.left - 80}px`;
    menu.style.top = `${rect.bottom + 4}px`;

    document.body.appendChild(menu);

    menu.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.exportConversation(btn.dataset.format);
        menu.remove();
      });
    });

    setTimeout(() => {
      document.addEventListener('click', function handler(e) {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener('click', handler);
        }
      });
    }, 0);
  }

  async exportConversation(format) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageTypes.GET_CONVERSATION,
        tabId: this.currentTabId
      });
      
      const messages = response?.messages || this.messageList;
      let content = '';
      let mimeType = 'text/plain';
      let extension = 'txt';

      switch (format) {
        case 'json':
          content = JSON.stringify(messages, null, 2);
          mimeType = 'application/json';
          extension = 'json';
          break;
        case 'md':
          content = messages.map(m => `## ${m.role === 'user' ? 'User' : 'Assistant'}\n\n${m.content}`).join('\n\n---\n\n');
          mimeType = 'text/markdown';
          extension = 'md';
          break;
        default:
          content = messages.map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n\n');
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vivim-conversation-${Date.now()}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);

      this.showToast(`Exported as ${format.toUpperCase()}`);
    } catch (err) {
      console.error('[SidePanel] Export failed:', err);
      this.showToast('Export failed');
    }
  }

  showPrivacySettings() {
    this.showSettingsModal();
  }

  showSettingsModal() {
    // Remove existing modal if present
    const existingModal = document.querySelector('.settings-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.className = 'settings-modal';
    modal.innerHTML = `
      <div class="settings-overlay"></div>
      <div class="settings-content">
        <div class="settings-header">
          <h3>Settings & Privacy</h3>
          <button class="settings-close" aria-label="Close settings">&times;</button>
        </div>
        <div class="settings-body">
          <div class="settings-section">
            <h4>Data Feed</h4>
            <p class="settings-description">
              Automatically capture and store all extension activity for debugging and analysis.
              Data is stored locally and never sent to external servers.
            </p>
            <div class="setting-item">
              <label class="setting-toggle">
                <input type="checkbox" id="dataFeedEnabled">
                <span class="toggle-slider"></span>
                Enable data feed
              </label>
            </div>
            <div class="setting-item data-feed-options" style="display: none;">
              <label>Storage Location:</label>
              <select id="dataFeedBackend">
                <option value="indexedDB">Local Storage (IndexedDB)</option>
                <option value="fileSystem">Choose Folder (File System)</option>
                <option value="chromeStorage">Extension Storage</option>
              </select>
              <button id="selectDataFolder" style="display: none;">Choose Folder</button>
            </div>
            <div class="setting-item data-feed-options" style="display: none;">
              <button id="exportDataFeed">Export Data</button>
              <button id="clearDataFeed">Clear Old Data (30+ days)</button>
            </div>
          </div>

          <div class="settings-section">
            <h4>Privacy</h4>
            <p class="settings-description">
              All conversations are stored locally on your device. No data is sent to external servers.
            </p>
            <div class="setting-item">
              <button id="exportConversations">Export All Conversations</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Add event listeners
    modal.querySelector('.settings-close').addEventListener('click', () => modal.remove());
    modal.querySelector('.settings-overlay').addEventListener('click', () => modal.remove());

    // Data feed settings
    const dataFeedEnabled = modal.querySelector('#dataFeedEnabled');
    const dataFeedBackend = modal.querySelector('#dataFeedBackend');
    const selectDataFolder = modal.querySelector('#selectDataFolder');
    const dataFeedOptions = modal.querySelectorAll('.data-feed-options');
    const exportDataFeed = modal.querySelector('#exportDataFeed');
    const clearDataFeed = modal.querySelector('#clearDataFeed');
    const exportConversations = modal.querySelector('#exportConversations');

    // Load current settings
    this.loadSettingsForModal(dataFeedEnabled, dataFeedBackend);

    // Toggle data feed options visibility
    dataFeedEnabled.addEventListener('change', async () => {
      const enabled = dataFeedEnabled.checked;
      dataFeedOptions.forEach(el => el.style.display = enabled ? 'block' : 'none');

      // Save setting
      await chrome.storage.sync.set({ dataFeedEnabled: enabled });
      if (window.dataFeedManager) {
        await window.dataFeedManager.setEnabled(enabled);
      }
    });

    // Backend selection
    dataFeedBackend.addEventListener('change', async () => {
      const backend = dataFeedBackend.value;
      selectDataFolder.style.display = backend === 'fileSystem' ? 'inline-block' : 'none';

      // Save setting
      await chrome.storage.sync.set({ dataFeedBackend: backend });
      if (window.dataFeedManager) {
        await window.dataFeedManager.setBackend(backend);
      }
    });

    // Select folder button
    selectDataFolder.addEventListener('click', async () => {
      try {
        if (window.dataFeedManager) {
          await window.dataFeedManager.setBackend('fileSystem', {});
          this.showToast('Data folder selected successfully');
        }
      } catch (error) {
        this.showToast('Failed to select data folder');
        console.error('Failed to select data folder:', error);
      }
    });

    // Export data feed
    exportDataFeed.addEventListener('click', async () => {
      try {
        if (window.dataFeedManager) {
          const data = await window.dataFeedManager.exportData('json');
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `vivim-data-feed-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
          this.showToast('Data feed exported successfully');
        }
      } catch (error) {
        this.showToast('Failed to export data feed');
        console.error('Failed to export data feed:', error);
      }
    });

    // Clear old data
    clearDataFeed.addEventListener('click', async () => {
      if (confirm('Clear data feed entries older than 30 days?')) {
        try {
          if (window.dataFeedManager) {
            await window.dataFeedManager.cleanup(30);
            this.showToast('Old data cleared successfully');
          }
        } catch (error) {
          this.showToast('Failed to clear old data');
          console.error('Failed to clear old data:', error);
        }
      }
    });

    // Export conversations
    exportConversations.addEventListener('click', async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'EXPORT_ALL_CONVERSATIONS'
        });
        if (response && response.data) {
          const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `vivim-conversations-${new Date().toISOString().split('T')[0]}.json`;
          a.click();
          URL.revokeObjectURL(url);
          this.showToast('Conversations exported successfully');
        }
      } catch (error) {
        this.showToast('Failed to export conversations');
        console.error('Failed to export conversations:', error);
      }
    });
  }

  async loadSettingsForModal(dataFeedEnabled, dataFeedBackend) {
    try {
      const settings = await chrome.storage.sync.get({
        dataFeedEnabled: false,
        dataFeedBackend: 'indexedDB'
      });

      dataFeedEnabled.checked = settings.dataFeedEnabled;
      dataFeedBackend.value = settings.dataFeedBackend;

      // Show/hide options based on enabled state
      const dataFeedOptions = document.querySelectorAll('.data-feed-options');
      dataFeedOptions.forEach(el => el.style.display = settings.dataFeedEnabled ? 'block' : 'none');

      // Show folder select button if fileSystem backend
      const selectDataFolder = document.querySelector('#selectDataFolder');
      if (selectDataFolder) {
        selectDataFolder.style.display = settings.dataFeedBackend === 'fileSystem' ? 'inline-block' : 'none';
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async reloadConversation() {
    this.updateConnectionStatus('connecting');
    await this.loadConversation();
    this.showToast('Conversation reloaded');
  }

  async clearConversation() {
    if (this.messageList.length === 0 || confirm('Clear all messages?')) {
      this.clearMessages();
      try {
        await chrome.runtime.sendMessage({
          type: 'CLEAR_CONVERSATION',
          tabId: this.currentTabId
        });
      } catch (err) {
        console.error('[SidePanel] clearConversation failed:', err);
      }
      this.showToast('Conversation cleared');
    }
  }

  async testCommunication() {
    console.log('[SidePanel] Testing communication with content script...');
    console.log('[SidePanel] Current tab ID:', this.currentTabId);

    if (!this.currentTabId) {
      this.showToast('No active tab found');
      return;
    }

    try {
      const response = await chrome.tabs.sendMessage(this.currentTabId, {
        type: 'TEST_COMMUNICATION',
        message: 'Hello from side panel',
        timestamp: Date.now()
      });
      console.log('[SidePanel] Test communication response:', response);
      this.showToast('Communication test: ' + (response?.success ? 'SUCCESS' : 'FAILED'));
    } catch (error) {
      console.error('[SidePanel] Test communication failed:', error);
      this.showToast('Communication test failed: ' + error.message);
    }
  }

  onSearch(query) {
    if (!query) {
      this.renderMessages();
      return;
    }

    const filtered = this.messageList.filter(m => 
      m.content.toLowerCase().includes(query.toLowerCase())
    );

    if (!this.messagesArea) return;
    this.messagesArea.innerHTML = '';

    if (filtered.length === 0) {
      this.messagesArea.innerHTML = '<div class="empty-state"><div class="empty-state__title">No matches found</div></div>';
    } else {
      const fragment = document.createDocumentFragment();
      filtered.forEach(msg => {
        const msgEl = document.createElement('div');
        msgEl.className = `msg msg--${msg.role}`;
        msgEl.innerHTML = `
          <div class="msg__content">${this.formatMessage(msg.content)}</div>
          <div class="msg__meta">
            <span>${msg.model || (msg.role === 'user' ? 'You' : 'AI')}</span> • 
            <span>${this.formatTime(msg.timestamp)}</span>
          </div>
        `;
        fragment.appendChild(msgEl);
      });
      this.messagesArea.appendChild(fragment);
    }

    // Update message count in status bar based on search results
    if (this.msgCountEl) {
      const count = query ? filtered.length : this.messageList.length;
      const total = this.messageList.length;
      if (query && filtered.length !== total) {
        this.msgCountEl.textContent = `${count} of ${total} messages`;
      } else {
        this.msgCountEl.textContent = `${total} message${total !== 1 ? 's' : ''}`;
      }
    }
  }

  destroy() {
    // Clean up heartbeat timer to prevent memory leaks
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    // Clean up any pending toast timeouts
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
      this.toastTimeout = null;
    }

    // Clean up streaming message if active
    this.cleanupStreamingMessage();

    // Remove event listeners and cleanup references
    if (this.promptInput) {
      this.promptInput.removeEventListener('input', this.onInputChange);
      this.promptInput.removeEventListener('keydown', this.onInputKeyDown);
    }

    if (this.sendBtn) {
      this.sendBtn.removeEventListener('click', this.sendPrompt);
    }

    // Additional cleanup could be added here for other event listeners
  }
}