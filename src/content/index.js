/**
 * Content Script - Main Entry Point
 * Handles DOM injection and communication with background
 */

(function init() {
  if (window.__vivimContentInitialized) return;
  window.__vivimContentInitialized = true;

  console.log('[Content] Initializing modular content script...');

  // Set up telemetry
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

  // Verify extension context
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.error('[Content] Chrome runtime not available');
    return;
  }

  console.log('[Content] Chrome runtime available, extension ID:', chrome.runtime.id);

  // Set up web-bridge for communication with inject-web.js
  setupWebBridge();

  // Inject save button observer
  setupSaveButtonInjection();

  // Track initialization
  window.__vivimTelemetry.trackAction('content_loaded');

  console.log('[Content] Initialization complete');

})();

/**
 * Set up web-bridge communication with inject-web.js
 */
function setupWebBridge() {
  window.addEventListener('message', (event) => {
    const timestamp = Date.now();

    if (!event.data || event.data.type !== 'web-bridge') {
      return;
    }

    if (event.data.communicationId !== 'inject-chat-web') {
      return;
    }

    console.log('[Content] Received web-bridge message:', event.data.action);

    // Handle handshake
    if (event.data.action === '__handshake__') {
      console.log('[Content] Responding to handshake');
      window.postMessage({
        type: 'web-bridge',
        communicationId: 'saveai-extension-content',
        id: crypto.randomUUID(),
        requestId: event.data.id,
        success: true,
        data: { success: true, timestamp },
        timestamp
      }, '*');
      return;
    }

    // Forward user prompts to background
    if (event.data.action === 'userPrompt' && event.data.data) {
      console.log('[Content] Forwarding userPrompt to background');

      chrome.runtime.sendMessage({
        type: 'USER_PROMPT',
        content: event.data.data.content,
        conversationId: event.data.data.conversationId,
        timestamp: Date.now()
      }).catch((err) => console.error('[Content] Failed to send USER_PROMPT:', err));
    }

    // Forward chat chunks to background
    if (event.data.action === 'chatChunk' && event.data.data) {
      const chunk = event.data.data;
      console.log('[Content] Forwarding chatChunk to background');

      chrome.runtime.sendMessage({
        type: 'STREAM_CHUNK',
        ...chunk
      }).catch((err) => console.error('[Content] Failed to send STREAM_CHUNK:', err));
    }

    // Forward stream complete to background
    if (event.data.action === 'streamComplete') {
      console.log('[Content] Forwarding streamComplete to background');

      chrome.runtime.sendMessage({
        type: 'STREAM_COMPLETE',
        streamId: event.data.data?.streamId
      }).catch((err) => console.error('[Content] Failed to send STREAM_COMPLETE:', err));
    }
  });
}

/**
 * Set up save button injection observer
 */
function setupSaveButtonInjection() {
  // Wait for body to be available
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

  // Start immediately, will retry if body not ready
  startObserver();
}

/**
 * Inject save button into ChatGPT interface
 */
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

      // Find message content
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