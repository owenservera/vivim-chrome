# Panel Wiring - Quick Reference

## Component Overview

### Core Components
| Component | File | Responsibility |
|-----------|------|----------------|
| **SidePanelController** | `src/ui/SidePanelController.js` | Main UI orchestrator, state management |
| **Message Bus** | `src/core/messaging/MessageBus.js` | Inter-component communication |
| **ConversationManager** | `src/background/services/ConversationManager.js` | Message persistence, streaming coordination |
| **StreamingManager** | `src/core/streaming/StreamingManager.js` | SSE parsing, chunk processing |
| **Provider Classes** | `src/providers/*/Provider.js` | AI provider integration |

### Key Files
- `sidepanel.html` - UI structure and styling
- `src/ui/index.js` - UI entry point and message routing
- `src/background/index.js` - Background service orchestration
- `manifest.json` - Extension permissions and configuration

## Message Types Reference

### User Actions → Background
```javascript
// Send user message
{
  type: 'USER_PROMPT',
  content: string,
  conversationId?: string,
  timestamp: number
}

// Load conversation
{
  type: 'GET_CONVERSATION',
  tabId: number
}

// Clear conversation
{
  type: 'CLEAR_CONVERSATION',
  tabId: number
}

// Switch provider
{
  type: 'PROVIDER_CHANGED',
  providerId: string,
  tabId: number
}
```

### Background → UI Updates
```javascript
// Add completed message
{
  type: 'MESSAGE_ADDED',
  role: 'user' | 'assistant',
  content: string,
  model?: string,
  timestamp: number,
  tabId: number
}

// Update streaming content
{
  type: 'STREAM_UPDATE',
  content: string,
  model: string,
  seq: number,
  tabId: number,
  isFinal: boolean
}

// Mark streaming complete
{
  type: 'STREAM_COMPLETE',
  tabId: number
}

// Load conversation data
{
  type: 'CONVERSATION_LOADED',
  messages: Array,
  conversationId: string | null,
  tabId: number
}
```

## State Management Quick Reference

### Controller State Properties
```javascript
this.currentTabId          // Active browser tab
this.currentProvider       // Selected AI provider
this.messageList          // Conversation messages
this.streamingMessage     // Active streaming element
this.connectionStatus     // 'connecting' | 'connected' | 'streaming' | 'error'
```

### State Operations
```javascript
// Initialize controller
const controller = new SidePanelController();

// Load conversation for tab
await controller.loadConversation();

// Switch providers
await controller.switchProvider('claude');

// Send user message
controller.sendPrompt();

// Update streaming content
controller.updateStreamingMessage(content, model, seq, isFinal);
```

## Event Handling Patterns

### DOM Event Binding
```javascript
// Input handling
promptInput.addEventListener('input', () => this.onInputChange());
promptInput.addEventListener('keydown', (e) => this.onInputKeyDown(e));

// Button actions
sendBtn.addEventListener('click', () => this.sendPrompt());

// Provider switching
providerSelect.addEventListener('click', () => this.showProviderMenu());
```

### Message Event Routing
```javascript
// UI message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'STREAM_UPDATE':
      this.handleStreamUpdate(message);
      break;
    case 'MESSAGE_ADDED':
      this.handleMessageAdded(message);
      break;
  }
  return message.needsResponse;
});
```

### Browser Event Handling
```javascript
// Tab switching
chrome.tabs.onActivated.addListener((activeInfo) => {
  this.switchTab(activeInfo.tabId);
});

// Background connection check
await chrome.runtime.sendMessage({ type: 'PING' });
```

## Performance Optimization Checklist

### Chunk Processing
- [ ] Batch chunks to reduce DOM updates
- [ ] Debounce streaming updates (50ms windows)
- [ ] Use `requestAnimationFrame` for DOM manipulation
- [ ] Pool message elements to reduce GC pressure

### Memory Management
- [ ] Limit message history (100 messages max)
- [ ] Clear streaming state on completion
- [ ] Use `document.createDocumentFragment()` for bulk updates
- [ ] Implement virtual scrolling for long conversations

### Network Optimization
- [ ] Pool background connections
- [ ] Compress message batches
- [ ] Cache provider responses
- [ ] Implement request deduplication

## Common Issues & Solutions

### Issue: Messages not updating UI
```javascript
// Check tab ID filtering
if (message.tabId && message.tabId !== this.currentTabId) {
  return; // Ignore messages for other tabs
}

// Verify message routing
console.log('Received message:', message.type, message);
```

### Issue: Streaming not working
```javascript
// Check streaming element creation
if (!this.streamingMessage) {
  this.streamingMessage = this.createStreamingElement();
}

// Verify content updates
this.streamingMessage.querySelector('.content').innerHTML = content;
```

### Issue: Provider switching fails
```javascript
// Check auth status
const hasAuth = await this.checkProviderAuth(providerId);
if (!hasAuth) {
  this.promptUserLogin(providerId);
  return;
}

// Verify provider registration
const provider = this.providerRegistry.get(providerId);
if (!provider) {
  console.error('Provider not registered:', providerId);
}
```

### Issue: Memory usage high
```javascript
// Implement cleanup
this.messageList = this.messageList.slice(-50); // Keep last 50
this.clearStreamingState();
if (window.gc) window.gc(); // Force GC if available
```

## Testing Commands

### Message Flow Testing
```bash
# Test message routing
npm test -- --grep "message.*routing"

# Test streaming updates
npm test -- --grep "streaming.*update"

# Test provider switching
npm test -- --grep "provider.*switch"
```

### Performance Testing
```bash
# Benchmark chunk processing
npm run benchmark chunk-processing

# Test memory usage
npm run test memory-usage

# Profile DOM updates
npm run profile dom-updates
```

### Integration Testing
```bash
# End-to-end conversation flow
npm test -- --grep "e2e.*conversation"

# Multi-tab testing
npm test -- --grep "multi.*tab"

# Provider integration
npm test -- --grep "provider.*integration"
```

## Code Snippets

### Initialize Panel Controller
```javascript
import { SidePanelController } from './SidePanelController.js';

// Create and initialize
const controller = new SidePanelController();

// Controller automatically:
// - Binds DOM events
// - Sets up message listeners
// - Initializes with current tab
// - Loads conversation history
```

### Handle Streaming Updates
```javascript
handleStreamUpdate(message) {
  const { content, model, seq, isFinal } = message;

  // Update status
  this.updateConnectionStatus('streaming');

  // Update UI
  this.updateStreamingMessage(content, model, seq, isFinal);

  // Handle completion
  if (isFinal) {
    this.finalizeStreamingMessage(model);
    this.updateConnectionStatus('connected');
  }
}
```

### Provider Switching
```javascript
async switchProvider(providerId) {
  try {
    // Update UI immediately
    this.updateProviderDisplay(providerId);

    // Notify background
    const response = await chrome.runtime.sendMessage({
      type: 'PROVIDER_CHANGED',
      providerId,
      tabId: this.currentTabId
    });

    if (response.success) {
      // Update local state
      this.currentProvider = response.provider;

      // Clear current conversation
      this.clearMessages();

      // Load provider-specific conversation
      this.loadConversation();
    }
  } catch (error) {
    this.showError('Provider switch failed');
  }
}
```

### Error Handling
```javascript
handleError(error) {
  // Update UI status
  this.updateConnectionStatus('error');

  // Show user-friendly message
  this.showErrorMessage(this.formatError(error));

  // Attempt recovery
  setTimeout(() => this.attemptRecovery(), 3000);
}
```

## Architecture Diagrams

### Message Flow Summary
```
User Input → Controller → Message Bus → Background → Provider → Streaming → UI Update
     ↓           ↓            ↓           ↓          ↓          ↓         ↓
   Events → Handlers → Routing → Processing → Requests → Parsing → Rendering
```

### State Synchronization
```
UI State ← Controller ← Message Bus ← Background ← Provider ← Streaming ← SSE
   ↓           ↓            ↓           ↓          ↓          ↓       ↓
Updates ← Management ← Routing ← Services ← Integration ← Processing ← Parsing
```

### Performance Layers
```
User Experience ← UI Optimization ← Message Batching ← Connection Pooling ← Caching
      ↓               ↓              ↓                ↓              ↓
   Responsiveness ← Smooth Updates ← Efficient Routing ← Reuse ← Fast Access
```

## Related Documentation

- **[Architecture Overview](Panel-Wiring-Architecture-Overview.md)** - Detailed system design
- **[Message Flow](Panel-Wiring-Message-Flow.md)** - Complete message sequences
- **[UI-Streaming Integration](Panel-Wiring-UI-Streaming-Integration.md)** - Real-time updates
- **[Event Handling](Panel-Wiring-Event-Handling.md)** - Interaction processing
- **[State Management](Panel-Wiring-State-Management.md)** - Data persistence
- **[Performance Considerations](Panel-Wiring-Performance-Considerations.md)** - Optimization strategies

---

*This quick reference provides immediate access to key concepts, code patterns, and troubleshooting information for the panel wiring system. For detailed explanations, see the full documentation set.*</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Panel-Wiring-Quick-Reference.md