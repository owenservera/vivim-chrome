# Multi-Provider Architecture (Browser Intercept Focus)

## Two Operating Modes

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PROVIDER MODES                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  MODE 1: BROWSER INTERCEPT (Current - Focus First)                  │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  User visits chatgpt.com                                       │ │
│  │       │                                                        │ │
│  │       ▼                                                        │ │
│  │  inject-web.js intercepts SSE stream from website              │ │
│  │       │                                                        │ │
│  │       ▼                                                        │ │
│  │  Parse delta encoding → Extract chunks                         │ │
│  │       │                                                        │ │
│  │       ▼                                                        │ │
│  │  Bridge to content → Background → Sidepanel                    │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  MODE 2: API DIRECT (Future)                                         │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  User selects provider (OpenAI/Anthropic/DeepSeek)            │ │
│  │       │                                                        │ │
│  │       ▼                                                        │ │
│  │  Background sends direct API request with user's key          │ │
│  │       │                                                        │ │
│  │       ▼                                                        │ │
│  │  Receive SSE stream → Parse → Forward to sidepanel              │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Unified Provider Interface

Both modes implement the same interface - the difference is the transport layer:

```js
// All providers implement this abstract interface
class AIProvider {
  // Identity
  id: string                    // 'chatgpt-intercept', 'openai-api', etc.
  name: string                  // 'ChatGPT (Browser)', 'OpenAI API', etc.
  mode: 'intercept' | 'api'     // Operating mode
  
  // Capabilities
  capabilities: {
    streaming: boolean
    models: string[]
    supportsSystemPrompt: boolean
  }
  
  // Transport - unified for both modes
  transport: {
    sendPrompt(prompt): Promise<string>      // Returns response ID
    onChunk(callback): void                   // Register chunk handler
    onComplete(callback): void                // Register complete handler
    cancel(): void                            // Cancel current request
  }
  
  // Data Management
  dataPolicy: {
    storesConversations: boolean
    piiHandling: 'none' | 'mask'
  }
}
```

## Browser Intercept Implementation

```js
// src/providers/intercept/ChatGPTInterceptProvider.js

export class ChatGPTInterceptProvider {
  constructor() {
    this.id = 'chatgpt-intercept';
    this.name = 'ChatGPT (Browser)';
    this.mode = 'intercept';
    
    this.capabilities = {
      streaming: true,
      models: ['gpt-4', 'gpt-3.5'],
      supportsSystemPrompt: true
    };
    
    this.chunkCallbacks = [];
    this.completeCallbacks = [];
  }
  
  // Called from inject-web when SSE data arrives
  handleChunk(chunk) {
    // Parse delta-encoding format
    const parsed = this.parseDeltaEncoding(chunk);
    
    // Notify all registered handlers
    this.chunkCallbacks.forEach(cb => cb({
      content: parsed.content,
      model: parsed.model,
      role: 'assistant',
      done: parsed.done
    }));
  }
  
  // Called when stream completes
  handleComplete() {
    this.completeCallbacks.forEach(cb => cb());
  }
  
  // Transport interface
  onChunk(callback) {
    this.chunkCallbacks.push(callback);
  }
  
  onComplete(callback) {
    this.completeCallbacks.push(callback);
  }
  
  sendPrompt(prompt) {
    // This is triggered via DOM injection - the actual
    // sending happens on the ChatGPT page, we just observe
    return Promise.resolve('intercept-mode');
  }
  
  parseDeltaEncoding(data) {
    // Parse ChatGPT's delta encoding format
    // Extract: content, model, done flag
    return { content: data, model: 'gpt-4', done: false };
  }
}
```

## API Direct Implementation (Future)

```js
// src/providers/api/OpenAIApiProvider.js

export class OpenAIApiProvider {
  constructor() {
    this.id = 'openai-api';
    this.name = 'OpenAI API';
    this.mode = 'api';
    
    this.apiKey = null;
    this.capabilities = {
      streaming: true,
      models: ['gpt-4-turbo', 'gpt-3.5-turbo'],
      supportsSystemPrompt: true
    };
  }
  
  async initialize(config) {
    this.apiKey = config.apiKey;
  }
  
  // Transport - direct API call
  async sendPrompt(prompt, options = {}) {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        stream: true
      })
    });
    
    // Handle SSE response
    return this.handleStreamResponse(response);
  }
  
  async *handleStreamResponse(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      yield this.parseSSEChunk(chunk);
    }
  }
}
```

## Provider Registry

```js
// src/core/providers/ProviderRegistry.js

export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.activeProvider = null;
  }
  
  register(provider) {
    this.providers.set(provider.id, provider);
    console.log(`[Registry] Registered provider: ${provider.name} (${provider.mode})`);
  }
  
  get(id) {
    return this.providers.get(id);
  }
  
  setActive(id) {
    const provider = this.providers.get(id);
    if (provider) {
      this.activeProvider = provider;
      console.log(`[Registry] Active provider: ${provider.name}`);
    }
  }
  
  getActive() {
    return this.activeProvider;
  }
  
  // Find provider by mode
  findByMode(mode) {
    for (const provider of this.providers.values()) {
      if (provider.mode === mode) return provider;
    }
    return null;
  }
  
  list() {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      mode: p.mode,
      capabilities: p.capabilities
    }));
  }
}
```

## Data Flow - Current Intercept Mode

```
┌─────────────────────────────────────────────────────────────────────┐
│                    INTERCEPT MODE DATA FLOW                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. User types in ChatGPT                                           │
│         │                                                            │
│         ▼                                                            │
│  2. inject-web.js (MAIN world)                                       │
│     - Intercepts fetch/XHR to chatgpt.com/backend-api               │
│     - Parses response body (SSE stream)                             │
│         │                                                            │
│         ▼                                                            │
│  3. Bridge (window.postMessage)                                     │
│     - Sends 'chatChunk' to content script                           │
│         │                                                            │
│         ▼                                                            │
│  4. content.js (ISOLATED world)                                     │
│     - Receives from bridge                                          │
│     - Forwards via chrome.runtime.sendMessage                       │
│         │                                                            │
│         ▼                                                            │
│  5. background.js (Service Worker)                                  │
│     - Routes to ConversationManager                                 │
│     - Stores in IndexedDB                                            │
│     - Broadcasts to sidepanel                                       │
│         │                                                            │
│         ▼                                                            │
│  6. sidepanel.js (ISOLATED world)                                   │
│     - Receives message                                              │
│     - Renders in UI                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## File Structure

```
src/
├── core/
│   ├── providers/
│   │   ├── index.js              # Registry + exports
│   │   ├── ProviderRegistry.js  # Factory
│   │   ├── BaseProvider.js       # Abstract class
│   │   └── types.js             # Interfaces
│   │
│   └── messaging/
│       ├── MessageTypes.js
│       └── MessageBus.js
│
├── providers/
│   ├── intercept/                # Browser intercept mode
│   │   ├── index.js
│   │   ├── ChatGPTProvider.js   # Current working impl
│   │   ├── DeltaParser.js        # SSE parsing
│   │   └── Bridge.js             # inject-web ↔ content
│   │
│   └── api/                      # API direct mode (future)
│       ├── index.js
│       ├── OpenAIProvider.js
│       ├── AnthropicProvider.js
│       └── DeepSeekProvider.js
│
└── ui/
    └── ProviderSelector.js
```

## Current Priority - Fix Side Panel Connection

The immediate issue is the side panel not receiving messages. The architecture above supports both modes, but we need to debug why the current intercept flow isn't working.

**Debug path:**
1. Side panel loads ✅
2. Content script receives from inject-web? 
3. Background receives from content?
4. Side panel receives from background?

Where is the break?