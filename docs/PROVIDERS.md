# AI Provider System

## Overview

VIVIM supports multiple AI providers through a pluggable provider architecture with consistent interfaces.

## Supported Providers

| Provider | Models | Path |
|----------|--------|------|
| OpenAI (ChatGPT) | GPT-4, GPT-3.5, DALL-E, TTS | `src/providers/chatgpt/` |
| Anthropic (Claude) | Claude 3.5, Claude 3 | `src/providers/claude/` |
| Google (Gemini) | Gemini Pro, Flash | `src/providers/gemini/` |
| DeepSeek | DeepSeek Chat | - |
| xAI (Grok) | Grok-1 | - |
| Groq | Llama, Mixtral | - |

## Provider Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ProviderRegistry                         │
│              (Provider Discovery & Management)              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │ ChatGPT    │    │  Claude    │    │  Gemini    │      │
│  │ Provider  │    │  Provider  │    │  Provider  │      │
│  └─────────────┘    └─────────────┘    └─────────────┘      │
│         │                │                │                   │
│         └────────────────┼────────────────┘                   │
│                          ▼                                  │
│              ┌─────────────────────┐                     │
│              │   BaseAIProvider     │                     │
│              │  (Common Interface)  │                     │
│              └─────────────────────┘                     │
│                          │                                  │
│              ┌─────────────────────┐                     │
│              │    ProviderMixin     │                     │
│              │  (Shared Behavior)  │                     │
│              └─────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## Base Classes

### BaseAIProvider
**Path**: `src/core/providers/BaseAIProvider.js`

Abstract base class defining the provider interface.

```javascript
class BaseAIProvider {
  async chat(messages, options) {
    // Send chat request
  }

  async chatStream(messages, options) {
    // Streaming chat request
  }

  async generateImage(prompt, options) {
    // Image generation
  }

  async textToSpeech(text, options) {
    // Text-to-speech
  }
}
```

### ProviderMixin
**Path**: `src/core/providers/ProviderMixin.js`

Shared functionality across providers.

```javascript
const ProviderMixin = {
  async retry(fn, options) {
    // Retry logic with backoff
  },

  async rateLimit(fn) {
    // Rate limiting
  },

  formatMessages(messages) {
    // Format for provider API
  }
};
```

### ProviderRegistry
**Path**: `src/core/providers/ProviderRegistry.js`

Discovers and manages providers.

```javascript
const registry = new ProviderRegistry();

registry.register('chatgpt', ChatGPTProvider);
registry.register('claude', ClaudeProvider);
registry.register('gemini', GeminiProvider);

const provider = registry.get('chatgpt');
```

## Provider Implementation

### ChatGPT Provider
**Path**: `src/providers/chatgpt/ChatGPTProvider.js`

```javascript
class ChatGPTProvider extends BaseAIProvider {
  constructor(config) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async chat(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4',
        messages: this.formatMessages(messages),
        temperature: options.temperature,
        max_tokens: options.maxTokens
      })
    });

    return response.json();
  }

  async *chatStream(messages, options = {}) {
    // Streaming implementation
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      // ... streaming request
    });

    for await (const chunk of response) {
      yield chunk;
    }
  }
}
```

### Claude Provider
**Path**: `src/providers/claude/ClaudeProvider.js`

```javascript
class ClaudeProvider extends BaseAIProvider {
  constructor(config) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = 'https://api.anthropic.com/v1';
  }

  async chat(messages, options = {}) {
    const response = await fetch(`${this.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: options.model || 'claude-3-5-sonnet-20241022',
        messages: this.formatMessages(messages),
        temperature: options.temperature,
        max_tokens: options.maxTokens || 4096
      })
    });

    return response.json();
  }
}
```

### Gemini Provider
**Path**: `src/providers/gemini/GeminiProvider.js`

```javascript
class GeminiProvider extends BaseAIProvider {
  constructor(config) {
    super();
    this.apiKey = config.apiKey;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
  }

  async chat(messages, options = {}) {
    const response = await fetch(
      `${this.baseUrl}/models/${options.model || 'gemini-pro'}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: this.formatMessages(messages),
          generationConfig: {
            temperature: options.temperature,
            maxOutputTokens: options.maxTokens
          }
        })
      }
    );

    return response.json();
  }
}
```

## Streaming

### StreamingManager
**Path**: `src/core/streaming/StreamingManager.js`

Handles real-time streaming with error recovery.

```javascript
const manager = new StreamingManager();

manager.on('chunk', (chunk) => {
  // Process chunk
});

manager.on('complete', (response) => {
  // Handle complete
});

manager.on('error', (error) => {
  // Handle error
});

// Stream from provider
for await (const chunk of provider.chatStream(messages)) {
  manager.emit('chunk', chunk);
}
```

### Features
- Chunk deduplication
- Error recovery with retry
- Buffer management
- Progress tracking

## Authentication

### AuthStore
**Path**: `src/core/providers/AuthStore.js`

Secure API key storage.

```javascript
const auth = new AuthStore(chrome.storage.local);

await auth.setKey('chatgpt', 'sk-...');
await auth.setKey('claude', 'sk-ant-...');

const chatgptKey = await auth.getKey('chatgpt');
const claudeKey = await auth.getKey('claude');
```

## Error Handling

### ErrorHandler
**Path**: `src/core/providers/ErrorHandler.js`

Centralized error handling.

```javascript
const handler = new ErrorHandler();

try {
  await provider.chat(messages);
} catch (error) {
  const categorized = handler.categorize(error);
  
  switch (categorized.type) {
    case 'rate_limit':
      // Wait and retry
      break;
    case 'auth':
      // Re-authenticate
      break;
    case 'validation':
      // Fix input
      break;
    default:
      // Log and report
  }
}
```

## Provider Selection

The system auto-detects the active AI chat page:

```javascript
const providerMap = {
  'chatgpt.com': 'chatgpt',
  'chat.com': 'chatgpt',
  'claude.ai': 'claude',
  'gemini.google.com': 'gemini'
};

const currentUrl = window.location.hostname;
const provider = providerMap[currentUrl];
```

## Adding New Providers

1. Create `src/providers/{provider}/Provider.js`
2. Extend `BaseAIProvider`
3. Implement required methods
4. Register in `ProviderRegistry`
5. Add to `AuthStore`

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture
- [COMMUNICATION.md](COMMUNICATION.md) — Message passing
- [STORAGE.md](STORAGE.md) — Storage layout