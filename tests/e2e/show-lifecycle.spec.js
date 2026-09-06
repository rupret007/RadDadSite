const { test, expect } = require('./fixtures');

const PUBLIC_BOARD = 'https://rad-dad-show-night.jeffstory007.chatgpt.site/#official-sets';
const DIRECTIONS = 'https://maps.app.goo.gl/Gr79GmmXAxMH5SkP6';

async function applyAt(page, isoTime) {
    return page.evaluate((timestamp) => (
        window.RadDadShowState.apply(document, Date.parse(timestamp))
    ), isoTime);
}

async function expectNoHorizontalOverflow(page) {
    const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        viewport: window.innerWidth
    }));

    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('homepage gives fans one useful action through the full show lifecycle', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const moment = page.locator('#show [data-show-moment]');
    const action = moment.locator('[data-show-primary-action]');
    const calendarActions = page.locator('[data-show-calendar]');
    const directionActions = page.locator('[data-show-directions]');
    const showCard = page.locator('[data-show-card]');

    const phases = [
        {
            at: '2026-09-10T12:00:00-05:00',
            phase: 'upcoming',
            status: 'Next show',
            label: 'Add to Calendar',
            href: 'assets/rad-dad-friends-guitars-growlers-2026.ics',
            calendarsVisible: true,
            directionsVisible: true
        },
        {
            at: '2026-09-19T12:00:00-05:00',
            phase: 'tonight',
            status: 'Tonight',
            label: 'Get Directions',
            href: DIRECTIONS,
            calendarsVisible: true,
            directionsVisible: true
        },
        {
            at: '2026-09-19T20:00:00-05:00',
            phase: 'live',
            status: 'Live now',
            label: 'See the running order',
            href: PUBLIC_BOARD,
            calendarsVisible: false,
            directionsVisible: true
        },
        {
            at: '2026-09-20T12:00:00-05:00',
            phase: 'complete',
            status: 'Show complete',
            label: 'Watch Rad Dad live',
            href: '#watch',
            calendarsVisible: false,
            directionsVisible: false
        }
    ];

    for (const expected of phases) {
        const state = await applyAt(page, expected.at);

        expect(state.phase).toBe(expected.phase);
        await expect(page.locator('html')).toHaveAttribute('data-show-phase', expected.phase);
        await expect(moment.getByRole('status')).toContainText(expected.status);
        await expect(action).toHaveAttribute('aria-label', expected.label);
        await expect(action).toHaveAttribute('href', expected.href);

        for (const calendar of await calendarActions.all()) {
            await expect(calendar)[expected.calendarsVisible ? 'toBeVisible' : 'toBeHidden']();
        }
        for (const directions of await directionActions.all()) {
            await expect(directions)[expected.directionsVisible ? 'toBeVisible' : 'toBeHidden']();
        }

        await expectNoHorizontalOverflow(page);
    }

    await expect(showCard).toHaveClass(/show-card--past/);
    await expect(showCard).not.toHaveClass(/show-card--featured/);
    await expect(page.locator('#shows [data-show-history-intro]')).toContainText('now in the archive');
    await expect(page.locator('#watch-title')).toHaveText('Watch Rad Dad live');
    await expect(page.locator('[data-show-watch-lede]')).toHaveText(
        'The Wildflower tapes and The Story Of Us stay on this page.'
    );
});

test('QR surface follows the same lifecycle without duplicating show truth', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/qr/');

    const moment = page.locator('#next-show [data-show-moment]');
    const action = moment.locator('[data-show-primary-action]');
    const strip = page.locator('.next-show-strip');

    await applyAt(page, '2026-09-10T12:00:00-05:00');
    await expect(strip).toHaveAttribute('href', '#next-show');
    await expect(strip.locator('[data-show-strip-label]')).toHaveText('Show details');
    await expect(strip).not.toHaveAttribute('target', '_blank');

    await applyAt(page, '2026-09-19T12:00:00-05:00');
    await expect(strip.locator('[data-show-status]')).toHaveText('Tonight');
    await expect(strip).toHaveAttribute('href', '#next-show');
    await expect(strip.locator('[data-show-strip-label]')).toHaveText('Show details');
    await expect(action).toHaveAttribute('href', DIRECTIONS);
    await expect(action).toHaveAttribute('aria-label', 'Get Directions');

    await applyAt(page, '2026-09-19T20:00:00-05:00');
    await expect(strip.locator('[data-show-status]')).toHaveText('Live now');
    await expect(moment.getByRole('status')).toContainText('Happening now');
    await expect(action).toHaveAttribute('href', PUBLIC_BOARD);
    await expect(action).toHaveAttribute('aria-label', 'See the running order');
    await expect(strip).toHaveAttribute('href', PUBLIC_BOARD);
    await expect(strip).toHaveAttribute('target', '_blank');
    await expect(strip).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(strip.locator('[data-show-strip-label]')).toHaveText('See the running order');
    await expect(strip).not.toHaveAttribute('aria-label');
    await expect(strip.locator('[data-show-strip-label]')).toHaveCSS('font-size', '0px');
    await expect(strip.locator('.next-show-strip__venue')).toHaveText('Guitars & Growlers');
    await expect(page.locator('#next-show [data-show-calendar]')).toHaveCount(0);
    await expect(page.locator('#next-show [data-show-directions]')).toHaveCount(0);

    await applyAt(page, '2026-09-20T12:00:00-05:00');
    await expect(strip.locator('[data-show-status]')).toHaveText('Show complete');
    await expect(action).toHaveAttribute('href', '#wildflower');
    await expect(action).toHaveAttribute('aria-label', 'Watch Rad Dad live');
    await expect(strip).toHaveAttribute('href', '#wildflower');
    await expect(strip).not.toHaveAttribute('target', '_blank');
    await expect(strip.locator('[data-show-strip-label]')).toHaveText('Watch Rad Dad live');
    await expect(strip.locator('[data-show-strip-label]')).toHaveCSS('font-size', '0px');
    await expect(strip.locator('.next-show-strip__venue')).toHaveText('Guitars & Growlers');
    await expect(page.locator('#join-show [data-show-reference-prefix]')).toHaveText('That show was at');
    await expect(page.locator('#next-show [data-show-section-kicker]')).toHaveText('From the show');
    await expectNoHorizontalOverflow(page);
});

test('after the show the QR strip lands on the Wildflower tapes', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/qr/');
    await applyAt(page, '2026-09-20T12:00:00-05:00');

    const strip = page.locator('.next-show-strip');
    await expect(strip).toHaveAttribute('href', '#wildflower');
    await strip.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#wildflower$/);
    await expect(page.locator('#wildflower')).toBeInViewport();
    await expect(page.locator('#wildflower')).toBeFocused();
});

test('QR strip keeps its no-JavaScript show-panel fallback', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
        delete window.RadDadShowState;
    });
    await page.route('**/show-state.js*', (route) => route.abort());
    await page.goto('/qr/', { waitUntil: 'domcontentloaded' });

    const strip = page.locator('.next-show-strip');
    await expect(strip).toHaveAttribute('href', '#next-show');
    await expect(strip.locator('[data-show-strip-label]')).toHaveText('Show details');
    await expect(strip).not.toHaveAttribute('target', '_blank');
    await expectNoHorizontalOverflow(page);
});
