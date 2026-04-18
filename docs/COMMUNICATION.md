# Communication Architecture

## Overview

VIVIM uses a multi-layered communication system to coordinate between extension components, web pages, and AI providers.

## Communication Layers

```
┌──────────────────────────────────────────────────────────────────────┐
│                    Web Context                              │
│  ┌────────────────┐    window.postMessage              │
│  │  AI Chat Page  │◄──────────────────────────────────┼──┐
│  └────────────────┘         (WebBridge)                │  │
└──────────────────────────────────────────────────────┘    │
                                                           │
                        chrome.runtime                       │
                             │                            │
                             ▼                            │
┌──────────────────────────────────────────────────────┐    │
│              Extension Context (Background SW)         │    │
│  ┌─────────────────────────────────────────────┐     │    │
│  │              MessageBus                     │◄────┘    │
│  │         (Pub/Sub with Middleware)            │           │
│  └─────────────────────────────────────────────┘           │
│                        │                                │
│          ┌────────────┼────────────┐                     │
│          ▼          ▼          ▼                      │
│    ┌──────────┐ ┌──────────┐ ┌──────────┐                │
│    │  Tab    │ │Conv      │ │API      │                │
│    │Manager  │ │Manager  │ │Stream   │                │
│    └──────────┘ └──────────┘ └──────────┘                │
└──────────────────────────────────────────────────────┘
                             │
                  chrome.runtime.sendMessage
                             │
                             ▼
┌──────────────────────────────────────────────────────┐
│                 Side Panel UI                        │
│              (chrome.sidePanel)                       │
└──────────────────────────────────────────────────────┘
```

## Message Types

### Request Messages (Content Script → Background)

| Message Type | Payload | Purpose |
|--------------|---------|---------|
| `USER_PROMPT` | `{ prompt, provider }` | Send user prompt to provider |
| `SAVE_FROM_DOM` | `{ content, timestamp }` | Save response from DOM |
| `REGISTER_DESTINATION` | `{ id, config }` | Register UI component |
| `EXPORT_ALL_CONVERSATIONS` | none | Export all stored conversations |

### Response Messages (Background → Content Script)

| Message Type | Payload | Purpose |
|--------------|---------|---------|
| `STREAM_CHUNK` | `{ chunk, messageId }` | Streaming response chunk |
| `STREAM_COMPLETE` | `{ messageId, metadata }` | Streaming complete |

### Event Messages

| Message Type | Purpose |
|--------------|---------|
| `INJECT_PROMPT` | Inject prompt into page |
| `PING` | Health check |
| `TEST_COMMUNICATION` | Test message channel |

## MessageBus

**Path**: `src/core/messaging/MessageBus.js`

Central pub/sub system for extension-wide communication.

### API

```javascript
const messageBus = new MessageBus();

// Register handler for message type
messageBus.on('USER_PROMPT', (message, sender) => {
  // Handle message
  return { success: true };
});

// Wildcard handler (catches all)
messageBus.on('*', (message, sender) => {
  console.log('Received:', message.type);
});

// Add middleware
messageBus.use(async (message) => {
  // Validate message
  const result = MessageValidator.validateMessage(message);
  if (!result.valid) {
    return false; // Block message
  }
  return message;
});

// Emit message
const result = await messageBus.emit(message, sender);
```

### Features
- Type-based routing
- Wildcard handlers (`*`)
- Middleware pipeline
- Async handler support
- Error isolation per handler

## WebBridge

**Path**: `src/core/bridge/WebBridge.js`

Communication between content script and page context via `window.postMessage`.

### Protocol

```javascript
// Content script receives
window.addEventListener('message', (event) => {
  const data = event.data;
  if (data.type === 'vivim-bridge' && data.communicationId === 'vivim-bridge') {
    // Handle bridge message
  }
});

// Forward to background
chrome.runtime.sendMessage({
  type: 'USER_PROMPT',
  ...data.data
});
```

### Message Format

```javascript
{
  type: 'vivim-bridge',
  communicationId: 'vivim-bridge',
  action: 'userPrompt',      // Action name
  requestId: 'uuid',       // Request tracker
  data: { /* payload */ },
  timestamp: 1234567890
}
```

## Content Script Communication

**Path**: `src/content/index.js`

Handles DOM-level communication and prompt injection.

### Prompt Injection

```javascript
// ChatGPT injection
function injectToChatGPT(prompt) {
  const input = document.querySelector('#prompt-textarea');
  input.value = prompt;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  // Click submit
  document.querySelector('button[data-testid="send-button"]').click();
}

// Claude injection
function injectToClaude(prompt) {
  const textarea = document.querySelector('[data-testid="prompt-textarea"]');
  textarea.value = prompt;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

// Gemini injection
function injectToGemini(prompt) {
  const textarea = document.querySelector('rich-textarea').shadowRoot.querySelector('textarea');
  textarea.value = prompt;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}
```

## Storage Communication

Uses `chrome.storage` for persistent state:

- `chrome.storage.local` — Extension-local storage
- `chrome.storage.sync` — Cross-device sync (if available)

## Message Flow Example

```
1. User types prompt in Side Panel
         │
         ▼
2. Side Panel → chrome.runtime.sendMessage({ type: 'USER_PROMPT', ... })
         │
         ▼
3. Background MessageBus.emit(message)
         │
         ├──► MessageValidator.validate() [middleware]
         │
         ├──► Handler: ConversationManager.savePrompt()
         ���
         └──► Handler: DestinationManager.route()
                          │
                          ▼
                   4. API call to AI provider
                          │
                          ▼
                   5. Stream response → STREAM_CHUNK
                          │
                          ▼
                   6. Background → chrome.runtime.sendMessage()
                          │
                          ▼
                   7. Content Script (if in-page) or Side Panel receives
```

## Error Handling

**Path**: `src/core/providers/ErrorHandler.js`

Centralized error handling with:
- Error categorization
- Retry logic
- User-friendly messages
- Logging

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture
- [STORAGE.md](STORAGE.md) — Storage layout