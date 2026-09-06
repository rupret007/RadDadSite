const { test, expect } = require('./fixtures');

const BAND_LAB_PATH = '/private/garage-rehearsal-k7m2n9/';
const PUBLIC_SURFACES = ['/', '/qr/', '/tap/', '/nfc/'];
const SEWER_SET = [
    'TurdAnoid Turbo',
    'Turdtris',
    'Crapjack 21',
    'Crappy Eights',
    'TurdRummy',
    'TurdSpades'
];

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
    await expect(page.getByText('This URL is not a lock.')).toBeVisible();
    await expect(page.getByRole('link', { name: /home|show|covers|listen|connect/i })).toHaveCount(0);
    await expect(page.locator('aside iframe')).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(1);

    for (const game of SEWER_SET) {
        await expect(page.locator('.band-lab-setlist')).toContainText(game);
    }

    const hub = page.frameLocator('iframe[title="Turdanoid six-game hub"]');
    await expect(hub.getByRole('heading', { level: 1 })).toBeVisible();
    await hub.getByRole('link', { name: /TurdAnoid Turbo/i }).click();
    await expect(hub.locator('canvas')).toBeVisible();
    await hub.locator('#btnStart').click();
    await expect(hub.locator('canvas')).toBeVisible();
    await expect(hub.locator('#titleScreen')).not.toHaveClass(/show/);
});

test('opens the same-folder sewer full-page and keeps the WebJam hole empty on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BAND_LAB_PATH);

    await expect(page.getByRole('heading', { name: /Six games\. One dirty flyer/i })).toBeVisible();
    await expect(page.getByText('No signal')).toBeVisible();
    await expect(page.locator('aside iframe')).toHaveCount(0);

    await page.getByRole('link', { name: /Open the sewer full-page/i }).click();
    await expect(page).toHaveURL(/\/private\/garage-rehearsal-k7m2n9\/turdanoid\/index\.html$/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('link', { name: /TurdAnoid Turbo/i }).click();
    await expect(page.locator('canvas')).toBeVisible();
});

test('keeps the band-lab URL off public homepage, QR, tap, and NFC surfaces', async ({ page }) => {
    for (const path of PUBLIC_SURFACES) {
        await page.goto(path);

        await expect(page.locator('a[href*="garage-rehearsal-k7m2n9"]')).toHaveCount(0);
        await expect(page.locator('a[href*="/private/"]')).toHaveCount(0);
        await expect(page.locator('body')).not.toContainText('Band Lab');
        await expect(page.locator('body')).not.toContainText('Turdanoid');
        await expect(page.locator('body')).not.toContainText('WebJam');
    }

    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toBeVisible();
});
