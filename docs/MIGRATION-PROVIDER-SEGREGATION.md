# Provider Segregation Migration Guide

## Overview

This document describes the migration from monolithic provider architecture to a fully segregated provider system where each AI provider (ChatGPT, Claude, Gemini) has its own dedicated modules for authentication, interception, and streaming.

## What Changed

### Before (Monolithic)
```
src/core/providers/
├── BaseProvider.js      # Shared base
├── AuthStore.js          # Generic auth (all providers)
├── ProviderMixin.js     # Shared mixins
└── ProviderRegistry.js

src/providers/
├── chatgpt/ChatGPTProvider.js    # Mixed concerns
├── claude/ClaudeProvider.js     # Mixed concerns
└── gemini/GeminiProvider.js     # Mixed concerns
```

### After (Segregated)
```
src/providers/
├── chatgpt/
│   ├── ChatGPTProvider.js           # Main class
│   ├── ChatGPTAuthStore.js         # Provider auth
│   ├── ChatGPTStealthInterceptor.js # Request interception
│   └── ChatGPTResponseParser.js   # Streaming parser
├── claude/
│   ├── ClaudeProvider.js
│   ├── ClaudeAuthStore.js
│   ├── ClaudeStealthInterceptor.js
│   └── ClaudeResponseParser.js
└── gemini/
    ├── GeminiProvider.js
    ├── GeminiAuthStore.js
    ├── GeminiStealthInterceptor.js
    └── GeminiResponseParser.js
```

## Key Benefits

| Benefit | Before | After |
|---------|--------|-------|
| **Auth Isolation** | Shared AuthStore with generic keys | Provider-specific auth stores (psid, apiKey, accessToken) |
| **Streaming** | Centralized StreamingManager with generic parsers | Provider-owned ResponseParser with exact format handling |
| **Interception** | Mixed into provider class | Dedicated StealthInterceptor per provider |
| **Debugging** | Hard to trace where auth came from | Clear ownership per provider folder |

## Auth Store Comparison

### ChatGPT
```javascript
// Before: Generic AuthStore
const auth = authStore.getLatest(); // { authorization, extraHeaders }

// After: ChatGPTAuthStore
auth = {
  authorization: 'gpt-...',      // Access token
  extraHeaders: {                 // Provider-specific headers
    'chatgpt-oai-access-token': '...',
    'chatgpt-requirements': '...'
  }
}
```

### Claude
```javascript
// After: ClaudeAuthStore
auth = {
  authorization: 'session-key',   // Session cookie
  apiKey: 'sk-ant-...',           // Anthropic API key
  extraHeaders: {}
}
```

### Gemini
```javascript
// After: GeminiAuthStore
auth = {
  psid: '__Secure-1PSID=...',     // Cookie auth
  psidts: '...',                 // Timestamp
  snlm0e: '...'                 // Page token
}
```

## Streaming Parser Comparison

Each provider now has its own ResponseParser tuned to the exact streaming format:

| Provider | Format | Parser |
|----------|--------|--------|
| ChatGPT | Delta encoding v1 (SSE) | ChatGPTResponseParser |
| Claude | Anthropic SSE events | ClaudeResponseParser |
| Gemini | Google SSE + candidates | GeminiResponseParser |

### Example: ChatGPT Streaming
```javascript
// In ChatGPTResponseParser
async process(options) {
  // Parse SSE events
  // Handle delta patch operations: { o: "patch", p: "/message/content/parts/0", v: "text" }
  // Reconstruct cumulative content from messageParts array
}
```

### Example: Claude Streaming
```javascript
// In ClaudeResponseParser
async processSSEEvent(eventType, data, emitChunk) {
  // Handle Claude-specific events:
  // - message_start
  // - content_block_start/delta/stop
  // - message_delta (usage)
  // - message_stop
}
```

## Interception Comparison

### Before
```javascript
// In ChatGPTProvider.js (mixed concerns)
onRequest(ctx) {
  // Extract auth from headers
  // Parse user prompt
  // Handle streaming
  // All in one class!
}
```

### After
```javascript
// In ChatGPTStealthInterceptor.js
processRequest(ctx) {
  // Extract auth headers
  // Handle provider-specific tokens
}

handleUserPrompt(ctx, callback) {
  // Parse request body
  // Extract user message
  // Emit to bridge
}
```

## Migration Steps

### 1. Update Imports

Old:
```javascript
import { ChatGPTProvider } from './providers/chatgpt/ChatGPTProvider.js';
import { createAuthStore } from '../core/providers/AuthStore.js';
```

New:
```javascript
import { ChatGPTProvider } from './providers/chatgpt/ChatGPTProvider.js';
// AuthStore is imported internally by ChatGPTProvider
```

### 2. Provider Initialization

Old:
```javascript
const provider = new ChatGPTProvider();
provider.authStore.setPrimary(token);
```

New:
```javascript
const provider = new ChatGPTProvider();
// Use onAuthDataLoaded for secure auth loading
provider.onAuthDataLoaded({ authorization: token });
```

### 3. Auth Header Access

Old:
```javascript
const headers = provider.getAuthHeaders();
```

New:
```javascript
// Still the same API, but internally uses provider-specific AuthStore
const headers = provider.getAuthHeaders();
```

### 4. Streaming Response

Old:
```javascript
await streamingManager.processStream({
  streamId,
  response,
  format: 'delta-encoding-v1',
  metadata: { provider: 'chatgpt' }
});
```

New:
```javascript
// Now handled internally by provider's ResponseParser
await provider.onResponse(ctx);
```

## File Path Changes

| Old Path | New Path |
|----------|----------|
| `src/providers/chatgpt/ChatGPTProvider.js` | `src/providers/chatgpt/ChatGPTProvider.js` (updated) |
| `src/core/providers/AuthStore.js` | Removed (now in each provider folder) |
| `src/core/providers/BaseAIProvider.js` | Still available as base reference |
| - | `src/providers/chatgpt/ChatGPTAuthStore.js` (new) |
| - | `src/providers/chatgpt/ChatGPTStealthInterceptor.js` (new) |
| - | `src/providers/chatgpt/ChatGPTResponseParser.js` (new) |

## Deprecation Timeline

| Version | Status |
|---------|--------|
| v2.0.0 | Old architecture available |
| v2.1.0 | Old architecture deprecated |
| v2.2.0 | Old architecture removed |

## Adding a New Provider

To add a new AI provider (e.g., DeepSeek), create a new folder:

```
src/providers/deepseek/
├── DeepSeekProvider.js
├── DeepSeekAuthStore.js
├── DeepSeekStealthInterceptor.js
└── DeepSeekResponseParser.js
```

Example structure:

```javascript
// DeepSeekAuthStore.js
export class DeepSeekAuthStore {
  constructor() {
    this.apiKey = null;
  this.extraHeaders = {};
  }
  
  setApiKey(key) { this.apiKey = key; }
  getLatest() { return { apiKey: this.apiKey, ... }; }
}
```

## Common Issues

### Q: Where do I store API keys?
A: Each provider's AuthStore handles its own storage. Use `provider.onAuthDataLoaded()` for secure loading.

### Q: How do I debug streaming issues?
A: Check the provider-specific ResponseParser. Each has detailed logging for its format.

### Q: Can I still use the old architecture?
A: Yes, but it's deprecated. Migration is recommended for better isolation.

### Q: What happens to existing conversations?
A: Storage is unchanged. Only the provider modules changed.

## Rollback Procedure

If issues occur, rollback by reverting to the previous provider files:
```bash
git checkout HEAD~1 src/providers/
```

## Contact

For questions about the migration, check the provider folder's README or open an issue.