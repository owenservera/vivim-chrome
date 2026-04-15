# VIVIM Extension v2.0

**A local-first, privacy-focused AI assistant for Chrome that brings together 30+ AI models from 6 providers in a unified interface.**

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue)](https://chrome.google.com/webstore)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.md)
[![Version](https://img.shields.io/badge/Version-2.0.0-orange)](CHANGELOG.md)

## 🌟 Features

### 🤖 Multi-Provider AI Chat
- **30+ AI Models** across 6 providers: OpenAI, Anthropic, Google, DeepSeek, xAI, Groq
- **Real-time Streaming** with error recovery and chunk deduplication
- **Local-First Storage** - all conversations stored locally, never sent to servers
- **Export/Import** - complete data portability and backup

### 🎨 Media Generation
- **Image Generation** - DALL-E integration with quality controls
- **Text-to-Speech** - Multiple voices with audio playback
- **Screen Recording** - Tab capture with MP4 encoding
- **Voice Recording** - Audio capture with transcription

### 🌐 Web Integration
- **YouTube Summary** - Automatic video summarization with subtitle extraction
- **Bilingual Subtitles** - Dual-language subtitle display
- **Web Page Analysis** - Content extraction and summarization
- **Search Engine AI** - AI answers on Google, Bing, and other search engines

### 🔬 Advanced Features
- **Deep Research** - Automated multi-source research and report generation
- **Artifacts Viewer** - Code, documents, charts, and mind maps rendering
- **Answer Comparison** - Side-by-side model response comparison
- **Knowledge Base** - Save and organize web content with AI assistance

## 🚀 Quick Start

### Installation

1. **Download** from Chrome Web Store (coming soon)
2. **Install** the extension
3. **Configure** your API keys in settings
4. **Start chatting** with AI models

### First Use

1. Click the VIVIM extension icon in your browser toolbar
2. Open the side panel
3. Go to Settings (gear icon) to add your API keys
4. Select an AI model and start chatting!

## 📋 Requirements

### API Keys (Required)
You'll need API keys from the AI providers you want to use:

- **OpenAI** - For GPT-4, GPT-3.5, DALL-E, TTS
- **Anthropic** - For Claude models (optional)
- **Google AI** - For Gemini models (optional)
- **DeepSeek** - For DeepSeek models (optional)
- **xAI** - For Grok models (optional)
- **Groq** - For Llama models (optional)

### System Requirements
- **Chrome**: Version 100+
- **Storage**: ~100MB free space
- **Internet**: Required for AI API calls (no extension servers)

## 🔧 Configuration

### API Key Setup

1. Open VIVIM side panel
2. Click the settings gear icon
3. Navigate to "API Keys" section
4. Enter your API keys for desired providers
5. Keys are encrypted and stored locally

### Model Preferences

- **Default Model**: Choose your primary AI model
- **Temperature**: Adjust creativity (0.0-1.0)
- **Max Tokens**: Set response length limits
- **Streaming**: Enable real-time responses

### Privacy Settings

- **Local Only**: All data stays on your device
- **No Analytics**: No usage tracking or data collection
- **Export Data**: Backup conversations anytime
- **Data Portability**: Move data between devices

## 🎯 Use Cases

### For Developers
- Code review and debugging assistance
- API documentation generation
- Technical writing and documentation
- Learning new programming languages

### For Researchers
- Literature review and analysis
- Data interpretation
- Research question formulation
- Knowledge synthesis

### For Content Creators
- Script writing and editing
- Social media content generation
- Video script summarization
- Creative writing assistance

### For Students
- Essay writing and research
- Study material summarization
- Language learning
- Homework assistance

## 🏗️ Architecture

VIVIM Extension v2.0 is built with a modular plugin architecture:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   UI Layer      │    │  Core Services  │    │ Integration    │
│                 │    │                 │    │ Layer          │
│ • React UI      │    │ • Plugin System │    │ • Web Content  │
│ • Side Panel    │    │ • Stream Proc.  │    │ • Search Eng.  │
│ • Settings      │    │ • Storage       │    │ • YouTube      │
│ • Standalone    │    │ • Auth Manager  │    │ • Context Menu │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  │
                    ┌─────────────┴─────────────┐
                    │   Local-First Storage    │
                    │   (IndexedDB + Crypto)   │
                    └──────────────────────────┘
```

### Key Principles
- **Local-First**: All data stored locally
- **Privacy-Focused**: No data collection
- **Modular**: Plugin-based architecture
- **Extensible**: Easy to add new providers/features

## 📚 Documentation

- **[User Guide](USER_GUIDE.md)** - Complete user documentation
- **[Developer Guide](DEVELOPER_GUIDE.md)** - Technical documentation for contributors
- **[API Reference](API_REFERENCE.md)** - Plugin API documentation
- **[Migration Guide](docs/MIGRATION_PLAN.md)** - POC to v2.0 migration details
- **[Architecture](docs/COMPLETE_FEATURE_SET_AND_ARCHITECTURE.md)** - Technical architecture
- **[PRD](docs/PRD.md)** - Product requirements document

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
```bash
# Clone the repository
git clone https://github.com/your-org/vivim-extension.git
cd vivim-extension

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Testing
```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Lint code
npm run lint
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE.md) file for details.

## 🙋 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/vivim-extension/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/vivim-extension/discussions)
- **Documentation**: [User Guide](USER_GUIDE.md)

## 🗺️ Roadmap

### v2.0.0 (Current)
- ✅ Multi-provider AI chat
- ✅ Local-first storage
- ✅ Media generation
- ✅ Web integration
- ✅ Advanced research tools

### Future Releases
- **v2.1.0**: Plugin API for third-party extensions
- **v2.2.0**: Firefox and Safari support
- **v2.3.0**: Mobile companion apps
- **v3.0.0**: Desktop application

## 🙏 Acknowledgments

- **SiderAI**: Inspiration for the comprehensive feature set
- **POC**: Foundation for the initial ChatGPT integration
- **Open Source Community**: Libraries and tools that made this possible

---

**VIVIM Extension v2.0** - *AI assistance, your way. Private, local, powerful.*</content>
<parameter name="filePath">README.md