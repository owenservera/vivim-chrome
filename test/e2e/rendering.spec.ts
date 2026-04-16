import { test, expect } from '@playwright/test';
import { launchExtension } from './fixtures/extension';

test('sidepanel renders', async () => {
  const { page, extensionId } = await launchExtension();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  
  await expect(page.locator('.sidepanel')).toBeVisible();
});

test('header shows VIVIM brand', async () => {
  const { page, extensionId } = await launchExtension();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  
  await expect(page.locator('.sidepanel__header__brand')).toContainText('VIVIM');
});

test('input textarea visible', async () => {
  const { page, extensionId } = await launchExtension();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);
  
  await expect(page.locator('#promptInput')).toBeVisible();
});