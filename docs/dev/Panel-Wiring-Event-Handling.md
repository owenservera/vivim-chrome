# Panel Wiring Documentation - Provider Switching

## Overview
This document details how the side panel implements provider switching functionality, allowing users to seamlessly switch between different AI providers (ChatGPT, Claude, Gemini) while maintaining conversation state and UI consistency.

## Provider Management Architecture

### Provider Registry Integration
```javascript
// Background provider registry (src/core/providers/ProviderRegistry.js)
export class ProviderRegistry {
  constructor() {
    this.providers = new Map();
    this.activeProvider = null;
  }

  register(provider) {
    this.providers.set(provider.id, provider);
    if (!this.activeProvider) {
      this.activeProvider = provider;
    }
  }

  switchTo(providerId) {
    const provider = this.providers.get(providerId);
    if (provider) {
      this.activeProvider = provider;
      this.emit('providerChanged', provider);
      return true;
    }
    return false;
  }

  getAvailableProviders() {
    return Array.from(this.providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      capabilities: p.capabilities
    }));
  }
}
```

### UI Provider Selector
```html
<!-- Provider selector in header -->
<div class="sidepanel__header__controls">
  <button class="header-btn" id="providerSelect" type="button" aria-label="Select AI provider" title="Select provider">
    <span class="provider-dot" id="providerDot" aria-hidden="true"></span>
    <span id="providerName">ChatGPT</span>
  </button>
</div>

<!-- Provider selection menu -->
<div class="provider-menu" id="providerMenu" style="display: none;">
  <button class="provider-option" data-provider="chatgpt">
    <span class="provider-dot" style="background: #10A37F;"></span>
    <span>ChatGPT</span>
  </button>
  <button class="provider-option" data-provider="claude">
    <span class="provider-dot" style="background: #D97757;"></span>
    <span>Claude</span>
  </button>
  <button class="provider-option" data-provider="gemini">
    <span class="provider-dot" style="background: #4285F4;"></span>
    <span>Gemini</span>
  </button>
</div>
```

## Provider Switching Flow

### 1. User Initiates Switch
```javascript
// UI event handler
document.getElementById('providerSelect').addEventListener('click', () => {
  const menu = document.getElementById('providerMenu');
  menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
});

// Provider selection
document.querySelectorAll('.provider-option').forEach(option => {
  option.addEventListener('click', (e) => {
    const providerId = e.currentTarget.dataset.provider;
    this.switchProvider(providerId);
  });
});
```

### 2. Controller Handles Switch
```javascript
// SidePanelController.switchProvider()
async switchProvider(providerId) {
  try {
    // Notify background of provider change
    const response = await chrome.runtime.sendMessage({
      type: MessageTypes.PROVIDER_CHANGED,
      providerId: providerId,
      tabId: this.currentTabId
    });

    if (response.success) {
      // Update UI
      this.currentProvider = response.provider;
      this.updateProviderDisplay(response.provider);

      // Clear current conversation (optional)
      this.clearMessages();

      // Load provider-specific conversation
      this.loadConversation();
    }
  } catch (error) {
    this.showError('Failed to switch provider');
  }
}
```

### 3. Background Processes Switch
```javascript
// Background message handler
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === MessageTypes.PROVIDER_CHANGED) {
    const success = providerRegistry.switchTo(message.providerId);
    if (success) {
      // Update conversation manager for new provider
      conversationManager.setActiveProvider(message.providerId);

      // Switch interception patterns
      this.updateInterceptionForProvider(message.providerId);

      sendResponse({
        success: true,
        provider: providerRegistry.getActiveProvider()
      });
    } else {
      sendResponse({ success: false, error: 'Provider not available' });
    }
  }
});
```

## Provider-Specific Wiring

### ChatGPT Provider Wiring
```javascript
// ChatGPT provider configuration
{
  id: 'chatgpt',
  name: 'ChatGPT',
  hosts: ['chatgpt.com', 'chat.com'],
  capabilities: {
    supportsStreaming: true,
    supportsAuth: true,
    messageFormat: 'openai'
  },
  interceptPatterns: {
    request: /\/backend-api(\/f)?\/conversation(\?|$)/
  }
}

// Interception setup
onRequest(ctx) {
  // Extract auth from next-auth session
  const auth = ctx.headers['Authorization'];
  if (auth) {
    this.authStore.setAuthData(auth);
  }
}

onResponse(ctx) {
  // Use DeltaEncodingV1Parser for internal format
  streamingManager.processStream({
    streamId: 'chatgpt_' + Date.now(),
    response: ctx.response,
    format: 'delta-encoding-v1',
    metadata: { provider: 'chatgpt' }
  });
}
```

### Claude Provider Wiring (Planned)
```javascript
// Claude provider configuration
{
  id: 'claude',
  name: 'Claude',
  hosts: ['claude.ai'],
  capabilities: {
    supportsStreaming: true,
    supportsAuth: true,
    messageFormat: 'anthropic'
  },
  interceptPatterns: {
    request: /\/api\/append_message/
  }
}

// Interception setup
onRequest(ctx) {
  // Extract sessionKey cookie
  // Validate org UUID
}

onResponse(ctx) {
  // Use ClaudeSSEParser for event-based streaming
  streamingManager.processStream({
    streamId: 'claude_' + Date.now(),
    response: ctx.response,
    format: 'claude-sse',
    metadata: { provider: 'claude' }
  });
}
```

### Gemini Provider Wiring (Planned)
```javascript
// Gemini provider configuration
{
  id: 'gemini',
  name: 'Gemini',
  hosts: ['gemini.google.com', 'generativelanguage.googleapis.com'],
  capabilities: {
    supportsStreaming: true,
    supportsAuth: true,
    messageFormat: 'google'
  },
  interceptPatterns: {
    request: /\/generateContent\?/
  }
}

// Interception setup
onRequest(ctx) {
  // Extract __Secure-1PSID cookies
  // Get SNlM0e token from page
}

onResponse(ctx) {
  // Use GeminiSSEParser for full-response streaming
  streamingManager.processStream({
    streamId: 'gemini_' + Date.now(),
    response: ctx.response,
    format: 'gemini-sse',
    metadata: { provider: 'gemini' }
  });
}
```

## State Management During Switching

### Conversation Isolation
```javascript
// Provider-specific conversation storage
getConversationKey(tabId, conversationId, providerId) {
  return `${providerId}_${tabId}_${conversationId || 'temp'}`;
}

// Switch provider → load provider-specific conversation
switchProvider(providerId) {
  // Save current conversation
  this.saveCurrentConversation();

  // Switch active provider
  this.activeProvider = providerId;

  // Load provider-specific conversation
  this.loadConversationForProvider(providerId);
}
```

### UI State Preservation
```javascript
// Maintain UI state across provider switches
switchProviderUI(provider) {
  // Update header indicators
  this.updateProviderDisplay(provider);

  // Preserve message input
  // Keep connection status
  // Maintain scroll position if possible

  // Clear streaming state
  this.finalizeStreamingMessage();
  this.streamingMessage = null;
}
```

## Interception Pattern Switching

### Dynamic Interception
```javascript
// Background service worker
updateInterceptionForProvider(providerId) {
  // Remove old listeners
  if (this.currentInterception) {
    chrome.webRequest.onBeforeRequest.removeListener(this.currentInterception);
  }

  // Add new interception based on provider
  const provider = this.providerRegistry.getActiveProvider();
  if (provider.interceptPatterns) {
    this.currentInterception = this.createInterceptionHandler(provider);
    chrome.webRequest.onBeforeRequest.addListener(
      this.currentInterception,
      { urls: provider.hosts.map(h => `*://${h}/*`) },
      ['requestBody']
    );
  }
}
```

### Content Script Coordination
```javascript
// Inject provider-specific content scripts
injectProviderScript(providerId) {
  const scripts = {
    chatgpt: 'content/chatgpt-intercept.js',
    claude: 'content/claude-intercept.js',
    gemini: 'content/gemini-intercept.js'
  };

  chrome.scripting.executeScript({
    target: { tabId: this.currentTabId },
    files: [scripts[providerId]]
  });
}
```

## Error Handling & Fallbacks

### Provider Unavailable
```javascript
// Handle provider switching failures
switchProvider(providerId) {
  try {
    const result = await this.attemptProviderSwitch(providerId);
    if (!result.success) {
      throw new Error(result.error);
    }
  } catch (error) {
    // Fallback to previous provider
    this.showError(`Cannot switch to ${providerId}: ${error.message}`);
    this.revertProviderSwitch();
  }
}
```

### Auth Issues on Switch
```javascript
// Check auth availability before switching
async canSwitchToProvider(providerId) {
  const provider = this.providers.get(providerId);
  if (provider.capabilities.requiresAuth) {
    const hasAuth = await this.checkProviderAuth(providerId);
    if (!hasAuth) {
      // Prompt user to log in
      this.promptProviderLogin(providerId);
      return false;
    }
  }
  return true;
}
```

## UI Feedback During Switching

### Loading States
```javascript
// Show switching indicator
showProviderSwitching(providerName) {
  this.updateConnectionStatus('switching');
  this.statusText.textContent = `Switching to ${providerName}...`;

  // Disable input during switch
  this.promptInput.disabled = true;
  this.sendBtn.disabled = true;
}

// Complete switching
completeProviderSwitch(provider) {
  this.updateConnectionStatus('connected');
  this.updateProviderDisplay(provider);

  // Re-enable input
  this.promptInput.disabled = false;
  this.onInputChange();
}
```

### Provider Status Indicators
```javascript
// Update provider availability status
updateProviderStatus() {
  const providers = this.getAvailableProviders();
  providers.forEach(provider => {
    const status = this.checkProviderStatus(provider.id);
    this.updateProviderMenuItem(provider.id, status);
  });
}

// Visual status in menu
updateProviderMenuItem(providerId, status) {
  const item = document.querySelector(`[data-provider="${providerId}"]`);
  if (status.available) {
    item.classList.remove('disabled');
  } else {
    item.classList.add('disabled');
    item.title = status.reason || 'Provider unavailable';
  }
}
```

## Testing Provider Switching

### Unit Tests
```javascript
testProviderSwitching() {
  // Test registry switching
  // Verify interception updates
  // Check UI state preservation
}

testProviderAvailability() {
  // Mock auth states
  // Test switching with/without auth
  // Verify error handling
}
```

### Integration Tests
```javascript
testEndToEndProviderSwitch() {
  // Switch from ChatGPT to Claude
  // Verify conversation isolation
  // Test streaming with new provider
  // Confirm UI updates correctly
}
```

## Future Enhancements

### Advanced Provider Features
- **Provider Preferences**: Default provider, fallback order
- **Custom Endpoints**: User-configured API endpoints
- **Provider Plugins**: Dynamically loaded provider extensions
- **Multi-Provider Conversations**: Mix providers in single conversation

### UI Improvements
- **Provider Comparison**: Feature matrix display
- **Quick Switch**: Keyboard shortcuts for provider switching
- **Provider History**: Track usage by provider
- **Provider Health**: Show response times and reliability

---

*This document specifies how the side panel implements seamless provider switching while maintaining conversation state, UI consistency, and system reliability.*</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Panel-Wiring-Provider-Switching.md