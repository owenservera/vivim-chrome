import { StorageManager } from '../core/storage/StorageManager.js';
import { ContentScriptFetch } from './fetch/ContentScriptFetch.js';
import { stealthFetchManager } from './fetch/StealthFetchManager.js';

(function init() {
  console.log('[Content] ===== VIVIM CONTENT SCRIPT LOADING =====');
  console.log('[Content] Current URL:', window.location.href);
  console.log('[Content] Chrome runtime available:', typeof chrome !== 'undefined' && !!chrome.runtime);

  if (window.__vivimContentInitialized) {
    console.log('[Content] Content script already initialized, skipping');
    return;
  }
  window.__vivimContentInitialized = true;

  console.log('[Content] Initializing modular content script...');

  // Initialize and expose storageManager on window for providers
  window.storageManager = new StorageManager(chrome.storage.local);
  console.log('[Content] StorageManager initialized on window');

  window.__vivimTelemetry = {
    track: function() {
      if (typeof VIVIMTelemetry !== 'undefined') {
        VIVIMTelemetry.track.apply(VIVIMTelemetry, arguments);
      }
    },
    trackAction: function(act, props) {
      if (typeof VIVIMTelemetry !== 'undefined') {
        VIVIMTelemetry.trackAction(act, props);
      }
    }
  };

  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('[Content] Chrome runtime not available');
    return;
  }

  console.log('[Content] Chrome runtime available, extension ID:', chrome.runtime.id);

  setupWebBridge();
  setupSaveButtonInjection();
  setupContentScriptFetch();
  setupRuntimeMessageHandling();

  window.__vivimTelemetry.trackAction('content_loaded');
  console.log('[Content] Initialization complete');

})();

function setupWebBridge() {
  console.log('[Content] Initializing web bridge...');
  
  window.addEventListener('message', (event) => {
    const data = event.data;
    console.log('[Content] Message event:', data);
    
    // Only process vivim-bridge messages from the MAIN world
    if (!data || data.type !== 'vivim-bridge' || data.communicationId !== 'vivim-bridge') {
      return;
    }
    
    // Ignore responses to our own messages (no action = it's a response)
    if (!data.action) {
      console.log('[Content] Ignoring response message');
      return;
    }
    
    console.log('[Content] Bridge event received:', data.action, 'requestId:', data.requestId);
    
    // Handle Handshake
    if (data.action === '__handshake__') {
      console.log('[Content] Responding to handshake, requestId:', data.id);
      const response = {
        type: 'vivim-bridge',
        communicationId: 'vivim-bridge',
        requestId: data.id,
        success: true,
        data: { success: true, timestamp: Date.now() },
        timestamp: Date.now()
      };
      console.log('[Content] Sending handshake response:', response);
      window.postMessage(response, '*');
      return;
    }
    
    // Forward actions to Background
    const typeMap = {
      'userPrompt': 'USER_PROMPT',
      'chatChunk': 'STREAM_CHUNK',
      'streamComplete': 'STREAM_COMPLETE'
    };
    
    const backgroundType = typeMap[data.action];
    if (backgroundType) {
      console.log(`[Content] Forwarding ${data.action} -> ${backgroundType}`);
      chrome.runtime.sendMessage({
        type: backgroundType,
        ...data.data,
        timestamp: Date.now()
      }).catch(err => console.error('[Content] Bridge forward failed:', err));
    }
  });
}

function setupSaveButtonInjection() {
  function startObserver() {
    if (!document.body) {
      requestAnimationFrame(startObserver);
      return;
    }

    const observer = new MutationObserver(() => {
      const elements = document.querySelectorAll('[aria-label="Response actions"]:not([data-vivim-injected])');

      if (elements.length === 0) return;

      console.log('[Content] Found response action containers:', elements.length);

      elements.forEach((el) => {
        el.setAttribute('data-vivim-injected', 'true');
        injectSaveButton(el);
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[Content] DOM observer started');
  }

  startObserver();
}

function injectSaveButton(container) {
  try {
    const btn = document.createElement('button');
    btn.innerText = 'Save';
    btn.style.marginLeft = '8px';
    btn.style.fontSize = '12px';
    btn.style.cursor = 'pointer';
    btn.style.padding = '4px 8px';
    btn.style.borderRadius = '4px';
    btn.style.border = '1px solid #2A2A45';
    btn.style.background = '#161625';
    btn.style.color = '#E8E8F0';

    btn.onclick = (e) => {
      e.stopPropagation();
      console.log('[Content] Save clicked');

      const messageEl = container.closest('[data-message-author]');
      let content = '';

      if (messageEl) {
        const textContent = messageEl.querySelector('[data-message-content]');
        if (textContent) {
          content = textContent.textContent || '';
        }
      }

      chrome.runtime.sendMessage({
        type: 'SAVE_FROM_DOM',
        content: content,
        timestamp: Date.now(),
      }).catch((err) => console.warn('[Content] Failed to send SAVE_FROM_DOM:', err));
    };

    container.appendChild(btn);
  } catch (e) {
    console.warn('[Content] Injection failed:', e);
  }
}

function setupContentScriptFetch() {
  console.log('[Content] Initializing content script fetch...');

  try {
    const contentScriptFetch = new ContentScriptFetch();
    contentScriptFetch.init();
    console.log('[Content] Content script fetch initialized');
  } catch (error) {
    console.error('[Content] Failed to initialize content script fetch:', error);
  }
}

function setupRuntimeMessageHandling() {
  console.log('[Content] Setting up runtime message handling...');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Content] Received runtime message:', message.type);

    if (message.type === 'PING') {
      sendResponse({ success: true, timestamp: Date.now() });
      return true;
    }

    if (message.type === 'TEST_COMMUNICATION') {
      console.log('[Content] Received test communication:', message);
      sendResponse({ success: true, message: 'Hello from content script', url: window.location.href });
      return true;
    }

    if (message.type === 'INJECT_PROMPT') {
      console.log('[Content] Injecting prompt for provider:', message.provider);
      console.log('[Content] Prompt text length:', message.prompt?.length || 0);

      try {
        injectPromptIntoPage(message.provider, message.prompt);
        console.log('[Content] Prompt injection completed successfully');
        sendResponse({ success: true });
      } catch (error) {
        console.error('[Content] Failed to inject prompt:', error);
        console.error('[Content] Injection error details:', error.message, error.stack);
        sendResponse({ success: false, error: error.message });
      }

      return true; // Keep the message channel open for async response
    }
  });
}

function injectPromptIntoPage(provider, prompt) {
  console.log('[Content] Starting prompt injection for provider:', provider);
  console.log('[Content] Prompt text:', prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''));

  const injectionScripts = {
    chatgpt: (prompt) => {
      console.log('[Content] Looking for ChatGPT textarea...');

      // Try multiple selectors for ChatGPT textarea
      let textarea = document.querySelector('form textarea') ||
                    document.querySelector('textarea[placeholder*="Ask"]') ||
                    document.querySelector('textarea[placeholder*="Send a message"]') ||
                    document.querySelector('textarea[data-testid*="prompt"]') ||
                    document.querySelector('#prompt-textarea') ||
                    document.querySelector('textarea');

      console.log('[Content] Found ChatGPT textarea:', !!textarea);
      if (textarea) {
        console.log('[Content] Textarea element:', textarea);
        console.log('[Content] Textarea placeholder:', textarea.placeholder);
      }

      if (textarea) {
        console.log('[Content] Setting textarea value and dispatching input event');
        textarea.value = prompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));

        // Also try to focus the textarea
        textarea.focus();

        const getSubmitBtn = () => document.querySelector('button[data-testid="send-button"]') ||
                             document.querySelector('button[aria-label*="Send"]') ||
                             document.querySelector('form button[type="submit"]') ||
                             document.querySelector('button:has(svg)');

        waitForSubmitAndClick(textarea, getSubmitBtn, true);
      } else {
        console.error('[Content] ChatGPT textarea not found! Available textareas:');
        const allTextareas = document.querySelectorAll('textarea');
        console.log('[Content] Found textareas:', allTextareas.length);
        allTextareas.forEach((ta, i) => {
          console.log(`[Content] Textarea ${i}:`, ta.placeholder, ta.id, ta.className);
        });
      }
    },
    claude: (prompt) => {
      const textarea = document.querySelector('[data-testid="prompt-textarea"]') ||
                      document.querySelector('textarea[placeholder*="Ask Claude"]') ||
                      document.querySelector('form textarea');
      if (textarea) {
        textarea.value = prompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        const getSubmitBtn = () => document.querySelector('button[data-testid="send-button"]') ||
                             document.querySelector('button[aria-label*="Send"]') ||
                             document.querySelector('form button[type="submit"]');
        
        waitForSubmitAndClick(textarea, getSubmitBtn, true);
      }
    },
    gemini: (prompt) => {
      const textarea = document.querySelector('rich-textarea')?.shadowRoot?.querySelector('textarea') ||
                      document.querySelector('textarea[aria-label*="Ask Gemini"]') ||
                      document.querySelector('textarea[placeholder*="Ask Gemini"]');
      if (textarea) {
        textarea.value = prompt;
        textarea.dispatchEvent(new Event('input', { bubbles: true }));

        const getSubmitBtn = () => document.querySelector('button[aria-label*="Send"]') ||
                         document.querySelector('button[data-testid*="send"]') ||
                         document.querySelector('form button[type="submit"]');

        waitForSubmitAndClick(textarea, getSubmitBtn, true);
      }
    }
  };

  const injectScript = injectionScripts[provider];
  if (injectScript) {
    injectScript(prompt);
  } else {
    console.warn('[Content] No injection script for provider:', provider);
  }
}

function waitForSubmitAndClick(textarea, getSubmitBtnFn, fallbackToEnter = true) {
  let attempts = 0;
  const maxAttempts = 20; // up to 2 seconds

  function attemptClick() {
    attempts++;
    const submitBtn = getSubmitBtnFn();
    
    if (submitBtn && !submitBtn.disabled && submitBtn.getAttribute('aria-disabled') !== 'true') {
      console.log('[Content] Found enabled submit button, clicking it');
      submitBtn.click();
      return;
    }
    
    if (attempts < maxAttempts) {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));
      setTimeout(attemptClick, 100);
    } else {
      console.log('[Content] No enabled submit button found after polling, simulating Enter key');
      if (fallbackToEnter) {
        const enterEvent = new KeyboardEvent('keydown', {
          bubbles: true,
          cancelable: true,
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13
        });
        textarea.dispatchEvent(enterEvent);
      }
    }
  }

  setTimeout(attemptClick, 50);
}