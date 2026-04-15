# Installation Guide

This guide will help you install and set up VIVIM Extension v2.0 on your system.

---

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation Methods](#installation-methods)
3. [First-Time Setup](#first-time-setup)
4. [API Key Configuration](#api-key-configuration)
5. [Verification](#verification)
6. [Troubleshooting](#troubleshooting)
7. [Uninstallation](#uninstallation)

---

## System Requirements

### Minimum Requirements

- **Operating System**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **Browser**: Chrome 100+, Edge 100+, Firefox 100+ (limited support)
- **RAM**: 512MB available
- **Storage**: 100MB free space
- **Internet**: Stable broadband connection

### Recommended Requirements

- **Operating System**: Windows 11, macOS 12+, Ubuntu 20.04+
- **Browser**: Chrome 120+, Edge 120+
- **RAM**: 1GB available
- **Storage**: 500MB free space
- **Internet**: High-speed broadband

### Browser Compatibility

| Browser | Version | Status | Notes |
|---------|---------|--------|-------|
| Chrome | 100+ | ✅ Full Support | Recommended |
| Edge | 100+ | ✅ Full Support | Recommended |
| Firefox | 100+ | ⚠️ Limited Support | Basic functionality only |
| Safari | - | ❌ Not Supported | Planned for future release |

---

## Installation Methods

### Method 1: Chrome Web Store (Recommended)

#### For Regular Users

1. **Open Chrome Web Store**
   - Visit: `https://chrome.google.com/webstore/detail/vivim-extension/[extension-id]`
   - Or search for "VIVIM Extension" in the Chrome Web Store

2. **Install the Extension**
   - Click the **"Add to Chrome"** button
   - Review the permissions and click **"Add extension"**
   - Wait for the installation to complete

3. **Verify Installation**
   - Look for the VIVIM icon in your browser toolbar
   - Click the icon to open the side panel
   - The extension should load without errors

#### For Organizations

If your organization uses Chrome Enterprise:

1. **Deploy via Google Admin Console**
   - Sign in to [Google Admin Console](https://admin.google.com)
   - Navigate to **Devices > Chrome > Apps & extensions**
   - Click **"+"** to add the extension
   - Enter the extension ID: `[extension-id]`
   - Configure installation policy

2. **Force Installation**
   - Set installation policy to "Force install"
   - Configure update settings
   - Apply to organizational units as needed

### Method 2: Manual Installation (Development/Beta)

#### Download the Extension

1. **Get the Extension Package**
   - Visit the [GitHub Releases](https://github.com/vivim-org/vivim-extension/releases) page
   - Download the latest `.zip` or `.crx` file
   - Or clone the repository and build from source

2. **Load in Chrome**

   **Option A: Load Unpacked (Development)**
   ```bash
   # If you cloned the repository
   cd vivim-extension
   npm install
   npm run build

   # Then in Chrome:
   # 1. Open chrome://extensions/
   # 2. Enable "Developer mode"
   # 3. Click "Load unpacked"
   # 4. Select the "dist" folder
   ```

   **Option B: Install CRX File**
   ```bash
   # Download the .crx file
   # In Chrome:
   # 1. Open chrome://extensions/
   # 2. Drag and drop the .crx file onto the page
   # 3. Confirm installation
   ```

3. **Enable Developer Mode**
   - Open `chrome://extensions/`
   - Toggle **"Developer mode"** in the top right
   - This allows loading unpacked extensions

#### Build from Source

If you want to build from source:

```bash
# Clone the repository
git clone https://github.com/vivim-org/vivim-extension.git
cd vivim-extension

# Install dependencies
npm install

# Build for production
npm run build

# The built extension will be in the "dist" folder
```

### Method 3: Firefox Installation (Limited Support)

⚠️ **Note**: Firefox support is currently limited. Full Firefox support is planned for v2.1.0.

1. **Download Firefox Version**
   - Check [GitHub Releases](https://github.com/vivim-org/vivim-extension/releases) for Firefox builds
   - Look for files with "firefox" in the name

2. **Install in Firefox**
   - Open Firefox and go to `about:debugging`
   - Click **"This Firefox"**
   - Click **"Load Temporary Add-on"**
   - Select the Firefox extension file

3. **Known Limitations**
   - Some features may not work correctly
   - Performance may be reduced
   - UI may appear differently

---

## First-Time Setup

### Step 1: Open the Extension

1. **Find the VIVIM Icon**
   - Look for the purple VIVIM icon in your browser toolbar
   - If you don't see it, click the puzzle piece icon to show all extensions
   - Pin VIVIM to your toolbar for easy access

2. **Open the Side Panel**
   - Click the VIVIM icon
   - The side panel should slide out from the right side
   - If it doesn't open, try refreshing the page

### Step 2: Initial Configuration

1. **Welcome Screen**
   - The extension will show a welcome message
   - Click **"Get Started"** to begin setup

2. **Theme Selection**
   - Choose between Light, Dark, or System theme
   - This can be changed later in settings

3. **Language Selection**
   - Select your preferred language
   - Additional languages can be added in future updates

### Step 3: API Key Setup

See the [API Key Configuration](#api-key-configuration) section below.

---

## API Key Configuration

VIVIM requires API keys to function. You pay the AI providers directly - we never see your keys.

### Supported Providers

| Provider | Models | API Key Location | Cost |
|----------|--------|------------------|------|
| **OpenAI** | GPT-4, GPT-3.5, DALL-E, TTS | [OpenAI API](https://platform.openai.com/api-keys) | Pay-as-you-go |
| **Anthropic** | Claude 3 Opus/Sonnet/Haiku | [Anthropic Console](https://console.anthropic.com/) | Pay-as-you-go |
| **Google AI** | Gemini 1.5 Pro, etc. | [Google AI Studio](https://makersuite.google.com/app/apikey) | Pay-as-you-go |
| **DeepSeek** | DeepSeek Chat/Coder | [DeepSeek Platform](https://platform.deepseek.com/) | Pay-as-you-go |
| **xAI** | Grok | [xAI Console](https://console.x.ai/) | Pay-as-you-go |
| **Groq** | Llama models | [Groq Console](https://console.groq.com/) | Pay-as-you-go |

### Setup Process

#### Step 1: Access Settings

1. Open VIVIM side panel
2. Click the **gear/settings icon** in the header
3. Navigate to **"API Keys"** section

#### Step 2: Add API Keys

**For OpenAI (Required for basic functionality):**

1. Visit [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Copy the generated key
4. Paste it in VIVIM settings under "OpenAI API Key"
5. Click **"Test Connection"** to verify

**For Additional Providers (Optional):**

1. Follow the links above for each provider
2. Create API keys following their instructions
3. Add them to VIVIM settings
4. Test each connection

#### Step 3: Billing Setup

- **OpenAI**: Add payment method in your OpenAI account
- **Anthropic**: Add credits to your Anthropic account
- **Google**: Enable billing in Google Cloud Console
- **Others**: Follow their billing setup instructions

### Security Notes

- ✅ **Encrypted Storage**: Keys are encrypted locally on your device
- ✅ **Never Transmitted**: Keys stay on your device only
- ✅ **Your Responsibility**: You manage billing directly with providers
- ✅ **Export Safe**: Keys are not included in data exports

### Key Validation

VIVIM will validate your API keys when you:
- Add or update a key
- Click **"Test Connection"**
- Send your first message with a provider

**Common Issues:**
- **"Invalid API Key"**: Double-check the key format
- **"Insufficient Credits"**: Add funds to your provider account
- **"Rate Limited"**: Wait a few minutes and try again

---

## Verification

### Test Basic Functionality

1. **Open Side Panel**
   - Click VIVIM icon
   - Panel should slide out smoothly

2. **Send a Test Message**
   - Type "Hello, this is a test message"
   - Select a model (GPT-4 recommended)
   - Click send (▶)
   - Wait for AI response

3. **Test Streaming**
   - Response should appear progressively
   - No "loading" spinner blocking the UI
   - Response should complete within 30 seconds

4. **Test Conversation Management**
   - Send multiple messages
   - Create a new conversation (+ button)
   - Switch between conversations
   - Messages should persist across browser restarts

### Advanced Feature Testing

#### Image Generation
1. Click the **image icon** in the input area
2. Type "a cute cat playing with a ball of yarn"
3. Select quality and click generate
4. Image should appear in the conversation

#### Web Integration
1. Visit a YouTube video
2. Look for VIVIM's video summary option
3. Click to generate a summary
4. Summary should appear with key points

#### Search Integration
1. Go to Google.com
2. Search for "what is machine learning"
3. Look for VIVIM's AI answer cards
4. Click to see AI-generated explanations

### Performance Verification

- **Load Time**: Extension should open within 3 seconds
- **Memory Usage**: Should use less than 100MB RAM
- **Response Time**: AI responses should appear within 1-2 seconds
- **Stability**: No crashes or freezing during normal use

---

## Troubleshooting

### Installation Issues

#### Extension Won't Install
**Problem**: Chrome blocks the installation
**Solutions**:
- Ensure you're using Chrome 100+
- Disable any ad blockers temporarily
- Try in incognito mode
- Check if Chrome is up to date

#### "Manifest File Invalid" Error
**Problem**: Extension files are corrupted
**Solutions**:
- Download the extension again
- Clear browser cache
- Try a different browser
- Check file permissions

#### Extension Doesn't Appear
**Problem**: Extension icon missing from toolbar
**Solutions**:
- Click the puzzle piece icon in toolbar
- Find VIVIM and click the pin icon
- Refresh the page
- Restart Chrome

### Setup Issues

#### Can't Access Settings
**Problem**: Settings panel won't open
**Solutions**:
- Click the gear icon in the side panel header
- Try right-clicking the VIVIM icon
- Refresh the browser page
- Restart the extension

#### API Key Not Saving
**Problem**: Keys disappear after entering
**Solutions**:
- Check browser storage permissions
- Try in incognito mode
- Clear browser cache and cookies
- Restart Chrome completely

### Runtime Issues

#### "API Key Required" Error
**Problem**: No valid API key configured
**Solutions**:
- Go to settings and add an API key
- Test the connection
- Check key format (no extra spaces)
- Verify account has credits

#### Slow or No Response
**Problem**: AI responses are slow or missing
**Solutions**:
- Check internet connection
- Switch to a different model
- Try a different provider
- Check provider status pages

#### Extension Freezes
**Problem**: UI becomes unresponsive
**Solutions**:
- Refresh the browser page
- Restart Chrome
- Disable and re-enable the extension
- Clear browser cache

### Compatibility Issues

#### Firefox Problems
**Problem**: Features don't work in Firefox
**Solutions**:
- Firefox support is limited in v2.0
- Use Chrome for full functionality
- Check Firefox version (100+ required)

#### Mobile Issues
**Problem**: Doesn't work on mobile Chrome
**Solutions**:
- VIVIM requires desktop Chrome
- Mobile companion app planned for future
- Use desktop version for now

---

## Uninstallation

### Remove from Chrome

1. **Open Extension Manager**
   - Go to `chrome://extensions/`
   - Find VIVIM Extension in the list

2. **Remove Extension**
   - Click the **"Remove"** button
   - Confirm the removal
   - The extension will be uninstalled

3. **Clean Up Data** (Optional)
   - Clear browser cache
   - Remove any exported conversation files
   - Revoke API keys if desired

### Data Preservation

**Before uninstalling, consider:**

1. **Export Conversations**
   - Open VIVIM settings
   - Go to Data Management
   - Export all conversations
   - Save the export file securely

2. **API Key Backup**
   - Note down your API keys
   - Store them securely (password manager recommended)

3. **Reinstallation**
   - You can reinstall anytime
   - Import your conversations
   - Re-add API keys

### Complete Cleanup

For a thorough removal:

```bash
# Clear browser data (optional)
# Chrome: Settings > Privacy and security > Clear browsing data

# Remove extension data
# Chrome will automatically clean up extension storage on removal
```

---

## Getting Help

If you encounter issues not covered here:

### Documentation
- **[User Guide](USER_GUIDE.md)** - Comprehensive usage instructions
- **[Troubleshooting](TROUBLESHOOTING.md)** - Detailed problem-solving
- **[FAQ](USER_GUIDE.md#faq)** - Common questions and answers

### Community Support
- **GitHub Issues**: [Report bugs](https://github.com/vivim-org/vivim-extension/issues)
- **GitHub Discussions**: [Ask questions](https://github.com/vivim-org/vivim-extension/discussions)
- **Discord**: [Join our community](https://discord.gg/vivim)

### Contact Information
- **Email**: support@vivim-extension.com
- **Twitter**: [@VIVIM_Extension](https://twitter.com/VIVIM_Extension)

---

## Next Steps

Once installed and configured, explore VIVIM's features:

1. **Try Different Models**: Experiment with GPT-4, Claude, and Gemini
2. **Use Web Integration**: Test YouTube summaries and web page analysis
3. **Explore Advanced Features**: Try deep research and artifacts
4. **Customize Settings**: Adjust themes, shortcuts, and preferences

Welcome to VIVIM Extension! Enjoy your enhanced AI experience. 🤖✨</content>
<parameter name="filePath">INSTALLATION.md