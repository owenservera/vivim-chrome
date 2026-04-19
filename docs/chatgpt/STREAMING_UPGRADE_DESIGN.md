# ChatGPT Streaming Delta Parser Protocol Upgrade Design

> Design document for upgrading the streaming implementation to fully comply with the ChatGPT Streaming Delta Parser Protocol.
> Based on analysis of current implementation vs. protocol specification.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Gap Analysis](#2-gap-analysis)
3. [Architecture Changes](#3-architecture-changes)
4. [Implementation Plan](#4-implementation-plan)
5. [Backward Compatibility](#5-backward-compatibility)
6. [Testing Strategy](#6-testing-strategy)
7. [Rollout Plan](#7-rollout-plan)

---

## 1. Executive Summary

### Current State

The current implementation (`ChatGPTResponseParser.js` and `StreamingManager.js`) handles ChatGPT.com's proprietary delta encoding format but lacks several features from the OpenAI Chat Completions Streaming protocol:

- **No tool call streaming** - Cannot handle streaming function calls
- **No refusal handling** - Cannot process safety refusal content
- **No usage accounting** - Missing token counting for billing
- **No multi-choice support** - Cannot handle `n > 1` responses
- **No error chunk detection** - Missing mid-stream error handling

### Target State

Fully compliant OpenAI SSE streaming parser supporting all protocol features:

1. ✅ Delta content/role/refusal streaming
2. ✅ Tool call streaming with JSON accumulation
3. ✅ Usage final chunk parsing
4. ✅ Multi-choice streaming
5. ✅ Complete state machine tracking
6. ✅ Error detection and handling
7. ✅ All finish reason types

### Scope

| Priority | Feature | Effort |
|----------|---------|--------|
| P0 | Tool call streaming | High |
| P0 | Refusal handling | Medium |
| P1 | Usage parsing | Low |
| P1 | Multi-choice | Medium |
| P2 | Error chunks | Low |
| P2 | State machine | Medium |

---

## 2. Gap Analysis

### 2.1 Delta Object Gaps

```
Protocol:                    Current:                    Gap:
─────────────────────────────────────────────────────────────────
delta.role                  ✅ role from o/p             ✅ OK
delta.content              ✅ content from parts          ✅ OK  
delta.tool_calls           ❌ NOT IMPLEMENTED           🔴 CRITICAL
delta.function_call        ❌ NOT IMPLEMENTED           🟡 LEGACY
delta.refusal             ❌ NOT IMPLEMENTED           🔴 CRITICAL
```

### 2.2 Tool Call Streaming Gap

**Protocol Required:**
```typescript
interface ToolCallDelta {
  index: number;           // Which tool call slot
  id?: string;            // call_abc123 - first chunk only
  type?: "function";     // "function" - first chunk only
  function?: {
    name?: string;       // get_weather - first chunk only  
    arguments?: string;  // Partial JSON - accumulate!
  };
}

// Streaming sequence:
// {"delta": {"tool_calls": [{"index": 0, "id": "call_abc", "type": "function", "function": {"name": "get_weather", "arguments": ""}}]}}
// {"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "{\"loc"}}]}}
// {"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "ation\":\"London\"}"}}]}}
// {"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "}"}}]}}
```

**Current Implementation:**
- No tool_calls handling in ChatGPTResponseParser
- OpenAISSEParser has ToolCallBuffer but incomplete

### 2.3 Refusal Handling Gap

**Protocol Required:**
```json
// When safety filter triggers:
{"delta": {"refusal": "I'm sorry, I can't help with that."}}

// Final chunk:
{"choices": [{"delta": {}, "finish_reason": "content_filter"}]}
```

**Current Implementation:**
- No refusal field detection
- No content_filter finish_reason handling

### 2.4 Usage Parsing Gap

**Protocol Required:**
```json
// When stream_options.include_usage = true:
// Final chunk AFTER finish_reason:
// {"choices": [], "usage": {"prompt_tokens": 42, "completion_tokens": 87, "total_tokens": 129}}
```

**Current Implementation:**
- No usagechunk detection
- No token accounting

### 2.5 State Machine Gap

**Protocol Required:**
```
IDLE ──► CONNECTING ──► ROLE_RECEIVED ──► STREAMING ──► FINISHING ──► DONE
                              │                │                │
                              ▼                ▼                ▼
                        TOOL_CALLING      CONTENT_FILTER      ERROR
```

**Current Implementation:**
- No explicit state tracking
- Single-pass parsing only

---

## 3. Architecture Changes

### 3.1 New Parser Class Hierarchy

```
BaseStreamParser (abstract)
    │
    ├── BaseSSEParser (existing)
    │     │
    │     ├── OpenAISSEParser (upgrade to full protocol)
    │     │     ├── ToolCallBuffer (new)
    │     │     ├── StreamAccumulator (new)
    │     │     └── UsageParser (new)
    │     │
    │     ├── DeltaEncodingV1Parser (chatgpt.com - preserve)
    │     └── ClaudeSSEParser (existing)
    │
    └── New: OpenAIStreamFacade (unified interface)
              │
              ├── parseStandard() - for api.openai.com
              ├── parseChatGPT() - for chatgpt.com (legacy)
              └── parseUnified() - auto-detect format
```

### 3.2 StreamAccumulator Interface

```typescript
interface StreamAccumulator {
  // Metadata (set once)
  id: string | null;           // "chatcmpl-abc123"
  model: string | null;         // "gpt-4o-2024-05-13"
  created: number | null;       // Unix timestamp
  system_fingerprint: string | null;
  
  // Content (accumulated)
  role: string;                // "assistant" (initial)
  content: string;             // "" (initial)
  refusal: string | null;      // null (initial)
  tool_calls: ToolCall[];      // [] (initial)
  
  // Flow control
  finish_reason: string | null;
  usage: Usage | null;
  
  // State machine
  state: StreamState;
}

enum StreamState {
  IDLE = 'idle',
  CONNECTING = 'connecting', 
  ROLE_RECEIVED = 'role_received',
  STREAMING = 'streaming',
  TOOL_CALLING = 'tool_calling',
  FINISHING = 'finishing',
  DONE = 'done',
  ERROR = 'error'
}
```

### 3.3 ToolCallAccumulator Interface

```typescript
interface ToolCallAccumulator {
  id: string;                  // e.g., "call_abc123"
  type: "function";
  function: {
    name: string;             // e.g., "get_weather"
    arguments: string;       // Partial JSON - accumulate!
  };
}

// Accumulation algorithm:
function applyToolCallDelta(deltas: ToolCallDelta[]): void {
  for (const delta of deltas) {
    const idx = delta.index;
    
    if (!toolCalls[idx]) {
      toolCalls[idx] = { id: "", type: "function", function: { name: "", arguments: "" } };
    }
    
    const tc = toolCalls[idx];
    
    if (delta.id)           tc.id = delta.id;
    if (delta.type)         tc.type = delta.type;
    if (delta.function?.name)  tc.function.name += delta.function.name;
    if (delta.function?.arguments) tc.function.arguments += delta.function.arguments;
  }
}
```

### 3.4 Chunk Output Interface

```typescript
interface ParsedChunk {
  // Content
  content: string;           // New content delta (not cumulative!)
  role: string;
  
  // Metadata
  model: string;
  id: string;
  
  // Timing
  seq: number;              // Chunk sequence number
  timestamp: number;
  
  // State
  isFinal: boolean;
  cumulative: boolean;      // Always true for current impl
  
  // Extended (new)
  finish_reason?: string;
  tool_calls?: ToolCall[]; // Only on tool_calls chunk
  refusal?: string;        // Only on refusal
  usage?: Usage;          // Only on usage chunk
}
```

---

## 4. Implementation Plan

### Phase 1: Core Tool Call Streaming (P0)

#### 1.1 Add ToolCallBuffer Class

```typescript
// File: src/core/streaming/ToolCallBuffer.js

export class ToolCallBuffer {
  constructor() {
    this.toolCalls = [];
  }
  
  /**
   * Apply tool call deltas to accumulator
   * @param {ToolCallDelta[]} deltas - Array of tool call deltas
   * @returns {ToolCall[]|null} - Completed tool calls if any
   */
  processToolCalls(deltas: ToolCallDelta[]): ToolCall[] | null {
    const completed: ToolCall[] = [];
    
    for (const delta of deltas) {
      const idx = delta.index;
      
      // Initialize slot if first delta
      if (!this.toolCalls[idx]) {
        this.toolCalls[idx] = {
          id: "",
          type: "function",
          function: { name: "", arguments: "" }
        };
      }
      
      const tc = this.toolCalls[idx];
      
      // Apply delta fields (only present on first chunk)
      if (delta.id) tc.id = delta.id;
      if (delta.type) tc.type = delta.type;
      if (delta.function?.name) tc.function.name += delta.function.name;
      if (delta.function?.arguments) tc.function.arguments += delta.function.arguments;
    }
    
    return completed.length > 0 ? completed : null;
  }
  
  /**
   * Get all accumulated tool calls
   * @returns {ToolCall[]}
   */
  getToolCalls(): ToolCall[] {
    return this.toolCalls;
  }
  
  /**
   * Check if arguments JSON is complete
   * @param {number} index - Tool call index
   * @returns {boolean}
   */
  isArgumentsComplete(index: number): boolean {
    const tc = this.toolCalls[index];
    if (!tc) return false;
    
    try {
      JSON.parse(tc.function.arguments);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Flush and return all tool calls
   * @returns {ToolCall[]}
   */
  flush(): ToolCall[] {
    const result = [...this.toolCalls];
    this.toolCalls = [];
    return result;
  }
}
```

#### 1.2 Update OpenAISSEParser

```typescript
// File: src/core/streaming/StreamingManager.js
// Update class OpenAISSEParser

export class OpenAISSEParser extends BaseSSEParser {
  constructor(options) {
    super(options);
    this.toolCallBuffer = new ToolCallBuffer();
    this.usageData = null;
    this.finishReason = null;
    this.accumulator = createAccumulator();
  }
  
  // Add method: processToolCalls()
  async processToolCalls(delta: Delta): Promise<void> {
    const completed = this.toolCallBuffer.processToolCalls(delta.tool_calls);
    
    // Emit tool call chunk
    if (completed) {
      for (const tc of completed) {
        this.emitChunkWithMetadata({
          content: "",  // No text content
          role: 'assistant',
          metadata: { tool_call: tc }
        });
      }
    }
  }
}
```

### Phase 2: Refusal Handling (P0)

#### 2.1 Add Refusal Detection

```typescript
// In processDeltaPayload() or processOpenAIChunk():

// Handle content
if (delta.content != null && delta.content !== undefined) {
  this.accumulator.content += delta.content;
}

// Handle refusal (NEW)
if (delta.refusal != null && delta.refusal !== undefined) {
  this.accumulator.refusal = (this.accumulator.refusal || "") + delta.refusal;
}

// In finish_reason handling:
if (choice.finish_reason === "content_filter") {
  // Refusal completed
  this.emitChunkWithMetadata({
    content: this.accumulator.refusal || "",
    role: 'assistant',
    metadata: {
      finish_reason: "content_filter",
      refusal: true
    },
    isFinal: true
  });
}
```

### Phase 3: Usage Parsing (P1)

#### 3.1 Detect Usage Chunk

```typescript
// In processOpenAIChunk():

function isUsageChunk(chunk: ChatCompletionChunk): boolean {
  return chunk.choices.length === 0 && chunk.usage !== undefined;
}

// Handle usage final chunk:
if (isUsageChunk(chunk)) {
  this.usageData = chunk.usage;
  this.emitChunkWithMetadata({
    content: "",
    metadata: { usage: this.usageData },
    isFinal: true
  });
  return;
}
```

### Phase 4: Multi-Choice Support (P1)

#### 4.1 Multi-Choice Accumulator

```typescript
// Replace single accumulator with map:
const accumulators: Record<number, StreamAccumulator> = {};

// In processOpenAIChunk():
for (const choice of chunk.choices) {
  const idx = choice.index;
  
  if (!accumulators[idx]) {
    accumulators[idx] = createEmptyAccumulator();
  }
  
  applyDelta(accumulators[idx], choice.delta);
  
  if (choice.finish_reason) {
    accumulators[idx].finish_reason = choice.finish_reason;
  }
}
```

### Phase 5: Error Handling (P2)

#### 5.1 Error Chunk Detection

```typescript
// In processSSEEvent():

function isErrorChunk(data: unknown): boolean {
  return typeof data === 'object' && data !== null && 'error' in data;
}

// Handle error events:
if (isErrorChunk(parsed)) {
  throw new OpenAIStreamError(parsed.error);
}
```

### Phase 6: State Machine (P2)

#### 6.1 Add State Tracking

```typescript
enum StreamState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  ROLE_RECEIVED = 'role_received', 
  STREAMING = 'streaming',
  TOOL_CALLING = 'tool_calling',
  FINISHING = 'finishing',
  DONE = 'done',
  ERROR = 'error'
}

class OpenAISSEParser extends BaseSSEParser {
  private state: StreamState = StreamState.IDLE;
  
  private transition(newState: StreamState): void {
    this.logger.debug(`State: ${this.state} -> ${newState}`);
    this.state = newState;
  }
  
  // In delta processing:
  if (delta.role && !this.accumulator.role) {
    this.transition(StreamState.ROLE_RECEIVED);
  }
  
  if (delta.tool_calls) {
    this.transition(StreamState.TOOL_CALLING);
  } else if (delta.content) {
    this.transition(StreamState.STREAMING);
  }
  
  if (finishReason) {
    this.transition(StreamState.FINISHING);
  }
}
```

---

## 5. Backward Compatibility

### 5.1 Format Detection

```typescript
// Auto-detect which parser to use:

function detectFormat(response: Response, sampleData: string): StreamFormat {
  // OpenAI standard: has "choices" array
  if (sampleData.includes('"choices"')) {
    return 'openai-sse';
  }
  
  // ChatGPT.com delta: has "o", "p" fields
  if (sampleData.includes('"o"') || sampleData.includes('"p"')) {
    return 'delta-encoding-v1';
  }
  
  // Default to OpenAI
  return 'openai-sse';
}
```

### 5.2 Provider Routing

```typescript
// In StreamingManager.processStream():
const format = options.format || detectFormat(options.response, initialBuffer);

// Route to appropriate parser:
if (format === 'openai-sse') {
  parser = new OpenAISSEParser(options);
} else if (format === 'delta-encoding-v1') {
  parser = new DeltaEncodingV1Parser(options);
}
```

### 5.3 Preserved Functionality

| Format | Parser | Status |
|--------|-------|--------|
| ChatGPT.com delta encoding | DeltaEncodingV1Parser | ✅ Preserve |
| OpenAI SSE | OpenAISSEParser | ✅ Upgrade |
| Claude SSE | ClaudeSSEParser | ✅ Preserve |
| Gemini SSE | GeminiSSEParser | ✅ Preserve |

---

## 6. Testing Strategy

### 6.1 Unit Tests

| Test | Input | Expected |
|------|------|---------|
| Tool call - header | `{"delta":{"tool_calls":[{"index":0,"id":"call_abc","type":"function","function":{"name":"get_weather","arguments":""}}]}}` | ToolCall with id="call_abc", name="get_weather" |
| Tool call - arguments | `{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"{\"loc"}}]}}` | Arguments accumulated |
| Refusal | `{"delta":{"refusal":"Sorry, I can't"}}` | refusal="Sorry, I can't" |
| Usage chunk | `{"choices":[],"usage":{"prompt_tokens":42}}` | usage.prompt_tokens=42 |
| Error chunk | `{"error":{"message":"rate limit"}}` | Throw OpenAIStreamError |
| Multi-choice | `{"choices":[{"index":0,"delta":{"content":"A"}},{"index":1,"delta":{"content":"B"}}]}` | Two accumulators |

### 6.2 Integration Tests

1. Tool call execution flow
2. Refusal with content_filter
3. Usage reporting
4. Multi-choice response
5. Error recovery

### 6.3 Test Files

```
test/unit/
  ├── ToolCallBuffer.spec.js
  ├── OpenAISSEParser.spec.js
  ├── StreamAccumulator.spec.js
  ├── RefusalHandling.spec.js
  └── UsageParsing.spec.js

test/integration/
  ├── StreamParser.spec.js  # End-to-end parser tests
  └── ErrorHandling.spec.js
```

---

## 7. Rollout Plan

### 7.1 Release Stages

| Stage | Features | Timeline |
|------|---------|----------|
| v2.1.0 | Tool call streaming | Week 1-2 |
| v2.1.1 | Refusal handling | Week 2 |
| v2.1.2 | Usage parsing | Week 3 |
| v2.1.3 | Multi-choice | Week 3-4 |
| v2.1.4 | Error handling + State machine | Week 4 |

### 7.2 Feature Flags

```typescript
const FEATURES = {
  TOOL_CALL_STREAMING: 'stream.tool_calls',
  REFUSAL_HANDLING: 'stream.refusal',
  USAGE_PARSING: 'stream.usage',
  MULTI_CHOICE: 'stream.multi_choice',
  ERROR_DETECTION: 'stream.error_detection',
  STATE_MACHINE: 'stream.state_machine'
};

// In StreamingManager:
constructor(config) {
  this.features = {
    TOOL_CALL_STREAMING: config.enableToolCalls ?? true,
    // ... other features
  };
}
```

### 7.3 Migration Path

```
Current:                          Target:
─────────────────────────────────────────────────────
ChatGPTResponseParser.js     →    DEPRECATED (use OpenAISSEParser)
DeltaEncodingV1Parser     →    KEPT (for chatgpt.com backward compat)
OpenAISSEParser           →    UPGRADE (full protocol)
StreamingManager         →    UPGRADE (features + state machine)
```

---

## Appendix A: Complete Field Reference

### Delta Fields

| Field | Type | When Present |
|-------|------|-------------|
| `delta.role` | `"assistant"?` | First chunk only |
| `delta.content` | `string \| null?` | Content chunks; null on tool calls |
| `delta.tool_calls` | `ToolCallDelta[]?` | Tool call chunks |
| `delta.function_call` | `FunctionCallDelta?` | Legacy only |
| `delta.refusal` | `string \| null?` | Safety refusal |

### ChatCompletionChunk Fields

| Field | Type | Always Present | Notes |
|-------|------|---------------|-------|
| `id` | `string` | ✅ | Shared across chunks |
| `object` | `"chat.completion.chunk"` | ✅ | Discriminator |
| `created` | `number` | ✅ | Unix timestamp |
| `model` | `string` | ✅ | Resolved model |
| `system_fingerprint` | `string?` | ❌ | May change mid-stream |
| `choices` | `Choice[]` | ✅ | Empty on usage chunk |
| `usage` | `Usage?` | ❌ | Only on usage chunk |

### Finish Reasons

| Value | Meaning |
|-------|--------|
| `stop` | Natural completion |
| `length` | Hit max_tokens |
| `tool_calls` | Tool invocation |
| `function_call` | Legacy function |
| `content_filter` | Safety filter |

---

## Appendix B: Related Documents

- [Protocol Reference](./chatgpt_streaming_delta_parser_protocol.md)
- [Current Implementation: StreamingManager.js](../src/core/streaming/StreamingManager.js)
- [Current Implementation: ChatGPTResponseParser.js](../src/providers/chatgpt/ChatGPTResponseParser.js)
- [API Stream Service](../src/background/services/ApiStreamService.md)

---

*Document Version: 1.0*
*Created: 2026-04-18*
*Author: Sisyphus*
*Status: Draft for Review*