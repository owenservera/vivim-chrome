# ChatGPT (OpenAI) 2026 Implementation Design

## 1. Overview
As of April 2026, the ChatGPT web application utilizes a highly secure, agent-optimized API based on the **Open Responses** standard. It employs a multi-layered "Sentinel" security system to prevent unauthorized access and utilizes `delta-encoding-v1` for streaming.

## 2. API Endpoints
- **Primary Conversation:** `POST https://chatgpt.com/backend-api/conversation`
- **Security Requirements:** `POST https://chatgpt.com/backend-api/sentinel/chat-requirements`
- **Preparation:** `POST https://chatgpt.com/backend-api/conversation/prepare`

## 3. Security Protocol (Sentinel)
Requests to the conversation endpoint will fail without three specific tokens:

### A. Sentinel Requirements
Fetch the PoW seed and Turnstile configuration:
```json
// POST /backend-api/sentinel/chat-requirements
{
  "token": "base_session_token"
}
```

### B. Proof-of-Work (PoW)
The requirements response contains a `seed` and `difficulty`. The client must solve the challenge:
- **Algorithm:** SHA-3 (Keccak) or Argon2 (depending on 2026 rotation).
- **Output:** `openai-sentinel-proof-token`.

### C. Turnstile & Conduit
- **Turnstile:** Solve the Cloudflare challenge to get `openai-sentinel-turnstile-token`.
- **Conduit:** Initialize the thread at `/prepare` to get `x-conduit-token`.

## 4. Request Payload (JSON)
```json
{
  "action": "next",
  "messages": [
    {
      "id": "uuid-v4",
      "author": { "role": "user" },
      "content": { "content_type": "text", "parts": ["Message content"] },
      "metadata": {}
    }
  ],
  "parent_message_id": "uuid-v4",
  "model": "gpt-5.4-thinking",
  "timezone_offset_min": -480,
  "history_and_training_disabled": false,
  "arkose_token": "...",
  "conversation_mode": { "kind": "primary_assistant" }
}
```

## 5. Streaming Format: `delta-encoding-v1`
The stream utilizes structured semantic events.

### Event Sequence
1. `event: response.content_part.added`: Start of output block.
2. `event: response.output_text.delta`: Incremental text chunks.
3. `event: response.output_text.done`: End of text block.
4. `event: response.completed`: Full message object and usage statistics.

### Example Chunk
```sse
event: response.output_text.delta
data: {"delta": "Hello", "response_id": "resp_123"}
```

## 6. Implementation Notes
- **Interception:** Monitor `/backend-api/conversation`.
- **Parser:** Use `OpenAIResponsesParser`.
- **State Management:** Store `parent_message_id` and `conversation_id` for thread continuity.
