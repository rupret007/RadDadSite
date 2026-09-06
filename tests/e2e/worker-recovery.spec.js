const fs = require('node:fs/promises');
const path = require('node:path');
const { test, expect } = require('./fixtures');

const CALENDAR_PATH = '/assets/rad-dad-friends-guitars-growlers-2026.ics';
const FLYER_PATH = '/assets/rad-dad-friends-guitars-growlers-2026-v2-full.png';
const BEFORE_SHOW = new Date('2026-09-10T12:00:00-05:00');

// Load the exact dependency-free worker source without changing this CommonJS
// test package or copying its routing decisions into the browser fixture.
async function routeThroughWorker(context, baseURL, missingPaths = []) {
    const source = await fs.readFile(path.resolve(__dirname, '../../worker/index.js'), 'utf8');
    const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    const origin = new URL(baseURL).origin;
    const deliberatelyMissing = new Set(missingPaths);
    const requests = [];

    const assets = {
        async fetch(request) {
            const url = new URL(request.url);
            if (url.origin !== origin) {
                throw new Error(`Worker fixture refused a nonlocal asset request: ${url.origin}`);
            }
            if (deliberatelyMissing.has(url.pathname)) {
                return new Response('Missing fixture asset', { status: 404 });
            }

            // API requests bypass browser routing. The existing offline fixture
            // guards this API too; redirects remain disabled on the asset hop.
            const response = await context.request.fetch(url.href, {
                method: request.method,
                headers: Object.fromEntries(request.headers),
                data: ['GET', 'HEAD'].includes(request.method) ? undefined : Buffer.from(await request.arrayBuffer()),
                maxRedirects: 0
            });
            const headers = response.headers();
            delete headers['content-encoding'];
            delete headers['content-length'];
            delete headers['transfer-encoding'];
            return new Response(request.method === 'HEAD' ? null : await response.body(), {
                status: response.status(),
                headers
            });
        }
    };

    // Nonlocal requests fall through to the existing synthetic provider fixtures.
    await context.route(url => url.origin === origin, async route => {
        const browserRequest = route.request();
        const headers = await browserRequest.allHeaders();
        const method = browserRequest.method();
        requests.push({ url: browserRequest.url(), method, headers });
        const response = await worker.fetch(new Request(browserRequest.url(), {
            method,
            headers,
            body: ['GET', 'HEAD'].includes(method) ? undefined : browserRequest.postDataBuffer()
        }), { ASSETS: assets });
        await route.fulfill({
            status: response.status,
            headers: Object.fromEntries(response.headers),
            body: Buffer.from(await response.arrayBuffer())
        });
    });

    return { origin, requests };
}

async function expectUsableHomepage(page, origin) {
    const location = new URL(page.url());
    expect(location.origin).toBe(origin);
    expect(location.pathname).toBe('/');
    expect(location.search).toBe('');
    expect(location.hash).toBe('');
    await expect(page.locator('#show h1')).toHaveText(/Rad Dad/);
    await expect(page.locator('.hero-grid')).toHaveCSS('display', 'grid');
    const flyer = page.locator('#show .event-flyer');
    await expect(flyer).toBeVisible();
    await expect.poll(() => flyer.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
    await expect(page.locator('#show .flyer-link')).toHaveJSProperty('href', `${origin}${FLYER_PATH}`);
    const calendar = page.locator('#show [data-show-primary-action]');
    await expect(calendar).toHaveJSProperty('href', `${origin}${CALENDAR_PATH}`);
    await expect(calendar).toHaveAttribute('download', '');
    const [download] = await Promise.all([
        page.waitForEvent('download'),
        calendar.click()
    ]);
    expect(download.url()).toBe(`${origin}${CALENDAR_PATH}`);
    expect(download.suggestedFilename()).toBe(CALENDAR_PATH.split('/').pop());
    expect(await download.failure()).toBeNull();
    const calendarText = await fs.readFile(await download.path(), 'utf8');
    expect(calendarText).toContain('BEGIN:VCALENDAR');
    expect(calendarText).toContain('SUMMARY:Rad Dad + Friends with The Fault Lines');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
}

test('a stale nested link recovers to a working phone homepage without retaining private URL text', async ({ page, context, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.setFixedTime(BEFORE_SHOW);
    const { origin, requests } = await routeThroughWorker(context, baseURL);
    const response = await page.goto('/past-show/details/?token=fixture-secret#private');
    expect(response.status()).toBe(200);
    const original = response.request().redirectedFrom();
    expect(original).not.toBeNull();
    const redirect = await original.response();
    expect(redirect.status()).toBe(302);
    expect(redirect.headers()['location']).toBe(`${origin}/#`);
    expect(redirect.headers()['cache-control']).toBe('no-store');
    expect(redirect.headers()['referrer-policy']).toBe('no-referrer');
    await expectUsableHomepage(page, origin);
    await expect(page.locator('html')).toHaveAttribute('data-show-phase', 'upcoming');
    expect(await page.evaluate(() => typeof window.RadDadShowState?.apply)).toBe('function');
    const loaded = requests.filter(request => request.url !== original.url());
    expect(loaded.some(request => new URL(request.url).pathname === '/styles.css')).toBe(true);
    expect(loaded.some(request => new URL(request.url).pathname === '/show-state.js')).toBe(true);
    for (const request of loaded) {
        expect(request.url).not.toContain('fixture-secret');
        expect(request.headers.referer || '').not.toContain('fixture-secret');
    }
});

test('the direct homepage calendar download works without worker interception', async ({ page, baseURL }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.clock.setFixedTime(BEFORE_SHOW);
    await page.goto('/');
    await expectUsableHomepage(page, new URL(baseURL).origin);
});

test.describe('worker recovery without JavaScript', () => {
    test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 844 } });

    test('a stale nested HTML link retains the actual flyer and calendar download', async ({ page, context, baseURL }) => {
        const { origin } = await routeThroughWorker(context, baseURL);
        const response = await page.goto('/past-show/details.html?token=fixture-secret#private');
        expect(response.status()).toBe(200);
        await expectUsableHomepage(page, origin);
        await expect(page.locator('[data-show-share-action]')).toBeHidden();
    });
});

test('existing QR aliases still preserve their query and reach the canonical music page', async ({ page, context, baseURL }) => {
    const { origin } = await routeThroughWorker(context, baseURL);
    for (const alias of ['/tap', '/nfc/index.html', '/qr/index.html']) {
        const response = await page.goto(`${alias}?utm_source=fixture`);
        expect(response.status()).toBe(200);
        await expect(page).toHaveURL(`${origin}/qr/?utm_source=fixture`);
        await expect(page.locator('#song')).toBeVisible();
        await expect(page.locator('link[rel="stylesheet"][href^="styles.css"]')).toHaveCount(1);
    }
});

test('owner, reserved API and missing asset navigation keep their errors instead of recovering to a homepage', async ({ page, context, baseURL }) => {
    const { origin } = await routeThroughWorker(context, baseURL);
    for (const target of ['/show-control', '/SHOW-CONTROL/sets', '/api/fixture-missing', '/assets/fixture-missing.css', '/fixture-missing.js']) {
        const response = await page.goto(target);
        expect(response.status(), target).toBe(404);
        expect(response.request().redirectedFrom(), target).toBeNull();
        await expect(page).toHaveURL(`${origin}${target}`);
        await expect(page.locator('#show')).toHaveCount(0);
    }
});

test('missing canonical pages cannot create a redirect loop', async ({ page, context, baseURL }) => {
    const canonicalPaths = ['/', '/index.html', '/qr/'];
    await routeThroughWorker(context, baseURL, canonicalPaths);
    for (const target of canonicalPaths) {
        const response = await page.goto(target);
        expect(response.status(), target).toBe(404);
        expect(response.request().redirectedFrom(), target).toBeNull();
    }
});

test('posting to a missing nested path cannot become a successful homepage navigation', async ({ page, context, baseURL }) => {
    const { origin } = await routeThroughWorker(context, baseURL);
    await page.goto('/');
    const result = await page.evaluate(async () => {
        const response = await fetch('/past-show/details/', {
            method: 'POST',
            headers: { accept: 'text/html' },
            body: 'synthetic browser fixture'
        });
        return { status: response.status, redirected: response.redirected, url: response.url };
    });
    expect(result.status).toBeGreaterThanOrEqual(400);
    expect(result.redirected).toBe(false);
    expect(result.url).toBe(`${origin}/past-show/details/`);
});
