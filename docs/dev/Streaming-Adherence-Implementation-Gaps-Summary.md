# Streaming Adherence Analysis - Gemini Provider

## Overview
This document analyzes the adherence requirements for a Gemini provider implementation against the documented Google SSE streaming schema, since no Gemini provider currently exists in the codebase.

## Documented SSE Schema (from Reference)

### Format Structure
```
data: {"candidates":[{"content":{"parts":[{"text":"Hello"}],"role":"model"},"finishReason":"","index":0,"safetyRatings":[...]}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":1,"totalTokenCount":6}}

data: {"candidates":[{"content":{"parts":[{"text":" world"}],"role":"model"},"finishReason":"STOP","index":0,"safetyRatings":[...]}],"usageMetadata":{"promptTokenCount":5,"candidatesTokenCount":2,"totalTokenCount":7}}
```

### Key Fields
- `candidates[].content.parts[].text`: Streamed text
- `candidates[].finishReason`: Empty string until final chunk, then "STOP" | "MAX_TOKENS" | "SAFETY" etc.
- `usageMetadata`: Included on **every** chunk (cumulative)
- No stream-termination sentinel — connection close signals end

### Tool Call Format
```json
"parts": [{"functionCall": {"name": "get_weather", "args": {"location": "Madrid"}}}]
// Note: Gemini does NOT stream function call arguments incrementally —
// the full args object arrives in one chunk
```

## Implementation Status
- **Current State**: ❌ Not implemented
- **Provider Needed**: `GeminiProvider` class
- **Parser Needed**: Full-response SSE parser
- **Auth Method**: `__Secure-1PSID` and `__Secure-1PSIDTS` cookies + `SNlM0e` token

## Required Implementation

### GeminiProvider Structure
```javascript
export class GeminiProvider extends BaseProvider {
  constructor() {
    super({
      id: 'gemini',
      name: 'Gemini',
      hosts: ['gemini.google.com', 'generativelanguage.googleapis.com'],
      capabilities: {
        supportsStreaming: true,
        supportsAuth: true,
        messageFormat: 'google'
      },
      interceptPatterns: {
        request: /\/generateContent\?/
      }
    });
  }
  
  // Token extraction from cookies and SNlM0e
  // Request interception for stream setup
  // Response processing with GeminiSSEParser
}
```

### GeminiSSEParser Requirements
- **Base Class**: Extend `SSEParser` or `JSONStreamParser`
- **Full Response Parsing**: Each `data:` contains complete `GenerateContentResponse`
- **Incremental Text**: Extract text from `candidates[].content.parts[]`
- **Termination**: Detect via `finishReason` or connection close
- **Usage**: Emit cumulative usage metadata per chunk

### Parser Logic Outline
```javascript
export class GeminiSSEParser extends SSEParser {
  constructor(options) {
    super(options);
    this.lastTextLength = 0;
  }
  
  async process(response) {
    // Parse each data: line as complete response
    // Extract candidates[].content.parts[].text
    // Calculate incremental text (current - previous)
    // Emit chunk with incremental text
    // Track finishReason for completion
    // Emit usage metadata
  }
}
```

## Adherence Gaps (Since Not Implemented)

### 1. Full Response per Chunk
- **Requirement**: Each SSE `data:` contains complete response object
- **Gap**: Current parsers assume incremental deltas
- **Solution**: Parse full responses, extract incremental text manually

### 2. Text Extraction Logic
- **Requirement**: `candidates[0].content.parts[0].text`
- **Gap**: No handling for candidates/parts structure
- **Solution**: Navigate response structure to extract text

### 3. Incremental Chunking
- **Requirement**: Send only new text since last chunk
- **Gap**: Parsers don't track previous content length
- **Solution**: Buffer full text, emit differences

### 4. Termination Detection
- **Requirement**: `finishReason` becomes non-empty on final chunk
- **Gap**: No finish reason checking
- **Solution**: Detect completion when `finishReason` is set

### 5. Usage Metadata
- **Requirement**: `usageMetadata` on every chunk (cumulative)
- **Gap**: No usage extraction or emission
- **Solution**: Parse and emit usage with each chunk

### 6. Tool Call Handling
- **Requirement**: Full `functionCall` object in single chunk
- **Gap**: No tool call detection or emission
- **Solution**: Detect `parts[].functionCall` and emit complete calls

### 7. Connection Close Termination
- **Requirement**: No explicit `[DONE]`; stream ends on connection close
- **Gap**: Parsers expect termination signals
- **Solution**: Handle stream end as completion

## Authentication Implementation
```javascript
async getGeminiTokens() {
  // Get cookies
  const [psid, psidts] = await Promise.all([
    chrome.cookies.get({ url: "https://gemini.google.com", name: "__Secure-1PSID" }),
    chrome.cookies.get({ url: "https://gemini.google.com", name: "__Secure-1PSIDTS" })
  ]);
  
  // Extract SNlM0e from page
  const snlm0e = await this.extractSNlM0e();
  
  return { psid: psid?.value, psidts: psidts?.value, snlm0e };
}

async extractSNlM0e() {
  const tabs = await chrome.tabs.query({ url: "https://gemini.google.com/*" });
  if (tabs.length === 0) return null;
  
  const results = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: () => {
      const match = document.body.innerHTML.match(/"SNlM0e":"([^"]+)"/);
      return match?.[1];
    }
  });
  
  return results?.[0]?.result;
}
```

## API Integration
- **Endpoint**: `/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate`
- **Method**: POST with `f.req` and `at` (SNlM0e) parameters
- **Format**: Complex protobuf-like request structure
- **Response**: Nested array responses requiring parsing

## Structural Design Considerations

### Parser Architecture
- **Inheritance**: `GeminiSSEParser` extends `SSEParser`
- **State Tracking**: Store previous full text length for incremental emission
- **Response Parsing**: Handle Google's nested array response format
- **Chunk Emission**: Emit incremental text with metadata

### Error Handling
- **Token Expiry**: Detect failures and re-extract SNlM0e
- **Rate Limits**: Handle quota exceeded responses
- **Network Issues**: Retry with backoff for transient errors

### Testing Strategy
- **Mock Responses**: Simulate SSE data lines with candidates
- **Incremental Logic**: Test text differencing
- **Termination**: Verify finishReason detection
- **Tool Calls**: Test functionCall emission

## Implementation Roadmap

### Phase 1: Basic Provider
1. Create `GeminiProvider` class
2. Implement cookie and SNlM0e extraction
3. Add tab management for token access

### Phase 2: SSE Parser
1. Create `GeminiSSEParser` class
2. Implement full response parsing
3. Add incremental text extraction

### Phase 3: Advanced Features
1. Usage metadata handling
2. Tool call support
3. Error recovery for token expiry

### Phase 4: Integration
1. Register provider in `ProviderRegistry`
2. Add interception patterns
3. Test streaming with real Gemini sessions

## Conclusion
Gemini requires parsing of complete response objects per SSE chunk rather than incremental deltas, making it incompatible with current parser designs. The implementation needs custom logic for text differencing, usage extraction, and Google's complex authentication and request format.</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Streaming-Adherence-Gemini.md