# Changelog

All notable changes to VIVIM Extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-04-14

### Added
- **Multi-Provider AI Support**: Integration with 6 AI providers (OpenAI, Anthropic, Google, DeepSeek, xAI, Groq)
- **30+ AI Models**: Complete model support including GPT-4, Claude 3, Gemini, and more
- **Local-First Architecture**: All conversations stored locally in IndexedDB
- **React UI**: Complete rewrite with modern React components and VIVIM design system
- **Real-time Streaming**: Live message streaming for all supported providers
- **Image Generation**: DALL-E integration with quality controls
- **Text-to-Speech**: Voice generation with multiple voice options
- **Screen Recording**: Tab capture with MP4 encoding
- **Voice Input**: Speech-to-text with real-time transcription
- **YouTube Integration**: Video summarization and bilingual subtitles
- **Web Content Extraction**: Page summarization and translation
- **Search Engine AI**: AI answers on Google, Bing, and other search engines
- **Deep Research**: Automated multi-source research and report generation
- **Artifacts Viewer**: Code, documents, charts, and mind maps rendering
- **Answer Comparison**: Side-by-side model response comparison
- **Knowledge Base**: Save and organize web content with AI assistance
- **Context Menu Integration**: Right-click AI actions on web pages
- **Data Export/Import**: Complete conversation portability
- **Encrypted API Keys**: Secure local storage of provider credentials
- **Dark/Light Theme**: System-aware theming with custom options
- **Multi-language Support**: i18n with English, Spanish, French, and more
- **Keyboard Shortcuts**: Extensive shortcut system for power users
- **Plugin Architecture**: Extensible system for custom features

### Changed
- **Complete Architecture Overhaul**: Migrated from simple POC to full-featured extension
- **Storage System**: Upgraded from chrome.storage to IndexedDB with Dexie.js
- **UI Framework**: Migrated from vanilla JavaScript to React with hooks
- **Build System**: Implemented Vite for modern development workflow
- **Manifest Version**: Upgraded to Manifest V3 for better security and performance

### Removed
- **POC Features**: Removed basic ChatGPT-only mirroring functionality
- **Legacy Storage**: Eliminated simple conversation storage in favor of robust IndexedDB
- **Vanilla JS UI**: Replaced with modern React components
- **Single Provider Lock-in**: Removed dependency on single AI provider

### Fixed
- **Stream Reliability**: Fixed timeout and error handling in message streaming
- **Memory Management**: Improved memory usage with proper cleanup
- **Cross-Origin Issues**: Resolved CORS problems in web integration
- **Performance**: Optimized rendering and data operations

### Security
- **API Key Encryption**: All API keys now encrypted locally
- **Content Security Policy**: Implemented comprehensive CSP
- **Permission Model**: Minimal required permissions only
- **Input Sanitization**: XSS prevention for all user inputs

---

## [0.0.1] - 2026-04-13

### Added
- **Initial POC Release**: Basic ChatGPT conversation mirroring
- **Side Panel UI**: Simple chat interface for mirrored conversations
- **Fetch Interception**: HTTP request/response interception for ChatGPT
- **Basic Streaming**: SSE parsing for ChatGPT responses
- **Local Storage**: Simple conversation persistence via chrome.storage
- **Extension Infrastructure**: Basic manifest, background script, and content scripts

### Known Issues
- Single provider support (ChatGPT only)
- Basic UI with limited features
- No data export/import capabilities
- Limited error handling and recovery

---

## Development Versions

### [2.0.0-rc.1] - 2026-04-10
- Beta release with core multi-provider functionality
- React UI implementation
- Basic streaming and conversation management
- API key management and encryption

### [2.0.0-beta.1] - 2026-03-15
- Alpha release with provider integrations
- IndexedDB storage implementation
- Plugin system foundation
- Basic UI components

### [2.0.0-alpha.1] - 2026-02-01
- Initial architecture rewrite
- Provider abstraction layer
- React migration planning
- Storage system design

---

## Versioning Policy

VIVIM Extension follows [Semantic Versioning](https://semver.org/):

- **MAJOR** version for incompatible API changes
- **MINOR** version for backwards-compatible functionality additions
- **PATCH** version for backwards-compatible bug fixes

### Release Channels

- **Stable**: Production-ready releases (e.g., 2.0.0)
- **Beta**: Feature-complete pre-releases (e.g., 2.0.0-beta.1)
- **Alpha**: Early development releases (e.g., 2.0.0-alpha.1)
- **Nightly**: Development builds with latest changes

---

## Migration Guide

### From 0.0.1 to 2.0.0

**Breaking Changes:**
- Complete UI and architecture overhaul
- Data migration required from chrome.storage to IndexedDB
- API key setup now required for all providers
- Manifest V3 upgrade

**Migration Steps:**
1. Export conversations from v0.0.1 (if any)
2. Install v2.0.0
3. Set up API keys for desired providers
4. Import conversations (manual process required)
5. Reconfigure settings and preferences

**New Features to Explore:**
- Multi-provider support
- Image and voice features
- Web integrations
- Advanced research tools

---

## Upcoming Releases

### [2.1.0] - Planned Q2 2026
- Plugin API for third-party extensions
- Firefox and Safari support
- Mobile companion app foundation

### [2.2.0] - Planned Q3 2026
- Local AI model support (Ollama integration)
- Advanced conversation templates
- Team collaboration features

### [3.0.0] - Planned Q4 2026
- Desktop application
- Advanced AI workflows
- Enterprise features

---

## Support

- **Documentation**: [User Guide](USER_GUIDE.md) | [Developer Guide](DEVELOPER_GUIDE.md)
- **Issues**: [GitHub Issues](https://github.com/vivim-org/vivim-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/vivim-org/vivim-extension/discussions)
- **Discord**: [VIVIM Community](https://discord.gg/vivim)

---

## Acknowledgments

- **SiderAI**: Inspiration for comprehensive feature set and architecture
- **POC Contributors**: Foundation work on initial ChatGPT integration
- **Open Source Community**: Libraries and tools that enabled this release
- **Beta Testers**: Users who helped test and refine the extension

---

For the complete list of changes, see the [commit history](https://github.com/vivim-org/vivim-extension/commits/main) on GitHub.</content>
<parameter name="filePath">CHANGELOG.md