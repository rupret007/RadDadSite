const { test, expect } = require('./fixtures');

test('homepage leads with a cover band, live videos and booking rather than an expired event', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle('Rad Dad | DFW Pop-Punk Cover Band');
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('#band-title')).toContainText('Rad Dad');
    await expect(page.locator('#home')).toContainText('Cover band');
    await expect(page.locator('#home a[href="#watch"]')).toBeVisible();
    await expect(page.locator('#home a[href="#contact"]')).toBeVisible();
    const ids = await page.locator('main > section').evaluateAll(nodes => nodes.map(n => n.id));
    expect(ids).toEqual(['home', 'watch', 'covers', 'band', '', 'shows', 'contact']);
    const metadata = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent());
    expect(metadata['@type']).toBe('MusicGroup');
    expect(metadata.name).toBe('Rad Dad');
    expect(metadata).not.toHaveProperty('startDate');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://raddadband.com/RadDad_Logo.jpg');
    await expect(page.locator('[data-show-primary-action], [data-show-share], a[download]')).toHaveCount(0);
});

test('all fourteen covered artists remain visible and the band has its own identity section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.artist-wall > li')).toHaveCount(14);
    await expect(page.locator('.artist-wall a')).toHaveCount(0);
    for (const artist of ['Green Day', 'blink-182', 'Jimmy Eat World', 'Nirvana', 'Taylor Swift']) {
        await expect(page.locator('#covers')).toContainText(artist);
    }
    await expect(page.locator('.band-members dt')).toHaveText(['Jeff','Travis','Lucky','Che']);
    await expect(page.locator('#band')).toContainText('cover band');
});

test('the Taylor Swift cover has an accurate credit and an opt-in Apple Music preview', async ({ page }) => {
    const requested = [];
    page.on('request', request => { if (request.url().includes('embed.music.apple.com')) requested.push(request.url()); });
    await page.goto('/');
    const song = page.locator('#our-song');
    await song.scrollIntoViewIfNeeded();
    await expect(song).toContainText('Taylor Swift cover');
    await expect(song).toContainText('Jeff Story');
    await expect(song.locator('iframe')).toHaveCount(0);
    expect(requested).toEqual([]);
    await song.getByRole('button', { name: 'Load Apple Music preview' }).click();
    await expect(song.locator('iframe')).toHaveAttribute('src', /1827102893/);
    await expect.poll(() => requested.length).toBe(1);
    await expect(song.locator('iframe')).toHaveAttribute('sandbox', 'allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation');
    await expect(song.getByRole('link', { name: /Apple Music/ })).toHaveAttribute('href', /music.apple.com/);
});

test('booking is an honest direct inquiry with the existing email and phone', async ({ page }) => {
    await page.goto('/');
    await page.locator('#home a[href="#contact"]').click();
    const booking = page.getByRole('group', { name: 'Show booking' });
    await expect(booking.getByRole('link', { name: 'Email about a show' })).toHaveAttribute('href', /^mailto:rad\.dad\.band@gmail\.com\?subject=Rad%20Dad%20booking/);
    await expect(booking.getByRole('link', { name: /Call/ })).toHaveAttribute('href', 'tel:+12146970584');
    await expect(page.locator('#contact')).toContainText('does not confirm a booking');
    await expect(page.locator('form')).toHaveCount(0);
    await expect(page.locator('#contact .social-nav a')).toHaveCount(3);
});

for (const width of [320, 390, 768, 980, 981, 1440]) {
    test(`homepage remains usable without overlap at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        for (const section of ['#home', '#watch', '#covers', '#band', '#our-song', '#shows', '#contact']) {
            await page.locator(section).scrollIntoViewIfNeeded();
            expect(await page.evaluate(() => Math.max(document.body.scrollWidth, document.documentElement.scrollWidth) <= innerWidth + 1)).toBe(true);
        }
        const nav = page.getByRole('navigation', { name: 'Primary navigation', exact: true });
        for (const link of await nav.getByRole('link').all()) {
            expect((await link.boundingBox()).height).toBeGreaterThanOrEqual(44);
        }
        await nav.getByRole('link', { name: 'Watch', exact: true }).click();
        await expect.poll(async () => {
            const top = await page.locator('#watch-title').boundingBox();
            const header = await page.locator('.site-header').boundingBox();
            return top.y >= header.height - 1 && top.y < header.height + 100;
        }).toBe(true);
    });
}

test.describe('homepage without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('keeps cover credits, social links, booking and all five native video links', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#home')).toContainText('Cover band');
        await expect(page.locator('#our-song')).toContainText('Taylor Swift cover');
        await expect(page.locator('.video-grid a')).toHaveCount(5);
        await expect(page.locator('[data-load-preview]')).toBeHidden();
        await expect(page.locator('[data-share-band]')).toBeHidden();
        await expect(page.locator('a[href^="mailto:"]')).toBeVisible();
        await expect(page.locator('.header-socials a')).toHaveCount(3);
    });
});
