const { test, expect } = require('./fixtures');

const BAND_LAB_PATH = '/private/garage-rehearsal-k7m2n9/';

test('loads the unlisted band lab and plays TurdAnoid from the vendored hub', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const response = await page.goto(BAND_LAB_PATH);

    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/Band Lab/i);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        'noindex, nofollow, noarchive'
    );
    await expect(page.getByRole('navigation')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Dad energy/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /WebJam-shaped hole/i })).toBeVisible();
    await expect(page.getByText('Coming for band eyes only')).toBeVisible();
    await expect(page.getByRole('link', { name: /home|show|covers|listen|connect/i })).toHaveCount(0);

    const hub = page.frameLocator('iframe[title="Turdanoid six-game hub"]');
    await expect(hub.getByRole('heading', { name: /Turdanoid/i })).toBeVisible();
    await hub.getByRole('link', { name: /TurdAnoid Turbo/i }).click();
    await expect(hub.locator('canvas')).toBeVisible();
    await hub.locator('#btnStart').click();
    await expect(hub.locator('canvas')).toBeVisible();
    await expect(hub.locator('#titleScreen')).not.toHaveClass(/show/);
});

test('keeps the band-lab URL off the public homepage and footer', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
    await expect(page.locator('a[href*="garage-rehearsal-k7m2n9"]')).toHaveCount(0);
    await expect(page.locator('a[href*="/private/"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText('Band Lab');
    await expect(page.locator('body')).not.toContainText('Turdanoid');
});
