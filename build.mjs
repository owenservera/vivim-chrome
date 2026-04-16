import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync, readFileSync, readdirSync, unlinkSync, rmdirSync, writeFileSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outdir = join(__dirname, 'dist');
const isWatch = process.argv.includes('--watch');

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION - Single source of truth for build outputs
// ═══════════════════════════════════════════════════════════════════════════════

const BUILD_ENTRIES = [
  { src: 'src/background/index.js', out: 'background.js', desc: 'Background Service Worker' },
  { src: 'src/content/index.js', out: 'content/index.js', desc: 'Content Script' },
  { src: 'src/providers/index.js', out: 'providers/index.js', desc: 'Provider Inject' },
  { src: 'src/ui/index.js', out: 'ui/index.js', desc: 'Side Panel UI' }
];

const STATIC_ASSETS = {
  html: ['sidepanel.html'],
  manifest: 'manifest.json',
  icons: 'icons',
  providerIcons: 'icons/providers'
};

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function log(level, message) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
  const prefix = { info: '[INFO]', warn: '[WARN]', error: '[ERROR]', success: '[OK]' }[level] || '[INFO]';
  console.log(`${timestamp} ${prefix} ${message}`);
}

function ensureDir(path) {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
    log('info', `Created directory: ${path}`);
  }
}

function removeDir(path) {
  if (existsSync(path)) {
    try {
      rmdirSync(path, { recursive: true });
      log('info', `Removed directory: ${path}`);
    } catch (e) {
      // Ignore - might be locked
    }
  }
}

function removeFile(path) {
  if (existsSync(path)) {
    try {
      unlinkSync(path);
      log('info', `Removed file: ${path}`);
    } catch (e) {
      // Ignore - might be locked
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEANUP - Remove all old build artifacts
// ═══════════════════════════════════════════════════════════════════════════════

function cleanDist() {
  log('info', 'Starting full dist cleanup...');
  
  // Remove entire dist folder to avoid any stale files
  removeDir(outdir);
  
  // Create fresh dist directory
  ensureDir(outdir);
  
  log('success', 'Dist folder cleaned and ready for fresh build');
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION - Ensure all required source files exist
// ═══════════════════════════════════════════════════════════════════════════════

function validateSources() {
  log('info', 'Validating source files...');
  
  const missing = [];
  
  for (const entry of BUILD_ENTRIES) {
    const srcPath = join(__dirname, entry.src);
    if (!existsSync(srcPath)) {
      missing.push(entry.src);
      log('error', `Missing source: ${entry.src}`);
    }
  }
  
  // Check static assets
  for (const html of STATIC_ASSETS.html) {
    if (!existsSync(join(__dirname, html))) {
      missing.push(html);
      log('error', `Missing source: ${html}`);
    }
  }
  
  if (!existsSync(join(__dirname, STATIC_ASSETS.manifest))) {
    missing.push(STATIC_ASSETS.manifest);
    log('error', `Missing source: ${STATIC_ASSETS.manifest}`);
  }
  
  if (!existsSync(join(__dirname, STATIC_ASSETS.icons))) {
    missing.push(STATIC_ASSETS.icons);
    log('error', `Missing source: ${STATIC_ASSETS.icons}`);
  }
  
  // Check provider icons directory exists
  if (!existsSync(join(__dirname, STATIC_ASSETS.providerIcons))) {
    missing.push(STATIC_ASSETS.providerIcons);
    log('error', `Missing source: ${STATIC_ASSETS.providerIcons}`);
  }
  
  if (missing.length > 0) {
    throw new Error(`Build aborted: ${missing.length} source file(s) missing`);
  }
  
  log('success', 'All source files validated');
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUILD - Compile all entry points
// ═══════════════════════════════════════════════════════════════════════════════

async function buildEntries() {
  log('info', 'Building entry points...');
  
  // Build background service worker first
  const backgroundEntry = BUILD_ENTRIES.find(e => e.out === 'background.js');
  await esbuild.build({
    entryPoints: [join(__dirname, backgroundEntry.src)],
    bundle: true,
    outfile: join(outdir, backgroundEntry.out),
    format: 'iife',
    globalName: 'VIVIMBackground',
    sourcemap: isWatch,
    minify: !isWatch,
    target: 'chrome100',
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': JSON.stringify(isWatch ? 'development' : 'production'),
      'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString())
    },
    banner: {
      js: `/**
 * VIVIM Extension - ${backgroundEntry.desc}
 * Built: ${new Date().toISOString()}
 * Version: ${JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf8')).version}
 */`
    }
  });
  log('success', `Built: ${backgroundEntry.out}`);
  
  // Build remaining entry points
  const remainingEntries = BUILD_ENTRIES.filter(e => e.out !== 'background.js');
  
  await esbuild.build({
    entryPoints: remainingEntries.map(e => join(__dirname, e.src)),
    bundle: true,
    outdir: outdir,
    format: 'iife',
    sourcemap: isWatch,
    minify: !isWatch,
    target: 'chrome100',
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': JSON.stringify(isWatch ? 'development' : 'production'),
      'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString())
    }
  });
  
  for (const entry of remainingEntries) {
    log('success', `Built: ${entry.out}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COPY STATIC ASSETS
// ═══════════════════════════════════════════════════════════════════════════════

function copyStaticAssets() {
  log('info', 'Copying static assets...');
  
  // Copy HTML files
  for (const html of STATIC_ASSETS.html) {
    const src = join(__dirname, html);
    const dst = join(outdir, html);
    if (existsSync(src)) {
      cpSync(src, dst);
      log('success', `Copied: ${html}`);
    }
  }
  
  // Copy manifest
  const manifestSrc = join(__dirname, STATIC_ASSETS.manifest);
  const manifestDst = join(outdir, STATIC_ASSETS.manifest);
  if (existsSync(manifestSrc)) {
    cpSync(manifestSrc, manifestDst);
    log('success', `Copied: ${STATIC_ASSETS.manifest}`);
  }
  
  // Copy icons
  const iconsSrc = join(__dirname, STATIC_ASSETS.icons);
  const iconsDst = join(outdir, STATIC_ASSETS.icons);
  if (existsSync(iconsSrc)) {
    ensureDir(iconsDst);
    cpSync(iconsSrc, iconsDst, { recursive: true });
    log('success', `Copied: ${STATIC_ASSETS.icons}/`);
  }
  
  // Copy provider icons
  const providerIconsSrc = join(__dirname, STATIC_ASSETS.providerIcons);
  const providerIconsDst = join(outdir, STATIC_ASSETS.providerIcons);
  if (existsSync(providerIconsSrc)) {
    ensureDir(providerIconsDst);
    cpSync(providerIconsSrc, providerIconsDst, { recursive: true });
    log('success', `Copied: ${STATIC_ASSETS.providerIcons}/`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATE OUTPUT - Ensure all expected files exist
// ═══════════════════════════════════════════════════════════════════════════════

function validateOutput() {
  log('info', 'Validating build output...');
  
  const missing = [];
  const expectedFiles = [
    ...BUILD_ENTRIES.map(e => e.out),
    ...STATIC_ASSETS.html,
    STATIC_ASSETS.manifest,
    `${STATIC_ASSETS.icons}/icon-16.png`,
    `${STATIC_ASSETS.icons}/icon-32.png`,
    `${STATIC_ASSETS.icons}/icon-48.png`,
    `${STATIC_ASSETS.icons}/icon-128.png`
  ];
  
  for (const file of expectedFiles) {
    const fullPath = join(outdir, file);
    if (!existsSync(fullPath)) {
      missing.push(file);
      log('error', `Missing output: ${file}`);
    }
  }
  
  if (missing.length > 0) {
    throw new Error(`Build validation failed: ${missing.length} output file(s) missing`);
  }
  
  log('success', 'All output files validated');
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATE MANIFEST - Create manifest with correct paths for dist location
// ═══════════════════════════════════════════════════════════════════════════════

function generateManifest() {
  log('info', 'Generating manifest.json with correct paths...');
  
  const manifestSrc = join(__dirname, STATIC_ASSETS.manifest);
  const manifestDst = join(outdir, STATIC_ASSETS.manifest);
  
  const manifest = JSON.parse(readFileSync(manifestSrc, 'utf8'));
  
  // Fix paths for files that live in dist/ (not dist/dist/)
  // Since manifest.json is copied to dist/, relative paths should be just the filename
  manifest.background.service_worker = 'background.js';
  manifest.content_scripts[0].js = ['providers/index.js'];
  manifest.content_scripts[1].js = ['content/index.js'];
  manifest.web_accessible_resources[0].resources = ['**/*.js'];
  
  // Remove the "dist/" prefix since manifest is now in dist/
  writeFileAtomic(manifestDst, JSON.stringify(manifest, null, 2));
  log('success', 'manifest.json generated with correct relative paths');
}

// Write file atomically to avoid partial reads
function writeFileAtomic(path, content) {
  const temp = path + '.tmp';
  writeFileSync(temp, content, 'utf8');
  renameSync(temp, path);
}

// ═══════════════════════════════════════════════════════════════════════
// TEST RUNNER INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

import { spawn } from 'child_process';

function runUnitTests() {
  return new Promise((resolve) => {
    log('info', 'Running unit tests...');
    
    const child = spawn('node', ['test/runner.mjs'], {
      cwd: __dirname,
      stdio: 'inherit'
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        log('success', 'All unit tests passed');
        resolve(true);
      } else {
        log('error', `Unit tests failed with code ${code}`);
        resolve(false);
      }
    });
  });
}

function runE2ETests() {
  return new Promise((resolve) => {
    log('info', 'Running E2E tests (Playwright)...');
    
    const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    const child = spawn(npxCmd, ['playwright', 'test'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        log('success', 'All E2E tests passed');
        resolve(true);
      } else {
        log('error', `E2E tests failed with code ${code}`);
        resolve(false);
      }
    });
    
    child.on('error', (err) => {
      log('error', `E2E tests error: ${err.message}`);
      resolve(false);
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN BUILD PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

async function build() {
  const startTime = Date.now();
  const shouldRunUnitTests = !process.argv.includes('--no-test');
  const shouldRunE2E = process.argv.includes('--e2e');
  
  try {
    // Step 1: Clean dist folder completely
    cleanDist();
    
    // Step 2: Validate all source files exist
    validateSources();
    
    // Step 3: Build all entry points
    await buildEntries();
    
    // Step 4: Copy static assets
    copyStaticAssets();
    
    // Step 5: Generate manifest with correct paths
    generateManifest();
    
    // Step 6: Validate output
    validateOutput();
    
    // Step 7: Run unit tests (unless --no-test flag)
    if (shouldRunUnitTests) {
      const unitPassed = await runUnitTests();
      if (!unitPassed) {
        throw new Error('Unit tests failed - build aborted');
      }
    }
    
    // Step 8: Run E2E tests if --e2e flag
    if (shouldRunE2E) {
      const e2ePassed = await runE2ETests();
      if (!e2ePassed) {
        throw new Error('E2E tests failed - build aborted');
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    log('success', `Build completed successfully in ${duration}s`);
    
  } catch (error) {
    log('error', `Build failed: ${error.message}`);
    process.exit(1);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WATCH MODE
// ═══════════════════════════════════════════════════════════════════════════════

async function watch() {
  log('info', 'Starting watch mode...');
  
  const ctx = await esbuild.context({
    entryPoints: BUILD_ENTRIES.map(e => join(__dirname, e.src)),
    bundle: true,
    outdir: outdir,
    format: 'iife',
    sourcemap: true,
    minify: false,
    target: 'chrome100',
    platform: 'browser'
  });
  
  await ctx.watch();
  log('success', 'Watching for changes...');
  
  // Keep process alive
  process.stdin.resume();
}

// ═══════════════════════════════════════════════════════════════════════════════

if (isWatch) {
  watch();
} else {
  build();
}