const { test, expect } = require('./fixtures');

const BAND_LAB_PATH = '/private/garage-rehearsal-k7m2n9/';
const PUBLIC_SURFACES = ['/', '/qr/', '/tap/', '/nfc/'];
const SEWER_SET = [
    { label: 'TurdAnoid Turbo', href: /\/private\/garage-rehearsal-k7m2n9\/turdanoid\/TurdAnoid\.html$/ },
    { label: 'Turdtris', href: /\/private\/garage-rehearsal-k7m2n9\/turdanoid\/turdtris\.html$/ },
    { label: 'Crapjack 21', href: /\/private\/garage-rehearsal-k7m2n9\/turdanoid\/turdjack\.html$/ },
    { label: 'Crappy Eights', href: /\/private\/garage-rehearsal-k7m2n9\/turdanoid\/crapeights\.html$/ },
    { label: 'TurdRummy', href: /\/private\/garage-rehearsal-k7m2n9\/turdanoid\/turdrummy\.html$/ },
    { label: 'TurdSpades', href: /\/private\/garage-rehearsal-k7m2n9\/turdanoid\/turdspades\.html$/ }
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
    await expect(page.getByRole('heading', { name: /One ticket\. This phone/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /WebJam-shaped hole/i })).toBeVisible();
    await expect(page.getByText('Coming for band eyes only')).toBeVisible();
    await expect(page.getByText('This URL is not a lock.')).toBeVisible();
    await expect(page.getByText('Reserved seat. Not a stream. Not a date.')).toBeVisible();
    await expect(page.getByRole('link', { name: /home|show|covers|listen|connect/i })).toHaveCount(0);
    await expect(page.locator('aside iframe')).toHaveCount(0);
    await expect(page.locator('iframe')).toHaveCount(1);
    await expect(page.getByRole('link', { name: 'Open the sewer hub' })).toHaveAttribute(
        'href',
        'turdanoid/index.html'
    );

    for (const game of SEWER_SET) {
        await expect(page.getByRole('link', { name: game.label, exact: true })).toBeVisible();
    }

    const hub = page.frameLocator('iframe[title="Turdanoid six-game hub"]');
    await expect(hub.getByRole('heading', { level: 1 })).toBeVisible();
    await hub.getByRole('link', { name: /TurdAnoid Turbo/i }).click();
    await expect(hub.locator('canvas')).toBeVisible();
    await hub.locator('#btnStart').click();
    await expect(hub.locator('canvas')).toBeVisible();
    await expect(hub.locator('#titleScreen')).not.toHaveClass(/show/);
});

test('opens a same-folder sewer sticker and keeps the WebJam hole empty on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(BAND_LAB_PATH);

    await expect(page.getByRole('heading', { name: /Six games\. One dirty flyer/i })).toBeVisible();
    await expect(page.getByText('No signal')).toBeVisible();
    await expect(page.locator('aside iframe')).toHaveCount(0);

    await page.getByRole('link', { name: 'TurdAnoid Turbo', exact: true }).click();
    await expect(page).toHaveURL(SEWER_SET[0].href);
    await expect(page.locator('canvas')).toBeVisible();
});

test('names last-played on a return visit and keeps the no-JavaScript hub ticket', async ({ page, browser, baseURL }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('turdsuite_last_game', 'turdtris.html');
    });
    await page.goto(BAND_LAB_PATH);

    const ticket = page.getByRole('link', { name: 'Play Turdtris again' });
    await expect(ticket).toBeVisible();
    await expect(ticket).toHaveAttribute('href', 'turdanoid/turdtris.html');
    await expect(page.getByText('Last opened on this phone.')).toBeVisible();

    const localOrigin = new URL(baseURL).origin;
    const noJs = await browser.newContext({ javaScriptEnabled: false, serviceWorkers: 'block' });
    await noJs.route('**/*', async (route) => {
        const url = new URL(route.request().url());
        if (url.origin === localOrigin) {
            await route.continue();
            return;
        }
        if (url.hostname === 'fonts.googleapis.com') {
            await route.fulfill({ contentType: 'text/css', body: '/* Offline font fallback. */' });
            return;
        }
        await route.abort('blockedbyclient');
    });
    const staticPage = await noJs.newPage();
    await staticPage.goto(new URL(BAND_LAB_PATH, baseURL).href);
    await expect(staticPage.getByRole('link', { name: 'Open the sewer hub' })).toHaveAttribute(
        'href',
        'turdanoid/index.html'
    );
    await expect(staticPage.getByRole('link', { name: 'TurdSpades', exact: true })).toBeVisible();
    await expect(staticPage.locator('aside iframe')).toHaveCount(0);
    await noJs.close();
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
