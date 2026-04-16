# Modular Architecture Refactor Plan

## Current State
- 4 separate message passing contexts
- Inconsistent APIs between components
- No centralized logging
- Hard to trace failures

## Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      MESSAGE FLOW DIAGRAM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │  inject-web  │────▶│   content    │────▶│  background  │   │
│   │   (MAIN)     │     │   (ISOLATED) │     │ (SERVICE WRK)│   │
│   └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                     │                     │            │
│         │ postMessage         │ chrome.runtime      │            │
│         ▼                     ▼                     ▼            │
│   ┌──────────────────────────────────────────────────────┐     │
│   │                  UNIFIED LOGGING                      │     │
│   │   All components log to: [COMPONENT] [ACTION] [data]  │     │
│   └──────────────────────────────────────────────────────┘     │
│                               │                                 │
│                               ▼                                 │
│                        ┌──────────────┐                        │
│                        │  sidepanel   │                        │
│                        │  (ISOLATED)  │                        │
│                        └──────────────┘                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

## 1. Unified Message Protocol

All messages use this structure:
```js
{
  id: 'uuid',           // Unique message ID for tracing
  component: 'inject-web' | 'content' | 'background' | 'sidepanel',
  type: 'USER_PROMPT' | 'STREAM_CHUNK' | etc,
  action: 'send' | 'receive' | 'error',
  payload: { ... },
  timestamp: Date.now(),
  trace: []            // List of components message passed through
}
```

## 2. Centralized Health Check API

Each component exposes a health endpoint:
- `/health` - Returns component status
- `/ping` - Simple connectivity test
- `/trace/:messageId` - Get full path a message took

```js
// background/index.js - Add health endpoint
chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.type === 'PING') {
    respond({ 
      status: 'ok', 
      component: 'background',
      uptime: process.uptime(),
      services: [...services.keys()]
    });
  }
});
```

## 3. Component Responsibilities (Clean Separation)

### inject-web.js
- ONLY: Intercept ChatGPT API calls
- ONLY: Extract data from responses
- ONLY: Send to content via bridge
- DO NOT: Handle messages from background

### content.js  
- ONLY: Bridge inject-web ↔ background
- ONLY: Handle tab/window lifecycle
- DO NOT: Process conversation data

### background.js
- ONLY: Message routing and coordination
- ONLY: Storage operations
- ONLY: Service orchestration
- DO NOT: Direct DOM manipulation

### sidepanel.js
- ONLY: UI rendering
- ONLY: User input handling
- DO NOT: Data processing

## 4. Implementation Steps

### Step 1: Create Message Protocol
- Define MessageTypes in core/
- Add `id` and `trace` to all messages
- Create helper `createMessage(type, payload)`

### Step 2: Add Tracing Middleware
- Each component logs: `[COMPONENT] [IN/OUT] message.type`
- Include trace array in messages
- Build debugging tool to visualize message flow

### Step 3: Health Check Endpoints
- Add PING handler to each component
- Create unified status page in sidepanel
- Show: inject-web ↔ content ↔ background ↔ sidepanel

### Step 4: Error Boundary
- Each component catches errors and reports back
- Add `ERROR` message type with stack trace
- Show last error in sidepanel status

### Step 5: Refactor Code
- Move logic to appropriate layers
- Remove cross-context dependencies
- Add JSDoc with clear interfaces

## File Structure After Refactor

```
src/
├── core/
│   ├── protocol/
│   │   ├── MessageTypes.js      # Enum of all message types
│   │   ├── MessageFactory.js    # Create standardized messages
│   │   └── MessageValidator.js  # Validate message structure
│   ├── health/
│   │   └── HealthMonitor.js     # Component health tracking
│   └── logging/
│       └── Logger.js            # Unified logging
├── background/
│   ├── index.js                 # Entry point, minimal logic
│   ├── services/
│   │   ├── Router.js            # Message routing
│   │   ├── Storage.js           # Data persistence
│   │   └── TabManager.js       # Tab lifecycle
├── content/
│   ├── index.js                 # Entry point
│   ├── Bridge.js                # inject-web ↔ background bridge
│   └── Health.js                # Content script health
├── inject-web/
│   ├── index.js                 # Entry point  
│   ├── Interceptor.js           # ChatGPT API interception
│   └── Bridge.js                # content ↔ inject-web bridge
└── sidepanel/
    ├── index.js                 # Entry point
    ├── Controller.js            # Main UI orchestrator
    ├── components/              # UI components
    └── StatusPanel.js           # Connection status display
```

## Testing Strategy

1. Unit test each component in isolation
2. Integration test message flow between each pair
3. Add health check to verify all connections
4. Create debug panel to inject test messages