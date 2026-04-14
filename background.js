// VIVIM POC — Background Service Worker

importScripts('telemetry.js');

const CONVERSATION_ENDPOINT = "/backend-api/conversation";
const chatgptTabs = new Map();
let activeTabId = null;
let telemetry = null;

// Destination Registry
const destinations = new Map();
const destinationCapabilities = {
  sidepanel: { receivesStreaming: true, receivesComplete: true, canSendPrompts: false },
  webhook: { receivesStreaming: false, receivesComplete: true, canSendPrompts: false },
  websocket: { receivesStreaming: true, receivesComplete: true, canSendPrompts: true },
};

function registerDestination(id, config = {}) {
  destinations.set(id, { capabilities: destinationCapabilities[id] || {}, config, connected: false });
}

function unregisterDestination(id) {
  destinations.delete(id);
}

function broadcastToDestination(id, type, payload) {
  const dest = destinations.get(id);
  if (!dest) return;

  if (type === "chunk" && dest.capabilities.receivesStreaming) {
    chrome.runtime.sendMessage({ ...payload, _destination: id }).catch((err) => console.warn("[VIVIM:BG] Failed to send chunk to destination", id, err));
  } else if (type === "complete" && dest.capabilities.receivesComplete) {
    chrome.runtime.sendMessage({ ...payload, _destination: id }).catch((err) => console.warn("[VIVIM:BG] Failed to send complete to destination", id, err));
  } else if (type === "message") {
    chrome.runtime.sendMessage({ ...payload, _destination: id }).catch((err) => console.warn("[VIVIM:BG] Failed to send message to destination", id, err));
  }
}

function broadcastToAllDestinations(type, payload) {
  const timestamp = Date.now();
  console.log("[VIVIM:BG] 📤 broadcastToAllDestinations", { type, destinationCount: destinations.size, timestamp });
  for (const [id] of destinations) {
    broadcastToDestination(id, type, payload);
  }
  console.log("[VIVIM:BG] ✅ broadcast complete", { type, destinations: Array.from(destinations.keys()), timestamp });
}

registerDestination("sidepanel");

// Storage Manager - Batch operations for performance
const storageManager = {
  pendingWrites: new Map(),
  writeTimeouts: new Map(),

  queueWrite(key, data) {
    this.pendingWrites.set(key, data);

    // Debounce writes by 500ms
    const existingTimeout = this.writeTimeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    this.writeTimeouts.set(key, setTimeout(() => {
      this.flushWrite(key);
    }, 500));
  },

  flushWrite(key) {
    const data = this.pendingWrites.get(key);
    if (data !== undefined) {
      chrome.storage.local.set({ [key]: data }).catch((err) =>
        console.warn("[VIVIM:STORAGE] Write failed:", key, err)
      );
      this.pendingWrites.delete(key);
      this.writeTimeouts.delete(key);
    }
  },

  get(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key]);
      });
    });
  },

  remove(key) {
    chrome.storage.local.remove(key).catch((err) =>
      console.warn("[VIVIM:STORAGE] Remove failed:", key, err)
    );
  }
};

// Tab Detection
const isChatGPT = (url) => /^https:\/\/(chatgpt\.com|chat\.com)\//.test(url || "");

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (isChatGPT(changeInfo.url)) {
    chatgptTabs.set(tabId, { url: changeInfo.url, title: tab.title || "ChatGPT", detectedAt: Date.now() });
    broadcastToSidePanel(tabId, { type: "TAB_DETECTED", platform: "chatgpt", url: changeInfo.url, tabId });
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
      chatgptTabs.set(tab.id, { url: tab.url, title: tab.title || "ChatGPT", detectedAt: Date.now() });
    }
  }
});

// Message Validation
function validateMessage(message, expectedType) {
  if (!message || typeof message !== 'object') {
    throw new Error('Invalid message: not an object');
  }
  if (!message.type || typeof message.type !== 'string') {
    throw new Error('Invalid message: missing or invalid type');
  }
  if (expectedType && message.type !== expectedType) {
    throw new Error(`Invalid message type: expected ${expectedType}, got ${message.type}`);
  }
  return true;
}

function validateUserPrompt(message) {
  if (!message.content || typeof message.content !== 'string') {
    throw new Error('USER_PROMPT: invalid or missing content');
  }
  if (message.conversationId !== null && message.conversationId !== undefined && typeof message.conversationId !== 'string') {
    throw new Error('USER_PROMPT: invalid conversationId type');
  }
  if (message.timestamp && typeof message.timestamp !== 'number') {
    throw new Error('USER_PROMPT: invalid timestamp type');
  }
}

function validateStreamChunk(message) {
  if (!message.role || typeof message.role !== 'string') {
    throw new Error('STREAM_CHUNK: invalid or missing role');
  }
  if (!message.content || typeof message.content !== 'string') {
    throw new Error('STREAM_CHUNK: invalid or missing content');
  }
  if (message.model && typeof message.model !== 'string') {
    throw new Error('STREAM_CHUNK: invalid model type');
  }
  if (message.seq !== undefined && typeof message.seq !== 'number') {
    throw new Error('STREAM_CHUNK: invalid seq type');
  }
}

// Message Routing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    validateMessage(message);
  } catch (error) {
    console.error("[VIVIM:BG] Message validation failed:", error.message, { message, sender });
    return; // Silently ignore invalid messages
  }

  const tabId = message.tabId || sender.tab?.id;
  const timestamp = Date.now();

  try {
    switch (message.type) {
    case "USER_PROMPT":
      validateUserPrompt(message);
      console.log("[VIVIM:BG] 📥 USER_PROMPT received", {
        tabId,
        contentLength: message.content?.length,
        conversationId: message.conversationId,
        timestamp
      });
      storeMessage(tabId, { role: "user", content: message.content, conversationId: message.conversationId, timestamp });
      if (message.conversationId && !chatgptTabs.get(tabId)?.conversationId) {
        const info = chatgptTabs.get(tabId);
        if (info) { info.conversationId = message.conversationId; chatgptTabs.set(tabId, info); }
      }
      broadcastToSidePanel(tabId, { type: "MESSAGE_ADDED", role: "user", content: message.content, timestamp, tabId });
      if (telemetry) telemetry.trackAction('user_prompt_sent', { hasConversation: !!message.conversationId });
      console.log("[VIVIM:BG] 📤 MESSAGE_ADDED broadcast", { 
        type: "MESSAGE_ADDED", 
        role: "user", 
        contentLength: message.content?.length,
        timestamp,
        tabId 
      });
      break;

    case "STREAM_CHUNK":
      validateStreamChunk(message);
      console.log("[VIVIM:BG] 📥 STREAM_CHUNK received", {
        tabId,
        seq: message.seq,
        contentLength: message.content?.length,
        model: message.model,
        timestamp
      });
      handleStreamChunk(tabId, message);
      break;

    case "STREAM_COMPLETE": {
      console.log("[VIVIM:BG] 📥 STREAM_COMPLETE received", { 
        tabId, 
        streamId: message.streamId, 
        timestamp: message.timestamp 
      });
      const streamKey = "stream_" + tabId;
      const streaming = streamingMessages.get(streamKey);
      if (streaming && (!message.streamId || streaming.streamId === message.streamId)) {
        storeStreamedMessage(tabId);
        streamingMessages.delete(streamKey);
        broadcastToSidePanel(tabId, { type: "STREAM_COMPLETE", tabId, timestamp });
        if (telemetry) {
          const duration = streaming.startTime ? Date.now() - streaming.startTime : 0;
          telemetry.trackPerformance('stream_complete', { duration_ms: duration, model: streaming.model });
        }
        console.log("[VIVIM:BG] 📤 STREAM_COMPLETE broadcast", { 
          type: "STREAM_COMPLETE", 
          tabId, 
          timestamp 
        });
      }
      break;
    }

    case "GET_CONVERSATION": {
      const tabInfo = chatgptTabs.get(tabId);
      // Flush any pending writes before reading
      storageManager.flushWrite("conv_" + tabId);
      storageManager.get("conv_" + tabId).then((messages) => {
        sendResponse({ messages: messages || [], conversationId: tabInfo?.conversationId || null, url: tabInfo?.url || null });
      }).catch((err) => {
        console.warn("[VIVIM:BG] GET_CONVERSATION failed:", err);
        sendResponse({ messages: [], conversationId: tabInfo?.conversationId || null, url: tabInfo?.url || null });
      });
      return true;
    }

    case "CLEAR_CONVERSATION":
      clearConversation(tabId);
      broadcastToSidePanel(tabId, { type: "CONVERSATION_CLEARED", tabId });
      sendResponse({ ok: true });
      return true;

    case "GET_TAB_STATUS": {
      const info = chatgptTabs.get(tabId);
      sendResponse({ isChatGPT: !!info, conversationId: info?.conversationId || null, platform: "chatgpt" });
      return true;
    }

    case "SAVE_FROM_DOM":
      broadcastToSidePanel(tabId, { type: "SAVE_TRIGGERED", timestamp: message.timestamp, tabId });
      break;

    case "REGISTER_DESTINATION":
      registerDestination(message.id, message.config);
      sendResponse({ ok: true });
      return true;

    case "UNREGISTER_DESTINATION":
      unregisterDestination(message.id);
      sendResponse({ ok: true });
      return true;

    case "LIST_DESTINATIONS":
      sendResponse({ destinations: Array.from(destinations.keys()) });
      return true;

    default:
      console.warn("[VIVIM:BG] Unknown message type:", message.type);
      break;
    }
  } catch (error) {
    console.error("[VIVIM:BG] Message processing failed:", error.message, { message, sender });
    // Don't send response for unhandled errors to avoid breaking callers
  }
});

// Conversation Store
const streamingMessages = new Map();

function handleStreamChunk(tabId, message) {
  const key = "stream_" + tabId;
  let existing = streamingMessages.get(key);

  if (message.role === "assistant") {
    const seq = message.seq || 0;
    const streamId = message.streamId;

    if (!existing || (streamId && existing.streamId !== streamId)) {
      if (existing) {
        storeStreamedMessage(tabId);
      }
      existing = { content: message.content, model: message.model || "unknown", startTime: Date.now(), tabId, lastSeq: seq, streamId };
      streamingMessages.set(key, existing);
    } else {
      if (seq > existing.lastSeq) {
        existing.content = message.content;
        existing.lastSeq = seq;
        if (message.model) existing.model = message.model;
      }
    }
    broadcastToSidePanel(tabId, { type: "STREAM_UPDATE", role: "assistant", content: existing.content, model: existing.model, tabId, timestamp: Date.now(), seq: existing.lastSeq });
  }
}

async function storeMessage(tabId, msg) {
  const key = "conv_" + tabId;
  try {
    storageManager.flushWrite(key); // Ensure any pending writes are flushed before reading
    const messages = await storageManager.get(key) || [];
    const streamKey = "stream_" + tabId;
    const streaming = streamingMessages.get(streamKey);
    if (streaming && msg.role === "user") {
      const finalized = { role: "assistant", content: streaming.content, model: streaming.model, timestamp: streaming.startTime, streamed: true };
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.content !== finalized.content) { messages.push(finalized); }
      streamingMessages.delete(streamKey);
    }
    messages.push(msg);
    if (messages.length > 100) messages.splice(0, messages.length - 100);
    storageManager.queueWrite(key, messages);
  } catch (error) {
    console.warn("[VIVIM:STORAGE] storeMessage failed:", error);
  }
}

function clearConversation(tabId) {
  const key = "conv_" + tabId;
  storageManager.pendingWrites.delete(key); // Cancel any pending writes
  const timeout = storageManager.writeTimeouts.get(key);
  if (timeout) {
    clearTimeout(timeout);
    storageManager.writeTimeouts.delete(key);
  }
  storageManager.remove(key);
  streamingMessages.delete("stream_" + tabId);
}

async function storeStreamedMessage(tabId) {
  const streamKey = "stream_" + tabId;
  const streaming = streamingMessages.get(streamKey);
  if (!streaming) return;

  streamingMessages.delete(streamKey);
  const key = "conv_" + tabId;
  try {
    storageManager.flushWrite(key); // Ensure any pending writes are flushed before reading
    const messages = await storageManager.get(key) || [];
    messages.push({ role: "assistant", content: streaming.content, model: streaming.model, timestamp: streaming.startTime, streamed: true });
    if (messages.length > 100) messages.splice(0, messages.length - 100);
    storageManager.queueWrite(key, messages);
  } catch (error) {
    console.warn("[VIVIM:STORAGE] storeStreamedMessage failed:", error);
  }
}

// Side Panel Communication
function broadcastToSidePanel(tabId, message) {
  broadcastToAllDestinations("message", message);
}

// Side Panel Setup
chrome.action.onClicked.addListener((tab) => {
  if (/^https:\/\/(chatgpt\.com|chat\.com)\//.test(tab.url || "")) {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

chrome.sidePanel.setOptions({ enabled: true, path: "sidepanel.html" });

function initTelemetry() {
  if (typeof VIVIMTelemetry !== 'undefined') {
    telemetry = VIVIMTelemetry;
    telemetry.init({ retentionDays: 30, sampleRate: 1.0 }).then(() => {
      try {
        telemetry.trackAction('background_loaded', { version: '1.0.0' });
      } catch (e) {
        console.warn('[VIVIM] Track failed:', e);
      }
      console.log('[VIVIM] Telemetry initialized');
    }).catch(e => {
      console.warn('[VIVIM] Telemetry init failed:', e);
    });
  }
}

initTelemetry();

console.log("[VIVIM POC] Background service worker initialized");