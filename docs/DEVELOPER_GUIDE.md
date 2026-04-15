# VIVIM Extension - Developer Guide

## Welcome to VIVIM Extension Development

This guide is for developers who want to contribute to, extend, or understand the VIVIM Extension codebase. VIVIM is built with modern web technologies and follows best practices for Chrome extension development.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Development Setup](#development-setup)
3. [Architecture Deep Dive](#architecture-deep-dive)
4. [Plugin System](#plugin-system)
5. [Contributing Guidelines](#contributing-guidelines)
6. [API Reference](#api-reference)
7. [Testing](#testing)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)

---

## Project Overview

### Technology Stack

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Build System** | Vite | ^5.0.0 | Fast development and optimized builds |
| **Frontend** | React | ^18.2.0 | Modern UI framework with hooks |
| **State Management** | React Context | - | Global state management |
| **Database** | Dexie.js | ^3.2.0 | IndexedDB wrapper for local storage |
| **Styling** | Tailwind CSS | ^3.4.0 | Utility-first CSS framework |
| **TypeScript** | TypeScript | ^5.0.0 | Type safety and better DX |
| **Testing** | Jest + Playwright | - | Unit and E2E testing |
| **Linting** | ESLint + Prettier | - | Code quality and formatting |

### Project Structure

```
vivim-extension/
├── src/                          # Source code
│   ├── background/               # Service worker
│   │   ├── services/            # Core services
│   │   ├── providers/           # AI provider implementations
│   │   └── index.ts             # Background script entry
│   ├── content/                 # Content scripts
│   │   ├── scripts/             # Content script implementations
│   │   └── index.ts             # Content script entry
│   ├── ui/                      # React UI components
│   │   ├── components/          # Reusable components
│   │   ├── pages/               # Page components
│   │   ├── hooks/               # Custom React hooks
│   │   └── contexts/            # React contexts
│   ├── lib/                     # Utility libraries
│   │   ├── crypto.ts            # Encryption utilities
│   │   ├── storage.ts           # Storage abstractions
│   │   └── streaming.ts         # Stream processing
│   └── types/                   # TypeScript definitions
├── public/                      # Static assets
│   ├── icons/                   # Extension icons
│   ├── fonts/                   # Custom fonts
│   └── _locales/                # Localization files
├── docs/                        # Documentation
├── test/                        # Test files
├── dist/                        # Build output
├── manifest.json                # Extension manifest
├── package.json                 # NPM configuration
├── vite.config.ts               # Build configuration
├── tsconfig.json                # TypeScript configuration
└── tailwind.config.js           # Tailwind configuration
```

### Key Design Principles

#### 1. Local-First Architecture
- All user data stored locally in IndexedDB
- No server dependencies for core functionality
- Data export/import for portability

#### 2. Plugin-Based Extensibility
- Modular provider system for AI services
- Clean interfaces for adding new features
- Hot-swappable components

#### 3. Privacy by Design
- No telemetry or data collection
- Encrypted API key storage
- Minimal required permissions

#### 4. Performance First
- Lazy loading for large features
- Efficient stream processing
- Optimized bundle sizes

---

## Development Setup

### Prerequisites

- **Node.js**: v18+ (LTS recommended)
- **npm**: v8+ or **yarn**: v1.22+
- **Chrome**: v100+ for testing
- **Git**: For version control

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/vivim-extension.git
cd vivim-extension

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development server
npm run dev
```

### Development Workflow

```bash
# Development server with hot reload
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint and format code
npm run lint
npm run format

# Type checking
npm run type-check
```

### Environment Configuration

Create a `.env.local` file for development:

```bash
# Development API keys (optional - for testing)
VITE_OPENAI_API_KEY=your_openai_key_here
VITE_ANTHROPIC_API_KEY=your_anthropic_key_here

# Development settings
VITE_DEV_MODE=true
VITE_LOG_LEVEL=debug
```

### Chrome Extension Setup

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **"Developer mode"** (toggle in top right)
3. Click **"Load unpacked"**
4. Select the `dist` folder from your project
5. The extension will appear in your toolbar

For development with hot reload:
```bash
npm run dev
# Then reload the extension in chrome://extensions/
```

---

## Architecture Deep Dive

### Core Components

#### 1. Background Service Worker (`src/background/`)

The service worker handles:
- **API Communication**: Manages all AI provider API calls
- **Stream Processing**: Handles real-time streaming responses
- **Storage Management**: CRUD operations for conversations
- **Message Routing**: Inter-component communication
- **Tab Management**: Tracks active tabs for context

```typescript
// src/background/index.ts
import { ProviderRegistry } from './providers/registry';
import { ConversationManager } from './services/conversation-manager';
import { StreamProcessor } from './services/stream-processor';

class BackgroundController {
  private providerRegistry: ProviderRegistry;
  private conversationManager: ConversationManager;
  private streamProcessor: StreamProcessor;

  constructor() {
    this.initializeServices();
    this.setupMessageHandlers();
  }

  private initializeServices() {
    this.providerRegistry = new ProviderRegistry();
    this.conversationManager = new ConversationManager();
    this.streamProcessor = new StreamProcessor();
  }

  private setupMessageHandlers() {
    chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
  }

  private async handleMessage(message: any, sender: any) {
    switch (message.type) {
      case 'CHAT_MESSAGE':
        return this.handleChatMessage(message);
      case 'STREAM_START':
        return this.handleStreamStart(message);
      // ... more handlers
    }
  }
}
```

#### 2. Content Scripts (`src/content/`)

Content scripts provide web integration:
- **DOM Interaction**: Inject UI elements into web pages
- **Content Extraction**: Parse web page content for AI processing
- **Event Handling**: Capture user interactions on web pages
- **Cross-Origin Communication**: Bridge between extension and web content

```typescript
// src/content/scripts/web-integration.ts
export class WebIntegration {
  constructor() {
    this.initialize();
  }

  private initialize() {
    this.injectUI();
    this.setupEventListeners();
    this.connectToBackground();
  }

  private injectUI() {
    // Inject VIVIM UI elements into the page
    const container = document.createElement('div');
    container.id = 'vivim-container';
    container.innerHTML = this.getUIHtml();
    document.body.appendChild(container);
  }

  private setupEventListeners() {
    // Listen for user interactions
    document.addEventListener('click', this.handleClick.bind(this));
    document.addEventListener('selectionchange', this.handleSelection.bind(this));
  }

  private connectToBackground() {
    // Establish communication with background script
    chrome.runtime.connect({ name: 'content-script' });
  }
}
```

#### 3. React UI (`src/ui/`)

The React application provides the user interface:
- **Side Panel**: Main chat interface
- **Settings Page**: Configuration options
- **Standalone Mode**: Full-page chat experience
- **Feature UIs**: Specialized interfaces for advanced features

```typescript
// src/ui/pages/SidePanel.tsx
import React, { useState, useEffect } from 'react';
import { useConversations } from '../hooks/useConversations';
import { MessageList } from '../components/MessageList';
import { ChatInput } from '../components/ChatInput';
import { ModelSelector } from '../components/ModelSelector';

export function SidePanel() {
  const { conversations, currentConversation, sendMessage } = useConversations();
  const [selectedModel, setSelectedModel] = useState('gpt-4');

  const handleSendMessage = async (content: string) => {
    await sendMessage(content, selectedModel);
  };

  return (
    <div className="side-panel">
      <header className="panel-header">
        <ModelSelector
          value={selectedModel}
          onChange={setSelectedModel}
        />
      </header>

      <MessageList
        messages={currentConversation?.messages || []}
      />

      <ChatInput
        onSend={handleSendMessage}
        placeholder="Ask me anything..."
      />
    </div>
  );
}
```

### Data Flow Architecture

```
User Input → React UI → Background Script → AI Provider API
      ↓              ↓              ↓              ↓
   UI Update ← Stream Processor ← Response Stream ← AI Response
      ↓              ↓              ↓              ↓
Conversation ← IndexedDB Storage ← Message Storage ← Stream Chunks
```

### Security Architecture

#### API Key Management
```typescript
// src/lib/crypto.ts
export class KeyManager {
  private key: CryptoKey;

  async initialize() {
    // Generate or retrieve encryption key
    const stored = await chrome.storage.local.get('encryption_key');
    if (stored.encryption_key) {
      this.key = await this.importKey(stored.encryption_key);
    } else {
      this.key = await this.generateKey();
    }
  }

  async encryptApiKey(apiKey: string): Promise<string> {
    const encoded = new TextEncoder().encode(apiKey);
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: this.generateIv() },
      this.key,
      encoded
    );
    return this.arrayBufferToBase64(encrypted);
  }

  async decryptApiKey(encryptedKey: string): Promise<string> {
    const encrypted = this.base64ToArrayBuffer(encryptedKey);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: this.storedIv },
      this.key,
      encrypted
    );
    return new TextDecoder().decode(decrypted);
  }
}
```

#### Permission Model
- **Minimal Permissions**: Only required Chrome permissions
- **Runtime Permission Checks**: Validate permissions before use
- **Graceful Degradation**: Features work without optional permissions

---

## Plugin System

### Provider Plugin Architecture

#### Base Provider Interface
```typescript
// src/types/providers.ts
export interface AIProvider {
  readonly id: string;
  readonly name: string;
  readonly models: ModelInfo[];
  readonly capabilities: ProviderCapabilities;

  chat(
    model: string,
    messages: Message[],
    options: ChatOptions
  ): Promise<ReadableStream>;

  generateImage?(
    prompt: string,
    options: ImageOptions
  ): Promise<ImageResult>;

  speech?(
    text: string,
    options: SpeechOptions
  ): Promise<AudioResult>;

  validateAuth(auth: AuthData): Promise<boolean>;
}

export interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
  pricing: PricingInfo;
  capabilities: ModelCapabilities;
}
```

#### Provider Implementation Example
```typescript
// src/background/providers/openai.ts
export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  readonly name = 'OpenAI';

  readonly models: ModelInfo[] = [
    {
      id: 'gpt-4',
      name: 'GPT-4',
      contextLength: 8192,
      pricing: { input: 0.03, output: 0.06 },
      capabilities: { streaming: true, vision: false }
    },
    // ... more models
  ];

  async chat(
    model: string,
    messages: Message[],
    options: ChatOptions
  ): Promise<ReadableStream> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await this.getApiKey()}`
      },
      body: JSON.stringify({
        model,
        messages: this.convertMessages(messages),
        stream: true,
        ...options
      })
    });

    return response.body;
  }

  private async getApiKey(): Promise<string> {
    // Retrieve encrypted API key
    return await keyManager.getApiKey('openai');
  }

  private convertMessages(messages: Message[]): any[] {
    // Convert internal message format to OpenAI format
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));
  }
}
```

### Adding New Providers

#### Step 1: Implement Provider Class
```typescript
// src/background/providers/new-provider.ts
export class NewProvider implements AIProvider {
  readonly id = 'new-provider';
  readonly name = 'New Provider';

  // Implement required methods...
}
```

#### Step 2: Register Provider
```typescript
// src/background/providers/registry.ts
import { NewProvider } from './new-provider';

export class ProviderRegistry {
  private providers = new Map<string, AIProvider>();

  constructor() {
    this.register(new OpenAIProvider());
    this.register(new AnthropicProvider());
    this.register(new NewProvider()); // Add your new provider
  }

  register(provider: AIProvider) {
    this.providers.set(provider.id, provider);
  }
}
```

#### Step 3: Update UI
```typescript
// src/ui/components/ModelSelector.tsx
const PROVIDER_MODELS = {
  openai: ['gpt-4', 'gpt-3.5-turbo'],
  anthropic: ['claude-3-opus', 'claude-3-sonnet'],
  'new-provider': ['model-1', 'model-2'] // Add your models
};
```

### Feature Plugin System

#### Extension Points
```typescript
// src/types/plugins.ts
export interface FeaturePlugin {
  readonly id: string;
  readonly name: string;
  readonly description: string;

  initialize(): Promise<void>;
  destroy(): Promise<void>;

  // Optional UI integration
  getSidebarItem?(): SidebarItem;
  getContextMenuItems?(): ContextMenuItem[];
}

// Example feature plugin
export class YouTubePlugin implements FeaturePlugin {
  readonly id = 'youtube';
  readonly name = 'YouTube Integration';

  async initialize() {
    // Inject content scripts
    // Set up message handlers
  }

  getContextMenuItems(): ContextMenuItem[] {
    return [
      {
        id: 'summarize-video',
        title: 'Summarize Video',
        action: this.summarizeVideo.bind(this)
      }
    ];
  }

  private async summarizeVideo() {
    // Implementation for video summarization
  }
}
```

---

## Contributing Guidelines

### Code Standards

#### TypeScript Guidelines
- Use strict type checking (`"strict": true`)
- Avoid `any` type - use proper type definitions
- Use interfaces for object shapes
- Use enums for fixed value sets

#### React Best Practices
- Use functional components with hooks
- Implement proper error boundaries
- Use custom hooks for shared logic
- Follow component composition patterns

#### Naming Conventions
```typescript
// Files and directories: kebab-case
// src/components/chat-input.tsx
// src/hooks/use-conversations.ts

// Classes: PascalCase
class ConversationManager { }

// Functions and variables: camelCase
function sendMessage() { }
const currentConversation = null;

// Constants: UPPER_SNAKE_CASE
const MAX_TOKENS = 4096;
```

### Pull Request Process

#### 1. Fork and Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/issue-number-description
```

#### 2. Development
- Write tests for new functionality
- Update documentation as needed
- Ensure all tests pass
- Follow the existing code style

#### 3. Testing
```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Manual testing checklist
- [ ] Extension loads without errors
- [ ] Basic chat functionality works
- [ ] Settings page accessible
- [ ] No console errors in background/content scripts
```

#### 4. Pull Request
- **Title**: `feat: add YouTube video summarization`
- **Description**: Detailed explanation of changes
- **Screenshots**: UI changes screenshots
- **Testing**: How to test the changes

#### 5. Code Review
- Address review feedback
- Ensure CI checks pass
- Squash commits if requested

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style changes
- `refactor`: Code refactoring
- `test`: Testing
- `chore`: Maintenance

**Examples:**
```
feat(youtube): add video summarization feature
fix(chat): resolve streaming timeout issue
docs(api): update provider interface documentation
```

---

## API Reference

### Core APIs

#### Conversation Manager
```typescript
interface ConversationManager {
  // Create new conversation
  createConversation(title: string, model: string): Promise<Conversation>;

  // Get conversation by ID
  getConversation(id: string): Promise<Conversation | null>;

  // Update conversation
  updateConversation(id: string, updates: Partial<Conversation>): Promise<void>;

  // Delete conversation
  deleteConversation(id: string): Promise<void>;

  // Search conversations
  searchConversations(query: string): Promise<Conversation[]>;

  // Export conversation
  exportConversation(id: string, format: 'json' | 'markdown'): Promise<string>;
}
```

#### Provider Registry
```typescript
interface ProviderRegistry {
  // Get all available providers
  getProviders(): AIProvider[];

  // Get provider by ID
  getProvider(id: string): AIProvider | null;

  // Get provider for model
  getProviderForModel(modelId: string): AIProvider | null;

  // Get all available models
  getAllModels(): ModelInfo[];
}
```

#### Stream Processor
```typescript
interface StreamProcessor {
  // Process streaming response
  processStream(
    conversationId: string,
    stream: ReadableStream,
    options: StreamOptions
  ): Promise<StreamResult>;

  // Cancel active stream
  cancelStream(conversationId: string): void;

  // Get stream status
  getStreamStatus(conversationId: string): StreamStatus;
}
```

### Chrome Extension APIs

#### Message Passing
```typescript
// Send message to background
chrome.runtime.sendMessage({
  type: 'CHAT_MESSAGE',
  data: { content, model, conversationId }
});

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'STREAM_CHUNK':
      handleStreamChunk(message.data);
      break;
  }
});
```

#### Storage APIs
```typescript
// Local storage (encrypted)
await chrome.storage.local.set({ key: 'value' });
const data = await chrome.storage.local.get('key');

// IndexedDB via Dexie
const db = new Dexie('VIVIMDatabase');
await db.conversations.add(conversation);
```

---

## Testing

### Unit Testing

#### Jest Configuration
```javascript
// jest.config.js
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts'
  ]
};
```

#### Example Test
```typescript
// src/background/services/__tests__/conversation-manager.test.ts
import { ConversationManager } from '../conversation-manager';

describe('ConversationManager', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  it('should create a new conversation', async () => {
    const conversation = await manager.createConversation('Test Chat', 'gpt-4');

    expect(conversation.title).toBe('Test Chat');
    expect(conversation.model).toBe('gpt-4');
    expect(conversation.messages).toEqual([]);
  });

  it('should add messages to conversation', async () => {
    const conversation = await manager.createConversation('Test', 'gpt-4');
    const message = await manager.addMessage(conversation.id, 'user', 'Hello');

    expect(message.content).toBe('Hello');
    expect(message.role).toBe('user');
  });
});
```

### End-to-End Testing

#### Playwright Setup
```typescript
// e2e/chat.spec.ts
import { test, expect } from '@playwright/test';

test('should send and receive messages', async ({ page, extensionId }) => {
  // Load extension
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

  // Type message
  await page.fill('[data-testid="message-input"]', 'Hello AI');

  // Send message
  await page.click('[data-testid="send-button"]');

  // Wait for response
  await page.waitForSelector('[data-testid="ai-response"]');

  // Verify response
  const response = await page.textContent('[data-testid="ai-response"]');
  expect(response).toBeTruthy();
});
```

### Testing Commands

```bash
# Run all tests
npm test

# Run unit tests only
npm run test:unit

# Run E2E tests
npm run test:e2e

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

---

## Deployment

### Build Process

```bash
# Development build
npm run dev

# Production build
npm run build

# Analyze bundle size
npm run build:analyze
```

### Chrome Web Store Submission

#### 1. Package Extension
```bash
# Create production build
npm run build

# Zip the dist folder
zip -r vivim-extension-v2.0.0.zip dist/
```

#### 2. Web Store Preparation
- Update manifest.json with production values
- Remove development-specific code
- Ensure all assets are included
- Test extension in clean Chrome profile

#### 3. Store Listing
- **Name**: VIVIM Extension v2.0
- **Description**: Local-first AI assistant with 30+ models
- **Screenshots**: 5-8 high-quality screenshots
- **Icons**: 128x128 PNG icon
- **Privacy Policy**: Link to privacy policy
- **Support**: GitHub issues or support email

#### 4. Review Process
- Chrome Web Store review typically takes 1-3 days
- Common rejection reasons:
  - Missing permissions justification
  - Inadequate privacy policy
  - Malformed manifest.json
  - Security concerns

### Version Management

#### Semantic Versioning
- **MAJOR**: Breaking changes (2.0.0)
- **MINOR**: New features (2.1.0)
- **PATCH**: Bug fixes (2.0.1)

#### Release Process
```bash
# Update version
npm version patch  # or minor/major

# Build and test
npm run build
npm test

# Create release
git tag v2.0.1
git push origin v2.0.1

# Update changelog
# Update documentation
```

---

## Troubleshooting

### Common Development Issues

#### Extension Not Loading
**Problem**: Extension fails to load in Chrome
**Solutions**:
- Check manifest.json syntax
- Verify all required files exist
- Check console for errors
- Try incognito mode

#### API Calls Failing
**Problem**: AI provider API calls return errors
**Solutions**:
- Verify API keys are set correctly
- Check network connectivity
- Validate API key permissions
- Check provider status pages

#### Build Errors
**Problem**: Vite build fails
**Solutions**:
- Clear node_modules and reinstall
- Check TypeScript errors
- Verify import paths
- Check for circular dependencies

#### Hot Reload Not Working
**Problem**: Changes not reflected in browser
**Solutions**:
- Reload extension in chrome://extensions/
- Check if dev server is running
- Clear browser cache
- Restart dev server

### Performance Issues

#### Slow Builds
- Use `npm run build` instead of dev mode
- Enable build caching
- Split large chunks
- Optimize assets

#### Memory Leaks
- Use React DevTools Profiler
- Check for unmounted component updates
- Monitor IndexedDB connections
- Implement proper cleanup

#### Bundle Size
- Analyze with `npm run build:analyze`
- Lazy load large components
- Tree shake unused dependencies
- Optimize images and assets

### Debugging Tips

#### Background Script Debugging
```typescript
// Add logging
console.log('[Background]', 'Message received:', message);

// Use debugger
debugger;

// Check service worker status
chrome://serviceworker-internals/
```

#### Content Script Debugging
```typescript
// Check injection
console.log('[Content]', 'Script loaded on:', window.location.href);

// Debug DOM manipulation
const element = document.querySelector('#vivim-container');
console.log('[Content]', 'Container found:', !!element);
```

#### React Component Debugging
```typescript
// Use React DevTools
// Add debug logs in components
useEffect(() => {
  console.log('[Component]', 'State changed:', state);
}, [state]);
```

---

## Additional Resources

### Documentation
- **[Architecture Guide](docs/COMPLETE_FEATURE_SET_AND_ARCHITECTURE.md)**
- **[Migration Plan](docs/MIGRATION_PLAN.md)**
- **[PRD](docs/PRD.md)**
- **[API Reference](API_REFERENCE.md)**

### Learning Resources
- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Web Extensions API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions)

### Community
- **GitHub**: [Issues](https://github.com/your-org/vivim-extension/issues) | [Discussions](https://github.com/your-org/vivim-extension/discussions)
- **Discord**: [VIVIM Community](https://discord.gg/vivim)
- **Twitter**: [@VIVIM_Extension](https://twitter.com/VIVIM_Extension)

---

*Thank you for contributing to VIVIM Extension! Your work helps make AI more accessible and private for everyone.*</content>
<parameter name="filePath">DEVELOPER_GUIDE.md