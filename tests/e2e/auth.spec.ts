import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Authentication Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await injectAxe(page);
  });

  test('should have a working login page with a11y checks', async ({ page }) => {
    await expect(page.getByText(/Welcome back/i)).toBeVisible();

    await checkA11y(page, {
      rules: {
        'color-contrast': { enabled: false },
        'region': { enabled: false },
        'image-redundant-alt': { enabled: false }
      }
    });
  });

  test('should navigate to registration page', async ({ page }) => {
    await page.getByRole('link', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/auth\/register/);
    // Use role and name to avoid ambiguity with route announcer
    await expect(page.getByRole('heading', { name: /Create your free account/i })).toBeVisible();
  });

  test('should navigate to forgot password page', async ({ page }) => {
    await page.getByRole('link', { name: /forgot your password/i }).click();
    await expect(page).toHaveURL(/\/auth\/forgot-password/);
  });
});
