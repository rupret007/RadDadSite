const { test, expect } = require('./fixtures');

const EMBED_PATTERN = '**/www.youtube-nocookie.com/embed/**';
const FIRST_VIDEO = '9Re_0wjIbfQ';

function player(page) {
    const dialog = page.locator('#live-video-dialog');
    return {
        dialog,
        frame: dialog.locator('[data-video-frame]'),
        status: dialog.locator('[data-video-status]'),
        retry: dialog.getByRole('button', { name: 'Try again', exact: true }),
        close: dialog.getByRole('button', { name: 'Close video player' }),
        fallback: dialog.getByRole('link', { name: /Watch on YouTube/ })
    };
}

// These requests never leave the browser fixture. A pending response models a
// genuinely stalled navigation; a fulfilled frame still does not prove playback.
async function stallEmbeds(page) {
    const attempts = [];
    await page.route(EMBED_PATTERN, route => { attempts.push(route); });
    return attempts;
}

async function stopPending(attempts) {
    for (const route of attempts) await route.abort('blockedbyclient').catch(() => {});
}

for (const path of ['/', '/qr/']) {
    for (const state of ['opening', 'loaded']) {
        test(`${path} leaving the ${state} player retires it before history return`, async ({ page }) => {
            const attempts = [];
            await page.route(EMBED_PATTERN, async route => {
                attempts.push(route);
                if (state === 'loaded') {
                    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Offline player</title>' });
                }
            });
            try {
                await page.goto(path);
                const controls = player(page);
                await page.locator('[data-inline-video]').first().click();
                await expect.poll(() => attempts.length).toBe(1);
                if (state === 'loaded') await expect(controls.retry).toBeEnabled();

                // Observe the real navigation event after the product listener,
                // so this also checks cleanup when Chromium does not use bfcache.
                await page.evaluate(() => {
                    window.addEventListener('pagehide', () => {
                        const dialog = document.querySelector('#live-video-dialog');
                        sessionStorage.setItem('test-video-page-exit', JSON.stringify({
                            open: dialog.open,
                            src: dialog.querySelector('[data-video-frame]').getAttribute('src'),
                            locked: document.documentElement.classList.contains('has-video-dialog'),
                            status: dialog.querySelector('[data-video-status]').textContent,
                            retryDisabled: dialog.querySelector('[data-video-retry]').disabled
                        }));
                    }, { once: true });
                });
                await page.goto(path === '/' ? '/qr/' : '/');
                expect(await page.evaluate(() => JSON.parse(sessionStorage.getItem('test-video-page-exit')))).toEqual({
                    open: false, src: null, locked: false, status: '', retryDisabled: true
                });

                await page.goBack();
                await expect(controls.dialog).toBeHidden();
                await expect(controls.frame).not.toHaveAttribute('src', /.+/);
                await expect(controls.status).toHaveText('');
                await expect(controls.dialog.locator('[data-video-retry]')).toBeDisabled();
                await expect(page.locator('html')).not.toHaveClass(/has-video-dialog/);
                expect(attempts).toHaveLength(1);

                const nextCard = page.locator('[data-inline-video]').nth(1);
                await nextCard.click();
                await expect(controls.dialog).toBeVisible();
                await expect(controls.frame).toHaveAttribute('src', /\/embed\/GCy4nHIqV5k\?/);
                await expect.poll(() => attempts.length).toBe(2);
                await controls.close.click();
                await expect(nextCard).toBeFocused();
                await expect(controls.frame).not.toHaveAttribute('src', /.+/);
            } finally {
                if (state === 'opening') await stopPending(attempts);
            }
        });
    }

    test(`${path} stalled inline playback offers one manual retry, never an automatic loop`, async ({ page }) => {
        await page.clock.install({ time: new Date('2026-09-10T12:00:00-05:00') });
        const attempts = await stallEmbeds(page);
        try {
            await page.goto(path);
            const controls = player(page);
            expect(attempts).toHaveLength(0);
            await expect(controls.frame).not.toHaveAttribute('src', /.+/);
            await page.locator('[data-inline-video]').first().click();
            await expect.poll(() => attempts.length).toBe(1);
            await expect(controls.retry).toBeDisabled();
            await expect(controls.status).toContainText('Opening');
            await page.evaluate(() => { window.__oldVideoFrame = document.querySelector('[data-video-frame]'); });

            await page.clock.fastForward(10_001);
            await expect(controls.retry).toBeEnabled();
            await expect(controls.status).toContainText('taking longer');
            await expect(controls.fallback).toHaveAttribute('href', `https://www.youtube.com/watch?v=${FIRST_VIDEO}`);
            await page.clock.fastForward(30_000);
            expect(attempts).toHaveLength(1);

            await controls.retry.focus();
            await page.keyboard.press('Enter');
            await expect.poll(() => attempts.length).toBe(2);
            await expect(controls.retry).toBeDisabled();
            expect(await page.evaluate(() => window.__oldVideoFrame !== document.querySelector('[data-video-frame]'))).toBe(true);
            await page.evaluate(() => {
                window.__oldVideoFrame.dispatchEvent(new Event('load'));
                window.__oldVideoFrame.dispatchEvent(new Event('error'));
            });
            await expect(controls.status).toContainText('Opening');
            await expect(controls.retry).toBeDisabled();

            await controls.close.click();
            await expect(controls.dialog).toBeHidden();
            await expect(controls.frame).not.toHaveAttribute('src', /.+/);
            await page.clock.fastForward(30_000);
            expect(attempts).toHaveLength(2);
            await expect(controls.status).toHaveText('');
            await expect(page.locator('[data-inline-video]').first()).toBeFocused();
        } finally {
            await stopPending(attempts);
        }
    });

    test(`${path} a loaded error document is not called playing and YouTube handoff stops inline audio`, async ({ page }) => {
        let count = 0;
        await page.route(EMBED_PATTERN, async route => {
            count += 1;
            await route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Offline unavailable frame</title><p>This fixture cannot play video.</p>' });
        });
        await page.goto(path);
        const controls = player(page);
        await page.locator('[data-inline-video]').first().click();
        await expect(controls.retry).toBeEnabled();
        await expect(controls.status).toContainText('controls');
        await expect(controls.status).not.toHaveText(/^(Playing|Playback started|Video ready|Successfully loaded)/i);
        expect(count).toBe(1);

        // Inspect native link semantics but suppress the external navigation:
        // no provider request, popup or real playback occurs in this fixture.
        await controls.fallback.evaluate(link => {
            link.addEventListener('click', event => {
                window.__modifiedPrevented = event.defaultPrevented;
                event.preventDefault();
            }, { once: true });
        });
        await controls.fallback.dispatchEvent('click', { button: 0, metaKey: true, bubbles: true, cancelable: true });
        expect(await page.evaluate(() => window.__modifiedPrevented)).toBe(false);
        await expect(controls.dialog).toBeVisible();
        await expect(controls.frame).toHaveAttribute('src', new RegExp(FIRST_VIDEO));

        await controls.fallback.evaluate(link => {
            link.addEventListener('click', event => {
                window.__handoffPrevented = event.defaultPrevented;
                window.__handoffUrl = link.href;
                event.preventDefault();
            }, { once: true });
        });
        await controls.fallback.focus();
        await page.keyboard.press('Enter');
        expect(await page.evaluate(() => window.__handoffPrevented)).toBe(false);
        expect(await page.evaluate(() => window.__handoffUrl)).toBe(`https://www.youtube.com/watch?v=${FIRST_VIDEO}`);
        await expect(controls.dialog).toBeHidden();
        await expect(controls.frame).not.toHaveAttribute('src', /.+/);
        await expect(page.locator('[data-inline-video]').first()).toBeFocused();
        expect(count).toBe(1);
    });

    test(`${path} failed frame recovery stays usable on phone and clears on Escape`, async ({ page }, testInfo) => {
        const attempts = await stallEmbeds(page);
        try {
            for (const width of [320, 390, 1280]) {
                await page.setViewportSize({ width, height: 844 });
                await page.goto(path);
                const controls = player(page);
                const card = page.locator('[data-inline-video]').first();
                await card.click();
                await controls.frame.evaluate(frame => frame.dispatchEvent(new Event('error')));
                await expect(controls.retry).toBeEnabled();
                await expect(controls.status).toContainText('could not');
                await expect(controls.status).toHaveAttribute('role', 'status');
                await expect(controls.fallback).toBeVisible();
                await expect(controls.retry).toHaveAttribute('aria-describedby', 'live-video-status');
                await controls.retry.focus();
                await expect(controls.retry).toBeFocused();

                const dimensions = await controls.dialog.evaluate(dialog => ({
                    scroll: dialog.scrollWidth, client: dialog.clientWidth,
                    right: dialog.getBoundingClientRect().right, left: dialog.getBoundingClientRect().left,
                    viewport: innerWidth, retry: dialog.querySelector('[data-video-retry]').getBoundingClientRect().height
                }));
                expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client + 1);
                expect(dimensions.left).toBeGreaterThanOrEqual(0);
                expect(dimensions.right).toBeLessThanOrEqual(dimensions.viewport + 1);
                expect(dimensions.retry).toBeGreaterThanOrEqual(44);
                const frameBounds = await controls.frame.boundingBox();
                expect(frameBounds.width).toBeCloseTo(dimensions.client, 0);
                const fallbackBounds = await controls.fallback.boundingBox();
                expect(fallbackBounds.y).toBeGreaterThanOrEqual(0);
                expect(fallbackBounds.y + fallbackBounds.height).toBeLessThanOrEqual(844);
                await page.screenshot({ path: testInfo.outputPath(`video-recovery-${width}.png`) });

                await page.keyboard.press('Escape');
                await expect(controls.dialog).toBeHidden();
                await expect(controls.frame).not.toHaveAttribute('src', /.+/);
                await expect(card).toBeFocused();
                await expect(page.locator('html')).not.toHaveClass(/has-video-dialog/);
            }
        } finally {
            await stopPending(attempts);
        }
    });

    test(`${path} no JavaScript keeps all five exact YouTube cards and no dormant player request`, async ({ browser, baseURL }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        const external = [];
        await context.route('**/*', route => {
            const url = new URL(route.request().url());
            if (url.origin === new URL(baseURL).origin) return route.continue();
            external.push(url);
            return route.abort('blockedbyclient');
        });
        try {
            await page.goto(new URL(path, baseURL).href);
            const cards = page.locator(path === '/' ? '#watch .video-card' : '#wildflower .live-card');
            await expect(cards).toHaveCount(5);
            expect(await cards.evaluateAll(links => links.map(link => new URL(link.href).searchParams.get('v')))).toEqual([
                '4ReFoSZHL7o', FIRST_VIDEO, 'GCy4nHIqV5k', 'iMrxzCQ7lVs', 'e9mR2sgnJ00'
            ]);
            expect(external.filter(url => url.hostname === 'www.youtube-nocookie.com')).toHaveLength(0);
            await expect(player(page).frame).not.toHaveAttribute('src', /.+/);
        } finally {
            await context.close();
        }
    });
}
