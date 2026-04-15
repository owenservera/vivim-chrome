# Troubleshooting Guide

This guide helps you resolve common issues with VIVIM Extension v2.0. If you can't find a solution here, check our [community forums](https://github.com/vivim-org/vivim-extension/discussions) or [submit an issue](https://github.com/vivim-org/vivim-extension/issues).

---

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Setup & Configuration Problems](#setup--configuration-problems)
3. [API & Authentication Issues](#api--authentication-issues)
4. [Chat & Streaming Problems](#chat--streaming-problems)
5. [Performance Issues](#performance-issues)
6. [Web Integration Problems](#web-integration-problems)
7. [UI & Display Issues](#ui--display-issues)
8. [Data & Storage Issues](#data--storage-issues)
9. [Browser Compatibility](#browser-compatibility)
10. [Advanced Troubleshooting](#advanced-troubleshooting)

---

## Installation Issues

### Extension Won't Install

**Symptoms:**
- "Installation blocked" message
- Extension doesn't appear after clicking "Add to Chrome"
- Download fails

**Solutions:**

1. **Check Browser Version**
   ```bash
   # In Chrome, go to: chrome://version
   # Minimum required: Chrome 100+
   ```

2. **Disable Extensions Temporarily**
   - Some ad blockers or security extensions may interfere
   - Try installing in incognito mode
   - Disable antivirus temporarily

3. **Clear Browser Cache**
   - Go to `chrome://settings/clearBrowserData`
   - Clear "Cached images and files"
   - Clear "Cookies and other site data"

4. **Try Manual Installation**
   - Download from [GitHub Releases](https://github.com/vivim-org/vivim-extension/releases)
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the extension folder

### Extension Icon Missing

**Symptoms:**
- VIVIM icon not visible in toolbar
- Extension appears installed but inaccessible

**Solutions:**

1. **Pin the Extension**
   - Click the puzzle piece icon in toolbar
   - Find "VIVIM Extension"
   - Click the pin icon

2. **Check Extension Status**
   - Go to `chrome://extensions/`
   - Ensure VIVIM is enabled
   - Try toggling it off/on

3. **Refresh Browser**
   - Completely close and reopen Chrome
   - Try in a new browser window

### "Manifest File Invalid" Error

**Symptoms:**
- Installation fails with manifest error
- Extension appears corrupted

**Solutions:**

1. **Redownload Extension**
   - Get fresh copy from Chrome Web Store or GitHub
   - Avoid third-party download sites

2. **Check File Integrity**
   ```bash
   # If building from source
   npm run build
   # Ensure dist/manifest.json exists and is valid JSON
   ```

3. **Clear Extension Cache**
   - Go to `chrome://extensions/`
   - Enable developer mode
   - Look for "Errors" section for VIVIM

---

## Setup & Configuration Problems

### Settings Panel Won't Open

**Symptoms:**
- Clicking gear icon does nothing
- Settings menu inaccessible

**Solutions:**

1. **Check Side Panel**
   - Ensure side panel is open
   - Try clicking the VIVIM toolbar icon again

2. **Browser Console**
   - Press `F12` to open developer tools
   - Check console for JavaScript errors
   - Look for messages related to settings

3. **Extension Reload**
   - Go to `chrome://extensions/`
   - Find VIVIM and click the reload button
   - Try accessing settings again

### API Keys Not Saving

**Symptoms:**
- Keys disappear after entering
- "API Key Required" error persists

**Solutions:**

1. **Check Storage Permissions**
   - Go to `chrome://settings/content/siteData`
   - Ensure storage is allowed for chrome-extension://

2. **Browser Settings**
   - Try in incognito mode (disables extensions that might interfere)
   - Clear browser cache and cookies

3. **Extension Reset**
   - Remove and reinstall the extension
   - This will clear all data including corrupted keys

4. **Manual Storage Check**
   - Go to `chrome://extensions/`
   - Click "background page" link for VIVIM
   - Check Application tab → Storage → IndexedDB

---

## API & Authentication Issues

### "Invalid API Key" Error

**Symptoms:**
- API calls fail with authentication error
- Test connection fails

**Solutions:**

1. **Verify Key Format**
   - OpenAI keys start with "sk-"
   - Anthropic keys are 108 characters
   - Check for extra spaces or characters

2. **Regenerate Key**
   - Go to provider's website
   - Delete old key and create new one
   - Update in VIVIM immediately

3. **Check Account Status**
   - Ensure account has billing enabled
   - Verify sufficient credits/balance
   - Check for account restrictions

4. **Provider Status**
   - Check provider status pages:
     - [OpenAI Status](https://status.openai.com/)
     - [Anthropic Status](https://status.anthropic.com/)
     - [Google Cloud Status](https://status.cloud.google.com/)

### Rate Limiting Errors

**Symptoms:**
- "Rate limit exceeded" messages
- Requests fail with 429 status

**Solutions:**

1. **Check Limits**
   - Review provider's rate limits
   - OpenAI: 10,000 RPM for GPT-4
   - Anthropic: Varies by model

2. **Reduce Request Frequency**
   - Wait 1-2 minutes between requests
   - Switch to different provider temporarily
   - Use queue system for multiple requests

3. **Upgrade Plan**
   - Consider higher-tier plans for increased limits
   - Some providers offer burst capacity

### Network/Connectivity Issues

**Symptoms:**
- Requests timeout
- "Network error" messages

**Solutions:**

1. **Check Internet Connection**
   - Test with other websites
   - Try different network if possible

2. **VPN/Proxy Issues**
   - Disable VPN temporarily
   - Some providers block certain VPNs

3. **Firewall Settings**
   - Ensure outbound HTTPS connections allowed
   - Check corporate firewall rules

4. **DNS Issues**
   ```bash
   # Test DNS resolution
   nslookup api.openai.com
   ```

---

## Chat & Streaming Problems

### Messages Not Sending

**Symptoms:**
- Clicking send does nothing
- Message stays in input box

**Solutions:**

1. **Check API Key**
   - Ensure valid API key configured
   - Test connection in settings

2. **Model Selection**
   - Verify selected model is available
   - Try switching to different model

3. **Input Validation**
   - Check message length limits
   - Ensure no special characters causing issues

4. **Browser Console**
   - Check for JavaScript errors
   - Look for network request failures

### Streaming Not Working

**Symptoms:**
- Responses appear all at once instead of streaming
- Long delays before any response

**Solutions:**

1. **Model Support**
   - Not all models support streaming
   - GPT-4 and Claude support streaming
   - Some providers don't stream certain models

2. **Network Conditions**
   - Slow connections may cause buffering
   - Try with faster internet

3. **Browser Settings**
   - Check if any extensions block streaming
   - Disable ad blockers temporarily

### Incomplete Responses

**Symptoms:**
- Messages cut off mid-response
- "Response truncated" messages

**Solutions:**

1. **Token Limits**
   - Increase max tokens in settings
   - Check provider's token limits
   - Some models have strict limits

2. **Timeout Settings**
   - Responses may timeout on slow networks
   - Try breaking long requests into smaller ones

3. **Provider Issues**
   - Check provider status
   - Try different provider

---

## Performance Issues

### Slow Load Times

**Symptoms:**
- Extension takes >5 seconds to open
- UI feels sluggish

**Solutions:**

1. **Browser Resources**
   - Close unnecessary tabs
   - Restart Chrome to free memory
   - Check system resource usage

2. **Extension Conflicts**
   - Disable other extensions temporarily
   - Test in incognito mode

3. **Cache Issues**
   - Clear browser cache
   - Reload extension in chrome://extensions/

### High Memory Usage

**Symptoms:**
- Chrome using excessive RAM
- System slowdown

**Solutions:**

1. **Conversation Cleanup**
   - Delete old conversations
   - Export and remove large message histories

2. **Browser Restart**
   - Completely close and restart Chrome
   - Memory leaks accumulate over time

3. **Extension Settings**
   - Reduce stored conversation history
   - Disable unused features

### CPU Usage Issues

**Symptoms:**
- High CPU usage even when idle
- Fan running constantly

**Solutions:**

1. **Background Processes**
   - Check if extension has background tasks running
   - Disable real-time features if not needed

2. **Update Extension**
   - Ensure using latest version
   - Performance improvements in updates

3. **System Resources**
   - Close other applications
   - Check for system updates

---

## Web Integration Problems

### YouTube Features Not Working

**Symptoms:**
- No summary option on YouTube videos
- Subtitle extraction fails

**Solutions:**

1. **Page Refresh**
   - Refresh the YouTube page
   - Ensure video is fully loaded

2. **Content Script Check**
   - Verify extension permissions
   - Check if YouTube domain allowed

3. **Video Compatibility**
   - Some live streams not supported
   - Very long videos may be limited
   - Check video availability

4. **Browser Extensions**
   - Disable YouTube-related extensions
   - They may interfere with content scripts

### Search Integration Missing

**Symptoms:**
- No AI answers on search results
- Search engine buttons not appearing

**Solutions:**

1. **Supported Search Engines**
   - Ensure using supported engine (Google, Bing, etc.)
   - Some regional versions may not work

2. **Extension Permissions**
   - Check content script permissions
   - Re-enable extension if disabled

3. **Page Load Timing**
   - Wait for page to fully load
   - Try refreshing search results

### Context Menu Issues

**Symptoms:**
- Right-click menu doesn't appear
- Context menu options missing

**Solutions:**

1. **Permission Check**
   - Go to `chrome://extensions/`
   - Ensure "contextMenus" permission granted

2. **Page Context**
   - Some pages restrict context menus
   - Try on different types of content

3. **Extension Reload**
   - Reload extension in chrome://extensions/
   - Test context menu again

---

## UI & Display Issues

### Side Panel Won't Open

**Symptoms:**
- Clicking extension icon does nothing
- Panel doesn't slide out

**Solutions:**

1. **Icon Check**
   - Ensure VIVIM icon is pinned to toolbar
   - Click puzzle piece to show all extensions

2. **Tab Context**
   - Some pages may restrict side panels
   - Try on a different website

3. **Extension Status**
   - Check chrome://extensions/ for errors
   - Reload extension

4. **Browser Focus**
   - Ensure browser window is active
   - Try clicking in page first

### Display Glitches

**Symptoms:**
- UI elements not rendering correctly
- Text overlapping or missing
- Colors not displaying properly

**Solutions:**

1. **Theme Issues**
   - Try switching themes in settings
   - Check system dark/light mode

2. **Browser Zoom**
   - Reset zoom to 100%
   - Some UI elements don't scale properly

3. **Font Issues**
   - Check if custom fonts are loading
   - Try browser refresh

4. **Extension Update**
   - Ensure latest version installed
   - UI bugs often fixed in updates

### Keyboard Shortcuts Not Working

**Symptoms:**
- Shortcuts don't trigger actions
- Key combinations not recognized

**Solutions:**

1. **Shortcut Conflicts**
   - Check if other extensions use same shortcuts
   - Disable conflicting extensions

2. **Browser Shortcuts**
   - Some shortcuts reserved by browser
   - Check Chrome keyboard shortcuts

3. **Focus Issues**
   - Ensure extension panel has focus
   - Click in input area first

---

## Data & Storage Issues

### Conversations Not Saving

**Symptoms:**
- Messages disappear after browser restart
- Conversation history lost

**Solutions:**

1. **Storage Permissions**
   - Check unlimitedStorage permission
   - Verify storage quota not exceeded

2. **Browser Storage**
   - Clear some browser data to free space
   - Check chrome://settings/storage for usage

3. **Extension Storage**
   - Go to chrome://extensions/
   - Check storage usage for VIVIM

4. **Manual Backup**
   - Export conversations regularly
   - Use external storage for important data

### Export/Import Problems

**Symptoms:**
- Export fails or creates empty file
- Import doesn't work

**Solutions:**

1. **File Format**
   - Ensure correct JSON format for import
   - Check file size limits

2. **Storage Access**
   - Grant file system access if prompted
   - Try different download location

3. **Data Corruption**
   - Validate JSON structure
   - Check for special characters

### Data Migration Issues

**Symptoms:**
- Data doesn't transfer between versions
- Old conversations not accessible

**Solutions:**

1. **Version Compatibility**
   - Ensure migration path supported
   - Check changelog for breaking changes

2. **Manual Migration**
   - Export from old version
   - Import to new version
   - Validate data integrity

---

## Browser Compatibility

### Firefox Issues

**Symptoms:**
- Features not working in Firefox
- Extension behaves differently

**Solutions:**

1. **Compatibility Note**
   - Firefox support is limited in v2.0
   - Full support planned for v2.1

2. **Workarounds**
   - Use Chrome for full functionality
   - Report Firefox-specific issues

3. **Extension Loading**
   - Use "Load Temporary Add-on" in Firefox
   - Check about:debugging for errors

### Mobile Browser Issues

**Symptoms:**
- Extension not available on mobile
- Mobile Chrome limitations

**Solutions:**

1. **Platform Limitation**
   - Extensions don't run on mobile Chrome
   - Desktop-only functionality

2. **Alternatives**
   - Use desktop browser for VIVIM
   - Mobile companion app planned

---

## Advanced Troubleshooting

### Developer Tools Debugging

1. **Open DevTools**
   - Press `F12` or right-click → Inspect

2. **Check Console**
   - Look for JavaScript errors
   - Filter by extension context

3. **Network Tab**
   - Monitor API requests
   - Check for failed requests

4. **Application Tab**
   - Inspect IndexedDB storage
   - Check service worker status

### Extension Logs

1. **Background Page**
   - Go to chrome://extensions/
   - Click "background page" link for VIVIM
   - Check console for errors

2. **Content Scripts**
   - Open DevTools on target page
   - Look for content script errors in console

### System Diagnostics

```bash
# Check system resources
top  # Linux/Mac
taskmgr  # Windows

# Network diagnostics
ping api.openai.com
traceroute api.openai.com

# Browser version
google-chrome --version
```

### Reset Extension

**Last Resort - Complete Reset:**

1. **Export Data**
   - Export all conversations
   - Backup API keys separately

2. **Remove Extension**
   - Go to chrome://extensions/
   - Remove VIVIM completely

3. **Clear Data**
   - Clear browser cache
   - Remove extension storage data

4. **Reinstall**
   - Install fresh copy
   - Reconfigure API keys
   - Import conversations

### Getting Help

If these solutions don't work:

1. **Gather Information**
   - Browser version and OS
   - Extension version
   - Steps to reproduce issue
   - Console errors (screenshots)

2. **Search Existing Issues**
   - Check [GitHub Issues](https://github.com/vivim-org/vivim-extension/issues)
   - Look for similar problems

3. **Create Issue Report**
   - Use the issue template
   - Include all gathered information
   - Be specific about the problem

4. **Community Support**
   - Ask in [GitHub Discussions](https://github.com/vivim-org/vivim-extension/discussions)
   - Join our [Discord community](https://discord.gg/vivim)

---

## Prevention Tips

### Regular Maintenance

- **Keep Updated**: Install updates promptly
- **Monitor Usage**: Check API usage regularly
- **Clean Storage**: Delete old conversations periodically
- **Backup Data**: Export important conversations

### Best Practices

- **API Key Security**: Never share keys, rotate regularly
- **Resource Management**: Close unused tabs, restart browser periodically
- **Network Stability**: Use reliable internet connection
- **Extension Hygiene**: Disable unused extensions

---

*If you continue experiencing issues after trying these solutions, please [submit a detailed bug report](https://github.com/vivim-org/vivim-extension/issues/new?template=bug_report.md) with all relevant information.*</content>
<parameter name="filePath">TROUBLESHOOTING.md