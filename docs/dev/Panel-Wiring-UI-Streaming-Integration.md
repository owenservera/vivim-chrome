# Panel Wiring Documentation - Message Flow Diagrams

## Overview
This document provides detailed message flow diagrams showing how messages propagate through the Chrome Extension system from user input to AI provider responses and back to the UI.

## High-Level Message Flow Architecture

### Complete Conversation Flow
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User UI   │────►│ Controller  │────►│  Message   │────►│ Background  │
│   Actions   │     │             │     │    Bus     │     │  Services   │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
         ▲                   ▲                   ▲                   ▲
         │                   │                   │                   │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Streaming  │◄────│  Provider  │◄────│ Streaming  │◄────│ Conversation│
│  Updates    │     │  Response  │     │  Manager   │     │  Manager    │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

## Detailed Message Flow Sequences

### Sequence 1: User Sends Message

```
1. User types in textarea
2. User clicks Send button
   ↓
3. SidePanelController.sendPrompt()
   - Gets text from promptInput.value
   - Clears textarea
   - Calls onInputChange() to disable button
   ↓
4. chrome.runtime.sendMessage({
     type: 'USER_PROMPT',
     content: text,
     conversationId: null,
     timestamp: Date.now()
   })
   ↓
5. Background messageBus receives USER_PROMPT
   ↓
6. ConversationManager.handleUserPrompt()
   - Stores message via storage.addMessage()
   - Broadcasts to UI via destinationManager.broadcast()
   ↓
7. SidePanelController.handleMessage(MESSAGE_ADDED)
   - Calls addMessage() to update UI
   - Message appears in chat
   ↓
8. Provider (ChatGPT) receives prompt via interception
   - Processes through StreamingManager
   - Begins SSE streaming
```

**Timing:** Immediate UI feedback, streaming begins within 100-500ms

### Sequence 2: Streaming Response Processing

```
1. Provider starts SSE stream (data: JSON chunks)
   ↓
2. StreamingManager.processStream()
   - Initializes DeltaEncodingV1Parser (for ChatGPT)
   - Parser begins reading response stream
   ↓
3. Parser processes chunks
   - For each data: line → JSON.parse()
   - Extracts delta content from choices[0].delta.content
   - Calls onChunk() callback
   ↓
4. StreamingManager.handleChunk()
   - Updates active stream state
   - Sends STREAM_UPDATE via messageBridge
   ↓
5. MessageBus routes STREAM_CHUNK
   ↓
6. ConversationManager.handleStreamChunk()
   - Updates streaming message state
   - Calls broadcastToUI(STREAM_UPDATE)
   ↓
7. SidePanelController.handleMessage(STREAM_UPDATE)
   - Calls updateStreamingMessage()
   - Updates DOM with new content
   - Auto-scrolls message area
   ↓
8. User sees incremental text updates
```

**Chunk Processing:** 50-200ms intervals, batched for performance

### Sequence 3: Stream Completion

```
1. Parser detects [DONE] or connection close
   ↓
2. Parser calls onComplete() callback
   ↓
3. StreamingManager.handleComplete()
   - Updates metrics (success, timing)
   - Sends STREAM_COMPLETE via messageBridge
   - Cleans up stream state
   ↓
4. MessageBus routes STREAM_COMPLETE
   ↓
5. ConversationManager.handleStreamComplete()
   - Finalizes streaming message in storage
   - Calls broadcastToUI(STREAM_COMPLETE)
   ↓
6. SidePanelController.handleMessage(STREAM_COMPLETE)
   - Calls finalizeStreamingMessage()
   - Converts streaming indicator to final message
   - Updates status to 'connected'
   ↓
7. UI shows completed message with metadata
```

**Completion Handling:** Immediate UI update, persistent storage

### Sequence 4: Conversation Loading

```
1. Tab activated or panel opened
   ↓
2. SidePanelController.initializeWithCurrentTab()
   - Gets current tab ID
   - Calls loadConversation()
   ↓
3. chrome.runtime.sendMessage({
     type: 'GET_CONVERSATION',
     tabId: currentTabId
   })
   ↓
4. MessageBus routes GET_CONVERSATION
   ↓
5. ConversationManager.handleGetConversation()
   - Loads messages from storage
   - Returns { messages, conversationId, url }
   ↓
6. Response sent back to controller
   ↓
7. SidePanelController.loadMessages()
   - Updates messageList array
   - Calls renderMessages()
   - Updates message counter
   ↓
8. UI displays conversation history
```

**Loading Performance:** <100ms for cached conversations

## Message Type Reference

### User Action Messages
```javascript
// From UI to Background
{
  type: 'USER_PROMPT',
  content: string,
  conversationId?: string,
  timestamp: number,
  tabId?: number
}

// From UI to Background
{
  type: 'GET_CONVERSATION',
  tabId: number
}

// From UI to Background
{
  type: 'CLEAR_CONVERSATION',
  tabId: number
}
```

### Streaming Messages
```javascript
// From StreamingManager to ConversationManager
{
  type: 'STREAM_CHUNK',
  role: 'assistant',
  content: string,
  model: string,
  seq: number,
  streamId: string,
  timestamp: number,
  tabId: number
}

// From ConversationManager to UI
{
  type: 'STREAM_UPDATE',
  role: 'assistant',
  content: string,
  model: string,
  seq: number,
  tabId: number,
  isFinal: boolean
}

// From StreamingManager/ConversationManager to UI
{
  type: 'STREAM_COMPLETE',
  streamId: string,
  tabId: number
}
```

### Conversation Messages
```javascript
// From ConversationManager to UI
{
  type: 'MESSAGE_ADDED',
  role: 'user' | 'assistant',
  content: string,
  model?: string,
  timestamp: number,
  tabId: number
}

// From ConversationManager to UI
{
  type: 'CONVERSATION_LOADED',
  messages: Array<{
    role: string,
    content: string,
    model?: string,
    timestamp: number
  }>,
  conversationId: string | null,
  tabId: number
}
```

## Error Flow Handling

### Network Error Recovery
```
1. Stream fails (network timeout, etc.)
   ↓
2. StreamingManager.handleError()
   - Checks isRecoverableError()
   - Calls retryStream() if recoverable
   ↓
3. Retry with exponential backoff
   ↓
4. On max retries → STREAM_COMPLETE with error
   ↓
5. UI shows error state
```

### Provider Error Handling
```
1. Provider returns error (401, 429, etc.)
   ↓
2. Parser calls emitError()
   ↓
3. StreamingManager.handleError()
   - Updates failure metrics
   - Sends STREAM_COMPLETE with error
   ↓
4. UI shows error message
   - Status dot turns red
   - Status text shows error
```

## Performance Flow Optimization

### Chunk Batching Strategy
```
1. Parser receives rapid chunks
   ↓
2. Accumulate chunks for 100ms window
   ↓
3. Batch update DOM once per window
   ↓
4. Reset timer for next batch
   ↓
5. Reduces DOM manipulation overhead
```

### Memory Management
```
1. Stream starts
   ↓
2. Create streaming message element
   ↓
3. Accumulate chunks in memory
   ↓
4. On completion/error
   ↓
5. Clean up streaming state
   ↓
6. Convert to final message element
```

## Multi-Tab Coordination

### Tab Switching Flow
```
1. chrome.tabs.onActivated fires
   ↓
2. SidePanelController.bindEvents() handler
   ↓
3. switchTab(newTabId)
   ↓
4. Update currentTabId
   ↓
5. Call loadConversation()
   ↓
6. Send GET_CONVERSATION for new tab
   ↓
7. Load and display new conversation
```

### Cross-Tab Message Isolation
```
1. Message received with tabId
   ↓
2. Controller checks message.tabId === currentTabId
   ↓
3. If match → process message
   ↓
4. If no match → ignore message
   ↓
5. Prevents UI updates for wrong tab
```

## Testing Message Flows

### Unit Test Coverage
- **Controller Tests**: Mock chrome.runtime, verify message sending
- **Message Routing**: Verify bus routes messages to correct handlers
- **Streaming Pipeline**: Mock SSE responses, verify chunk processing

### Integration Test Scenarios
```javascript
// Complete conversation flow
test('user message to streaming response', async () => {
  // 1. Send USER_PROMPT
  // 2. Verify MESSAGE_ADDED received
  // 3. Mock SSE chunks
  // 4. Verify STREAM_UPDATE messages
  // 5. Send completion
  // 6. Verify final message state
});
```

### Performance Benchmarks
- **Message Latency**: <50ms end-to-end for simple messages
- **Streaming Responsiveness**: <200ms for chunk-to-UI updates
- **Memory Usage**: <10MB for extended conversations
- **Concurrent Streams**: Support 3+ simultaneous conversations

---

*These message flow diagrams provide the complete wiring specification for how the side panel coordinates with the streaming system. Use this reference for debugging, testing, and extending the message routing architecture.*</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Panel-Wiring-Message-Flow.md