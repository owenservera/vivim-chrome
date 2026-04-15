# VIVIM POC — API Reference

> Interface definitions and type references

## Core Classes

### Plugin

Base class for all provider integrations.

```javascript
class Plugin {
  get name() { return "BasePlugin"; }
  get protocol() { return 'fetch'; }
  
  matchRequest(ctx) { return false; }
  onRequest(ctx) {}
  matchResponse(ctx) { return false; }
  async onResponse(ctx) {}
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `name` | getter string | Provider display name |
| `protocol` | getter string | `'fetch'`, `'xhr'`, or `'both'` |

**Methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `matchRequest` | `ctx: RequestContext` | `boolean` | Match if this plugin handles request |
| `onRequest` | `ctx: RequestContext` | `void` | Process request (capture auth, etc.) |
| `matchResponse` | `ctx: ResponseContext` | `boolean` | Match if this plugin handles response |
| `onResponse` | `ctx: ResponseContext` | `Promise<void>` | Process streaming response |

---

### RequestContext

Context passed to request plugins.

```typescript
interface RequestContext {
  protocol: 'fetch' | 'xhr';
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string | FormData | URLSearchParams;
  init?: RequestInit;           // fetch only
  xhr?: XMLHttpRequest;         // xhr only
  timestamp: number;
}
```

---

### ResponseContext

Context passed to response plugins.

```typescript
interface ResponseContext {
  protocol: 'fetch' | 'xhr';
  url: string;
  request: RequestContext;
  response: Response;
  clone: Response | null;
  timestamp: number;
}
```

---

### StreamDestination

Base class for all message consumers.

```javascript
class StreamDestination {
  get id() { return 'base'; }
  get capabilities() { 
    return { 
      receivesStreaming: false,
      receivesComplete: false,
      canSendPrompts: false
    }; 
  }
  
  onChunk(msg) {}
  onComplete(conversationId) {}
  onError(conversationId, error) {}
  async sendPrompt(conversationId, prompt) {}
  dispose() {}
}
```

**Properties:**

| Property | Type | Description |
|----------|------|-------------|
| `id` | getter string | Unique destination identifier |
| `capabilities` | getter object | `{ receivesStreaming, receivesComplete, canSendPrompts }` |

**Methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `onChunk` | `msg: NormalizedMessage` | `void` | Handle streaming chunk |
| `onComplete` | `conversationId: string` | `void` | Handle stream completion |
| `onError` | `conversationId, error` | `void` | Handle stream error |
| `sendPrompt` | `conversationId, prompt` | `Promise<void>` | Send prompt to provider |
| `dispose` | none | `void` | Cleanup resources |

---

### Capabilities

```typescript
interface Capabilities {
  receivesStreaming: boolean;  // Gets incremental chunks
  receivesComplete: boolean;     // Gets final message
  canSendPrompts: boolean;      // Can inject prompts back
}
```

---

### DestinationRegistry

Manages multiple destinations.

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

**Methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `register` | `destination: StreamDestination` | `void` | Add destination |
| `unregister` | `id: string` | `void` | Remove destination |
| `get` | `id: string` | `StreamDestination \| undefined` | Get destination |
| `getAll` | none | `StreamDestination[]` | List all destinations |
| `broadcastChunk` | `msg: NormalizedMessage` | `void` | Send chunk to all destinations |
| `broadcastComplete` | `conversationId: string` | `void` | Send completion to all |
| `broadcastError` | `conversationId, error` | `void` | Send error to all |

---

### FetchInterceptor

Global fetch hook for modern providers.

```javascript
class FetchInterceptor {
  plugins: Plugin[];
  isHooked: boolean;
  originalFetch: typeof fetch;
  
  register(plugin) { }
  runRequestPlugins(ctx) { }
  runResponsePlugins(ctx) { }
  start() { }
  stop() { }
}
```

---

### XHRInterceptor

Global XMLHttpRequest hook for legacy providers.

```javascript
class XHRInterceptor {
  plugins: Plugin[];
  initialized: boolean;
  
  register(plugin) { }
  start() { }
  stop() { }
}
```

---

## Data Stores

### AuthStore Interface

```javascript
class AuthStore {
  static authorization = null;
  static updatedAt = null;
  
  static setAuthData(auth) { }
  static getLatest() { }
}
```

**Methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `setAuthData` | `auth: string` | `void` | Store auth data |
| `getLatest` | none | `{ authorization, updatedAt }` | Retrieve latest auth |

---

### ChatGPTAuthStore

```javascript
class ChatGPTAuthStore {
  static setAuthData(auth) { }
  static setExtraHeaders(headers) { }
  static getLatest() { }
}
```

---

### GeminiAuthStore

```javascript
class GeminiAuthStore {
  static setReqId(reqId) { }
  static setExtHeaders(headers) { }
  static getLatest() { }
}
```

---

### NotebookLMAuthStore

```javascript
class NotebookLMAuthStore {
  static setReqId(reqId) { }
  static setAtToken(token) { }
  static setConversationUuid(uuid) { }
  static getLatest() { }
}
```

---

### KimiAuthStore

```javascript
class KimiAuthStore {
  static setAuthData(auth) { }
  static setExtraHeaders(headers) { }
  static setListMessagesUrl(url) { }
  static getLatest() { }
}
```

---

### CopilotAuthStore

```javascript
class CopilotAuthStore {
  static setAuthData(auth, identityType) { }
  static getLatest() { }
}
```

---

## Bridge API

### WebMessage Bridge

Bidirectional communication between MAIN and ISOLATED worlds.

```javascript
class Bridge {
  communicationId: string;
  messageType: string;
  isReady: boolean;
  
  addAllowedId(id) { }
  removeAllowedId(id) { }
  isAllowedId(id) { }
  generateId() { }
  
  send(type, data) { }
  invoke(type, data) { }
  handle(type, handler) { }
  
  async ensureReady() { }
  destroy() { }
}
```

**Methods:**

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `addAllowedId` | `id: string` | `void` | Add allowed communication ID |
| `removeAllowedId` | `id: string` | `void` | Remove allowed ID |
| `isAllowedId` | `id: string` | `boolean` | Check if ID allowed |
| `generateId` | none | `string` | Generate message ID |
| `send` | `type, data` | `void` | Send one-way message |
| `invoke` | `type, data` | `Promise<any>` | Send request, await response |
| `handle` | `type, handler` | `() => void` | Register request handler |
| `ensureReady` | none | `Promise<void>` | Wait for bridge ready |
| `destroy` | none | `void` | Cleanup bridge |

---

## Chrome Messages

### Message Types (Content → Background)

```typescript
// Stream user message
type: "USER_PROMPT"
payload: { content: string, conversationId: string | null, timestamp: number }

// Stream chunk from provider
type: "STREAM_CHUNK"
payload: { role: string, content: string, model: string, url: string, seq: number, cumulative: boolean }

// Stream complete
type: "STREAM_COMPLETE"
payload: { timestamp: number }

// Save from DOM button
type: "SAVE_FROM_DOM"
payload: { content: string, timestamp: number }
```

### Message Types (Background → Sidepanel)

```typescript
// Tab detected
type: "TAB_DETECTED"
payload: { platform: string, url: string, tabId: number }

// New message added
type: "MESSAGE_ADDED"
payload: { role: string, content: string, timestamp: number, tabId: number }

// Stream update
type: "STREAM_UPDATE"
payload: { role: string, content: string, model: string, tabId: number, timestamp: number, seq: number }

// Stream complete
type: "STREAM_COMPLETE"
payload: { tabId: number, timestamp: number }

// Conversation cleared
type: "CONVERSATION_CLEARED"
payload: { tabId: number }

// Save triggered
type: "SAVE_TRIGGERED"
payload: { timestamp: number, tabId: number }
```

### Message Types (Sidepanel → Background)

```typescript
// Get stored conversation
type: "GET_CONVERSATION"
→ response: { messages: Message[], conversationId: string | null, url: string | null }

// Clear conversation
type: "CLEAR_CONVERSATION"
→ response: { ok: boolean }

// Get tab status
type: "GET_TAB_STATUS"
→ response: { isChatGPT: boolean, conversationId: string | null, platform: string }
```

### Message Types (Management)

```typescript
// Register destination
type: "REGISTER_DESTINATION"
payload: { id: string, config: object }
→ response: { ok: boolean }

// Unregister destination
type: "UNREGISTER_DESTINATION"
payload: { id: string }
→ response: { ok: boolean }

// List destinations
type: "LIST_DESTINATIONS"
→ response: { destinations: string[] }
```

---

## Message Structure

### Message Interface

```typescript
interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  model?: string;
  timestamp: number;
  streamed?: boolean;
}
```

### Chunk Interface

```typescript
interface Chunk {
  role: string;
  content: string;
  model: string;
  url: string;
  seq: number;
  cumulative: boolean;
}
```

---

## Events

### Bridge Events

```typescript
// In inject-web.js
window.__VIVIM_BRIDGE.send("chatChunk", { ... });
window.__VIVIM_BRIDGE.send("streamComplete", { ... });
window.__VIVIM_BRIDGE.send("userPrompt", { ... });
```

### Chrome Extension Events

```typescript
// Tab events
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {});
chrome.tabs.onRemoved.addListener((tabId) => {});
chrome.tabs.onActivated.addListener((activeInfo) => {});

// Message events
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {});

// Side panel events
chrome.action.onClicked.addListener((tab) => {});
chrome.sidePanel.setOptions({ enabled: true, path: "sidepanel.html" });
```

---

## Constants

### URL Patterns

```javascript
const CHATGPT_URLS = ["/backend-api/"];
const COPILOT_URLS = ["copilot.microsoft.com"];
const KIMI_URLS = ["/apiv2/kimi.gateway.chat", "/ListMessages"];
const GEMINI_URLS = ["/_/BardChatUi/data/batchexecute"];
const NOTEBOOKLM_URLS = ["/_/LabsTailwindUi/data/batchexecute"];
const GOOGLEAI_RESOLVE = ["MakerSuiteService/ResolveDriveResource"];
```

### Header Prefixes

```javascript
const CHATGPT_HEADER_PREFIXES = ["chatgpt-", "oai-"];
```

### MIME Types

```javascript
const CONTENT_TYPES = {
  JSON: "application/json",
  FORM: "application/x-www-form-urlencoded",
  SSE: "text/event-stream"
};
```

---

## Errors

### Bridge Errors

```javascript
// Handshake failed
new Error("建联失败: {error}")

// Request timeout
new Error("请求超时: {action}")
```

### Stream Errors

```javascript
// No clone available
new Error("No clone or body available")

// Response not OK
new Error("Response not OK: {status}")

// Stream read error
new Error("Stream read error: {error}")
```