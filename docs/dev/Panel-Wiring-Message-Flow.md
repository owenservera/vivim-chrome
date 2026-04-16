# Panel Wiring Documentation - Architecture Overview

## Overview
This documentation set details how the Chrome Extension side panel connects to and coordinates with the streaming system, AI providers, and background services. The panel serves as the primary user interface for real-time AI conversation streaming.

## Core Architecture

### Panel Components Hierarchy
```
Side Panel (sidepanel.html)
├── Header Section
│   ├── Brand & Status Indicators
│   ├── Provider Selector
│   └── Control Buttons (New, History, Export, Privacy)
├── Message Display Area
│   ├── Message List Container
│   ├── Streaming Message Indicator
│   └── Empty State
├── Input Section
│   ├── Message Input Textarea
│   └── Send Button
└── Status Bar
    ├── Message Counter
    └── Action Buttons (Reload, Clear)
```

### Wiring Architecture
```
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   Side Panel    │◄──►│   Background Bus     │◄──►│   Providers     │
│   (UI Layer)    │    │   (Message Routing)  │    │   (AI Services) │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────────┐    ┌─────────────────┐
│   Controller    │    │   Conversation Mgr   │    │   Streaming Mgr │
│   (State Mgmt)  │    │   (Data Persistence) │    │   (Chunk Proc)  │
└─────────────────┘    └──────────────────────┘    └─────────────────┘
```

## Key Wiring Points

### 1. Message Bus Integration
The side panel connects to the background system through a centralized message bus:

```javascript
// UI Entry Point (src/ui/index.js)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  controller.handleMessage(message, sender, sendResponse);
  return message.needsResponse;
});
```

### 2. Controller-Provider Coordination
The `SidePanelController` coordinates between user interactions and provider streaming:

```javascript
// User sends message → Controller → Message Bus → Provider → Streaming
sendPrompt() → USER_PROMPT → ConversationManager → Provider → Stream Chunks
```

### 3. Real-time Streaming Pipeline
```
User Input → Background Bus → Provider Streaming → Chunk Processing → UI Updates
     ↓             ↓              ↓               ↓              ↓
Textarea   → USER_PROMPT →  SSE Parser    → STREAM_UPDATE → DOM Updates
```

### 4. State Synchronization
The panel maintains synchronized state across:
- Current tab ID and conversation
- Streaming status and progress
- Provider selection and availability
- Message history and metadata

## Component Wiring Details

### SidePanelController Wiring
**Responsibilities:**
- DOM event binding and handling
- Message routing to/from background
- UI state management
- Real-time streaming updates

**Key Connections:**
```javascript
// To Background Services
chrome.runtime.sendMessage(USER_PROMPT)
chrome.runtime.sendMessage(GET_CONVERSATION)

// From Background Services
handleMessage(STREAM_UPDATE) → updateStreamingMessage()
handleMessage(MESSAGE_ADDED) → addMessage()
handleMessage(CONVERSATION_LOADED) → loadMessages()
```

### Background Service Wiring
**Message Bus Routing:**
```javascript
// Message Bus Configuration (src/background/index.js)
messageBus.on(USER_PROMPT) → ConversationManager.handleUserPrompt()
messageBus.on(STREAM_CHUNK) → ConversationManager.handleStreamChunk()
messageBus.on(GET_CONVERSATION) → ConversationManager.handleGetConversation()
```

### Provider Integration Wiring
**Streaming Pipeline:**
```javascript
// Provider → StreamingManager → ConversationManager → UI
provider.streamResponse() → processStream() → handleStreamChunk() → broadcastToUI()
```

## Data Flow Patterns

### 1. User Message Flow
```
1. User types message in textarea
2. Clicks send or presses Enter
3. Controller.sendPrompt() called
4. chrome.runtime.sendMessage(USER_PROMPT) sent
5. ConversationManager.handleUserPrompt() stores message
6. broadcastToUI(MESSAGE_ADDED) updates panel
7. Provider receives prompt and begins streaming
```

### 2. Streaming Response Flow
```
1. Provider starts SSE stream
2. StreamingManager.processStream() processes chunks
3. Each chunk → ConversationManager.handleStreamChunk()
4. broadcastToUI(STREAM_UPDATE) sent to panel
5. Controller.updateStreamingMessage() updates DOM
6. On completion → STREAM_COMPLETE → finalize message
```

### 3. Conversation Loading Flow
```
1. Tab activated or panel opened
2. Controller.initializeWithCurrentTab() gets tabId
3. chrome.runtime.sendMessage(GET_CONVERSATION) sent
4. ConversationManager.handleGetConversation() loads messages
5. Response sent back to controller
6. Controller.loadMessages() renders conversation
```

## Event Handling Wiring

### UI Event Bindings
```javascript
// SidePanelController.bindEvents()
promptInput.addEventListener('input') → onInputChange()
promptInput.addEventListener('keydown') → onInputKeyDown()
sendBtn.addEventListener('click') → sendPrompt()

// Chrome API Events
chrome.tabs.onActivated → switchTab()
```

### Message Event Routing
```javascript
// Message Types Handled by Controller
MESSAGE_ADDED → addMessage()
STREAM_UPDATE → updateStreamingMessage()
STREAM_COMPLETE → finalizeStreamingMessage()
CONVERSATION_LOADED → loadMessages()
CONVERSATION_CLEARED → clearMessages()
TAB_DETECTED → loadConversation()
```

## State Management Wiring

### Controller State Properties
```javascript
this.currentTabId        // Active tab being monitored
this.currentProvider     // Selected AI provider
this.messageList         // Conversation messages array
this.streamingMessage    // Current streaming message element
this.connectionStatus    // 'connecting' | 'connected' | 'streaming' | 'error'
```

### State Synchronization
- **Tab Switching**: Automatically loads conversation for new tab
- **Provider Changes**: Updates UI indicators and routing
- **Streaming State**: Visual indicators and message finalization
- **Message History**: Persistent storage via ConversationManager

## Performance Considerations

### Streaming Optimization
- **Chunk Batching**: Accumulate small chunks before DOM updates
- **Scroll Management**: Auto-scroll during streaming with smooth behavior
- **Memory Management**: Clean up streaming state on completion

### Message Processing
- **Debounced Updates**: Prevent excessive DOM updates during rapid streaming
- **Efficient Rendering**: Use document fragments for bulk message updates
- **Lazy Loading**: Load conversation history on demand

## Error Handling Wiring

### UI Error States
```javascript
// Connection failures
checkBackgroundConnection() → updateConnectionStatus('error')

// Streaming failures
handleMessage(STREAM_COMPLETE with error) → showError()

// Provider failures
handleMessage(ERROR) → updateStatusText()
```

### Recovery Mechanisms
- **Auto-retry**: Failed connections automatically retry
- **Fallback Display**: Show cached messages when loading fails
- **Graceful Degradation**: Continue with limited functionality on errors

## Testing Wiring

### Component Isolation
- **Controller Tests**: Mock chrome.runtime.sendMessage
- **Message Flow Tests**: Verify event routing through bus
- **Streaming Tests**: Simulate chunk sequences and completion

### Integration Testing
- **End-to-End**: User input → streaming response → UI update
- **Multi-Tab**: Tab switching with conversation persistence
- **Provider Switching**: UI updates and message routing

## Future Wiring Extensions

### Planned Enhancements
- **Provider Management UI**: Dynamic provider list and configuration
- **Conversation History**: Cross-tab conversation persistence
- **Advanced Streaming**: Tool calls, usage tracking, multi-modal content
- **Collaboration Features**: Multi-user conversation sharing

### Modular Extension Points
- **Plugin Architecture**: Provider plugins with standardized interfaces
- **Custom UI Components**: Extensible message types and renderers
- **Advanced Routing**: Conditional message routing based on content/context

---

*This architecture overview provides the foundation for understanding how the side panel wires into the streaming system. See specific component documents for detailed wiring implementations.*</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Panel-Wiring-Architecture-Overview.md