# Gemini (Google) 2026 Implementation Design

## 1. Overview
Google Gemini (2026) has transitioned to a fully incremental streaming model for its web application. It utilizes a stateful session managed by multiple secure cookies and a dynamic synchronization token (`SNlM0e`).

## 2. API Endpoints
- **Streaming:** `POST https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerateContent` (Internal web path)
- **Public API:** `POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent`

## 3. Authentication & Security
### A. Cookies
- `__Secure-1PSID`: Primary user session identifier.
- `__Secure-1PSIDTS`: Timestamped session signature.

### B. Synchronization Token (`SNlM0e`)
A dynamic token required for every request to prevent cross-site request forgery and ensure state synchronization. It is extracted from the page's initial state (often in `window.WIZ_global_data`).

## 4. Request Payload (JSON)
```json
{
  "contents": [
    {
      "role": "user",
      "parts": [{ "text": "Your query here" }]
    }
  ],
  "generationConfig": {
    "temperature": 0.7,
    "topK": 40,
    "topP": 0.95,
    "maxOutputTokens": 8192,
    "responseMimeType": "text/plain"
  },
  "safetySettings": [],
  "systemInstruction": { "parts": [{ "text": "System prompt" }] }
}
```

## 5. Streaming Format: `gemini-sse` (Incremental)
**Crucial Update (2026):** Unlike earlier versions that repeated the full response, the 2026 API sends ONLY the incremental delta in each chunk.

### Chunk Structure
```sse
data: {
  "candidates": [{
    "content": {
      "role": "model",
      "parts": [{ "text": " new text delta" }]
    },
    "finishReason": "STOP",
    "index": 0
  }],
  "usageMetadata": { "promptTokenCount": 10, "candidatesTokenCount": 5 }
}
```

### Structured Outputs (JSON Mode)
If `responseMimeType` is `application/json`:
- Deltas are partial strings.
- Implementation must buffer and concatenate all `text` parts until the stream ends, then parse the final accumulated string as JSON.

## 6. Implementation Notes
- **Interception:** Monitor `streamGenerateContent` patterns.
- **Parser:** Use `GeminiSSEParser`. Remove any legacy "diffing" logic as the API is now natively incremental.
- **Auth Extraction:** Use `chrome.scripting` to extract `SNlM0e` from the `gemini.google.com` DOM if tokens expire.
