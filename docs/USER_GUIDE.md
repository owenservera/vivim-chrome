# VIVIM Extension - User Guide

## Welcome to VIVIM Extension v2.0

VIVIM is a powerful, local-first AI assistant that brings together 30+ AI models from 6 providers in a unified Chrome extension. All your conversations and data stay on your device - we never send your data to our servers.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Installation](#installation)
3. [API Key Setup](#api-key-setup)
4. [Basic Chat](#basic-chat)
5. [Advanced Features](#advanced-features)
6. [Web Integration](#web-integration)
7. [Settings & Preferences](#settings--preferences)
8. [Data Management](#data-management)
9. [Troubleshooting](#troubleshooting)
10. [FAQ](#faq)

---

## Getting Started

### What is VIVIM?

VIVIM Extension is an AI assistant that:
- **Stays Local**: All conversations stored on your device
- **Multi-Provider**: Works with OpenAI, Anthropic, Google, and more
- **Feature-Rich**: Chat, images, voice, web integration, research tools
- **Privacy-First**: No data collection or server dependencies

### System Requirements

- **Browser**: Chrome 100+ (Edge, Firefox support coming soon)
- **Storage**: ~100MB free space for conversations
- **Internet**: Required for AI API calls only

---

## Installation

### From Chrome Web Store (Recommended)

1. Visit the [Chrome Web Store page](https://chrome.google.com/webstore) for VIVIM
2. Click **"Add to Chrome"**
3. Confirm installation in the popup
4. The VIVIM icon will appear in your toolbar

### Manual Installation (Development)

1. Download the extension ZIP file
2. Open Chrome and go to `chrome://extensions/`
3. Enable **"Developer mode"** (top right)
4. Click **"Load unpacked"**
5. Select the extension folder
6. The extension is now installed

---

## API Key Setup

VIVIM requires API keys from AI providers to function. Here's how to set them up:

### Step 1: Open Settings

1. Click the VIVIM icon in your browser toolbar
2. Click the **gear/settings icon** in the side panel header
3. Navigate to the **"API Keys"** section

### Step 2: Add Your API Keys

#### OpenAI (Required for basic functionality)
1. Go to [OpenAI API](https://platform.openai.com/api-keys)
2. Create a new API key
3. Copy the key and paste it in VIVIM settings
4. This enables GPT-4, GPT-3.5, DALL-E, and TTS

#### Anthropic (Optional - Claude models)
1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Generate an API key
3. Add it to VIVIM for Claude access

#### Google AI (Optional - Gemini models)
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add it for Gemini model access

#### Other Providers (Optional)
- **DeepSeek**: [DeepSeek API](https://platform.deepseek.com/)
- **xAI**: [xAI API](https://console.x.ai/)
- **Groq**: [Groq API](https://console.groq.com/)

### Step 3: Verify Setup

1. Return to the chat interface
2. Try sending a message
3. If you see an error about missing keys, double-check your entries

### Security Notes

- ✅ **Encrypted Storage**: Keys are encrypted locally
- ✅ **Never Transmitted**: Keys stay on your device
- ✅ **Your Billing**: You pay providers directly, we never see your keys
- ✅ **Export Safe**: Keys are not included in data exports

---

## Basic Chat

### Starting a Conversation

1. Click the VIVIM icon in your toolbar
2. The side panel will open
3. Select an AI model from the dropdown
4. Type your message in the input box
5. Press Enter or click the send button (▶)

### Model Selection

VIVIM supports 30+ models across 6 providers:

#### OpenAI Models
- **GPT-4** - Most capable model for complex tasks
- **GPT-3.5-Turbo** - Fast and cost-effective
- **GPT-4-Turbo** - Latest GPT-4 with larger context
- **o1-preview/o1-mini** - Reasoning-focused models

#### Anthropic Models
- **Claude 3 Opus** - Most capable Claude model
- **Claude 3 Sonnet** - Balanced performance/cost
- **Claude 3 Haiku** - Fast and lightweight

#### Google Models
- **Gemini 1.5 Pro** - Google's latest model
- **Gemini Pro** - Standard Gemini model

#### Other Providers
- **DeepSeek Chat/Coder** - Chinese models
- **Grok** - xAI's helpful model
- **Llama models** - Via Groq for speed

### Streaming Responses

- **Real-time Display**: Watch responses appear as they're generated
- **Interrupt Anytime**: Click the stop button to halt generation
- **Error Recovery**: Automatic retry on temporary failures
- **Chunk Management**: Smart deduplication prevents duplicates

### Conversation Management

#### Creating New Conversations
- Click the **"+"** button in the header
- Or use **Ctrl+N** (Windows) / **Cmd+N** (Mac)

#### Switching Conversations
- Use the conversation list in the left sidebar
- Search conversations with the search bar
- Conversations auto-save as you chat

#### Conversation Actions
- **Rename**: Click the title to edit
- **Delete**: Right-click → Delete conversation
- **Export**: Right-click → Export conversation
- **Star**: Mark important conversations

---

## Advanced Features

### Image Generation

1. Click the **image icon** in the input area
2. Type your image description
3. Select quality (Low/Medium/High)
4. Click **Generate**
5. Images appear in the conversation
6. Right-click images to download

#### Tips for Better Images
- Be specific about style, lighting, and composition
- Use descriptive adjectives
- Mention art styles (photorealistic, cartoon, etc.)
- Specify dimensions or aspect ratios

### Text-to-Speech (TTS)

1. Click the **speaker icon** after any message
2. Select a voice from the dropdown
3. Choose speed and pitch (if available)
4. Click **Play** to hear the audio
5. Audio plays with transcript highlighting

#### Available Voices
- **OpenAI Voices**: Alloy, Echo, Fable, Onyx, Nova, Shimmer
- **Provider-specific voices**: Vary by provider

### Screen Recording

1. Click the **camera icon** in the input area
2. Choose **Screen Recording**
3. Select what to record (current tab, window, or screen)
4. Click **Start Recording**
5. Recording controls appear
6. Click **Stop** when finished
7. Video processes and appears in chat

#### Recording Options
- **MP4 Format**: Web-optimized video
- **Audio Included**: Captures system audio
- **Quality Settings**: Adjust resolution and bitrate

### Voice Input

1. Click the **microphone icon** in the input area
2. Grant microphone permission if prompted
3. Start speaking
4. Speech converts to text automatically
5. Click send when finished

#### Voice Features
- **Real-time transcription**: See text as you speak
- **Auto-punctuation**: Smart punctuation insertion
- **Language detection**: Automatic language recognition
- **Noise filtering**: Background noise reduction

---

## Web Integration

### YouTube Video Summary

#### Automatic Summarization
1. Visit any YouTube video
2. VIVIM will detect the video
3. Click **"Read this page"** in the context menu
4. AI generates a summary with key points

#### Manual Subtitle Extraction
1. On a YouTube video page
2. Right-click anywhere on the page
3. Select **"Extract Subtitles with VIVIM"**
4. Choose language and format
5. Subtitles download or appear in chat

#### Bilingual Subtitles
1. Extract subtitles in original language
2. Use **"Translate"** feature on the subtitle text
3. VIVIM displays dual-language subtitles
4. Toggle between languages during playback

### Web Page Summarization

#### Quick Summary
1. Visit any webpage
2. Right-click on the page
3. Select **"Summarize with VIVIM"**
4. AI analyzes and summarizes the content

#### Content Extraction
- **Clean Reading**: Removes ads and navigation
- **Key Points**: Extracts main ideas
- **Metadata**: Includes author, date, reading time
- **Links**: Preserves important links

### Search Engine Integration

#### AI Answers on Search Results

When searching on Google, Bing, or other engines:
- Look for **"Ask AI"** buttons next to search results
- Click to get AI-powered explanations
- Choose different models for varied responses
- Answers appear in expandable cards

#### Search Tips
- Use specific questions for better AI answers
- Try complex queries that benefit from reasoning
- Compare answers from different models

---

## Settings & Preferences

### Accessing Settings

1. Open VIVIM side panel
2. Click the **gear icon** in the header
3. Navigate through different sections

### Model Preferences

#### Default Settings
- **Primary Model**: Your most-used AI model
- **Temperature**: Creativity level (0.0 = consistent, 1.0 = creative)
- **Max Tokens**: Response length limit
- **System Prompt**: Custom instructions for all conversations

#### Provider-Specific Settings
- **API Endpoints**: Custom API URLs if needed
- **Rate Limits**: Adjust for your API tier
- **Timeouts**: Connection timeout settings

### UI Preferences

#### Appearance
- **Theme**: Light, Dark, or System
- **Font Size**: Adjust text size
- **Sidebar Width**: Customize panel width
- **Message Style**: Compact or comfortable spacing

#### Language & Localization
- **Interface Language**: English, Spanish, French, etc.
- **Date Format**: Choose your preferred format
- **Number Format**: Localization settings

### Privacy & Security

#### Data Controls
- **Conversation Retention**: How long to keep conversations
- **Auto-delete**: Remove old conversations automatically
- **Export Reminders**: Periodic backup reminders

#### Privacy Settings
- **Analytics**: Opt-in/out of usage analytics (disabled by default)
- **Crash Reports**: Automatic error reporting (disabled by default)
- **Data Sharing**: Never share conversation data

### Keyboard Shortcuts

#### Global Shortcuts
- **Toggle Panel**: `Alt+S` (customizable)
- **New Conversation**: `Ctrl+N` / `Cmd+N`
- **Focus Input**: `Ctrl+L` / `Cmd+L`

#### Chat Shortcuts
- **Send Message**: `Enter` (or `Ctrl+Enter`)
- **New Line**: `Shift+Enter`
- **Clear Conversation**: `Ctrl+K` / `Cmd+K`

---

## Data Management

### Exporting Data

#### Single Conversation
1. Right-click on a conversation in the sidebar
2. Select **"Export Conversation"**
3. Choose format (JSON, Markdown, or Text)
4. Save file to your computer

#### All Conversations
1. Go to Settings → Data Management
2. Click **"Export All Data"**
3. Choose export options
4. Download complete backup file

#### Export Formats
- **JSON**: Complete data with metadata
- **Markdown**: Human-readable format
- **Text**: Plain text conversations
- **HTML**: Web-viewable format

### Importing Data

1. Go to Settings → Data Management
2. Click **"Import Data"**
3. Select your export file
4. Choose import options (merge or replace)
5. Confirm import

### Data Portability

#### Moving Between Devices
1. Export data from old device
2. Install VIVIM on new device
3. Import data file
4. All conversations and settings restore

#### Backup Strategy
- **Automatic**: Enable auto-export in settings
- **Manual**: Regular manual exports
- **Cloud**: Store backups in your preferred cloud service

### Storage Management

#### Checking Usage
- Settings → Data Management → Storage
- See conversation count and storage used
- View largest conversations
- Clean up old/unused data

#### Cleanup Options
- **Delete Old Conversations**: By date or count
- **Remove Large Attachments**: Free up space
- **Compress Data**: Reduce storage usage
- **Optimize Database**: Performance maintenance

---

## Troubleshooting

### Common Issues

#### "API Key Required" Error
**Problem**: Missing or invalid API key
**Solution**:
1. Check Settings → API Keys
2. Verify key format and validity
3. Test key on provider's website
4. Re-enter if necessary

#### "Stream Timeout" Error
**Problem**: Slow or interrupted connection
**Solution**:
1. Check internet connection
2. Try a different model/provider
3. Reduce max tokens setting
4. Wait and retry

#### "Quota Exceeded" Error
**Problem**: Hit API usage limits
**Solution**:
1. Check provider's billing/usage page
2. Upgrade your API plan if needed
3. Switch to different provider temporarily
4. Wait for quota reset

#### Extension Not Loading
**Problem**: Extension fails to initialize
**Solution**:
1. Refresh the page
2. Restart Chrome
3. Check extension is enabled in `chrome://extensions/`
4. Try reinstalling the extension

### Performance Issues

#### Slow Responses
- Switch to faster models (GPT-3.5, Claude Haiku)
- Reduce max tokens
- Check internet speed
- Close other tabs/applications

#### High Memory Usage
- Clear old conversations
- Reduce stored conversation history
- Restart Chrome periodically
- Check for extension conflicts

#### Storage Full
- Export and delete old conversations
- Clear browser cache
- Free up disk space
- Use external storage for backups

### Web Integration Issues

#### YouTube Features Not Working
- Ensure you're on youtube.com
- Check if video has subtitles available
- Try refreshing the page
- Disable other YouTube extensions temporarily

#### Search Integration Missing
- Verify supported search engine
- Check content script permissions
- Try incognito mode
- Update extension to latest version

---

## FAQ

### General Questions

**Q: Is VIVIM free?**
A: VIVIM extension is free and open source. You only pay for the AI API calls to providers like OpenAI, Anthropic, etc.

**Q: Where is my data stored?**
A: All conversations, settings, and data are stored locally on your device using IndexedDB. Nothing is sent to external servers.

**Q: Can I use VIVIM offline?**
A: No, VIVIM requires internet access for AI API calls. However, you can view previous conversations offline.

**Q: Which browsers are supported?**
A: Currently Chrome 100+. Firefox and Safari support planned for future releases.

### Privacy & Security

**Q: Are my API keys safe?**
A: Yes, API keys are encrypted locally and never transmitted to our servers. Only you and the AI providers can see them.

**Q: Do you collect my conversations?**
A: No, we never see or collect your conversation data. Everything stays on your device.

**Q: What permissions does VIVIM need?**
A: VIVIM needs permissions for storage, tabs, side panel, and scripting to function properly. No microphone/camera access unless you use those features.

### Technical Questions

**Q: Can I use multiple API keys?**
A: Yes, you can configure keys for multiple providers and switch between them.

**Q: What happens if an API is down?**
A: VIVIM will automatically retry and can fall back to other providers if configured.

**Q: Can I customize the AI behavior?**
A: Yes, through system prompts, temperature settings, and model selection.

**Q: How many conversations can I store?**
A: Practically unlimited. Storage is only limited by your device's disk space.

### Feature Questions

**Q: Can VIVIM work with local AI models?**
A: Not currently, but this is planned for future versions.

**Q: Can I share conversations?**
A: Yes, export conversations to shareable formats like Markdown or JSON.

**Q: Does VIVIM support images in chat?**
A: Yes, you can upload images for analysis and generate new images.

**Q: Can I use VIVIM on mobile?**
A: Not currently, but mobile companion apps are planned.

---

## Getting Help

### Documentation
- **[User Guide](USER_GUIDE.md)** - This comprehensive guide
- **[Troubleshooting](TROUBLESHOOTING.md)** - Common issues and solutions
- **[Developer Guide](DEVELOPER_GUIDE.md)** - For advanced users

### Community Support
- **GitHub Issues**: [Report bugs](https://github.com/your-org/vivim-extension/issues)
- **Discussions**: [Ask questions](https://github.com/your-org/vivim-extension/discussions)
- **Feature Requests**: [Suggest improvements](https://github.com/your-org/vivim-extension/issues)

### Contact Information
- **Email**: support@vivim-extension.com
- **Twitter**: [@VIVIM_Extension](https://twitter.com/VIVIM_Extension)
- **Discord**: [VIVIM Community](https://discord.gg/vivim)

---

*Thank you for using VIVIM Extension! We hope it enhances your AI experience while keeping your data private and secure.*</content>
<parameter name="filePath">USER_GUIDE.md