// VIVIM POC — Side Panel Script
// Enhanced with 10x features: multi-provider, markdown, export

(function () {
  "use strict";

  // ═══════════════════════════════════════════════════
  // PROVIDER REGISTRY (13 providers)
  // ═══════════════════════════════════════════════════

  const PROVIDERS = {
    chatgpt: { id: "chatgpt", name: "ChatGPT", color: "#10A37F", hosts: ["chatgpt.com", "chat.com"] },
    claude: { id: "claude", name: "Claude", color: "#D4A373", hosts: ["claude.ai"] },
    copilot: { id: "copilot", name: "Copilot", color: "#0078D4", hosts: ["copilot.microsoft.com"] },
    gemini: { id: "gemini", name: "Gemini", color: "#8E8E8E", hosts: ["gemini.google.com"] },
    deepseek: { id: "deepseek", name: "DeepSeek", color: "#5365F9", hosts: ["deepseek.com"] },
    perplexity: { id: "perplexity", name: "Perplexity", color: "#6366F1", hosts: ["perplexity.ai"] },
    grok: { id: "grok", name: "Grok", color: "#F59E0B", hosts: ["grok.com", "api.x.ai"] },
    poe: { id: "poe", name: "Poe", color: "#EF4444", hosts: ["poe.com"] },
    kimi: { id: "kimi", name: "Kimi", color: "#8B5CF6", hosts: ["kimi.moonshot.cn", "kimi.com"] },
    tongyi: { id: "tongyi", name: "Tongyi", color: "#F97316", hosts: ["tongyi.aliyun.com", "dashscope"] },
    yuanbao: { id: "yuanbao", name: "Yuanbao", color: "#14B8A6", hosts: ["yuanbao.tencent.com", "hunyuan"] },
    notebooklm: { id: "notebooklm", name: "NotebookLM", color: "#EA5900", hosts: ["notebooklm.google.com"] },
    googleairesolve: { id: "googleairesolve", name: "Google AI", color: "#4285F4", hosts: ["ai.google.dev"] },
  };

  function detectProvider(url) {
    if (!url) return PROVIDERS.chatgpt;
    for (const key in PROVIDERS) {
      const p = PROVIDERS[key];
      for (const host of p.hosts) {
        if (url.includes(host)) return p;
      }
    }
    return { id: "unknown", name: "Unknown", color: "#686880", hosts: [] };
  }

  // ═══════════════════════════════════════════════════
  // DOM References
  // ═══════════════════════════════════════════════════

  const messagesArea = document.getElementById("messagesArea");
  const emptyState = document.getElementById("emptyState");
  const promptInput = document.getElementById("promptInput");
  const sendBtn = document.getElementById("sendBtn");
  const statusDot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  const msgCount = document.getElementById("msgCount");
  const clearBtn = document.getElementById("clearBtn");
  const providerSelect = document.getElementById("providerSelect");
  const providerName = document.getElementById("providerName");
  const exportBtn = document.getElementById("exportBtn");
  const searchInput = document.getElementById("searchInput");

  // ═══════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════

  let currentTabId = null;
  let currentProvider = PROVIDERS.chatgpt;
  let manualProvider = null;
  let messageList = [];
  let isStreaming = false;
  let streamingMsgEl = null;
  let lastStreamedSeq = 0;
  let searchQuery = "";

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
      lastStreamedSeq = 0; // reset sequence tracker
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

  function checkTabStatus() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        const url = tabs[0].url || "";
        currentProvider = manualProvider || detectProvider(url);
        updateProviderDisplay(currentProvider);
        if (currentProvider.id !== "unknown") {
          setStatus("connected", currentProvider.name + " active");
        } else {
          setStatus("disconnected", "No AI chat detected");
        }
      }
    });
  }

  function updateProviderDisplay(provider) {
    if (providerName) {
      providerName.textContent = provider.name;
    }
    if (providerSelect) {
      providerSelect.style.background = provider.color;
    }
    statusDot.style.setProperty("--provider-color", provider.color);
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
    const timestamp = Date.now();
    console.log("[VIVIM:SP] 📨 Background message received", { 
      type: msg.type, 
      currentTabId, 
      msgTabId: msg.tabId,
      timestamp 
    });

    // Only process messages relevant to the currently tracked tab
    if (msg.tabId && msg.tabId !== currentTabId) {
      console.log("[VIVIM:SP] ⏭️ Ignoring message for different tab", { 
        msgTabId: msg.tabId, 
        currentTabId,
        msgType: msg.type 
      });
      return;
    }

    switch (msg.type) {
      case "MESSAGE_ADDED":
        console.log("[VIVIM:SP] 📥 MESSAGE_ADDED received", { 
          role: msg.role, 
          contentLength: msg.content?.length,
          contentPreview: msg.content?.slice(0, 50),
          timestamp 
        });
        addMessage(msg.role, msg.content, null, msg.timestamp);
        console.log("[VIVIM:SP] ✅ MESSAGE_ADDED rendered", { role: msg.role, messageCount: messageList.length });
        break;

      case "STREAM_UPDATE":
        console.log("[VIVIM:SP] 📥 STREAM_UPDATE received", { 
          contentLength: msg.content?.length, 
          seq: msg.seq, 
          model: msg.model,
          timestamp 
        });
        updateStreamingMessage(msg.content, msg.model, msg.seq);
        console.log("[VIVIM:SP] ✅ STREAM_UPDATE rendered", { seq: msg.seq, contentLength: msg.content?.length });
        break;

      case "STREAM_COMPLETE":
        console.log("[VIVIM:SP] 📥 STREAM_COMPLETE received", { 
          timestamp: msg.timestamp,
          totalMessages: messageList.length 
        });
        finalizeStreamingMessage();
        console.log("[VIVIM:SP] ✅ STREAM_COMPLETE finalized", { messageCount: messageList.length });
        break;

      case "CONVERSATION_CLEARED":
        messageList = [];
        messagesArea.innerHTML = "";
        messagesArea.appendChild(emptyState);
        emptyState.classList.remove("hidden");
        streamingMsgEl = null;
        lastStreamedSeq = 0;
        updateMsgCount();
        console.log("[VIVIM:SP] ✅ CONVERSATION_CLEARED", { timestamp });
        break;

      case "TAB_DETECTED":
        if (msg.platform === "chatgpt") {
          const domain = msg.url?.includes("chat.com") ? "Chat" : "ChatGPT";
          setStatus("connected", `${domain} detected`);
          console.log("[VIVIM:SP] ✅ TAB_DETECTED", { platform: msg.platform, url: msg.url?.slice(0, 50) });
        }
        break;

      case "SAVE_TRIGGERED":
        console.log("[VIVIM:SP] 📥 SAVE_TRIGGERED", { timestamp: msg.timestamp });
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

  function createMessageEl(role, content, model, timestamp, index) {
    const el = document.createElement("div");
    el.className = `msg msg--${role}`;
    el.dataset.index = index;

    const contentEl = document.createElement("div");
    contentEl.className = "msg__content";
    contentEl.innerHTML = renderMarkdown(content);
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

    const actionsEl = document.createElement("div");
    actionsEl.className = "msg__actions hidden";

    const copyBtn = document.createElement("button");
    copyBtn.className = "msg__action";
    copyBtn.innerHTML = "📋";
    copyBtn.title = "Copy message";
    copyBtn.onclick = (e) => { e.stopPropagation(); copyMessage(content); };

    const retryBtn = document.createElement("button");
    retryBtn.className = "msg__action";
    retryBtn.innerHTML = "↩️";
    retryBtn.title = "Retry";
    retryBtn.onclick = (e) => { e.stopPropagation(); retryMessage(index); };

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "msg__action";
    deleteBtn.innerHTML = "🗑️";
    deleteBtn.title = "Delete";
    deleteBtn.onclick = (e) => { e.stopPropagation(); deleteMessage(index); };

    actionsEl.appendChild(copyBtn);
    if (role === "user") actionsEl.appendChild(retryBtn);
    actionsEl.appendChild(deleteBtn);

    el.appendChild(actionsEl);

    el.addEventListener("mouseenter", () => actionsEl.classList.remove("hidden"));
    el.addEventListener("mouseleave", () => actionsEl.classList.add("hidden"));

    return el;
  }

  function renderMarkdown(text) {
    if (!text) return "";
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^(\d+)\. (.+)$/gm, '<li>$2</li>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>')
      .replace(/\n\n/g, "</p><p>")
      .replace(/\n/g, "<br>");
    return `<p>${html}</p>`;
  }

  async function copyMessage(content) {
    try {
      await navigator.clipboard.writeText(content);
      showToast("Message copied!");
    } catch {}
  }

  function retryMessage(index) {
    const msg = messageList[index];
    if (msg && msg.role === "user") {
      promptInput.value = msg.content;
      promptInput.dispatchEvent(new Event("input"));
      promptInput.focus();
    }
  }

  function deleteMessage(index) {
    messageList.splice(index, 1);
    renderAllMessages();
    showToast("Message deleted");
  }

  function showToast(text) {
    const existing = document.querySelector(".toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  // ─── Streaming Message ───
  function updateStreamingMessage(content, model, seq) {
    // Only update if this is a newer chunk (prevents out-of-order rendering)
    if (seq !== undefined && seq <= lastStreamedSeq) {
      console.log("[VIVIM POC] ⏭️ Skipping stale update, seq:", seq, "lastSeq:", lastStreamedSeq);
      return;
    }

    if (seq !== undefined) {
      lastStreamedSeq = seq;
    }

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
      // Update existing — always replace with full cumulative content
      const contentEl = streamingMsgEl.querySelector(".msg__content");
      if (contentEl) {
        contentEl.textContent = content;
        console.log("[VIVIM POC] 🔄 Updated streaming message, length:", content.length, "seq:", seq);
      }
    }

    scrollToBottom();
  }

  function finalizeStreamingMessage() {
    if (streamingMsgEl) {
      streamingMsgEl.classList.remove("msg--streaming");

      // Extract content from the streaming element
      const content = streamingMsgEl.querySelector(".msg__content")?.textContent || "";
      const model = streamingMsgEl.querySelector(".msg__model")?.textContent || "";

      console.log("[VIVIM POC] ✅ Finalized streaming message, length:", content.length, "final seq:", lastStreamedSeq);

      // Add to message list
      messageList.push({
        role: "assistant",
        content,
        model,
        timestamp: Date.now(),
        streamed: true,
      });

      streamingMsgEl = null;
      lastStreamedSeq = 0; // Reset for next stream
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

    // Optimistically show user message
    addMessage("user", text, null, Date.now());

    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: injectPromptIntoChatGPT,
        args: [text],
      });
      console.log("[VIVIM POC] ✅ Script injected, result:", results);
    } catch (e) {
      console.error("[VIVIM POC] ❌ Failed to inject prompt:", e);
      sendBtn.disabled = false;
    }
  }

  // This function runs IN THE PAGE CONTEXT (ChatGPT tab)
  // It must be fully self-contained — no closures, no imports.
  function injectPromptIntoChatGPT(prompt) {
    console.log("[VIVIM POC inject] 🔍 Injecting prompt:", prompt.substring(0, 30));

    const el = document.querySelector("form #prompt-textarea");
    if (!el) {
      console.error("[VIVIM POC inject] ❌ prompt-textarea not found");
      return { success: false };
    }

    console.log("[VIVIM POC inject] ✅ Found textarea");

    // Replace the inner <p> content (ChatGPT's structure)
    const oldP = el.querySelector("p");
    if (oldP) {
      const text = document.createTextNode(prompt);
      const newP = document.createElement("p");
      newP.appendChild(text);
      oldP.replaceWith(newP);
    } else {
      // Fallback: set value directly
      try {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
        setter.call(el, prompt);
      } catch (e) {
        el.value = prompt;
      }
    }

    // Dispatch input event
    el.dispatchEvent(new Event("input", { bubbles: true }));

    // Focus and then press Enter
    el.focus();

    setTimeout(() => {
      const enterEvent = new KeyboardEvent("keydown", {
        bubbles: true,
        cancelable: true,
        key: "Enter",
        code: "Enter",
        which: 13,
      });
      el.dispatchEvent(enterEvent);
      console.log("[VIVIM POC inject] ✅ Enter key dispatched");
    }, 500);

    return { success: true };
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

  function initExport() {
    if (exportBtn) {
      exportBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        showExportMenu();
      });
    }
  }

  function showExportMenu() {
    const existing = document.querySelector(".export-menu");
    if (existing) { existing.remove(); return; }

    const menu = document.createElement("div");
    menu.className = "export-menu";

    const jsonBtn = document.createElement("button");
    jsonBtn.textContent = "📄 Export JSON";
    jsonBtn.onclick = () => exportJSON();

    const mdBtn = document.createElement("button");
    mdBtn.textContent = "📝 Export Markdown";
    mdBtn.onclick = () => exportMarkdown();

    const txtBtn = document.createElement("button");
    txtBtn.textContent = "📃 Export Plain Text";
    txtBtn.onclick = () => exportPlainText();

    menu.appendChild(jsonBtn);
    menu.appendChild(mdBtn);
    menu.appendChild(txtBtn);
    exportBtn.parentElement.appendChild(menu);
  }

  function exportJSON() {
    const data = JSON.stringify(messageList, null, 2);
    downloadFile(data, "vivim-export.json", "application/json");
    document.querySelector(".export-menu")?.remove();
    showToast("JSON exported");
  }

  function exportMarkdown() {
    let md = "# VIVIM Conversation\n\n";
    messageList.forEach((msg, i) => {
      const label = msg.role === "user" ? "**User**" : "**Assistant**";
      const model = msg.model ? ` *(${msg.model})*` : "";
      const time = new Date(msg.timestamp).toLocaleString();
      md += `${label}${model} — ${time}\n\n${msg.content}\n\n---\n\n`;
    });
    downloadFile(md, "vivim-export.md", "text/markdown");
    document.querySelector(".export-menu")?.remove();
    showToast("Markdown exported");
  }

  function exportPlainText() {
    let txt = "";
    messageList.forEach(msg => {
      const label = msg.role === "user" ? "User:" : "Assistant:";
      txt += `${label} ${msg.content}\n\n`;
    });
    downloadFile(txt, "vivim-export.txt", "text/plain");
    document.querySelector(".export-menu")?.remove();
    showToast("Text exported");
  }

  function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function initSearch() {
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        searchQuery = e.target.value;
        renderAllMessages();
      });
    }
  }

  function initProviderSelect() {
    if (providerSelect) {
      providerSelect.addEventListener("click", showProviderMenu);
    }
  }

  function showProviderMenu() {
    const existing = document.querySelector(".provider-menu");
    if (existing) { existing.remove(); return; }

    const menu = document.createElement("div");
    menu.className = "provider-menu";

    Object.values(PROVIDERS).forEach(p => {
      const btn = document.createElement("button");
      btn.className = "provider-option";
      btn.innerHTML = `<span class="provider-dot" style="background:${p.color}"></span>${p.name}`;
      btn.onclick = () => { manualProvider = p; currentProvider = p; updateProviderDisplay(p); menu.remove(); };
      menu.appendChild(btn);
    });

    providerSelect.parentElement.appendChild(menu);
  }

  function init() {
    initExport();
    initSearch();
    initProviderSelect();

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        currentTabId = tabs[0].id;
        checkTabStatus();
        loadConversation();
      }
    });

    chrome.runtime.onMessage.addListener(handleBackgroundMessage);

    chrome.tabs.onActivated.addListener((activeInfo) => {
      currentTabId = activeInfo.tabId;
      streamingMsgEl = null;
      lastStreamedSeq = 0;
      loadConversation();
      checkTabStatus();
    });

    promptInput.addEventListener("input", onInputChange);
    promptInput.addEventListener("keydown", onInputKeyDown);
    sendBtn.addEventListener("click", sendPrompt);
    clearBtn.addEventListener("click", clearConversation);

    setStatus("disconnected", "Select a provider");
  }
})();
