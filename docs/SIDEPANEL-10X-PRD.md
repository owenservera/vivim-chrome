# VIVIM Sidepanel 10x - Product Requirements Document

## 1. Problem Statement

### Current Pain Points
| Pain Point | Impact | Frequency |
|-----------|--------|----------|
| Only ChatGPT detection | Can't use for other AI providers | High |
| Plain text rendering | No code highlighting, markdown | Medium |
| No export options | Can't save conversations | High |
| Single destination | Can't route to webhooks/WS | Medium |
| No message search | Can't find past conversations | Medium |
| No provider context | Don't know which model responded | High |

### Root Cause
POC extension was built for single-provider (ChatGPT) proof-of-concept, not designed for multi-provider operation.

---

## 2. Goals & Success Criteria

### Goals (SMART)
| Goal | Metric | Target |
|------|-------|-------|
| Support 13 AI providers | Providers detected | 13/13 |
| Markdown rendering | Rendered elements | Bold, code, lists, headings, tables |
| Export capability | Formats available | JSON, Markdown, TXT |
| Message actions | Actions per message | Copy, retry, delete |
| Destination routing | Destinations supported | Sidepanel, webhook, websocket |
| Theme support | Themes | Dark + Light |

### Success Metrics
```
Primary:
├── 100% provider detection (13/13)
├── Export works for all message types
├── No regressions in stream handling
└── Build passes without errors

Secondary:
├── Theme toggle functional
├── Search returns results <100ms
└── Export completes <500ms
```

---

## 3. User Stories

### Story 1: Multi-Provider Detection
```
As a user,
I want the sidepanel to auto-detect which AI provider I'm using,
So I know which service is generating responses.

Acceptance Criteria:
- [ ] When visiting chatgpt.com, shows "ChatGPT" in header
- [ ] When visiting claude.ai, shows "Claude" in header
- [ ] All 13 providers show correct name
- [ ] Fallback shows "Unknown" for unrecognized URLs
```

### Story 2: Rich Content Rendering
```
As a user,
I want markdown and code to render properly,
So I can read formatted AI responses.

Acceptance Criteria:
- [ ] **bold** renders as bold
- [ ] *italic* renders as italic
- [ ] ```code blocks``` get syntax highlighting
- [ ] - bullet lists render correctly
- [ ] Links are clickable
```

### Story 3: Copy & Export
```
As a user,
I want to copy individual messages or export the full conversation,
So I can save AI outputs for documentation.

Acceptance Criteria:
- [ ] Click copy icon copies single message
- [ ] Export dropdown shows JSON, Markdown, TXT
- [ ] JSON includes metadata (provider, model, timestamp)
- [ ] Markdown is human-readable
```

### Story 4: Message Actions
```
As a user,
I want to retry or delete individual messages,
So I can fix mistakes or clean up.

Acceptance Criteria:
- [ ] Hover on message reveals actions
- [ ] Delete removes one message
- [ ] Retry re-sends the prompt
- [ ] Undo available for 5 seconds
```

### Story 5: Destination Routing
```
As a user,
I can choose where chat messages go,
So I can integrate with external systems.

Acceptance Criteria:
- [ ] Destination selector in header
- [ ] Sidepanel: render locally
- [ ] Webhook: POST to configured URL
- [ ] WebSocket: real-time to configured server
```

### Story 6: Search
```
As a user,
I want to search past messages,
So I can find specific conversations.

Acceptance Criteria:
- [ ] Search bar in toolbar
- [ ] Real-time filtering as user types
- [ ] Highlights matching text
- [ ] Clear search resets view
```

---

## 4. Feature Requirements

### 4.1 Provider Detection

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Auto-detect from URL | P0 | Tab URL inspection |
| Provider indicator | P0 | Colored dot + name |
| Model display | P1 | Per-message badge |
| Manual override | P1 | Dropdown selection |

### 4.2 Message Rendering

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Plain text | P0 | Already works |
| Bold/italic | P0 | CommonMark |
| Code blocks | P0 | With highlight.js |
| Lists | P0 | Ordered/unordered |
| Headings | P1 | h1-h3 |
| Tables | P2 | CommonMark tables |
| Math | P2 | KaTeX |
| Links | P1 | Clickable |

### 4.3 Message Actions

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Copy single | P0 | Clipboard API |
| Copy all | P0 | Export dropdown |
| Delete single | P0 | Remove message |
| Retry | P1 | Re-send prompt |

### 4.4 Destination Routing

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Sidepanel | P0 | Default |
| Webhook | P1 | Configurable URL |
| WebSocket | P1 | Auto-reconnect |

### 4.5 Export

| Requirement | Priority | Notes |
|-------------|----------|-------|
| JSON | P0 | Full metadata |
| Markdown | P0 | Human readable |
| Plain text | P1 | Content only |

### 4.6 UX Polish

| Requirement | Priority | Notes |
|-------------|----------|-------|
| Dark theme | P0 | Default |
| Light theme | P1 | CSS variables |
| Theme toggle | P1 | Toolbar button |
| Keyboard shortcuts | P2 | Cmd+Enter |

---

## 5. Technical Specification

### 5.1 Provider Registry
```javascript
const PROVIDERS = {
  chatgpt: { name: "ChatGPT", color: "#10A37F", hosts: ["chatgpt.com", "chat.com"] },
  claude: { name: "Claude", color: "#D4A373", hosts: ["claude.ai"] },
  copilot: { name: "Copilot", color: "#0078D4", hosts: ["copilot.microsoft.com"] },
  gemini: { name: "Gemini", color: "#8E8E8E", hosts: ["gemini.google.com"] },
  deepseek: { name: "DeepSeek", color: "#5365F9", hosts: ["deepseek.com"] },
  perplexity: { name: "Perplexity", color: "#6366F1", hosts: ["perplexity.ai"] },
  grok: { name: "Grok", color: "#F59E0B", hosts: ["grok.com"] },
  poe: { name: "Poe", color: "#EF4444", hosts: ["poe.com"] },
  kimi: { name: "Kimi", color: "#8B5CF6", hosts: ["kimi.moonshot.cn"] },
  tongyi: { name: "Tongyi", color: "#F97316", hosts: ["tongyi.aliyun.com", "dashscope"] },
  yuanbao: { name: "Yuanbao", color: "#14B8A6", hosts: ["yuanbao.tencent.com", "hunyuan"] },
  notebooklm: { name: "NotebookLM", color: "#EA5900", hosts: ["notebooklm.google.com"] },
  googleairesolve: { name: "Google AI", color: "#4285F4", hosts: ["ai.google.dev"] },
};
```

### 5.2 Message Schema
```typescript
interface ChatMessage {
  id: string;                    // UUID
  role: "user" | "assistant";
  content: string;
  provider: string;              // From PROVIDERS keys
  model?: string;               // "gpt-4", "claude-3-opus", etc.
  timestamp: number;            // Unix ms
  conversationId?: string;       // Provider conversation ID
}
```

### 5.3 CSS Variables (Theme)
```css
/* Dark (default) */
:root {
  --bg-primary: #0D0D14;
  --bg-secondary: #161625;
  --text-primary: #E8E8F0;
  --accent-primary: #6C5CE7;
  --provider-chatgpt: #10A37F;
}

/* Light */
[data-theme="light"] {
  --bg-primary: #FFFFFF;
  --bg-secondary: #F8F9FA;
  --text-primary: #1A1A2E;
  --accent-primary: #5B41DC;
}
```

---

## 6. Non-Functional Requirements

### Performance
| Requirement | Target |
|-------------|-------|
| Initial render | <100ms |
| Message append | <16ms (60fps) |
| Theme switch | <50ms |
| Export 100 messages | <500ms |

### Browser Support
- Chrome 90+ (MV3 required)
- Edge 90+

### Accessibility
| Requirement | Implementation |
|-------------|--------------|
| Keyboard nav | Tab order logical |
| Focus visible | Focus ring on all interactive |
| Screen reader | ARIA labels on icons |

### Security
| Requirement | Implementation |
|-------------|--------------|
| No credential storage | Local only |
| HTTPS required | Webhook/WS URLs |
| Content Security Policy | No eval() |

---

## 7. Dependencies

### New Dependencies
| Library | Version | Purpose | Bundle Impact |
|---------|---------|---------|-----------|
| marked | ^12.0.0 | Markdown parsing | ~6KB gzipped |
| highlight.js | ^11.9.0 | Code highlighting | ~25KB |
| katex | ^0.16.0 | Math rendering | ~15KB |

### Alternative (Single Library)
| Library | Version | Purpose | Bundle Impact |
|---------|---------|---------|-----------|
| showdown | ^1.3.0 | Markdown + highlight | ~20KB |
| - | Less flexible | | |

### Recommendation
Use **marked + highlight.js** for flexibility. Load from CDN if space critical.

---

## 8. Phasing

### Phase 1 (MVP) - Complete sidepanel 10x baseline
- [F1] Provider auto-detection (13)
- [F2] Provider selector dropdown
- [F3] Markdown rendering
- [F4] Copy single message
- [F5] Copy all (dropdown)
- [F6] Delete message

**Deliverable**: Drop-in replacement for current sidepanel

### Phase 2 (Enhanced) - Destinations + export
- [F7] Destination selector
- [F8] Webhook configuration
- [F9] WebSocket configuration
- [F10] JSON export
- [F11] Markdown export
- [F12] Plain text export

**Deliverable**: Full destination routing

### Phase 3 (Polish) - UX improvements
- [F13] Theme toggle (dark/light)
- [F14] Keyboard shortcuts
- [F15] Message search
- [F16] Multi-conversation history
- [F17] Undo delete

**Deliverable**: Production polish

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Libs fail to load | Medium | Medium | Graceful fallback to plain text |
| Performance degradation | Medium | High | Debounce stream updates |
| Cross-tab state | Medium | High | Tab-specific storage |
| Markdown XSS | Low | High | Sanitize HTML output |
| Theme not persisted | Low | Low | Chrome storage API |

---

## 10. Out of Scope

| Feature | Reason |
|---------|--------|
| Mobile sidepanel | Chrome extension only |
| Firefox/Safari | Chromium-first |
| Real-time collab | Not in POC scope |
| Custom plugins | Future extension |
| AI-powered search | External API dependency |

---

## 11. Success Validation

### Launch Criteria
```
[ ] All 13 providers detect correctly
[ ] Markdown renders for test content
[ ] Copy exports valid JSON
[ ] Delete removes message
[ ] Theme toggle works
[ ] No console errors on load
[ ] Streams remain <16ms latency
[ ] Build passes
```

---

## Appendix A: Test Cases

### Markdown Test Content
```markdown
# Heading 1
## Heading 2

**Bold text** and *italic*

- Bullet list item 1
- Bullet list item 2

1. Numbered item
2. Numbered item

`inline code`

```javascript
const x = 1;
console.log(x);
```

[Link text](https://example.com)

| Column 1 | Column 2 |
|----------|----------|
| Cell 1   | Cell 2   |
```

### Expected Result
- H1 renders as large bold
- Bold is bold, italic is italic
- Unordered list shows bullets
- Ordered list shows numbers
- Inline code has monospace background
- Code block has highlighting colors
- Link is blue and clickable
- Table renders with border

---

*Document Version: 1.0*
*Created: 2026-04-14*
*Owner: VIVIM POC Team*