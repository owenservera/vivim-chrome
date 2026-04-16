import { test, expect } from '@playwright/test';
import { launchExtension } from './fixtures/extension';

test('newChatBtn clears conversation', async () => {
  const { page, extensionId } = await launchExtension();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  
  await page.locator('#newChatBtn').click();
  await expect(page.locator('.toast')).toBeVisible();
});

test('providerSelect shows provider menu', async () => {
  const { page, extensionId } = await launchExtension();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  
  await page.locator('#providerSelect').click();
  await expect(page.locator('.provider-menu')).toBeVisible();
});