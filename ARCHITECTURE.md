# VIVIM POC — Architecture Reference

> Multi-Provider, Multi-Destination Chrome Extension Design

## Overview

VIVIM POC is a Chrome extension that intercepts AI provider conversations (ChatGPT, Claude, Gemini, etc.) and streams them to multiple destinations (sidepanel, WebSocket, webhook).

```
┌────────────────────────────────────────────────────────────────┐
│                    VIVIM EXTENSION                         │
├────────────────────────────────────────────────────────────┤
│ INTERCEPTOR LAYER                                          │
│ ├── FetchInterceptor  ── HTTP requests (ChatGPT, Copilot)  │
│ └── XHRInterceptor   ── Legacy XHR (Gemini, NotebookLM)   │
├────────────────────────────────────────────────────────────┤
│ PLUGIN LAYER (6 providers)                              │
│ ├── ChatGPTPlugin     - Delta encoding v1 parsing       │
│ ├── CopilotPlugin    - Auth header capture             │
│ ├── KimiPlugin      - Kimi (Moonshot) API               │
│ ├── GeminiPlugin    - Google Gemini XHR               │
│ ├── NotebookLMPlugin - Google NotebookLM XHR            │
│ └── GoogleAIResolvePlugin - Resource resolution         │
├────────────────────────────────────────────────────────────┤
│ MESSAGE BRIDGE                                           │
│ inject-web.js ──► content.js ──► background.js          │
│ (WebMessage API)      (Chrome message)                   │
├────────────────────────────────────────────────────────────┤
│ DESTINATION LAYER                                       │
│ ├── sidepanel      - Chrome side panel UI                 │
│ ├── webhook      - HTTP POST to external URL             │
│ └── websocket   - WebSocket streaming                  │
└────────────────────────────────────────────────────────────────┘
```

## Core Concepts

### 1. Plugin System

Providers implement the `Plugin` interface:

```javascript
class Plugin {
  // Protocol: 'fetch' | 'xhr' | 'both'
  get protocol() { return 'fetch'; }
  
  // Match requests this plugin handles
  matchRequest(ctx) { return false; }
  
  // Process request (capture auth, etc.)
  onRequest(ctx) {}
  
  // Match streaming responses
  matchResponse(ctx) { return false; }
  
  // Process streaming response
  onResponse(ctx) {}
}
```

**Context Object:**
```javascript
const ctx = {
  protocol: 'fetch' | 'xhr',
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string | FormData | URLSearchParams,
  init: RequestInit,        // fetch only
  response: Response,       // fetch only
  clone: Response,          // fetch only
  timestamp: number
};
```

### 2. Fetch Interceptor

Global `window.fetch` hook that routes to matching plugins:

```javascript
class FetchInterceptor {
  register(plugin) { }
  start() { }  // Hooks window.fetch
  stop() { }   // Restores original
}
```

### 3. XHR Interceptor

Global `XMLHttpRequest` hook for legacy providers:

```javascript
class XHRInterceptor {
  register(plugin) { }
  start() { }  // Hooks XMLHttpRequest
  stop() { }
}
```

### 4. Stream Destination

Consumers implement the `StreamDestination` interface:

```javascript
class StreamDestination {
  get id() { return 'base'; }
  get capabilities() { 
    return { 
      receivesStreaming: boolean,
      receivesComplete: boolean,
      canSendPrompts: boolean 
    }; 
  }
  
  onChunk(msg) {}
  onComplete(conversationId) {}
  onError(conversationId, error) {}
  sendPrompt(conversationId, prompt) {}
  dispose() {}
}
```

### 5. Destination Registry

Manages multiple destinations with capability-based routing:

```javascript
class DestinationRegistry {
  register(destination) { }
  unregister(id) { }
  get(id) { }
  getAll() { }
  broadcastChunk(msg) { }
  broadcastComplete(conversationId) { }
  broadcastError(conversationId, error) { }
}
```

## Message Flow

### Request Flow
```
User types prompt on chatgpt.com
         │
         ▼
window.fetch interceptor
         │
    ┌────┴────┐
    ▼         ▼
ChatGPTPlugin  Other plugins
matchRequest?  (no match)
    │
    ▼
Captures auth headers
Stores in ChatGPTAuthStore
```

### Response Flow
```
ChatGPT server streams SSE
         │
    FetchInterceptor clones response
         │
    ChatGPTPlugin.matchResponse() ──► TRUE
         │
    onResponse() parses delta encoding
         │
    Sends chunk via Bridge:
    window.__VIVIM_BRIDGE.send("chatChunk", {...})
         │
    content.js receives message
         │
    chrome.runtime.sendMessage() ──► Background
         │
    Background processes + stores
         │
    broadcastToAllDestinations() ──► Sidepanel
```

## File Structure

```
poc/
├── inject-web.js      # Main interceptor (MAIN world)
├── content.js        # Message bridge (ISOLATED world)
├── background.js     # Service worker (BACKGROUND)
├── sidepanel.html   # Side panel UI
├── sidepanel.js      # Side panel logic
├── manifest.json    # Extension manifest
├── package.json     # npm + build config
├── build.mjs        # esbuild script
│
└── dist/            # Built output
    ├── inject-web.js
    ├── content.js
    ├── background.js
    ├── sidepanel.html
    └── manifest.json
```

## Data Stores

Static classes for cross-request auth storage:

```javascript
// ChatGPT auth
class ChatGPTAuthStore {
  static setAuthData(auth) { }
  static setExtraHeaders(headers) { }
  static getLatest() { }
}

// Gemini ( Bard ) auth
class GeminiAuthStore {
  static setReqId(id) { }
  static setExtHeaders(headers) { }
  static getLatest() { }
}

// NotebookLM auth
class NotebookLMAuthStore {
  static setReqId(id) { }
  static setAtToken(token) { }
  static setConversationUuid(uuid) { }
  static getLatest() { }
}

// Kimi auth
class KimiAuthStore {
  static setAuthData(auth) { }
  static setListMessagesUrl(url) { }
  static getLatest() { }
}

// Copilot auth  
class CopilotAuthStore {
  static setAuthData(auth, identityType) { }
  static getLatest() { }
}
```

## WebMessage Bridge

Bidirectional bridge between MAIN and ISOLATED worlds:

```javascript
// In inject-web.js (MAIN world)
const bridge = L("inject-chat-web", { allowedIds: ["saveai-extension-content"] });
window.__VIVIM_BRIDGE = bridge;

// Send messages
bridge.send("chatChunk", { role: "assistant", content: "..." });
bridge.send("streamComplete", { timestamp: Date.now() });

// Handle requests
bridge.handle("getChatGPTAuthHeader", () => ChatGPTAuthStore.getLatest());
```

```javascript
// In content.js (ISOLATED world)
window.addEventListener("message", (e) => {
  if (e.data.type === "web-bridge" && e.data.communicationId === "inject-chat-web") {
    // Handle messages
  }
});
```

## Providers

### ChatGPTPlugin

- **Protocol:** fetch
- **URL patterns:** `/backend-api/*`
- **Captures:** Authorization, extra headers (oai-*, chatgpt-*)
- **Response:** Delta encoding v1 SSE stream parsing
- **Features:**
  - Delta operation parsing (add, replace, patch)
  - Model tracking
  - Role tracking
  - Chunk sequencing

### CopilotPlugin

- **Protocol:** fetch
- **URL patterns:** `copilot.microsoft.com`
- **Captures:** Authorization, X-Useridentitytype

### KimiPlugin

- **Protocol:** fetch
- **URL patterns:** `/apiv2/kimi.gateway.chat`, `/ListMessages`
- **Captures:** Authorization, extra headers

### GeminiPlugin

- **Protocol:** xhr
- **URL patterns:** `/_/BardChatUi/data/batchexecute`
- **Captures:** `_reqid`, x-goog-ext-* headers

### NotebookLMPlugin

- **Protocol:** xhr
- **URL patterns:** `/_/LabsTailwindUi/data/batchexecute`
- **rpcids:** `VfAZjd`, `khqZz`
- **Captures:** `_reqid`, `at` token, `f.req` conversation UUID

### GoogleAIResolvePlugin

- **Protocol:** xhr
- **URL patterns:** `MakerSuiteService/ResolveDriveResource`
- **Captures:** Request URL

## Destinations

### Sidepanel

- **ID:** sidepanel (default)
- **Capabilities:** receivesStreaming, receivesComplete
- **Communication:** chrome.runtime.sendMessage

### WebhookDestination

- **ID:** webhook
- **Capabilities:** receivesComplete only
- **Configuration:** `{ url: "https://..." }`

### WebSocketDestination

- **ID:** websocket
- **Capabilities:** receivesStreaming, receivesComplete, canSendPrompts
- **Configuration:** `{ url: "wss://...", maxReconnectAttempts: 3 }`

## Extension Lifecycle

### Startup (inject-web.js)
```javascript
const b = y(() => {
  // 1. Initialize bridge
  const bridge = L("inject-chat-web", {...});
  window.__VIVIM_BRIDGE = bridge;
  
  // 2. Register handlers
  bridge.handle("getChatGPTAuthHeader", () => ChatGPTAuthStore.getLatest());
  
  // 3. Start interceptors
  fetchInterceptor.register(new ChatGPTPlugin());
  fetchInterceptor.register(new CopilotPlugin());
  fetchInterceptor.register(new KimiPlugin());
  fetchInterceptor.start();
  
  xhrInterceptor.register(new GeminiPlugin());
  xhrInterceptor.register(new NotebookLMPlugin());
  xhrInterceptor.register(new GoogleAIResolvePlugin());
  
  // Only start XHR on relevant sites
  if (isGemini || isNotebookLM) xhrInterceptor.start();
});
```

### Background Service Worker
```javascript
// 1. Initialize destinations
registerDestination("sidepanel");

// 2. Setup tab detection
chrome.tabs.onUpdated.addListener(handleTabUpdate);
chrome.tabs.onActivated.addListener(handleTabActivate);

// 3. Setup message routing
chrome.runtime.onMessage.addListener(handleMessage);

// 4. Setup sidepanel
chrome.action.onClicked.addListener(openSidePanel);
chrome.sidePanel.setOptions({...});
```

## Chrome Message Types

| Type | Direction | Payload |
|-----|-----------|--------|
| USER_PROMPT | content → bg | `{ content, conversationId, timestamp }` |
| STREAM_CHUNK | content → bg | `{ role, content, model, url, seq, cumulative }` |
| STREAM_COMPLETE | content → bg | `{ timestamp }` |
| GET_CONVERSATION | sidepanel → bg | → `{ messages, conversationId, url }` |
| CLEAR_CONVERSATION | sidepanel → bg | → `{ ok }` |
| GET_TAB_STATUS | sidepanel → bg | → `{ isChatGPT, conversationId, platform }` |
| SAVE_FROM_DOM | content → bg | `{ content, timestamp }` |
| REGISTER_DESTINATION | any → bg | `{ id, config }` ��� `{ ok }` |
| UNREGISTER_DESTINATION | any → bg | `{ id }` → `{ ok }` |
| LIST_DESTINATIONS | any → bg | → `{ destinations: [] }` |

## Broadcast Events (to destinations)

| Type | Payload |
|-----|---------|
| TAB_DETECTED | `{ type, platform, url, tabId }` |
| MESSAGE_ADDED | `{ type, role, content, timestamp, tabId }` |
| STREAM_UPDATE | `{ type, role, content, model, tabId, timestamp, seq }` |
| STREAM_COMPLETE | `{ type, tabId, timestamp }` |
| CONVERSATION_CLEARED | `{ type, tabId }` |
| SAVE_TRIGGERED | `{ type, timestamp, tabId }` |

## Security Notes

1. **Content Script Isolation:** inject-web.js runs in MAIN world, content.js in ISOLATED world
2. **Bridge Validation:** Only messages from allowed IDs are processed
3. **Request Timeout:** Bridge requests timeout after 30 seconds
4. **No Sensitive Storage:** Auth tokens stored in memory only (not localStorage)

## Performance

- **Chunk Deduplication:** Sequence numbers prevent out-of-order chunks
- **Streaming:** SSE parsed incrementally (no full response buffering)
- **Lazy XHR:** Only interceptors for active provider sites
- **Memory Limits:** Max 100 messages per conversation stored