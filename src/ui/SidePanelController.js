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
    this.logger = console;

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

    this.bindEvents();
    this.initializeWithCurrentTab();
    this.updateConnectionStatus('connecting');
    this.updateProviderDisplay();
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
    // Input events
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

    // Header buttons
    this.bindHeaderButtons();

    // Toolbar
    this.bindToolbar();
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
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && tabs[0].id) {
        this.currentTabId = tabs[0].id;
        await this.loadConversation();
      }
    } catch (err) {
      console.error('[SidePanel] Failed to get current tab:', err);
    }
    
    this.checkBackgroundConnection();
  }
  
  async checkBackgroundConnection() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'PING', component: 'sidepanel' });
      console.log('[SidePanel] Background ping response:', response);
      if (response && response.status === 'ok') {
        this.updateConnectionStatus('connected');
      } else {
        this.updateConnectionStatus('error');
      }
    } catch (err) {
      console.error('[SidePanel] Background ping failed:', err);
      this.updateConnectionStatus('error');
    }
  }

  handleMessage(message, sender, sendResponse) {
    console.log('[SidePanel] Received message:', message.type, message);

    if (message.tabId && message.tabId !== this.currentTabId) {
      console.log('[SidePanel] Ignoring message for different tab:', message.tabId, 'current:', this.currentTabId);
      return;
    }

    if (message.tabId === undefined && message.type !== MessageTypes.CONVERSATION_CLEARED) {
      console.log('[SidePanel] Broadcasting - no tabId specified, processing anyway');
    }

    switch (message.type) {
      case MessageTypes.MESSAGE_ADDED:
        this.updateConnectionStatus('connected');
        this.addMessage(message.role, message.content, message.model, message.timestamp);
        break;

      case MessageTypes.STREAM_UPDATE:
        this.updateConnectionStatus('streaming');
        this.updateStreamingMessage(message.content, message.model, message.seq, message.isFinal);
        break;

      case MessageTypes.STREAM_COMPLETE:
        this.updateConnectionStatus('connected');
        this.finalizeStreamingMessage();
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

    console.log('[SidePanel] Sending prompt:', text, 'to tab:', this.currentTabId);

    this.promptInput.value = '';
    this.onInputChange();

    // Send USER_PROMPT to background for display
    chrome.runtime.sendMessage({
      type: MessageTypes.USER_PROMPT,
      content: text,
      conversationId: null, // Will be set by background based on tab
      timestamp: Date.now()
    }).then(() => {
      console.log('[SidePanel] USER_PROMPT sent successfully');
    }).catch((error) => {
      this.logger.error('[SidePanel] Failed to send USER_PROMPT:', error);
    });

    try {
      // Inject into the appropriate provider interface
      await this.injectPromptIntoProvider(text);
    } catch (error) {
      this.logger.error('[SidePanel] Send failed:', error);
    }
  }

  addMessage(role, content, model, timestamp) {
    this.messageList.push({ role, content, model, timestamp });
    this.renderMessages();
  }

  updateStreamingMessage(content, model, seq, isFinal = false) {
    if (!this.streamingMessage) {
      this.streamingMessage = document.createElement('div');
      this.streamingMessage.className = 'msg msg--assistant msg--streaming';
      const contentEl = document.createElement('div');
      contentEl.className = 'msg__content';
      this.streamingMessage.appendChild(contentEl);
      this.messagesArea?.appendChild(this.streamingMessage);
      this.emptyState?.classList.add('hidden');
    }

    const contentEl = this.streamingMessage.querySelector('.msg__content');
    if (contentEl) {
      contentEl.innerHTML = this.formatMessage(content);
    }
    
    this.messagesArea?.scrollTo({
      top: this.messagesArea.scrollHeight,
      behavior: 'auto'
    });

    if (isFinal) {
      this.finalizeStreamingMessage(model);
    }
  }

  finalizeStreamingMessage(model) {
    if (this.streamingMessage) {
      // Convert streaming message to regular message by removing streaming class
      this.streamingMessage.classList.remove('msg--streaming');

      // Add metadata if available
      if (!this.streamingMessage.querySelector('.msg__meta')) {
        const metaEl = document.createElement('div');
        metaEl.className = 'msg__meta';
        metaEl.innerHTML = `<span>${model || 'AI'}</span> • <span>${this.formatTime(Date.now())}</span>`;
        this.streamingMessage.appendChild(metaEl);
      }

      // Reset streaming state - don't remove the element, it becomes a regular message
      this.streamingMessage = null;
    }
  }

  clearMessages() {
    this.messageList = [];
    this.renderMessages();
  }

  loadMessages(messages) {
    this.messageList = messages || [];
    this.renderMessages();
  }

  renderMessages() {
    if (!this.messagesArea) return;

    this.messagesArea.innerHTML = '';

    if (this.messageList.length === 0) {
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
      this.messagesArea.scrollTo(0, this.messagesArea.scrollHeight);
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

  formatMessage(text) {
    if (!text) return '';
    // Basic markdown-ish formatting
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
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
    this.currentProvider = provider;
    this.updateProviderDisplay();

    try {
      await chrome.runtime.sendMessage({
        type: 'PROVIDER_CHANGED',
        providerId: provider.id,
        tabId: this.currentTabId
      });
    } catch (err) {
      console.error('[SidePanel] switchProvider failed:', err);
    }

    this.clearMessages();
    this.showToast(`Switched to ${provider.name}`);

    this.logger.info(`Switched to provider: ${provider.name}`);
  }

  async injectPromptIntoProvider(prompt) {
    const injectionScripts = {
      chatgpt: (prompt) => {
        // Inject prompt into ChatGPT textarea
        const textarea = document.querySelector('form textarea');
        if (textarea) {
          textarea.value = prompt;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));

          setTimeout(() => {
            const enterEvent = new KeyboardEvent('keydown', {
              bubbles: true,
              key: 'Enter',
              code: 'Enter',
              keyCode: 13
            });
            textarea.dispatchEvent(enterEvent);
          }, 200);
        }
      },
      claude: (prompt) => {
        // Inject prompt into Claude textarea
        const textarea = document.querySelector('[data-testid="prompt-textarea"]') ||
                        document.querySelector('textarea[placeholder*="Ask Claude"]') ||
                        document.querySelector('form textarea');
        if (textarea) {
          textarea.value = prompt;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));

          setTimeout(() => {
            const submitBtn = document.querySelector('button[data-testid="send-button"]') ||
                             document.querySelector('button[aria-label*="Send"]') ||
                             document.querySelector('form button[type="submit"]');
            if (submitBtn) {
              submitBtn.click();
            }
          }, 200);
        }
      },
      gemini: (prompt) => {
        // Inject prompt into Gemini textarea
        const textarea = document.querySelector('rich-textarea')?.shadowRoot?.querySelector('textarea') ||
                        document.querySelector('textarea[aria-label*="Ask Gemini"]') ||
                        document.querySelector('textarea[placeholder*="Ask Gemini"]');
        if (textarea) {
          textarea.value = prompt;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));

          setTimeout(() => {
            const sendBtn = document.querySelector('button[aria-label*="Send"]') ||
                           document.querySelector('button[data-testid*="send"]') ||
                           document.querySelector('form button[type="submit"]');
            if (sendBtn) {
              sendBtn.click();
            }
          }, 200);
        }
      }
    };

    const script = injectionScripts[this.currentProvider.id];
    if (!script) {
      this.logger.warn(`No injection script for provider: ${this.currentProvider.id}`);
      return;
    }

    if (!this.currentTabId) {
      this.logger.error('[SidePanel] No currentTabId for injection');
      return;
    }

    try {
      await chrome.scripting.executeScript({
        target: { tabId: this.currentTabId },
        func: script,
        args: [prompt]
      });
    } catch (error) {
      this.logger.error('[SidePanel] Script injection failed:', error);
      throw error;
    }
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

    setTimeout(() => {
      toast.remove();
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
            <div class="history-item" data-id="${c.id}">
              <div class="history-title">${c.title || 'Untitled'}</div>
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
    const messages = this.messageList;
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
  }

  showPrivacySettings() {
    this.showToast('Privacy settings coming soon');
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
        msgEl.innerHTML = `<div class="msg__content">${this.formatMessage(msg.content)}</div>`;
        fragment.appendChild(msgEl);
      });
      this.messagesArea.appendChild(fragment);
    }
  }
}