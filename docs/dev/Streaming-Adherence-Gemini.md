# Streaming Adherence Analysis - Claude Provider

## Overview
This document analyzes the adherence requirements for a Claude provider implementation against the documented Anthropic SSE streaming schema, since no Claude provider currently exists in the codebase.

## Documented SSE Schema (from Reference)

### Format Structure
```
event: message_start
data: {"type":"message_start","message":{"id":"msg_abc","type":"message","role":"assistant","content":[],"model":"claude-sonnet-4-5","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":25,"output_tokens":1}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: ping
data: {"type":"ping"}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":10}}

event: message_stop
data: {"type":"message_stop"}
```

### Key Event Types (in Order)
| Event | Purpose |
|-------|---------|
| `message_start` | Message metadata + input token count |
| `content_block_start` | Opens a content block (text or tool_use) |
| `ping` | Keepalive |
| `content_block_delta` | Streamed text (`text_delta`) or tool JSON (`input_json_delta`) |
| `content_block_stop` | Closes a content block |
| `message_delta` | `stop_reason`, final output token count |
| `message_stop` | Stream complete |

### Tool Use Example
```
event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_abc","name":"get_weather","input":{}}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"location\":"}}
```

## Implementation Status
- **Current State**: ❌ Not implemented
- **Provider Needed**: `ClaudeProvider` class
- **Parser Needed**: Event-based SSE parser
- **Auth Method**: `sessionKey` cookie

## Required Implementation

### ClaudeProvider Structure
```javascript
export class ClaudeProvider extends BaseProvider {
  constructor() {
    super({
      id: 'claude',
      name: 'Claude',
      hosts: ['claude.ai'],
      capabilities: {
        supportsStreaming: true,
        supportsAuth: true,
        messageFormat: 'anthropic'
      },
      interceptPatterns: {
        request: /\/api\/append_message/
      }
    });
  }
  
  // Token extraction from sessionKey cookie
  // Request interception for conversation setup
  // Response processing with ClaudeSSEParser
}
```

### ClaudeSSEParser Requirements
- **Base Class**: Extend `SSEParser` with event type handling
- **Event Parsing**: Parse `event: type` lines
- **State Machine**: Track event sequence (start → deltas → stop)
- **Content Blocks**: Handle multiple content blocks (text + tool_use)
- **Keepalive**: Process `ping` events without emitting chunks
- **Termination**: Detect `message_stop` event

### Parser Logic Outline
```javascript
export class ClaudeSSEParser extends SSEParser {
  constructor(options) {
    super(options);
    this.eventState = {
      currentEvent: null,
      contentBlocks: [],
      messageMetadata: null
    };
  }
  
  async process(response) {
    // Parse SSE lines
    // Handle event types
    // Track content blocks
    // Emit chunks for text_delta
    // Buffer tool input_json_delta
    // Detect completion on message_stop
  }
}
```

## Adherence Gaps (Since Not Implemented)

### 1. Event-Based SSE
- **Requirement**: Parse named events (`event: type`)
- **Gap**: Current `SSEParser` doesn't handle event types
- **Solution**: Extend parser with event state machine

### 2. Sequential Event Processing
- **Requirement**: Strict event order (start → deltas → stop)
- **Gap**: No state tracking for event sequence
- **Solution**: Implement state machine for event flow

### 3. Content Block Management
- **Requirement**: Handle multiple content blocks per message
- **Gap**: No support for block indexing or types
- **Solution**: Track blocks by index, handle text vs tool_use

### 4. Tool Call Streaming
- **Requirement**: Incremental JSON via `input_json_delta`
- **Gap**: No tool call buffering or JSON reconstruction
- **Solution**: Buffer partial JSON, emit complete tool calls

### 5. Usage Metadata
- **Requirement**: Input tokens in `message_start`, output in `message_delta`
- **Gap**: No usage extraction from events
- **Solution**: Parse and accumulate usage data

### 6. Keepalive Handling
- **Requirement**: Ignore `ping` events
- **Gap**: No filtering of non-content events
- **Solution**: Skip ping events in processing

### 7. Termination Detection
- **Requirement**: `message_stop` event signals completion
- **Gap**: No event-based termination
- **Solution**: Detect `message_stop` and emit complete

## Authentication Implementation
```javascript
async getClaudeSessionKey() {
  const cookie = await chrome.cookies.get({
    url: "https://claude.ai",
    name: "sessionKey"
  });
  return cookie?.value;
}
```

## API Integration
- **Conversation Setup**: Create conversation via `/api/organizations/{org}/chat_conversations`
- **Streaming**: POST to `/api/append_message` with conversation UUID
- **Token Extraction**: Get org UUID from `/api/organizations`

## Structural Design Considerations

### Parser Architecture
- **Inheritance**: `ClaudeSSEParser` extends `SSEParser`
- **State Management**: Track event sequence and content blocks
- **Chunk Emission**: Only emit for `content_block_delta` with `text_delta`
- **Tool Handling**: Buffer `input_json_delta` until block complete

### Error Handling
- **Session Expiry**: Detect 401 and re-fetch sessionKey
- **Rate Limits**: Handle 429 responses with backoff
- **Network Issues**: Retry with exponential backoff

### Testing Strategy
- **Mock Streams**: Simulate event sequences
- **Auth Testing**: Test cookie extraction and API calls
- **Tool Calls**: Verify incremental JSON streaming
- **Edge Cases**: Multiple content blocks, interrupted streams

## Implementation Roadmap

### Phase 1: Basic Provider
1. Create `ClaudeProvider` class
2. Implement sessionKey extraction
3. Add conversation creation logic

### Phase 2: SSE Parser
1. Extend `SSEParser` for event handling
2. Implement state machine for event sequence
3. Add content block tracking

### Phase 3: Advanced Features
1. Tool call streaming support
2. Usage metadata extraction
3. Error recovery and retry logic

### Phase 4: Integration
1. Register provider in `ProviderRegistry`
2. Add interception patterns
3. Test end-to-end streaming

## Conclusion
Claude requires a complete SSE event-based implementation, as the current generic `SSEParser` lacks the necessary event type handling and state management. The provider needs custom parsing logic for Anthropic's structured event sequence and content block model.</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Streaming-Adherence-Claude.md