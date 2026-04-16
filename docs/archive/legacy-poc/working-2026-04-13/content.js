(function init() {
  if (window.__vivimPocInitialized) return;
  window.__vivimPocInitialized = true;

  console.log("[VIVIM POC] Initialized");

  // Setup Web-Bridge Peer to communicate with inject-web.js
  window.addEventListener("message", (e) => {
    if (!e.data || e.data.type !== "web-bridge") return;
    if (e.data.communicationId !== "inject-chat-web") return;

    // Respond to handshake
    if (e.data.action === "__handshake__") {
      console.log("[VIVIM content] 🤝 Handshake received, responding...");
      window.postMessage({
        type: "web-bridge",
        communicationId: "saveai-extension-content",
        id: crypto.randomUUID(),
        requestId: e.data.id,
        success: true,
        data: { success: true, timestamp: Date.now() },
        timestamp: Date.now()
      }, "*");
    }

    // Forward chat chunks to background
    if (e.data.action === "chatChunk" && e.data.data) {
      console.log("[VIVIM content] 📦 Forwarding chatChunk to background", {
        role: e.data.data.role,
        contentLength: e.data.data.content?.length,
        model: e.data.data.model
      });
      chrome.runtime.sendMessage({
        type: "STREAM_CHUNK",
        ...e.data.data
      }).catch((err) => console.error("[VIVIM content] Failed to send STREAM_CHUNK:", err));
    }

    // Forward stream complete to background
    if (e.data.action === "streamComplete") {
      console.log("[VIVIM content] ✅ Forwarding streamComplete to background");
      chrome.runtime.sendMessage({
        type: "STREAM_COMPLETE"
      }).catch((err) => console.error("[VIVIM content] Failed to send STREAM_COMPLETE:", err));
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
      }).catch(() => {});
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