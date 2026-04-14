# VIVIM POC Workplan - Provider & Destination Coverage

## Objective
Achieve full multi-provider, multi-destination coverage matching or exceeding chatexporter reference.

---

## Current State (POC)

### Providers Implemented (6/18+)
| Provider | File | Status |
|----------|------|--------|
| ChatGPT | ChatGPTPlugin | ✅ Working |
| Copilot | CopilotPlugin | ✅ Working |
| Gemini | GeminiPlugin | ✅ Working |
| Kimi | KimiPlugin | ✅ Working |
| NotebookLM | NotebookLMPlugin | ✅ Working |
| Google AI Resolve | GoogleAIResolvePlugin | ✅ Working |

### Destinations Implemented (3)
| Destination | File | Status |
|-------------|------|--------|
| Sidepanel | StreamDestination | ✅ Working |
| Webhook | WebhookDestination | 🔧 Stub |
| WebSocket | WebSocketDestination | 🔧 Stub |

---

## Target State (chatexporter reference)

### Providers to Support (18+)
| # | Provider | Host | Priority |
|---|---------|------|---------|
| 1 | ChatGPT | chatgpt.com | ✅ Done |
| 2 | Claude AI | claude.ai | 🔴 High |
| 3 | Copilot | copilot.microsoft.com | ✅ Done |
| 4 | Gemini | gemini.google.com | ✅ Done |
| 5 | DeepSeek | deepseek.com | 🔴 High |
| 6 | Grok | grok.com | 🟡 Medium |
| 7 | Perplexity | perplexity.ai | 🔴 High |
| 8 | Poe | poe.com | 🟡 Medium |
| 9 | Kimi | kimi.moonshot.cn | ✅ Done |
| 10 | Tongyi (Qwen) | tongyi.aliyun.com | 🟡 Medium |
| 11 | Yuanbao | yuanbao.tencent.com | 🟡 Medium |
| 12 | Google AI Studio | aistudio.google.com | 🟢 Low |
| 13 | GitHub | github.com | 🟢 Low |

### Destinations to Support
| Destination | Status |
|-------------|--------|
| Sidepanel | ✅ Working |
| Webhook | 🔧 Full impl needed |
| WebSocket | 🔧 Full impl needed |
| Custom file export | 🆕 New |

---

## Gap Analysis

### Missing Providers (7)
```
🔴 HIGH PRIORITY:
- Claude (claude.ai)
- DeepSeek (deepseek.com)
- Perplexity (perplexity.ai)

🟡 MEDIUM PRIORITY:
- Grok (grok.com)
- Poe (poe.com)
- Tongyi/Qwen (tongyi.aliyun.com)
- Yuanbao (yuanbao.tencent.com)
```

### Missing Destinations
```
- Webhook: Needs full HTTP POST implementation
- WebSocket: Needs full WS connection handling
- File Export (optional): Local JSON/Markdown export
```

---

## Implementation Order

### Phase 1: High Priority Providers (Week 1)
- [ ] ClaudePlugin - claude.ai intercept
- [ ] DeepSeekPlugin - deepseek.com intercept
- [ ] PerplexityPlugin - perplexity.ai intercept

### Phase 2: Medium Priority Providers (Week 2)
- [ ] GrokPlugin - grok.com intercept
- [ ] PoePlugin - poe.com intercept
- [ ] TongyiPlugin - tongyi.aliyun.com intercept
- [ ] YuanbaoPlugin - yuanbao.tencent.com intercept

### Phase 3: Destinations (Week 2-3)
- [ ] WebhookDestination - full HTTP POST to configurable URL
- [ ] WebSocketDestination - full WS connection management

### Phase 4: Optional Enhancements
- [ ] File export destination
- [ ] Google AI Studio support
- [ ] GitHub Copilot enhancement

---

## Architecture Constraints

Preserve existing POC decisions:
1. **Plugin interface**: Unified `ChatProviderPlugin` base class
2. **Dual interceptors**: XHR + fetch support
3. **Destination registry**: Runtime destination selection
4. **Build system**: esbuild bundling to dist/

---

## Testing Strategy

Each provider requires:
1. Unit test for interceptor pattern detection
2. Manual verification on target site
3. Integration test with destination

Each destination requires:
1. Unit test for connection handling
2. End-to-end test with provider

---

## Success Criteria

- [ ] 13 providers implemented (parity with chatexporter +1)
- [ ] Webhook working (configurable endpoint)
- [ ] WebSocket working (configurable server)
- [ ] All providers pass intercept tests
- [ ] Build passes without errors