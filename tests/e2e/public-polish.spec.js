const { test, expect } = require('./fixtures');

// Recording-card links (Story Of Us) are deliberately outside this polish pass.
const STORY_OF_US_LINK = /the-story-of-us|B0FHPB9FN7/;

for (const [width, height] of [[375, 667], [390, 844], [844, 390]]) {
    for (const path of ['/', '/qr/']) {
        test(`${path} brand home link is a 44px touch target at ${width}x${height}`, async ({ page }) => {
            await page.setViewportSize({ width, height });
            await page.goto(path);
            const brand = page.locator('.site-header a.brand');
            const box = await brand.boundingBox();
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.width).toBeGreaterThanOrEqual(44);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        });
    }
}

test('the inline venue link in the past-show card has a 44px tap area without changing its text size', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const venue = page.locator('.show-card--past .show-card__body p a', { hasText: 'The Fault Lines' });
    await venue.scrollIntoViewIfNeeded();
    const box = await venue.boundingBox();
    expect(box.height).toBeLessThan(44);
    expect(parseFloat(await venue.evaluate((el) => getComputedStyle(el).fontSize))).toBeLessThan(18);

    // Hit-test just above and below the text: the tap area must reach the link.
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    for (const offset of [-19, 19]) {
        const href = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('a')?.getAttribute('href') ?? null, [centerX, centerY + offset]);
        expect(href, `tap ${offset}px from the venue link centre`).toBe('https://www.facebook.com/thefaultlinestx');
    }
});

for (const path of ['/tap/', '/nfc/']) {
    test.describe(`${path} redirect shell without JavaScript`, () => {
        test.use({ javaScriptEnabled: false });
        test('its continue link is a 44px touch target', async ({ page }) => {
            // The shell's meta refresh would move on to /qr/. A 204 answers that
            // navigation with no content, so the browser keeps the shell on screen.
            await page.route('**/qr/**', (route) => route.fulfill({ status: 204 }));
            for (const [width, height] of [[375, 667], [844, 390]]) {
                await page.setViewportSize({ width, height });
                await page.goto(path);
                const link = page.getByRole('link', { name: 'Continue to the music', exact: true });
                const box = await link.boundingBox();
                expect(box.height).toBeGreaterThanOrEqual(44);
                expect(box.width).toBeGreaterThanOrEqual(44);
            }
        });
    });
}

test.describe('/GPT/ redirect shell without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('its continue link is a 44px touch target', async ({ page }) => {
        // The shell's meta refresh would move on to the homepage. A 204 answers that
        // navigation with no content, so the browser keeps the shell on screen.
        await page.route((url) => url.pathname === '/', (route) => route.fulfill({ status: 204 }));
        for (const [width, height] of [[375, 667], [844, 390]]) {
            await page.setViewportSize({ width, height });
            await page.goto('/GPT/');
            const link = page.getByRole('link', { name: 'Continue to Rad Dad', exact: true });
            const box = await link.boundingBox();
            expect(box.height).toBeGreaterThanOrEqual(44);
            expect(box.width).toBeGreaterThanOrEqual(44);
        }
    });
});

for (const width of [320, 375, 390, 844]) {
    test(`site navigation text is at least 12px and still fits at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto('/qr/');
        const nav = page.getByRole('navigation', { name: 'Primary navigation', exact: true });
        for (const link of await nav.getByRole('link').all()) {
            const fontSize = parseFloat(await link.evaluate((el) => getComputedStyle(el).fontSize));
            expect(fontSize).toBeGreaterThanOrEqual(12);
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    });
}

for (const width of [320, 390, 1280]) {
    for (const path of ['/', '/qr/']) {
        test(`${path} video captions are at least 12px and cards still fit at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: 800 });
            await page.goto(path);
            const cards = page.locator('.video-card:visible');
            await expect(cards).toHaveCount(5);
            for (const card of await cards.all()) {
                const label = card.locator('.video-card__label');
                const destination = card.locator('figcaption > span:last-child');
                await expect(label).toBeVisible();
                await expect(destination).toBeVisible();
                await expect(destination).toHaveText(/Watch (here|on YouTube)/);
                for (const caption of [label, destination]) {
                    const fontSize = parseFloat(await caption.evaluate((el) => getComputedStyle(el).fontSize));
                    expect(fontSize, await caption.innerText()).toBeGreaterThanOrEqual(12);
                }
                expect(await card.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        });
    }
}

for (const path of ['/', '/qr/']) {
    test(`${path} announces in-page watch cards and new tabs for every visible external link`, async ({ page }) => {
        await page.goto(path);
        const external = page.locator('a[target="_blank"]:visible');
        const count = await external.count();
        expect(count).toBeGreaterThan(0);
        for (let index = 0; index < count; index += 1) {
            const link = external.nth(index);
            const href = await link.getAttribute('href');
            if (STORY_OF_US_LINK.test(href)) continue;
            if (await link.getAttribute('data-inline-video') !== null) {
                await expect(link).toHaveAccessibleName(/^Watch Rad Dad perform .+ here \(opens video player\)$/);
                await expect(link).not.toHaveAccessibleName(/opens in a new tab/);
                await expect(link).toHaveAttribute('aria-haspopup', 'dialog');
                continue;
            }
            await expect(link).toHaveAccessibleName(/\(opens in a new tab\)/);
        }
    });
}

for (const path of ['/', '/qr/']) {
    test(`${path} watch-card names match pointer and keyboard in-page activation`, async ({ page, context }) => {
        await page.goto(path);
        const originalUrl = page.url();
        const cards = page.locator('[data-inline-video]');
        const dialog = page.getByRole('dialog');
        await expect(cards).toHaveCount(3);
        const openedPages = [];
        context.on('page', popup => openedPages.push(popup));
        for (const card of await cards.all()) {
            // Accessible names use source text; innerText includes CSS uppercase styling.
            const title = (await card.locator('figcaption strong').textContent()).trim();
            const videoId = new URL(await card.getAttribute('href')).searchParams.get('v');
            await expect(card).toHaveAccessibleName(`Watch Rad Dad perform ${title} here (opens video player)`);
            for (const activation of ['pointer', 'keyboard']) {
                if (activation === 'pointer') await card.click();
                else {
                    await card.focus();
                    await page.keyboard.press('Enter');
                }
                await expect(dialog).toBeVisible();
                await expect(dialog.locator('#live-video-title')).toHaveText(title);
                await expect(dialog.locator('[data-video-frame]')).toHaveAttribute('src', `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`);
                await page.keyboard.press('Escape');
                await expect(dialog).toBeHidden();
                await expect(card).toBeFocused();
            }
        }
        expect(openedPages).toHaveLength(0);
        await expect(page).toHaveURL(originalUrl);
    });

    test(`${path} featured and Linoleum watch cards open their exact YouTube links in new tabs`, async ({ page, context }) => {
        // Fulfill popup navigation locally; this does not exercise YouTube.
        await context.route('https://www.youtube.com/watch?*', route => route.fulfill({
            contentType: 'text/html', body: '<!doctype html><title>Offline YouTube destination</title>'
        }));
        await page.goto(path);
        const cards = page.locator('.video-card:not([data-inline-video])');
        await expect(cards).toHaveCount(2);
        for (const [index, videoId] of ['4ReFoSZHL7o', 'e9mR2sgnJ00'].entries()) {
            const card = cards.nth(index);
            const destination = `https://www.youtube.com/watch?v=${videoId}`;
            await expect(card).toHaveAccessibleName(/on YouTube \(opens in a new tab\)$/);
            await expect(card).toHaveAttribute('href', destination);
            await expect(card).toHaveAttribute('target', '_blank');
            const popupPromise = context.waitForEvent('page');
            await card.click();
            const popup = await popupPromise;
            await expect(popup).toHaveURL(destination);
            await expect(page.locator('#live-video-dialog')).toBeHidden();
            await popup.close();
        }
    });
}
