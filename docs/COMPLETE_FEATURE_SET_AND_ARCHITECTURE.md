# VIVIM Extension v2.0 - Complete Feature Set & Architecture

**Version**: 2.0.0
**Date**: 2026-04-14
**Based on**: SiderAI v5.25.10 feature analysis

---

## 1. Architecture Overview

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            VIVIM EXTENSION v2.0                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│ INTERCEPTOR LAYER                                                            │
│ ├── FetchInterceptor ── HTTP requests (OpenAI, Anthropic, Google, etc.)      │
│ ├── XHRInterceptor ── Legacy XHR (Google services, Netflix)                 │
│ └── Plugin System ── Provider abstraction (6 providers, 30+ models)         │
├─────────────────────────────────────────────────────────────────────────────────┤
│ CORE SERVICES                                                                │
│ ├── StreamProcessor ── SSE/WebSocket streaming with error handling          │
│ ├── ConversationManager ── IndexedDB storage with search/filter              │
│ ├── AuthManager ── Encrypted API key storage and validation                 │
│ ├── DestinationRouter ── Multi-destination streaming (sidepanel, webhook)    │
│ └── ContentExtractor ── Web page analysis (Defuddle, readability)            │
├─────────────────────────────────────────────────────────────────────────────────┤
│ UI LAYER (React + VIVIM Design System)                                       │
│ ├── SidePanel ── Main chat interface with streaming                          │
│ ├── Options ── Settings and API key management                              │
│ ├── Standalone ── Full-page chat mode                                        │
│ ├── Artifacts ── Code/docs/chart rendering                                   │
│ ├── AnswerCompare ── Model comparison UI                                     │
│ └── Feature UIs ── Research, recording, media tools                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│ INTEGRATION LAYER                                                            │
│ ├── SearchEngine ── AI answers on Google/Bing/etc.                           │
│ ├── YouTube ── Video summary, bilingual subtitles                            │
│ ├── WebContent ── Page summarization, translation                            │
│ ├── ContextMenu ── Right-click AI actions                                    │
│ └── ContentScripts ── Universal web integration                              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 File Structure (71 Files)

```
vivim-extension/
├── manifest.json                    # Extension manifest (V3)
├── background.js                    # Service worker (~2000 lines)
├── sidepanel.html/js/css            # React side panel (main UI)
├── options.html/js/css              # Settings page
├── standalone.html/js/css           # Full-page chat mode
├── content-script.js                # Search engine AI answers
├── content-all.js                   # Universal content extraction
├── content-chat.openai.com.js       # ChatGPT web integration
├── content-youtube-embed.js         # YouTube embed features
├── all-frames.js                    # All-frames content injection
├── all-frames-main-start.js         # Special site handling
├── inject-xhr-hack.js               # XHR interception (MAIN world)
├── inject-json-hack.js              # Netflix JSON interception
├── alert-window.html/js/css         # Dialog/alert components
├── network.html/js                  # Network diagnostics
├── arkose.js                        # CAPTCHA handling
├── deep-research.html/js/css        # Deep research automation
├── answer-compare.html/js/css       # Model comparison
├── artifacts.html/js/css            # Code artifact viewer
├── audio-preview.html/js/css        # Audio file preview
├── file-preview.html/js/css         # File preview
├── camera-permissions.html/js/css   # Camera permission UI
├── camera-record.html/js/css        # Camera recording
├── microphone-permissions.html/js/css # Microphone UI
├── block-preview.html/js/css        # Content block preview
├── record-background.html/js        # Background recording
├── crop.worker.js                   # Image cropping worker
├── mp4_muxer.js/wasm                # Video encoding
├── detectDark.js                    # Dark mode detection
├── logo.png                         # Extension icon (multiple sizes)
├── _locales/                        # i18n localization files
├── assets/                          # Static assets
├── fonts/                           # Custom fonts
├── i18n/                            # i18n data files
└── js/                              # Third-party libraries
```

---

## 2. Core Features

### 2.1 AI Chat System (Primary Feature)

#### Multi-Provider Support
- **6 Major Providers**: OpenAI, Anthropic, Google, DeepSeek, xAI, Groq
- **30+ Models**: Complete model coverage across providers
- **Dynamic Routing**: Automatic provider selection based on model
- **Fallback System**: Automatic failover to alternative providers

#### Streaming Architecture
- **Real-time Streaming**: SSE/WebSocket streaming for all providers
- **Error Recovery**: Automatic retry with exponential backoff
- **Chunk Deduplication**: Sequence numbering prevents duplicates
- **Timeout Handling**: 30-second stream timeout with cleanup

#### Conversation Management
- **Local Storage**: IndexedDB with Dexie.js
- **Search/Filter**: Full-text conversation search
- **Export/Import**: JSON export with metadata preservation
- **Auto-save**: Real-time conversation persistence

### 2.2 Media Generation Features

#### Image Generation
- **DALL-E Integration**: Text-to-image with quality options
- **Prompt Enhancement**: AI-powered prompt improvement
- **Image Editing**: Natural language image modifications
- **Gallery View**: Generated image management

#### Text-to-Speech (TTS)
- **Voice Selection**: Multiple voices and languages
- **Audio Playback**: Inline audio player with controls
- **Transcript Sync**: Audio synchronized with text
- **Download Support**: Save generated audio files

#### Recording Features
- **Screen Recording**: Tab capture with MP4 encoding
- **Camera Recording**: Webcam video capture
- **Voice Recording**: Audio capture with transcription
- **REC Notes**: Combined notes with recording

### 2.3 Web Integration Features

#### Search Engine Integration
- **AI Answers**: Contextual AI responses on search results
- **Supported Engines**: Google, Bing, Yahoo, Baidu, DuckDuckGo, Brave, etc.
- **Answer Cards**: Prominent AI answer display
- **Model Selection**: Choose AI model for search answers

#### YouTube Integration
- **Video Summary**: One-click video summarization
- **Subtitle Extraction**: Automatic subtitle download
- **Bilingual Subtitles**: Dual-language subtitle overlay
- **Video Metadata**: Duration, views, channel info extraction
- **Key Moments**: AI-identified important video segments

#### Content Extraction
- **Page Summarization**: Any webpage content analysis
- **Translation**: Full page or selected text translation
- **Readability Parsing**: Clean content extraction (Defuddle)
- **Content Types**: Articles, blogs, documentation, etc.

### 2.4 Advanced AI Features

#### Deep Research
- **Automated Research**: Multi-source information gathering
- **Report Generation**: AI-synthesized research reports
- **Source Citation**: Referenced source tracking
- **Research Templates**: Customizable research workflows

#### Artifacts Viewer
- **Code Rendering**: Syntax-highlighted code blocks
- **Document Display**: Formatted document preview
- **Chart Generation**: Data visualization rendering
- **Mind Maps**: Hierarchical information display

#### Answer Comparison
- **Side-by-side Display**: Multiple model responses
- **Performance Metrics**: Response time, quality scoring
- **Preference Selection**: User preference tracking
- **Export Comparison**: Shareable comparison results

#### Knowledge Base (Wisebase)
- **Content Saving**: Web page and highlight storage
- **AI Organization**: Automatic content categorization
- **Search Integration**: Knowledge base search
- **Cross-referencing**: Related content linking

---

## 3. Technical Architecture

### 3.1 Plugin System Architecture

#### Provider Plugin Interface
```typescript
interface AIProvider {
  id: string;
  name: string;
  models: ModelInfo[];
  capabilities: ProviderCapabilities;

  chat(model: string, messages: Message[], options: ChatOptions): Promise<ReadableStream>;
  generateImage?(prompt: string, options: ImageOptions): Promise<ImageResult>;
  speech?(text: string, options: SpeechOptions): Promise<AudioResult>;
  validateAuth(auth: AuthData): Promise<boolean>;
}

interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
  pricing: PricingInfo;
  capabilities: ModelCapabilities;
}
```

#### Plugin Registry
```typescript
class ProviderRegistry {
  private providers = new Map<string, AIProvider>();

  register(provider: AIProvider): void {
    this.providers.set(provider.id, provider);
  }

  getProviderForModel(modelId: string): AIProvider | null {
    // Route model to appropriate provider
  }

  getAllProviders(): AIProvider[] {
    return Array.from(this.providers.values());
  }
}
```

### 3.2 Streaming Architecture

#### Stream Processor
```typescript
class StreamProcessor {
  private activeStreams = new Map<string, AbortController>();

  async processStream(
    conversationId: string,
    stream: ReadableStream,
    onChunk: (chunk: StreamChunk) => void,
    onComplete: (result: StreamResult) => void,
    onError: (error: StreamError) => void
  ): Promise<void> {
    // Stream processing with timeout and error handling
  }

  cancelStream(conversationId: string): void {
    // Cancel active stream
  }
}
```

#### Message Format Standardization
```typescript
interface StreamChunk {
  conversationId: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  model: string;
  timestamp: number;
  sequence: number;
  done: boolean;
}

interface StreamResult {
  conversationId: string;
  totalTokens: number;
  finishReason: string;
  model: string;
  usage: TokenUsage;
}
```

### 3.3 Storage Architecture

#### IndexedDB Schema (Dexie.js)
```typescript
const db = new Dexie('VIVIMDatabase');

db.version(1).stores({
  conversations: '++id, title, createdAt, updatedAt, model, provider, tags, archived',
  messages: '++id, conversationId, role, createdAt, [conversationId+createdAt]',
  attachments: '++id, messageId, type, name, mimeType, size',
  settings: 'key',
  apiKeys: 'provider',  // Encrypted
  tags: '++id, name, color, conversationIds',
  exports: '++id, conversationId, exportedAt, format'
});
```

#### Conversation Manager
```typescript
class ConversationManager {
  async createConversation(title: string, model: string): Promise<Conversation> {
    // Create new conversation
  }

  async addMessage(
    conversationId: string,
    role: MessageRole,
    content: string,
    attachments?: Attachment[]
  ): Promise<Message> {
    // Add message with attachments
  }

  async searchConversations(query: string): Promise<Conversation[]> {
    // Full-text search
  }

  async exportConversation(id: string): Promise<ExportedData> {
    // Export with all data
  }
}
```

### 3.4 Authentication Architecture

#### Encrypted Key Storage
```typescript
class AuthManager {
  private encryptionKey: CryptoKey;

  async initialize(): Promise<void> {
    // Generate or retrieve encryption key
  }

  async storeApiKey(provider: string, key: string): Promise<void> {
    // Encrypt and store API key
  }

  async getApiKey(provider: string): Promise<string | null> {
    // Decrypt and return API key
  }

  async validateApiKey(provider: string, key: string): Promise<boolean> {
    // Test API key validity
  }
}
```

#### Provider-Specific Auth Patterns
```typescript
const AUTH_PATTERNS = {
  openai: {
    header: 'Authorization',
    format: 'Bearer {key}',
    testEndpoint: '/v1/models'
  },
  anthropic: {
    header: 'x-api-key',
    format: '{key}',
    version: '2023-06-01',
    testEndpoint: '/v1/messages'
  },
  google: {
    param: 'key',
    format: '{key}',
    testEndpoint: '/v1beta/models'
  }
};
```

---

## 4. UI Architecture

### 4.1 React Component Hierarchy

#### Main Side Panel
```jsx
function SidePanel() {
  return (
    <div className="sidepanel">
      <Header>
        <ModelSelector />
        <SettingsButton />
      </Header>
      <MessageList>
        <StreamingMessage />
        <UserMessage />
        <AssistantMessage />
      </MessageList>
      <InputArea>
        <MessageInput />
        <AttachmentButton />
        <SendButton />
      </InputArea>
      <StatusBar>
        <ConnectionStatus />
        <StreamingIndicator />
      </StatusBar>
    </div>
  );
}
```

#### Message Components
```jsx
function StreamingMessage({ message, isStreaming }) {
  return (
    <div className="message streaming">
      <MessageHeader role={message.role} model={message.model} />
      <MessageContent
        content={message.content}
        isStreaming={isStreaming}
        onChunk={handleChunk}
      />
      <MessageActions>
        <CopyButton />
        <RegenerateButton />
      </MessageActions>
    </div>
  );
}
```

### 4.2 State Management

#### React Context Architecture
```typescript
const ChatContext = createContext<ChatContextType>();

interface ChatContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  streamingMessage: Message | null;
  selectedModel: string;
  isLoading: boolean;

  actions: {
    createConversation: (title: string) => Promise<void>;
    sendMessage: (content: string) => Promise<void>;
    switchModel: (model: string) => void;
    searchConversations: (query: string) => Promise<void>;
  };
}
```

#### Custom Hooks
```typescript
function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    loadConversations();
  }, []);

  const createConversation = useCallback(async (title: string) => {
    const conversation = await conversationManager.create(title);
    setConversations(prev => [conversation, ...prev]);
  }, []);

  return { conversations, createConversation };
}
```

---

## 5. Integration Architecture

### 5.1 Content Script Architecture

#### Universal Content Extraction
```javascript
class ContentExtractor {
  async extractPageContent(): Promise<PageContent> {
    // Use Defuddle for clean content extraction
    const defuddle = new Defuddle(document.documentElement);
    const parsed = defuddle.parse();

    return {
      title: parsed.title,
      content: parsed.content,
      excerpt: parsed.excerpt,
      author: parsed.byline,
      publishedTime: parsed.publishedTime,
      readingTime: this.calculateReadingTime(parsed.content)
    };
  }

  calculateReadingTime(content: string): number {
    const wordsPerMinute = 200;
    const words = content.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }
}
```

#### Search Engine Integration
```javascript
class SearchEngineIntegrator {
  detectSearchEngine(): SearchEngineType {
    const hostname = window.location.hostname;
    if (hostname.includes('google')) return 'google';
    if (hostname.includes('bing')) return 'bing';
    // ... other engines
  }

  injectAIAnswer(resultElement: Element, query: string): void {
    const aiButton = this.createAIButton(query);
    resultElement.appendChild(aiButton);
  }

  createAIButton(query: string): HTMLElement {
    const button = document.createElement('div');
    button.className = 'vivim-ai-answer-button';
    button.innerHTML = `
      <div class="ai-icon">🤖</div>
      <div class="ai-text">Ask AI</div>
    `;
    button.onclick = () => this.showAIAnswer(query);
    return button;
  }
}
```

### 5.2 YouTube Integration

#### Subtitle Extraction
```javascript
class YouTubeIntegrator {
  async extractSubtitles(videoId: string): Promise<SubtitleTrack[]> {
    // Intercept XHR requests to subtitle endpoints
    const subtitleUrls = await this.findSubtitleUrls(videoId);
    const subtitles = await Promise.all(
      subtitleUrls.map(url => this.downloadSubtitles(url))
    );
    return this.parseSubtitles(subtitles);
  }

  async generateSummary(videoId: string): Promise<VideoSummary> {
    const subtitles = await this.extractSubtitles(videoId);
    const transcript = this.combineSubtitles(subtitles);

    // Send to AI for summarization
    return await this.ai.summarizeVideo(transcript, videoId);
  }
}
```

#### Bilingual Subtitles
```javascript
class BilingualSubtitles {
  constructor(originalSubs: SubtitleTrack, translatedSubs: SubtitleTrack) {
    this.original = originalSubs;
    this.translated = translatedSubs;
  }

  render(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'vivim-bilingual-subs';

    // Overlay bilingual subtitles on video
    this.original.cues.forEach(cue => {
      const translatedCue = this.findMatchingCue(cue, this.translated);
      this.renderBilingualCue(cue, translatedCue, container);
    });

    return container;
  }
}
```

---

## 6. Security & Privacy Architecture

### 6.1 API Key Security
- **Encryption**: AES-GCM encryption for stored API keys
- **Key Derivation**: PBKDF2 for encryption key generation
- **Secure Storage**: Chrome storage with additional encryption
- **Memory Safety**: Keys cleared from memory after use

### 6.2 Data Privacy
- **Local-First**: All data stored locally, no server sync
- **User Control**: Export/import for data portability
- **No Tracking**: No analytics or telemetry collection
- **Minimal Permissions**: Only required Chrome permissions

### 6.3 Content Security
- **CSP Headers**: Content Security Policy enforcement
- **Isolated Worlds**: Content scripts in isolated execution contexts
- **Permission Checks**: Runtime permission validation
- **Input Sanitization**: XSS prevention for user-generated content

---

## 7. Performance Architecture

### 7.1 Bundle Optimization
- **Code Splitting**: Lazy loading for large features
- **Tree Shaking**: Remove unused dependencies
- **Compression**: Brotli compression for assets
- **Caching**: Service worker caching for static assets

### 7.2 Runtime Performance
- **Virtual Scrolling**: Efficient message list rendering
- **Debounced Search**: Optimized conversation search
- **Stream Chunking**: Incremental UI updates for streaming
- **Memory Management**: Automatic cleanup of unused resources

### 7.3 Storage Performance
- **IndexedDB Optimization**: Proper indexing for fast queries
- **Batch Operations**: Bulk operations for data management
- **Compression**: Optional data compression for large conversations
- **Migration**: Efficient data migration from POC to v2.0

---

## 8. Extension Manifest Configuration

### 8.1 Permissions
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
  ],
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

### 8.2 Content Scripts
```json
{
  "content_scripts": [
    {
      "matches": ["*://*.google.com/search*", "*://*.bing.com/search*"],
      "js": ["content-script.js"],
      "css": ["content-script.css"],
      "run_at": "document_end"
    },
    {
      "matches": ["<all_urls>"],
      "js": ["content-all.js"],
      "run_at": "document_end",
      "all_frames": true
    },
    {
      "matches": ["*://*.youtube.com/embed/*"],
      "js": ["content-youtube-embed.js"],
      "run_at": "document_end"
    }
  ]
}
```

---

## 9. Deployment & Distribution

### 9.1 Build System
- **Vite**: Modern bundler with React support
- **TypeScript**: Type safety throughout codebase
- **ESLint + Prettier**: Code quality and formatting
- **Testing**: Jest for unit tests, Playwright for E2E

### 9.2 Chrome Web Store
- **Package Size**: <5MB compressed
- **Screenshots**: Feature showcase screenshots
- **Privacy Policy**: User data handling documentation
- **Support Channels**: GitHub issues, community forum

### 9.3 Open Source Distribution
- **GitHub Repository**: Complete source code
- **Documentation**: Developer and user guides
- **Contributing**: Guidelines for community contributions
- **Licensing**: Open source license (MIT/BSD)

---

## 10. Future Extensibility

### 10.1 Plugin API
- **Provider Plugins**: Add new AI providers
- **Feature Plugins**: Extend functionality
- **UI Plugins**: Custom interface components
- **Integration Plugins**: Third-party service integration

### 10.2 API Evolution
- **Versioning**: Backward-compatible API updates
- **Deprecation**: Graceful feature deprecation
- **Migration Tools**: Automated data migration
- **Compatibility**: Support for older data formats

### 10.3 Platform Expansion
- **Firefox**: Gecko-compatible manifest
- **Safari**: WebExtension API support
- **Mobile**: iOS/Android companion apps
- **Desktop**: Electron-based desktop app

---

This architecture specification provides the complete technical foundation for VIVIM Extension v2.0, ensuring a robust, scalable, and maintainable implementation that delivers the full feature set of modern AI assistants while maintaining user privacy and local control.

**Key Architectural Principles**:
1. **Local-First**: All data stays on user's device
2. **Modular Design**: Plugin system for extensibility
3. **Performance Focus**: Optimized for speed and efficiency
4. **Privacy by Design**: Minimal data collection and transmission
5. **User Control**: Complete user ownership of data and preferences</content>
<parameter name="filePath">docs/COMPLETE_FEATURE_SET_AND_ARCHITECTURE.md