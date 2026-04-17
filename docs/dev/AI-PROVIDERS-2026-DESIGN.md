# 2026 AI Provider Design & Documentation Index

This document summarizes the internal API structures and streaming protocols for ChatGPT, Claude, and Gemini as of April 2026.

## 1. ChatGPT (OpenAI)
### Internal API: `https://chatgpt.com/backend-api/conversation`
*   **Format:** `delta-encoding-v1` (Open Responses Standard)
*   **Streaming Events:**
    *   `response.output_text.delta`: Incremental text.
    *   `response.output_text.done`: Block completion.
    *   `response.completed`: Final metadata & usage.
*   **Security (Sentinel System):**
    *   Requires `openai-sentinel-chat-requirements-token` from `/sentinel/chat-requirements`.
    *   Requires `openai-sentinel-proof-token` (PoW solution).
    *   Requires `x-conduit-token` (Session-based).

## 2. Claude (Anthropic)
### Internal API: `https://claude.ai/api/append_message`
*   **Format:** `claude-sse`
*   **Extended Thinking (Reasoning):**
    *   `thinking_delta`: Streams reasoning text (if `display: "summarized"`).
    *   `signature_delta`: **CRITICAL.** A cryptographic signature of the thinking state. Must be sent back in the next turn for state continuity.
*   **Headers:**
    *   `x-anthropic-client-sha`: Client integrity check.
    *   `Cookie: sessionKey=...`: Primary auth mechanism.

## 3. Gemini (Google)
### Internal API: `streamGenerateContent`
*   **Format:** `gemini-sse` (Incremental)
*   **Deltas:** By 2026, chunks contain only the NEW text in `candidates[0].content.parts[0].text`.
*   **Structured Outputs:** When in JSON mode, deltas are partial strings that must be concatenated.
*   **Authentication:**
    *   `__Secure-1PSID` and `__Secure-1PSIDTS` cookies.
    *   `SNlM0e` token in the request body/headers for state synchronization.

## 4. Implementation Checklist for 2026 Standards
- [ ] Migrate `OpenAISSEParser` to `OpenAIResponsesParser` (delta-encoding-v1).
- [ ] Implement `signature_delta` capture in `ClaudeSSEParser`.
- [ ] Refactor `GeminiSSEParser` to remove redundant diffing logic and handle raw deltas.
- [ ] Update `ChatGPTProvider` to intercept Sentinel requirements if self-initiated requests are needed.
