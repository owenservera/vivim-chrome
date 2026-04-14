import * as esbuild from "esbuild";
import { cpSync, mkdirSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outdir = join(__dirname, "dist");

const isWatch = process.argv.includes("--watch");

const entries = [
  { in: "inject-web.js", out: "inject-web" },
  { in: "content.js", out: "content" },
  { in: "background.js", out: "background" },
];

const htmlFiles = ["sidepanel.html"];

async function build() {
  if (!existsSync(outdir)) {
    mkdirSync(outdir, { recursive: true });
  }

  for (const entry of entries) {
    await esbuild.build({
      entryPoints: [join(__dirname, entry.in)],
      bundle: true,
      minify: !isWatch,
      sourcemap: isWatch,
      outfile: join(outdir, entry.out + ".js"),
      format: "iife",
      globalName: entry.out.replace(/-./g, c => c[1].toUpperCase()),
    });
  }

  for (const html of htmlFiles) {
    const src = join(__dirname, html);
    const dst = join(outdir, html);
    if (existsSync(src)) {
      cpSync(src, dst);
    }
  }

  const manifestSrc = join(__dirname, "manifest.json");
  const manifestDst = join(outdir, "manifest.json");
  if (existsSync(manifestSrc)) {
    cpSync(manifestSrc, manifestDst);
  }

  const iconsDir = join(__dirname, "icons");
  const iconsOut = join(outdir, "icons");
  if (existsSync(iconsDir)) {
    if (!existsSync(iconsOut)) {
      mkdirSync(iconsOut, { recursive: true });
    }
    cpSync(iconsDir, iconsOut, { recursive: true });
  }

  console.log("[build] Done -> dist/");
}

if (isWatch) {
  const ctx = await esbuild.context({
    entryPoints: entries.map(e => join(__dirname, e.in)),
    bundle: true,
    outdir,
    format: "iife",
    globalName: "VIVIM",
    sourcemap: true,
  });
  await ctx.watch();
  console.log("[build] Watching...");
} else {
  build();
}