# VIVIM POC — Architecture Refactor

> Multi-Provider, Multi-Destination Design

## Current Problems

```
inject-web.js  →  content.js  →  background.js  →  sidepanel.js
   │                │               │                 │
   ├─ ChatGPT-      ├─ Pass-through ├─ ChatGPT-       ├─ Only UI
   │  specific         relay          specific           consumer
   │  delta parsing                    storage
   │
   └─ Hard to add Claude, Gemini, Copilot
   └─ Hard to add WebSocket, Webhook, Dashboard destinations
```

### Pain Points

- **Provider logic** (SSE parser, DOM selectors, URL matching) is **embedded inline** in one monolithic file
- **Message format** is **ChatGPT-specific** (`message.content.parts`, `message.author.role`)
- **Single destination** — sidepanel is the only consumer, hardcoded
- **No abstraction boundary** — adding a new provider means copy-pasting and modifying the interceptor
- `content.js` is a **dumb relay** — doesn't add value, just forwards

---

## Proposed Architecture

```
┌──────────────────── PRESENTATION LAYER ─────────────────────┐
│                                                             │
│  ┌──────────────┐  ┌───────────────┐  ┌─────────────────┐  │
│  │  SidePanel   │  │  External     │  │  Future UIs     │  │
│  │  (Chrome UI) │  │  Tool         │  │  (Dashboard,    │  │
│  │              │  │  (WebSocket / │  │   Mobile,       │  │
│  │              │  │   Webhook)    │  │   CLI)          │  │
│  └──────┬───────┘  └──────┬────────┘  └────────┬────────┘  │
│         └──────────────────┼───────────────────┘            │
│                    ┌──────▼──────────┐                      │
│                    │ Destination Hub │  ← pub/sub bus       │
│                    │  (register/     │                      │
│                    │   unsubscribe)  │                      │
│                    └──────┬──────────┘                      │
├──────────────────────────┼──────────────────────────────────┤
│                    CORE LAYER                               │
│                     ┌───▼─────────────┐                     │
│                     │ Stream Pipeline │                     │
│                     │                 │                     │
│                     │  normalize →    │                     │
│                     │  deduplicate →  │                     │
│                     │  fan-out        │                     │
│                     └───┬─────────────┘                     │
│                         │                                   │
│         ┌───────────────▼────────────────┐                  │
│         │       Provider Registry        │                  │
│         │                                │                  │
│         │  ┌────────┐ ┌──────┐ ┌──────┐ │                  │
│         │  │ChatGPT │ │Claude│ │Copilot│ │                  │
│         │  │Adapter │ │Adapter│ │Adapter│ │  (pluggable)   │
│         │  └───┬────┘ └──┬───┘ └──┬───┘ │                  │
│         │      └─────────┴────────┘      │                  │
│         └────────────────────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│                  INTERCEPTOR LAYER (shared)                 │
│                                                             │
│  ┌──────────────────┐  ┌────────────────┐  ┌────────────┐  │
│  │ Fetch Interceptor│  │ XHR Interceptor│  │ DOM Observer│ │
│  │ (global hook)    │  │ (global hook)  │  │ (mutations) │ │
│  └────────┬─────────┘  └───────┬────────┘  └─────┬──────┘  │
│           └────────────────────┼──────────────────┘         │
│                         routes to matching provider         │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Abstractions

### 1. Provider Adapter Interface

Each AI provider implements this contract:

```typescript
interface ProviderAdapter {
  readonly id: string;              // "chatgpt" | "claude" | "gemini" | "copilot"
  readonly name: string;            // "ChatGPT" | "Claude" | ...
  readonly urlPatterns: RegExp[];   // which URLs to intercept

  // Response matching — does this URL belong to this provider?
  matchResponse(url: string): boolean;

  // Parse provider-specific SSE/stream into normalized messages
  parseStream(
    response: Response,
    onMessage: (msg: NormalizedMessage) => void,
    onComplete: () => void
  ): Promise<void>;

  // Inject a prompt into the provider's web UI
  injectPrompt(prompt: string): Promise<boolean>;

  // Extract auth/metadata from requests (optional)
  onRequest?(url: string, headers: Headers): void;
}
```

### 2. Unified Message Format

All providers get normalized into this:

```typescript
interface NormalizedMessage {
  id: string;                    // UUID
  conversationId: string;        // provider-specific conversation ID
  provider: string;              // "chatgpt" | "claude" | ...
  role: "user" | "assistant" | "system";
  content: ContentBlock[];       // not just text — supports mixed content
  model: string;
  timestamp: number;
  isStreaming: boolean;
  metadata: Record<string, unknown>;
}

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "code"; language: string; code: string }
  | { type: "image"; url: string }
  | { type: "citation"; references: CitationRef[] }
  | { type: "tool_use"; name: string; input: unknown };
```

### 3. Destination Interface

Any consumer of the message stream implements this:

```typescript
interface StreamDestination {
  readonly id: string;           // "sidepanel" | "websocket" | "webhook"
  readonly capabilities: {
    receivesStreaming: boolean;  // gets incremental chunks
    receivesComplete: boolean;   // gets final message
    canSendPrompts: boolean;     // can inject prompts back
  };

  onChunk(message: NormalizedMessage): void | Promise<void>;
  onComplete(conversationId: string): void | Promise<void>;
  onError(conversationId: string, error: Error): void;
  sendPrompt?(conversationId: string, prompt: string): Promise<void>;
  dispose(): void;               // cleanup on unregister
}
```

### 4. Stream Pipeline

The core normalization + fan-out engine:

```typescript
class StreamPipeline {
  #providers = new Map<string, ProviderAdapter>();
  #destinations = new Map<string, StreamDestination>();
  #activeStreams = new Map<string, AbortController>();

  registerProvider(adapter: ProviderAdapter) {
    this.#providers.set(adapter.id, adapter);
  }

  registerDestination(dest: StreamDestination) {
    this.#destinations.set(dest.id, dest);
  }

  // Called by interceptors when a matching response is detected
  async handleResponse(providerId: string, response: Response) {
    const provider = this.#providers.get(providerId);
    if (!provider) return;

    const abort = new AbortController();
    this.#activeStreams.set(response.url, abort);

    await provider.parseStream(
      response,
      (msg) => this.#fanOut(msg),     // normalize + distribute
      () => this.#onStreamComplete(response.url)
    );
  }

  #fanOut(message: NormalizedMessage) {
    for (const dest of this.#destinations.values()) {
      if (dest.capabilities.receivesStreaming) {
        dest.onChunk(message).catch(err => this.#handleError(dest, err));
      }
    }
    // Also persist
    this.#persist(message);
  }
}
```

---

## File Structure

```
src/
├── core/
│   ├── event-bus.ts              # Central pub/sub (tiny EventEmitter)
│   ├── stream-pipeline.ts        # Normalize + fan-out engine
│   ├── message-types.ts          # Unified message interfaces
│   ├── storage.ts                # Per-conversation, per-provider storage
│   └── types.ts                  # Shared TypeScript types
│
├── providers/
│   ├── registry.ts               # Provider registration + routing
│   ├── chatgpt/
│   │   ├── adapter.ts            # ProviderAdapter implementation
│   │   ├── delta-parser.ts       # SSE delta encoding v1 → NormalizedMessage
│   │   └── dom-selectors.ts      # #prompt-textarea, [data-testid="send-button"]
│   ├── claude/
│   │   ├── adapter.ts
│   │   ├── sse-parser.ts         # Claude's SSE format (if different)
│   │   └── dom-selectors.ts      # Claude-specific selectors
│   ├── gemini/
│   │   └── ...
│   └── copilot/
│       └── ...
│
├── interceptors/
│   ├── fetch-interceptor.ts      # Global fetch() hook → routes to provider
│   ├── xhr-interceptor.ts        # Global XHR hook (for older providers)
│   └── dom-observer.ts           # MutationObserver for Save buttons, etc.
│
├── destinations/
│   ├── registry.ts               # Destination management
│   ├── sidepanel.ts              # Current sidepanel UI
│   ├── websocket.ts              # Stream to external WebSocket endpoint
│   ├── webhook.ts                # POST chunks to a webhook URL
│   └── devtools.ts               # Optional: Chrome DevTools panel
│
├── background/
│   └── service-worker.ts         # Bootstrap + lifecycle
│
├── sidepanel/
│   ├── sidepanel.html
│   ├── sidepanel.ts              # React or vanilla UI
│   └── sidepanel.css
│
├── content/
│   └── bridge.ts                 # MAIN ↔ ISOLATED world message bridge
│
├── manifest.json
└── tsconfig.json
```

---

## Data Flow (with new architecture)

```
User types "hi" on ChatGPT
        │
        ▼
┌───────────────────────────────────┐
│  interceptors/fetch-interceptor   │
│  - Hooks window.fetch globally    │
│  - Matches URL against all        │
│    provider.urlPatterns           │
│  - Routes to chatgpt adapter      │
└──────────┬────────────────────────┘
           │
           ▼
┌───────────────────────────────────┐
│  providers/chatgpt/adapter.ts     │
│  - parseStream(response, ...)     │
│  - Reads SSE delta encoding v1    │
│  - Emits NormalizedMessage per    │
│    text append                    │
└──────────┬────────────────────────┘
           │
           ▼
┌───────────────────────────────────┐
│  core/stream-pipeline.ts          │
│  - Validates NormalizedMessage    │
│  - Deduplicates                   │
│  - Fans out to ALL destinations   │
└──────────┬────────────────────────┘
           │
     ┌─────┴──────┬──────────────┐
     ▼            ▼              ▼
┌─────────┐ ┌──────────┐ ┌──────────┐
│SidePanel│ │ WebSocket│ │ Webhook  │
│  (UI)   │ │ (Tool X) │ │ (Tool Y) │
└─────────┘ └──────────┘ └──────────┘
```

---

## Adding a New Provider (3 files)

To add Claude, you only touch:

1. **`providers/claude/adapter.ts`** — implement `ProviderAdapter`
2. **`providers/claude/sse-parser.ts`** — parse Claude's stream format
3. **`providers/claude/dom-selectors.ts`** — Claude's textarea/button selectors

Register it in `providers/registry.ts`:

```typescript
registry.register(new ClaudeAdapter());
```

That's it. No changes to interceptors, pipeline, or destinations.

---

## Adding a New Destination (1 file)

To stream to a WebSocket:

1. **`destinations/websocket.ts`** — implement `StreamDestination`

Register it:

```typescript
destinations.register(new WebSocketDestination({ url: "wss://..." }));
```

Every provider's messages automatically flow to it.

---

## Migration Path from Current POC

```
Phase 1: Extract abstractions
  └─ Define NormalizedMessage, ProviderAdapter, StreamDestination interfaces
  └─ Build StreamPipeline with current ChatGPT as the only provider

Phase 2: Split inject-web.js
  └─ Move fetch interceptor → interceptors/fetch-interceptor.ts
  └─ Move ChatGPT delta parser → providers/chatgpt/delta-parser.ts
  └─ Move bridge code → content/bridge.ts

Phase 3: Destination Hub
  └─ Extract sidepanel UI → destinations/sidepanel.ts
  └─ Add destinations/registry.ts for multi-destination support

Phase 4: TypeScript + Build
  └─ Add tsconfig, esbuild/vite build step
  └─ Ship compiled JS to the extension
```

This gives you a **plugin architecture** where providers and destinations are first-class citizens that can be added, removed, and composed independently.
