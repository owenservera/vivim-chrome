/**
 * VIVIM Test Runner
 * Runs all tests and reports results
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const testDir = __dirname;

let passed = 0;
let failed = 0;
const failures = [];

// Simple test framework
const test = (name, fn) => {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    failed++;
    failures.push({ name, error: error.message });
    console.log(`  ✗ ${name}`);
    console.log(`    ${error.message}`);
  }
};

const assert = {
  equal: (actual, expected, msg = '') => {
    if (actual !== expected) {
      throw new Error(`${msg}\n    Expected: ${expected}\n    Actual: ${actual}`);
    }
  },
  notEqual: (actual, expected, msg = '') => {
    if (actual === expected) {
      throw new Error(`${msg}\n    Expected: not ${expected}`);
    }
  },
  deepEqual: (actual, expected, msg = '') => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${msg}\n    Expected: ${JSON.stringify(expected)}\n    Actual: ${JSON.stringify(actual)}`);
    }
  },
  throws: (fn, expected, msg = '') => {
    try {
      fn();
      throw new Error(`${msg}\n    Expected function to throw`);
    } catch (error) {
      if (expected && !(error.message.includes(expected) || error.message === expected)) {
        throw new Error(`${msg}\n    Expected error containing: ${expected}\n    Got: ${error.message}`);
      }
    }
  },
  ok: (value, msg = '') => {
    if (!value) {
      throw new Error(`${msg}\n    Expected truthy value`);
    }
  },
};

// Make globals available
global.test = test;
global.assert = assert;

// Convert Windows path to file URL
function toFileURL(filepath) {
  return 'file:///' + filepath.replace(/\\/g, '/');
}

// Load test files
async function loadTests(dir) {
  const files = readdirSync(dir);
  
  for (const file of files) {
    if (file.endsWith('.test.js')) {
      const fullPath = join(dir, file);
      const moduleName = file.replace('.test.js', '');
      console.log(`\n▶ ${moduleName}`);
      
      try {
        const moduleURL = toFileURL(fullPath);
        const mod = await import(moduleURL);
        if (mod.runTests) {
          mod.runTests(test, assert);
        }
      } catch (error) {
        console.log(`  ⚠ Error loading ${file}: ${error.message}`);
        failed++;
      }
    }
  }
}

// Main
(async () => {
  console.log('═'.repeat(50));
  console.log('  VIVIM Test Suite');
  console.log('═'.repeat(50));
  
  if (!existsSync(testDir)) {
    console.log('\n⚠ No test directory found');
    process.exit(0);
  }
  
  try {
    await loadTests(testDir);
  } catch (error) {
    console.error('\n⚠ Test loading error:', error.message);
    failed++;
  }
  
  console.log('\n' + '═'.repeat(50));
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('═'.repeat(50));
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    for (const f of failures) {
      console.log(`  - ${f.name}: ${f.error}`);
    }
    process.exit(1);
  }
  
  process.exit(0);
})();