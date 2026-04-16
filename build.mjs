import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync, readFileSync, readdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outdir = join(__dirname, 'dist');
const isWatch = process.argv.includes('--watch');

// Check if using new modular structure
const hasModularStructure = existsSync('src');

// Build configuration based on structure
let buildConfig;

if (hasModularStructure) {
  // New modular build configuration
  // Chrome MV3 requires:
  // - background service worker: MUST be ESM with format: 'esm'
  // - content scripts: can be IIFE
  // - side panel: can be IIFE
  buildConfig = {
    entryPoints: {
      background: 'src/background/index.js',
      content: 'src/content/index.js',
      'inject-web': 'src/providers/index.js',
      sidepanel: 'src/ui/index.js'
    },
    bundle: true,
    outdir,
    format: 'iife',
    splitting: false,
    sourcemap: isWatch,
    minify: !isWatch,
    target: 'chrome100',
    absWorkingDir: __dirname,
    platform: 'browser',
    define: {
      'process.env.NODE_ENV': JSON.stringify(isWatch ? 'development' : 'production'),
      'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString())
    },
    banner: {
      js: `/**
 * VIVIM Extension - Modular Build
 * Built: ${new Date().toISOString()}
 * Version: ${JSON.parse(readFileSync('package.json', 'utf8')).version}
 */`
    }
  };
} else {
  // Legacy build configuration (fallback)
  console.warn('[build] Using legacy build configuration. Consider migrating to modular structure.');

  const entries = [
    { in: 'inject-web.js', out: 'inject-web' },
    { in: 'content.js', out: 'content' },
    { in: 'background.js', out: 'background' },
    { in: 'sidepanel.js', out: 'sidepanel' },
  ];

  buildConfig = {
    entryPoints: entries.map(e => join(__dirname, e.in)),
    bundle: true,
    outdir,
    format: 'iife',
    sourcemap: isWatch,
    minify: !isWatch,
    globalName: 'VIVIM'
  };
}

async function build() {
  if (!existsSync(outdir)) {
    mkdirSync(outdir, { recursive: true });
  }

  try {
    // First build: background service worker
    // Chrome MV3 service workers work with either ESM or IIFE when using type: "module"
    const backgroundConfig = {
      entryPoints: [join(__dirname, 'src/background/index.js')],
      bundle: true,
      outfile: join(__dirname, 'dist/background.js'),
      format: 'iife',
      globalName: 'VIVIMBackground',
      splitting: false,
      sourcemap: isWatch,
      minify: !isWatch,
      target: 'chrome100',
      platform: 'browser',
      define: {
        'process.env.NODE_ENV': JSON.stringify(isWatch ? 'development' : 'production'),
        'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString())
      }
    };
    
    await esbuild.build(backgroundConfig);
    console.log('[build] Background service worker built');

    // Second build: content scripts and side panel (IIFE)
    const iifeConfig = {
      entryPoints: [
        join(__dirname, 'src/content/index.js'),
        join(__dirname, 'src/providers/index.js'),
        join(__dirname, 'src/ui/index.js')
      ],
      bundle: true,
      outdir: join(__dirname, 'dist'),
      format: 'iife',
      splitting: false,
      sourcemap: isWatch,
      minify: !isWatch,
      target: 'chrome100',
      platform: 'browser',
      define: {
        'process.env.NODE_ENV': JSON.stringify(isWatch ? 'development' : 'production'),
        'process.env.BUILD_TIME': JSON.stringify(new Date().toISOString())
      }
    };
    
    await esbuild.build(iifeConfig);
    console.log('[build] Content scripts and side panel built (IIFE)');

    // Copy static assets
    copyStaticAssets();

    console.log('[build] Modular build completed successfully!');

  } catch (error) {
    console.error('[build] Build failed:', error);
    process.exit(1);
  }
}

function copyStaticAssets() {
  // Copy HTML files
  const htmlFiles = ['sidepanel.html'];
  for (const html of htmlFiles) {
    const src = join(__dirname, html);
    const dst = join(outdir, html);
    if (existsSync(src)) {
      cpSync(src, dst);
    }
  }

  // Copy manifest
  const manifestSrc = join(__dirname, 'manifest.json');
  const manifestDst = join(outdir, 'manifest.json');
  if (existsSync(manifestSrc)) {
    cpSync(manifestSrc, manifestDst);
  }

  // Copy icons
  const iconsDir = join(__dirname, 'icons');
  const iconsOut = join(outdir, 'icons');
  if (existsSync(iconsDir)) {
    if (!existsSync(iconsOut)) {
      mkdirSync(iconsOut, { recursive: true });
    }
    cpSync(iconsDir, iconsOut, { recursive: true });
  }

  // Clean up old bundled files (index.js from old builds)
  const oldFiles = ['index.js'];
  for (const f of oldFiles) {
    const oldPath = join(outdir, f);
    if (existsSync(oldPath)) {
      try {
        unlinkSync(oldPath);
        console.log('[build] Cleaned up old file:', f);
      } catch (e) {
        // Ignore
      }
    }
  }

  console.log('[build] Static assets copied');
}

if (isWatch) {
  console.log('[build] Starting watch mode...');

  if (hasModularStructure) {
    const ctx = await esbuild.context(buildConfig);
    await ctx.watch();
    console.log('[build] Watching modular structure...');
  } else {
    // Legacy watch mode
    const ctx = await esbuild.context(buildConfig);
    await ctx.watch();
    console.log('[build] Watching legacy structure...');
  }
} else {
  await build();
}