# ChatGPT Streaming Files - Architecture Redesign

> Redesign proposal for ChatGPT provider files to support full streaming protocol

---

## Current State

### Existing Files

```
src/providers/chatgpt/
├── ChatGPTProvider.js         # Main entry point
├── ChatGPTResponseParser.js  # Streaming parser (proprietary format)
├── ChatGPTStealthInterceptor.js
└── ChatGPTAuthStore.js
```

### Problems with Current Design

| Issue | Impact |
|-------|--------|
| Single monolithic parser | Can't handle multiple API formats |
| Hardcoded format (`delta-encoding-v1`) | Can't switch to Responses API |
| No tool call handling | Missing function call streaming |
| No state machine | Can't track stream lifecycle |
| No error event handling | Can't handle mid-stream errors |
| Tightly coupled | Parser + Provider are coupled |

---

## Redesign Proposal

### New File Structure

```
src/providers/chatgpt/
├── ChatGPTProvider.js           # [UNCHANGED] Main entry point
├── ChatGPTAuthStore.js        # [UNCHANGED] Auth storage
├── ChatGPTStealthInterceptor.js # [UNCHANGED] Request interception
│
├── parsers/                      # [NEW] Modular parser directory
│   ├── index.js              # Parser factory/registry
│   ├── BaseParser.js        # Abstract base class
│   ├── DeltaEncodingV1Parser.js   # [REFACTORED] chatgpt.com format
│   ├── OpenAIChatCompletionsParser.js # [NEW] api.openai.com /chat/completions
│   ├── ResponsesAPIParser.js    # [NEW] api.openai.com /responses
│   └── ClaudeSSEParser.js      # [EXISTING] Claude compatibility
│
├── handlers/                    # [NEW] Specialized handlers
│   ├── index.js
│   ├── ToolCallHandler.js    # [NEW] Tool call streaming
│   ├── RefusalHandler.js   # [NEW] Refusal handling
│   ├── UsageHandler.js    # [NEW] Usage parsing
│   ├── MultiChoiceHandler.js  # [NEW] n > 1 handling
│   └── ErrorHandler.js    # [NEW] Error detection
│
├── streaming/                  # [NEW] Streaming utilities
│   ├── StreamAccumulator.js  # [NEW] State accumulator
│   ├── StreamStateMachine.js # [NEW] State tracking
│   ├── StreamEventEmitter.js # [NEW] Event emissions
│   └── ToolCallBuffer.js  # [NEW] JSON accumulation
│
└── protocol/                  # [NEW] Protocol definitions
    ├── EventTypes.js       # [NEW] Event type enums
    ├── FormatDetector.js  # [NEW] Auto-detect format
    └── constants.js     # [NEW] Protocol constants
```

### Key Design Principles

1. **Modular** - Each handler is isolated and testable
2. **Extensible** - Add new parsers without touching existing code
3. **Stateful** - Full stream lifecycle tracking
4. **Format-aware** - Auto-detect and switch formats

---

## Core Classes

### 1. BaseParser (Abstract)

```typescript
// src/providers/chatgpt/parsers/BaseParser.js

export class StreamState {
  static IDLE = 'idle';
  static CONNECTING = 'connecting';
  static ROLE_RECEIVED = 'role_received';
  static STREAMING = 'streaming';
  static TOOL_CALLING = 'tool_calling';
  static FINISHING = 'finishing';
  static DONE = 'done';
  static ERROR = 'error';
}

export abstract class BaseParser {
  constructor(options) {
    this.streamId = options.streamId;
    this.metadata = options.metadata || {};
    this.onChunk = options.onChunk;
    this.onComplete = options.onComplete;
    this.onError = options.onError;
    
    this.state = StreamState.IDLE;
    this.accumulator = this.createAccumulator();
    this.isCancelled = false;
  }
  
  abstract createAccumulator();
  abstract processChunk(chunk);
  abstract processDone();
  
  // Template method
  async parse(response) {
    this.transition(StreamState.CONNECTING);
    
    try {
      await this.readStream(response);
      this.transition(StreamState.DONE);
      this.onComplete(this.accumulator);
    } catch (error) {
      this.transition(StreamState.ERROR);
      this.onError(error);
    }
  }
  
  transition(newState) {
    this.state = newState;
  }
}
```

### 2. StreamAccumulator

```typescript
// src/providers/chatgpt/streaming/StreamAccumulator.js

export class StreamAccumulator {
  constructor() {
    // Metadata (set once)
    this.id = null;
    this.model = null;
    this.created = null;
    this.system_fingerprint = null;
    
    // Content
    this.role = 'assistant';
    this.content = '';
    this.refusal = null;
    
    // Tool calls
    this.tool_calls = [];
    
    // Flow control
    this.finish_reason = null;
    this.usage = null;
  }
  
  // Apply delta
  applyDelta(delta, choice) {
    if (delta.role) this.role = delta.role;
    if (delta.content != null) this.content += delta.content;
    if (delta.refusal != null) this.refusal = (this.refusal || '') + delta.refusal;
    if (delta.tool_calls) this.applyToolCalls(delta.tool_calls);
    if (choice.finish_reason) this.finish_reason = choice.finish_reason;
  }
  
  applyToolCalls(deltas) {
    for (const tc of deltas) {
      const idx = tc.index;
      if (!this.tool_calls[idx]) {
        this.tool_calls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } };
      }
      const slot = this.tool_calls[idx];
      if (tc.id) slot.id = tc.id;
      if (tc.type) slot.type = tc.type;
      if (tc.function?.name) slot.function.name += tc.function.name;
      if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
    }
  }
  
  // Get final result
  toMessage() {
    return {
      id: this.id,
      model: this.model,
      role: this.role,
      content: this.content,
      refusal: this.refusal,
      tool_calls: this.tool_calls.filter(Boolean),
      finish_reason: this.finish_reason,
      usage: this.usage
    };
  }
}
```

### 3. Parser Factory

```typescript
// src/providers/chatgpt/parsers/index.js

import { DeltaEncodingV1Parser } from './DeltaEncodingV1Parser.js';
import { OpenAIChatCompletionsParser } from './OpenAIChatCompletionsParser.js';
import { ResponsesAPIParser } from './ResponsesAPIParser.js';

const PARSERS = {
  'delta-encoding-v1': DeltaEncodingV1Parser,   // chatgpt.com
  'openai-chat': OpenAIChatCompletionsParser,   // api.openai.com/chat/completions
  'openai-responses': ResponsesAPIParser,    // api.openai.com/responses
  'sse': OpenAIChatCompletionsParser,      // Generic fallback
};

export function createParser(format, options) {
  const ParserClass = PARSERS[format];
  if (!ParserClass) {
    throw new Error(`Unknown format: ${format}. Available: ${Object.keys(PARSERS).join(', ')}`);
  }
  return new ParserClass(options);
}

export function detectFormat(sampleData) {
  const data = JSON.parse(sampleData);
  
  // Responses API: has "type" field starting with "response."
  if (data.type?.startsWith?.('response.')) {
    return 'openai-responses';
  }
  
  // Chat Completions: has "choices" with delta
  if (data.choices && Array.isArray(data.choices)) {
    return 'openai-chat';
  }
  
  // ChatGPT.com: proprietary o/p/v format
  if (data.o !== undefined || data.p !== undefined) {
    return 'delta-encoding-v1';
  }
  
  // Default
  return 'openai-chat';
}
```

---

## Provider Integration

### Updated ChatGPTProvider

```typescript
// src/providers/chatgpt/ChatGPTProvider.js

import { createParser, detectFormat } from './parsers/index.js';

class ChatGPTProvider extends BaseProvider {
  async onResponse(ctx) {
    // Auto-detect format from response
    const sample = await this.peekResponse(ctx.response);
    const format = this.detectStreamingFormat(sample, ctx.url);
    
    // Create parser
    const parser = createParser(format, {
      streamId: this.generateStreamId(),
      metadata: { provider: 'chatgpt', model: 'unknown' },
      onChunk: (chunk) => this.emitChunk(chunk),
      onComplete: (acc) => this.emitComplete(acc),
      onError: (err) => this.emitError(err)
    });
    
    // Process stream
    await parser.parse(ctx.response);
  }
  
  detectStreamingFormat(sample, url) {
    // api.openai.com → use Responses API
    if (url.includes('api.openai.com/v1/responses')) {
      return 'openai-responses';
    }
    if (url.includes('api.openai.com/v1/chat')) {
      return 'openai-chat';
    }
    // chatgpt.com → proprietary format
    if (url.includes('chatgpt.com') || url.includes('chat.com')) {
      return 'delta-encoding-v1';
    }
    // Default detection
    return detectFormat(sample);
  }
  
  async peekResponse(response) {
    // Read first chunk without consuming
    const reader = response.clone().body.getReader();
    const { value } = await reader.read();
    reader.cancel();
    return new TextDecoder().decode(value);
  }
}
```

---

## New Parser Implementations

### OpenAIChatCompletionsParser (New Full Implementation)

```typescript
// src/providers/chatgpt/parsers/OpenAIChatCompletionsParser.js

import { BaseParser, StreamState } from './BaseParser.js';
import { StreamAccumulator } from '../streaming/StreamAccumulator.js';
import { ToolCallHandler } from '../handlers/ToolCallHandler.js';
import { RefusalHandler } from '../handlers/RefusalHandler.js';
import { UsageHandler } from '../handlers/UsageHandler.js';

export class OpenAIChatCompletionsParser extends BaseParser {
  createAccumulator() {
    return new StreamAccumulator();
  }
  
  async readStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const events = this.parseSSEvents(buffer);
      
      for (const event of events) {
        await this.processEvent(event);
      }
    }
  }
  
  async processEvent(event) {
    const { type, data } = event;
    
    // [DONE] sentinel
    if (data === '[DONE]') {
      this.transition(StreamState.DONE);
      return;
    }
    
    // Parse JSON
    const chunk = JSON.parse(data);
    
    // Check for error chunk
    if (chunk.error) {
      throw new Error(chunk.error.message);
    }
    
    // Process like normal chunk
    this.processChunk(chunk);
  }
  
  processChunk(chunk) {
    const acc = this.accumulator;
    
    // Metadata
    if (!acc.id) acc.id = chunk.id;
    if (!acc.model) acc.model = chunk.model;
    if (chunk.system_fingerprint) acc.system_fingerprint = chunk.system_fingerprint;
    
    // Usage chunk (empty choices)
    if (chunk.choices?.length === 0 && chunk.usage) {
      acc.usage = chunk.usage;
      this.onChunk({ type: 'usage', usage: chunk.usage });
      return;
    }
    
    // Process choices
    for (const choice of chunk.choices || []) {
      const { delta, finish_reason } = choice;
      
      // Role (first chunk only)
      if (delta?.role) {
        this.transition(StreamState.ROLE_RECEIVED);
        acc.role = delta.role;
      }
      
      // Content
      if (delta?.content != null) {
        this.transition(StreamState.STREAMING);
        acc.content += delta.content;
      }
      
      // Tool calls
      if (delta?.tool_calls) {
        this.transition(StreamState.TOOL_CALLING);
        acc.applyToolCalls(delta.tool_calls);
      }
      
      // Refusal
      if (delta?.refusal) {
        acc.refusal = (acc.refusal || '') + delta.refusal;
      }
      
      // Finish reason
      if (finish_reason) {
        this.transition(StreamState.FINISHING);
        acc.finish_reason = finish_reason;
      }
    }
    
    // Emit chunk
    this.onChunk({
      type: 'content',
      content: acc.content,
      role: acc.role,
      model: acc.model,
      tool_calls: acc.tool_calls,
      finish_reason: acc.finish_reason,
      isFinal: acc.finish_reason !== null
    });
  }
  
  processDone() {
    this.onComplete(this.accumulator.toMessage());
  }
}
```

### ResponsesAPIParser (New)

```typescript
// src/providers/chatgpt/parsers/ResponsesAPIParser.js

import { BaseParser } from './BaseParser.js';
import { StreamAccumulator } from '../streaming/StreamAccumulator.js';

export class ResponsesAPIParser extends BaseParser {
  createAccumulator() {
    return new StreamAccumulator();
  }
  
  async processEvent(eventType, data) {
    const event = JSON.parse(data);
    
    switch (event.type) {
      case 'response.created':
        this.handleCreated(event.response);
        break;
        
      case 'response.output_item.added':
        this.handleOutputItemAdded(event);
        break;
        
      case 'response.output_text.delta':
        this.handleTextDelta(event);
        break;
        
      case 'response.output_text.done':
        this.handleTextDone(event);
        break;
        
      case 'response.function_call_arguments.delta':
        this.handleFunctionCallDelta(event);
        break;
        
      case 'response.function_call_arguments.done':
        this.handleFunctionCallDone(event);
        break;
        
      case 'response.completed':
        this.handleCompleted(event.response);
        break;
        
      case 'response.failed':
        this.handleFailed(event.response);
        break;
        
      case 'error':
        this.handleError(event);
        break;
    }
  }
  
  handleTextDelta(event) {
    this.accumulator.content += event.delta;
    this.onChunk({
      type: 'content',
      content: event.delta,
      item_id: event.item_id,
      isDelta: true
    });
  }
  
  handleFunctionCallDelta(event) {
    // Accumulate JSON arguments
    const tc = this.accumulator.tool_calls[event.output_index];
    if (tc) {
      tc.function.arguments += event.delta;
    }
  }
  
  handleCompleted(response) {
    this.accumulator.usage = response.usage;
    this.onComplete(this.accumulator.toMessage());
  }
}
```

---

## Handlers

### ToolCallHandler

```typescript
// src/providers/chatgpt/handlers/ToolCallHandler.js

export class ToolCallHandler {
  constructor() {
    this.toolCalls = [];
  }
  
  processToolCalls(deltas) {
    const completed = [];
    
    for (const delta of deltas) {
      const idx = delta.index;
      
      if (!this.toolCalls[idx]) {
        this.toolCalls[idx] = {
          id: delta.id || '',
          type: delta.type || 'function',
          function: {
            name: delta.function?.name || '',
            arguments: delta.function?.arguments || ''
          }
        };
      }
      
      const tc = this.toolCalls[idx];
      
      // Append arguments (streaming JSON)
      if (delta.function?.arguments) {
        tc.function.arguments += delta.function.arguments;
      }
      
      // Check if arguments are complete JSON
      if (tc.function.arguments) {
        try {
          JSON.parse(tc.function.arguments);
          completed.push(tc);
        } catch {
          // Still incomplete, continue accumulating
        }
      }
    }
    
    return completed;
  }
  
  getToolCalls() {
    return this.toolCalls.filter(Boolean);
  }
  
  flush() {
    const result = [...this.toolCalls];
    this.toolCalls = [];
    return result;
  }
}
```

---

## Migration Path

### Phase 1: Preserve Current (v2.1)

```
Current: ChatGPTResponseParser.js → Keep as DeltaEncodingV1Parser.js
Current: StreamingManager → Register DeltaEncodingV1Parser
```

### Phase 2: Add New Parsers (v2.2)

```
src/providers/chatgpt/parsers/
├── index.js (NEW) - Factory
├── BaseParser.js (NEW)
├── OpenAIChatCompletionsParser.js (NEW)
└── ResponsesAPIParser.js (NEW)
```

### Phase 3: Add Handlers (v2.3)

```
src/providers/chatgpt/handlers/
├── ToolCallHandler.js (NEW)
├── RefusalHandler.js (NEW)
└── UsageHandler.js (NEW)
```

### Phase 4: Full Integration (v2.4)

```
ChatGPTProvider.js → Uses parser factory
StreamingManager.js → Registers all parsers
```

---

## File Redundancy

| Current File | New Design | Action |
|-------------|-----------|--------|
| `ChatGPTProvider.js` | `ChatGPTProvider.js` | Minimal change (use factory) |
| `ChatGPTResponseParser.js` | `parsers/DeltaEncodingV1Parser.js` | Rename + refactor |
| (NEW) | `parsers/BaseParser.js` | Create |
| (NEW) | `parsers/OpenAIChatCompletionsParser.js` | Create |
| (NEW) | `parsers/ResponsesAPIParser.js` | Create |
| (NEW) | `handlers/ToolCallHandler.js` | Create |
| (NEW) | `streaming/StreamAccumulator.js` | Create |
| (NEW) | `streaming/StreamStateMachine.js` | Create |
| (NEW) | `protocol/EventTypes.js` | Create |

---

## Implementation Order

```
Week 1: parsers/BaseParser.js + StreamingManager registry
Week 2: parsers/OpenAIChatCompletionsParser.js (full protocol)
Week 3: handlers/* (ToolCall, Refusal, Usage)
Week 4: parsers/ResponsesAPIParser.js
Week 5: Integration + Testing
```

---

*Document Version: 1.0*
*Status: Design Proposal*
*For: STREAMING_UPGRADE_DESIGN.md*