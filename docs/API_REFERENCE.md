# VIVIM Extension - API Reference

## Overview

This document provides comprehensive API reference for VIVIM Extension v2.0. It covers all public APIs, interfaces, and extension points available for developers.

---

## Table of Contents

1. [Core APIs](#core-apis)
2. [Provider APIs](#provider-apis)
3. [UI Component APIs](#ui-component-apis)
4. [Storage APIs](#storage-apis)
5. [Plugin APIs](#plugin-apis)
6. [Message Passing APIs](#message-passing-apis)
7. [Extension APIs](#extension-apis)
8. [Type Definitions](#type-definitions)

---

## Core APIs

### ConversationManager

Manages conversation lifecycle, storage, and operations.

```typescript
class ConversationManager {
  // Create a new conversation
  async createConversation(
    title: string,
    model: string,
    provider?: string
  ): Promise<Conversation>

  // Retrieve conversation by ID
  async getConversation(id: string): Promise<Conversation | null>

  // Update conversation properties
  async updateConversation(
    id: string,
    updates: Partial<Conversation>
  ): Promise<void>

  // Delete conversation and all messages
  async deleteConversation(id: string): Promise<void>

  // Search conversations by title/content
  async searchConversations(query: string): Promise<Conversation[]>

  // Export conversation in specified format
  async exportConversation(
    id: string,
    format: ExportFormat
  ): Promise<ExportedData>

  // Import conversation from exported data
  async importConversation(data: ExportedData): Promise<Conversation>

  // Get conversation statistics
  async getStats(): Promise<ConversationStats>
}
```

**Usage:**
```typescript
const manager = new ConversationManager();

// Create conversation
const conversation = await manager.createConversation(
  "My Chat Session",
  "gpt-4",
  "openai"
);

// Add message
await manager.addMessage(conversation.id, {
  role: "user",
  content: "Hello AI!"
});

// Search conversations
const results = await manager.searchConversations("hello");
```

### StreamProcessor

Handles real-time streaming responses from AI providers.

```typescript
class StreamProcessor {
  // Process streaming response
  async processStream(
    conversationId: string,
    stream: ReadableStream,
    options: StreamOptions
  ): Promise<StreamResult>

  // Cancel active stream
  cancelStream(conversationId: string): void

  // Get stream status
  getStreamStatus(conversationId: string): StreamStatus

  // Set stream event handlers
  onChunk(handler: ChunkHandler): void
  onComplete(handler: CompleteHandler): void
  onError(handler: ErrorHandler): void

  // Configure stream processing
  setConfig(config: StreamConfig): void
}
```

**Usage:**
```typescript
const processor = new StreamProcessor();

// Set up event handlers
processor.onChunk((chunk) => {
  console.log('Received chunk:', chunk.content);
});

processor.onComplete((result) => {
  console.log('Stream complete:', result);
});

// Process stream
const result = await processor.processStream(
  conversationId,
  responseStream,
  { timeout: 30000 }
);
```

### ProviderRegistry

Manages AI provider registration and routing.

```typescript
class ProviderRegistry {
  // Register new provider
  register(provider: AIProvider): void

  // Unregister provider
  unregister(providerId: string): void

  // Get provider by ID
  getProvider(id: string): AIProvider | null

  // Get provider for specific model
  getProviderForModel(modelId: string): AIProvider | null

  // Get all registered providers
  getAllProviders(): AIProvider[]

  // Get all available models across providers
  getAllModels(): ModelInfo[]

  // Validate provider configuration
  validateProvider(provider: AIProvider): ValidationResult

  // Get provider capabilities
  getProviderCapabilities(providerId: string): ProviderCapabilities
}
```

**Usage:**
```typescript
const registry = new ProviderRegistry();

// Register providers
registry.register(new OpenAIProvider());
registry.register(new AnthropicProvider());

// Get provider for model
const provider = registry.getProviderForModel('gpt-4');
if (provider) {
  const stream = await provider.chat('gpt-4', messages, options);
}
```

---

## Provider APIs

### AIProvider Interface

Base interface that all AI providers must implement.

```typescript
interface AIProvider {
  // Provider metadata
  readonly id: string
  readonly name: string
  readonly description?: string
  readonly website?: string

  // Supported models
  readonly models: ModelInfo[]

  // Provider capabilities
  readonly capabilities: ProviderCapabilities

  // Core methods
  chat(
    model: string,
    messages: Message[],
    options: ChatOptions
  ): Promise<ReadableStream>

  // Optional methods
  generateImage?(
    prompt: string,
    options: ImageOptions
  ): Promise<ImageResult>

  speech?(
    text: string,
    options: SpeechOptions
  ): Promise<AudioResult>

  validateAuth?(auth: AuthData): Promise<boolean>

  // Configuration
  getConfig(): ProviderConfig
  updateConfig(config: Partial<ProviderConfig>): void
}
```

### ModelInfo

Information about an AI model.

```typescript
interface ModelInfo {
  // Unique identifier
  id: string

  // Display name
  name: string

  // Maximum context length in tokens
  contextLength: number

  // Pricing information
  pricing: PricingInfo

  // Model capabilities
  capabilities: ModelCapabilities

  // Model metadata
  metadata?: {
    releaseDate?: string
    description?: string
    tags?: string[]
  }
}
```

### ProviderCapabilities

What a provider can do.

```typescript
interface ProviderCapabilities {
  // Core capabilities
  chat: boolean
  streaming: boolean

  // Optional capabilities
  imageGeneration?: boolean
  textToSpeech?: boolean
  vision?: boolean
  functionCalling?: boolean

  // Limits and constraints
  maxTokens?: number
  maxImagesPerRequest?: number
  supportedFormats?: string[]

  // Rate limiting
  requestsPerMinute?: number
  requestsPerHour?: number
  requestsPerDay?: number
}
```

### ChatOptions

Options for chat completion requests.

```typescript
interface ChatOptions {
  // Generation parameters
  temperature?: number      // 0.0 - 2.0
  topP?: number            // 0.0 - 1.0
  maxTokens?: number       // Maximum response length
  stopSequences?: string[] // Stop generation at these strings

  // Advanced parameters
  frequencyPenalty?: number // -2.0 - 2.0
  presencePenalty?: number  // -2.0 - 2.0

  // Provider-specific options
  providerOptions?: Record<string, any>

  // Streaming options
  stream?: boolean
  streamOptions?: {
    includeUsage?: boolean
  }
}
```

### Message Format

Standard message format used across providers.

```typescript
interface Message {
  // Message role
  role: 'user' | 'assistant' | 'system' | 'tool'

  // Message content
  content: string | MessageContent[]

  // Optional metadata
  metadata?: {
    timestamp?: number
    model?: string
    tokens?: number
    attachments?: Attachment[]
  }
}

interface MessageContent {
  type: 'text' | 'image' | 'audio' | 'file'
  text?: string
  image_url?: string
  audio_url?: string
  file_url?: string
  metadata?: Record<string, any>
}
```

---

## UI Component APIs

### React Hooks

#### useConversations

Manage conversations in React components.

```typescript
function useConversations(): {
  // Current state
  conversations: Conversation[]
  currentConversation: Conversation | null
  isLoading: boolean
  error: Error | null

  // Actions
  createConversation: (title: string, model?: string) => Promise<void>
  selectConversation: (id: string) => void
  deleteConversation: (id: string) => Promise<void>
  searchConversations: (query: string) => void
  clearSearch: () => void

  // Current conversation actions
  sendMessage: (content: string, options?: SendOptions) => Promise<void>
  regenerateMessage: (messageId: string) => Promise<void>
  editMessage: (messageId: string, newContent: string) => Promise<void>
}
```

**Usage:**
```typescript
function ChatInterface() {
  const {
    conversations,
    currentConversation,
    sendMessage,
    selectConversation
  } = useConversations();

  const handleSend = async (content: string) => {
    await sendMessage(content, { model: 'gpt-4' });
  };

  return (
    <div>
      <ConversationList
        conversations={conversations}
        onSelect={selectConversation}
      />
      <MessageList messages={currentConversation?.messages || []} />
      <ChatInput onSend={handleSend} />
    </div>
  );
}
```

#### useStreaming

Handle streaming responses in React components.

```typescript
function useStreaming(conversationId: string): {
  // Stream state
  isStreaming: boolean
  currentChunk: StreamChunk | null
  error: Error | null

  // Actions
  startStream: (options: StreamOptions) => Promise<void>
  cancelStream: () => void

  // Event handlers
  onChunk: (handler: (chunk: StreamChunk) => void) => void
  onComplete: (handler: (result: StreamResult) => void) => void
  onError: (handler: (error: Error) => void) => void
}
```

#### useProviders

Access provider information and management.

```typescript
function useProviders(): {
  // Provider data
  providers: AIProvider[]
  availableModels: ModelInfo[]
  currentProvider: AIProvider | null

  // Actions
  selectProvider: (providerId: string) => void
  selectModel: (modelId: string) => void
  validateProvider: (providerId: string) => Promise<boolean>

  // Configuration
  updateProviderConfig: (providerId: string, config: Partial<ProviderConfig>) => void
  testProviderConnection: (providerId: string) => Promise<TestResult>
}
```

### UI Components

#### MessageList

Display conversation messages.

```typescript
interface MessageListProps {
  messages: Message[]
  isStreaming?: boolean
  streamingMessageId?: string
  onEditMessage?: (messageId: string, newContent: string) => void
  onRegenerateMessage?: (messageId: string) => void
  onDeleteMessage?: (messageId: string) => void
  className?: string
}

function MessageList(props: MessageListProps): JSX.Element
```

#### ChatInput

Input component for sending messages.

```typescript
interface ChatInputProps {
  onSend: (content: string, attachments?: File[]) => void
  placeholder?: string
  disabled?: boolean
  maxLength?: number
  supportsAttachments?: boolean
  supportedFileTypes?: string[]
  className?: string
}

function ChatInput(props: ChatInputProps): JSX.Element
```

#### ModelSelector

Dropdown for selecting AI models.

```typescript
interface ModelSelectorProps {
  value: string
  onChange: (modelId: string) => void
  providers?: AIProvider[]
  disabled?: boolean
  showProviderNames?: boolean
  className?: string
}

function ModelSelector(props: ModelSelectorProps): JSX.Element
```

#### StreamingIndicator

Show streaming status and progress.

```typescript
interface StreamingIndicatorProps {
  isStreaming: boolean
  progress?: number
  status?: 'connecting' | 'streaming' | 'complete' | 'error'
  error?: Error
  className?: string
}

function StreamingIndicator(props: StreamingIndicatorProps): JSX.Element
```

---

## Storage APIs

### IndexedDB Manager

High-level IndexedDB operations.

```typescript
class IndexedDBManager {
  // Database operations
  async open(): Promise<void>
  async close(): Promise<void>
  async delete(): Promise<void>

  // Table operations
  async get<T>(table: string, key: any): Promise<T | null>
  async put<T>(table: string, item: T): Promise<any>
  async delete(table: string, key: any): Promise<void>
  async clear(table: string): Promise<void>

  // Query operations
  async where<T>(table: string, condition: any): Promise<T[]>
  async count(table: string, condition?: any): Promise<number>

  // Bulk operations
  async bulkPut<T>(table: string, items: T[]): Promise<void>
  async bulkDelete(table: string, keys: any[]): Promise<void>

  // Transaction operations
  async transaction(
    tables: string[],
    mode: 'readonly' | 'readwrite',
    callback: (tx: Transaction) => Promise<void>
  ): Promise<void>
}
```

### Encryption Manager

Handle sensitive data encryption.

```typescript
class EncryptionManager {
  // Key management
  async initialize(): Promise<void>
  async generateKey(): Promise<CryptoKey>
  async exportKey(key: CryptoKey): Promise<string>
  async importKey(exportedKey: string): Promise<CryptoKey>

  // Encryption operations
  async encrypt(data: string): Promise<EncryptedData>
  async decrypt(encryptedData: EncryptedData): Promise<string>

  // Utility methods
  async hash(data: string): Promise<string>
  async generateRandomBytes(length: number): Promise<Uint8Array>
}
```

**Usage:**
```typescript
const crypto = new EncryptionManager();
await crypto.initialize();

// Encrypt API key
const encrypted = await crypto.encrypt('sk-...');
await storage.set('openai_key', encrypted);

// Decrypt API key
const stored = await storage.get('openai_key');
const apiKey = await crypto.decrypt(stored);
```

### Chrome Storage Wrapper

Simplified Chrome storage API.

```typescript
class ChromeStorage {
  // Basic operations
  async get(key: string): Promise<any>
  async set(key: string, value: any): Promise<void>
  async remove(key: string): Promise<void>
  async clear(): Promise<void>

  // Bulk operations
  async getMultiple(keys: string[]): Promise<Record<string, any>>
  async setMultiple(data: Record<string, any>): Promise<void>
  async removeMultiple(keys: string[]): Promise<void>

  // Advanced operations
  async getWithDefault<T>(key: string, defaultValue: T): Promise<T>
  async toggle(key: string): Promise<boolean>
  async increment(key: string, amount?: number): Promise<number>

  // Observers
  addChangeListener(callback: StorageChangeCallback): void
  removeChangeListener(callback: StorageChangeCallback): void
}
```

---

## Plugin APIs

### FeaturePlugin Interface

Extend VIVIM with custom features.

```typescript
interface FeaturePlugin {
  // Plugin metadata
  readonly id: string
  readonly name: string
  readonly version: string
  readonly description: string
  readonly author?: string

  // Lifecycle methods
  initialize(): Promise<void>
  destroy(): Promise<void>

  // Optional UI integration
  getSidebarItem?(): SidebarItem
  getContextMenuItems?(): ContextMenuItem[]
  getSettingsPanel?(): SettingsPanel

  // Optional API methods
  handleMessage?(message: PluginMessage): Promise<any>
  onConversationChange?(conversation: Conversation): void
  onStreamEvent?(event: StreamEvent): void
}
```

### SidebarItem

Add items to the sidebar.

```typescript
interface SidebarItem {
  id: string
  label: string
  icon: string | React.ComponentType
  badge?: string | number
  onClick: () => void
  children?: SidebarItem[]
  disabled?: boolean
}
```

### ContextMenuItem

Add items to right-click menus.

```typescript
interface ContextMenuItem {
  id: string
  label: string
  icon?: string
  shortcut?: string
  action: (context: ContextMenuContext) => void
  enabled?: (context: ContextMenuContext) => boolean
  submenu?: ContextMenuItem[]
}

interface ContextMenuContext {
  selection?: string
  url?: string
  pageTitle?: string
  conversationId?: string
  messageId?: string
}
```

### Plugin Manager

Manage plugin lifecycle.

```typescript
class PluginManager {
  // Plugin management
  async loadPlugin(plugin: FeaturePlugin): Promise<void>
  async unloadPlugin(pluginId: string): Promise<void>
  async reloadPlugin(pluginId: string): Promise<void>

  // Plugin discovery
  async discoverPlugins(): Promise<FeaturePlugin[]>
  async installPlugin(source: string): Promise<void>
  async uninstallPlugin(pluginId: string): Promise<void>

  // Plugin communication
  async sendToPlugin(pluginId: string, message: any): Promise<any>
  async broadcast(message: any): Promise<void>

  // Plugin information
  getLoadedPlugins(): FeaturePlugin[]
  getPlugin(pluginId: string): FeaturePlugin | null
  isPluginLoaded(pluginId: string): boolean
}
```

---

## Message Passing APIs

### Background ↔ Content Script

#### Message Types

```typescript
type BackgroundMessage =
  | { type: 'TAB_ACTIVATED', tabId: number, url: string }
  | { type: 'TAB_UPDATED', tabId: number, url: string, title: string }
  | { type: 'CONTENT_EXTRACTED', tabId: number, content: PageContent }
  | { type: 'STREAM_CHUNK', conversationId: string, chunk: StreamChunk }
  | { type: 'STREAM_COMPLETE', conversationId: string, result: StreamResult }
  | { type: 'ERROR', conversationId: string, error: Error }

type ContentScriptMessage =
  | { type: 'EXTRACT_CONTENT', url: string }
  | { type: 'INJECT_UI', config: UIConfig }
  | { type: 'UPDATE_CONTEXT_MENU', items: ContextMenuItem[] }
  | { type: 'SHOW_NOTIFICATION', notification: NotificationData }
```

#### Message Handlers

```typescript
// Background script
chrome.runtime.onMessage.addListener(
  (message: BackgroundMessage, sender, sendResponse) => {
    switch (message.type) {
      case 'TAB_ACTIVATED':
        handleTabActivated(message.tabId, message.url);
        break;
      case 'CONTENT_EXTRACTED':
        handleContentExtracted(message.tabId, message.content);
        break;
    }
    return true; // Keep channel open for async response
  }
);

// Content script
chrome.runtime.sendMessage({
  type: 'EXTRACT_CONTENT',
  url: window.location.href
}, (response) => {
  if (response.success) {
    console.log('Content extracted:', response.content);
  }
});
```

### React ↔ Background

#### React to Background

```typescript
// Send message from React component
const sendChatMessage = async (content: string, model: string) => {
  const response = await chrome.runtime.sendMessage({
    type: 'CHAT_MESSAGE',
    data: {
      content,
      model,
      conversationId: currentConversation?.id
    }
  });
  return response;
};

// Listen for background messages in React
useEffect(() => {
  const handleMessage = (message: any) => {
    switch (message.type) {
      case 'STREAM_CHUNK':
        updateStreamingMessage(message.chunk);
        break;
      case 'STREAM_COMPLETE':
        finalizeStreamingMessage(message.result);
        break;
    }
  };

  chrome.runtime.onMessage.addListener(handleMessage);
  return () => chrome.runtime.onMessage.removeListener(handleMessage);
}, []);
```

#### Background to React

```typescript
// Background script sending to React
const sendStreamChunk = (conversationId: string, chunk: StreamChunk) => {
  chrome.runtime.sendMessage({
    type: 'STREAM_CHUNK',
    conversationId,
    chunk
  });
};
```

---

## Extension APIs

### Manifest Configuration

#### Permissions

```json
{
  "manifest_version": 3,
  "permissions": [
    "storage",
    "tabs",
    "sidePanel",
    "scripting",
    "activeTab",
    "contextMenus",
    "unlimitedStorage",
    "alarms",
    "offscreen"
  ]
}
```

#### Host Permissions

```json
{
  "host_permissions": [
    "https://api.openai.com/*",
    "https://api.anthropic.com/*",
    "https://generativelanguage.googleapis.com/*",
    "https://api.deepseek.com/*",
    "https://api.x.ai/*",
    "https://api.groq.com/*",
    "<all_urls>"
  ]
}
```

#### Content Scripts

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-all.js"],
      "run_at": "document_end",
      "all_frames": true
    },
    {
      "matches": ["*://*.google.com/search*", "*://*.bing.com/search*"],
      "js": ["content-script.js"],
      "run_at": "document_end"
    }
  ]
}
```

### Chrome APIs Used

#### Storage API

```typescript
// Local storage
await chrome.storage.local.get('key');
await chrome.storage.local.set({ key: 'value' });

// Session storage
await chrome.storage.session.get('key');
await chrome.storage.session.set({ key: 'value' });
```

#### Tabs API

```typescript
// Get current tab
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

// Create new tab
await chrome.tabs.create({ url: 'https://example.com' });

// Update tab
await chrome.tabs.update(tabId, { url: 'https://example.com' });
```

#### Scripting API

```typescript
// Execute script in tab
await chrome.scripting.executeScript({
  target: { tabId },
  func: (param) => {
    console.log('Executed in page context:', param);
  },
  args: ['hello']
});
```

#### Context Menus API

```typescript
// Create context menu
chrome.contextMenus.create({
  id: 'vivim-summarize',
  title: 'Summarize with VIVIM',
  contexts: ['selection', 'page']
});

// Handle clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'vivim-summarize') {
    handleSummarize(info.selectionText || tab.url);
  }
});
```

#### Side Panel API

```typescript
// Set side panel options
await chrome.sidePanel.setOptions({
  tabId,
  path: 'sidepanel.html',
  enabled: true
});

// Open side panel
await chrome.sidePanel.open({ tabId });
```

---

## Type Definitions

### Core Types

```typescript
// Unique identifiers
type UUID = string;
type ConversationId = UUID;
type MessageId = UUID;
type ProviderId = string;
type ModelId = string;

// Common data types
type Timestamp = number; // Unix timestamp in milliseconds
type TokenCount = number;
type FileSize = number; // Bytes
type URLString = string;
type Base64String = string;

// Status types
type LoadingState = 'idle' | 'loading' | 'success' | 'error';
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

// Export formats
type ExportFormat = 'json' | 'markdown' | 'text' | 'html';

// Error types
type ErrorCode =
  | 'NETWORK_ERROR'
  | 'API_KEY_INVALID'
  | 'QUOTA_EXCEEDED'
  | 'MODEL_NOT_FOUND'
  | 'STREAM_TIMEOUT'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';
```

### Data Models

```typescript
interface Conversation {
  id: ConversationId;
  title: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  model: ModelId;
  provider: ProviderId;
  messages: MessageId[];
  tags: string[];
  archived: boolean;
  metadata?: ConversationMetadata;
}

interface Message {
  id: MessageId;
  conversationId: ConversationId;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  createdAt: Timestamp;
  attachments?: Attachment[];
  metadata?: MessageMetadata;
}

interface Attachment {
  id: UUID;
  messageId: MessageId;
  type: 'image' | 'document' | 'audio' | 'video';
  name: string;
  mimeType: string;
  size: FileSize;
  data: Blob;
  thumbnail?: Base64String;
  metadata?: AttachmentMetadata;
}

interface StreamChunk {
  conversationId: ConversationId;
  content: string;
  role: 'user' | 'assistant' | 'system';
  model: ModelId;
  timestamp: Timestamp;
  sequence: number;
  done: boolean;
  metadata?: StreamMetadata;
}

interface StreamResult {
  conversationId: ConversationId;
  totalTokens: TokenCount;
  finishReason: 'stop' | 'length' | 'error';
  model: ModelId;
  usage: TokenUsage;
  duration: number; // milliseconds
}

interface TokenUsage {
  promptTokens: TokenCount;
  completionTokens: TokenCount;
  totalTokens: TokenCount;
}
```

### Configuration Types

```typescript
interface AppConfig {
  version: string;
  theme: 'light' | 'dark' | 'system';
  language: string;
  sidebarWidth: number;
  maxConversations: number;
  defaultModel: ModelId;
  streamingEnabled: boolean;
  autoSave: boolean;
  notificationsEnabled: boolean;
}

interface ProviderConfig {
  apiKey?: string;
  apiEndpoint?: string;
  timeout?: number;
  retryAttempts?: number;
  customHeaders?: Record<string, string>;
  rateLimits?: RateLimitConfig;
}

interface RateLimitConfig {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
  burstLimit?: number;
}

interface UIConfig {
  compactMode: boolean;
  showTimestamps: boolean;
  showModelNames: boolean;
  messageSpacing: 'comfortable' | 'compact' | 'cozy';
  fontSize: 'small' | 'medium' | 'large';
  codeHighlighting: boolean;
  markdownRendering: boolean;
}
```

### Event Types

```typescript
interface StreamEvent {
  type: 'chunk' | 'complete' | 'error';
  conversationId: ConversationId;
  data: StreamChunk | StreamResult | Error;
  timestamp: Timestamp;
}

interface ConversationEvent {
  type: 'created' | 'updated' | 'deleted' | 'archived';
  conversation: Conversation;
  timestamp: Timestamp;
}

interface ProviderEvent {
  type: 'connected' | 'disconnected' | 'error' | 'rate_limited';
  providerId: ProviderId;
  data?: any;
  timestamp: Timestamp;
}

interface UIEvent {
  type: 'sidebar_opened' | 'sidebar_closed' | 'tab_switched' | 'settings_changed';
  data?: any;
  timestamp: Timestamp;
}
```

---

This API reference provides comprehensive documentation for all VIVIM Extension v2.0 interfaces and types. For implementation examples, see the [Developer Guide](DEVELOPER_GUIDE.md) and example plugins in the `examples/` directory.</content>
<parameter name="filePath">API_REFERENCE.md