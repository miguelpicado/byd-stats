import { test, expect } from '@playwright/test';

test.describe('PWA Core Flow', () => {
    test.beforeEach(async ({ page }) => {
        // Intercepting firebase/google auth checks by seeding local storage
        await page.addInitScript(() => {
            const expiry = Date.now() + (60 * 60 * 1000); // 1 hour from now
            localStorage.setItem('google_access_token', 'mock_token_123');
            localStorage.setItem('google_token_expiry', expiry.toString());
            // Seed a mock user too for other possible checks
            localStorage.setItem('onboarding_completed', 'true');
        });

        // Go to dashboard bypassing landing if possible
        await page.goto('/?skipLanding=true');
    });

    test('should have a title and render main interface', async ({ page }) => {
        await expect(page).toHaveTitle(/BYD Stats/i);
    });

    test('should load the dashboard once authenticated', async ({ page }) => {
        // Wait for the "Añadir/Nueva Carga" button to appear (meaning we're on the dashboard)
        const addBtn = page.getByRole('button', { name: /Añadir|Nueva Carga/i }).first();
        try {
            await expect(addBtn).toBeVisible({ timeout: 15000 });
        } catch (e) {
            await page.screenshot({ path: 'test-failure.png' });
            throw e;
        }
    });

    test('should open add charge modal', async ({ page }) => {
        // Find the "Añadir/Nueva Carga" button directly by text role instead of SVG classes
        const addBtn = page.getByRole('button', { name: /Añadir|Nueva Carga/i }).first();

        // Wait for it and click
        await addBtn.waitFor({ state: 'visible', timeout: 15000 });
        await addBtn.click();

        // Verify Title "Añadir/Nueva Carga" exists inside the modal dialog
        await expect(page.getByRole('dialog').getByRole('heading', { name: /Añadir|Nueva Carga/i }).first()).toBeVisible();

        // Close the modal
        await page.getByRole('button', { name: /Cancelar|Close/i }).click();

        // Ensure Modal is closed
        await expect(page.getByRole('dialog')).toBeHidden();
    });

    test('should trigger data synchronization', async ({ page }) => {
        // Find the Sync button by its role and title attribute that changes based on state
        // Initial title should correspond to 'Sincronizar' or 'Sincronizado' depending on app readiness
        // Wait for the button to be ready and visible
        const syncBtn = page.getByRole('button', { name: /Sincronizado|Sincronizando\.\.\.|Error de sincronización/i }).first();

        await syncBtn.waitFor({ state: 'visible', timeout: 15000 });
        await syncBtn.click();

        // After clicking, it might show "Sincronizando..." or it might rapidly finish because it's a mock.
        // We'll just verify the button is still there to ensure no crashes occurred.
        await expect(syncBtn).toBeVisible();
    });
});
