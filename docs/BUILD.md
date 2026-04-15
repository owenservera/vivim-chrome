# VIVIM POC — Build & Development Guide

> How to build, test, and develop the VIVIM Chrome extension

## Prerequisites

- Node.js 18+
- npm 9+
- Chrome/Chromium browser (for testing)

## Quick Start

```bash
# Install dependencies
npm install

# Build extension
npm run build

# Load in Chrome
# Open chrome://extensions → Enable Developer Mode → Load unpacked → Select dist/
```

## Project Structure

```
poc/
├── inject-web.js      # Main interceptor (source)
├── content.js        # Message bridge (source)
├── background.js     # Service worker (source)
├── sidepanel.html   # Side panel UI
├── sidepanel.js      # Side panel logic
├── manifest.json    # Extension manifest
├── package.json     # npm config
├── build.mjs       # esbuild script
│
└── dist/            # Built output (load this in Chrome)
    ├── inject-web.js
    ├── content.js
    ├── background.js
    ├── sidepanel.html
    └── manifest.json
```

## npm Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Build to `dist/` |
| `npm run dev` | Watch mode (auto-rebuild) |
| `npm run clean` | Remove `dist/` |

## Building

### Production Build

```bash
npm run build
```

Output:
```
[build] Done -> dist/
```

### Development Build (Watch Mode)

```bash
npm run dev
```

Output:
```
[build] Watching...
```

Press `Ctrl+C` to stop.

### Clean Build

```bash
npm run clean
```

## Loading in Chrome

### Method 1: Load Unpacked

1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `poc/dist/` folder
5. Refresh the target AI provider page

### Method 2: Pack Extension

1. Open `chrome://extensions`
2. Click **Pack extension**
3. Select `poc/dist/` as the extension folder
4. Click **Pack** to generate `.crx` and `.pem` files

### Method 3: Developer Channel

For testing beta versions:
```bash
# Install Chrome Developer Channel
# Then use chrome://extensions
```

## Testing

### Manual Testing

1. **Build** - `npm run build`
2. **Load** - Open `chrome://extensions` → Load unpacked → Select `dist/`
3. **Navigate** - Go to `https://chatgpt.com`
4. **Chat** - Type a message and send
5. **Observe** - Check side panel for mirrored messages
6. **Debug** - Use Chrome DevTools

### Debugging

#### Background Script

```
chrome://extensions → Find VIVIM POC → Service Worker → link
```

Console output:
```
[VIVIM BG] 📦 STREAM_CHUNK received: {...}
[VIVIM BG] 📢 Broadcasting: STREAM_UPDATE ...
```

#### Content Script

```
Inspect page context → Console
```

Console output:
```
[VIVIM content] 📦 Forwarding chatChunk to background
[VIVIM content] ✅ STREAM_CHUNK delivered
```

#### inject-web.js (MAIN world)

```
Page Console → Type $0 or look for inject scripts
```

Console output:
```
[VIVIM inject] 🎯 matchResponse STREAMING: https://chatgpt.com/backend-api/f/conversation
[VIVIM inject] 📦 Delta #1: { op: "add", path: "/message/content/parts/0", ... }
```

### Test Scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| ChatGPT streaming | Send message on chatgpt.com | See chunks in sidepanel |
| Auth capture | Login to ChatGPT | Auth headers captured |
| Multiple destinations | Register webhook | Chunks sent to webhook |
| Conversation storage | Send multiple messages | Messages persisted |
| Clear conversation | Click Clear in sidepanel | Storage cleared |

## Development Workflow

### 1. Edit Source Files

```bash
# Edit in your IDE
code inject-web.js
```

### 2. Build

```bash
npm run build
```

### 3. Reload in Chrome

```
chrome://extensions → Click reload icon on VIVIM POC
```

### 4. Test

Refresh target page and test your changes.

### 5. Debug (if needed)

```
chrome://extensions → Service Worker → Console
```

## Watch Mode

```bash
npm run dev
```

Changes auto-rebuild to `dist/`:
- Edit `inject-web.js` → Automatically rebuilds
- Reload in Chrome to see changes

## Build Configuration

Edit `build.mjs`:

```javascript
const entries = [
  { in: "inject-web.js", out: "inject-web" },
  { in: "content.js", out: "content" },
  { in: "background.js", out: "background" },
];
```

### Adding Entry Points

```javascript
const entries = [
  { in: "inject-web.js", out: "inject-web" },
  { in: "content.js", out: "content" },
  { in: "background.js", out: "background" },
  { in: "popup.js", out: "popup" },     // Add popup
  { in: "options.js", out: "options" }, // Add options
];
```

### Custom Output Directory

```javascript
const outdir = join(__dirname, "my-custom-dist");
```

## Environment Variables

Add to `package.json`:

```json
{
  "scripts": {
    "build:stage": "STAGE=stage node build.mjs",
    "build:prod": "STAGE=prod node build.mjs"
  }
}
```

Then use in `build.mjs`:

```javascript
const stage = process.env.STAGE || "dev";
const outdir = join(__dirname, stage === "prod" ? "dist" : "dist-dev");
```

## Troubleshooting

### Build Errors

| Error | Cause | Fix |
|------|-------|-----|
| `Symbol already declared` | Duplicate function in source | Check for duplicate function definitions |
| `Cannot find module` | Missing dependency | Run `npm install` |
| `Build failed` | esbuild error | Check esbuild version: `npx esbuild --version` |

### Extension Not Loading

| Issue | Fix |
|-------|-----|
| Missing `manifest.json` | Run `npm run build` |
| Invalid manifest | Check Chrome DevTools → Extensions → Errors |
| Icon missing | Ensure `icons/` folder is copied to `dist/` |

### Interceptor Not Working

| Check | How |
|-------|-----|
| Script loaded | Page → DevTools → Sources → find inject-web.js |
| Interceptor started | Console → `[VIVIM inject]` logs |
| Plugin registered | Console → `[VIVIM inject] 🎯 matchResponse` |

### Sidepanel Not Showing

| Check | How |
|-------|-----|
| Side panel registered | Console → `[VIVIM POC] Background service worker initialized` |
| Message passing | Console → `[VIVIM BG] 📢 Broadcasting` |
| Tab detection | Console → `[VIVIM BG] TAB_DETECTED` |

### Messages Not Appearing

| Check | How |
|-------|-----|
| Bridge ready | Console should show "[VIVIM content] 🤝 Handshake received" |
| Chunk received | Console → `[VIVIM BG] 📦 STREAM_CHUNK received` |
| Broadcast | Console → `[VIVIM BG] 📢 Broadcasting` |

## Chrome Flags

For testing specific features:

```
# Enable new extension APIs
chrome://flags/#extension-active-script-permission

# Disable cache for development
chrome://flags/#disable-backgroundThreadNetwork

# Enable WebSocket debugging
chrome://flags/#enable-webrtc-outbound-stats
```

## Performance Profiling

```javascript
// Add to onRequest
const start = performance.now();

// Add to onResponse
const elapsed = performance.now() - start;
console.log("Request time:", elapsed, "ms");
```

## Release Checklist

- [ ] Run production build: `npm run build`
- [ ] Test all providers: ChatGPT, Claude, Gemini, etc.
- [ ] Test all destinations: sidepanel, webhook, websocket
- [ ] Verify storage works: messages persist after reload
- [ ] Check Chrome Web Store compliance
- [ ] Update version in `package.json`
- [ ] Tag release: `git tag v0.0.1`
- [ ] Package: `chrome://extensions` → Pack extension

## File Sizes

| File | Size (minified) |
|------|----------------|
| `inject-web.js` | ~25 KB |
| `content.js` | ~3 KB |
| `background.js` | ~6 KB |
| `sidepanel.html` | ~8 KB |
| **Total** | ~42 KB |

## Compression

| File | gzip | Notes |
|------|------|-------|
| `inject-web.js` | ~8 KB | 68% reduction |
| `content.js` | ~1 KB | 67% reduction |
| `background.js` | ~2 KB | 67% reduction |

## Additional Resources

- [Chrome Extension Docs](https://developer.chrome.com/docs/extensions/)
- [esbuild Documentation](https://esbuild.github.io/)
- [Manifest V3 Migration](https://developer.chrome.com/docs/extensions/mv3/intro/)