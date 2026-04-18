# Storage Architecture

## Overview

VIVIM uses a multi-backend storage system supporting local-first data persistence with privacy focus.

## Storage Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                   StorageManager                          │
│              (Unified Interface)                      │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┬──────────────┬──────────────┐      │
│  │ ChromeStorage│  IndexedDB  │ FileSystem   │      │
│  │  Backend   │  Backend   │  Backend   │      │
│  └──────────────┴──────────────┴──────────────┘      │
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │         ConversationStorage                  │     │
│  │    (High-level conversation management)       │     │
│  └──────────────────────────────────────────────┘     │
│                                                         │
│  ┌──────────────────────────────────────────────┐     │
│  │          DataFeedStorage / DataFeedManager    │     │
│  │         (Data feed persistence)               │     │
│  └──────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
```

## Storage Backends

### ChromeStorageBackend
**Path**: `src/core/storage/backends/ChromeStorageBackend.js`

Uses `chrome.storage.local` for extension-specific data.

```javascript
const storage = new ChromeStorageBackend(chrome.storage.local);

await storage.set('key', { data: 'value' });
const data = await storage.get('key');
await storage.remove('key');
```

**Use case**: Small data, API keys, settings, extension state

### IndexedDBStorageBackend
**Path**: `src/core/storage/backends/IndexedDBStorageBackend.js`

Uses IndexedDB for large structured data.

```javascript
const db = new IndexedDBStorageBackend('vivim-db', 'conversations');

await db.put({ id: 1, messages: [...] });
const data = await db.get(1);
const all = await db.getAll();
```

**Use case**: Large conversations, message history, searchable data

### FileSystemStorageBackend
**Path**: `src/core/storage/backends/FileSystemStorageBackend.js`

Uses File System Access API for file exports.

```javascript
const fs = new FileSystemStorageBackend();

const fileHandle = await fs.saveFile('conversations.json', data);
const data = await fs.loadFile(fileHandle);
```

**Use case**: Export/import, backup, large file handling

## High-Level Storage

### ConversationStorage
**Path**: `src/core/storage/ConversationStorage.js`

Manages conversation and message persistence.

```javascript
const storage = new ConversationStorage();

await storage.saveConversation(conversation);
await storage.saveMessage(messageId, message);
const conversations = await storage.getConversations();
const messages = await storage.getMessages(conversationId);
```

### DataFeedStorage / DataFeedManager
**Path**: `src/core/storage/DataFeedStorage.js`, `src/core/storage/DataFeedManager.js`

Handles data feed persistence.

```javascript
const manager = new DataFeedManager();

await manager.initialize();
await manager.addFeed(feedData);
const feeds = await manager.getFeeds();
```

## StorageManager
**Path**: `src/core/storage/StorageManager.js`

Unified interface with backend selection.

```javascript
const manager = new StorageManager(chrome.storage.local);

await manager.set(key, value);
const value = await manager.get(key);
await manager.delete(key);
const all = await manager.getAll();
```

## Privacy Features

All data stays local by design:

- **No external servers** — All API calls go directly to AI providers
- **Local encryption** — Sensitive data encrypted via SecureStorage
- **Export/import** — Full data portability
- **No analytics** — No usage tracking

## Data Types

| Type | Storage Backend | Size Limit |
|------|----------------|-----------|
| Settings | ChromeStorage | ~5MB |
| API Keys | ChromeStorage (encrypted) | ~5MB |
| Conversations | IndexedDB | Unlimited |
| Message History | IndexedDB | Unlimited |
| Exported Files | FileSystem | System limit |

## Security

### SecureStorage
**Path**: `src/core/security/SecureStorage.js`

Encrypted storage for sensitive data.

```javascript
const secure = new SecureStorage(chrome.storage.local);

await secure.setSecure('apiKey', 'sk-...');
const apiKey = await secure.getSecure('apiKey');
```

### SecurityManager
**Path**: `src/core/security/SecurityManager.js`

Centralized security operations.

## Schema

### Conversations Schema (IndexedDB)

```javascript
{
  id: string,
  title: string,
  provider: string,
  model: string,
  createdAt: timestamp,
  updatedAt: timestamp,
  messages: [{
    id: string,
    role: 'user' | 'assistant',
    content: string,
    timestamp: number
  }],
  metadata: {
    tokenCount: number,
    cost: number
  }
}
```

## Best Practices

1. **Small data** → ChromeStorage (settings, keys)
2. **Large data** → IndexedDB (conversations)
3. **Exports** → FileSystem (JSON, backup)
4. **Sensitive** → SecureStorage (encrypted)

## See Also

- [ARCHITECTURE.md](ARCHITECTURE.md) — System architecture
- [COMMUNICATION.md](COMMUNICATION.md) — Message passing