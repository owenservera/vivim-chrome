// VIVIM POC — Side Panel Script
// Chat rendering + send prompt via scripting API

(function () {
  "use strict";

  // ─── DOM References ───
  const messagesArea = document.getElementById("messagesArea");
  const emptyState = document.getElementById("emptyState");
  const promptInput = document.getElementById("promptInput");
  const sendBtn = document.getElementById("sendBtn");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const msgCount = document.getElementById("msgCount");
  const clearBtn = document.getElementById("clearBtn");

  // ─── State ───
  let currentTabId = null;
  let messageList = [];
  let isStreaming = false;
  let streamingMsgEl = null;

  // ─── Init ───
  function init() {
    // Get current tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        currentTabId = tabs[0].id;
        checkTabStatus();
        loadConversation();
      }
    });

    // Listen for messages from content script (via background)
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);

    // Listen for tab activation — update currentTabId on tab switch
    chrome.tabs.onActivated.addListener((activeInfo) => {
      currentTabId = activeInfo.tabId;
      streamingMsgEl = null; // clean up any live streaming element
      loadConversation();
      checkTabStatus();
    });

    // Input handling
    promptInput.addEventListener("input", onInputChange);
    promptInput.addEventListener("keydown", onInputKeyDown);
    sendBtn.addEventListener("click", sendPrompt);
    clearBtn.addEventListener("click", clearConversation);

    setStatus("disconnected", "No ChatGPT tab");
  }

  // ─── Tab Status ───
  function checkTabStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = tabs[0].url || "";
        const domain = url.includes("chat.com") ? "Chat" : url.includes("chatgpt.com") ? "ChatGPT" : "";
        if (domain) {
          setStatus("connected", `${domain} active`);
        } else {
          setStatus("disconnected", "No ChatGPT tab");
        }
      }
    });
  }

  function setStatus(state, label) {
    statusDot.className = "status-dot";
    if (state === "connected") statusDot.classList.add("status-dot--connected");
    if (state === "streaming") statusDot.classList.add("status-dot--streaming");
    statusText.textContent = label;
  }

  // ─── Conversation Load ───
  function loadConversation() {
    chrome.runtime.sendMessage({ type: "GET_CONVERSATION", tabId: currentTabId }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response?.messages?.length > 0) {
        messageList = response.messages;
        renderAllMessages();
      }
    });
  }

  // ─── Background Messages ───
  function handleBackgroundMessage(msg) {
    console.log("[VIVIM POC] 📨 Background message received:", msg.type, "currentTabId:", currentTabId, "msg.tabId:", msg.tabId);

    // Only process messages relevant to the currently tracked tab
    if (msg.tabId && msg.tabId !== currentTabId) {
      console.log("[VIVIM POC] ⏭️ Ignoring message for different tab:", msg.tabId, "!==", currentTabId);
      return;
    }

    switch (msg.type) {
      case "MESSAGE_ADDED":
        addMessage(msg.role, msg.content, null, msg.timestamp);
        break;

      case "STREAM_UPDATE":
        console.log("[VIVIM POC] 🌊 STREAM_UPDATE received, content length:", msg.content?.length);
        updateStreamingMessage(msg.content, msg.model);
        break;

      case "STREAM_COMPLETE":
        console.log("[VIVIM POC] ✅ STREAM_COMPLETE received");
        finalizeStreamingMessage();
        break;

      case "CONVERSATION_CLEARED":
        messageList = [];
        messagesArea.innerHTML = "";
        messagesArea.appendChild(emptyState);
        emptyState.classList.remove("hidden");
        updateMsgCount();
        break;

      case "TAB_DETECTED":
        if (msg.platform === "chatgpt") {
          const domain = msg.url?.includes("chat.com") ? "Chat" : "ChatGPT";
          setStatus("connected", `${domain} detected`);
        }
        break;

      case "SAVE_TRIGGERED":
        console.log("[VIVIM POC] Save triggered from DOM at", msg.timestamp);
        break;
    }
  }

  // ─── Render Messages ───
  function renderAllMessages() {
    messagesArea.innerHTML = "";
    messagesArea.appendChild(emptyState);

    if (messageList.length === 0) {
      emptyState.classList.remove("hidden");
    } else {
      emptyState.classList.add("hidden");
      messageList.forEach((msg) => {
        const el = createMessageEl(msg.role, msg.content, msg.model, msg.timestamp);
        messagesArea.appendChild(el);
      });
    }

    updateMsgCount();
    scrollToBottom();
  }

  function addMessage(role, content, model, timestamp) {
    emptyState.classList.add("hidden");

    const el = createMessageEl(role, content, model, timestamp);
    messagesArea.appendChild(el);

    messageList.push({ role, content, model, timestamp: timestamp || Date.now() });
    updateMsgCount();
    scrollToBottom();
  }

  function createMessageEl(role, content, model, timestamp) {
    const el = document.createElement("div");
    el.className = `msg msg--${role}`;

    const contentEl = document.createElement("div");
    contentEl.className = "msg__content";
    contentEl.textContent = content;
    el.appendChild(contentEl);

    if (model || timestamp) {
      const metaEl = document.createElement("div");
      metaEl.className = "msg__meta";

      if (model) {
        const modelSpan = document.createElement("span");
        modelSpan.className = "msg__model";
        modelSpan.textContent = model;
        metaEl.appendChild(modelSpan);
      }

      if (timestamp) {
        const timeSpan = document.createElement("span");
        timeSpan.textContent = formatTime(timestamp);
        metaEl.appendChild(timeSpan);
      }

      el.appendChild(metaEl);
    }

    return el;
  }

  // ─── Streaming Message ───
  function updateStreamingMessage(content, model) {
    if (!streamingMsgEl) {
      // Create new streaming message
      emptyState.classList.add("hidden");
      streamingMsgEl = document.createElement("div");
      streamingMsgEl.className = "msg msg--assistant msg--streaming";

      const contentEl = document.createElement("div");
      contentEl.className = "msg__content";
      contentEl.textContent = content;
      streamingMsgEl.appendChild(contentEl);

      if (model) {
        const metaEl = document.createElement("div");
        metaEl.className = "msg__meta";
        const modelSpan = document.createElement("span");
        modelSpan.className = "msg__model";
        modelSpan.textContent = model;
        metaEl.appendChild(modelSpan);
        streamingMsgEl.appendChild(metaEl);
      }

      messagesArea.appendChild(streamingMsgEl);
      setStatus("streaming", "Streaming...");
    } else {
      // Update existing
      const contentEl = streamingMsgEl.querySelector(".msg__content");
      if (contentEl) contentEl.textContent = content;
    }

    scrollToBottom();
  }

  function finalizeStreamingMessage() {
    if (streamingMsgEl) {
      streamingMsgEl.classList.remove("msg--streaming");

      // Extract content from the streaming element
      const content = streamingMsgEl.querySelector(".msg__content")?.textContent || "";
      const model = streamingMsgEl.querySelector(".msg__model")?.textContent || "";

      // Add to message list
      messageList.push({
        role: "assistant",
        content,
        model,
        timestamp: Date.now(),
        streamed: true,
      });

      streamingMsgEl = null;
      updateMsgCount();
    }

    setStatus("connected", "ChatGPT active");
  }

  // ─── Send Prompt ───
  async function sendPrompt() {
    const text = promptInput.value.trim();
    if (!text || !currentTabId) return;

    // Clear input
    promptInput.value = "";
    sendBtn.disabled = true;
    promptInput.style.height = "42px";

    // Inject prompt into ChatGPT's own UI — let ChatGPT make the API call.
    // Our fetch() hook in content.js will intercept it and capture the message.
    // This avoids 403/400 errors from guessing the API format.
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: injectPromptIntoChatGPT,
        args: [text],
      });
      // Only show user message after confirmed successful inject
      addMessage("user", text, null, Date.now());
    } catch (e) {
      console.error("[VIVIM POC] Failed to inject prompt:", e);
      sendBtn.disabled = false; // re-enable so user can retry
    }
  }

  // This function runs IN THE PAGE CONTEXT (ChatGPT tab)
  // It must be fully self-contained — no closures, no imports.
  // Strategy: find ChatGPT's textarea, use synthetic InputEvent to set value, click send.
  function injectPromptIntoChatGPT(prompt) {
    // Find the textarea - ChatGPT uses different IDs depending on version
    let el = document.getElementById("prompt-textarea") || 
            document.querySelector('textarea[id*="prompt"]') ||
            document.querySelector('textarea[aria-label*="message"]') ||
            document.querySelector('textarea');
    
    if (!el) {
      console.error("[VIVIM POC] Could not find ChatGPT textarea");
      return;
    }

    // Use synthetic InputEvent — reliable for React-controlled textareas
    const nativeInputSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    nativeInputSetter.call(el, prompt);
    el.dispatchEvent(new Event("input", { bubbles: true }));

    el.focus();

    // Find send button - try multiple selectors
    setTimeout(() => {
      const btn = document.querySelector('button[data-testid="send-button"]') ||
                document.querySelector('button[aria-label="Send"]') ||
                document.querySelector('button:disabled')?.closest('button') ||
                Array.from(document.querySelectorAll('button')).find(b => b.textContent?.toLowerCase().includes('send'));
      if (btn) btn.click();
    }, 100);
  }

  // ─── Input Handling ───
  function onInputChange() {
    const hasText = promptInput.value.trim().length > 0;
    sendBtn.disabled = !hasText;

    // Auto-resize textarea (max 120px)
    promptInput.style.height = "42px";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 120) + "px";
  }

  function onInputKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (promptInput.value.trim()) {
        sendPrompt();
      }
    }
  }

  // ─── Clear ───
  function clearConversation() {
    messageList = [];
    messagesArea.innerHTML = "";
    messagesArea.appendChild(emptyState);
    emptyState.classList.remove("hidden");
    updateMsgCount();

    // Fix #1: include tabId so background resolves correct storage key
    chrome.runtime.sendMessage({ type: "CLEAR_CONVERSATION", tabId: currentTabId });

    // Also trigger in page context
    if (currentTabId) {
      chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: () => {
          // Navigate to new conversation
          if (window.location.hostname === "chat.com") {
            window.location.href = "https://chat.com/";
          } else {
            window.location.href = "https://chatgpt.com/";
          }
        },
      });
    }
  }

  // ─── Helpers ───
  function updateMsgCount() {
    msgCount.textContent = `${messageList.length} message${messageList.length !== 1 ? "s" : ""}`;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    });
  }

  function formatTime(ts) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // ─── Start ───
  init();
})();
