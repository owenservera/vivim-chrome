# Panel Wiring - Build System & Development Setup

## Overview
This document details the build system and development environment setup for the Chrome Extension panel wiring system. The build system uses esbuild for fast, efficient bundling with support for Chrome Manifest V3 requirements.

## Build System Architecture

### Core Components
- **Build Tool**: esbuild (v0.20.0) - High-performance JavaScript bundler
- **Configuration**: Custom `build.mjs` script with modular architecture support
- **Output Format**: IIFE (Immediately Invoked Function Expression) for browser compatibility
- **Target**: Chrome 100+ (Manifest V3 compliant)

### Build Structure
```
build.mjs (main build script)
├── Background Service Worker Build
│   ├── Entry: src/background/index.js
│   ├── Format: IIFE
│   └── Output: dist/background.js
├── Content Scripts Build
│   ├── Entry: src/content/index.js
│   ├── Format: IIFE
│   └── Output: dist/content.js
├── Provider Injection Build
│   ├── Entry: src/providers/index.js
│   ├── Format: IIFE
│   └── Output: dist/inject-web.js
├── Side Panel Build
│   ├── Entry: src/ui/index.js
│   ├── Format: IIFE
│   └── Output: dist/sidepanel.js
└── Static Asset Copying
    ├── sidepanel.html
    ├── manifest.json
    └── icons/
```

## Build Configuration Details

### Esbuild Configuration Patterns

#### Background Service Worker (Critical for MV3)
```javascript
const backgroundConfig = {
  entryPoints: ['src/background/index.js'],
  bundle: true,
  outfile: 'dist/background.js',
  format: 'iife',              // Required for service workers
  globalName: 'VIVIMBackground',
  splitting: false,            // Service workers don't support code splitting
  sourcemap: isWatch,
  minify: !isWatch,
  target: 'chrome100',
  platform: 'browser',
  define: {
    'process.env.NODE_ENV': JSON.stringify(isWatch ? 'development' : 'production'),
    'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString())
  }
};
```

#### Content Scripts & UI (IIFE Format)
```javascript
const iifeConfig = {
  entryPoints: [
    'src/content/index.js',
    'src/providers/index.js',
    'src/ui/index.js'
  ],
  bundle: true,
  outdir: 'dist',
  format: 'iife',
  splitting: false,           // Avoid complexity in extension context
  sourcemap: isWatch,
  minify: !isWatch,
  target: 'chrome100',
  platform: 'browser',
  define: { /* environment variables */ }
};
```

### Chrome Manifest V3 Requirements

#### Service Worker Constraints
- **Format**: Must be IIFE (not ESM) for reliable loading
- **Code Splitting**: Disabled - service workers don't support dynamic imports
- **Global Scope**: Uses `globalName` to avoid conflicts
- **Dependencies**: Must include all required modules in single bundle

#### Content Script Considerations
- **Isolation**: Each content script runs in separate execution context
- **Injection**: Must be self-contained for reliable DOM manipulation
- **Performance**: Bundle size impacts page load performance

## Development Workflow

### Local Development Setup

#### Prerequisites
```bash
# Node.js 18+ required
node --version  # Should be 18.0.0 or higher

# Install dependencies
npm install

# Verify esbuild installation
npm list esbuild
```

#### Development Mode
```bash
# Start watch mode for development
npm run dev

# This enables:
# - Automatic rebuild on file changes
# - Source maps for debugging
# - Development environment variables
# - No minification for readable code
```

#### Production Build
```bash
# Create optimized production build
npm run build

# This produces:
# - Minified bundles for performance
# - Production environment variables
# - Optimized static assets
# - Ready for deployment
```

### Build Artifacts Structure
```
dist/
├── background.js          # Service worker (IIFE, minified)
├── content.js             # Content script injection (IIFE, minified)
├── inject-web.js          # Provider system injection (IIFE, minified)
├── sidepanel.js           # Side panel UI (IIFE, minified)
├── sidepanel.html         # Side panel interface (copied)
├── manifest.json          # Extension manifest (copied)
└── icons/                 # Extension icons (copied)
    ├── icon-16.png
    ├── icon-32.png
    ├── icon-48.png
    └── icon-128.png
```

## Development Environment Features

### Watch Mode Capabilities
```javascript
// Automatic rebuild triggers
if (isWatch) {
  const ctx = await esbuild.context(buildConfig);
  await ctx.watch();
  console.log('[build] Watching for changes...');

  // Rebuilds on:
  // - Source file modifications
  // - New file additions
  // - Dependency changes
  // - Configuration updates
}
```

### Environment Variables
```javascript
// Development vs Production
define: {
  'process.env.NODE_ENV': JSON.stringify(isWatch ? 'development' : 'production'),
  'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString())
}

// Usage in code:
if (process.env.NODE_ENV === 'development') {
  console.log('Debug mode enabled');
}
```

### Source Maps & Debugging
```javascript
// Development builds include source maps
sourcemap: isWatch  // true for dev, false for prod

// Enables:
- Breakpoint debugging in Chrome DevTools
- Original source code viewing
- Stack trace mapping to source files
```

## Build Optimization Strategies

### Bundle Splitting Strategy
```javascript
// Current approach: Single bundles per entry point
// Benefits:
- Predictable loading behavior
- Simplified debugging
- Reliable service worker execution
// Trade-offs:
- Larger initial bundle sizes
- Potential code duplication
```

### Minification & Compression
```javascript
// Production optimizations
minify: !isWatch  // Enable minification for production

// Includes:
- Dead code elimination
- Variable name mangling
- Whitespace removal
- Comment stripping
```

### Static Asset Handling
```javascript
function copyStaticAssets() {
  // HTML files
  cpSync('sidepanel.html', 'dist/sidepanel.html');

  // Manifest (critical for extension loading)
  cpSync('manifest.json', 'dist/manifest.json');

  // Icons (required for Chrome Web Store)
  cpSync('icons/', 'dist/icons/', { recursive: true });

  // Cleanup legacy files
  cleanupLegacyFiles();
}
```

## Testing Integration

### Test Framework Setup
```javascript
// test.mjs (planned - currently missing)
import { buildTestConfig } from './build.mjs';

export async function runTests() {
  // Test configuration
  const testConfig = {
    entryPoints: ['src/**/*.test.js'],
    bundle: true,
    outdir: 'test-dist',
    format: 'iife',
    platform: 'browser',
    // Test-specific settings
  };

  await esbuild.build(testConfig);
  // Run tests in headless browser
}
```

### Test Build Process
```bash
# Run test suite (when implemented)
npm run test

# Test build artifacts
npm run build:test

# Coverage reports
npm run test:coverage
```

## Extension Loading & Debugging

### Loading Built Extension
```bash
# Method 1: Chrome Developer Mode
1. Open Chrome → chrome://extensions/
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the "dist" folder
5. Extension appears in toolbar

# Method 2: Command Line (advanced)
chrome --load-extension=/path/to/dist
```

### Debug Tools & Techniques
```javascript
// Service Worker Debugging
1. chrome://extensions/ → Extension Details
2. "background page" → Opens DevTools
3. Console shows service worker logs
4. Sources tab for debugging

// Content Script Debugging
1. Open target website (chatgpt.com, etc.)
2. DevTools → Console
3. Look for "[content]" prefixed messages
4. Sources → Content scripts section

// Side Panel Debugging
1. Click extension icon → Open side panel
2. DevTools → Separate panel window
3. Console shows UI-related logs
4. Elements tab for DOM inspection
```

### Common Build Issues & Solutions

#### Service Worker Registration Failed
```javascript
// Check manifest.json
{
  "background": {
    "service_worker": "background.js"
  }
}

// Verify build output
ls -la dist/background.js  # Should exist and be > 0 bytes
```

#### Content Script Injection Failed
```javascript
// Check manifest content_scripts
{
  "content_scripts": [{
    "matches": ["https://chatgpt.com/*"],
    "js": ["content.js"]
  }]
}

// Verify injection timing
// Use "document_idle" for reliable DOM access
```

#### Side Panel Not Loading
```javascript
// Check manifest side_panel
{
  "side_panel": {
    "default_path": "sidepanel.html"
  }
}

// Verify HTML references
// Ensure script src points to built file
<script src="sidepanel.js"></script>
```

## Performance Monitoring

### Build Performance Metrics
```javascript
// Track build times
const startTime = Date.now();
// ... build process ...
const buildTime = Date.now() - startTime;
console.log(`Build completed in ${buildTime}ms`);

// Bundle size monitoring
const stats = await esbuild.analyzeMetafile(metafile);
console.log('Bundle sizes:', stats);
```

### Bundle Analysis
```bash
# Analyze bundle composition
npx esbuild --metafile --analyze dist/background.js

# Output shows:
# - File sizes and percentages
# - Dependency tree
# - Dead code identification
# - Optimization opportunities
```

## CI/CD Integration

### GitHub Actions Example
```yaml
# .github/workflows/build.yml
name: Build Extension
on: [push, pull_request]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v3
        with:
          name: extension-build
          path: dist/
```

### Automated Testing
```yaml
# Test job
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v3
    - run: npm ci
    - run: npm run test
    - run: npm run build  # Ensure build works
```

## Troubleshooting Guide

### Build Failures
```bash
# Common issues:

# 1. Missing dependencies
npm install

# 2. Node version mismatch
node --version  # Should be 18+

# 3. File permission issues
chmod +x build.mjs

# 4. Import resolution errors
# Check file paths in entryPoints
# Verify all imports are valid
```

### Watch Mode Issues
```bash
# Watch not detecting changes
# Check file is inside watched directory
# Restart watch mode
npm run dev

# Build errors in watch mode
# Fix syntax errors first
# Watch will resume after fixes
```

### Extension Loading Issues
```bash
# Extension not appearing
# Check manifest.json syntax
# Verify all required files exist in dist/
# Reload extension in chrome://extensions/

# Service worker errors
# Check console in background page
# Verify all imports resolve correctly
```

## Future Enhancements

### Planned Build Improvements
- **Code Splitting**: Implement for non-service-worker contexts
- **Tree Shaking**: Advanced dead code elimination
- **CSS Processing**: Add PostCSS or Tailwind support
- **Type Checking**: Integrate TypeScript compilation
- **Bundle Analysis**: Add automated size monitoring

### Development Experience
- **Hot Module Replacement**: Faster development iteration
- **Error Overlay**: Better error reporting in development
- **Dev Server**: Local development server for testing
- **Extension Reloader**: Automatic extension reloading on changes

---

*This build system documentation provides the foundation for efficient development, reliable production builds, and effective debugging of the Chrome Extension panel wiring system.*</content>
<parameter name="filePath">C:\0-BlackBoxProject-0\vivim-app-og\vivim-app\extensions\chrome\poc\docs\Panel-Wiring-Build-System-And-Development.md