# Claude (Anthropic) 2026 Implementation Design

## 1. Overview
Claude.ai (2026) emphasizes "Extended Thinking" for complex reasoning. The internal API supports adaptive reasoning budgets and requires cryptographic signatures to maintain state in multi-turn conversations.

## 2. API Endpoint
- **URL:** `POST https://claude.ai/api/append_message`
- **Streaming Header:** `Accept: text/event-stream`

## 3. Request Payload (JSON)
```json
{
  "prompt": "User message text",
  "model": "claude-opus-4-7",
  "conversation_uuid": "uuid-v4",
  "organization_uuid": "uuid-v4",
  "attachments": [],
  "thinking": {
    "type": "adaptive",
    "budget_tokens": 4096,
    "display": "summarized" 
  },
  "rendering_mode": "artifacts"
}
```

## 4. Streaming Format: `claude-sse`
The stream follows a strict block-based lifecycle.

### Event Lifecycle
1. `message_start`: Metadata including message ID and role.
2. `content_block_start` (type: `thinking`): Initialization of reasoning block.
3. `content_block_delta` (type: `thinking_delta`): Reasoning text (deltas).
4. **`content_block_delta` (type: `signature_delta`)**: **CRITICAL.** Cryptographic signature of the thinking state.
5. `content_block_stop`: Closes reasoning block.
6. `content_block_start` (type: `text`): Initialization of the actual response.
7. `content_block_delta` (type: `text_delta`): Final answer chunks.
8. `message_stop`: Final usage and stop reason.

## 5. State Continuity (Multi-turn)
To maintain the integrity of "Thinking" across multiple turns:
- **Requirement:** The `signature_delta` from turn $N$ must be stored and passed back in the `messages` history for turn $N+1$.
- **Failure Case:** If the signature is omitted, the model loses its reasoning context, potentially leading to inconsistent behavior.

## 6. Security Headers
- `x-anthropic-client-sha`: A hash of the client environment/application.
- `Cookie`: Must contain `sessionKey` for authenticated sessions.

## 7. Implementation Notes
- **Interception:** Monitor `/api/append_message`.
- **Parser:** Use `ClaudeSSEParser` with explicit support for `thinking_delta` and `signature_delta`.
- **UI:** Implement a collapsible "Thinking" UI component to display reasoning without cluttering the main conversation.
