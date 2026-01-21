import { test, expect } from '@playwright/test';

// Basic smoke test to verify app loads
test('has title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/BYD Stats/);
});
