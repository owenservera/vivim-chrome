# OpenAI Full Streaming Protocol Reference
> Complete technical reference for **all** streaming APIs: Chat Completions, Responses API, Assistants API, and Realtime API.  
> Researched from live OpenAI documentation — April 2025.

---

## Table of Contents

1. [API Landscape Overview](#1-api-landscape-overview)
2. [Chat Completions Streaming (Classic)](#2-chat-completions-streaming-classic)
   - 2.1 [Create a Completion (stream)](#21-create-a-completion-stream)
   - 2.2 [List Stored Completions](#22-list-stored-completions)
   - 2.3 [Get a Stored Completion](#23-get-a-stored-completion)
   - 2.4 [Delete a Stored Completion](#24-delete-a-stored-completion)
   - 2.5 [Update a Stored Completion](#25-update-a-stored-completion)
   - 2.6 [List Completion Messages](#26-list-completion-messages)
   - 2.7 [Delta Object & Accumulation](#27-delta-object--accumulation)
   - 2.8 [Finish Reasons](#28-finish-reasons)
   - 2.9 [Stream Lifecycle](#29-stream-lifecycle)
3. [Responses API Streaming (Recommended)](#3-responses-api-streaming-recommended)
   - 3.1 [Create a Response (stream)](#31-create-a-response-stream)
   - 3.2 [Get a Stored Response](#32-get-a-stored-response)
   - 3.3 [Delete a Response](#33-delete-a-response)
   - 3.4 [List Input Items](#34-list-input-items)
   - 3.5 [Cancel a Response](#35-cancel-a-response)
   - 3.6 [Compact Context](#36-compact-context)
   - 3.7 [Complete SSE Event Catalog (Responses API)](#37-complete-sse-event-catalog-responses-api)
4. [Conversations API (Persistent State)](#4-conversations-api-persistent-state)
   - 4.1 [Create Conversation](#41-create-conversation)
   - 4.2 [List Conversations](#42-list-conversations)
   - 4.3 [Get Conversation](#43-get-conversation)
   - 4.4 [Delete Conversation](#44-delete-conversation)
   - 4.5 [List Conversation Items](#45-list-conversation-items)
   - 4.6 [Get Conversation Item](#46-get-conversation-item)
   - 4.7 [Delete Conversation Item](#47-delete-conversation-item)
5. [Assistants API Streaming (Legacy → Deprecated 2026)](#5-assistants-api-streaming-legacy--deprecated-2026)
   - 5.1 [Assistants CRUD](#51-assistants-crud)
   - 5.2 [Threads CRUD](#52-threads-crud)
   - 5.3 [Messages CRUD](#53-messages-crud)
   - 5.4 [Runs & Streaming](#54-runs--streaming)
   - 5.5 [Run Steps](#55-run-steps)
   - 5.6 [Assistants SSE Event Catalog](#56-assistants-sse-event-catalog)
6. [Realtime API Streaming (WebSocket/WebRTC)](#6-realtime-api-streaming-websocketwebrtc)
   - 6.1 [Session Management](#61-session-management)
   - 6.2 [Client Events](#62-client-events)
   - 6.3 [Server Events](#63-server-events)
7. [Shared Infrastructure](#7-shared-infrastructure)
   - 7.1 [Files API](#71-files-api)
   - 7.2 [Uploads API (Multipart)](#72-uploads-api-multipart)
   - 7.3 [Vector Stores API](#73-vector-stores-api)
   - 7.4 [Embeddings](#74-embeddings)
   - 7.5 [Moderations](#75-moderations)
   - 7.6 [Models](#76-models)
   - 7.7 [Images (DALL·E / GPT-Image)](#77-images-dalle--gpt-image)
   - 7.8 [Audio (TTS & Whisper)](#78-audio-tts--whisper)
8. [SSE Transport Layer (All APIs)](#8-sse-transport-layer-all-apis)
9. [Complete Request Parameter Reference](#9-complete-request-parameter-reference)
10. [Error Handling](#10-error-handling)

---

## 1. API Landscape Overview

OpenAI currently maintains **four distinct streaming APIs**, each designed for different use cases:

| API | Endpoint Base | Transport | State Management | Status |
|---|---|---|---|---|
| **Chat Completions** | `POST /v1/chat/completions` | HTTP/SSE | Manual (client manages messages) | Stable, "legacy" |
| **Responses API** | `POST /v1/responses` | HTTP/SSE | Auto via `previous_response_id` or Conversations API | **Recommended (current)** |
| **Assistants API** | `POST /v1/threads/*/runs` | HTTP/SSE | Thread objects (server-managed) | **Deprecated Aug 2026** |
| **Realtime API** | `wss://api.openai.com/v1/realtime` | WebSocket | Session object (persistent) | Beta |

### 1.1 Migration Path

```
Chat Completions  ──────────────────► Responses API
Assistants API    ──► Conversations API + Responses API
Realtime (audio)  ──────────────────► Realtime API (unchanged)
```

OpenAI officially recommends new projects use the **Responses API**. The Assistants API will be removed from the API in **August 2026**.

---

## 2. Chat Completions Streaming (Classic)

### 2.1 Create a Completion (stream)

```
POST /v1/chat/completions
```

The foundational streaming endpoint. Set `"stream": true` to receive SSE deltas.

**Key Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | string | — | Model ID (e.g., `gpt-4o`, `gpt-4o-mini`, `o3`) |
| `messages` | array | — | Array of `{role, content}` objects |
| `stream` | boolean | `false` | Enable SSE streaming |
| `stream_options.include_usage` | boolean | `false` | Emit token usage in final chunk |
| `temperature` | number | 1.0 | Sampling temperature 0–2 |
| `top_p` | number | 1.0 | Nucleus sampling top-p |
| `n` | integer | 1 | Number of completions to generate |
| `max_completion_tokens` | integer | null | Max output tokens (replaces deprecated `max_tokens`) |
| `stop` | string/array | null | Up to 4 stop sequences |
| `presence_penalty` | number | 0 | –2.0 to 2.0, penalizes new topics |
| `frequency_penalty` | number | 0 | –2.0 to 2.0, penalizes repetition |
| `logit_bias` | object | null | Token ID → bias (–100 to 100) |
| `logprobs` | boolean | false | Return log probabilities |
| `top_logprobs` | integer | null | 0–20, number of logprobs per token |
| `seed` | integer | null | Deterministic sampling seed |
| `tools` | array | null | Up to 128 function tool definitions |
| `tool_choice` | string/object | `"auto"` | `none`, `auto`, `required`, or specific tool |
| `parallel_tool_calls` | boolean | `true` | Allow parallel tool invocations |
| `response_format` | object | null | `{"type": "text"}`, `json_object`, or `json_schema` |
| `reasoning_effort` | string | null | `none`, `low`, `medium`, `high` (o-series models) |
| `service_tier` | string | `"default"` | `"default"` or `"flex"` (priority routing) |
| `store` | boolean | `true` | Store completion for 30 days |
| `metadata` | object | null | Key-value pairs (up to 16) |
| `user` | string | null | End-user ID for abuse monitoring |

**Message Object Types:**

```jsonc
// System message
{ "role": "system",    "content": "You are a helpful assistant." }
{ "role": "developer", "content": "..." }  // Alias for system in newer models

// User message (text)
{ "role": "user", "content": "Hello!" }

// User message (multimodal)
{
  "role": "user",
  "content": [
    { "type": "text", "text": "What's in this image?" },
    { "type": "image_url", "image_url": { "url": "https://...", "detail": "auto" } }
  ]
}

// Assistant message
{ "role": "assistant", "content": "Hello! How can I help?" }

// Tool result message
{
  "role": "tool",
  "content": "{\"temperature\": 72}",
  "tool_call_id": "call_abc123"
}
```

**Streaming Response Chunks:**

```jsonc
// Chunk 1: Role announcement
{
  "id": "chatcmpl-abc",
  "object": "chat.completion.chunk",
  "created": 1710000000,
  "model": "gpt-4o-2024-05-13",
  "system_fingerprint": "fp_abc123",
  "choices": [{"index": 0, "delta": {"role": "assistant", "content": ""}, "finish_reason": null}]
}

// Chunks 2–N: Content tokens
{
  "choices": [{"index": 0, "delta": {"content": "Hello"}, "finish_reason": null}]
}

// Final chunk: finish_reason set
{
  "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]
}

// Usage chunk (only if stream_options.include_usage = true)
{
  "choices": [],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 42,
    "total_tokens": 57,
    "prompt_tokens_details": { "cached_tokens": 0, "audio_tokens": 0 },
    "completion_tokens_details": {
      "reasoning_tokens": 0,
      "audio_tokens": 0,
      "accepted_prediction_tokens": 0,
      "rejected_prediction_tokens": 0
    }
  }
}

// Terminal sentinel (always last)
data: [DONE]
```

---

### 2.2 List Stored Completions

```
GET /v1/chat/completions
```

Returns a paginated list of stored chat completions (requires `store: true` when creating).

**Query Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | string | — | Filter by model |
| `after` | string | — | Cursor for pagination (completion ID) |
| `limit` | integer | 20 | 1–100 |
| `order` | string | `"desc"` | `asc` or `desc` by `created_at` |
| `metadata` | object | — | Filter by metadata key-value pairs |

---

### 2.3 Get a Stored Completion

```
GET /v1/chat/completions/{completion_id}
```

Retrieves a single stored completion by its ID.

---

### 2.4 Delete a Stored Completion

```
DELETE /v1/chat/completions/{completion_id}
```

Permanently deletes a stored completion.

---

### 2.5 Update a Stored Completion

```
POST /v1/chat/completions/{completion_id}
```

Update metadata on a stored completion.

```json
{ "metadata": { "label": "reviewed", "session": "sess_001" } }
```

---

### 2.6 List Completion Messages

```
GET /v1/chat/completions/{completion_id}/messages
```

Returns the individual messages of a stored completion.

---

### 2.7 Delta Object & Accumulation

The `delta` is the core of Chat Completions streaming. It is **sparse** — only changed fields are present:

```typescript
interface Delta {
  role?:          "assistant";
  content?:       string | null;        // Text token(s) — concatenate
  tool_calls?:    ToolCallDelta[];      // Tool invocations — accumulate by index
  function_call?: FunctionCallDelta;    // LEGACY — deprecated
  refusal?:       string | null;        // Safety refusal text — concatenate
}

interface ToolCallDelta {
  index:     number;        // Route by this — never by position in array
  id?:       string;        // Present only on first delta for this index
  type?:     "function";   // Present only on first delta for this index
  function?: {
    name?:      string;     // Append — may arrive in parts
    arguments?: string;     // Append — partial JSON until stream ends
  };
}
```

**Accumulation rules:**

```typescript
// Initialize before stream starts
const acc = { role: "assistant", content: "", tool_calls: [], finish_reason: null };

// Per-chunk application
if (delta.role)    acc.role = delta.role;
if (delta.content != null) acc.content += delta.content;
if (delta.refusal != null) acc.refusal = (acc.refusal ?? "") + delta.refusal;
if (delta.tool_calls) {
  for (const tc of delta.tool_calls) {
    if (!acc.tool_calls[tc.index]) acc.tool_calls[tc.index] = { id:"", type:"function", function:{name:"", arguments:""} };
    const slot = acc.tool_calls[tc.index];
    if (tc.id)                  slot.id = tc.id;
    if (tc.function?.name)      slot.function.name += tc.function.name;
    if (tc.function?.arguments) slot.function.arguments += tc.function.arguments;
  }
}
if (choice.finish_reason) acc.finish_reason = choice.finish_reason;
```

---

### 2.8 Finish Reasons

| Value | Trigger | Notes |
|---|---|---|
| `null` | Non-final chunk | Stream still in progress |
| `"stop"` | Natural completion | Model reached a natural stopping point |
| `"length"` | Token limit hit | `max_completion_tokens` was reached; response truncated |
| `"tool_calls"` | Tool invoked | One or more `tool_calls` are present in accumulator |
| `"function_call"` | Legacy function | Deprecated `function_call` delta was populated |
| `"content_filter"` | Safety policy | Content was blocked; may have `refusal` text |

---

### 2.9 Stream Lifecycle

```
IDLE → [POST with stream:true] → CONNECTING → ROLE_RECEIVED → STREAMING → FINISHING → DONE
                                                                    ↓
                                                              TOOL_CALLING
```

Always initialize your accumulator **before** reading the first byte. Check for `[DONE]` **before** attempting `JSON.parse`.

---

## 3. Responses API Streaming (Recommended)

The Responses API is OpenAI's current recommended interface. Unlike Chat Completions, it:

- Emits **semantic, named events** (not just bare deltas)
- Supports **server-side conversation chaining** via `previous_response_id`
- Has **built-in tools** (web search, file search, code interpreter, MCP)
- Supports **reasoning summaries** for o-series models
- Stores responses by default for 30 days

### 3.1 Create a Response (stream)

```
POST /v1/responses
```

**Key Parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | string | — | Model ID |
| `input` | string or array | — | Text or array of input content items |
| `stream` | boolean | `false` | Enable SSE streaming |
| `instructions` | string | null | System-level instructions (like a system message) |
| `previous_response_id` | string | null | Chain to a prior response for conversation state |
| `store` | boolean | `true` | Store response for 30 days |
| `reasoning` | object | null | `{ "effort": "low"|"medium"|"high", "summary": "auto"|"concise"|"detailed" }` |
| `tools` | array | null | Built-in or function tools |
| `tool_choice` | string/object | `"auto"` | `none`, `auto`, `required`, or specific |
| `parallel_tool_calls` | boolean | `true` | Allow parallel tool calls |
| `response_format` | object | null | Text or JSON schema output format |
| `temperature` | number | 1.0 | Sampling temperature |
| `top_p` | number | 1.0 | Nucleus sampling |
| `max_output_tokens` | integer | null | Max output tokens |
| `truncation` | string | `"disabled"` | `"auto"` or `"disabled"` |
| `metadata` | object | null | Up to 16 key-value pairs |
| `user` | string | null | End-user ID |
| `include` | array | null | Additional fields to include: `"file_search_call.results"`, `"message.input_image.image_url"`, `"computer_call_output.output.image_url"` |
| `conversation_id` | string | null | Attach to a Conversations API conversation |

**Built-in Tool Definitions:**

```jsonc
// Web Search
{ "type": "web_search" }
// or with options
{
  "type": "web_search_2025_08_26",
  "search_context_size": "medium",   // "low", "medium", "high"
  "user_location": {
    "type": "approximate",
    "city": "San Francisco",
    "country": "US",
    "region": "California",
    "timezone": "America/Los_Angeles"
  },
  "allowed_domains": ["example.com"],
  "blocked_domains": []
}

// File Search
{
  "type": "file_search",
  "vector_store_ids": ["vs_abc123"],
  "max_num_results": 20,
  "ranking_options": { "score_threshold": 0.5 },
  "filters": { "type": "eq", "key": "author", "value": "Alice" }
}

// Code Interpreter
{ "type": "code_interpreter", "container": { "type": "auto" } }

// Computer Use (Operator)
{ "type": "computer_use_preview", "display_width": 1024, "display_height": 768 }

// MCP Server
{
  "type": "mcp",
  "server_label": "my-server",
  "server_url": "https://mcp.example.com/sse",
  "allowed_tools": ["tool_a", "tool_b"],
  "headers": { "Authorization": "Bearer ..." },
  "require_approval": "never"
}

// Function (custom tool)
{
  "type": "function",
  "name": "get_weather",
  "description": "Get current weather",
  "parameters": { "type": "object", "properties": { "location": {"type":"string"} } },
  "strict": true
}
```

---

### 3.2 Get a Stored Response

```
GET /v1/responses/{response_id}
```

Retrieve a stored response. Returns the full `Response` object with all output items.

Query: `include` — additional fields to embed in the response.

---

### 3.3 Delete a Response

```
DELETE /v1/responses/{response_id}
```

Permanently delete a stored response. Returns `{"object": "response.deleted", "id": "...", "deleted": true}`.

---

### 3.4 List Input Items

```
GET /v1/responses/{response_id}/input_items
```

Returns the input items that were sent with a stored response.

**Query Parameters:** `after`, `before`, `limit` (1–100), `order` (`asc`/`desc`), `include`

---

### 3.5 Cancel a Response

```
POST /v1/responses/{response_id}/cancel
```

Cancels an in-progress response. Returns the `Response` object in its current (cancelled) state.

---

### 3.6 Compact Context

```
POST /v1/responses/compact
```

Shrinks a conversation context window while preserving the model's understanding. Stateless: send the full window, receive a compacted window to use in the next response.

- All prior **user messages** are kept verbatim.
- Prior assistant messages, tool calls/results, and reasoning are replaced with a single **encrypted compaction item**.
- Compatible with Zero Data Retention (ZDR).

```json
{
  "input": [/* full conversation items */],
  "model": "gpt-4o",
  "instructions": "Optional system instructions"
}
```

---

### 3.7 Complete SSE Event Catalog (Responses API)

All events follow the SSE format: `data: {json}\n\n`. Each event has a `type` field and a `sequence_number`.

#### **Lifecycle Events** (emitted once per response)

| Event Type | Description |
|---|---|
| `response.created` | Response object created; `status: "in_progress"` |
| `response.queued` | Response is queued (async or high-load scenarios); `status: "queued"` |
| `response.in_progress` | Generation has started |
| `response.completed` | Response successfully completed; full response object attached |
| `response.failed` | Response failed; error details in response object |
| `response.incomplete` | Response stopped before completion (e.g., `max_output_tokens`) |
| `error` | An error occurred; `{ "code": "...", "message": "..." }` |

```jsonc
// response.created example
{
  "type": "response.created",
  "response": {
    "id": "resp_abc123",
    "object": "response",
    "created_at": 1740855869,
    "status": "in_progress",
    "model": "gpt-4o-2024-05-13",
    "output": [],
    "usage": null
  },
  "sequence_number": 1
}

// response.incomplete example
{
  "type": "response.incomplete",
  "response": {
    "id": "resp_abc123",
    "status": "incomplete",
    "incomplete_details": { "reason": "max_tokens" }
    // ...
  },
  "sequence_number": 42
}
```

#### **Output Item Events** (emitted per output item — message, tool call, reasoning, etc.)

| Event Type | Description |
|---|---|
| `response.output_item.added` | New output item started (message, tool call, reasoning, etc.) |
| `response.output_item.done` | Output item fully completed |
| `response.content_part.added` | New content part started within an output item |
| `response.content_part.done` | Content part completed |

```jsonc
// response.output_item.added example
{
  "type": "response.output_item.added",
  "output_index": 0,
  "item": {
    "id": "msg_xyz",
    "type": "message",
    "status": "in_progress",
    "role": "assistant",
    "content": []
  },
  "sequence_number": 2
}
```

#### **Text Streaming Events**

| Event Type | Description |
|---|---|
| `response.output_text.delta` | Partial text delta — the streaming token(s) |
| `response.output_text.done` | Complete final text for an output item |
| `response.output_text.annotation.added` | Annotation (citation, file reference) added to output text |

```jsonc
// response.output_text.delta example
{
  "type": "response.output_text.delta",
  "item_id": "msg_xyz",
  "output_index": 0,
  "content_index": 0,
  "delta": "Hello",
  "sequence_number": 5
}

// response.output_text.done example
{
  "type": "response.output_text.done",
  "item_id": "msg_xyz",
  "output_index": 0,
  "content_index": 0,
  "text": "Hello, how can I help you today?",
  "sequence_number": 12
}
```

#### **Refusal Events**

| Event Type | Description |
|---|---|
| `response.refusal.delta` | Partial refusal text |
| `response.refusal.done` | Complete refusal text |

#### **Function Call Events**

| Event Type | Description |
|---|---|
| `response.function_call_arguments.delta` | Partial JSON arguments for a function call |
| `response.function_call_arguments.done` | Complete JSON arguments — safe to parse now |

```jsonc
{
  "type": "response.function_call_arguments.delta",
  "item_id": "fc_abc",
  "output_index": 0,
  "delta": "{\"loc",
  "sequence_number": 8
}
{
  "type": "response.function_call_arguments.done",
  "item_id": "fc_abc",
  "output_index": 0,
  "arguments": "{\"location\": \"London\"}",
  "sequence_number": 11
}
```

#### **File Search Events**

| Event Type | Description |
|---|---|
| `response.file_search_call.in_progress` | File search tool call started |
| `response.file_search_call.searching` | Actively searching vector store |
| `response.file_search_call.completed` | Search complete; results available |

#### **Web Search Events**

| Event Type | Description |
|---|---|
| `response.web_search_call.in_progress` | Web search started |
| `response.web_search_call.searching` | Actively performing web search |
| `response.web_search_call.completed` | Web search complete |

#### **Reasoning Events** (o-series models only)

| Event Type | Description |
|---|---|
| `response.reasoning_summary_part.added` | New reasoning summary part started |
| `response.reasoning_summary_part.done` | Reasoning summary part complete |
| `response.reasoning_summary_text.delta` | Partial reasoning summary text |
| `response.reasoning_summary_text.done` | Complete reasoning summary text |
| `response.reasoning_text.delta` | Partial raw reasoning text (if enabled) |
| `response.reasoning_text.done` | Complete raw reasoning text |

```jsonc
{
  "type": "response.reasoning_summary_text.done",
  "item_id": "rs_abc",
  "output_index": 0,
  "summary_index": 0,
  "text": "**Responding to greeting**\n\nThe user said 'Hello'...",
  "sequence_number": 4
}
```

#### **Code Interpreter Events**

| Event Type | Description |
|---|---|
| `response.code_interpreter_call.in_progress` | Code interpreter call started |
| `response.code_interpreter_call.interpreting` | Code is executing |
| `response.code_interpreter_call.completed` | Execution complete |
| `response.code_interpreter_call_code.delta` | Partial code being written |
| `response.code_interpreter_call_code.done` | Complete code |

#### **Image Generation Events**

| Event Type | Description |
|---|---|
| `response.image_generation_call.in_progress` | Image generation started |
| `response.image_generation_call.generating` | Image is being generated |
| `response.image_generation_call.partial_image` | Partial base64 image data |
| `response.image_generation_call.completed` | Image generation complete |

#### **MCP (Model Context Protocol) Events**

| Event Type | Description |
|---|---|
| `response.mcp_list_tools.in_progress` | Listing available tools from MCP server |
| `response.mcp_list_tools.completed` | Tool list retrieved |
| `response.mcp_list_tools.failed` | Failed to retrieve tools |
| `response.mcp_call.in_progress` | Calling an MCP tool |
| `response.mcp_call.completed` | MCP tool call complete |
| `response.mcp_call.failed` | MCP tool call failed |
| `response.mcp_call_arguments.delta` | Partial MCP tool arguments |
| `response.mcp_call_arguments.done` | Complete MCP tool arguments |

#### **Custom Tool Events**

| Event Type | Description |
|---|---|
| `response.custom_tool_call_input.delta` | Partial input to a custom tool |
| `response.custom_tool_call_input.done` | Complete input to a custom tool |

```jsonc
{
  "type": "response.custom_tool_call_input.delta",
  "output_index": 0,
  "item_id": "ctc_abc123",
  "delta": "partial input text",
  "sequence_number": 7
}
```

#### **Output Text Annotation Events**

| Event Type | Description |
|---|---|
| `response.output_text.annotation.added` | An annotation (URL citation, file citation, etc.) added |

#### **Complete Responses API Event Type Union (TypeScript)**

```typescript
type ResponsesAPIStreamingEvent =
  // Lifecycle
  | ResponseCreatedEvent
  | ResponseQueuedEvent
  | ResponseInProgressEvent
  | ResponseCompletedEvent
  | ResponseFailedEvent
  | ResponseIncompleteEvent
  // Output items
  | ResponseOutputItemAddedEvent
  | ResponseOutputItemDoneEvent
  | ResponseContentPartAddedEvent
  | ResponseContentPartDoneEvent
  // Text
  | ResponseOutputTextDeltaEvent
  | ResponseOutputTextDoneEvent
  | ResponseOutputTextAnnotationAddedEvent
  // Refusal
  | ResponseRefusalDeltaEvent
  | ResponseRefusalDoneEvent
  // Function calls
  | ResponseFunctionCallArgumentsDeltaEvent
  | ResponseFunctionCallArgumentsDoneEvent
  // File search
  | ResponseFileSearchCallInProgressEvent
  | ResponseFileSearchCallSearchingEvent
  | ResponseFileSearchCallCompletedEvent
  // Web search
  | ResponseWebSearchCallInProgressEvent
  | ResponseWebSearchCallSearchingEvent
  | ResponseWebSearchCallCompletedEvent
  // Reasoning (o-series)
  | ResponseReasoningSummaryPartAddedEvent
  | ResponseReasoningSummaryPartDoneEvent
  | ResponseReasoningSummaryTextDeltaEvent
  | ResponseReasoningSummaryTextDoneEvent
  | ResponseReasoningTextDeltaEvent
  | ResponseReasoningTextDoneEvent
  // Code interpreter
  | ResponseCodeInterpreterCallInProgressEvent
  | ResponseCodeInterpreterCallInterpretingEvent
  | ResponseCodeInterpreterCallCompletedEvent
  | ResponseCodeInterpreterCallCodeDeltaEvent
  | ResponseCodeInterpreterCallCodeDoneEvent
  // Image generation
  | ResponseImageGenerationCallInProgressEvent
  | ResponseImageGenerationCallGeneratingEvent
  | ResponseImageGenerationCallPartialImageEvent
  | ResponseImageGenerationCallCompletedEvent
  // MCP
  | ResponseMcpListToolsInProgressEvent
  | ResponseMcpListToolsCompletedEvent
  | ResponseMcpListToolsFailedEvent
  | ResponseMcpCallInProgressEvent
  | ResponseMcpCallCompletedEvent
  | ResponseMcpCallFailedEvent
  | ResponseMcpCallArgumentsDeltaEvent
  | ResponseMcpCallArgumentsDoneEvent
  // Custom tools
  | ResponseCustomToolCallInputDeltaEvent
  | ResponseCustomToolCallInputDoneEvent
  // Error
  | ErrorEvent;
```

---

## 4. Conversations API (Persistent State)

The Conversations API provides **server-managed conversation state** as a replacement for Assistants API Threads. Use it with the Responses API via `conversation_id`.

### 4.1 Create Conversation

```
POST /v1/conversations
```

```json
{
  "initial_items": [
    { "role": "user", "content": "Hello!" }
  ],
  "metadata": { "user_id": "u_123" }
}
```

Returns a `Conversation` object with a `conversation_id`. Accepts up to **20 initial items**.

---

### 4.2 List Conversations

```
GET /v1/conversations
```

**Query:** `after`, `before`, `limit` (1–100), `order`, `metadata`

---

### 4.3 Get Conversation

```
GET /v1/conversations/{conversation_id}
```

---

### 4.4 Delete Conversation

```
DELETE /v1/conversations/{conversation_id}
```

---

### 4.5 List Conversation Items

```
GET /v1/conversations/{conversation_id}/items
```

Returns all items in the conversation (user messages, assistant messages, tool calls, tool results, etc.).

**Query:** `after`, `before`, `limit`, `order`

---

### 4.6 Get Conversation Item

```
GET /v1/conversations/{conversation_id}/items/{item_id}
```

---

### 4.7 Delete Conversation Item

```
DELETE /v1/conversations/{conversation_id}/items/{item_id}
```

**Using conversations with the Responses API:**

```json
{
  "model": "gpt-4o",
  "input": "What was my last question?",
  "stream": true,
  "conversation_id": "conv_abc123"
}
```

The Responses API automatically prepends prior conversation items when `conversation_id` is provided.

---

## 5. Assistants API Streaming (Legacy → Deprecated 2026)

> ⚠️ **Deprecated:** The Assistants API is deprecated as of August 26, 2025, and will be **removed from the API on August 26, 2026**. Migrate to the Responses API + Conversations API.

All Assistants API requests require the header: `OpenAI-Beta: assistants=v2`

### 5.1 Assistants CRUD

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/assistants` | Create an assistant |
| `GET` | `/v1/assistants` | List assistants |
| `GET` | `/v1/assistants/{id}` | Get an assistant |
| `POST` | `/v1/assistants/{id}` | Modify an assistant |
| `DELETE` | `/v1/assistants/{id}` | Delete an assistant |

**Assistant Object:**
```json
{
  "id": "asst_abc",
  "object": "assistant",
  "name": "My Assistant",
  "model": "gpt-4o",
  "instructions": "You are a helpful assistant.",
  "tools": [{"type": "code_interpreter"}, {"type": "file_search"}],
  "tool_resources": {
    "code_interpreter": { "file_ids": ["file_abc"] },
    "file_search": { "vector_store_ids": ["vs_abc"] }
  },
  "metadata": {},
  "temperature": 1.0,
  "top_p": 1.0,
  "response_format": "auto"
}
```

---

### 5.2 Threads CRUD

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/threads` | Create a thread (optionally with initial messages) |
| `GET` | `/v1/threads/{id}` | Get a thread |
| `POST` | `/v1/threads/{id}` | Modify a thread |
| `DELETE` | `/v1/threads/{id}` | Delete a thread |

Thread limit: **100,000 messages per thread**. Threads auto-truncate when the context window is exceeded.

---

### 5.3 Messages CRUD

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/threads/{tid}/messages` | Create a message in a thread |
| `GET` | `/v1/threads/{tid}/messages` | List messages (paginated) |
| `GET` | `/v1/threads/{tid}/messages/{mid}` | Get a message |
| `POST` | `/v1/threads/{tid}/messages/{mid}` | Modify a message (metadata only) |
| `DELETE` | `/v1/threads/{tid}/messages/{mid}` | Delete a message |

**Message roles:** `user`, `assistant`
**Content types:** `text`, `image_file`, `image_url`

---

### 5.4 Runs & Streaming

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/threads/{tid}/runs` | Create a run (supports `stream: true`) |
| `POST` | `/v1/threads/runs` | Create thread + run simultaneously |
| `GET` | `/v1/threads/{tid}/runs` | List runs |
| `GET` | `/v1/threads/{tid}/runs/{rid}` | Get a run |
| `POST` | `/v1/threads/{tid}/runs/{rid}` | Modify a run |
| `POST` | `/v1/threads/{tid}/runs/{rid}/cancel` | Cancel an in-progress run |
| `POST` | `/v1/threads/{tid}/runs/{rid}/submit_tool_outputs` | Submit tool results (supports `stream: true`) |

**Run statuses:** `queued` → `in_progress` → (`requires_action`) → `completed` / `failed` / `cancelled` / `expired` / `incomplete`

---

### 5.5 Run Steps

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/threads/{tid}/runs/{rid}/steps` | List run steps |
| `GET` | `/v1/threads/{tid}/runs/{rid}/steps/{sid}` | Get a run step |

**Step types:** `message_creation`, `tool_calls`
**Tool call types:** `code_interpreter`, `file_search`, `function`

---

### 5.6 Assistants SSE Event Catalog

> These events use `event:` field (unlike Responses API which only uses `data:`).

```
event: {event_type}
data: {json_object}
```

| SSE Event | Description |
|---|---|
| `thread.created` | A new thread was created |
| `thread.run.created` | A run was created |
| `thread.run.queued` | Run is queued |
| `thread.run.in_progress` | Run started executing |
| `thread.run.requires_action` | Run paused — tool outputs needed |
| `thread.run.completed` | Run completed successfully |
| `thread.run.failed` | Run failed |
| `thread.run.cancelling` | Cancellation in progress |
| `thread.run.cancelled` | Run was cancelled |
| `thread.run.expired` | Run expired (10-minute timeout) |
| `thread.run.incomplete` | Run ended before completion |
| `thread.run.step.created` | A new run step started |
| `thread.run.step.in_progress` | Run step is executing |
| `thread.run.step.delta` | Run step has updated (delta) |
| `thread.run.step.completed` | Run step completed |
| `thread.run.step.failed` | Run step failed |
| `thread.run.step.cancelled` | Run step cancelled |
| `thread.run.step.expired` | Run step expired |
| `thread.message.created` | A new message started being generated |
| `thread.message.in_progress` | Message is being generated |
| `thread.message.delta` | Message content delta (text tokens) |
| `thread.message.completed` | Message fully generated |
| `thread.message.incomplete` | Message ended before completion |
| `error` | An error event |
| `done` | Stream ended (`data: [DONE]`) |

**Message Delta:**
```jsonc
{
  "id": "msg_123",
  "object": "thread.message.delta",
  "delta": {
    "content": [
      {
        "index": 0,
        "type": "text",
        "text": { "value": "Hello", "annotations": [] }
      }
    ]
  }
}
```

**Run Step Delta (tool call streaming):**
```jsonc
{
  "id": "step_abc",
  "object": "thread.run.step.delta",
  "delta": {
    "step_details": {
      "type": "tool_calls",
      "tool_calls": [{
        "index": 0,
        "type": "function",
        "id": "call_xyz",
        "function": { "name": "get_weather", "arguments": "{\"loc" }
      }]
    }
  }
}
```

---

## 6. Realtime API Streaming (WebSocket/WebRTC)

The Realtime API enables **low-latency bidirectional audio + text** over a persistent WebSocket or WebRTC connection.

**Connection:**
```
WebSocket: wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview
WebRTC:    https://api.openai.com/v1/realtime/sessions (get ephemeral key, then WebRTC handshake)
```

**Required header (WebSocket):**
```
Authorization: Bearer sk-...
OpenAI-Beta: realtime=v1
```

### 6.1 Session Management

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/realtime/sessions` | Create WebRTC ephemeral session key |
| `GET` | `/v1/realtime/sessions` | List sessions |
| `GET` | `/v1/realtime/sessions/{id}` | Get session details |
| `POST` | `/v1/realtime/transcription_sessions` | Create audio transcription-only session |

---

### 6.2 Client Events (sent from client → server over WebSocket)

| Event | Description |
|---|---|
| `session.update` | Update session configuration (model, voice, tools, VAD settings, etc.) |
| `input_audio_buffer.append` | Append base64-encoded PCM audio data to input buffer |
| `input_audio_buffer.commit` | Commit audio buffer → creates user message item |
| `input_audio_buffer.clear` | Clear audio buffer without committing |
| `conversation.item.create` | Add a message, function call, or result to conversation |
| `conversation.item.truncate` | Truncate a previous audio item |
| `conversation.item.delete` | Delete a conversation item |
| `conversation.item.retrieve` | Retrieve a specific conversation item |
| `response.create` | Manually trigger a response generation |
| `response.cancel` | Cancel an in-progress response |
| `output_audio_buffer.clear` | (WebRTC/SIP only) Clear the output audio buffer |

**Session configuration fields:**
```json
{
  "type": "session.update",
  "session": {
    "model": "gpt-4o-realtime-preview",
    "modalities": ["text", "audio"],
    "voice": "marin",
    "instructions": "You are a helpful assistant.",
    "turn_detection": {
      "type": "server_vad",
      "threshold": 0.5,
      "prefix_padding_ms": 300,
      "silence_duration_ms": 200,
      "create_response": true,
      "interrupt_response": true
    },
    "input_audio_format": "pcm16",
    "output_audio_format": "pcm16",
    "input_audio_transcription": { "model": "whisper-1" },
    "tools": [],
    "tool_choice": "auto",
    "temperature": 0.8,
    "max_output_tokens": "inf"
  }
}
```

---

### 6.3 Server Events (received from server → client over WebSocket)

| Event | Description |
|---|---|
| `error` | Error occurred |
| `session.created` | Session initialized |
| `session.updated` | Session configuration updated |
| `conversation.created` | Default conversation created |
| `conversation.item.created` | New item added to conversation |
| `conversation.item.input_audio_transcription.completed` | Input audio transcribed |
| `conversation.item.input_audio_transcription.delta` | Partial input transcription |
| `conversation.item.input_audio_transcription.failed` | Transcription failed |
| `conversation.item.truncated` | Item was truncated |
| `conversation.item.deleted` | Item was deleted |
| `conversation.item.retrieved` | Item content returned |
| `input_audio_buffer.committed` | Audio buffer committed |
| `input_audio_buffer.cleared` | Audio buffer cleared |
| `input_audio_buffer.speech_started` | VAD detected speech start |
| `input_audio_buffer.speech_stopped` | VAD detected speech end |
| `response.created` | Response generation started |
| `response.done` | Response fully complete (always emitted) |
| `response.output_item.added` | New output item added to response |
| `response.output_item.done` | Output item complete |
| `response.content_part.added` | Content part added to output item |
| `response.content_part.done` | Content part complete |
| `response.text.delta` | Partial text response |
| `response.text.done` | Complete text response |
| `response.audio_transcript.delta` | Partial audio transcript |
| `response.audio_transcript.done` | Complete audio transcript |
| `response.audio.delta` | Partial base64-encoded audio data |
| `response.audio.done` | Audio streaming complete |
| `response.function_call_arguments.delta` | Partial function call arguments |
| `response.function_call_arguments.done` | Complete function call arguments |
| `rate_limits.updated` | Rate limit status updated |
| `output_audio_buffer.started` | (WebRTC/SIP) Audio output started |
| `output_audio_buffer.stopped` | (WebRTC/SIP) Audio output stopped |
| `output_audio_buffer.cleared` | (WebRTC/SIP) Audio buffer cleared |

---

## 7. Shared Infrastructure

### 7.1 Files API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/files` | Upload a file (max 512 MB; 100 GB org limit) |
| `GET` | `/v1/files` | List uploaded files |
| `GET` | `/v1/files/{id}` | Get file metadata |
| `DELETE` | `/v1/files/{id}` | Delete a file |
| `GET` | `/v1/files/{id}/content` | Download file content |

**Purposes:** `assistants`, `vision`, `batch`, `fine-tune`

---

### 7.2 Uploads API (Multipart)

For files too large for a single request (max 8 GB):

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/uploads` | Create an upload session |
| `POST` | `/v1/uploads/{id}/parts` | Upload a part |
| `POST` | `/v1/uploads/{id}/complete` | Complete the upload (returns a File object) |
| `POST` | `/v1/uploads/{id}/cancel` | Cancel an upload |

---

### 7.3 Vector Stores API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/vector_stores` | Create a vector store |
| `GET` | `/v1/vector_stores` | List vector stores |
| `GET` | `/v1/vector_stores/{id}` | Get a vector store |
| `POST` | `/v1/vector_stores/{id}` | Modify a vector store |
| `DELETE` | `/v1/vector_stores/{id}` | Delete a vector store |
| `POST` | `/v1/vector_stores/{id}/files` | Add a file to a vector store |
| `GET` | `/v1/vector_stores/{id}/files` | List files in a vector store |
| `GET` | `/v1/vector_stores/{id}/files/{fid}` | Get a vector store file |
| `DELETE` | `/v1/vector_stores/{id}/files/{fid}` | Remove a file from vector store |
| `POST` | `/v1/vector_stores/{id}/file_batches` | Add multiple files (batch) |
| `GET` | `/v1/vector_stores/{id}/file_batches/{bid}` | Get batch status |
| `POST` | `/v1/vector_stores/{id}/file_batches/{bid}/cancel` | Cancel a batch |
| `GET` | `/v1/vector_stores/{id}/file_batches/{bid}/files` | List files in batch |

---

### 7.4 Embeddings

```
POST /v1/embeddings
```

```json
{
  "model": "text-embedding-3-large",
  "input": "The quick brown fox",
  "encoding_format": "float",
  "dimensions": 1536
}
```

**Models:** `text-embedding-3-small`, `text-embedding-3-large`, `text-embedding-ada-002`

---

### 7.5 Moderations

```
POST /v1/moderations
```

```json
{
  "model": "omni-moderation-latest",
  "input": [
    { "type": "text", "text": "I want to harm someone" },
    { "type": "image_url", "image_url": { "url": "https://..." } }
  ]
}
```

**Categories checked:** `hate`, `hate/threatening`, `harassment`, `harassment/threatening`, `illicit`, `self-harm`, `sexual`, `sexual/minors`, `violence`, `violence/graphic`

---

### 7.6 Models

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/v1/models` | List all available models |
| `GET` | `/v1/models/{id}` | Get model details |
| `DELETE` | `/v1/models/{id}` | Delete a fine-tuned model |

---

### 7.7 Images (DALL·E / GPT-Image)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/images/generations` | Generate images |
| `POST` | `/v1/images/edits` | Edit an image (inpainting) |
| `POST` | `/v1/images/variations` | Generate variations of an image |

**Key generation parameters:** `model` (`dall-e-3`, `dall-e-2`, `gpt-image-1`), `prompt`, `n`, `size`, `quality`, `style`, `response_format` (`url`, `b64_json`)

---

### 7.8 Audio (TTS & Whisper)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/v1/audio/speech` | Text-to-speech (can stream audio bytes) |
| `POST` | `/v1/audio/transcriptions` | Transcribe audio → text (Whisper) |
| `POST` | `/v1/audio/translations` | Translate audio → English text |

**TTS Models:** `tts-1`, `tts-1-hd`, `gpt-4o-mini-tts`
**TTS Voices:** `alloy`, `ash`, `ballad`, `coral`, `echo`, `fable`, `marin`, `nova`, `onyx`, `sage`, `shimmer`, `verse`
**TTS Streaming:** Returns chunked audio bytes; use `Transfer-Encoding: chunked`

---

## 8. SSE Transport Layer (All APIs)

### 8.1 Wire Format

```
data: {json_payload}\n
\n
```

Both Chat Completions and Responses API use this format. Only Assistants API adds an `event:` field:

```
event: thread.message.delta\n
data: {json_payload}\n
\n
```

### 8.2 Special Values

| Value | Meaning |
|---|---|
| `data: [DONE]` | Stream fully complete — never `JSON.parse` this |
| `: keepalive` | Comment line — discard silently |
| `: ping` | Comment line — discard silently |

### 8.3 Line Buffer Parser

```typescript
class SSEParser {
  private buf = "";
  private eventLines: string[] = [];

  push(raw: string): Array<{event?: string; data: string}> {
    this.buf += raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const results: Array<{event?: string; data: string}> = [];
    const lines = this.buf.split("\n");
    this.buf = lines.pop()!;  // Keep incomplete final line

    for (const line of lines) {
      if (line === "") {
        // Blank line = event boundary
        const eventStr = this.eventLines.find(l => l.startsWith("event:"))?.slice(6).trim();
        const dataStr  = this.eventLines.find(l => l.startsWith("data:"))?.slice(5).trim();
        this.eventLines = [];
        if (dataStr !== undefined) results.push({ event: eventStr, data: dataStr });
      } else if (!line.startsWith(":")) {  // Skip comments
        this.eventLines.push(line);
      }
    }
    return results;
  }
}
```

### 8.4 Rate Limit Headers

| Header | Description |
|---|---|
| `X-Ratelimit-Limit-Requests` | Requests per minute limit |
| `X-Ratelimit-Remaining-Requests` | Requests remaining |
| `X-Ratelimit-Reset-Requests` | Time until request limit resets |
| `X-Ratelimit-Limit-Tokens` | Token per minute limit |
| `X-Ratelimit-Remaining-Tokens` | Tokens remaining |
| `X-Ratelimit-Reset-Tokens` | Time until token limit resets |
| `X-Request-Id` | Unique request ID (share with support) |
| `X-Client-Request-Id` | Pass this in your request for your own correlation |
| `Openai-Processing-Ms` | Time to first token |
| `Openai-Version` | API version date |

---

## 9. Complete Request Parameter Reference

### Chat Completions vs. Responses API — Parameter Mapping

| Capability | Chat Completions | Responses API |
|---|---|---|
| Text generation | `messages` | `input` |
| System instructions | `messages[{role:"system"}]` | `instructions` |
| Conversation chaining | Manual (resend all messages) | `previous_response_id` or `conversation_id` |
| Streaming | `stream: true` | `stream: true` |
| Max output tokens | `max_completion_tokens` | `max_output_tokens` |
| Structured output | `response_format: {type:"json_schema"}` | `text: {format: {type:"json_schema"}}` |
| Web search | Not built-in | `tools: [{type:"web_search"}]` |
| File search | Not built-in | `tools: [{type:"file_search"}]` |
| Code interpreter | Not built-in | `tools: [{type:"code_interpreter"}]` |
| MCP servers | Not built-in | `tools: [{type:"mcp"}]` |
| Reasoning effort | `reasoning_effort` | `reasoning: {effort: "high"}` |
| Storage | `store: true` | `store: true` (default) |
| Context compaction | Not supported | `POST /v1/responses/compact` |
| Usage in stream | `stream_options.include_usage` | Included in `response.completed` event |
| Parallel tool calls | `parallel_tool_calls` | `parallel_tool_calls` |

---

## 10. Error Handling

### 10.1 HTTP Error Codes

| HTTP Status | Error Type | Common Causes |
|---|---|---|
| `400` | `invalid_request_error` | Bad parameters, unsupported model |
| `401` | `authentication_error` | Invalid or missing API key |
| `403` | `permission_error` | No access to requested model or resource |
| `404` | `not_found_error` | Model or resource doesn't exist |
| `409` | `conflict_error` | Resource state conflict |
| `422` | `unprocessable_entity_error` | Semantically invalid request |
| `429` | `rate_limit_error` | Rate limit exceeded |
| `500` | `server_error` | OpenAI backend error |
| `503` | `service_unavailable_error` | API temporarily overloaded |

### 10.2 Error Object Schema

```typescript
interface OpenAIError {
  error: {
    message: string;
    type: string;
    code: string | null;
    param: string | null;
    event_id?: string;  // Realtime API only
  }
}
```

### 10.3 Common Error Codes

| Code | Type | Description |
|---|---|---|
| `invalid_api_key` | authentication_error | API key invalid, expired, or revoked |
| `insufficient_quota` | billing_error | Account out of credits |
| `rate_limit_exceeded` | rate_limit_error | Too many requests or tokens per minute |
| `model_not_found` | invalid_request_error | Model doesn't exist or no access |
| `context_length_exceeded` | invalid_request_error | Input exceeds model context window |
| `max_tokens_exceeded` | invalid_request_error | `max_tokens` exceeds model limit |
| `content_filter` | content_filter_error | Response blocked by safety filters |
| `server_error` | server_error | Transient backend failure |
| `request_timeout` | server_error | Request timed out |

### 10.4 Mid-Stream Errors

Both Chat Completions and Responses API can emit error JSON mid-stream:

```jsonc
// Chat Completions mid-stream error
data: {"error":{"message":"...","type":"server_error","code":null}}

// Responses API mid-stream error
data: {"type":"error","code":"server_error","message":"...","sequence_number":9}
```

Always check for the `error` key (Chat Completions) or `type === "error"` (Responses API) before treating a payload as a normal chunk.

### 10.5 Retry Strategy

```
429 rate_limit → respect X-Ratelimit-Reset-Tokens / X-Ratelimit-Reset-Requests → exponential backoff
500 server_error → retry with exponential backoff (start: 1s, max: 60s)
503 service_unavailable → same as 500
401 / 403 → do NOT retry — fix credentials
400 / 422 → do NOT retry — fix request
```

---

*Document version: 2.0 | Last researched: April 2025*  
*Sources: platform.openai.com/docs, developers.openai.com, platform.openai.com/docs/api-reference*
