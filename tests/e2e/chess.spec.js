const { test, expect } = require('./fixtures');

async function start(page, mode = 'computer') {
    await page.goto('/play/chess.html');
    await page.locator('#mode').selectOption(mode);
    await page.locator('#new-game button[type=submit]').click();
}
async function move(page, from, to) {
    await page.locator(`[data-square=${from}]`).click();
    await page.locator(`[data-square=${to}]`).click();
}

test('chess runs the self-hosted computer under Rad Dad CSP and keeps its own save', async ({ page }) => {
    const errors = [], music = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/\.(mp3|m4a)(?:\?|$)|suite-music\.js/.test(request.url())) music.push(request.url()); });
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('turdtrisHighScore', '321'));
    await start(page);
    await move(page, 'e2', 'e4');
    await expect(page.locator('#moves button')).toHaveCount(2);
    await page.locator('#hint').click();
    await expect(page.locator('#status')).toHaveText(/^Try /);
    await page.locator('#undo').click();
    await expect(page.locator('#moves button')).toHaveCount(0);
    await move(page, 'd2', 'd4');
    await expect(page.locator('#moves button')).toHaveCount(2);
    await page.locator('#mute').click();
    await page.reload();
    await page.locator('#continue').click();
    await expect(page.locator('#moves button')).toHaveCount(2);
    expect(await page.evaluate(() => Suite.isMuted())).toBe(true);
    expect(await page.evaluate(() => localStorage.getItem('turdtrisHighScore'))).toBe('321');
    await page.locator('.chess-hub').click();
    await expect(page.locator('.game-card[href="chess.html"] .play')).toContainText('Continue');
    await expect(page.locator('.game-card')).toHaveCount(8);
    expect(errors).toEqual([]);
    expect(music).toEqual([]);
});

test('chess local checkmate, result review and PGN export work without a server opponent', async ({ page }) => {
    await start(page, 'local');
    for (const [from, to] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) await move(page, from, to);
    await expect(page.locator('#turn')).toHaveText('Black wins!');
    await expect(page.locator('#status')).toHaveText('Checkmate');
    await page.reload();
    await expect(page.locator('#continue')).toHaveText('Review last game');
    await page.locator('#continue').click();
    await page.locator('details').last().locator('summary').click();
    const download = page.waitForEvent('download');
    await page.locator('#export').click();
    expect((await download).suggestedFilename()).toBe('royal-flush-chess.pgn');
    const stats = await page.evaluate(() => JSON.parse(localStorage.getItem('arcade_chess_results_v1')));
    expect(stats.local).toBe(1);
    await page.locator('.chess-hub').click();
    await expect(page.locator('.game-card[href="chess.html"] .play')).not.toContainText('Continue');
    await expect(page.locator('.game-card[href="chess.html"] .suite-hub-stat')).toContainText('1 completed');
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }, { width: 568, height: 320 }, { width: 667, height: 375 }]) {
    test(`chess board stays square and its controls remain reachable at ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await start(page, 'local');
        const board = await page.locator('#board').boundingBox();
        expect(Math.abs(board.height - board.width)).toBeLessThan(1);
        if (viewport.width > viewport.height) expect(board.y + board.height).toBeLessThanOrEqual(viewport.height);
        const square = await page.locator('[data-square=e2]').boundingBox();
        expect(Math.abs(square.height - square.width)).toBeLessThan(1);
        await page.locator('[data-square=e2]').focus();
        await page.keyboard.press('Enter');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('ArrowUp');
        await page.keyboard.press('Enter');
        await expect(page.locator('#moves button')).toHaveCount(1);
        await page.locator('details').last().locator('summary').click();
        await page.locator('#suite-arcade-a11y-toggle').click();
        await expect(page.locator('#suite-arcade-a11y-toggle')).toHaveText('Contrast on');
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    });
}

test('chess exposes intentional retry when its computer request fails', async ({ page }) => {
    let blocked = 0;
    await page.context().route('**/stockfish-19-lite-single.wasm', route => { blocked++; return route.abort(); });
    await start(page);
    await move(page, 'e2', 'e4');
    await expect(page.locator('#engine-recovery')).toBeVisible({ timeout: 20000 });
    expect(blocked).toBeGreaterThan(0);
    await expect(page.locator('#moves button')).toHaveCount(1);
    await page.context().unroute('**/stockfish-19-lite-single.wasm');
    await page.locator('#retry').click();
    await expect(page.locator('#moves button')).toHaveCount(2);
    await expect(page.locator('#engine-recovery')).toBeHidden();
});

test('a delayed engine reply cannot survive undo or restart', async ({ page }) => {
    let release;
    const ready = new Promise(resolve => { release = resolve; });
    let blocked = 0;
    await page.context().route('**/stockfish-19-lite-single.wasm', async route => {
        blocked++;
        await ready;
        await route.continue().catch(() => {});
    });
    try {
        await start(page);
        await move(page, 'e2', 'e4');
        await expect.poll(() => blocked).toBeGreaterThan(0);
        await page.locator('#undo').click();
        await expect(page.locator('#moves button')).toHaveCount(0);
        release();
        await page.waitForTimeout(800);
        await expect(page.locator('#moves button')).toHaveCount(0);
        await page.context().unroute('**/stockfish-19-lite-single.wasm');
        await move(page, 'd2', 'd4');
        await expect(page.locator('#moves button')).toHaveCount(2);
    } finally { release(); }
});

test('local play works offline and computer failure preserves the position for retry', async ({ page }) => {
    await start(page, 'local');
    await page.context().setOffline(true);
    await move(page, 'e2', 'e4');
    await expect(page.locator('#moves button')).toHaveCount(1);
    await page.context().setOffline(false);
    await page.locator('details').last().locator('summary').click();
    await page.locator('#new').click();
    await page.locator('#mode').selectOption('computer');
    await page.locator('#new-game button[type=submit]').click();
    await page.locator('#confirm-yes').click();
    await page.context().setOffline(true);
    await move(page, 'd2', 'd4');
    await expect(page.locator('#engine-recovery')).toBeVisible({ timeout: 20000 });
    await expect(page.locator('#moves button')).toHaveCount(1);
    await page.context().setOffline(false);
    await page.locator('#retry').click();
    await expect(page.locator('#moves button')).toHaveCount(2);
});
