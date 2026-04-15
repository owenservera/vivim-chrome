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
    // Get DOM references
    this.messagesArea = document.getElementById('messagesArea');
    this.emptyState = document.getElementById('emptyState');
    this.promptInput = document.getElementById('promptInput');
    this.sendBtn = document.getElementById('sendBtn');

    // Bind events
    this.bindEvents();

    // Initialize with current tab
    this.initializeWithCurrentTab();
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
  }

  handleMessage(message, sender, sendResponse) {
    console.log('[SidePanel] Received message:', message.type, message);

    // Only process messages for current tab
    if (message.tabId && message.tabId !== this.currentTabId) {
      console.log('[SidePanel] Ignoring message for different tab:', message.tabId, 'current:', this.currentTabId);
      return;
    }

    switch (message.type) {
      case MessageTypes.MESSAGE_ADDED:
        this.addMessage(message.role, message.content, message.model, message.timestamp);
        break;

      case MessageTypes.STREAM_UPDATE:
        this.updateStreamingMessage(message.content, message.model, message.seq, message.isFinal);
        break;

      case MessageTypes.STREAM_COMPLETE:
        this.finalizeStreamingMessage();
        break;

      case MessageTypes.CONVERSATION_CLEARED:
        this.clearMessages();
        break;

      case MessageTypes.CONVERSATION_LOADED:
        this.loadMessages(message.messages);
        break;
    }
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
      this.messagesArea?.appendChild(this.streamingMessage);
      this.emptyState?.classList.add('hidden');
    }

    this.streamingMessage.textContent = content;
    this.messagesArea?.scrollTo(0, this.messagesArea.scrollHeight);

    // If this is the final chunk, finalize immediately
    if (isFinal) {
      this.finalizeStreamingMessage();
    }
  }

  finalizeStreamingMessage() {
    if (this.streamingMessage) {
      // Convert streaming message to regular message by removing streaming class
      this.streamingMessage.classList.remove('msg--streaming');

      // Add metadata if available
      if (!this.streamingMessage.querySelector('.msg__meta')) {
        const metaEl = document.createElement('div');
        metaEl.className = 'msg__meta';
        const timeSpan = document.createElement('span');
        timeSpan.textContent = this.formatTime(Date.now());
        metaEl.appendChild(timeSpan);
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
      this.messageList.forEach(msg => {
        const msgEl = document.createElement('div');
        msgEl.className = `msg msg--${msg.role}`;
        msgEl.innerHTML = `<div class="msg__content">${this.escapeHtml(msg.content)}</div>`;
        this.messagesArea.appendChild(msgEl);
      });
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