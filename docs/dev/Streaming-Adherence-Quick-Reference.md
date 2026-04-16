# Streaming Adherence - Technical Specification

## Overview
This technical specification defines the requirements and implementation details for achieving full SSE schema adherence in the Chrome Extension's streaming system.

## System Requirements

### Functional Requirements

#### SSE-001: SSE Protocol Compliance
**Description**: All parsers must implement standard Server-Sent Events protocol
**Requirements**:
- Parse `data:` lines containing JSON payloads
- Handle named `event:` types where applicable
- Support `id:` and `retry:` fields
- Implement proper termination detection
- Handle connection close as completion signal

#### SSE-002: Schema-Specific Parsing
**Description**: Each provider must parse its documented SSE schema correctly
**Requirements**:
- OpenAI: `choices[].delta.content`, `finish_reason`, `usage`
- Claude: Event sequence with `content_block_delta`, `message_stop`
- Gemini: Full responses with `candidates[].content.parts[]`

#### SSE-003: Tool Call Streaming
**Description**: Support incremental tool argument streaming
**Requirements**:
- OpenAI: Buffer incremental `arguments` string
- Claude: Accumulate `partial_json` into complete JSON
- Gemini: Emit full `functionCall` objects
- Standard emission format for UI consumption

#### SSE-004: Usage Metadata
**Description**: Extract and emit token usage information
**Requirements**:
- Parse usage from appropriate chunks/events
- Standardize emission format across providers
- Integrate with streaming metrics
- Display in UI with appropriate formatting

#### SSE-005: Error Handling
**Description**: Robust error recovery and user feedback
**Requirements**:
- Auth token refresh on expiry
- Exponential backoff for retries
- Rate limit detection and handling
- Clear error messages for users

### Non-Functional Requirements

#### PERF-001: Streaming Performance
**Requirements**:
- <100ms chunk processing latency
- <500ms stream initialization time
- Support concurrent streams (max 5)
- Efficient memory usage for long conversations

#### SEC-001: Security & Privacy
**Requirements**:
- Secure token storage and handling
- User consent for session access
- Minimal data retention
- Audit logging for auth operations

#### DET-001: Detection Resistance
**Requirements**:
- Content-script fetch mode option
- Browser-like header spoofing
- Mimic native app behavior patterns
- Configurable stealth settings

## Architecture Specification

### Core Components

#### StreamingManager
```javascript
class StreamingManager {
  // Parser registry
  registerParser(format, parserClass)
  registerDefaultParsers()

  // Stream processing
  async processStream({
    streamId,
    response,
    format,
    metadata,
    enableRetry
  })

  // Lifecycle management
  handleChunk(streamId, chunk)
  handleComplete(streamId, startTime)
  handleError(streamId, error, startTime, enableRetry, retryOptions)

  // State management
  getStreamState(streamId)
  cancelStream(streamId)
}
```

#### BaseSSEParser
```javascript
class BaseSSEParser extends BaseStreamParser {
  // SSE parsing
  parseSSELine(line)
  handleDataLine(jsonData)
  handleEventLine(eventType)
  detectTermination()

  // Provider-specific hooks
  processChunkData(data) // Override in subclasses
  extractMetadata(data)  // Override in subclasses
  handleTermination()    // Override in subclasses
}
```

#### Provider Interface
```javascript
class BaseProvider {
  // Core methods
  matchRequest(ctx)
  onRequest(ctx)
  matchResponse(ctx)
  async onResponse(ctx)

  // Auth methods
  getAuthHeaders()
  refreshAuth()

  // Metadata
  getCapabilities()
  getInterceptPatterns()
}
```

### Parser Specifications

#### OpenAISSEParser
**Inherits**: `BaseSSEParser`
**Format**: `data: {json}` → `data: [DONE]`

**Key Methods**:
```javascript
processChunkData(data) {
  // Extract choices[0].delta.content
  // Handle finish_reason
  // Buffer tool_calls.arguments
  // Extract usage on final chunk
}

detectTermination() {
  // Check for 'data: [DONE]'
}
```

**Chunk Format**:
```javascript
{
  content: "incremental text",
  role: "assistant",
  model: "gpt-4o",
  seq: 1,
  finish_reason: null, // or "stop", "length", "tool_calls"
  usage: { /* token counts */ }, // final chunk only
  tool_calls: [/* incremental calls */],
  timestamp: Date.now()
}
```

#### ClaudeSSEParser
**Inherits**: `BaseSSEParser`
**Format**: `event: type\ndata: {json}` → `message_stop`

**State Machine**:
```
message_start → content_block_start → content_block_delta* → content_block_stop → message_delta → message_stop
```

**Key Methods**:
```javascript
handleEventLine(eventType) {
  switch(eventType) {
    case 'message_start': this.handleMessageStart(data);
    case 'content_block_start': this.handleBlockStart(data);
    case 'content_block_delta': this.handleBlockDelta(data);
    case 'content_block_stop': this.handleBlockStop(data);
    case 'message_delta': this.handleMessageDelta(data);
    case 'message_stop': this.handleCompletion();
    case 'ping': /* ignore */;
  }
}
```

**Chunk Format**:
```javascript
{
  content: "incremental text",
  role: "assistant",
  model: "claude-sonnet-4-5",
  seq: 1,
  content_block_index: 0,
  usage: { input_tokens: 25, output_tokens: 10 },
  tool_calls: [/* incremental JSON */],
  timestamp: Date.now(),
  isFinal: false
}
```

#### GeminiSSEParser
**Inherits**: `BaseSSEParser`
**Format**: `data: {json}` → connection close

**Key Methods**:
```javascript
processChunkData(data) {
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text) {
    const incremental = text.slice(this.lastTextLength);
    this.lastTextLength = text.length;
    this.emitChunk({ content: incremental, ... });
  }

  if (data.candidates?.[0]?.finishReason) {
    this.handleCompletion();
  }
}
```

**Chunk Format**:
```javascript
{
  content: "incremental text",
  role: "model",
  model: "gemini-pro",
  seq: 1,
  finish_reason: "STOP", // or null
  usage: {
    promptTokenCount: 5,
    candidatesTokenCount: 2,
    totalTokenCount: 7
  },
  tool_calls: [/* complete calls */],
  timestamp: Date.now()
}
```

## Implementation Details

### Tool Call Buffering
```javascript
class ToolCallBuffer {
  constructor() {
    this.calls = new Map(); // index -> call data
  }

  // OpenAI: append to arguments string
  appendArguments(index, delta) {
    const call = this.calls.get(index) || { arguments: '' };
    call.arguments += delta;
    this.calls.set(index, call);
  }

  // Claude: accumulate partial JSON
  appendPartialJson(index, partial) {
    // Parse and merge partial JSON
  }

  // Gemini: set complete call
  setCompleteCall(index, call) {
    this.calls.set(index, call);
  }

  getCompleteCalls() {
    return Array.from(this.calls.values());
  }
}
```

### Usage Metadata Standardization
```javascript
// Standardized usage format
{
  input_tokens: number,
  output_tokens: number,
  total_tokens: number,
  cost_cents?: number, // calculated
  provider: "openai" | "claude" | "gemini",
  model: string
}
```

### Error Handling Patterns
```javascript
class StreamingError extends Error {
  constructor(type, message, retryable = false) {
    super(message);
    this.type = type; // 'auth', 'network', 'rate_limit', 'quota'
    this.retryable = retryable;
  }
}

// Error types and handling
const ERROR_HANDLING = {
  'auth': { retryable: false, refresh: true },
  'network': { retryable: true, backoff: true },
  'rate_limit': { retryable: true, backoff: true },
  'quota': { retryable: false, user_message: true }
};
```

## Testing Specifications

### Unit Tests
- SSE line parsing correctness
- Schema field extraction accuracy
- Tool call buffering logic
- Error condition handling
- Termination detection

### Integration Tests
- End-to-end streaming per provider
- Mock SSE stream validation
- Auth refresh workflows
- Network failure recovery

### Performance Tests
- Chunk processing throughput
- Memory usage under load
- Concurrent stream handling
- Large conversation scenarios

## Security Considerations

### Token Management
- Encrypted storage with Chrome storage API
- Automatic cleanup on extension unload
- Token rotation for long sessions
- Audit trail for auth operations

### User Consent
- Explicit permission requests
- Clear risk disclosure
- Granular provider permissions
- Easy opt-out mechanisms

### Data Handling
- No persistent conversation storage
- Sanitized input validation
- Minimal logging of sensitive data
- Secure inter-process communication

## Deployment Considerations

### Feature Flags
```javascript
const FEATURES = {
  SSE_COMPLIANCE: true,
  TOOL_CALLS: true,
  USAGE_TRACKING: true,
  STEALTH_MODE: false, // opt-in
  MULTI_PROVIDER: true
};
```

### Version Compatibility
- Backward compatibility with existing delta-encoding
- Gradual rollout of new parsers
- Fallback to basic streaming on errors
- Version detection for schema changes

### Monitoring & Metrics
- Stream success/failure rates
- Chunk processing performance
- Detection incident tracking
- User adoption metrics

## Conclusion

This technical specification provides the detailed requirements and implementation guidance for achieving full SSE schema adherence. The modular architecture supports provider-specific extensions while maintaining consistent interfaces and robust error handling.</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Streaming-Adherence-Technical-Specification.md