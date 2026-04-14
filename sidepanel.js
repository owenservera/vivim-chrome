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
  const privacyBtn = document.getElementById("privacyBtn");
  const searchInput = document.getElementById("searchInput");

  // ═══════════════════════════════════════════════════
  // State
  // ═══════════════════════════════════════════════════

  let currentTabId = null;
  let currentProvider = PROVIDERS.chatgpt;
  let manualProvider = null;
  let messageList = [];
  let streamingMsgEl = null;
  let lastStreamedSeq = 0;
  let searchQuery = "";

  // ─── Initialization ───
  function init() {
    console.log("[VIVIM:SP] Initializing side panel...");
    
    // UI sub-initializers
initExport();
  initSearch();
  initProviderSelect();
  initPrivacy();

    // Get current tab on startup
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        currentTabId = tabs[0].id;
        checkTabStatus();
        loadConversation();
      }
    });

    // Listen for background messages
    chrome.runtime.onMessage.addListener(handleBackgroundMessage);

    // Track tab switches
    chrome.tabs.onActivated.addListener((activeInfo) => {
      currentTabId = activeInfo.tabId;
      streamingMsgEl = null;
      lastStreamedSeq = 0;
      loadConversation();
      checkTabStatus();
    });

    // Input event listeners
    promptInput.addEventListener("input", onInputChange);
    promptInput.addEventListener("keydown", onInputKeyDown);
    sendBtn.addEventListener("click", sendPrompt);
    clearBtn.addEventListener("click", clearConversation);

    setStatus("disconnected", "Ready");
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
    if (providerName) providerName.textContent = provider.name;
    if (providerSelect) providerSelect.style.background = provider.color;
    statusDot.style.setProperty("--provider-color", provider.color);
  }

  function setStatus(state, label) {
    statusDot.className = "status-dot";
    if (state === "connected") statusDot.classList.add("status-dot--connected");
    if (state === "streaming") statusDot.classList.add("status-dot--streaming");
    statusText.textContent = label;
  }

  // ─── Data Management ───
  function loadConversation() {
    if (!currentTabId) return;
    chrome.runtime.sendMessage({ type: "GET_CONVERSATION", tabId: currentTabId }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.messages) {
        messageList = response.messages;
        renderAllMessages();
      }
    });
  }

  function handleBackgroundMessage(msg) {
    // Only process messages for the currently active tab
    if (msg.tabId && msg.tabId !== currentTabId) return;

    switch (msg.type) {
      case "MESSAGE_ADDED":
        addMessage(msg.role, msg.content, msg.model, msg.timestamp);
        break;

      case "STREAM_UPDATE":
        updateStreamingMessage(msg.content, msg.model, msg.seq);
        break;

      case "STREAM_COMPLETE":
        finalizeStreamingMessage();
        break;

      case "CONVERSATION_CLEARED":
        messageList = [];
        renderAllMessages();
        break;

      case "TAB_DETECTED":
        checkTabStatus();
        break;

      case "SAVE_TRIGGERED":
        showToast("Conversation saved");
        break;
    }
  }

  // ─── Rendering ───
  function renderAllMessages() {
    messagesArea.innerHTML = "";
    
    // Filter messages if search query exists
    const filtered = searchQuery 
      ? messageList.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
      : messageList;

    if (filtered.length === 0) {
      messagesArea.appendChild(emptyState);
      emptyState.classList.remove("hidden");
    } else {
      emptyState.classList.add("hidden");
      filtered.forEach((msg, idx) => {
        messagesArea.appendChild(createMessageEl(msg.role, msg.content, msg.model, msg.timestamp, idx));
      });
    }

    updateMsgCount();
    scrollToBottom();
  }

  function addMessage(role, content, model, timestamp) {
    messageList.push({ role, content, model, timestamp: timestamp || Date.now() });
    renderAllMessages();
  }

  function createMessageEl(role, content, model, timestamp, index) {
    const el = document.createElement("div");
    el.className = `msg msg--${role}`;
    el.dataset.index = index;

    const contentEl = document.createElement("div");
    contentEl.className = "msg__content";
    contentEl.innerHTML = renderMarkdown(content);
    el.appendChild(contentEl);

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

    // Actions (Copy, Delete, etc)
    const actionsEl = document.createElement("div");
    actionsEl.className = "msg__actions hidden";
    
    const copyBtn = createActionButton("📋", "Copy", () => copyToClipboard(content));
    actionsEl.appendChild(copyBtn);

    if (role === "user") {
      const retryBtn = createActionButton("↩️", "Reuse", () => {
        promptInput.value = content;
        onInputChange();
        promptInput.focus();
      });
      actionsEl.appendChild(retryBtn);
    }

    const deleteBtn = createActionButton("🗑️", "Delete", () => {
      messageList.splice(index, 1);
      renderAllMessages();
    });
    actionsEl.appendChild(deleteBtn);

    el.appendChild(actionsEl);
    el.onmouseenter = () => actionsEl.classList.remove("hidden");
    el.onmouseleave = () => actionsEl.classList.add("hidden");

    return el;
  }

  function createActionButton(icon, title, onClick) {
    const btn = document.createElement("button");
    btn.className = "msg__action";
    btn.innerHTML = icon;
    btn.title = title;
    btn.onclick = (e) => { e.stopPropagation(); onClick(); };
    return btn;
  }

  function renderMarkdown(text) {
    if (!text) return "";
    
    // 1. Escape HTML
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // 2. Code blocks (handle triple backticks)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>');

    // 3. Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 4. Bold and Italic
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 5. Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

    const parts = html.split(/(<pre>[\s\S]*?<\/pre>)/);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i].startsWith('<pre>')) {
        parts[i] = parts[i].replace(/\n/g, '<br>');
      }
    }
    return parts.join('');
  }


  function updateStreamingMessage(content, model, seq) {
    if (seq !== undefined && seq <= lastStreamedSeq) return;
    if (seq !== undefined) lastStreamedSeq = seq;

    if (!streamingMsgEl) {
      setStatus("streaming", "Streaming...");
      emptyState.classList.add("hidden");
      streamingMsgEl = document.createElement("div");
      streamingMsgEl.className = "msg msg--assistant msg--streaming";
      
      const contentEl = document.createElement("div");
      contentEl.className = "msg__content";
      streamingMsgEl.appendChild(contentEl);
      
      const metaEl = document.createElement("div");
      metaEl.className = "msg__meta";
      streamingMsgEl.appendChild(metaEl);
      
      messagesArea.appendChild(streamingMsgEl);
    }

    const contentEl = streamingMsgEl.querySelector(".msg__content");
    const metaEl = streamingMsgEl.querySelector(".msg__meta");
    
    if (contentEl) contentEl.textContent = content; // Raw text during stream
    if (metaEl && model) metaEl.textContent = model;
    
    scrollToBottom();
  }

  function finalizeStreamingMessage() {
    if (!streamingMsgEl) return;
    
    const content = streamingMsgEl.querySelector(".msg__content")?.textContent || "";
    const model = streamingMsgEl.querySelector(".msg__meta")?.textContent || "";
    
    streamingMsgEl.remove();
    streamingMsgEl = null;
    lastStreamedSeq = 0;
    
    addMessage("assistant", content, model, Date.now());
    setStatus("connected", (currentProvider?.name || "AI") + " active");
  }

  // ─── User Actions ───
  async function sendPrompt() {
    const text = promptInput.value.trim();
    if (!text || !currentTabId) return;

    promptInput.value = "";
    onInputChange();

    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        func: (val) => {
          const area = document.querySelector("form #prompt-textarea");
          if (!area) return;
          
          // Inject text into ChatGPT's editor
          const p = area.querySelector("p");
          if (p) {
            p.textContent = val;
          } else {
            area.value = val;
          }
          
          area.dispatchEvent(new Event("input", { bubbles: true }));
          area.focus();
          
          setTimeout(() => {
            const enter = new KeyboardEvent("keydown", { bubbles: true, key: "Enter", code: "Enter", keyCode: 13 });
            area.dispatchEvent(enter);
          }, 200);
        },
        args: [text]
      });
    } catch (err) {
      console.error("[VIVIM:SP] Send failed:", err);
    }
  }

  function clearConversation() {
    if (!confirm("Clear this conversation?")) return;
    chrome.runtime.sendMessage({ type: "CLEAR_CONVERSATION", tabId: currentTabId });
  }

  // ─── Feature Initializers ───
  function initExport() {
    if (!exportBtn) return;
    exportBtn.onclick = (e) => {
      e.stopPropagation();
      const existing = document.querySelector(".export-menu");
      if (existing) return existing.remove();

      const menu = document.createElement("div");
      menu.className = "export-menu";
      
      const createItem = (label, fn) => {
        const b = document.createElement("button");
        b.textContent = label;
        b.onclick = () => { fn(); menu.remove(); };
        return b;
      };

      menu.appendChild(createItem("📄 Export JSON", () => downloadFile(JSON.stringify(messageList, null, 2), "vivim-chat.json", "application/json")));
      menu.appendChild(createItem("📝 Export Markdown", () => {
        const md = messageList.map(m => `### ${m.role.toUpperCase()}\n\n${m.content}\n\n`).join("---\n\n");
        downloadFile(md, "vivim-chat.md", "text/markdown");
      }));

      exportBtn.parentElement.appendChild(menu);
    };
  }

  function initSearch() {
    if (!searchInput) return;
    searchInput.oninput = (e) => {
      searchQuery = e.target.value;
      renderAllMessages();
    };
  }

  function initProviderSelect() {
    if (!providerSelect) return;
    providerSelect.onclick = (e) => {
      e.stopPropagation();
      const existing = document.querySelector(".provider-menu");
      if (existing) return existing.remove();

      const menu = document.createElement("div");
      menu.className = "provider-menu";
      
      Object.values(PROVIDERS).forEach(p => {
        const opt = document.createElement("button");
        opt.className = "provider-option";
        opt.innerHTML = `<span class="provider-dot" style="background:${p.color}"></span>${p.name}`;
        opt.onclick = () => {
          manualProvider = p;
          checkTabStatus();
          menu.remove();
        };
        menu.appendChild(opt);
      });
      providerSelect.parentElement.appendChild(menu);
    };
  }

  function initPrivacy() {
    if (!privacyBtn) return;
    privacyBtn.onclick = async (e) => {
      e.stopPropagation();
      
      if (e.target.disabled) return;
      e.target.disabled = true;
      
      async function loadScripts() {
        if (typeof VIVIMTelemetry === 'undefined') {
          await new Promise((resolve, reject) => {
            const s1 = document.createElement('script');
            s1.src = 'telemetry.js';
            s1.onload = resolve;
            s1.onerror = reject;
            document.head.appendChild(s1);
          });
        }
        
        if (typeof window.VIVIMPrivacyDashboard === 'undefined') {
          await new Promise((resolve, reject) => {
            const s2 = document.createElement('script');
            s2.src = 'telemetry-dashboard.js';
            s2.onload = resolve;
            s2.onerror = reject;
            document.head.appendChild(s2);
          });
        }
      }
      
      try {
        await loadScripts();
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:9999;background:rgba(0,0,0,0.5);';
        wrapper.onclick = (ev) => { if (ev.target === wrapper) wrapper.remove(); };
        
        const container = document.createElement('div');
        container.id = 'privacy-dashboard-container';
        wrapper.appendChild(container);
        document.body.appendChild(wrapper);
        
        VIVIMTelemetry.init().then(() => {
          new window.VIVIMPrivacyDashboard(container, VIVIMTelemetry);
        });
      } catch (err) {
        console.error('Failed to load privacy dashboard:', err);
        e.target.disabled = false;
      }
    };
  }

  // ─── Utilities ───
  function onInputChange() {
    sendBtn.disabled = !promptInput.value.trim();
    promptInput.style.height = "42px";
    promptInput.style.height = Math.min(promptInput.scrollHeight, 150) + "px";
  }

  function onInputKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendPrompt();
    }
  }

  function updateMsgCount() {
    if (msgCount) msgCount.textContent = `${messageList.length} messages`;
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      messagesArea.scrollTop = messagesArea.scrollHeight;
    });
  }

  function formatTime(ts) {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => showToast("Copied to clipboard"));
  }

  function showToast(text) {
    const t = document.createElement("div");
    t.className = "toast";
    t.textContent = text;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  function downloadFile(content, name, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Start!
  init();

})();
