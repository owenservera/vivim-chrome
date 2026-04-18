# VIVIM Extension v2.0 — Architecture

## Overview

VIVIM is a Chrome Extension (Manifest V3) that brings together 30+ AI models from 6 providers in a unified side panel interface.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Extension Entry Points                       │
├─────────────────────────────────────────────────────────────┤
│  Background Service Worker  │  Content Script  │  Provider Script │
│   (src/background/)    │  (src/content/)  │  (src/providers/)│
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  Core Services Layer                          │
├─────────────────────────────────────────────────────────────┤
│  TabManager  │  ConversationManager  │  DestinationManager  │
│  ApiStreamService  │  DataFeedManager                     │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Core Modules                           │
├─────────────────────────────────────────────────────────────┤
│  MessageBus  │  StorageManager  │  StreamingManager  │  WebBridge │
└─────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                Storage Backends                            │
├─────────────────────────────────────────────────────────────┤
│  ChromeStorage  │  IndexedDB  │  FileSystem  │  DataFeed  │
└─────────────────────────────────────────────────────────────────────────┘
```

## Extension Components

### Background Service Worker
**Path**: `src/background/index.js`

Orchestrates all background services. Handles:
- chrome.runtime.onMessage for cross-component communication
- chrome.sidePanel for UI
- Service lifecycle (onStartup, onInstalled)

**Registered Services**:
- `TabManager` — tab tracking
- `ConversationManager` — message/conversation state
- `DestinationManager` — UI panel routing
- `ApiStreamService` — streaming API config

### Content Script
**Path**: `src/content/index.js`

Injected into AI chat pages (chatgpt.com, claude.ai, gemini.google.com). Handles:
- DOM manipulation for prompt injection
- Save button injection into response elements
- WebBridge for cross-context messaging

### Provider Script
**Path**: `src/providers/index.js`

Injected at `document_start` into AI provider pages with MAIN world access.

### Side Panel UI
**Path**: `sidepanel.html`

Main user interface for the extension.

## Directory Structure

```
src/
├── background/
│   ├── index.js              # Service worker entry
│   └── services/
│       ├── TabManager.js
│       ├── ConversationManager.js
│       ├── DestinationManager.js
│       └── ApiStreamService.js
├── content/
│   ├── index.js             # Content script entry
│   └── fetch/
│       ├── ContentScriptFetch.js
│       └── StealthFetchManager.js
├── core/
│   ├── bridge/
│   │   ├── index.js
│   │   ├── WebBridge.js
│   │   ├── BridgeProtocol.js
│   │   └── BridgeConfig.js
│   ├── logging/
│   │   └── Logger.js
│   ├── messaging/
│   │   ├── MessageBus.js
│   │   ├── MessageTypes.js
│   │   └── MessageValidator.js
│   ├── providers/
│   │   ├── BaseAIProvider.js
│   │   ├── BaseProvider.js
│   │   ├── ProviderMixin.js
│   │   ├── ProviderRegistry.js
│   │   ├── ErrorHandler.js
│   │   └── AuthStore.js
│   ├── security/
│   │   ├── SecurityManager.js
│   │   └── SecureStorage.js
│   ├── storage/
│   │   ├── StorageManager.js
│   │   ├── ConversationStorage.js
│   │   ├── DataFeedStorage.js
│   │   ├── DataFeedManager.js
│   │   └── backends/
│   │       ├── ChromeStorageBackend.js
│   │       ├── IndexedDBStorageBackend.js
│   │       └── FileSystemStorageBackend.js
│   ├── streaming/
│   │   ├── index.js
│   │   └── StreamingManager.js
│   └── utilities/
│       ├── CircuitBreaker.js
│       ├── InputSanitization.js
│       ├── Metrics.js
│       ├── ProviderChaining.js
│       └── RequestDeduplication.js
├── providers/
│   ├── index.js
│   ├── chatgpt/
│   │   └── ChatGPTProvider.js
│   ├── claude/
│   │   └── ClaudeProvider.js
│   └── gemini/
│       └── GeminiProvider.js
├── ui/
│   ├── index.js
│   ├── SidePanelController.js
│   └── UILogic.js
└── config/
    └── provider-icons.js
```

## Key Statistics

| Metric | Value |
|--------|-------|
| AI Providers | 4+ (ChatGPT, Claude, Gemini, DeepSeek, xAI, Groq) |
| Source Files | 67 |
| Extension Entry Points | 3 |
| Manifest Version | MV3 |
| Storage Backends | 4 |

## Manifest Configuration

```json
{
  "manifest_version": 3,
  "permissions": ["storage", "tabs", "sidePanel", "scripting"],
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*"
  ],
  "background": {
    "service_worker": "dist/background.js",
    "type": "module"
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  }
}
```

## Permissions

- **storage** — Local data persistence
- **tabs** — Tab tracking
- **sidePanel** — Side panel UI
- **scripting** — Content script injection

## See Also

- [COMMUNICATION.md](COMMUNICATION.md) — Message passing patterns
- [STORAGE.md](STORAGE.md) — Storage architecture
- [PROVIDERS.md](PROVIDERS.md) — AI provider system