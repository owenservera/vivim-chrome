# ChatGPT.com Streaming Delta Parser Protocol
> Complete technical reference for parsing OpenAI Server-Sent Event streams from `chatgpt.com` and the OpenAI Chat Completions API.

---

## Table of Contents

1. [Protocol Overview](#1-protocol-overview)
2. [Transport Layer: Server-Sent Events](#2-transport-layer-server-sent-events)
3. [SSE Frame Anatomy](#3-sse-frame-anatomy)
4. [Top-Level Chunk Structure](#4-top-level-chunk-structure)
5. [The Delta Object](#5-the-delta-object)
6. [Stream Lifecycle & State Machine](#6-stream-lifecycle--state-machine)
7. [Content Streaming](#7-content-streaming)
8. [Tool Call Streaming](#8-tool-call-streaming)
9. [Function Call Streaming (Legacy)](#9-function-call-streaming-legacy)
10. [Finish Reasons](#10-finish-reasons)
11. [Role Propagation](#11-role-propagation)
12. [Multi-Choice Streaming](#12-multi-choice-streaming)
13. [Usage & Token Accounting](#13-usage--token-accounting)
14. [Error Events](#14-error-events)
15. [The `[DONE]` Sentinel](#15-the-done-sentinel)
16. [Headers & Connection Management](#16-headers--connection-management)
17. [Backpressure & Buffer Management](#17-backpressure--buffer-management)
18. [Edge Cases & Gotchas](#18-edge-cases--gotchas)
19. [Reference Implementation (TypeScript)](#19-reference-implementation-typescript)
20. [Complete Field Reference](#20-complete-field-reference)

---

## 1. Protocol Overview

ChatGPT.com and the OpenAI Chat Completions API deliver streamed responses using **Server-Sent Events (SSE)** over a persistent HTTP/1.1 or HTTP/2 connection. The server pushes partial message fragments — called **deltas** — as they are generated token-by-token by the model. The client is responsible for assembling these deltas into a coherent final message.

**Key design principles of the protocol:**

| Principle | Detail |
|---|---|
| **Incremental** | Each chunk carries only the *new* content since the last chunk — never a full snapshot |
| **Ordered** | Chunks arrive in generation order; no sequence numbers are needed |
| **Stateful reassembly** | The client must maintain accumulator state across chunks |
| **Idempotent sentinel** | The stream always ends with `data: [DONE]` |
| **JSON payloads** | Every data line (except `[DONE]`) is valid JSON |

---

## 2. Transport Layer: Server-Sent Events

### 2.1 HTTP Request

```http
POST /v1/chat/completions HTTP/1.1
Host: api.openai.com
Authorization: Bearer sk-...
Content-Type: application/json
Accept: text/event-stream

{
  "model": "gpt-4o",
  "stream": true,
  "messages": [...]
}
```

Setting `"stream": true` switches the response from a single JSON body to an SSE stream.

### 2.2 HTTP Response Headers

```http
HTTP/1.1 200 OK
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache
Connection: keep-alive
Transfer-Encoding: chunked
X-Request-Id: req_abc123
```

- `Content-Type: text/event-stream` is the canonical SSE MIME type.
- `Transfer-Encoding: chunked` means there is **no** `Content-Length` header; the connection stays open until the server closes it.
- `Cache-Control: no-cache` instructs proxies not to buffer the response.

---

## 3. SSE Frame Anatomy

The SSE specification (WHATWG) defines a simple line-based text format. Each **event** is a block of one or more field lines, terminated by a **blank line** (`\n\n`).

### 3.1 Full Frame Grammar

```
event-stream  = *( comment / event )
event         = *( field ":" SP value "\n" ) "\n"
field         = "data" / "event" / "id" / "retry"
comment       = ":" *any-char "\n"
```

### 3.2 Fields Used by OpenAI

| SSE Field | Usage in OpenAI Stream |
|---|---|
| `data:` | **Always present.** Contains the JSON chunk payload, or the literal string `[DONE]` |
| `event:` | **Rarely used.** Not typically emitted by the OpenAI API in standard streams |
| `id:` | **Not used** in standard Chat Completions streams |
| `retry:` | **Not used** by OpenAI |
| `:` (comment) | Occasionally sent as **keepalive pings** — must be silently ignored |

### 3.3 Typical Raw Wire Format

```
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1710000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}\n
\n
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1710000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}\n
\n
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1710000000,"model":"gpt-4o","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}\n
\n
data: {"id":"chatcmpl-abc","object":"chat.completion.chunk","created":1710000000,"model":"gpt-4o","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}\n
\n
data: [DONE]\n
\n
```

> **Note:** Each line ends with `\n`. Events are separated by a blank line (`\n\n`). Some implementations render this as `\r\n` — parsers must handle both.

### 3.4 Keepalive Comments

The server may inject comment lines (starting with `:`) to prevent connection timeouts:

```
: keep-alive\n
\n
```

These carry no data and **must be discarded entirely** by the parser.

---

## 4. Top-Level Chunk Structure

Every `data:` payload (except `[DONE]`) is a **`ChatCompletionChunk`** object:

```typescript
interface ChatCompletionChunk {
  id: string;                     // Shared across all chunks of one request
  object: "chat.completion.chunk";
  created: number;                // Unix timestamp (seconds)
  model: string;                  // Model that generated the response
  system_fingerprint?: string;    // Backend config fingerprint (may change mid-stream)
  choices: Choice[];              // Array; usually length 1 unless n > 1
  usage?: UsageDelta;             // Only present on the FINAL chunk when stream_options.include_usage = true
}
```

### 4.1 Field Details

#### `id`
- Type: `string` — e.g., `"chatcmpl-abc123XYZ"`
- **All chunks in a single request share the same `id`.**
- Use this to correlate chunks if you're handling multiple concurrent streams.
- Corresponds to the `id` field in the final non-streamed `ChatCompletion` object.

#### `object`
- Always `"chat.completion.chunk"` for streaming.
- Non-streaming responses use `"chat.completion"`.
- Use this as a discriminator if your parser handles both.

#### `created`
- Unix epoch in seconds.
- **Same value across all chunks** in a single response.
- Represents when the generation *started*, not when the individual chunk was emitted.

#### `model`
- The resolved model name, e.g., `"gpt-4o-2024-05-13"`.
- May be more specific than what you requested (e.g., you sent `"gpt-4o"`, you receive `"gpt-4o-2024-05-13"`).

#### `system_fingerprint`
- Opaque string representing the backend configuration (e.g., `"fp_a1b2c3d4e5"`).
- Can change mid-stream if the request is load-balanced across backend versions.
- Relevant for reproducibility — if it changes, outputs with identical seeds may differ.

---

## 5. The Delta Object

The `delta` is the core of the streaming protocol. It sits inside each `Choice` and contains **only the fields that changed** since the previous chunk.

```typescript
interface Delta {
  role?:          "assistant";           // Only in first chunk
  content?:       string | null;         // Text token(s)
  tool_calls?:    ToolCallDelta[];       // Streaming tool invocations
  function_call?: FunctionCallDelta;     // Legacy function calling (deprecated)
  refusal?:       string | null;         // Safety refusal content
}
```

### 5.1 Delta Sparsity

The delta is **sparse by design**. Fields that haven't changed are **omitted entirely** (not set to `null` or `""`). 

```jsonc
// First chunk — role is announced
{"delta": {"role": "assistant", "content": ""}}

// Middle chunks — only new content tokens
{"delta": {"content": "Hello"}}
{"delta": {"content": ", world"}}
{"delta": {"content": "!"}}

// Final chunk — delta is empty object
{"delta": {}}
```

> **Critical parser implication:** Check for field *presence* (using `"key" in delta` or `delta.hasOwnProperty("key")`), NOT truthiness. An empty string `""` is a valid content delta.

### 5.2 Delta vs. Snapshot

| Streaming Delta | Non-Streaming Snapshot |
|---|---|
| `{"content": " world"}` | `{"content": "Hello, world!"}` |
| Sparse — only new data | Complete — full message |
| Must be accumulated | Ready to use |

---

## 6. Stream Lifecycle & State Machine

A well-implemented delta parser must track the stream through distinct states:

```
IDLE ──► CONNECTING ──► ROLE_RECEIVED ──► STREAMING ──► FINISHING ──► DONE
                              │                │                │
                              │                ▼                ▼
                              │          TOOL_CALLING    CONTENT_FILTER
                              ▼
                          ERROR
```

### 6.1 State Descriptions

| State | Trigger | Expected Delta |
|---|---|---|
| `IDLE` | Before request | — |
| `CONNECTING` | HTTP request sent | — |
| `ROLE_RECEIVED` | First chunk arrives | `{"role": "assistant"}` |
| `STREAMING` | Content chunks flowing | `{"content": "..."}` |
| `TOOL_CALLING` | Tool call chunks | `{"tool_calls": [...]}` |
| `FINISHING` | `finish_reason` set | `{}` or sparse |
| `DONE` | `data: [DONE]` received | N/A |
| `ERROR` | HTTP error or error chunk | N/A |

### 6.2 Accumulator State

Initialize this before the stream begins:

```typescript
interface StreamAccumulator {
  id: string | null;
  model: string | null;
  created: number | null;
  system_fingerprint: string | null;
  role: string;                    // Initialize to "assistant"
  content: string;                 // Initialize to ""
  refusal: string | null;          // Initialize to null
  tool_calls: ToolCall[];          // Initialize to []
  finish_reason: string | null;    // Initialize to null
  usage: Usage | null;             // Initialize to null
}
```

---

## 7. Content Streaming

### 7.1 Standard Text Flow

```jsonc
// Chunk 1 — role announcement
{
  "id": "chatcmpl-abc",
  "choices": [{"index": 0, "delta": {"role": "assistant", "content": ""}, "finish_reason": null}]
}

// Chunk 2..N — content tokens
{
  "id": "chatcmpl-abc",
  "choices": [{"index": 0, "delta": {"content": "The"}, "finish_reason": null}]
}
{
  "id": "chatcmpl-abc",
  "choices": [{"index": 0, "delta": {"content": " answer"}, "finish_reason": null}]
}
{
  "id": "chatcmpl-abc",
  "choices": [{"index": 0, "delta": {"content": " is"}, "finish_reason": null}]
}
{
  "id": "chatcmpl-abc",
  "choices": [{"index": 0, "delta": {"content": " 42."}, "finish_reason": null}]
}

// Final content chunk
{
  "id": "chatcmpl-abc",
  "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]
}
```

### 7.2 Accumulation Algorithm

```typescript
function applyContentDelta(accumulator: StreamAccumulator, delta: Delta): void {
  if (delta.content !== undefined && delta.content !== null) {
    accumulator.content += delta.content;
  }
  if (delta.refusal !== undefined && delta.refusal !== null) {
    accumulator.refusal = (accumulator.refusal ?? "") + delta.refusal;
  }
}
```

### 7.3 Token Granularity

Tokens are **not** emitted one-per-chunk predictably. Depending on model, backend load, and content:
- A chunk may contain a **partial word** (e.g., `"Hel"`)
- A chunk may contain **multiple words** (e.g., `"The quick brown"`)
- A chunk may contain **newlines or special characters**
- A chunk's `content` may be an **empty string `""`** (e.g., on role-only first chunk)

Never assume word-boundary alignment. Always concatenate raw.

### 7.4 Refusal Content

When a safety refusal occurs, `content` will be `null` and `refusal` will stream instead:

```jsonc
{
  "choices": [{"index": 0, "delta": {"refusal": "I'm sorry, I can't"}, "finish_reason": null}]
}
```

Accumulate `refusal` separately from `content`.

---

## 8. Tool Call Streaming

Tool calls (function calling via the modern `tools` API) stream through a specialized multi-part delta structure.

### 8.1 ToolCallDelta Structure

```typescript
interface ToolCallDelta {
  index: number;              // Which tool call in the array (0-based)
  id?: string;                // Only in first chunk for this tool call
  type?: "function";          // Only in first chunk for this tool call
  function?: {
    name?: string;            // Only in first chunk for this tool call
    arguments?: string;       // Partial JSON string — accumulate!
  };
}
```

### 8.2 Tool Call Streaming Sequence

```jsonc
// Chunk 1 — role announcement (no tool calls yet)
{"delta": {"role": "assistant", "content": null}}

// Chunk 2 — first tool call header
{
  "delta": {
    "tool_calls": [{
      "index": 0,
      "id": "call_abc123",
      "type": "function",
      "function": {"name": "get_weather", "arguments": ""}
    }]
  }
}

// Chunks 3..N — arguments stream as partial JSON
{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "{\"loc"}}]}}
{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "ation\":"}}]}}
{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "\"London"}}]}}
{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "\"}"}}]}}

// Final chunk
{"delta": {}, "finish_reason": "tool_calls"}
```

### 8.3 Tool Call Accumulation Algorithm

```typescript
interface ToolCallAccumulator {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;   // Partial JSON being assembled
  };
}

function applyToolCallDelta(
  accumulator: ToolCallAccumulator[],
  deltas: ToolCallDelta[]
): void {
  for (const delta of deltas) {
    const idx = delta.index;

    // Initialize slot if first delta for this index
    if (!accumulator[idx]) {
      accumulator[idx] = {
        id: "",
        type: "function",
        function: { name: "", arguments: "" }
      };
    }

    const tc = accumulator[idx];

    if (delta.id)                     tc.id = delta.id;
    if (delta.type)                   tc.type = delta.type;
    if (delta.function?.name)         tc.function.name += delta.function.name;
    if (delta.function?.arguments)    tc.function.arguments += delta.function.arguments;
  }
}
```

### 8.4 Parsing Tool Arguments

The `arguments` field is a **streaming JSON string**. It is **not valid JSON until the stream is complete**. Do not attempt to parse it mid-stream unless you are implementing an incremental JSON parser.

```typescript
// WRONG — will throw on partial JSON
const args = JSON.parse(delta.function.arguments);

// CORRECT — parse only after accumulation is complete
const args = JSON.parse(accumulator[0].function.arguments);
```

### 8.5 Multiple Simultaneous Tool Calls

When the model calls multiple tools (parallel function calling), all stream interleaved by `index`:

```jsonc
// Tool 0 header
{"delta": {"tool_calls": [{"index": 0, "id": "call_aaa", "type": "function", "function": {"name": "get_weather", "arguments": ""}}]}}

// Tool 1 header
{"delta": {"tool_calls": [{"index": 1, "id": "call_bbb", "type": "function", "function": {"name": "search_web", "arguments": ""}}]}}

// Arguments for tool 0
{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "{\"city\":"}}]}}

// Arguments for tool 1
{"delta": {"tool_calls": [{"index": 1, "function": {"arguments": "{\"query\":"}}]}}

// More arguments for tool 0
{"delta": {"tool_calls": [{"index": 0, "function": {"arguments": "\"Paris\"}"}}]}}

// More arguments for tool 1
{"delta": {"tool_calls": [{"index": 1, "function": {"arguments": "\"AI news\"}"}}]}}
```

The `index` field **uniquely identifies** which tool call slot the delta belongs to. Always route by `index`, never by position in the array.

---

## 9. Function Call Streaming (Legacy)

The older `functions` API (pre-`tools`) uses a different delta structure. It is **deprecated** but still supported.

```typescript
interface FunctionCallDelta {
  name?: string;        // Only in first chunk
  arguments?: string;   // Partial JSON — accumulate!
}
```

```jsonc
// First chunk
{"delta": {"function_call": {"name": "get_weather", "arguments": ""}}}

// Subsequent chunks
{"delta": {"function_call": {"arguments": "{\"loc"}}}
{"delta": {"function_call": {"arguments": "ation\": \"NYC\"}"}}}

// Final chunk
{"delta": {}, "finish_reason": "function_call"}
```

Accumulation is simpler (single tool, no index):

```typescript
let functionCallAccumulator = { name: "", arguments: "" };

if (delta.function_call?.name)      functionCallAccumulator.name += delta.function_call.name;
if (delta.function_call?.arguments) functionCallAccumulator.arguments += delta.function_call.arguments;
```

---

## 10. Finish Reasons

`finish_reason` appears in the `Choice` object (not inside `delta`). It is `null` for all chunks **except the final one**, where it takes one of these values:

| `finish_reason` | Meaning | Delta State on Final Chunk |
|---|---|---|
| `"stop"` | Model completed naturally | `delta: {}` (empty) |
| `"length"` | Hit `max_tokens` limit | `delta: {}` (truncated) |
| `"tool_calls"` | Model invoked one or more tools | `delta: {}` |
| `"function_call"` | Model invoked a legacy function | `delta: {}` |
| `"content_filter"` | Response blocked by safety policy | `delta: {}` or `delta: {"refusal": "..."}` |
| `null` | Stream is still ongoing | Any valid delta |

### 10.1 Handling `finish_reason: "length"`

This indicates a truncated response. The parser should:
1. Complete accumulation normally
2. Flag the result as incomplete
3. Optionally continue the conversation with the accumulated content as a message to request continuation

### 10.2 Handling `finish_reason: "content_filter"`

```jsonc
{
  "choices": [{
    "index": 0,
    "delta": {},
    "finish_reason": "content_filter",
    "content_filter_results": {
      "hate": {"filtered": false, "severity": "safe"},
      "self_harm": {"filtered": false, "severity": "safe"},
      "sexual": {"filtered": true, "severity": "medium"},
      "violence": {"filtered": false, "severity": "safe"}
    }
  }]
}
```

The `content_filter_results` object (Azure OpenAI only) details which categories triggered filtering. The standard OpenAI API will simply terminate with `"content_filter"` and no additional detail.

---

## 11. Role Propagation

### 11.1 First Chunk Role Announcement

The **first chunk** of every stream carries the `role` field:

```jsonc
{"delta": {"role": "assistant", "content": ""}}
```

This is the **only** chunk where `role` appears. Subsequent chunks omit it entirely.

**Parser rule:** Store the role from the first chunk. Never expect it again.

### 11.2 Content May Be Empty on Role Chunk

The `content` field on the role chunk is often `""` (empty string) but is sometimes `null`. Handle both:

```typescript
if ("role" in delta) {
  accumulator.role = delta.role!;
}
if (delta.content != null) {
  accumulator.content += delta.content;
}
```

---

## 12. Multi-Choice Streaming

When `n > 1` is specified, each chunk may contain **multiple choices**, each with their own `index` and `delta`:

```jsonc
{
  "choices": [
    {"index": 0, "delta": {"content": "Option A"}, "finish_reason": null},
    {"index": 1, "delta": {"content": "Option B"}, "finish_reason": null}
  ]
}
```

### 12.1 Multi-Choice Accumulator

```typescript
const accumulators: Record<number, StreamAccumulator> = {};

for (const choice of chunk.choices) {
  const idx = choice.index;
  if (!accumulators[idx]) {
    accumulators[idx] = createEmptyAccumulator();
  }
  applyDelta(accumulators[idx], choice.delta);
  if (choice.finish_reason) {
    accumulators[idx].finish_reason = choice.finish_reason;
  }
}
```

> **Note:** With `n > 1`, different choices may finish at different times and with different `finish_reason` values.

### 12.2 Interleaving Behavior

Choices are **not guaranteed to interleave in a round-robin pattern**. Choice 0 may produce 10 chunks before Choice 1 appears. Always route by `index`.

---

## 13. Usage & Token Accounting

By default, the streaming API does **not** include token usage in chunk payloads. To enable it, pass `stream_options`:

```json
{
  "stream": true,
  "stream_options": {"include_usage": true}
}
```

When enabled, a **special final chunk** is emitted **after** the `finish_reason` chunk and **before** `[DONE]`:

```jsonc
{
  "id": "chatcmpl-abc",
  "object": "chat.completion.chunk",
  "choices": [],            // Empty array — no choices in this chunk
  "usage": {
    "prompt_tokens": 42,
    "completion_tokens": 87,
    "total_tokens": 129,
    "prompt_tokens_details": {
      "cached_tokens": 0,
      "audio_tokens": 0
    },
    "completion_tokens_details": {
      "reasoning_tokens": 0,
      "audio_tokens": 0,
      "accepted_prediction_tokens": 0,
      "rejected_prediction_tokens": 0
    }
  }
}
```

### 13.1 Usage Chunk Identification

```typescript
function isUsageChunk(chunk: ChatCompletionChunk): boolean {
  return chunk.choices.length === 0 && chunk.usage !== undefined;
}
```

### 13.2 Streaming Usage Field Summary

| Field | Description |
|---|---|
| `prompt_tokens` | Tokens in the input (system + messages) |
| `completion_tokens` | Tokens generated in the output |
| `total_tokens` | Sum of above |
| `cached_tokens` | Prompt tokens served from cache (Prompt Caching) |
| `reasoning_tokens` | Internal chain-of-thought tokens (o-series models) |
| `accepted_prediction_tokens` | Speculative decoding accepted tokens |
| `rejected_prediction_tokens` | Speculative decoding rejected tokens |

---

## 14. Error Events

### 14.1 HTTP-Level Errors (Before Stream Starts)

Standard HTTP errors arrive before any SSE data:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "error": {
    "message": "Rate limit exceeded",
    "type": "requests",
    "param": null,
    "code": "rate_limit_exceeded"
  }
}
```

These are caught by checking the HTTP status code **before** entering the SSE parsing loop.

### 14.2 Mid-Stream Errors

In rare cases, an error JSON is emitted **as a data event mid-stream**:

```
data: {"error":{"message":"The server had an error processing your request","type":"server_error","param":null,"code":null}}\n
\n
```

The parser must detect this pattern:

```typescript
function isErrorChunk(raw: unknown): raw is ErrorChunk {
  return typeof raw === "object" && raw !== null && "error" in raw;
}
```

### 14.3 Error Object Schema

```typescript
interface OpenAIError {
  message: string;
  type: string;        // e.g., "server_error", "invalid_request_error"
  param: string | null;
  code: string | null; // e.g., "rate_limit_exceeded", "model_not_found"
}
```

### 14.4 Common Error Codes

| `code` | `type` | Cause |
|---|---|---|
| `rate_limit_exceeded` | `requests` / `tokens` | Too many requests or tokens per minute |
| `model_not_found` | `invalid_request_error` | Model doesn't exist or no access |
| `context_length_exceeded` | `invalid_request_error` | Prompt too long for model |
| `server_error` | `server_error` | Backend failure |
| `invalid_api_key` | `authentication_error` | Bad or expired API key |
| `insufficient_quota` | `billing_error` | Account out of credits |

---

## 15. The `[DONE]` Sentinel

The final SSE data event is always:

```
data: [DONE]\n
\n
```

### 15.1 Characteristics

- This is **not valid JSON** — it is a literal string.
- It signals the stream is complete and the connection will close.
- It appears **after** the final chunk (with `finish_reason` set) and **after** the usage chunk (if `include_usage: true`).
- **Never try to `JSON.parse` this value.** Always check for it explicitly first.

### 15.2 Handling Logic

```typescript
const raw = line.replace(/^data:\s*/, "");

if (raw === "[DONE]") {
  onStreamComplete(accumulator);
  return;
}

const chunk = JSON.parse(raw) as ChatCompletionChunk | ErrorChunk;
```

---

## 16. Headers & Connection Management

### 16.1 Request Headers

```http
Authorization: Bearer sk-...        // Required
Content-Type: application/json      // Required
Accept: text/event-stream           // Recommended (signals streaming intent)
OpenAI-Beta: assistants=v2          // Only for Assistants API
```

### 16.2 Response Headers of Interest

| Header | Value | Purpose |
|---|---|---|
| `X-Request-Id` | `req_abc123` | Unique request identifier for support |
| `X-Ratelimit-Limit-Requests` | `10000` | Requests per minute limit |
| `X-Ratelimit-Remaining-Requests` | `9999` | Remaining requests this window |
| `X-Ratelimit-Limit-Tokens` | `200000` | Tokens per minute limit |
| `X-Ratelimit-Remaining-Tokens` | `198000` | Remaining tokens this window |
| `X-Ratelimit-Reset-Requests` | `1ms` | Time until request limit resets |
| `X-Ratelimit-Reset-Tokens` | `3ms` | Time until token limit resets |
| `Openai-Processing-Ms` | `1423` | Time to first token in ms |
| `Openai-Version` | `2020-10-01` | API version |

### 16.3 Connection Lifecycle

```
Client                           Server
  │                                 │
  │──── POST /v1/chat/completions ──►│
  │                                 │── queues request
  │                                 │── begins generation
  │◄─── HTTP 200 (headers only) ────│
  │                                 │
  │◄──── data: chunk_1 \n\n ────────│
  │◄──── data: chunk_2 \n\n ────────│
  │◄──── data: chunk_N \n\n ────────│
  │◄──── data: [DONE] \n\n ─────────│
  │                                 │── closes connection
  │                                 │
```

---

## 17. Backpressure & Buffer Management

### 17.1 TCP Chunking vs. SSE Events

TCP may deliver multiple SSE events in a single read, or split a single SSE event across multiple reads. Your parser **must not assume** 1:1 alignment between TCP reads and SSE events.

### 17.2 Line Buffer Implementation

```typescript
class SSELineBuffer {
  private buffer = "";

  push(chunk: string): string[] {
    this.buffer += chunk;
    const lines: string[] = [];
    let newlineIndex: number;

    while ((newlineIndex = this.buffer.indexOf("\n")) !== -1) {
      lines.push(this.buffer.slice(0, newlineIndex));
      this.buffer = this.buffer.slice(newlineIndex + 1);
    }

    return lines;
  }

  flush(): string {
    const remaining = this.buffer;
    this.buffer = "";
    return remaining;
  }
}
```

### 17.3 Event Assembly from Lines

```typescript
class SSEEventAssembler {
  private currentEvent: string[] = [];

  processLine(line: string): string | null {
    const trimmed = line.trimEnd(); // Handle \r\n

    if (trimmed === "") {
      // Blank line = event boundary
      const event = this.currentEvent.join("\n");
      this.currentEvent = [];
      return event || null;
    }

    this.currentEvent.push(trimmed);
    return null;
  }
}
```

### 17.4 Data Extraction

```typescript
function extractDataPayload(eventLines: string): string | null {
  for (const line of eventLines.split("\n")) {
    if (line.startsWith("data:")) {
      return line.slice(5).trim(); // Remove "data:" prefix and whitespace
    }
    if (line.startsWith(":")) {
      return null; // Comment — skip
    }
  }
  return null;
}
```

---

## 18. Edge Cases & Gotchas

### 18.1 `content` Can Be `null`

When the model invokes a tool, `content` in the delta is `null`, not `""`:

```jsonc
{"delta": {"role": "assistant", "content": null}}
```

Always null-check before concatenating.

### 18.2 Empty `content` vs. Absent `content`

| Delta | Meaning |
|---|---|
| `{"content": ""}` | Explicit empty string — still valid, typically in role chunk |
| `{"content": null}` | Content field is null — tool call or safety response |
| `{}` (no `content` key) | Content field absent — use previous accumulator state |

Check `"content" in delta` to distinguish absence from null.

### 18.3 `choices` Array Can Be Empty

The usage chunk (when `include_usage: true`) arrives with `choices: []`. This is valid and must not be treated as an error.

### 18.4 `system_fingerprint` Can Change Mid-Stream

Rare but possible on long responses. Your parser should update `accumulator.system_fingerprint` on every chunk, not just the first.

### 18.5 `finish_reason` in Non-Final Chunks

`finish_reason` is always `null` for non-final chunks. However, some proxy implementations erroneously forward `null` values explicitly. Always check for the non-null case rather than presence.

### 18.6 Tool Call `name` May Stream in Parts

In rare cases, even the function `name` may arrive across multiple deltas:

```jsonc
{"delta": {"tool_calls": [{"index": 0, "function": {"name": "get_"}}]}}
{"delta": {"tool_calls": [{"index": 0, "function": {"name": "weather"}}]}}
```

Always append, never assign.

### 18.7 Whitespace in `data:` Lines

The SSE spec allows optional whitespace after the colon: `data: {json}` and `data:{json}` are both valid. Always strip with `line.replace(/^data:\s*/, "")`.

### 18.8 CRLF Line Endings

Some proxies and CDNs convert `\n` to `\r\n`. Normalize line endings:

```typescript
const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
```

### 18.9 Abort & Cancellation

If the client aborts mid-stream (e.g., user stops generation):
- Cancel the `fetch` request using `AbortController`
- Discard the partial accumulator or mark it as `aborted`
- Do **not** treat the partial content as a complete response

```typescript
const controller = new AbortController();
const response = await fetch(url, { signal: controller.signal });

// To abort:
controller.abort();
```

---

## 19. Reference Implementation (TypeScript)

```typescript
interface StreamAccumulator {
  id: string | null;
  model: string | null;
  created: number | null;
  system_fingerprint: string | null;
  role: string;
  content: string;
  refusal: string | null;
  tool_calls: ToolCallAccumulator[];
  finish_reason: string | null;
  usage: Usage | null;
}

interface ToolCallAccumulator {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

function createAccumulator(): StreamAccumulator {
  return {
    id: null,
    model: null,
    created: null,
    system_fingerprint: null,
    role: "assistant",
    content: "",
    refusal: null,
    tool_calls: [],
    finish_reason: null,
    usage: null,
  };
}

async function* parseSSEStream(
  response: Response
): AsyncGenerator<ChatCompletionChunk | "DONE"> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder("utf-8");
  let lineBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    lineBuffer += decoder.decode(value, { stream: true });
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop()!; // Keep incomplete last line

    let eventData = "";

    for (const line of lines) {
      const trimmed = line.trimEnd();

      if (trimmed === "") {
        // Event boundary
        if (eventData) {
          yield* processEvent(eventData);
          eventData = "";
        }
      } else if (trimmed.startsWith("data:")) {
        eventData = trimmed.slice(5).trim();
      } else if (trimmed.startsWith(":")) {
        // Comment — ignore
      }
    }
  }
}

function* processEvent(
  data: string
): Generator<ChatCompletionChunk | "DONE"> {
  if (data === "[DONE]") {
    yield "DONE";
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    console.error("Failed to parse SSE data:", data);
    return;
  }

  if (isErrorChunk(parsed)) {
    throw new OpenAIStreamError(parsed.error);
  }

  yield parsed as ChatCompletionChunk;
}

function applyChunk(
  acc: StreamAccumulator,
  chunk: ChatCompletionChunk
): void {
  // Update top-level metadata
  if (!acc.id)               acc.id = chunk.id;
  if (!acc.model)            acc.model = chunk.model;
  if (!acc.created)          acc.created = chunk.created;
  if (chunk.system_fingerprint) acc.system_fingerprint = chunk.system_fingerprint;

  // Usage chunk (empty choices)
  if (chunk.choices.length === 0 && chunk.usage) {
    acc.usage = chunk.usage;
    return;
  }

  for (const choice of chunk.choices) {
    const { delta, finish_reason } = choice;

    // Role (first chunk only)
    if (delta.role) acc.role = delta.role;

    // Content
    if (delta.content != null) acc.content += delta.content;

    // Refusal
    if (delta.refusal != null) {
      acc.refusal = (acc.refusal ?? "") + delta.refusal;
    }

    // Tool calls
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        const idx = tc.index;
        if (!acc.tool_calls[idx]) {
          acc.tool_calls[idx] = {
            id: "",
            type: "function",
            function: { name: "", arguments: "" }
          };
        }
        const slot = acc.tool_calls[idx];
        if (tc.id)                   slot.id = tc.id;
        if (tc.type)                 slot.type = tc.type;
        if (tc.function?.name)       slot.function.name += tc.function.name;
        if (tc.function?.arguments)  slot.function.arguments += tc.function.arguments;
      }
    }

    // Finish reason
    if (finish_reason) acc.finish_reason = finish_reason;
  }
}

async function streamChatCompletion(
  body: Record<string, unknown>,
  onToken: (token: string) => void,
  onDone: (acc: StreamAccumulator) => void
): Promise<void> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message ?? "Unknown API error");
  }

  const acc = createAccumulator();

  for await (const event of parseSSEStream(response)) {
    if (event === "DONE") {
      onDone(acc);
      break;
    }

    const prevContent = acc.content;
    applyChunk(acc, event);

    // Emit only the new content delta
    const newContent = acc.content.slice(prevContent.length);
    if (newContent) onToken(newContent);
  }
}
```

---

## 20. Complete Field Reference

### ChatCompletionChunk

| Field | Type | Always Present | Notes |
|---|---|---|---|
| `id` | `string` | ✅ | Shared across all chunks |
| `object` | `"chat.completion.chunk"` | ✅ | Discriminator |
| `created` | `number` | ✅ | Unix timestamp, same for all chunks |
| `model` | `string` | ✅ | Resolved model name |
| `system_fingerprint` | `string?` | ❌ | May be absent or change |
| `choices` | `Choice[]` | ✅ | Empty array on usage chunk |
| `usage` | `Usage?` | ❌ | Only on final usage chunk |

### Choice

| Field | Type | Always Present | Notes |
|---|---|---|---|
| `index` | `number` | ✅ | 0-based choice index |
| `delta` | `Delta` | ✅ | Sparse delta object |
| `finish_reason` | `string \| null` | ✅ | `null` until final chunk |
| `logprobs` | `Logprobs?` | ❌ | Only when requested |
| `content_filter_results` | `object?` | ❌ | Azure OpenAI only |

### Delta

| Field | Type | When Present |
|---|---|---|
| `role` | `"assistant"?` | First chunk only |
| `content` | `string \| null?` | Content chunks; null on tool calls |
| `tool_calls` | `ToolCallDelta[]?` | Tool call chunks |
| `function_call` | `FunctionCallDelta?` | Legacy only |
| `refusal` | `string \| null?` | Safety refusal chunks |

### ToolCallDelta

| Field | Type | When Present |
|---|---|---|
| `index` | `number` | Always — identifies the slot |
| `id` | `string?` | First delta for this tool call |
| `type` | `"function"?` | First delta for this tool call |
| `function.name` | `string?` | First delta for this tool call |
| `function.arguments` | `string?` | Argument streaming chunks |

### Usage (Final Chunk)

| Field | Type | Notes |
|---|---|---|
| `prompt_tokens` | `number` | Input tokens |
| `completion_tokens` | `number` | Output tokens |
| `total_tokens` | `number` | Sum |
| `prompt_tokens_details.cached_tokens` | `number` | Prompt Cache hits |
| `prompt_tokens_details.audio_tokens` | `number` | Audio input tokens |
| `completion_tokens_details.reasoning_tokens` | `number` | o-series internal reasoning |
| `completion_tokens_details.accepted_prediction_tokens` | `number` | Speculative decode hits |
| `completion_tokens_details.rejected_prediction_tokens` | `number` | Speculative decode misses |

---

*Document version: 1.0 | Protocol: OpenAI Chat Completions Streaming (SSE) | Models: GPT-4o, GPT-4o-mini, o1, o3, and all OpenAI chat models*
