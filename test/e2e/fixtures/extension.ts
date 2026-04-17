import { test as base, chromium, expect as pwExpect, type BrowserContext, type Page } from '@playwright/test';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const extensionPath = join(__dirname, '../../dist');

export async function launchExtension() {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
    ],
  });

  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }

  const extensionId = await serviceWorker.evaluate(() => chrome.runtime.id);

  const page = await context.newPage();
  const testUrl = `chrome-extension://${extensionId}/test-page.html`;

  // Try to navigate to the test page
  try {
    const response = await page.goto(testUrl, { timeout: 5000 });
    if (response) {
      console.log('Navigation successful, status:', response.status());
    } else {
      console.log('Navigation returned null response');
    }
  } catch (error) {
    console.log('Navigation failed:', error.message);
  }

  return { context, page, extensionId };
}

export const test = base;
export { pwExpect as expect };
export type { BrowserContext, Page };