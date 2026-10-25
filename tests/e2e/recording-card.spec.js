const { test, expect } = require('./fixtures');

const STREAMS = [
    'https://music.apple.com/us/album/the-story-of-us/1827102667?i=1827102893',
    'https://music.amazon.com/tracks/B0FHPB9FN7'
];
const CREDIT = 'Taylor Swift cover · Recorded by Jeff Story';

for (const path of ['/', '/qr/']) {
    test(`${path} recording card has one title, one credit and two streaming destinations`, async ({ page }) => {
        for (const width of [320, 390, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(path);
            const card = page.locator('.song-desk');
            await card.scrollIntoViewIfNeeded();
            await expect(page.getByRole('heading', { name: 'The Story Of Us', exact: true })).toHaveCount(1);
            await expect(card.getByRole('heading', { name: 'The Story Of Us', level: 2 })).toBeVisible();
            await expect(card.locator('.song-desk__copy > p')).toHaveCount(1);
            await expect(card.locator('.song-desk__credit')).toHaveText(CREDIT);
            await expect(card.locator('.preview-help, .song-desk__label')).toHaveCount(0);
            const links = card.getByRole('link');
            await expect(links).toHaveCount(2);
            for (let index = 0; index < STREAMS.length; index += 1) {
                await expect(links.nth(index)).toHaveAttribute('href', STREAMS[index]);
                await expect(links.nth(index)).toHaveAttribute('rel', 'noopener noreferrer');
                await expect(links.nth(index)).toBeVisible();
                expect((await links.nth(index).boundingBox()).height).toBeGreaterThanOrEqual(44);
            }
            expect(await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) <= innerWidth + 1)).toBe(true);
            await expect(card.locator('iframe')).toHaveCount(0);
            const preview = card.getByRole('button', { name: 'Load Apple Music preview', exact: true });
            await preview.click();
            await expect(card.locator('iframe')).toHaveCount(1);
            await expect(card.locator('iframe')).toHaveAttribute('src', 'https://embed.music.apple.com/us/album/the-story-of-us/1827102667?i=1827102893');
            await expect(card.locator('[data-load-preview]')).toHaveText('Reload player');
            await expect(card.locator('[data-load-preview]')).toBeVisible();
            await expect(links).toHaveCount(2);
        }
    });
}

for (const path of ['/', '/qr/']) {
    test(`${path} a blocked Apple Music preview keeps focused reload and the original streaming links`, async ({ page }) => {
        await page.clock.install();
        let attempts = 0;
        await page.route('https://embed.music.apple.com/**', async route => {
            attempts += 1;
            if (attempts === 1) await route.abort('internetdisconnected');
            else await route.fulfill({ contentType: 'text/html', body: '<!doctype html><p>Deliberate replacement frame fixture</p>' });
        });
        await page.goto(path);
        const card = page.locator('.song-desk');
        const button = card.locator('[data-load-preview]');
        await button.focus();
        await page.keyboard.press('Enter');
        await expect.poll(() => attempts).toBe(1);
        await page.evaluate(() => { window.__oldMusicFrame = document.querySelector('.song-desk iframe'); });
        await page.clock.fastForward(10_001);
        await expect(button).toHaveText('Reload player');
        await expect(button).toBeFocused();
        const status = card.getByRole('status');
        await expect(status).toHaveText(/If the player does not play|taking longer|could not be opened/);
        await expect(status).not.toHaveText(/^(Playing|Successfully loaded|Playback started)/i);
        await expect(button).toHaveAttribute('aria-describedby', await status.getAttribute('id'));
        await page.keyboard.press('Enter');
        await expect.poll(() => attempts).toBe(2);
        await expect(button).toHaveText('Reload player');
        await expect(card.locator('iframe')).toHaveCount(1);
        expect(await page.evaluate(() => window.__oldMusicFrame.isConnected)).toBe(false);
        await expect(card.frameLocator('iframe').locator('body')).toContainText('Deliberate replacement frame fixture');
        expect(await card.locator('a').evaluateAll(links => links.map(link => link.href))).toEqual(STREAMS);
    });

    test(`${path} stalled Apple Music retires a late frame and waits for deliberate reload`, async ({ page }) => {
        await page.clock.install();
        const attempts = [];
        await page.route('https://embed.music.apple.com/**', route => { attempts.push(route); });
        try {
            await page.goto(path);
            const card = page.locator('.song-desk');
            const button = card.locator('[data-load-preview]');
            const status = card.getByRole('status');
            await button.focus();
            await page.keyboard.press('Enter');
            await expect.poll(() => attempts.length).toBe(1);
            await expect(button).toHaveAttribute('aria-disabled', 'true');
            await expect(button).toBeFocused();
            await page.keyboard.press('Enter');
            expect(attempts).toHaveLength(1);
            await page.evaluate(() => { window.__oldMusicFrame = document.querySelector('.song-desk iframe'); });
            await page.clock.fastForward(10_001);
            await expect(status).toContainText('taking longer');
            await expect(card.locator('iframe')).toHaveCount(0);
            await expect(button).toHaveText('Reload player');
            await page.clock.fastForward(30_000);
            expect(attempts).toHaveLength(1);
            await page.keyboard.press('Enter');
            await expect.poll(() => attempts.length).toBe(2);
            await page.evaluate(() => {
                window.__oldMusicFrame.dispatchEvent(new Event('load'));
                window.__oldMusicFrame.dispatchEvent(new Event('error'));
            });
            await expect(status).toContainText('Opening');
            await expect(button).toHaveAttribute('aria-disabled', 'true');
            await attempts[1].fulfill({ contentType: 'text/html', body: '<!doctype html><p>Reload fixture</p>' });
            await expect(button).toHaveText('Reload player');
            await expect(card.frameLocator('iframe').locator('body')).toContainText('Reload fixture');
        } finally {
            for (const route of attempts) await route.abort().catch(() => {});
        }
    });

    test(`${path} leaving an opening Apple Music preview retires it before history return`, async ({ page }) => {
        const attempts = [];
        await page.route('https://embed.music.apple.com/**', route => { attempts.push(route); });
        try {
            await page.goto(path);
            const button = page.locator('[data-load-preview]');
            await button.click();
            await expect.poll(() => attempts.length).toBe(1);
            await page.evaluate(() => window.addEventListener('pagehide', () => sessionStorage.setItem('test-music-preview-exit', JSON.stringify({
                frames: document.querySelectorAll('.song-desk iframe').length,
                label: document.querySelector('[data-load-preview]').textContent,
                busy: document.querySelector('[data-load-preview]').getAttribute('aria-disabled'),
                status: document.querySelector('.song-desk [role=status]').textContent
            })), { once: true }));
            await page.goto(path === '/' ? '/qr/' : '/');
            expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('test-music-preview-exit')))).toEqual({ frames: 0, label: 'Load Apple Music preview', busy: null, status: '' });
            await page.goBack();
            await expect(button).toHaveText('Load Apple Music preview');
            await expect(page.locator('.song-desk iframe')).toHaveCount(0);
            expect(attempts).toHaveLength(1);
        } finally {
            for (const route of attempts) await route.abort().catch(() => {});
        }
    });
}

test.describe('concise recording cards without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    for (const path of ['/', '/qr/']) {
        test(`${path} retains accurate credit and direct streaming links`, async ({ page }) => {
            await page.goto(path);
            const card = page.locator('.song-desk');
            await expect(card.locator('.song-desk__credit')).toHaveText(CREDIT);
            await expect(card.getByRole('link')).toHaveCount(2);
            await expect(card.locator('[data-load-preview]')).toBeHidden();
            await expect(card.locator('iframe')).toHaveCount(0);
        });
    }
});
