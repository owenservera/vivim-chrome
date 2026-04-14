// VIVIM POC — Background Service Worker
// Message router + tab tracking + side panel management

const CONVERSATION_ENDPOINT = "/backend-api/conversation";

// Track which tabs have ChatGPT open
const chatgptTabs = new Map(); // tabId -> { conversationId, title }

// Current active tab ID (for side panel communication)
let activeTabId = null;

// ─── Tab Detection ───────────────────────────────────────────────

const isChatGPT = (url) => /^https:\/\/(chatgpt\.com|chat\.com)\//.test(url || "");

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isChatGPT(changeInfo.url)) {
    chatgptTabs.set(tabId, {
      url: changeInfo.url,
      title: tab.title || "ChatGPT",
      detectedAt: Date.now(),
    });
    // Notify side panel
    broadcastToSidePanel(tabId, {
      type: "TAB_DETECTED",
      platform: "chatgpt",
      url: changeInfo.url,
      tabId,
    });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chatgptTabs.delete(tabId);
  if (activeTabId === tabId) activeTabId = null;
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  const tab = await chrome.tabs.get(activeInfo.tabId).catch(() => null);
  if (tab && isChatGPT(tab.url)) {
    if (!chatgptTabs.has(tab.id)) {
      chatgptTabs.set(tab.id, {
        url: tab.url,
        title: tab.title || "ChatGPT",
        detectedAt: Date.now(),
      });
    }
  }
});

// ─── Message Routing ─────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Extension pages (sidepanel, popup) have no sender.tab — they must pass tabId explicitly
  const tabId = message.tabId || sender.tab?.id;
  console.log("[VIVIM BG] 📨 Message received:", message.type, "tabId:", tabId, "sender.tab:", sender.tab?.id);

  switch (message.type) {
    case "USER_PROMPT":
      // Content script captured an outgoing user prompt
      storeMessage(tabId, {
        role: "user",
        content: message.content,
        conversationId: message.conversationId,
        timestamp: Date.now(),
      });

      // If conversationId is new, track it
      if (message.conversationId && !chatgptTabs.get(tabId)?.conversationId) {
        const info = chatgptTabs.get(tabId);
        if (info) {
          info.conversationId = message.conversationId;
          chatgptTabs.set(tabId, info);
        }
      }

      // Forward to side panel — include tabId in payload for sidepanel filtering
      broadcastToSidePanel(tabId, {
        type: "MESSAGE_ADDED",
        role: "user",
        content: message.content,
        timestamp: Date.now(),
        tabId,
      });
      break;

    case "STREAM_CHUNK":
      // SSE chunk from inject-web.js → content.js → here
      console.log("[VIVIM BG] 📦 STREAM_CHUNK received:", {
        tabId,
        role: message.role,
        contentLength: message.content?.length,
        model: message.model,
        contentPreview: message.content?.substring(0, 50)
      });
      handleStreamChunk(tabId, message);
      break;

    case "STREAM_COMPLETE":
      console.log("[VIVIM BG] ✅ STREAM_COMPLETE received, tabId:", tabId);
      storeStreamedMessage(tabId);
      broadcastToSidePanel(tabId, {
        type: "STREAM_COMPLETE",
        tabId,
        timestamp: Date.now(),
      });
      break;

    case "GET_CONVERSATION":
      // Side panel requesting stored conversation
      const tabInfo = chatgptTabs.get(tabId);
      chrome.storage.local.get(`conv_${tabId}`, (result) => {
        const messages = result[`conv_${tabId}`] || [];
        sendResponse({
          messages,
          conversationId: tabInfo?.conversationId || null,
          url: tabInfo?.url || null,
        });
      });
      return true; // Keep message channel open

    case "CLEAR_CONVERSATION":
      clearConversation(tabId);
      broadcastToSidePanel(tabId, { type: "CONVERSATION_CLEARED", tabId });
      sendResponse({ ok: true });
      return true;

    case "GET_TAB_STATUS":
      const info = chatgptTabs.get(tabId);
      const isChatGPTPromise = info || /^https:\/\/(chatgpt\.com|chat\.com)\//.test(sender.tab?.url || "");
      sendResponse({
        isChatGPT: !!isChatGPTPromise,
        conversationId: info?.conversationId || null,
        platform: "chatgpt",
      });
      return true;

    case "SAVE_FROM_DOM":
      broadcastToSidePanel(tabId, {
        type: "SAVE_TRIGGERED",
        timestamp: message.timestamp,
        tabId,
      });
      break;

    default:
      break;
  }
});

// ─── Conversation Store (per tab) ────────────────────────────────

// Streaming state: track partial assistant messages
const streamingMessages = new Map(); // tabId -> { content, model, startTime }

function handleStreamChunk(tabId, message) {
  const key = `stream_${tabId}`;
  let existing = streamingMessages.get(key);

  if (message.role === "assistant") {
    if (!existing) {
      existing = {
        content: message.content,
        model: message.model || "unknown",
        startTime: Date.now(),
        tabId,
      };
      streamingMessages.set(key, existing);
    } else {
      existing.content = message.content; // Full content (ChatGPT sends cumulative)
    }

    // Forward to side panel — include tabId in payload for sidepanel filtering
    broadcastToSidePanel(tabId, {
      type: "STREAM_UPDATE",
      role: "assistant",
      content: existing.content,
      model: existing.model,
      tabId,
      timestamp: Date.now(),
    });
    console.log("[VIVIM BG] 📡 Broadcasting STREAM_UPDATE, tabId:", tabId, "length:", existing.content?.length);
  }
}

function storeMessage(tabId, msg) {
  const key = `conv_${tabId}`;
  chrome.storage.local.get(key, (result) => {
    const messages = result[key] || [];

    // Check if there's a streaming assistant message to finalize
    const streamKey = `stream_${tabId}`;
    const streaming = streamingMessages.get(streamKey);
    if (streaming && msg.role === "user") {
      // Finalize the previous streaming message
      const finalized = {
        role: "assistant",
        content: streaming.content,
        model: streaming.model,
        timestamp: streaming.startTime,
        streamed: true,
      };

      // Only add if content is different from last message
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.content !== finalized.content) {
        messages.push(finalized);
      }
      streamingMessages.delete(streamKey);
    }

    messages.push(msg);

    // Keep only last 100 messages
    if (messages.length > 100) messages.splice(0, messages.length - 100);

    chrome.storage.local.set({ [key]: messages });
  });
}

function clearConversation(tabId) {
  const key = `conv_${tabId}`;
  chrome.storage.local.remove(key);
  streamingMessages.delete(`stream_${tabId}`);
}

// Persist the current streaming message to storage when stream ends
function storeStreamedMessage(tabId) {
  const streamKey = `stream_${tabId}`;
  const streaming = streamingMessages.get(streamKey);
  if (!streaming) return;

  // Fix #11: delete from streamingMessages BEFORE async call to prevent double-store race
  streamingMessages.delete(streamKey);

  const key = `conv_${tabId}`;
  chrome.storage.local.get(key, (result) => {
    const messages = result[key] || [];
    messages.push({
      role: "assistant",
      content: streaming.content,
      model: streaming.model,
      timestamp: streaming.startTime,
      streamed: true,
    });
    if (messages.length > 100) messages.splice(0, messages.length - 100);
    chrome.storage.local.set({ [key]: messages });
  });
}

// ─── Side Panel Communication ────────────────────────────────────

function broadcastToSidePanel(tabId, message) {
  console.log("[VIVIM BG] 📢 Broadcasting:", message.type, "tabId:", tabId, "payload:", message);
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel may not be open — that's OK
  });
}

// ─── Side Panel Setup ────────────────────────────────────────────

// Open side panel when action icon is clicked
chrome.action.onClicked.addListener((tab) => {
  if (/^https:\/\/(chatgpt\.com|chat\.com)\//.test(tab.url || "")) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Register side panel for all ChatGPT tabs
chrome.sidePanel.setOptions({
  enabled: true,
  path: "sidepanel.html",
});

// ─── Logging ─────────────────────────────────────────────────────
console.log("[VIVIM POC] Background service worker initialized");
