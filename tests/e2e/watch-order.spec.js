const { test, expect } = require('./fixtures');

for (const javaScriptEnabled of [true, false]) {
    test.describe(`Watch order with JavaScript ${javaScriptEnabled ? 'on' : 'off'}`, () => {
        test.use({ javaScriptEnabled });

        for (const [path, sectionId] of [['/', 'watch'], ['/qr/', 'wildflower']]) {
            for (const width of javaScriptEnabled ? [320, 390, 1280] : [390]) {
                test(`${path} offers video cards before the channel at ${width}px`, async ({ page }) => {
                    await page.setViewportSize({ width, height: 844 });
                    await page.goto(`${path}#${sectionId}`);
                    const watch = page.locator(`#${sectionId}`);
                    const cards = watch.locator('.video-card');
                    const channel = watch.getByRole('link', { name: /More on YouTube/ });

                    await expect(watch.getByRole('heading', { name: 'Watch Rad Dad live' })).toBeInViewport();
                    await expect(cards).toHaveCount(5);
                    await expect(watch.locator('a, button').first()).toHaveClass(/video-card/);
                    await expect(channel).toHaveCount(1);
                    await expect(channel).toBeVisible();
                    await expect(channel).toHaveAttribute('href', 'https://www.youtube.com/@RadDadBand');
                    await expect(channel).toHaveAttribute('target', '_blank');
                    await expect(channel).toHaveAttribute('rel', /noopener/);
                    await expect(channel).toHaveAccessibleName(/More on YouTube.*\(opens in a new tab\)/);

                    const headingBox = await watch.locator('#watch-title').boundingBox();
                    const channelBox = await channel.boundingBox();
                    for (const card of await cards.all()) {
                        const cardBox = await card.boundingBox();
                        expect(cardBox.y).toBeGreaterThan(headingBox.y + headingBox.height);
                        expect(cardBox.y + cardBox.height).toBeLessThanOrEqual(channelBox.y);
                    }
                    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);

                    // Native tab order must match the visible sequence, including without JS.
                    await watch.focus();
                    for (const card of await cards.all()) {
                        await page.keyboard.press('Tab');
                        await expect(card).toBeFocused();
                    }
                    await page.keyboard.press('Tab');
                    await expect(channel).toBeFocused();
                });
            }
        }
    });
}
