# Implementation Plan: ChatGPT Stream Fixes

## Objective
Fix the ChatGPT streaming integration so that responses stream smoothly into a single bubble, correctly attribute the model, and do not abruptly cut off or generate empty phantom bubbles.

## Key Files & Context
- `src/providers/chatgpt/ChatGPTProvider.js`
- `src/core/streaming/StreamingManager.js`
- `src/ui/SidePanelController.js` (Optional cleanup)

## Implementation Steps

### 1. Filter Non-Streaming Responses (`ChatGPTProvider.js`)
ChatGPT frequently makes secondary requests (like title generation) that return standard JSON rather than an SSE stream. The `StreamingManager` attempts to parse these as streams, reads no `data:` lines, and emits an empty `isFinal` chunk, spawning an empty bubble.
- Inject a Content-Type check inside `onResponse`.
- If `ctx.response.headers.get('content-type')` does not include `text/event-stream`, abort stream processing immediately.
- Update the fallback model in the metadata from `"unknown"` to `"ChatGPT"`.

### 2. Handle Array-Based JSON Patches (`StreamingManager.js`)
The standard JSON Patch specification formats patches as an **array** of operations (e.g., `[{"o": "append", "p": "...", "v": "..."}]`). The current `DeltaEncodingV1Parser` expects an object at the root (`payload.o`), causing it to fail silently when receiving an array and resulting in the stream halting after the initial message chunk.
- Update `processDeltaPayload` in `DeltaEncodingV1Parser` to check if `payload` is an array.
- If it is an array, iterate through each patch operation and process them sequentially.
- Refine the value extraction (`valToAppend`) to safely handle cases where the delta value might be wrapped in an array.

## Verification & Testing
- Run `bun run build`.
- Refresh the ChatGPT tab.
- Send a prompt via the side panel and observe a continuous, single-bubble stream labeled "ChatGPT".