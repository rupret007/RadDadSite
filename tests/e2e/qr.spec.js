const { test, expect } = require('./fixtures');
for (const alias of ['/tap/', '/tap/index.html', '/nfc/', '/nfc/index.html']) {
    test(`${alias} keeps printed and legacy links working with query and fragment`, async ({ page }) => {
        await page.goto(`${alias}?utm_source=sticker#song`);
        await expect(page).toHaveURL(/\/qr\/\?utm_source=sticker#song$/);
        await expect(page.locator('#song')).toContainText('Taylor Swift cover');
    });
}
test('aliases retain no-JavaScript redirects and canonical QR metadata', async ({ page }) => {
    for (const path of ['/tap/index.html', '/nfc/index.html']) {
        const html = await (await page.request.get(path)).text();
        expect(html).toContain('content="0; url=../qr/"');
        expect(html).toContain('href="https://raddadband.com/qr/"');
        expect(html).toContain('href="../qr/"');
    }
});
test('relative QR redirects work beneath a project-site prefix', async ({ page }) => {
    const html = await (await page.request.get('/tap/index.html')).text();
    await page.route('**/project/tap/**', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.route('**/project/qr/**', route => route.fulfill({ contentType: 'text/html', body: '<title>QR destination</title>' }));
    await page.goto('/project/tap/?source=printed#song');
    await expect(page).toHaveURL(/\/project\/qr\/\?source=printed#song$/);
});
test('QR is a cover-first landing page with accurate metadata, streaming links and live videos', async ({ page }) => {
    await page.goto('/qr/');
    await expect(page).toHaveTitle('Rad Dad | Listen to the Covers & Watch Live');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('#song')).toContainText('Taylor Swift cover');
    await expect(page.locator('#song')).toContainText('Jeff Story');
    await expect(page.locator('.video-grid a')).toHaveCount(5);
    await expect(page.locator('.header-socials a')).toHaveCount(3);
    await expect(page.locator('#next-show')).toContainText('No upcoming dates posted yet');
    await expect(page.locator('a[href="../#shows"]')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('September 19');
    await expect(page.locator('body')).not.toContainText('our song');
    await expect(page.locator('a[href*="show-night"], a[download]')).toHaveCount(0);
});
for (const width of [320, 390, 800, 1440]) {
    test(`QR remains overflow-free and reachable at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/qr/');
        for (const section of ['#song', '#wildflower', '#next-show', '#follow']) {
            await page.locator(section).scrollIntoViewIfNeeded();
            expect(await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) <= innerWidth + 1)).toBe(true);
        }
        for (const a of await page.locator('.header-socials a').all()) {
            const rect = await a.boundingBox();
            expect(rect.width).toBeGreaterThanOrEqual(44);
            expect(rect.height).toBeGreaterThanOrEqual(44);
            expect(rect.x).toBeGreaterThanOrEqual(0);
            expect(rect.x + rect.width).toBeLessThanOrEqual(width);
        }
    });
}
test.describe('QR without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('streaming and video destinations stay usable with no false playback controls', async ({ page }) => {
        await page.goto('/qr/');
        await expect(page.locator('#song a[href^="https://music.apple.com"]')).toBeVisible();
        await expect(page.locator('#song a[href^="https://music.amazon.com"]')).toBeVisible();
        await expect(page.locator('[data-video-frame]')).not.toHaveAttribute('src');
        await expect(page.locator('[data-load-preview]')).toBeHidden();
        await expect(page.locator('#next-show')).not.toContainText('September');
    });
});
