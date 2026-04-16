#!/usr/bin/env node
/**
 * VIVIM Dev Loop
 * 
 * Usage:
 *   node dev.mjs              # Watch mode + auto-retest (default)
 *   node dev.mjs --test      # Single test run
 *   node dev.mjs --build    # Single build only
 *   node dev.mjs --debug    # Watch + debug output
 *   node dev.mjs --watch    # Watch files, no tests
 */

import { spawn } from 'child_process';
import { watch } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

const isWatch = args.includes('--watch');
const isDebug = args.includes('--debug');
const isTestOnly = args.includes('--test') && !args.includes('--build');
const isBuildOnly = args.includes('--build') && !args.includes('--test');
const isVerbose = isDebug;

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;
const gray = (s) => `\x1b[90m${s}\x1b[0m`;

let buildProcess = null;
let testProcess = null;
let watchProcess = null;
let runCount = 0;
let lastResult = null;
let failCount = 0;

function log(level, msg) {
  const time = new Date().toISOString().split('T')[1].slice(0, 12);
  const prefix = { ok: '[OK]', fail: '[FAIL]', warn: '[WARN]', info: '[INFO]', debug: '[DEBUG]' }[level] || '[INFO]';
  const color = { ok: green, fail: red, warn: yellow, info: cyan, debug: gray }[level] || cyan;
  console.log(`${time} ${color(prefix)} ${msg}`);
}

function clearScreen() {
  console.clear();
}

function printHeader() {
  console.log(cyan('═'.repeat(60)));
  console.log(cyan('  VIVIM Dev Loop') + ` - Run #${runCount + 1}`);
  console.log(cyan('═'.repeat(60)));
}

function runBuild() {
  return new Promise((resolve) => {
    log('info', 'Building...');
    
    buildProcess = spawn('node', ['build.mjs', '--no-test'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    if (!isDebug) {
      buildProcess.stdout.on('data', (d) => output += d);
      buildProcess.stderr.on('data', (d) => output += d);
    }
    
    buildProcess.on('close', (code) => {
      if (code === 0) {
        log('ok', 'Build completed');
        resolve(true);
      } else {
        log('fail', `Build failed with code ${code}`);
        if (isVerbose && output) {
          console.log(gray(output));
        }
        resolve(false);
      }
    });
    
    buildProcess.on('error', (err) => {
      log('fail', `Build error: ${err.message}`);
      resolve(false);
    });
  });
}

function runTests() {
  return new Promise((resolve) => {
    log('info', 'Running unit tests...');
    
    testProcess = spawn('node', ['test/runner.mjs'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let output = '';
    testProcess.stdout.on('data', (d) => {
      const text = d.toString();
      output += text;
      if (!isDebug) process.stdout.write(text);
    });
    testProcess.stderr.on('data', (d) => {
      const text = d.toString();
      output += text;
      if (!isDebug) process.stderr.write(text);
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        log('ok', 'All tests passed');
        resolve(true);
      } else {
        log('fail', `Tests failed with code ${code}`);
        
        const failedMatch = output.match(/Results: (\d+) passed, (\d+) failed/);
        if (failedMatch) {
          const failedCount = parseInt(failedMatch[2]);
          const failedTests = output.match(/Failed tests:\n([\s\S]+)/);
          
          if (failedTests) {
            console.log(red('\nFailed tests:'));
            console.log(red(failedTests[1]));
          }
        }
        
        resolve(false);
      }
    });
    
    testProcess.on('error', (err) => {
      log('fail', `Test error: ${err.message}`);
      resolve(false);
    });
  });
}

async function runLoop() {
  runCount++;
  printHeader();
  
  const startTime = Date.now();
  
  const buildOk = await runBuild();
  
  if (!buildOk) {
    failCount++;
    printResult(false, Date.now() - startTime);
    if (isWatch) {
      console.log(yellow('\n  Waiting for fixes...'));
      return;
    }
    process.exit(1);
  }
  
  const testsOk = await runTests();
  
  if (!testsOk) {
    failCount++;
    printResult(false, Date.now() - startTime);
    if (isWatch) {
      console.log(yellow('\n  Waiting for fixes...'));
      return;
    }
    process.exit(1);
  }
  
  printResult(true, Date.now() - startTime);
  
  if (!isWatch) {
    process.exit(0);
  }
}

function printResult(ok, duration) {
  const ms = duration.toFixed(0);
  const status = ok ? green('PASS') : red('FAIL');
  
  console.log('\n' + cyan('═'.repeat(60)));
  console.log(`  ${status} | ${runCount} runs | ${failCount} failures | ${ms}ms`);
  console.log(cyan('═'.repeat(60)));
  
  lastResult = { ok, duration, time: Date.now() };
}

function startWatcher() {
  log('info', 'Starting file watcher...');
  
  let debounce = null;
  const srcDir = join(__dirname, 'src');
  
  watch(srcDir, { recursive: true }, (eventType, filename) => {
    if (filename && filename.endsWith('.js')) {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        console.log(yellow(`\n  File changed: ${filename}`));
        runLoop();
      }, 300);
    }
  });
  
  log('ok', `Watching ${srcDir}/`);
}

async function main() {
  if (isBuildOnly) {
    const ok = await runBuild();
    process.exit(ok ? 0 : 1);
  }
  
  if (isTestOnly) {
    const ok = await runTests();
    process.exit(ok ? 0 : 1);
  }
  
  if (isWatch) {
    startWatcher();
  }
  
  await runLoop();
  
  if (isWatch) {
    console.log(yellow('\n  Watching for changes...'));
    console.log(yellow('  Press Ctrl+C to exit\n'));
    
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      const key = data.toString();
      
      if (key === 'r') {
        console.log(cyan('\n  Force re-run...'));
        runLoop();
      } else if (key === 'c') {
        console.log(cyan('\n  Clearing...'));
        clearScreen();
      } else if (key === 'q') {
        console.log(cyan('\n  Goodbye!'));
        process.exit(0);
      } else if (key === 'h') {
        console.log(cyan('\n  Commands:'));
        console.log(cyan('    r - re-run tests'));
        console.log(cyan('    c - clear screen'));
        console.log(cyan('    h - help'));
        console.log(cyan('    q - quit\n'));
      }
    });
  }
}

main();