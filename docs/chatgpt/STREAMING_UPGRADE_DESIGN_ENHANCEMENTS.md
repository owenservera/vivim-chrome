# ChatGPT Streaming Protocol - Additional Enhancements

> Addendum to STREAMING_UPGRADE_DESIGN.md
> Additional features from OpenAI Full Streaming Protocol (April 2025)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Responses API Support](#2-responses-api-support)
3. [Built-in Tools Streaming](#3-built-in-tools-streaming)
4. [Reasoning Summaries](#4-reasoning-summaries)
5. [Conversations API Integration](#5-conversations-api-integration)
6. [Realtime API (WebSocket)](#6-realtime-api-websocket)
7. [Enhanced Event Handling](#7-enhanced-event-handling)
8. [MCP Support](#8-mcp-support)
9. [Updated Implementation Priority](#9-updated-implementation-priority)

---

## 1. Overview

The initial upgrade design (STREAMING_UPGRADE_DESIGN.md) focused on Chat Completions SSE features. The OpenAI Full Streaming Protocol document reveals additional capabilities:

| New Capability | Document Section | Priority |
|----------------|-----------------|----------|
| Responses API semantic events | Section 3 | P0 |
| Built-in tool streaming | Section 3.7 | P0 |
| Reasoning summaries | Section 3.7 | P1 |
| Conversations API | Section 4 | P1 |
| Realtime API (WebSocket) | Section 6 | P2 |
| MCP integration | Section 3.7 | P1 |

---

## 2. Responses API Support

### 2.1 Key Differences from Chat Completions

| Feature | Chat Completions | Responses API |
|---------|------------------|----------------|
| Event format | Bare `data:` + `[DONE]` | Named `type` field in JSON |
| Events emitted | One per chunk | Semantic events (30+ types) |
| Conversation chaining | Manual (resend messages) | `previous_response_id` |
| Tools built-in | No | Yes (web, file, code, MCP) |

### 2.2 Event Type Catalog

Responses API emits **semantic named events** (not just bare deltas):

```typescript
// Lifecycle (emitted once)
"response.created"     // Response object created
"response.queued"    // Async or high-load
"response.in_progress" 
"response.completed"  // Full response attached
"response.failed"   
"response.incomplete"

// Output items
"response.output_item.added"     // New message/tool call started
"response.output_item.done"       // Output item complete
"response.content_part.added"    // New content part
"response.content_part.done"

// Text streaming
"response.output_text.delta"   // Partial text delta
"response.output_text.done"    // Complete text
"response.output_text.annotation.added" // Citations

// Refusal
"response.refusal.delta"
"response.refusal.done"

// Function calls  
"response.function_call_arguments.delta"
"response.function_call_arguments.done"
```

### 2.3 Parser Changes Required

```typescript
// New: ResponsesAPIEventParser
class ResponsesAPIEventParser extends BaseStreamParser {
  async processSSEEvent(eventType: string, data: string) {
    const event = JSON.parse(data);
    
    switch (event.type) {
      case 'response.created':
        return this.handleResponseCreated(event.response);
        
      case 'response.output_item.added':
        return this.handleOutputItemAdded(event);
        
      case 'response.output_text.delta':
        return this.handleTextDelta(event);
        
      case 'response.output_text.done':
        return this.handleTextDone(event);
        
      case 'response.function_call_arguments.delta':
        return this.handleFunctionCallDelta(event);
        
      case 'response.function_call_arguments.done':
        return this.handleFunctionCallDone(event);
        
      case 'error':
        return this.handleError(event);
        
      case 'response.completed':
        return this.handleResponseCompleted(event.response);
        
      case 'response.failed':
        return this.handleResponseFailed(event.response);
    }
  }
}
```

---

## 3. Built-in Tools Streaming

### 3.1 Tool Types

Responses API includes **built-in tools** (not just custom functions):

```typescript
// Web Search (NEW)
{ "type": "web_search_2025_08_26" }
{ "type": "web_search", "search_context_size": "high" }

// File Search (NEW)
{
  "type": "file_search",
  "vector_store_ids": ["vs_abc"],
  "max_num_results": 20,
  "ranking_options": { "score_threshold": 0.5 }
}

// Code Interpreter
{ "type": "code_interpreter" }

// Computer Use (Operator)
{
  "type": "computer_use_preview",
  "display_width": 1024,
  "display_height": 768
}
```

### 3.2 Tool Call Streaming Events

```typescript
// File Search events
"response.file_search_call.in_progress"
"response.file_search_call.searching"
"response.file_search_call.completed"

// Web Search events
"response.web_search_call.in_progress"
"response.web_search_call.searching"
"response.web_search_call.completed"

// Code Interpreter events
"response.code_interpreter_call.in_progress"
"response.code_interpreter_call.interpreting"
"response.code_interpreter_call.completed"
"response.code_interpreter_call_code.delta"
"response.code_interpreter_call_code.done"

// Computer Use events
"response.computer_use_call.in_progress"
"response.computer_use_call.interpreting"
"response.computer_use_call.completed"
```

### 3.3 Implementation

```typescript
// New: BuiltInToolStreamingHandler
class BuiltInToolStreamingHandler {
  handleToolEvent(event: ToolEvent): ParsedToolEvent {
    switch (event.type) {
      case 'response.file_search_call.in_progress':
        return { status: 'searching', query: event.query };
        
      case 'response.file_search_call.searching':
        return { status: 'searching', progress: event.progress };
        
      case 'response.file_search_call.completed':
        return { 
          status: 'completed', 
          results: event.results,
          cited_files: event.cited_files 
        };
        
      // Similar handlers for web_search, code_interpreter, computer_use
    }
  }
}
```

---

## 4. Reasoning Summaries

### 4.1 o-Series Model Feature

For `o1`, `o3`, etc., the model emits **internal reasoning** before the final response:

```typescript
// Event types:
"response.reasoning_summary_part.added"
"response.reasoning_summary_part.done"
"response.reasoning_summary_text.delta"
"response.reasoning_summary_text.done"
"response.reasoning_text.delta"       // If raw reasoning enabled
"response.reasoning_text.done"
```

### 4.2 Payload Example

```json
{
  "type": "response.reasoning_summary_text.done",
  "item_id": "rs_abc",
  "output_index": 0,
  "summary_index": 0,
  "text": "**Analyzing the problem**\n\nThe user asked about... ",
  "sequence_number": 4
}
```

### 4.3 Implementation

```typescript
// New: ReasoningEventHandler
class ReasoningEventHandler {
  private reasoning: string = "";
  private summary: string[] = [];
  
  handleReasoningDelta(event: ReasoningDeltaEvent): void {
    if (event.type === 'response.reasoning_summary_text.delta') {
      this.reasoning += event.delta;
    }
  }
  
  handleReasoningDone(event: ReasoningDoneEvent): void {
    this.summary.push({
      text: event.text,
      index: event.summary_index
    });
  }
  
  // Output interface
  getReasoning(): { raw: string; summary: string[] } {
    return {
      raw: this.reasoning,
      summary: this.summary
    };
  }
}
```

---

## 5. Conversations API Integration

### 5.1 Server-Managed Conversation State

Unlike Chat Completions (stateless), Responses API supports **server-managed** state:

```typescript
// Create response chained to prior response
POST /v1/responses
{
  "model": "gpt-4o",
  "input": "What was my follow-up question?",
  "previous_response_id": "resp_abc123"  // NEW: chains conversation
}

// Or use Conversations API
{
  "model": "gpt-4o",
  "input": "Continue the analysis",
  "conversation_id": "conv_xyz"  // NEW: server-managed thread
}
```

### 5.2 Implementation Requirements

```typescript
// New: ConversationManager integration
interface ConversationState {
  conversationId?: string;
  previousResponseId?: string;
  items: ConversationItem[];
}

// Store and retrieve conversation state
class ConversationStateManager {
  async chainResponse(
    currentInput: string,
    previousResponseId: string
  ): Promise<ResponseOptions> {
    // Fetch prior response for context
    const priorResponse = await this.getResponse(previousResponseId);
    
    return {
      previous_response_id: previousResponseId,
      input: currentInput
    };
  }
  
  async attachToConversation(
    currentInput: string,
    conversationId: string
  ): Promise<ResponseOptions> {
    return {
      conversation_id: conversationId,
      input: currentInput
    };
  }
}
```

---

## 6. Realtime API (WebSocket)

### 6.1 Overview

The Realtime API uses **WebSocket** instead of HTTP/SSE for bi-directional streaming:

```
wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview
```

### 6.2 Client → Server Events

```typescript
// Session management
"session.update"  // Configure model, voice, tools

// Audio buffer (mic input)
"input_audio_buffer.append"    // PCM16 base64
"input_audio_buffer.commit"   // Commit as user message
"input_audio_buffer.clear"

// Conversation items
"conversation.item.create"
"conversation.item.truncate"
"conversation.item.delete"

// Response control
"response.create"
"response.cancel"
```

### 6.3 Server → Client Events

```typescript
// Session
"session.created"
"session.updated"

// Conversation
"conversation.item.created"
"conversation.item.input_audio_transcription.delta"
"conversation.item.input_audio_transcription.completed"

// Response
"response.created"
"response.done"
"response.output_item.added"
"response.output_item.done"
"response.content_part.added"
"response.content_part.done"

// Text/Audio
"response.text.delta"
"response.text.done"
"response.audio.delta"
"response.audio.done"
"response.audio_transcript.delta"
"response.audio_transcript.done"

// Function calls
"response.function_call_arguments.delta"
"response.function_call_arguments.done"
```

### 6.4 Implementation

```typescript
// New: RealtimeAPIClient (WebSocket)
// Higher priority implementation for voice/real-time

class RealtimeAPIClient {
  private ws: WebSocket | null = null;
  
  async connect(model: string, apiKey: string): Promise<void> {
    const url = `wss://api.openai.com/v1/realtime?model=${model}`;
    
    this.ws = new WebSocket(url, [
      'Authorization: Bearer ${apiKey}',
      'OpenAI-Beta: realtime=v1'
    ]);
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleServerEvent(data);
    };
  }
  
  // Send events
  async sendAudioChunk(pcm16Base64: string): void {
    this.ws?.send(JSON.stringify({
      type: 'input_audio_buffer.append',
      audio: pcm16Base64
    }));
  }
  
  async commitAudio(): void {
    this.ws?.send(JSON.stringify({
      type: 'input_audio_buffer.commit'
    }));
  }
  
  async requestResponse(): void {
    this.ws?.send(JSON.stringify({
      type: 'response.create'
    }));
  }
}
```

**Priority:** P2 - Start with HTTP/SSE first, WebSocket for voice later

---

## 7. Enhanced Event Handling

### 7.1 Complete Event Type Enum

```typescript
// Responses API events
enum ResponsesAPIEventType {
  // Lifecycle
  RESPONSE_CREATED = 'response.created',
  RESPONSE_QUEUED = 'response.queued',
  RESPONSE_IN_PROGRESS = 'response.in_progress',
  RESPONSE_COMPLETED = 'response.completed',
  RESPONSE_FAILED = 'response.failed',
  RESPONSE_INCOMPLETE = 'response.incomplete',
  
  // Output items
  OUTPUT_ITEM_ADDED = 'response.output_item.added',
  OUTPUT_ITEM_DONE = 'response.output_item.done',
  CONTENT_PART_ADDED = 'response.content_part.added',
  CONTENT_PART_DONE = 'response.content_part.done',
  
  // Text
  OUTPUT_TEXT_DELTA = 'response.output_text.delta',
  OUTPUT_TEXT_DONE = 'response.output_text.done',
  OUTPUT_TEXT_ANNOTATION_ADDED = 'response.output_text.annotation.added',
  
  // Refusal
  REFUSAL_DELTA = 'response.refusal.delta',
  REFUSAL_DONE = 'response.refusal.done',
  
  // Function calls
  FUNCTION_CALL_ARGUMENTS_DELTA = 'response.function_call_arguments.delta',
  FUNCTION_CALL_ARGUMENTS_DONE = 'response.function_call_arguments.done',
  
  // Tools
  FILE_SEARCH_CALL_IN_PROGRESS = 'response.file_search_call.in_progress',
  FILE_SEARCH_CALL_SEARCHING = 'response.file_search_call.searching',
  FILE_SEARCH_CALL_COMPLETED = 'response.file_search_call.completed',
  
  WEB_SEARCH_CALL_IN_PROGRESS = 'response.web_search_call.in_progress',
  WEB_SEARCH_CALL_SEARCHING = 'response.web_search_call.searching',
  WEB_SEARCH_CALL_COMPLETED = 'response.web_search_call.completed',
  
  CODE_INTERPRETER_CALL_IN_PROGRESS = 'response.code_interpreter_call.in_progress',
  CODE_INTERPRETER_CALL_INTERPRETING = 'response.code_interpreter_call.interpreting',
  CODE_INTERPRETER_CALL_COMPLETED = 'response.code_interpreter_call.completed',
  
  // Reasoning (o-series)
  REASONING_SUMMARY_PART_ADDED = 'response.reasoning_summary_part.added',
  REASONING_SUMMARY_PART_DONE = 'response.reasoning_summary_part.done',
  REASONING_SUMMARY_TEXT_DELTA = 'response.reasoning_summary_text.delta',
  REASONING_SUMMARY_TEXT_DONE = 'response.reasoning_summary_text.done',
  
  // Error
  ERROR = 'error'
}
```

### 7.2 Error Event Handling

```typescript
// Responses API error event
{
  "type": "error",
  "code": "server_error",
  "message": "The server had an error processing your request",
  "sequence_number": 9
}

// Handle errors:
function isErrorEvent(event: ParsedEvent): boolean {
  return event.type === 'error' || 
         (event.error !== undefined);
}
```

---

## 8. MCP Support

### 8.1 Model Context Protocol

MCP (Model Context Protocol) enables external tool servers:

```typescript
// Tool definition
{
  "type": "mcp",
  "server_label": "my-server",
  "server_url": "https://mcp.example.com/sse",
  "allowed_tools": ["tool_a", "tool_b"],
  "headers": { "Authorization": "Bearer ..." },
  "require_approval": "never"
}
```

### 8.2 MCP Streaming Events

```typescript
// MCP events:
"response.mcp_list_tools.in_progress"
"response.mcp_list_tools.completed"
"response.mcp_list_tools.failed"
"response.mcp_call.in_progress"
"response.mcp_call.completed"
"response.mcp_call.failed"
"response.mcp_call_arguments.delta"
"response.mcp_call_arguments.done"
```

### 8.3 Implementation

```typescript
// New: MCPClient
class MCPClient {
  private serverUrl: string;
  private headers: Record<string, string>;
  
  async connect(
    serverUrl: string, 
    headers: Record<string, string>
  ): Promise<void> {
    this.serverUrl = serverUrl;
    this.headers = headers;
  }
  
  async listTools(): Promise<MCPTool[]> {
    // GET to server_url for tool list
    const response = await fetch(this.serverUrl, {
      headers: this.headers
    });
    return response.json();
  }
  
  async callTool(
    name: string, 
    args: Record<string, unknown>
  ): Promise<unknown> {
    // POST to server_url with tool call
    return fetch(this.serverUrl, {
      method: 'POST',
      headers: { ...this.headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, arguments: args })
    });
  }
}
```

---

## 9. Updated Implementation Priority

### Phase Map

| Phase | Features | API Target |
|-------|----------|------------|
| **v2.1.0** | Tool call streaming, refusal, usage | Chat Completions |
| **v2.1.1** | Multi-choice, error chunks, state machine | Chat Completions |
| **v2.2.0** | Responses API semantic events | Responses API |
| **v2.2.1** | Built-in tool streaming (web, file, code) | Responses API |
| **v2.3.0** | Reasoning summaries (o-series) | Responses API |
| **v2.3.1** | Conversations API chaining | Responses API |
| **v2.4.0** | MCP integration | Responses API |
| **v2.5.0** | Realtime API (WebSocket) | Realtime API |

### New Parser Classes Added

```
src/core/streaming/
  ├── parsers/
  │     ├── ResponsesAPIEventParser.js   [NEW v2.2]
  │     ├── BuiltInToolHandler.js        [NEW v2.2.1]
  │     ├── ReasoningHandler.js       [NEW v2.3]
  │     ├── ConversationManager.js    [NEW v2.3.1]
  │     ├── MCPClient.js              [NEW v2.4]
  │     └── RealtimeWebSocket.js     [NEW v2.5]
  │
  └── StreamingManager.js (upgrade)
```

### Feature Flag Configuration

```typescript
const STREAMING_FEATURES = {
  // Chat Completions (v2.1.x)
  TOOL_CALL_STREAMING: 'stream.tool_calls',
  REFUSAL_HANDLING: 'stream.refusal',
  USAGE_PARSING: 'stream.usage',
  MULTI_CHOICE: 'stream.multi_choice',
  ERROR_DETECTION: 'stream.error_detection',
  STATE_MACHINE: 'stream.state_machine',
  
  // Responses API (v2.2.x)
  RESPONSES_API_EVENTS: 'stream.responses_events',
  BUILTIN_TOOLS: 'stream.builtin_tools',
  
  // o-series (v2.3.x)
  REASONING_SUMMARIES: 'stream.reasoning',
  CONVERSATION_CHAINING: 'stream.conversation_chaining',
  
  // Advanced (v2.4+)
  MCP_INTEGRATION: 'stream.mcp',
  REALTIME_WEBSOCKET: 'stream.realtime'
};
```

---

## Appendix A: Compatibility Matrix

| Provider | Format Used | Which Parser |
|----------|------------|-------------|
| **api.openai.com** (Chat Completions) | `delta` from `choices[].delta` | `OpenAISSEParser` |
| **api.openai.com** (Responses API) | Semantic event types | `ResponsesAPIEventParser` |
| **chatgpt.com** | Proprietary `o/p/v` | `DeltaEncodingV1Parser` |
| **claude.ai** | Proprietary SSE | `ClaudeSSEParser` |
| **gemini.google.com** | Proprietary JSON | `GeminiSSEParser` |

---

## Appendix B: Event Detection Strategy

```typescript
function detectStreamingFormat(sampleData: string): StreamingFormat {
  const parsed = JSON.parse(sampleData);
  
  // Responses API: has "type" field as event name
  if (parsed.type && typeof parsed.type === 'string' && 
      parsed.type.startsWith('response.')) {
    return 'responses-api';
  }
  
  // Chat Completions: has "choices" array with delta
  if (parsed.choices && Array.isArray(parsed.choices)) {
    return 'chat-completions';
  }
  
  // ChatGPT.com: proprietary o/p/v format
  if (parsed.o !== undefined || parsed.p !== undefined) {
    return 'chatgpt-delta';
  }
  
  // Default
  return 'chat-completions';
}
```

---

*Document Version: 1.1*
*Added: Responses API, Built-in Tools, Reasoning, Conversations, MCP, Realtime*
*Status: Draft for Review*
*Parent Document: STREAMING_UPGRADE_DESIGN.md*