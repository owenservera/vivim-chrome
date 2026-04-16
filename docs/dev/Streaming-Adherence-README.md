# Streaming Adherence - Action Plan

## Overview
This document outlines the concrete steps required to achieve full SSE schema adherence across all AI providers in the Chrome Extension.

## Phase 1: SSE Foundation (Week 1-2)

### 1.1 Refactor StreamingManager for SSE-First Design
**Objective**: Make SSE parsing the core, with provider-specific extensions

**Tasks**:
- Modify `StreamingManager.registerDefaultParsers()` to prioritize SSE
- Create `BaseSSEParser` extending `BaseStreamParser`
- Implement common SSE line parsing (`data:`, `event:`, `id:`, etc.)
- Add termination detection utilities (`[DONE]`, connection close, custom events)

**Files to Modify**:
- `src/core/streaming/StreamingManager.js`
- Add `src/core/streaming/BaseSSEParser.js`

### 1.2 Create Provider-Specific SSE Parsers
**Objective**: Each provider gets a compliant SSE parser

**Tasks**:
- `OpenAISSEParser`: Handle `choices[].delta`, `finish_reason`, `usage`, tool calls
- `ClaudeSSEParser`: Handle event sequence, content blocks, `message_stop`
- `GeminiSSEParser`: Handle full responses, incremental text extraction

**Files to Create**:
- `src/core/streaming/parsers/OpenAISSEParser.js`
- `src/core/streaming/parsers/ClaudeSSEParser.js`
- `src/core/streaming/parsers/GeminiSSEParser.js`

### 1.3 Update ChatGPT to Use SSE Parser
**Objective**: Replace delta-encoding with proper OpenAI SSE compliance

**Tasks**:
- Modify `ChatGPTProvider` to use `OpenAISSEParser`
- Update parser registration in `StreamingManager`
- Test with mocked SSE streams

**Files to Modify**:
- `src/providers/chatgpt/ChatGPTProvider.js`
- `src/core/streaming/StreamingManager.js`

## Phase 2: Provider Implementation (Week 3-4)

### 2.1 Implement Claude Provider
**Objective**: Full Claude streaming support

**Tasks**:
- Create `ClaudeProvider` class with sessionKey auth
- Implement conversation creation and message streaming
- Add SSE event sequence handling
- Support tool call streaming

**Files to Create**:
- `src/providers/claude/ClaudeProvider.js`
- `src/providers/claude/ClaudeAuthStore.js`

**Integration**:
- Register in `src/providers/index.js`
- Add manifest permissions for `claude.ai`

### 2.2 Implement Gemini Provider
**Objective**: Full Gemini streaming support

**Tasks**:
- Create `GeminiProvider` class with cookie + SNlM0e auth
- Implement tab management for token extraction
- Add full response parsing with incremental text emission
- Handle usage metadata and tool calls

**Files to Create**:
- `src/providers/gemini/GeminiProvider.js`
- `src/providers/gemini/GeminiAuthStore.js`

**Integration**:
- Register in `src/providers/index.js`
- Add manifest permissions for `gemini.google.com`

### 2.3 Provider Registry Updates
**Objective**: Support multiple active providers

**Tasks**:
- Update `ProviderRegistry` for concurrent providers
- Add provider switching in UI
- Implement conversation isolation per provider

**Files to Modify**:
- `src/core/providers/ProviderRegistry.js`
- `src/ui/SidePanelController.js`

## Phase 3: Advanced Features (Week 5-6)

### 3.1 Tool Call Streaming Implementation
**Objective**: Support incremental tool argument streaming

**Tasks**:
- Create `ToolCallBuffer` class for incremental JSON building
- Integrate into all SSE parsers
- Add tool call emission in chunk format
- Handle completion detection for tool calls

**Files to Create**:
- `src/core/streaming/ToolCallBuffer.js`

**Files to Modify**:
- All SSE parser classes

### 3.2 Usage Metadata Handling
**Objective**: Extract and emit usage information

**Tasks**:
- Add usage parsing to all parsers
- Standardize usage emission format
- Integrate with `StreamingManager` metrics
- Display usage in UI

**Files to Modify**:
- All SSE parser classes
- `src/core/streaming/StreamingManager.js`
- `src/ui/SidePanelController.js`

### 3.3 Error Handling and Recovery
**Objective**: Robust operation with auth expiry and network issues

**Tasks**:
- Implement token refresh logic
- Add exponential backoff for retries
- Handle rate limits and quota exceeded
- Improve error messages and user feedback

**Files to Modify**:
- All provider classes
- `src/core/streaming/StreamingManager.js`

## Phase 4: Stealth and Security (Week 7-8)

### 4.1 Content-Script Fetch Mode
**Objective**: Reduce detection risk

**Tasks**:
- Implement content-script fetch instead of background
- Add header spoofing for browser-like requests
- Test stealth improvements

**Files to Create**:
- `src/content/fetch/StealthFetch.js`

**Files to Modify**:
- All provider classes
- Manifest permissions

### 4.2 Security Hardening
**Objective**: Protect user data and comply with security best practices

**Tasks**:
- Add user consent for session access
- Implement secure token storage
- Add audit logging for auth operations
- Sanitize all user inputs

**Files to Create**:
- `src/core/security/SecurityManager.js`
- `src/core/storage/SecureStorage.js`

### 4.3 Performance Optimization
**Objective**: Handle high-volume streaming

**Tasks**:
- Implement stream multiplexing
- Add connection pooling
- Optimize chunk processing
- Add performance metrics

**Files to Modify**:
- `src/core/streaming/StreamingManager.js`

## Testing and Validation

### Unit Tests
- SSE parser correctness for each provider
- Tool call streaming scenarios
- Error recovery paths
- Auth token handling

### Integration Tests
- End-to-end streaming per provider
- Multi-provider switching
- Network failure scenarios
- Rate limit handling

### User Acceptance Testing
- Real session testing (with consent)
- Performance benchmarking
- Detection risk assessment

## Risk Mitigation

### Technical Risks
- **API Changes**: Monitor provider API updates, implement fallback parsing
- **Detection**: A/B test fetch methods, implement user warnings
- **Performance**: Add capacity limits, implement queuing

### Compliance Risks
- **ToS**: Add clear disclaimers, implement opt-in consent
- **Privacy**: Minimal data retention, secure token handling
- **Legal**: Consult legal for extension distribution

## Success Metrics

### Functional Completeness
- ✅ All providers support SSE-compliant streaming
- ✅ Tool calls stream incrementally
- ✅ Usage metadata extracted and displayed
- ✅ Error recovery works reliably

### Quality Metrics
- ✅ <100ms chunk processing latency
- ✅ >99% stream success rate
- ✅ <1% detection rate (vs baseline)
- ✅ Full test coverage

### User Experience
- ✅ Seamless provider switching
- ✅ Real-time streaming feedback
- ✅ Clear error messages
- ✅ Performance comparable to native apps

## Timeline Summary

| Phase | Duration | Deliverables | Risk Level |
|-------|----------|--------------|------------|
| SSE Foundation | 2 weeks | Core parsers, ChatGPT compliance | Low |
| Provider Implementation | 2 weeks | Claude + Gemini providers | Medium |
| Advanced Features | 2 weeks | Tool calls, usage, error handling | Medium |
| Stealth & Security | 2 weeks | Content-script mode, security hardening | High |

## Conclusion
This action plan provides a structured path to full SSE schema adherence and multi-provider support. The phased approach minimizes risk while building a robust, undetectable streaming system for AI providers in the Chrome extension.</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Streaming-Adherence-Action-Plan.md