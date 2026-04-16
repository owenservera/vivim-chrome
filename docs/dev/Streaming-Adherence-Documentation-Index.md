# Streaming Adherence - Quick Reference

## SSE Schema Comparison

| Provider | Content Path | Termination | Tool Calls | Usage |
|----------|--------------|-------------|------------|-------|
| **OpenAI** | `choices[0].delta.content` | `data: [DONE]` | `delta.tool_calls[].function.arguments` (incremental) | `usage` (final chunk) |
| **Claude** | `content_block_delta.delta.text` | `message_stop` event | `content_block_delta.delta.partial_json` (incremental) | `message_start` + `message_delta` |
| **Gemini** | `candidates[0].content.parts[0].text` | `finishReason` ≠ "" | `parts[].functionCall` (complete) | `usageMetadata` (every chunk) |

## Current Implementation Status

| Component | Status | Issues |
|-----------|--------|--------|
| **StreamingManager** | ✅ Good | Needs SSE-first design |
| **ChatGPT Parser** | ❌ Non-compliant | Uses custom delta-encoding |
| **Claude Provider** | ❌ Missing | Complete implementation needed |
| **Gemini Provider** | ❌ Missing | Complete implementation needed |
| **Tool Calls** | ❌ None | Zero support |
| **Usage Tracking** | ❌ None | No extraction |
| **Stealth Mode** | ❌ None | Background fetches only |

## Key Gaps & Fixes

### 1. SSE Format Compliance
**Problem**: No standard SSE parsing
**Fix**: Implement `BaseSSEParser` with `data:` line handling

### 2. Provider-Specific Parsers
**Problem**: One custom parser, not reusable
**Fix**: Create `OpenAISSEParser`, `ClaudeSSEParser`, `GeminiSSEParser`

### 3. Tool Call Streaming
**Problem**: No incremental argument support
**Fix**: `ToolCallBuffer` class for JSON accumulation

### 4. Usage Metadata
**Problem**: Token counts not extracted
**Fix**: Parse and emit standardized usage format

### 5. Termination Detection
**Problem**: Improper completion handling
**Fix**: Schema-specific termination logic

## Implementation Checklist (Summary)

### Phase 1: Foundation ✅ SSE Infrastructure
- [ ] Create `BaseSSEParser`
- [ ] Implement line parsing utilities
- [ ] Add termination detection
- [ ] Update `StreamingManager`

### Phase 2: ChatGPT Compliance
- [ ] Create `OpenAISSEParser`
- [ ] Parse `choices[].delta.content`
- [ ] Handle `finish_reason` and `usage`
- [ ] Implement tool call streaming
- [ ] Detect `[DONE]` termination

### Phase 3: Multi-Provider
- [ ] Implement `ClaudeProvider` + `ClaudeSSEParser`
- [ ] Implement `GeminiProvider` + `GeminiSSEParser`
- [ ] Add provider registry updates
- [ ] Test end-to-end streaming

### Phase 4: Advanced Features
- [ ] Tool call buffering across providers
- [ ] Usage metadata extraction
- [ ] Error recovery improvements
- [ ] Stealth mode (content-script fetches)

## Code Examples

### SSE Parser Base Class
```javascript
class BaseSSEParser extends BaseStreamParser {
  async process(response) {
    const reader = response.body.getReader();
    let buffer = '';

    while (!this.isCancelled) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          this.handleDataLine(line.slice(6));
        } else if (line.startsWith('event: ')) {
          this.handleEventLine(line.slice(7));
        }
      }
    }
  }
}
```

### Chunk Emission Format
```javascript
// Standardized chunk format
{
  content: "text chunk",
  role: "assistant",
  model: "provider-model",
  seq: 1,
  timestamp: Date.now(),
  finish_reason: null, // or "stop", "length", etc.
  usage: { /* token counts */ },
  tool_calls: [/* current calls */],
  isFinal: false
}
```

### Tool Call Buffer Usage
```javascript
// OpenAI incremental arguments
buffer.appendArguments(callIndex, delta);

// Claude partial JSON
buffer.appendPartialJson(callIndex, partial);

// Gemini complete call
buffer.setCompleteCall(callIndex, callData);
```

## Common Issues & Solutions

### Issue: Parser not emitting chunks
**Check**: Is `data:` line parsing correct? Is content path valid?

### Issue: Wrong termination
**Check**: Does parser detect provider-specific termination signal?

### Issue: Tool calls not streaming
**Check**: Is `ToolCallBuffer` properly integrated? JSON parsing correct?

### Issue: High detection risk
**Check**: Using content-script fetches? Headers spoofed?

## Testing Commands

```bash
# Run SSE parser tests
npm test -- --grep "SSE"

# Test specific provider
npm test -- --grep "ChatGPT"

# Performance benchmark
npm run benchmark streaming

# Detection analysis
npm run analyze stealth
```

## Related Documentation

- [System Architecture](Streaming-Adherence-System-Architecture.md)
- [Action Plan](Streaming-Adherence-Action-Plan.md)
- [Implementation Checklist](Streaming-Adherence-Implementation-Checklist.md)
- [Technical Specification](Streaming-Adherence-Technical-Specification.md)

---

*For detailed analysis, see the full documentation set in `docs/Streaming-Adherence-*.md`*</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Streaming-Adherence-Quick-Reference.md