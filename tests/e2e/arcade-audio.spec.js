const { test, expect } = require('@playwright/test');

const games = ['TurdAnoid', 'turdtris', 'turdjack', 'crapeights', 'turdrummy', 'turdspades', 'turdomania', 'chess'];
async function clickVisible(page, selector) {
    const control = page.locator(selector).first();
    if (await control.isVisible()) await control.click();
}
async function enter(page, game) {
    if (game === 'TurdAnoid') {
        await clickVisible(page, '#btnStart');
        for (let step = 0; step < 4; step++) await clickVisible(page, '#btnCoachNext');
    }
    if (game === 'turdtris') await clickVisible(page, '[onclick="startAttractMode()"]');
    if (['turdjack', 'crapeights'].includes(game)) await clickVisible(page, '#closeGuideBtn');
    if (game === 'turdrummy') {
        await clickVisible(page, '#startRoundBtn');
        for (let step = 0; step < 5; step++) await clickVisible(page, '#coachNextBtn');
    }
    if (game === 'turdspades') await clickVisible(page, '#quickStart');
    if (game === 'chess') {
        await page.locator('input[name=mode][value=local]').check();
        await page.locator('#new-game button[type=submit]').click();
    }
}
async function audioButton(page) {
    for (const button of await page.locator('.suite-audio-open').all()) {
        if (await button.isVisible()) return button;
    }
    for (const button of await page.locator('.suite-audio-open').all()) {
        const details = button.locator('xpath=ancestor::details[1]');
        if (!await details.count()) continue;
        const summary = details.locator('summary').first();
        if (await summary.isVisible()) {
            await summary.click();
            if (await button.isVisible()) return button;
        }
    }
    throw new Error('Audio settings must be reachable');
}
for (const game of games) {
    test(`${game}: gesture, explicit preview, mute, level and cleanup`, async ({ page }) => {
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`/play/${game}.html`);
        await page.waitForFunction(() => window.Suite?.getSoundState?.().ready);
        expect(await page.evaluate(() => Suite.getSoundState().armed)).toBe(false);
        expect(await page.evaluate(() => Suite.playSound('shared.win'))).toBe(false);
        await enter(page, game);
        await (await audioButton(page)).click();
        await expect(page.locator('#suite-audio-settings')).toBeVisible();
        const pausesGame = ['TurdAnoid', 'turdtris', 'chess'].includes(game);
        if (pausesGame) expect(await page.evaluate(() => Suite.getSoundState().paused)).toBe(true);
        const before = await page.evaluate(() => Suite.getSoundState().accepted);
        await page.locator('#suite-effects-preview').click();
        await expect.poll(() => page.evaluate(() => Suite.getSoundState().accepted)).toBeGreaterThan(before);
        await page.locator('#suite-effects-enabled').uncheck();
        expect(await page.evaluate(() => Suite.playSound('shared.win'))).toBe(false);
        await expect.poll(() => page.evaluate(() => Suite.getSoundState().activeVoices)).toBe(0);
        await page.locator('#suite-effects-enabled').check();
        await page.locator('#suite-effects-level').fill('0');
        await expect(page.locator('#suite-effects-preview')).toBeDisabled();
        await page.locator('#suite-effects-level').fill('55');
        await page.locator('#suite-effects-preview').click();
        await expect.poll(() => page.evaluate(() => Suite.getSoundState().activeVoices)).toBe(0);
        await page.locator('#suite-effects-close').click();
        await expect.poll(() => page.evaluate(() => Suite.getSoundState().settingsOpen)).toBe(false);
        if (pausesGame) {
            expect(await page.evaluate(() => Suite.getSoundState().paused)).toBe(true);
            await page.keyboard.press('Enter');
            await expect.poll(() => page.evaluate(() => Suite.getSoundState().paused)).toBe(false);
        }
        expect(await page.evaluate(() => localStorage.getItem('suite.effects.volume.v1'))).toBe('0.55');
        await page.reload();
        await page.waitForFunction(() => window.Suite?.getSoundState?.().ready);
        expect(await page.evaluate(() => Suite.getSoundState().volume)).toBe(.55);
        expect(await page.evaluate(() => Suite.getSoundState().armed)).toBe(false);
        expect(await page.evaluate(() => Suite.getSoundState().accepted)).toBe(0);
        expect(errors).toEqual([]);
    });
}
for (const [game, selector] of [['turdjack', '[data-sound-toggle]'], ['turdrummy', '#soundToggleBtn']]) {
    test(`${game}: local sound off also blocks shared result cues`, async ({ page }) => {
        await page.goto(`/play/${game}.html`);
        await page.waitForFunction(() => window.Suite?.getSoundState?.().ready);
        await enter(page, game);
        await page.locator(selector).filter({ visible: true }).first().click();
        expect(await page.evaluate(() => Suite.getSoundState().localEnabled)).toBe(false);
        expect(await page.evaluate(() => Suite.playSound('shared.win'))).toBe(false);
        expect(await page.evaluate(() => Suite.playSound('shared.fart'))).toBe(false);
        await expect.poll(() => page.evaluate(() => Suite.getSoundState().activeVoices)).toBe(0);
        await page.reload();
        await page.waitForFunction(() => window.Suite?.getSoundState?.().ready);
        expect(await page.evaluate(() => Suite.getSoundState().localEnabled)).toBe(false);
    });
}
