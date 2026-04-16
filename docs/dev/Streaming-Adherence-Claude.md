# Streaming Adherence Analysis - ChatGPT Provider

## Overview
This document analyzes the adherence of the ChatGPT provider implementation against the documented OpenAI SSE streaming schema, identifying gaps and structural issues.

## Documented SSE Schema (from Reference)

### Format Structure
```
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}

data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1234567890,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]
```

### Key Fields
- `choices[].delta.content`: Streamed text token
- `choices[].delta.role`: Only on first chunk
- `choices[].finish_reason`: "stop" | "length" | "tool_calls" | null
- `usage`: Only on final chunk (if `stream_options: {include_usage: true}`)

### Tool Calls
```json
"delta": {
  "tool_calls": [{"index":0,"id":"call_abc","type":"function","function":{"name":"get_weather","arguments":""}}]
}
// subsequent chunks stream `arguments` string incrementally
```

## Current Implementation Analysis

### Implementation Details
- **Provider**: `ChatGPTProvider` in `src/providers/chatgpt/ChatGPTProvider.js`
- **Parser**: `DeltaEncodingV1Parser` in `StreamingManager.js`
- **Format**: Custom `delta-encoding-v1` (not standard SSE)
- **Interception**: Request/response hooking on web app API

### Parser Logic
The `DeltaEncodingV1Parser` processes delta operations:
- Operations: `o` (operation type), `p` (path), `v` (value)
- Handles `patch`, `add`, `replace`, `append` operations
- Tracks content via `/message/content/parts` path updates
- Reconstructs content from parts array

## Adherence Gaps

### 1. SSE Format Non-Compliance
- **Gap**: No `data:` line parsing or SSE event structure
- **Current**: Raw delta operations without SSE envelope
- **Impact**: Cannot handle standard OpenAI API streams

### 2. Missing Core Fields
- **finish_reason**: Not extracted or emitted
- **usage**: No usage metadata handling
- **id/object/created**: Not tracked
- **model**: Set to "unknown" in metadata

### 3. Tool Call Streaming
- **Gap**: No support for incremental tool call arguments
- **Current**: No tool call detection or buffering
- **Required**: Stream `arguments` string incrementally per chunk

### 4. Termination Handling
- **Gap**: No `data: [DONE]` detection
- **Current**: Relies on stream end/connection close
- **Impact**: Cannot detect completion reliably

### 5. Role Handling
- **Gap**: `delta.role` only on first chunk not implemented
- **Current**: Role tracked but not emitted per schema

## Structural Issues

### Parser Design
- **Issue**: `delta-encoding-v1` is ChatGPT web app specific, not reusable
- **Problem**: Assumes internal delta format, not standard API
- **Solution**: Replace with SSE-based parser

### Content Reconstruction
- **Issue**: Assumes parts array structure
- **Problem**: Not compatible with standard `delta.content` string chunks
- **Solution**: Add content buffer for incremental text

### Metadata Extraction
- **Issue**: Limited metadata from internal format
- **Problem**: Missing usage, finish_reason, tool calls
- **Solution**: Extend parser to extract all schema fields

## Code Examples

### Current Parser Issues
```javascript
// Current: Handles internal delta operations
processDeltaPayload(payload, messageParts, currentModel, currentRole) {
  const op = payload.o;
  const path = payload.p;
  const value = payload.v;
  
  if (path === "/message/content/parts") {
    messageParts.splice(0, messageParts.length, ...value);
  }
}
```

### Required SSE Compliance
```javascript
// Needed: Standard SSE parsing
async process(response) {
  // Parse 'data: {json}' lines
  // Extract choices[].delta.content
  // Handle finish_reason and usage
  // Support tool_calls streaming
  // Detect 'data: [DONE]'
}
```

## Recommendations

### Immediate Fixes
1. **Add SSE Parser**: Create `OpenAISSEParser` extending `BaseStreamParser`
2. **Field Extraction**: Parse `choices`, `delta`, `finish_reason`, `usage`
3. **Tool Call Support**: Implement incremental argument streaming
4. **Termination**: Detect `[DONE]` and connection close

### Architecture Changes
1. **Parser Registry**: Add provider-specific SSE parsers
2. **Chunk Format**: Standardize chunk emission with all schema fields
3. **Metadata Handling**: Extract and emit usage on completion

### Testing
- Mock SSE streams with standard format
- Test tool call streaming scenarios
- Verify termination detection

## Conclusion
The ChatGPT implementation uses a custom parser for the web app's internal format, resulting in zero adherence to the documented OpenAI SSE schema. A complete rewrite to SSE-compliant parsing is required for proper streaming support.</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Streaming-Adherence-ChatGPT.md