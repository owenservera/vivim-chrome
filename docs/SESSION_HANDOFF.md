# VIVIM Extension - Architecture Rebuild

## Status: NEW BRIDGE SYSTEM IMPLEMENTED

## New Architecture (April 15, 2026)

### Files Created

| File | Purpose |
|------|---------|
| `src/core/bridge/BridgeConfig.js` | Centralized config (IDs, timeouts, patterns) |
| `src/core/bridge/BridgeProtocol.js` | Message types & serialization |
| `src/core/bridge/WebBridge.js` | Centralized bridge with handshake |
| `src/core/bridge/index.js` | Module exports |

### Key Changes

1. **Single WebBridge** - No more per-provider bridges
2. **Configuration-driven** - All IDs, patterns from config
3. **Handshake Protocol** - Waits for content before sending
4. **BaseProvider updates** - setBridge(), sendToBridge() methods

### How to Add New Providers

```javascript
// 1. Add pattern to BridgeConfig.js providers.patterns
// 2. Create provider class extending BaseProvider
// 3. Use this.bridge.send() to send messages
```

---

## Previous Issues (Fixed)

### Issue 1: CommunicationId Mismatch
- Old: Bridge used `"inject-chat-web"`, checked for `"saveai-extension-content"`
- New: All IDs from config, consistent

### Issue 2: Missing Handshake  
- Old: Sent immediately without confirming content was listening
- New: `ensureReady()` waits for handshake response

### Issue 3: No Ready Check
- Old: Sent messages without checking bridge state
- New: `autoHandshake: true` by default

---

## Old Current Status (History)

## What's Working
- Side panel loads and shows "Connected" (false positive from health ping)
- inject-web.js initializes and registers ChatGPT provider
- content.js initializes
- Background service worker responds to PING
- Network interception is working (see all the `/backend-api/` calls in console)

## What's NOT Working
**Message flow from ChatGPT → Side Panel is broken**

### Message Flow Path:
```
ChatGPT page → inject-web.js (intercept) 
    → Bridge (window.postMessage) 
    → content.js (chrome.runtime.sendMessage) 
    → background.js 
    → sidepanel.js
```

### Where It's Breaking:

**1. Bridge sending to content:**
- inject-web logs show: `onRequest called` for many endpoints
- But NO logs show for: `handleUserPrompt called` or `Sending userPrompt to bridge`
- The interceptor is NOT detecting the conversation POST request properly

**2. OR Bridge receiving from content:**
- Even if bridge sends, content might not be receiving
- Check: `[Content] Window message event:` logs

## Console Logs to Look For

### In chatgpt.com page console:
- `[Bridge] Created with communicationId:` - Bridge initialized
- `[Bridge] Message listener registered` - Listener added
- `[ChatGPT] handleUserPrompt called` - Interceptor sees request
- `[ChatGPT] Is conversation endpoint: true` - Detected as chat
- `[ChatGPT] Sending userPrompt to bridge` - Sending message
- `[Bridge] send() userPrompt:` - Bridge sending

### In content script (isolated world):
- `[Content] setupWebBridge() called` - Function executed
- `[Content] Message listener added` - Listener registered
- `[Content] Window message event:` - Messages received?

## Root Cause Hypothesis

The ChatGPT provider's `handleUserPrompt` is not being triggered because:
1. The request body parsing is failing silently
2. OR the conversation endpoint regex is not matching the current ChatGPT API

```
Regex: /\/backend-api(\/f)?\/conversation(\?|$)/
Current: https://chatgpt.com/backend-api/conversation
```

This SHOULD match, but something in the body parsing is failing.

## Files to Compare Against

See archived working version:
- `docs/archive/2026-04-15/old-system/inject-web.js` - Working bridge with handshake
- `docs/archive/2026-04-15/old-system/background.js` - Working background

Key difference: Old system had `ensureReady()` handshake mechanism that waited for content script to be ready before sending.

## Immediate Actions Needed

1. **Verify the regex matches** - Add logging to confirm endpoint detection
2. **Verify body parsing** - Add logging inside try/catch to see what's failing
3. **Add handshake** - Implement the ensureReady() pattern from old system
4. **Trace window.postMessage** - Add event listener in content BEFORE bridge sends

## Code Locations

| File | Purpose |
|------|---------|
| `src/providers/index.js` | Bridge implementation |
| `src/providers/chatgpt/ChatGPTProvider.js` | Interceptor with handleUserPrompt |
| `src/content/index.js` | Receives from bridge, sends to background |
| `src/background/index.js` | Routes messages, responds to PING |
| `src/ui/SidePanelController.js` | Side panel UI |
| `build.mjs` | Build script |

## Build Command
```bash
cd extensions/chrome/poc && node build.mjs && cp sidepanel.html dist/sidepanel.html
```

## Test Sequence
1. Reload extension
2. Open chatgpt.com
3. Open side panel
4. Type message in ChatGPT
5. Check ALL console logs (page + sidepanel + background)
6. Look for the chain of logs above