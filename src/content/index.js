(function init() {
  if (window.__vivimContentInitialized) return;
  window.__vivimContentInitialized = true;

  console.log('[Content] Initializing modular content script...');

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

  window.__vivimTelemetry.trackAction('content_loaded');
  console.log('[Content] Initialization complete');

})();

function setupWebBridge() {
  console.log('[Content] Initializing web bridge...');
  
  window.addEventListener('message', (event) => {
    const data = event.data;
    
    // Only process vivim-bridge messages from the MAIN world
    if (!data || data.type !== 'vivim-bridge' || data.communicationId !== 'vivim-bridge') {
      return;
    }
    
    console.log('[Content] Bridge event received:', data.action);
    
    // Handle Handshake
    if (data.action === '__handshake__') {
      console.log('[Content] Responding to handshake');
      window.postMessage({
        type: 'vivim-bridge',
        communicationId: 'vivim-content',
        action: '__handshake__',
        requestId: data.id,
        timestamp: Date.now()
      }, '*');
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