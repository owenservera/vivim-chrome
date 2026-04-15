# VIVIM Extension - Modular Architecture Design

## Current Issues

### Monolithic Components
- **inject-web.js** (1200+ lines): Bridge, plugins, auth stores, interceptors all mixed
- **background.js** (600+ lines): Tab management, storage, messaging, destinations
- **sidepanel.js** (600+ lines): UI logic, providers, features all combined
- **Global scope pollution**: No proper module boundaries

### Tight Coupling
- Hard-coded provider logic scattered across files
- Direct DOM manipulation mixed with business logic
- Storage operations embedded in service logic

## Proposed Modular Architecture

### Directory Structure

```
src/
├── core/                          # Core infrastructure
│   ├── messaging/                # Unified message bus
│   │   ├── MessageBus.js
│   │   ├── MessageValidator.js
│   │   └── MessageTypes.js
│   ├── storage/                  # Abstracted storage layer
│   │   ├── StorageManager.js
│   │   ├── ConversationStorage.js
│   │   └── HistoryStorage.js
│   ├── bridge/                   # Web-bridge communication
│   │   ├── Bridge.js
│   │   ├── HandshakeManager.js
│   │   └── MessageRouter.js
│   └── providers/                # Provider registry system
│       ├── ProviderRegistry.js
│       ├── BaseProvider.js
│       └── ProviderCapabilities.js
├── providers/                    # AI provider implementations
│   ├── chatgpt/
│   │   ├── ChatGPTProvider.js
│   │   ├── ChatGPTInterceptor.js
│   │   └── ChatGPTAuthStore.js
│   ├── claude/
│   │   ├── ClaudeProvider.js
│   │   ├── ClaudeInterceptor.js
│   │   └── ClaudeAuthStore.js
│   ├── deepseek/
│   │   ├── DeepSeekProvider.js
│   │   ├── DeepSeekInterceptor.js
│   │   └── DeepSeekAuthStore.js
│   └── [other providers...]
├── background/                   # Background service modules
│   ├── services/
│   │   ├── TabManager.js
│   │   ├── ConversationManager.js
│   │   ├── DestinationManager.js
│   │   └── StreamingManager.js
│   ├── BackgroundController.js
│   └── index.js
├── content/                      # Content script modules
│   ├── ContentController.js
│   ├── DOMInjector.js
│   ├── SaveButtonInjector.js
│   └── index.js
├── ui/                           # UI component library
│   ├── components/
│   │   ├── MessageList.js
│   │   ├── MessageItem.js
│   │   ├── ProviderSelector.js
│   │   ├── ExportMenu.js
│   │   └── SearchInput.js
│   ├── hooks/
│   │   ├── useConversation.js
│   │   ├── useStreaming.js
│   │   └── useProvider.js
│   ├── SidePanelController.js
│   └── index.js
├── utils/                        # Shared utilities
│   ├── Logger.js
│   ├── ErrorHandler.js
│   ├── DOMUtils.js
│   ├── AsyncUtils.js
│   └── Constants.js
└── index.js                      # Main entry point
```

### Core Modules

#### 1. Messaging System (`src/core/messaging/`)

**Purpose:** Unified communication layer for all extension components.

```javascript
// MessageBus.js
export class MessageBus {
  constructor() {
    this.handlers = new Map();
    this.middlewares = [];
  }

  on(type, handler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type).add(handler);
  }

  off(type, handler) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  emit(message) {
    return this.processMessage(message);
  }

  async processMessage(message) {
    // Apply middlewares
    for (const middleware of this.middlewares) {
      message = await middleware(message);
    }

    // Route to handlers
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      const promises = Array.from(handlers).map(handler =>
        Promise.resolve(handler(message))
      );
      await Promise.all(promises);
    }
  }
}
```

#### 2. Storage Abstraction (`src/core/storage/`)

**Purpose:** Abstract storage operations with caching and batching.

```javascript
// StorageManager.js
export class StorageManager {
  constructor(storage = chrome.storage.local) {
    this.storage = storage;
    this.cache = new Map();
    this.pendingWrites = new Map();
  }

  async get(key) {
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }
    const result = await this.storage.get(key);
    this.cache.set(key, result[key]);
    return result[key];
  }

  async set(key, value) {
    this.cache.set(key, value);
    this.pendingWrites.set(key, value);
    this.scheduleWrite();
  }

  scheduleWrite() {
    if (this.writeTimeout) return;

    this.writeTimeout = setTimeout(() => {
      this.flushWrites();
    }, 500); // Debounced writes
  }

  async flushWrites() {
    const writes = Object.fromEntries(this.pendingWrites);
    await this.storage.set(writes);
    this.pendingWrites.clear();
    this.writeTimeout = null;
  }
}
```

#### 3. Provider System (`src/core/providers/`)

**Purpose:** Plugin architecture for AI providers.

```javascript
// BaseProvider.js
export class BaseProvider {
  constructor(config = {}) {
    this.id = config.id;
    this.name = config.name;
    this.hosts = config.hosts || [];
    this.capabilities = config.capabilities || {};
  }

  matchRequest(ctx) { return false; }
  onRequest(ctx) {}
  matchResponse(ctx) { return false; }
  onResponse(ctx) {}
  getAuthHeaders() { return {}; }
}
```

### Provider Implementations

#### ChatGPT Provider (`src/providers/chatgpt/`)

```javascript
// ChatGPTProvider.js
import { BaseProvider } from '../../core/providers/BaseProvider.js';
import { ChatGPTAuthStore } from './ChatGPTAuthStore.js';
import { ChatGPTInterceptor } from './ChatGPTInterceptor.js';

export class ChatGPTProvider extends BaseProvider {
  constructor() {
    super({
      id: 'chatgpt',
      name: 'ChatGPT',
      hosts: ['chatgpt.com', 'chat.com'],
      capabilities: {
        supportsStreaming: true,
        supportsAuth: true,
        messageFormat: 'openai'
      }
    });

    this.authStore = new ChatGPTAuthStore();
    this.interceptor = new ChatGPTInterceptor(this.authStore);
  }

  matchRequest(ctx) {
    return ctx.url?.includes('/backend-api/');
  }

  onRequest(ctx) {
    const auth = ctx.headers['Authorization'];
    if (auth) {
      this.authStore.setAuthData(auth);
    }
    return this.interceptor.onRequest(ctx);
  }

  matchResponse(ctx) {
    return ctx.url?.match(/\/backend-api(\/f)?\/conversation/);
  }

  onResponse(ctx) {
    return this.interceptor.onResponse(ctx);
  }
}
```

### Background Services

#### Service-Based Architecture (`src/background/`)

```javascript
// BackgroundController.js
import { MessageBus } from '../core/messaging/MessageBus.js';
import { TabManager } from './services/TabManager.js';
import { ConversationManager } from './services/ConversationManager.js';
import { DestinationManager } from './services/DestinationManager.js';

export class BackgroundController {
  constructor() {
    this.messageBus = new MessageBus();
    this.services = new Map();
  }

  async init() {
    // Initialize services
    this.services.set('tabManager', new TabManager(this.messageBus));
    this.services.set('conversationManager', new ConversationManager(this.messageBus));
    this.services.set('destinationManager', new DestinationManager(this.messageBus));

    // Setup message routing
    this.setupMessageHandlers();

    // Initialize all services
    for (const service of this.services.values()) {
      if (service.init) {
        await service.init();
      }
    }
  }

  setupMessageHandlers() {
    this.messageBus.on('USER_PROMPT', this.handleUserPrompt.bind(this));
    this.messageBus.on('STREAM_CHUNK', this.handleStreamChunk.bind(this));
    // ... other handlers
  }
}
```

### UI Component Architecture

#### Component Library (`src/ui/`)

```javascript
// MessageList.js
export class MessageList {
  constructor(container, messageBus) {
    this.container = container;
    this.messageBus = messageBus;
    this.messages = [];
    this.bindEvents();
  }

  bindEvents() {
    this.messageBus.on('MESSAGE_ADDED', this.addMessage.bind(this));
    this.messageBus.on('STREAM_UPDATE', this.updateStreaming.bind(this));
  }

  addMessage(message) {
    const messageEl = new MessageItem(message);
    this.container.appendChild(messageEl.element);
    this.messages.push(message);
  }

  updateStreaming(update) {
    // Handle streaming updates
  }
}
```

### Build System Updates

#### Modular Build Configuration

```javascript
// build.mjs
import * as esbuild from 'esbuild';

const buildConfig = {
  entryPoints: {
    background: 'src/background/index.js',
    content: 'src/content/index.js',
    'inject-web': 'src/providers/index.js', // All providers bundled
    sidepanel: 'src/ui/index.js'
  },
  bundle: true,
  outdir: 'dist',
  format: 'esm',
  splitting: true, // Enable code splitting
  sourcemap: true,
  minify: false,
  define: {
    'process.env.NODE_ENV': '"development"'
  }
};

await esbuild.build(buildConfig);
```

## Migration Strategy

### Phase 1: Core Infrastructure
1. Create `src/` directory structure
2. Implement core modules (messaging, storage, providers)
3. Create base classes and abstractions

### Phase 2: Provider Refactoring
1. Extract each provider into separate module
2. Implement provider plugin system
3. Migrate auth stores to provider-specific modules

### Phase 3: Service Decomposition
1. Split `background.js` into focused services
2. Extract `inject-web.js` logic into provider modules
3. Update content scripts for modularity

### Phase 4: UI Componentization
1. Break down `sidepanel.js` into components
2. Implement component communication patterns
3. Create reusable UI primitives

### Phase 5: Integration & Testing
1. Update build system for new structure
2. Implement comprehensive testing
3. Performance optimization and cleanup

## Benefits of New Architecture

### Maintainability
- **Single Responsibility:** Each module has one clear purpose
- **Dependency Injection:** Services communicate through abstractions
- **Testable Units:** Small, focused modules are easier to test

### Extensibility
- **Plugin Architecture:** Easy to add new AI providers
- **Modular UI:** Components can be reused and extended
- **Service Registration:** New services can be added without touching core code

### Performance
- **Code Splitting:** Load only what you need
- **Lazy Loading:** Providers loaded on demand
- **Efficient Bundling:** Tree-shaking removes unused code

### Developer Experience
- **Clear Structure:** Easy to find and modify code
- **Type Safety:** Better IDE support and error catching
- **Documentation:** Self-documenting code organization