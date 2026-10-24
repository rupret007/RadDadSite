const { test, expect } = require('./fixtures');

test('homework, hero video and arcade art work from the homepage', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await page.goto('/');
    await page.locator('.hero-performance').click();
    const dialog = page.locator('#live-video-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-video-frame]')).toHaveAttribute('src', /iMrxzCQ7lVs/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.hero-performance')).toBeFocused();
    await expect(dialog.locator('[data-video-frame]')).not.toHaveAttribute('src');
    await page.getByRole('navigation', { name: 'Primary navigation', exact: true }).getByRole('link', { name: 'Homework' }).click();
    await expect(page.getByRole('heading', { name: 'Do your homework.' })).toBeInViewport();
    for (const img of await page.locator('.arcade-pick img').all()) {
        await img.scrollIntoViewIfNeeded();
        await expect.poll(() => img.evaluate(node => node.complete && node.naturalWidth > 0)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await page.locator('.arcade-ticket a').click();
    await expect(page.locator('h1')).toHaveText('Rad Dad Arcade');
    await expect(page.locator('.game-card')).toHaveCount(7);
});

const games = [
    ['TurdAnoid.html', '#btnStart', '#btnStart'],
    ['turdtris.html', '#attractPlay', '#welcomeGuide'],
    ['turdomania.html', '#newBtn', null],
    ['turdjack.html', '#quickGuideBtn', '#welcomeGuide'],
    ['crapeights.html', '#quickStartBtn', '#welcomeGuide'],
    ['turdrummy.html', '#startRoundBtn', '#guideOverlay'],
    ['turdspades.html', '#quickStart', '#guide']
];

for (const width of [390, 1280]) {
    for (const [file, action, dismissed] of games) {
        test(`${file} starts with sound effects and returns to Rad Dad Arcade at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 844 });
            const errors = [], missing = [], music = [];
            page.on('pageerror', error => errors.push(error.message));
            page.on('response', response => { if (response.status() >= 400) missing.push(response.url()); });
            page.on('request', request => { if (/\.(m4a|mp3)(?:\?|$)|suite-music\.js/.test(request.url())) music.push(request.url()); });
            await page.goto('/play/' + file);
            await expect.poll(() => page.evaluate(() => typeof window.Suite)).toBe('object');
            await page.locator(action).click();
            if (dismissed) await expect(page.locator(dismissed)).toBeHidden();
            if (file === 'TurdAnoid.html') { await expect(page.locator('canvas#game')).toBeVisible(); await page.keyboard.press('Space'); }
            if (file === 'turdtris.html') await expect(page.locator('canvas#game')).toBeVisible();
            if (file === 'turdomania.html') await expect(page.locator('#board')).toBeVisible();
            await expect(page.locator('#suite-music-toggle, #suite-listen-manic, #suite-music-status')).toHaveCount(0);
            expect(await page.evaluate(async () => ({ player: await Suite.music(), enabled: Suite.isMusicEnabled() }))).toEqual({ player: null, enabled: false });
            expect(music).toEqual([]);
            const back = page.locator('.suite-back-pill');
            await expect(back).toBeVisible();
            await back.click();
            await expect(page.locator('h1')).toHaveText('Rad Dad Arcade');
            expect(errors).toEqual([]);
            expect(missing).toEqual([]);
        });
    }
}

test('arcade hub works with denied storage and keeps its band return link', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Denied', 'SecurityError'); } });
    });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/play/');
    await expect(page.locator('.game-card')).toHaveCount(7);
    await expect(page.locator('.rad-arcade-nav a').first()).toHaveAttribute('href', '../');
    await page.locator('.game-card[href="turdomania.html"]').click();
    await expect(page.locator('#board')).toBeVisible();
    await page.locator('#newBtn').click();
    expect(errors).toEqual([]);
});

test('score sharing identifies Rad Dad and links back to the game on the review origin', async ({ page, baseURL }) => {
    await page.goto('/play/turdomania.html');
    await expect.poll(() => page.evaluate(() => !!window.SuiteShare)).toBe(true);
    const result = await page.evaluate(() => SuiteShare.describe('turdomania', { score: 123, level: 'normal', left: 0, cleared: true }, location.href));
    expect(result.text).toContain('Rad Dad Arcade');
    expect(result.text).not.toContain('Stalemate');
    expect(result.url).toBe(new URL('/play/turdomania.html?level=normal', baseURL).href);
});
