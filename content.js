(function init() {
  if (window.__vivimPocInitialized) return;
  window.__vivimPocInitialized = true;

  const telemetry = window.__vivimTelemetry = {
    track: function() {
      if (typeof VIVIMTelemetry !== 'undefined') {
        VIVIMTelemetry.track.apply(VIMIMTelemetry, arguments);
      }
    },
    trackFeatureUsed: function(name, props) {
      if (typeof VIVIMTelemetry !== 'undefined') {
        VIVIMTelemetry.trackFeatureUsed(name, props);
      }
    },
    trackError: function(err, ctx) {
      if (typeof VIVIMTelemetry !== 'undefined') {
        VIVIMTelemetry.trackError(err, ctx);
      }
    },
    trackAction: function(act, props) {
      if (typeof VIVIMTelemetry !== 'undefined') {
        VIVIMTelemetry.trackAction(act, props);
      }
    }
  };

  console.log("[VIVIM POC] 🔍 Checking chrome runtime...", { 
    hasChrome: typeof chrome !== "undefined",
    hasRuntime: typeof chrome !== "undefined" && typeof chrome.runtime !== "undefined",
    hasSendMessage: typeof chrome !== "undefined" && chrome.runtime?.sendMessage !== undefined,
    hasRuntimeId: typeof chrome !== "undefined" && chrome.runtime?.id !== undefined,
    manifestId:typeof chrome !== "undefined" && chrome.runtime?.id || "NO_ID"
  });

  if (typeof chrome === "undefined" || !chrome.runtime) {
    console.error("[VIVIM POC] ❌ Chrome runtime NOT available - extension may not be loaded");
    return;
  }

  if (!chrome.runtime.sendMessage) {
    console.error("[VIVIM POC] ❌ chrome.runtime.sendMessage NOT available");
    return;
  }

  console.log("[VIVIM POC] ✅ Chrome runtime available, extension ID:", chrome.runtime.id);
  console.log("[VIVIM POC] Initialized");
  if (telemetry) telemetry.trackAction('content_loaded');

  // Setup Web-Bridge Peer to communicate with inject-web.js
  window.addEventListener("message", (e) => {
    const timestamp = Date.now();
    
    if (!e.data) {
      console.log("[VIVIM content] ❌ No e.data in message event", { timestamp });
      return;
    }
    
    if (e.data.type !== "web-bridge") {
      console.log("[VIVIM content] ❌ Not web-bridge type", { type: e.data.type, timestamp });
      return;
    }
    
    console.log("[VIVIM content] 📥 Received web-bridge message", { 
      action: e.data.action, 
      communicationId: e.data.communicationId,
      needResponse: e.data.needResponse,
      timestamp 
    });
    
    if (e.data.communicationId !== "inject-chat-web") {
      console.log("[VIVIM content] ❌ Wrong communicationId", { 
        expected: "inject-chat-web", 
        received: e.data.communicationId 
      });
      return;
    }

    // Respond to handshake
    if (e.data.action === "__handshake__") {
      console.log("[VIVIM content] 🤝 Handshake request received", { 
        requestId: e.data.id, 
        timestamp: Date.now(),
        communicationId: e.data.communicationId
      });
      window.postMessage({
        type: "web-bridge",
        communicationId: "saveai-extension-content",
        id: crypto.randomUUID(),
        requestId: e.data.id,
        success: true,
        data: { success: true, timestamp: Date.now() },
        timestamp: Date.now()
      }, "*");
      console.log("[VIVIM content] ✅ Handshake response sent", { 
        requestId: e.data.id, 
        timestamp: Date.now() 
      });
    }

    // Forward user prompts to background
    if (e.data.action === "userPrompt" && e.data.data) {
      console.log("[VIVIM content] 📦 Forwarding userPrompt to background", { 
        ...e.data.data,
        timestamp: Date.now(),
        url: window.location.href.slice(0, 50)
      });
      
      if (!chrome.runtime?.sendMessage) {
        console.error("[VIVIM content] ❌ chrome.runtime.sendMessage is UNDEFINED at sendMessage call time!", { 
          hasChrome: typeof chrome,
          hasRuntime: typeof chrome?.runtime,
          sendMessageFn: typeof chrome?.runtime?.sendMessage 
        });
        return;
      }
      
      chrome.runtime.sendMessage({
        type: "USER_PROMPT",
        content: e.data.data.content,
        conversationId: e.data.data.conversationId,
        timestamp: Date.now()
      }).then(() => {
        console.log("[VIVIM content] ✅ USER_PROMPT delivered to background", { 
          contentLength: e.data.data.content?.length,
          timestamp: Date.now()
        });
      }).catch((err) => console.error("[VIVIM content] ❌ Failed to send USER_PROMPT:", err));
    }

    // Forward chat chunks to background
    if (e.data.action === "chatChunk" && e.data.data) {
      const chunk = e.data.data;
      console.log("[VIVIM content] 📦 Forwarding chatChunk to background", {
        role: chunk.role,
        contentLength: chunk.content?.length,
        model: chunk.model,
        seq: chunk.seq,
        cumulative: chunk.cumulative,
        timestamp: Date.now()
      });
      chrome.runtime.sendMessage({
        type: "STREAM_CHUNK",
        ...chunk
      }).then(() => {
        console.log("[VIVIM content] ✅ STREAM_CHUNK delivered", { 
          seq: chunk.seq,
          contentLength: chunk.content?.length,
          timestamp: Date.now()
        });
      }).catch((err) => {
        console.error("[VIVIM content] ❌ Failed to send STREAM_CHUNK:", err);
      });
    }

    // Forward stream complete to background
    if (e.data.action === "streamComplete") {
      console.log("[VIVIM content] 📦 Forwarding streamComplete to background", {
        streamId: e.data.data?.streamId,
        timestamp: Date.now()
      });
      chrome.runtime.sendMessage({
        type: "STREAM_COMPLETE",
        streamId: e.data.data?.streamId
      }).then(() => {
        console.log("[VIVIM content] ✅ STREAM_COMPLETE delivered", { 
          streamId: e.data.data?.streamId,
          timestamp: Date.now()
        });
      }).catch((err) => console.error("[VIVIM content] ❌ Failed to send STREAM_COMPLETE:", err));
    }
  });
})();

function observeChatGPTDOM() {
  const TARGET_SELECTOR = '[aria-label="Response actions"]';

  const observer = new MutationObserver(() => {
    const elements = document.querySelectorAll(
      `${TARGET_SELECTOR}:not([data-vivim-injected])`
    );

    if (elements.length === 0) return;

    console.log("[VIVIM POC] Found response action containers:", elements.length);

    elements.forEach((el) => {
      el.setAttribute("data-vivim-injected", "true");
      injectButton(el);
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  console.log("[VIVIM POC] DOM observer started");
}

function injectButton(container) {
  try {
    const btn = document.createElement("button");
    btn.innerText = "Save";
    btn.style.marginLeft = "8px";
    btn.style.fontSize = "12px";
    btn.style.cursor = "pointer";
    btn.style.padding = "4px 8px";
    btn.style.borderRadius = "4px";
    btn.style.border = "1px solid #2A2A45";
    btn.style.background = "#161625";
    btn.style.color = "#E8E8F0";

    btn.onclick = (e) => {
      e.stopPropagation();
      console.log("[VIVIM POC] Save clicked");

      // Find the parent message element to get content
      const messageEl = container.closest('[data-message-author]');
      let content = "";

      if (messageEl) {
        // Try to get text content from the message
        const textContent = messageEl.querySelector('[data-message-content]');
        if (textContent) {
          content = textContent.textContent || "";
        }
      }

      chrome.runtime.sendMessage({
        type: "SAVE_FROM_DOM",
        content: content,
        timestamp: Date.now(),
      }).catch((err) => console.warn("[VIVIM content] Failed to send SAVE_FROM_DOM:", err));
    };

    container.appendChild(btn);
  } catch (e) {
    console.warn("[VIVIM POC] Injection failed:", e);
  }
}

// Start observer when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", observeChatGPTDOM);
} else {
  observeChatGPTDOM();
}