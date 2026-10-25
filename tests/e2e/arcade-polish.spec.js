const { test, expect } = require('./fixtures');
test.use({ showTime: null });
const games = [
    ['TurdAnoid', '#btnStart'], ['turdtris', '#attractPlay'], ['turdomania', '#newBtn'],
    ['turdjack', '#quickGuideBtn'], ['crapeights', '#quickStartBtn'],
    ['turdrummy', '#startRoundBtn'], ['turdspades', '#quickStart']
];

for (const [width, height] of [[320, 568], [375, 667], [390, 844], [844, 390]]) {
    test.describe(`Rummy coaching at ${width}x${height}`, () => {
        test.use({ viewport: { width, height }, hasTouch: true, isMobile: true, reducedMotion: 'reduce' });
        test('all four tips remain readable and reachable', async ({ page }) => {
            await page.goto('/play/turdrummy.html');
            await page.locator('#startRoundBtn').tap();
            for (let step = 0; step < 4; step++) {
                const metrics = await page.locator('#coachBody').evaluate(element => {
                    const body = element.getBoundingClientRect(), card = element.closest('.coach').getBoundingClientRect();
                    return { width: body.width, size: parseFloat(getComputedStyle(element).fontSize), fits: body.left >= card.left && body.right <= card.right && body.top >= card.top && body.bottom <= card.bottom };
                });
                expect(metrics.width).toBeGreaterThanOrEqual(120);
                expect(metrics.size).toBeGreaterThanOrEqual(12);
                expect(metrics.fits).toBe(true);
                const next = page.locator('#coachNextBtn');
                const box = await next.boundingBox();
                expect(box.width).toBeGreaterThanOrEqual(44);
                expect(box.height).toBeGreaterThanOrEqual(44);
                expect(box.x + box.width).toBeLessThanOrEqual(width);
                expect(box.y + box.height).toBeLessThanOrEqual(height);
                await next.tap();
            }
            await expect(page.locator('#coachCard')).toBeHidden();
            await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
        });
    });
}

for (const [game, action] of games) {
    test(`${game} explains a stalled startup and recovers when the download completes`, async ({ page }) => {
        let release;
        const held = new Promise(resolve => { release = resolve; });
        await page.route('**/play/assets/turdsuite.js', async route => { await held; await route.continue(); });
        try {
            await page.clock.install();
            await page.goto('/play/' + game + '.html', { waitUntil: 'commit' });
            // A head download can block the first render frame. Poll from the
            // test driver instead of waiting on the page's virtualized rAF.
            await expect.poll(() => page.evaluate(() => !!window.SuiteLoading)).toBe(true);
            await page.clock.fastForward(13000);
            await expect(page.locator('#suite-load-state')).toBeVisible();
            await expect(page.locator('#suite-load-state button')).toBeFocused();
            release();
            await page.waitForLoadState('load');
            await page.waitForFunction(() => window.SuiteLoading.state === 'ready');
            await expect(page.locator('#suite-load-state')).toHaveCount(0);
            await page.locator(action).click();
            await page.locator('.suite-back-pill').click();
            await expect(page.locator('h1')).toHaveText('Rad Dad Arcade');
        } finally { release(); }
    });

    test(`${game} remains playable with denied browser storage`, async ({ page }) => {
        await page.addInitScript(() => Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('Denied', 'SecurityError'); } }));
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('/play/' + game + '.html');
        await page.locator(action).click();
        expect(await page.evaluate(() => window.SuiteLoading.state)).toBe('ready');
        await page.locator('.suite-back-pill').click();
        await expect(page.locator('h1')).toHaveText('Rad Dad Arcade');
        expect(errors).toEqual([]);
    });
}

test('failed Turdtris download retries its exact mode link and retains the real mute preference', async ({ page }) => {
    await page.goto('/play/');
    await page.locator('#suite-hub-mute').click();
    expect(await page.evaluate(() => Suite.isMuted())).toBe(true);
    let broken = true;
    await page.route('**/play/games/turdtris-modes.js', route => broken ? route.abort() : route.continue());
    await page.goto('/play/turdtris.html?mode=sprint#review');
    await expect(page.locator('#suite-load-state')).toBeVisible();
    const url = page.url();
    broken = false;
    await page.locator('#suite-load-state button').click();
    await page.waitForFunction(() => window.SuiteLoading.state === 'ready');
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => Suite.isMuted())).toBe(true);
    await expect(page.locator('#musicToggle')).toHaveCount(0);
    await page.locator('#attractPlay').click();
    await expect(page.locator('#welcomeGuide')).toBeHidden();
    await expect(page.locator('#modeBadge')).toContainText(/sprint/i);
});

test('a corrupt continue store cannot invent progress, and a real Rummy draw survives refresh', async ({ page }) => {
    await page.addInitScript(() => {
        if (!sessionStorage.getItem('seeded')) {
            localStorage.setItem('turdsuite_continue_v1', '{corrupt');
            sessionStorage.setItem('seeded', 'yes');
        }
        let seed = 0x524d5931;
        const next = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
        crypto.getRandomValues = array => { for (let i = 0; i < array.length; i++) array[i] = next(); return array; };
        Math.random = () => next() / 0x100000000;
    });
    await page.goto('/play/');
    await expect(page.locator('.game-card.in-progress')).toHaveCount(0);
    await page.locator('.game-card[href="turdrummy.html"]').click();
    await page.locator('#startRoundBtn').click();
    await page.locator('#coachSkipBtn').click();
    await expect(page.locator('#drawStockBtn')).toBeEnabled();
    await page.locator('#drawStockBtn').click();
    const table = () => page.evaluate(() => {
        const snapshot = Suite.table.load('turdrummy.html');
        return Object.fromEntries(['phase', 'turn', 'round', 'playerScore', 'aiScore', 'stock', 'discard', 'playerHand', 'aiHand', 'drawnCardId'].map(key => [key, snapshot[key]]));
    });
    const before = await table();
    expect(before.phase).toBe('discard');
    expect(before.playerHand).toHaveLength(11);
    await page.reload();
    expect(await table()).toEqual(before);
    await page.locator('#playerHand button').first().click();
    await page.locator('#discardBtn').click();
    await page.locator('.suite-back-pill').click();
    await expect(page.locator('.game-card[href="turdrummy.html"]')).toHaveAccessibleName(/Continue/);
});
