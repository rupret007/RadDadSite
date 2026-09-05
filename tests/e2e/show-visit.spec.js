const { test, expect } = require('./fixtures');

const BEFORE = '2026-09-10T12:00:00-05:00';
const LIVE = '2026-09-19T21:59:59-05:00';
const END = '2026-09-19T22:00:00-05:00';
const DIRECTIONS = 'https://maps.app.goo.gl/Gr79GmmXAxMH5SkP6';
const VENUE = 'https://guitarsandgrowlers.com/locations';
const surfaces = [
    { path: '/', section: '#show', archive: '#watch' },
    { path: '/qr/', section: '#next-show', archive: '#wildflower' }
];

async function expectFits(page, visit) {
    const dimensions = await page.evaluate(() => ({
        body: document.body.scrollWidth,
        document: document.documentElement.scrollWidth,
        viewport: innerWidth
    }));
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
    for (const control of [visit, visit.locator('summary'), ...await visit.getByRole('link').all()]) {
        const bounds = await control.boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(dimensions.viewport + 1);
    }
}

for (const surface of surfaces) {
    test(`${surface.path} fans can find the venue by keyboard on small phones without contacting it`, async ({ page }) => {
        await page.clock.setFixedTime(new Date(BEFORE));
        const venueRequests = [];
        page.on('request', (request) => {
            if (/maps\.app\.goo\.gl|guitarsandgrowlers\.com/.test(request.url())) venueRequests.push(request.url());
        });
        await page.goto(surface.path);
        const visit = page.locator(`${surface.section} details[data-show-visit]`);
        const summary = visit.locator('summary');
        const directions = visit.getByRole('link', { name: 'Get directions', exact: true });
        const venue = visit.getByRole('link', { name: 'Venue information', exact: true });
        await expect(visit).toHaveCount(1);
        await expect(summary).toHaveText('Plan your visit');
        await expect(directions).toBeHidden();

        for (const width of [320, 390]) {
            await page.setViewportSize({ width, height: 844 });
            await summary.focus();
            await page.keyboard.press('Enter');
            await expect(visit).toHaveAttribute('open', '');
            await expect(visit).toContainText('581 W Campbell Rd Suite 101');
            await expect(visit).toContainText('Richardson, TX 75080');
            await expect(visit).toContainText('7–10 PM Central (CDT)');
            await expect(directions).toBeVisible();
            await expect(directions).toHaveAttribute('href', DIRECTIONS);
            await page.keyboard.press('Tab');
            await expect(directions).toBeFocused();
            await page.keyboard.press('Tab');
            await expect(venue).toBeFocused();
            await expect(venue).toHaveAttribute('href', VENUE);
            await expectFits(page, visit);
            await summary.focus();
            await page.keyboard.press('Enter');
            await expect(directions).toBeHidden();
        }
        expect(venueRequests, 'Reading venue details does not open a provider').toEqual([]);
    });

    test(`${surface.path} keeps arrival directions useful until the show ends and preserves the open archive`, async ({ page }) => {
        await page.clock.setFixedTime(new Date(BEFORE));
        await page.goto(surface.path);
        const section = page.locator(surface.section);
        const visit = section.locator('[data-show-visit]');
        const directions = visit.locator('[data-show-visit-directions]');
        await visit.locator('summary').click();
        for (const [time, label] of [
            [BEFORE, 'Add to Calendar'],
            ['2026-09-19T12:00:00-05:00', 'Get Directions'],
            [LIVE, 'See the running order']
        ]) {
            await page.evaluate((at) => window.RadDadShowState.apply(document, Date.parse(at)), time);
            await expect(directions).toBeVisible();
            await expect(directions).toHaveAttribute('href', DIRECTIONS);
            await expect(section.locator('[data-show-primary-action]')).toHaveAttribute('aria-label', label);
            await expect(visit.locator('summary')).toHaveText('Plan your visit');
            await expect(visit).toHaveAttribute('open', '');
        }
        await directions.focus();
        await page.evaluate((at) => window.RadDadShowState.apply(document, Date.parse(at)), END);
        await expect(visit.locator('summary')).toHaveText('Venue details');
        await expect(visit.locator('summary')).toBeFocused();
        await expect(directions).toBeHidden();
        await expect(visit).toHaveAttribute('open', '');
        await expect(visit).toContainText('581 W Campbell Rd Suite 101');
        await expect(visit).toContainText('September 19, 2026');
        await expect(visit.getByRole('link', { name: 'Venue information', exact: true })).toBeVisible();
        await expect(section.locator('[data-show-primary-action]')).toHaveAttribute('href', surface.archive);
        await expect(visit.locator('[download], [href$=".ics"]')).toHaveCount(0);
    });

    test(`${surface.path} returning to a stale tab immediately refreshes venue, primary action, and show status`, async ({ page }) => {
        await page.clock.setFixedTime(new Date(LIVE));
        await page.goto(surface.path);
        const visit = page.locator(`${surface.section} [data-show-visit]`);
        await visit.locator('summary').click();
        for (const event of ['pageshow', 'visibilitychange']) {
            await page.clock.setFixedTime(new Date(LIVE));
            await page.evaluate(() => window.RadDadShowState.apply(document));
            await expect(visit.locator('[data-show-visit-directions]')).toBeVisible();
            await page.clock.setFixedTime(new Date(END));
            const state = await page.evaluate(({ event, section }) => {
                const target = event === 'pageshow' ? window : document;
                target.dispatchEvent(new Event(event));
                const panel = document.querySelector(section);
                return {
                    phase: document.documentElement.dataset.showPhase,
                    title: panel.querySelector('[data-show-visit-title]').textContent,
                    directionsHidden: panel.querySelector('[data-show-visit-directions]').hidden,
                    status: panel.querySelector('[data-show-status]').textContent,
                    primary: panel.querySelector('[data-show-primary-action]').getAttribute('href'),
                    open: panel.querySelector('[data-show-visit]').open
                };
            }, { event, section: surface.section });
            expect(state).toEqual({
                phase: 'complete', title: 'Venue details', directionsHidden: true,
                status: 'Show complete', primary: surface.archive, open: true
            });
        }
    });
}

test.describe('venue planning without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    for (const surface of surfaces) {
        test(`${surface.path} retains the native disclosure and ordinary venue links`, async ({ page }) => {
            await page.setViewportSize({ width: 320, height: 844 });
            await page.goto(surface.path);
            const visit = page.locator(`${surface.section} details[data-show-visit]`);
            const summary = visit.locator('summary');
            await summary.focus();
            await page.keyboard.press('Enter');
            await expect(visit).toHaveAttribute('open', '');
            await expect(visit).toContainText('581 W Campbell Rd Suite 101');
            await expect(visit).toContainText('Richardson, TX 75080');
            for (const [name, href] of [['Get directions', DIRECTIONS], ['Venue information', VENUE]]) {
                const link = visit.getByRole('link', { name, exact: true });
                await expect(link).toBeVisible();
                await expect(link).toHaveAttribute('href', href);
                await expect(link).toHaveAttribute('target', '_blank');
                await expect(link).toHaveAttribute('rel', /noopener/);
            }
            await expect(visit).toContainText(/new tab/i);
            await expectFits(page, visit);
        });
    }
});
