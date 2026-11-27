const { test, expect } = require('./fixtures');

test('clean hosted game URLs keep canonical records and the return-to-arcade control', async ({ page }) => {
    const files = ['TurdAnoid.html', 'turdtris.html', 'turdomania.html', 'turdjack.html', 'crapeights.html', 'turdrummy.html', 'turdspades.html', 'chess.html', 'turdrush.html'];
    for (const file of files) {
        const clean = '/play/' + file.replace(/\.html$/, '');
        await page.route('**' + clean, async route => {
            const html = await page.request.get('/play/' + file);
            await route.fulfill({ status: 200, contentType: 'text/html', body: await html.text() });
        });
        await page.goto(clean);
        await expect(page.locator('.suite-back-pill, .chess-hub')).toBeVisible();
        await expect(page.locator('body')).not.toHaveClass(/suite-hub-door/);
        expect(await page.evaluate(() => localStorage.getItem('turdsuite_last_game'))).toBe(file);
        await page.unroute('**' + clean);
    }
    await page.locator('.suite-back-pill, .chess-hub').click();
    await expect(page.locator('h1')).toHaveText('Rad Dad Arcade');
});

test('a slow first game load shows a disabled action until the game can start', async ({ page }) => {
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    await page.route('**/play/games/turdanoid-theme-core.js', async route => { await ready; await route.continue(); });
    try {
        await page.goto('/play/TurdAnoid.html', { waitUntil: 'commit' });
        await expect(page.locator('#btnStart')).toBeDisabled();
        await expect(page.locator('#btnStart')).toHaveText('Loading game…');
        await expect(page.locator('#btnBoss')).toBeDisabled();
        release();
        await page.waitForLoadState('load');
        await expect(page.locator('#btnStart')).toBeEnabled();
        await page.locator('#btnStart').click();
        await expect(page.locator('#titleScreen')).toHaveAttribute('aria-hidden', 'true');
        expect(await page.evaluate(() => window.__turdanoid.state)).toBe('playing');
    } finally { release(); }
});

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
    await expect(page.locator('.game-card')).toHaveCount(9);
    expect((await page.locator('.shell').boundingBox()).width).toBeGreaterThanOrEqual(272);
    expect((await page.locator('.game-card').first().boundingBox()).width).toBeGreaterThan(110);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    await expect(page.locator('.subtitle')).toHaveText('Nine single-player games. In Royal Flush Chess, choose 2 players to share one device.');
    await page.getByRole('link', { name: /Royal Flush Chess/ }).click();
    await expect(page.getByRole('radio', { name: /1 player/ })).toBeChecked();
    await expect(page.getByRole('radio', { name: /2 players.*Share this device/ })).toBeVisible();
});

const games = [
    ['TurdAnoid.html', '#btnStart', '#btnStart'],
    ['turdtris.html', '#attractPlay', '#welcomeGuide'],
    ['turdomania.html', '#newBtn', null],
    ['turdjack.html', '#quickGuideBtn', '#welcomeGuide'],
    ['crapeights.html', '#quickStartBtn', '#welcomeGuide'],
    ['turdrummy.html', '#startRoundBtn', '#guideOverlay'],
    ['turdspades.html', '#quickStart', '#guide'],
    ['chess.html', '#new-game button[type=submit]', '#setup'],
    ['turdrush.html', '#rush-start', '#rush-intro']
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
            if (file === 'turdomania.html' || file === 'chess.html') await expect(page.locator('#board')).toBeVisible();
            await expect(page.locator('#suite-music-toggle, #suite-listen-manic, #suite-music-status, #musicToggle')).toHaveCount(0);
            expect(await page.evaluate(async () => ({ player: await Suite.music(), enabled: Suite.isMusicEnabled() }))).toEqual({ player: null, enabled: false });
            expect(music).toEqual([]);
            const back = page.locator('.suite-back-pill, .chess-hub');
            await expect(back).toBeVisible();
            if (width === 1280) {
                await back.focus();
                await page.keyboard.press('Enter');
            } else await back.click();
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
    await expect(page.locator('.game-card')).toHaveCount(9);
    await expect(page.locator('.suite-skip-link')).not.toBeInViewport();
    await page.keyboard.press('Tab');
    await expect(page.locator('.suite-skip-link')).toBeFocused();
    await expect(page.locator('.suite-skip-link')).toBeInViewport();
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

test('Turdtris Ultra shortcut opens the actual mode and Play honors a changed selection', async ({ page }) => {
    await page.goto('/play/');
    const shortcut = page.getByRole('link', { name: 'Turdtris · 2-minute Ultra →', exact: true });
    await expect(shortcut).toHaveAttribute('href', 'turdtris.html?mode=ultra');
    expect(await shortcut.evaluate((a) => a.closest('.game-card'))).toBeNull();
    await shortcut.click();
    await expect(page.locator('#attractModeSetting')).toHaveValue('ultra');
    await expect(page.locator('.hud[data-mode="ultra"]')).toHaveCount(1);
    await page.locator('#attractModeSetting').selectOption('sprint');
    await page.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(page.locator('.hud[data-mode="sprint"]')).toHaveCount(1);
    await expect(page.locator('#welcomeGuide')).toBeHidden();
    await expect(page.locator('#highLabel')).toHaveText('Best time');
    await page.evaluate(() => { score = 123; showWelcomeGuide(); });
    await page.getByRole('button', { name: 'Resume run', exact: true }).click();
    expect(await page.evaluate(() => ({ mode: runMode, score }))).toEqual({ mode: 'sprint', score: 123 });
    await page.goto('/play/turdtris.html?mode=invalid');
    await expect(page.locator('#attractModeSetting')).toHaveValue('classic');
});

test('Turdtris keeps keyboard focus in the start guide and moves it to the board when play starts', async ({ page }) => {
    await page.goto('/play/turdtris.html');
    const guide = page.getByRole('dialog', { name: 'Start Turdtris' });
    const play = guide.getByRole('button', { name: 'Play', exact: true });
    await expect(play).toBeEnabled();
    await expect(guide).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(play).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(guide.locator('#attractModeSetting')).toBeFocused();
    await play.focus();
    await page.keyboard.press('Enter');
    await expect(guide).toBeHidden();
    await expect(page.locator('#game')).toBeFocused();
    await expect(page.locator('.layout')).not.toHaveAttribute('inert');
});

test('desktop Turdanoid keeps its HUD clear of the Rad Dad effects controls', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('turdanoid_v3_coach_v1', '1'));
    for (const viewport of [{ width: 1280, height: 850 }, { width: 981, height: 900 }]) {
        await page.setViewportSize(viewport);
        await page.goto('/play/TurdAnoid.html');
        await page.locator('#btnStart').click();
        await expect(page.locator('#titleScreen')).toHaveAttribute('aria-hidden', 'true');
        const audio = page.getByRole('button', { name: 'Audio settings' });
        await expect(audio).toBeVisible();
        const hud = await page.locator('#playShell .hud').boundingBox();
        const controls = await page.locator('#playShell .topbtns-icons').boundingBox();
        expect(controls.x, 'The controls must clear the HUD').toBeGreaterThanOrEqual(hud.x + hud.width);
        expect(controls.x + controls.width, 'All effects controls must stay on screen').toBeLessThanOrEqual(viewport.width);
        await audio.click();
        const dialog = page.getByRole('dialog', { name: 'Sound effects' });
        await expect(dialog).toBeVisible();
        await dialog.getByRole('button', { name: 'Done' }).click();
        await expect(audio).toBeFocused();
    }
});
