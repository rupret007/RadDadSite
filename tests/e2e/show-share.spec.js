const { test, expect } = require('./fixtures');
async function sharing(page, mode = 'success', clipboard = 'success') {
    await page.addInitScript(({ mode, clipboard }) => {
        window.shareCalls = []; window.copyCalls = [];
        Object.defineProperty(navigator, 'share', { configurable: true, value: mode === 'missing' ? undefined : async data => {
            window.shareCalls.push(data);
            if (mode === 'cancel') throw new DOMException('Canceled', 'AbortError');
            if (mode === 'fail') throw new Error('Private provider error');
            if (mode === 'pending') return new Promise(resolve => { window.finishShare = resolve; });
        } });
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => {
            window.copyCalls.push(text); if (clipboard === 'fail') throw new Error('Private clipboard error');
        } } });
    }, { mode, clipboard });
}
for (const path of ['/', '/qr/']) {
    test(`${path} shares only the canonical band link on an explicit gesture`, async ({ page }) => {
        await sharing(page);
        await page.goto(`${path}?token=private-preview#private`);
        expect(await page.evaluate(() => window.shareCalls)).toEqual([]);
        await page.locator('[data-share-band]').click();
        expect(await page.evaluate(() => window.shareCalls)).toEqual([{ title: 'Rad Dad | DFW Cover Band', text: 'Pop-punk, punk and alternative covers from Dallas–Fort Worth.', url: 'https://raddadband.com/' }]);
        expect(await page.evaluate(() => window.copyCalls)).toEqual([]);
        await expect(page.locator('[data-share-status]')).toHaveText('Sharing options closed.');
    });
    test(`${path} cancellation never copies or claims a post was delivered`, async ({ page }) => {
        await sharing(page, 'cancel'); await page.goto(path);
        await page.locator('[data-share-band]').click();
        await expect(page.locator('[data-share-status]')).toHaveText('Sharing canceled.');
        expect(await page.evaluate(() => window.copyCalls)).toEqual([]);
        await expect(page.locator('[data-share-fallback]')).toBeHidden();
    });
    test(`${path} unsupported sharing waits for a separate copy click`, async ({ page }) => {
        await sharing(page, 'missing'); await page.goto(path);
        await page.locator('[data-share-band]').click();
        expect(await page.evaluate(() => window.copyCalls)).toEqual([]);
        await expect(page.locator('[data-share-fallback]')).toBeVisible();
        await page.locator('[data-copy-band]').click();
        expect(await page.evaluate(() => window.copyCalls)).toEqual(['https://raddadband.com/']);
        await expect(page.locator('[data-share-status]')).toHaveText('Band website copied.');
    });
}
test('provider and clipboard failures leave a selectable link without exposing internal errors', async ({ page }) => {
    await sharing(page, 'fail', 'fail'); await page.goto('/');
    await page.locator('[data-share-band]').click();
    await page.locator('[data-copy-band]').click();
    await expect(page.locator('#band-share-url')).toHaveValue('https://raddadband.com/');
    await expect(page.locator('[data-share-status]')).toHaveText('Select the website address and copy it manually.');
    await expect(page.locator('.band-share')).not.toContainText('Private');
});
test('leaving a page retires a pending share completion', async ({ page }) => {
    await sharing(page, 'pending'); await page.goto('/');
    await page.locator('[data-share-band]').click();
    await expect(page.locator('[data-share-band]')).toBeDisabled();
    await page.evaluate(() => { window.dispatchEvent(new Event('pagehide')); window.finishShare(); });
    await expect(page.locator('[data-share-status]')).toBeEmpty();
    await expect(page.locator('[data-share-band]')).toBeEnabled();
});
