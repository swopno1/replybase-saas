import { test, expect } from '@playwright/test';

test.describe('Dashboard & Navigation E2E', () => {
  test('should load the dashboard and check essential elements', async ({ page }) => {
    // Note: In CI, we use global setup to provide authentication
    await page.goto('/');

    // Check for dashboard elements
    const heading = page.getByRole('heading', { name: /dashboard/i });
    // This is a smoke test for the UI shell
    await expect(page).toHaveTitle(/ReplyBase/i);
  });
});

test.describe('Admin System Tests Access', () => {
  test('should prevent non-admin access to system tests', async ({ page }) => {
    // This test assumes we are not logged in or logged in as a regular user
    await page.goto('/admin/tests');
    // Should be redirected to login or show unauthorized
    await expect(page.url()).toContain('/auth/login');
  });
});
