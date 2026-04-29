import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Bot Management', () => {
  test('should allow navigating to bot creation', async ({ page }) => {
    await page.goto('/bots');
    // await page.getByRole('button', { name: /create bot/i }).click();
    // await expect(page).toHaveURL(/\/bots\/new/);
  });
});
