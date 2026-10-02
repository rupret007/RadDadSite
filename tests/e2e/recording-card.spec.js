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
            await expect(preview).toBeHidden();
            await expect(links).toHaveCount(2);
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
