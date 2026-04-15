# POC: ChatGPT Mirror Extension — PRD

**Version**: 0.0.1 (POC — ChatGPT only)
**Date**: 2026-04-13
**Goal**: Build a quick-and-dirty Chrome extension that mirrors a ChatGPT conversation inside the VIVIM side panel — user can **send prompts** and **see AI responses** — without ever leaving the extension UI.

---

## 1. What This Is

A thin extension that **wraps ChatExporter's existing capture engine** and adds a **send-prompt layer** on top, rendering the full conversation in a VIVIM-styled side panel.

- **Receive (capture)**: Reuse ChatExporter's `fetch()` prototype interception + `response.body.tee()` — already battle-tested for ChatGPT
- **Send (prompt)**: Use `fetch()` prototype interception to capture the outgoing request body (user prompt) — same injection point, just read the request instead of the response
- **Render**: Side panel shows the mirrored conversation using VIVIM visual design tokens

### Why ChatGPT Only for POC

ChatGPT has the cleanest, most documented SSE stream format (`/backend-api/conversation`). Proving the pattern on one platform de-risks everything else.

---

## 2. Core Flow

```
┌─────────────────────────────────────────────────┐
│  User opens VIVIM side panel on chatgpt.com      │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌─ Chat Mirror ───────────────────────────┐    │
│  │                                          │    │
│  │  🟣 Help me debug React useEffect       │    │
│  │  ChatGPT • gpt-4                        │    │
│  │                                          │    │
│  │  ┌──────────────────────────────────┐   │    │
│  │  │ 👤 User                          │   │    │
│  │  │ How do I use useEffect?          │   │    │
│  │  └──────────────────────────────────┘   │    │
│  │  ┌──────────────────────────────────┐   │    │
│  │  │ 🤖 Assistant (gpt-4)             │   │    │
│  │  │ useEffect runs after render...   │   │    │
│  │  └──────────────────────────────────┘   │    │
│  │                                          │    │
│  │  ┌──────────────────────────────────┐   │    │
│  │  │ [Type a message...        ] [▶]  │   │    │  ← Send prompt
│  │  └──────────────────────────────────┘   │    │
│  │                                          │    │
│  │  ⚡ Streaming... 6 messages captured      │    │
│  └──────────────────────────────────────────┘    │
│                                                  │
└─────────────────────────────────────────────────┘
```

### Sequence

```
1. User opens chatgpt.com → content script injects at document_start
2. fetch() is hooked at prototype level
3. User types prompt in side panel → clicks Send (▶)
4. Extension calls ChatGPT's /backend-api/conversation API directly
   (reuses ChatExporter's auth token capture)
5. Response stream is tee'd:
   - One copy goes to ChatGPT's own UI (unchanged)
   - One copy is SSE-parsed into the side panel in real-time
6. User sees AI response stream live in VIVIM side panel
7. Conversation history persists in chrome.storage.local
```

---

## 3. What We Reuse from ChatExporter

| Asset | From | Reuse |
|-------|------|-------|
| `inject-web.js` | ChatExporter | ✅ Full reuse — already hooks fetch/XHR for auth capture |
| Auth store (`ChatGPTAuthStore`) | ChatExporter `inject-web.js` | ✅ Reuse — captures `Authorization` + extra headers |
| `fetch()` prototype interception | ChatExporter pattern | ✅ Reuse — same hook point |
| `response.body.tee()` pattern | ChatExporter pattern | ✅ Reuse — zero-copy stream split |
| SSE parser (ChatGPT format) | ChatExporter `content.js` | ✅ Reuse — already parses `/backend-api/conversation` SSE |
| Message normalization | ChatExporter `ChatApi-DFVDlt23.js` | ✅ Reuse — `convertToMessages()` pattern |
| `manifest.json` structure | ChatExporter | ⚠️ Adjust — remove unused platforms, add sidepanel |
| i18n locale files | ChatExporter | ❌ Skip for POC — English only |
| Export UI (PDF/MD/TXT) | ChatExporter | ❌ Skip — not needed |

---

## 4. What We Build New

| Component | Description |
|-----------|-------------|
| **Send prompt UI** | Textarea + send button in side panel |
| **Direct API call** | POST to `/backend-api/conversation` with ChatGPT auth |
| **Request body capture** | Hook outgoing `fetch()` to read user prompt |
| **Conversation store** | `chrome.storage.local` for message history |
| **Side panel** | VIVIM-styled React component (or vanilla HTML for POC) |
| **Streaming render** | Render SSE chunks in real-time as they arrive |

---

## 5. Technical Approach

### 5.1 Architecture (Minimal)

```
POC Extension (no build tool — plain files like ChatExporter/SendPrompt)
├── manifest.json          ← Minimal V3 manifest
├── background.js          ← Message router + API proxy
├── content.js             ← fetch() hook (runs at document_start)
├── inject-web.js          ← Auth capture (copied from ChatExporter)
├── sidepanel.html         ← Side panel UI
└── sidepanel.js           ← Side panel logic + render
```

### 5.2 fetch() Hook — Both Directions

```javascript
// In content.js (page context, world: "MAIN")
const originalFetch = window.fetch;

window.fetch = async function(input, init) {
  const url = typeof input === "string" ? input : (input.url || "");

  if (url.includes("/backend-api/conversation")) {
    // === SEND: Capture outgoing request body ===
    if (init?.body) {
      const requestBody = typeof init.body === "string"
        ? JSON.parse(init.body)
        : init.body;
      // Extract user prompt from request
      const userMessage = requestBody.messages?.[0]?.content?.parts?.[0];
      if (userMessage) {
        chrome.runtime.sendMessage({
          type: "USER_PROMPT",
          content: userMessage,
          conversationId: requestBody.conversation_id || null,
        });
      }
    }

    // === RECEIVE: Tee the response stream ===
    const response = await originalFetch.apply(this, [input, init]);
    if (response.body) {
      const [chatgptStream, vivimStream] = response.body.tee();
      processStream(vivimStream); // SSE parse → side panel
      return new Response(chatgptStream, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }
    return response;
  }

  return originalFetch.apply(this, [input, init]);
};
```

### 5.3 SSE Parser (ChatGPT)

```javascript
async function processStream(stream) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6);
      if (data === "[DONE]") {
        chrome.runtime.sendMessage({ type: "STREAM_COMPLETE" });
        return;
      }
      try {
        const parsed = JSON.parse(data);
        const content = parsed.message?.content?.parts?.[0];
        if (content) {
          chrome.runtime.sendMessage({
            type: "STREAM_CHUNK",
            content: content,
            role: parsed.message?.author?.role,
            model: parsed.message?.metadata?.model_slug,
          });
        }
      } catch { /* skip malformed */ }
    }
  }
}
```

### 5.4 Send Prompt (from side panel)

The side panel doesn't need to call the API directly. Instead:

1. User types in side panel textarea
2. Extension calls `fetch("/backend-api/conversation")` **in the page context** (via `chrome.scripting.executeScript`)
3. The content script's fetch hook intercepts it → auth is already captured
4. Response streams back through the tee → side panel renders it

```javascript
// sidepanel.js — send prompt
async function sendPrompt(text) {
  await chrome.scripting.executeScript({
    target: { tabId: currentTabId },
    func: (prompt) => {
      // Get auth token from ChatGPT's own session
      fetch("/backend-api/conversation", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "next",
          messages: [{
            id: crypto.randomUUID(),
            author: { role: "user" },
            content: { content_type: "text", parts: [prompt] },
            metadata: {},
          }],
          model: "text-davinci-002-render-sha",
          timezone_offset_min: new Date().getTimezoneOffset(),
        }),
      });
    },
    args: [text],
  });
}
```

---

## 6. File Plan

### Files to Create (New)

| File | Purpose | Lines ~ |
|------|---------|---------|
| `poc/manifest.json` | Extension manifest | 30 |
| `poc/background.js` | Message router, tab tracking | 80 |
| `poc/content.js` | fetch() hook + SSE parser | 120 |
| `poc/sidepanel.html` | Side panel UI shell | 40 |
| `poc/sidepanel.js` | Chat render + send prompt | 200 |
| `poc/icons/` | Extension icons (reuse ChatExporter's) | — |

### Files to Copy from ChatExporter

| From | To | Notes |
|------|----|-------|
| `chatexporter/inject-web.js` | `poc/inject-web.js` | Full copy — auth capture engine |
| `chatexporter/icon-16.png` | `poc/icons/icon-16.png` | Extension icon |
| `chatexporter/icon-32.png` | `poc/icons/icon-32.png` | Extension icon |
| `chatexporter/icon-48.png` | `poc/icons/icon-48.png` | Extension icon |
| `chatexporter/icon-128.png` | `poc/icons/icon-128.png` | Extension icon |

### Files to Adjust (from ChatExporter)

| File | Change |
|------|--------|
| `manifest.json` | Strip all platforms except ChatGPT; add `side_panel`; set `world: "MAIN"` for inject-web.js content script; add `scripting` permission |

---

## 7. manifest.json

```json
{
  "manifest_version": 3,
  "name": "VIVIM POC — ChatGPT Mirror",
  "description": "Mirror ChatGPT conversations in VIVIM side panel",
  "version": "0.0.1",
  "icons": {
    "16": "icons/icon-16.png",
    "32": "icons/icon-32.png",
    "48": "icons/icon-48.png",
    "128": "icons/icon-128.png"
  },
  "permissions": [
    "storage",
    "tabs",
    "sidePanel",
    "scripting"
  ],
  "host_permissions": [
    "https://chatgpt.com/*"
  ],
  "action": {
    "default_title": "VIVIM POC",
    "default_popup": "sidepanel.html"
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://chatgpt.com/*"],
      "run_at": "document_start",
      "js": ["inject-web.js"],
      "world": "MAIN"
    },
    {
      "matches": ["https://chatgpt.com/*"],
      "run_at": "document_idle",
      "js": ["content.js"]
    }
  ],
  "web_accessible_resources": [
    {
      "resources": ["inject-web.js"],
      "matches": ["https://chatgpt.com/*"]
    }
  ]
}
```

---

## 8. Visual Design (POC — Simplified VIVIM Tokens)

Following `04-VISUAL-DESIGN-GUIDE.md` but scoped for POC speed:

```css
:root {
  --vivim-primary: #6C5CE7;
  --bg-primary:    #0D0D14;
  --bg-secondary:  #161625;
  --bg-tertiary:   #1E1E35;
  --bg-hover:      #252540;
  --text-primary:  #E8E8F0;
  --text-secondary:#A0A0B8;
  --border-primary:#2A2A45;
  --font-sans:     'Inter', -apple-system, sans-serif;
  --font-mono:     'JetBrains Mono', monospace;
}

/* Side panel: 400px, dark, VIVIM-styled */
.sidepanel {
  width: 100%;
  height: 100vh;
  background: var(--bg-primary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 13px;
  display: flex;
  flex-direction: column;
}

/* Header */
.sidepanel__header {
  height: 48px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid var(--border-primary);
  font-weight: 600;
  color: var(--vivim-primary);
}

/* Message area */
.sidepanel__messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Message bubbles */
.msg {
  max-width: 90%;
  padding: 8px 12px;
  border-radius: 8px;
  line-height: 1.5;
  font-size: 13px;
}
.msg--user {
  align-self: flex-end;
  background: var(--vivim-primary);
  color: #fff;
}
.msg--assistant {
  align-self: flex-start;
  background: var(--bg-secondary);
  border-left: 3px solid var(--vivim-primary);
}

/* Input area */
.sidepanel__input {
  padding: 12px;
  border-top: 1px solid var(--border-primary);
  display: flex;
  gap: 8px;
}
.sidepanel__input textarea {
  flex: 1;
  background: var(--bg-secondary);
  color: var(--text-primary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-family: var(--font-sans);
  resize: none;
  height: 40px;
}
.sidepanel__input button {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  background: var(--vivim-primary);
  color: #fff;
  border: none;
  cursor: pointer;
  font-size: 16px;
}
.sidepanel__input button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Status bar */
.sidepanel__status {
  padding: 4px 12px;
  font-size: 11px;
  color: var(--text-secondary);
  border-top: 1px solid var(--border-primary);
}
```

---

## 9. POC Success Criteria

| Criteria | Target |
|----------|--------|
| User sends prompt from side panel | ✅ |
| ChatGPT processes it normally (own UI updates too) | ✅ |
| AI response streams live in side panel | ✅ |
| Full conversation history visible in side panel | ✅ |
| Auth captured from ChatGPT session automatically | ✅ |
| No visible lag in ChatGPT UI | ✅ |
| Install + test in < 2 minutes | ✅ |

---

## 10. What We Explicitly Skip for POC

| Skipped | Why |
|---------|-----|
| Multi-platform support | Prove on ChatGPT first |
| Markdown rendering | Plain text for POC; add later |
| Code block syntax highlighting | Post-POC |
| Image/attachment support | Post-POC |
| VIVIM backend API integration | Local storage only for POC |
| Memory extraction / ACU | Post-POC |
| Offline queue | Post-POC |
| i18n | English only |
| Light theme | Dark only |
| Build framework (Plasmo/Vite) | Plain files — zero build step |
| Tests | Manual testing only for POC |

---

## 11. Installation (Local Testing)

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `chrome/poc/` directory
5. Pin the extension to toolbar
6. Navigate to `chatgpt.com` (must be logged in)
7. Click extension icon → side panel opens
8. Type a prompt → click ▶ → watch it mirror

---

## 12. Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| ChatGPT changes SSE format | High | POC is disposable; pattern proven → adapt later |
| `fetch()` hook breaks ChatGPT UI | Critical | try/catch around hook; fall back to original fetch |
| CORS blocks sidepanel→tab API call | Medium | Use `chrome.scripting.executeScript` to call fetch in page context |
| Auth token expires mid-session | Low | Re-fetch on each API call (credentials: "include") |
| Stream tee adds latency | Low | Zero-copy tee; measure & verify < 5ms overhead |

---

## 13. Post-POC Path (If Successful)

1. Add Claude, Gemini, Copilot platforms (reuse same pattern)
2. Add VIVIM backend API integration (`POST /api/v1/conversations`)
3. Add markdown rendering (marked.js + highlight.js)
4. Add memory extraction trigger
5. Migrate to Plasmo build framework
6. Add offline queue, dedup, content hashing
7. Submit to Chrome Web Store
