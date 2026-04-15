# VIVIM POC — Extension Developer Guide

> How to extend VIVIM with new providers and destinations

## Quick Reference

| Task | Files to modify | Effort |
|-----|----------------|--------|
| Add new fetch-based provider | `inject-web.js` | ~50 lines |
| Add new XHR-based provider | `inject-web.js` | ~40 lines |
| Add new destination | `inject-web.js`, `background.js` | ~60 lines |
| Add new message handler | `background.js` | ~15 lines |

## Adding a New Provider (Fetch)

### Step 1: Create Plugin Class

Add to `inject-web.js`:

```javascript
class MyProviderPlugin extends Plugin {
  get name() { return "MyProvider"; }
  
  // Protocol: 'fetch' | 'xhr' | 'both'
  get protocol() { return 'fetch'; }
  
  // URLs this provider uses
  matchRequest(ctx) {
    return ctx.url?.includes("myprovider.com/api");
  }
  
  // Capture auth, etc.
  onRequest(ctx) {
    const auth = ctx.headers["Authorization"];
    if (auth) MyProviderAuthStore.setAuthData(auth);
  }
  
  // Response streaming
  matchResponse(ctx) {
    return ctx.url?.includes("myprovider.com/chat");
  }
  
  // Parse streaming response
  async onResponse(ctx) {
    const clone = ctx.clone;
    const reader = clone.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          // Parse JSON and send chunk
          const msg = JSON.parse(data);
          if (window.__VIVIM_BRIDGE) {
            window.__VIVIM_BRIDGE.send("chatChunk", {
              role: msg.role,
              content: msg.content,
              model: msg.model,
              url: ctx.url,
              seq: msg.seq
            });
          }
        }
      }
    }
    
    // Signal completion
    if (window.__VIVIM_BRIDGE) {
      window.__VIVIM_BRIDGE.send("streamComplete", {
        timestamp: Date.now()
      });
    }
  }
}
```

### Step 2: Register Plugin

In the bootstrap section of `inject-web.js`:

```javascript
const fetchInterceptor = new FetchInterceptor();
fetchInterceptor.register(new ChatGPTPlugin());
fetchInterceptor.register(new MyProviderPlugin());  // <-- Add here
fetchInterceptor.start();
```

### Step 3: Add Auth Store (if needed)

```javascript
class MyProviderAuthStore {
  static authorization = null;
  static updatedAt = null;
  
  static setAuthData(t) { 
    if (t) { 
      this.authorization = t; 
      this.updatedAt = Date.now(); 
    } 
  }
  
  static getLatest() { 
    return { authorization: this.authorization, updatedAt: this.updatedAt }; 
  }
}
window.MyProviderAuthStore = MyProviderAuthStore;
```

### Step 4: Add Handler (optional)

In `inject-web.js` bridge setup:

```javascript
o.handle("getMyProviderAuthHeader", () => MyProviderAuthStore.getLatest());
```

## Adding a New Provider (XHR)

### Step 1: Create Plugin Class

```javascript
class MyXHRProviderPlugin extends Plugin {
  get name() { return "MyXHRProvider"; }
  get protocol() { return 'xhr'; }
  
  targetUrl = "/_/MyProvider/data/batchexecute";
  
  matchRequest(ctx) {
    try {
      const rpcid = new URL(ctx.url, window.location.origin).searchParams.get("rpcid");
      return ctx.url?.includes(this.targetUrl) && rpcid === "myRpcid";
    } catch { return false; }
  }
  
  onRequest(ctx) {
    // Capture request data
    try {
      const reqId = new URL(ctx.url, window.location.origin).searchParams.get("_reqid");
      reqId && MyAuthStore.setReqId(reqId);
    } catch {}
  }
}
```

### Step 2: Register Plugin

```javascript
xhrInterceptor.register(new MyXHRProviderPlugin());

// Start on relevant sites
if (isMyProviderSite) {
  xhrInterceptor.start();
}
```

## Adding a New Destination

### Step 1: Create Destination Class

In `inject-web.js`:

```javascript
class MyDestination extends StreamDestination {
  #url = null;
  
  constructor(config = {}) {
    super();
    this.#url = config.url;
  }
  
  get id() { return "my-destination"; }
  
  get capabilities() { 
    return { 
      receivesStreaming: true, 
      receivesComplete: true, 
      canSendPrompts: true 
    }; 
  }
  
  onChunk(msg) {
    if (this.#url) {
      fetch(this.#url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "chunk", data: msg })
      }).catch(() => {});
    }
  }
  
  onComplete(conversationId) {
    if (this.#url) {
      fetch(this.#url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "complete", conversationId })
      }).catch(() => {});
    }
  }
  
  async sendPrompt(conversationId, prompt) {
    if (!this.#url) return Promise.reject(new Error("No URL configured"));
    
    const response = await fetch(this.#url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "prompt", conversationId, prompt })
    });
    
    if (!response.ok) {
      throw new Error(`Failed to send prompt: ${response.status}`);
    }
    
    return Promise.resolve();
  }
  
  dispose() {
    this.#url = null;
  }
}
```

### Step 2: Register Destination

In `background.js`:

```javascript
registerDestination("my-destination", { 
  url: "https://my-endpoint.com/webhook"
});
```

Or dynamically via message:

```javascript
// From any content script or sidepanel:
chrome.runtime.sendMessage({
  type: "REGISTER_DESTINATION",
  id: "my-destination",
  config: { url: "https://..." }
});
```

### Step 3: Handle Custom Messages (if needed)

In `background.js`:

```javascript
case "MY_CUSTOM_ACTION":
  // Handle custom action
  broadcastToDestination("my-destination", "message", {
    type: "MY_RESPONSE",
    data: message.payload
  });
  break;
```

## Adding New Message Types

### Step 1: Define Message

```javascript
// In content script or sidepanel:
chrome.runtime.sendMessage({
  type: "MY_NEW_MESSAGE",
  payload: { key: "value" },
  tabId: tab.id
});
```

### Step 2: Handle in Background

```javascript
// In background.js:
case "MY_NEW_MESSAGE":
  // Process message
  const result = processMyMessage(message.payload);
  
  // Respond (if needed)
  sendResponse({ result });
  return true; // Keep channel open for async response
```

### Step 3: Handle Response

```javascript
// In content script:
chrome.runtime.sendMessage({ type: "MY_NEW_MESSAGE", ... })
  .then(response => {
    console.log("Result:", response.result);
  });
```

## Modifying Manifest

For new providers, update `manifest.json`:

```json
{
  "host_permissions": [
    "https://chatgpt.com/*",
    "https://myprovider.com/*"    // <-- Add new provider
  ],
  "content_scripts": [
    {
      "matches": [
        "https://chatgpt.com/*",
        "https://myprovider.com/*"  // <-- Add new provider
      ],
      "js": ["inject-web.js"],
      "world": "MAIN"
    }
  ]
}
```

## Testing Your Changes

### Local Development

1. Build: `npm run build`
2. Load extension:
   - Open `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `dist/` folder

### Debugging

```javascript
// In your plugin
onRequest(ctx) {
  console.log("[MyProvider] Request:", ctx.url, ctx.headers);
}

onResponse(ctx) {
  console.log("[MyProvider] Response:", ctx.url, ctx.response.status);
}
```

### Using Chrome DevTools

- **Background:** `chrome://extensions` → "Service Worker" link
- **Content:** Inspect extension context in page console
- **Sidepanel:** Right-click sidepanel → Inspect

## Common Patterns

### Capturing Auth from Headers

```javascript
onRequest(ctx) {
  const auth = ctx.headers["Authorization"] || 
               ctx.headers["authorization"];
  if (auth) AuthStore.setAuthData(auth);
}
```

### Capturing Auth from Body

```javascript
onRequest(ctx) {
  if (typeof ctx.body === "string" && ctx.body.includes("token=")) {
    const params = new URLSearchParams(ctx.body);
    const token = params.get("token");
    if (token) AuthStore.setAuthData(token);
  }
}
```

### Parsing SSE Stream

```javascript
async onResponse(ctx) {
  const reader = ctx.clone.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;
        
        try {
          const json = JSON.parse(data);
          // Process JSON
        } catch {}
      }
    }
  }
}
```

### Storing Conversation ID

```javascript
onRequest(ctx) {
  if (ctx.url?.includes("/chat") && ctx.init?.body) {
    try {
      const body = JSON.parse(ctx.init.body);
      if (body.conversation_id) {
        ConversationStore.setId(body.conversation_id);
      }
    } catch {}
  }
}
```

## Troubleshooting

### Plugin Not Matching

```javascript
// Check matchRequest is being called
matchRequest(ctx) {
  console.log("Checking:", ctx.url);
  return ctx.url?.includes("myprovider.com");
}
```

### Auth Not Being Captured

```javascript
// Check headers are being passed correctly
onRequest(ctx) {
  console.log("Headers:", ctx.headers);
  const auth = ctx.headers["Authorization"];
  // ...
}
```

### Stream Not Parsing

```javascript
// Add debug output
async onResponse(ctx) {
  console.log("Response status:", ctx.response.status);
  console.log("Response clone:", ctx.clone);
  // ...
}
```

### Destination Not Receiving

```javascript
// Check registration
registerDestination("my-dest", { url: "..." });

// Check capabilities
const dest = destinations.get("my-dest");
console.log("Capabilities:", dest.capabilities);
```

## Performance Tips

1. **Lazy initialization:** Only start interceptors on relevant sites
2. **Chunk deduplication:** Use sequence numbers for ordering
3. **Buffer limits:** Limit stored messages (max 100)
4. **Debounce broadcasts:** Don't send on every chunk