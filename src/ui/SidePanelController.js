import { MessageTypes } from '../core/messaging/MessageTypes.js';

/**
 * Side Panel Controller - Main UI orchestrator
 * Coordinates all UI components and handles user interactions
 */
export class SidePanelController {
  constructor() {
    this.currentTabId = null;
    this.currentProvider = { id: 'chatgpt', name: 'ChatGPT', color: '#10A37F' };
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

    this.bindEvents();
    this.initializeWithCurrentTab();
    this.updateConnectionStatus('connecting');
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

    // Tab switching
    chrome.tabs.onActivated.addListener((activeInfo) => {
      this.currentTabId = activeInfo.tabId;
      this.loadConversation();
    });
  }

  async initializeWithCurrentTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) {
      this.currentTabId = tabs[0].id;
      this.loadConversation();
    }
    
    // Ping background to check connection
    this.checkBackgroundConnection();
  }
  
  async checkBackgroundConnection() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'PING' });
      console.log('[SidePanel] Background ping response:', response);
      if (response && response.status === 'ok') {
        this.updateConnectionStatus('connected');
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
      // Also inject into ChatGPT
      await chrome.scripting.executeScript({
        target: { tabId: this.currentTabId },
        func: (prompt) => {
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
        args: [text]
      });
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

    chrome.runtime.sendMessage({
      type: MessageTypes.GET_CONVERSATION,
      tabId: this.currentTabId
    }, (response) => {
      if (response && response.messages) {
        this.loadMessages(response.messages);
      }
    });
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
}