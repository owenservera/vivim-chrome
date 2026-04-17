# ApiStreamService Documentation

Streams conversation data from VIVIM to external HTTP endpoints. Similar to VIVIM Mirror but integrated as a VIVIM service.

## Overview

The `ApiStreamService` listens to internal VIVIM messages and forwards conversation data to a configured external API endpoint. It provides deduplication, retry logic, and streaming-aware sync.

## Configuration

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `endpoint` | string | `''` | Full URL of your ingest endpoint |
| `authHeader` | string | `'Authorization'` | Header name for authentication |
| `authValue` | string | `''` | Token value (e.g., `Bearer sk-...`) |
| `customHeaders` | string | `''` | JSON string of additional headers |
| `enabled` | boolean | `false` | Whether streaming is active |
| `syncMode` | string | `'full'` | `'full'` sends all messages, `'last'` sends only newest |
| `retryOnFail` | boolean | `true` | Auto-retry on failure |
| `maxRetries` | number | `3` | Maximum retry attempts |
| `streamSettleMs` | number | `1800` | Debounce time after streaming completes |

## Storage

Configuration is stored in `chrome.storage.sync`. Last sync metadata is in `chrome.storage.local` under `apiStreamLastSync` and `apiStreamTotalSyncs`.

## Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `API_STREAM_CONFIG` | UI → Background | Save configuration |
| `API_STREAM_GET_CONFIG` | UI → Background | Get current config |
| `API_STREAM_GET_STATUS` | UI → Background | Get service status |
| `API_STREAM_SET_ENABLED` | UI → Background | Enable/disable streaming |
| `API_STREAM_FORCE_SYNC` | UI → Background | Force sync with messages |
| `API_STREAM_SYNC` | Internal | Sync from message bus |

## Internal Events

The service subscribes to these message types:

- `STREAM_COMPLETE` — triggers sync after AI finishes responding
- `CONVERSATION_LOADED` — triggers sync on conversation load
- `SAVE_FROM_DOM` — triggers sync when saving web page content
- `LOAD_CONVERSATION_FROM_DOM` — triggers sync when loading from web page

## Payload Schema

When `syncMode: 'full'`:

```json
{
  "conversation_id": "abc123",
  "url": "https://chatgpt.com/c/abc123",
  "timestamp": "2026-04-17T12:00:00.000Z",
  "message_count": 4,
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "last_message": {
    "role": "assistant",
    "content": "..."
  }
}
```

When `syncMode: 'last'`:

```json
{
  "conversation_id": "abc123",
  "url": "https://chatgpt.com/c/abc123",
  "timestamp": "2026-04-17T12:00:00.000Z",
  "message_count": 4,
  "last_message": { "role": "assistant", "content": "..." }
}
```

## Usage Examples

### From Popup or Content Script

```javascript
// Configure endpoint
chrome.runtime.sendMessage({
  type: 'API_STREAM_CONFIG',
  config: {
    endpoint: 'https://api.vivim.live/v1/ingest',
    authValue: 'Bearer sk-your-token',
    syncMode: 'full',
    enabled: true
  }
});

// Get status
chrome.runtime.sendMessage({ type: 'API_STREAM_GET_STATUS' }, response => {
  console.log('Sync count:', response.syncCount);
  console.log('Last sync:', response.lastSyncTime);
  console.log('Last error:', response.lastError);
});

// Enable/disable
chrome.runtime.sendMessage({
  type: 'API_STREAM_SET_ENABLED',
  enabled: true
});

// Force sync
chrome.runtime.sendMessage({
  type: 'API_STREAM_FORCE_SYNC',
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' }
  ]
});
```

### Integration with VIVIM Mirror

The VIVIM Mirror content script (`vvv/content.js`) can be adapted to send to this service instead of its own background:

```javascript
// Instead of chrome.runtime.sendMessage({ type: 'VIVIM_SYNC', payload }), use:
chrome.runtime.sendMessage({
  type: 'API_STREAM_FORCE_SYNC',
  messages: payload.messages
});
```

## Badge States

| Badge | Color | Meaning |
|-------|------|---------|
| Number | Green (#00ff88) | Successful syncs count |
| `!` | Red (#ff4444) | Sync failed after retries |

## Differences from VIVIM Mirror

| Aspect | VIVIM Mirror | ApiStreamService |
|--------|--------------|-----------------|
| Location | Separate extension | Integrated service |
| DOM observation | MutationObserver | Message bus events |
| Target sites | chatgpt.com only | All VIVIM providers |
| Init trigger | Manual config | Auto on conversation events |