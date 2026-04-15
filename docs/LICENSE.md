# MIT License

Copyright (c) 2026 VIVIM Extension

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

## Additional Terms for VIVIM Extension

### 1. Privacy and Data Collection

VIVIM Extension is designed with privacy as a core principle:

- **No Data Collection**: We do not collect, store, or transmit user data to our servers
- **Local Processing**: All conversations and data processing happens on the user's device
- **API Keys**: Users provide their own API keys for AI services - we never see or store them
- **Direct Connections**: All AI API calls go directly to the providers (OpenAI, Anthropic, etc.)

### 2. Third-Party Services

VIVIM Extension integrates with third-party AI services:

- **OpenAI**: GPT models, DALL-E image generation
- **Anthropic**: Claude models
- **Google AI**: Gemini models
- **DeepSeek**: DeepSeek models
- **xAI**: Grok models
- **Groq**: Llama models

Users are responsible for:
- Obtaining API keys from these providers
- Managing billing and usage with providers
- Complying with each provider's terms of service

### 3. Browser Extension Permissions

VIVIM Extension requires certain browser permissions to function:

- **storage**: To save conversations and settings locally
- **tabs**: To detect active tabs for web integration features
- **sidePanel**: To display the main chat interface
- **scripting**: To inject content scripts for web features
- **activeTab**: To access the current tab's content
- **contextMenus**: To provide right-click AI actions
- **unlimitedStorage**: To store large conversation histories

These permissions are used solely for extension functionality and do not transmit data externally.

### 4. Content Security

- **HTTPS Only**: All external communications use secure HTTPS connections
- **Local Storage**: Sensitive data encrypted using Web Crypto API
- **Isolated Execution**: Content scripts run in isolated JavaScript contexts
- **No External Scripts**: Extension bundles all code - no external script loading

### 5. Warranty Disclaimer

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.

VIVIM Extension is not responsible for:
- AI provider service availability or changes
- API key security or misuse
- Data loss due to user actions or device issues
- Compatibility with future browser or provider changes

### 6. Limitation of Liability

IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

This includes but is not limited to:
- Loss of conversations or data
- API usage costs
- Service interruptions
- Third-party API changes

### 7. Updates and Support

- **Updates**: Extension updates are provided through the Chrome Web Store
- **Support**: Community support via GitHub Issues and Discussions
- **No SLA**: No guaranteed response times or service levels
- **Best Effort**: Support provided on a best-effort basis

### 8. Termination

This license terminates automatically if you:
- Violate any terms of this license
- Use the software for illegal purposes
- Attempt to reverse engineer or circumvent security measures
- Distribute modified versions without proper attribution

### 9. Governing Law

This license shall be governed by and construed in accordance with the laws of [Jurisdiction], without regard to its conflict of law provisions.

### 10. Contact Information

For license questions or concerns:
- **Email**: legal@vivim-extension.com
- **GitHub**: [VIVIM Extension Repository](https://github.com/vivim-org/vivim-extension)
- **Issues**: [License Discussion](https://github.com/vivim-org/vivim-extension/discussions/categories/license)

---

## Open Source Components

VIVIM Extension includes or depends on the following open source components:

### Production Dependencies
- **React**: MIT License
- **Dexie.js**: Apache 2.0 License
- **Marked**: MIT License
- **Highlight.js**: BSD 3-Clause License
- **Defuddle**: MIT License

### Build Dependencies
- **Vite**: MIT License
- **TypeScript**: Apache 2.0 License
- **ESLint**: MIT License
- **Tailwind CSS**: MIT License

### Fonts and Assets
- **Inter Font**: SIL Open Font License 1.1
- **JetBrains Mono**: Apache 2.0 License

All open source licenses are included in the repository and must be complied with when using or distributing the software.

---

## Attribution

When using or distributing VIVIM Extension, please include appropriate attribution:

```
VIVIM Extension - Local-first AI assistant
Copyright (c) 2026 VIVIM Extension
Licensed under MIT License
https://github.com/vivim-org/vivim-extension
```

---

*This license applies to VIVIM Extension v2.0 and later versions. Previous versions may have different licensing terms.*

*Last updated: 2026-04-14*</content>
<parameter name="filePath">LICENSE.md