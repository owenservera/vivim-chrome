# Debug Plan - Side Panel Connection Issue

## Debug Path

We need to trace exactly where messages are failing in the chain:

```
Step 1: User types in ChatGPT
    │
    ▼
Step 2: inject-web.js sends to content?
    - Check: inject-web console for [Providers] logs
    - Action: Add logging to confirm messages sent
    │
    ▼
Step 3: content.js receives from inject-web?
    - Check: content console for [Content] Received web-bridge message
    - Action: Add logging to confirm reception
    │
    ▼
Step 4: content.js sends to background?
    - Check: content console for [Content] Forwarding chatChunk to background
    - Action: Add logging to confirm send
    │
    ▼
Step 5: background.js receives from content?
    - Check: background console for [Background] Received message: STREAM_CHUNK
    - Action: Check if message is reaching background
    │
    ▼
Step 6: background.js sends to sidepanel?
    - Check: background console for message emission
    - Action: Add logging to confirm sendToSidePanel called
    │
    ▼
Step 7: sidepanel.js receives from background?
    - Check: sidepanel console for [UI] Message received:
    - Action: Add logging to confirm reception
```

## Quick Diagnostic - Add Health Check

Let me add a quick diagnostic that reports the status of each component in the sidepanel.

We can add a button that pings each layer and reports back.