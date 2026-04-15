import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs';
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
  // Note: background and content must be ESM for Chrome, but sidepanel can be IIFE
  buildConfig = {
    entryPoints: {
      background: 'src/background/index.js',
      content: 'src/content/index.js',
      'inject-web': 'src/providers/index.js',
      sidepanel: 'src/ui/index.js'
    },
    bundle: true,
    outdir,
    format: 'iife',  // Use IIFE for compatibility with side panel
    splitting: false,  // Disable splitting for IIFE
    sourcemap: isWatch,
    minify: !isWatch,
    target: 'chrome100',
    absWorkingDir: __dirname,
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
    const result = await esbuild.build(buildConfig);

    // Copy static assets
    copyStaticAssets();

    console.log('[build] Modular build completed successfully!');

    if (result.metafile) {
      // Log build stats for modular build
      const outputs = result.metafile.outputs;
      Object.entries(outputs).forEach(([file, info]) => {
        const size = (info.bytes / 1024).toFixed(2);
        console.log(`${file}: ${size} KB`);
      });
    }

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

  // Copy built JS files back to root for Chrome extension loading
  const jsFiles = ['inject-web.js', 'content.js', 'background.js', 'sidepanel.js'];
  for (const jsFile of jsFiles) {
    const src = join(outdir, jsFile);
    const dst = join(__dirname, jsFile);
    if (existsSync(src)) {
      cpSync(src, dst);
      console.log(`[build] Copied ${jsFile} to root`);
    }
  }

  // Copy chunk files to root (needed for ES module imports)
  const chunkFiles = readdirSync(outdir).filter(f => f.startsWith('chunk-') && f.endsWith('.js'));
  for (const chunkFile of chunkFiles) {
    const src = join(outdir, chunkFile);
    const dst = join(__dirname, chunkFile);
    cpSync(src, dst);
    console.log(`[build] Copied ${chunkFile} to root`);
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