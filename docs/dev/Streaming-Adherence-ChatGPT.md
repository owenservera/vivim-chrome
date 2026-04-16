# Streaming Adherence System - Architecture Overview

## Document Purpose
This document outlines the structural design and adherence analysis of the Chrome Extension's streaming system against documented SSE schemas for AI providers (OpenAI/ChatGPT, Claude, Gemini). It identifies gaps, architectural strengths, and recommendations for full compliance.

## Current System Architecture

### Core Components
- **StreamingManager**: Central manager for stream processing, parser registration, and lifecycle management
- **BaseProvider**: Abstract base for provider-specific implementations
- **Parsers**: Format-specific parsers (delta-encoding-v1, SSE, JSON-stream)
- **MessageBridge**: Communication layer between content scripts and UI
- **ProviderRegistry**: Registry for active providers

### Architecture Diagram
```
┌─────────────────────────────────────────────────────┐
│  Chrome Extension                                    │
│                                                      │
│  ┌──────────────┐    ┌────────────────────────────┐ │
│  │  Side Panel  │◄──►│  Background Service Worker │ │
│  │  (sidepanel  │    │  (background.js)           │ │
│  │   .html/js)  │    │  - fetch() with cookies    │ │
│  └──────────────┘    │  - bypass CORS             │ │
│                      └───────────┬────────────────┘ │
│                                  │                   │
│  ┌───────────────────────────────▼────────────────┐ │
│  │  Content Scripts (injected into site tabs)     │ │
│  │  - DOM bridge fallback                         │ │
│  │  - cookie/token extraction                     │ │
│  └────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Stream Processing Flow
1. User sends message via side panel
2. Background worker fetches with session cookies
3. Response intercepted and streamed via StreamingManager
4. Chunks parsed and emitted to UI via MessageBridge
5. UI updates incrementally

## Structural Design Assessment

### Strengths
- **Modular**: Clean separation of concerns with manager, parsers, providers
- **Extensible**: Parser registry allows adding new formats
- **Robust**: Retry logic, error handling, capacity limits
- **Interception**: Transparent request/response hooking via fetch/XHR overrides

### Weaknesses
- **Provider Coverage**: Only ChatGPT implemented; Claude/Gemini absent
- **SSE Non-Compliance**: Parsers don't adhere to standard SSE formats
- **Format Coupling**: delta-encoding-v1 is ChatGPT-specific, not reusable
- **Metadata Handling**: Limited support for usage, finish_reason, tool calls
- **Stealth Issues**: Background fetches detectable by providers

## Adherence Gaps Summary

| Provider | SSE Schema Adherence | Implementation Status | Major Gaps |
|----------|---------------------|----------------------|------------|
| ChatGPT | ❌ Non-standard delta encoding | ✅ Partial (internal format) | No SSE lines, missing fields, no tool streaming |
| Claude | ❌ Not implemented | ❌ None | All SSE features missing |
| Gemini | ❌ Not implemented | ❌ None | All SSE features missing |

## Recommendations

### Immediate Fixes
1. Implement Claude and Gemini providers
2. Replace delta-encoding-v1 with standard SSE parser
3. Add tool call streaming support
4. Extract and emit usage metadata

### Architectural Improvements
1. **SSE-First Design**: Base all parsers on SSEParser with provider-specific extensions
2. **Content-Script Fetches**: Move API calls to content scripts for better stealth
3. **Metadata Standardization**: Define common chunk format across providers
4. **Provider Abstraction**: Unify auth/token mechanisms

### Security Considerations
- Implement header spoofing for background fetches
- Add rate limiting and backoff strategies
- Monitor for detection patterns
- Consider user consent for session piggybacking

## Implementation Roadmap

### Phase 1: Core SSE Compliance
- Refactor StreamingManager to SSE-centric design
- Implement SSEParser with event type handling
- Add termination detection (DONE, connection close, message_stop)

### Phase 2: Provider Expansion
- Create ClaudeProvider with event-based SSE parsing
- Create GeminiProvider with full-response SSE parsing
- Add tool call buffers for incremental streaming

### Phase 3: Production Hardening
- Add content-script fetch mode
- Implement usage tracking and metrics
- Add comprehensive error handling and recovery

## Conclusion
The current system has a solid foundation but lacks full adherence to documented SSE schemas. The architecture is well-structured for expansion, but implementation gaps prevent proper streaming support for all providers. Prioritizing SSE compliance and provider coverage will enable robust, undetectable AI streaming in the Chrome extension.</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Streaming-Adherence-System-Architecture.md