# VIVIM Extension - Centralized Streaming Architecture

## Overview

VIVIM is a Chrome extension that provides a unified interface for AI conversations across multiple providers (ChatGPT, Claude, Gemini, etc.). The extension intercepts streaming responses and mirrors them to a side panel, with support for additional destinations like webhooks and WebSocket connections.

## Core Architecture Principles

### 1. **Centralized Streaming Management**
All streaming response processing is handled by a single `StreamingManager` that abstracts format-specific parsing logic.

### 2. **Provider Agnostic Design**
AI providers implement a simple interface and delegate complex streaming logic to the centralized manager.

### 3. **Modular Architecture**
Clean separation of concerns with dedicated modules for messaging, storage, UI, and streaming.

### 4. **Robust Error Handling**
Built-in retry mechanisms, timeout handling, and capacity management.

## Architecture Components

```
┌─────────────────────────────────────────────────────────────┐
│                    CHROME EXTENSION                         │
├─────────────────────────────────────────────────────────────┤
│ INTERCEPTION LAYER                                          │
│ ├── inject-web.js     - HTTP/Fetch interception (MAIN)      │
│ └── content.js        - Message bridge (ISOLATED)           │
├─────────────────────────────────────────────────────────────┤
│ CENTRALIZED STREAMING                                       │
│ ├── StreamingManager   - Orchestrates all streaming        │
│ ├── StreamParsers      - Format-specific parsers           │
│ │   ├── DeltaEncodingV1 - ChatGPT format                    │
│ │   ├── SSEParser      - Server-Sent Events                │
│ │   └── JSONStreamParser - JSON streaming                   │
├─────────────────────────────────────────────────────────────┤
│ PROVIDER LAYER                                              │
│ ├── BaseAIProvider     - Template for AI providers         │
│ ├── ChatGPTProvider    - ChatGPT implementation            │
│ └── [Future Providers] - Claude, Gemini, etc.              │
├─────────────────────────────────────────────────────────────┤
│ BACKGROUND SERVICES                                         │
│ ├── ConversationManager - Message storage & retrieval      │
│ ├── DestinationManager  - Multi-destination broadcasting   │
│ └── TabManager         - Tab state management              │
├─────────────────────────────────────────────────────────────┤
│ UI LAYER                                                    │
│ ├── SidePanelController - Main UI coordinator              │
│ └── Message rendering   - Real-time message display        │
└─────────────────────────────────────────────────────────────┘
```

## StreamingManager API

The `StreamingManager` is the central orchestrator for all streaming operations:

```javascript
const streamingManager = new StreamingManager(messageBridge, {
  maxConcurrentStreams: 5,
  streamTimeout: 300000,      // 5 minutes
  retryAttempts: 3,
  retryDelay: 1000,           // 1 second
  enableMetrics: true
});

// Process a streaming response
await streamingManager.processStream({
  streamId: 'chatgpt_123',
  response: fetchResponse,
  format: 'delta-encoding-v1',
  metadata: { provider: 'chatgpt', model: 'gpt-4' }
});
```

### Key Features

- **Format Abstraction**: Supports multiple streaming formats through pluggable parsers
- **Capacity Management**: Limits concurrent streams to prevent resource exhaustion
- **Error Recovery**: Automatic retry for transient failures
- **Timeout Handling**: Cleans up stale streams automatically
- **Metrics Collection**: Tracks performance and success rates

## Stream Parsers

### DeltaEncodingV1Parser (ChatGPT)
Handles OpenAI's delta encoding format with operations like:
- `add`: Add new content
- `replace`: Replace existing content
- `patch`: Apply partial updates

### SSEParser (Server-Sent Events)
Processes standard SSE streams with event types and data payloads.

### JSONStreamParser
Handles JSON streaming formats used by various AI providers.

## Provider Implementation

Providers follow a simple pattern:

```javascript
export class ExampleProvider extends BaseAIProvider {
  constructor() {
    super({
      id: 'example',
      name: 'Example AI',
      hosts: ['api.example.com'],
      urlPatterns: ['/v1/chat/completions'],
      streamingFormat: 'sse',
      authHeader: 'X-API-Key',
      supportsStreaming: true
    });
  }

  // Minimal implementation - streaming handled centrally
  matchRequest(ctx) { return ctx.url.includes('/v1/chat/completions'); }
  matchResponse(ctx) { return this.matchRequest(ctx); }
}
```

## Message Flow

### Request Interception
```
User types prompt on chatgpt.com
          │
          ▼
inject-web.js intercepts fetch()
          │
          ▼
ChatGPTProvider.onRequest()
  - Captures auth headers
  - Extracts user prompt
  - Sends to bridge
          │
          ▼
content.js → background.js
          │
          ▼
ConversationManager stores prompt
```

### Response Streaming
```
ChatGPT API streams SSE
          │
          ▼
inject-web.js intercepts response
          │
          ▼
ChatGPTProvider.onResponse()
  - Delegates to StreamingManager
          │
          ▼
StreamingManager.processStream()
  - Parses delta encoding
  - Emits standardized chunks
          │
          ▼
Bridge → Background → SidePanel
```

## Error Handling & Recovery

### Automatic Retry
- Network errors trigger automatic retry with exponential backoff
- Configurable retry attempts and delays
- Circuit breaker pattern prevents cascade failures

### Timeout Management
- Streams automatically cleaned up after timeout
- Configurable timeout periods per provider
- Timeout detection runs every 60 seconds

### Capacity Protection
- Limits concurrent streams to prevent resource exhaustion
- Queues requests when at capacity
- Graceful degradation under load

## Configuration

The extension supports extensive configuration:

```javascript
// Streaming configuration
const streamingConfig = {
  maxConcurrentStreams: 5,
  streamTimeout: 300000,
  retryAttempts: 3,
  retryDelay: 1000
};

// Provider-specific settings
const providerConfig = {
  chatgpt: {
    streamingFormat: 'delta-encoding-v1',
    authHeader: 'Authorization',
    extraHeaderPrefixes: ['chatgpt-']
  }
};
```

## Adding New AI Providers

1. **Choose or implement a stream parser** for the provider's format
2. **Create a provider class** extending `BaseAIProvider`
3. **Configure URL patterns and auth headers**
4. **Register the provider** in the provider registry

The centralized architecture handles the complexity of streaming, allowing providers to focus on provider-specific logic like authentication and URL matching.

## Performance Considerations

- **Lazy Parser Loading**: Parsers loaded only when needed
- **Stream Deduplication**: Prevents duplicate processing
- **Memory Management**: Automatic cleanup of completed streams
- **Chunk Batching**: Optimizes message passing between contexts

## Security

- **Content Script Isolation**: MAIN world interception, ISOLATED world messaging
- **Bridge Validation**: Only authorized message sources accepted
- **Auth Token Management**: In-memory storage, no persistence
- **Request Filtering**: Strict URL pattern matching

## Future Extensions

The architecture supports easy addition of:
- New AI providers (Claude, Gemini, etc.)
- Additional destinations (database, file export)
- Custom stream parsers for proprietary formats
- Advanced analytics and monitoring
- Provider-specific optimizations