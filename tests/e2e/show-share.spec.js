const { test, expect } = require('./fixtures');

const SHOW_URL = 'https://raddadband.com/#show';
const BEFORE = '2026-09-10T12:00:00-05:00';
const ENDED = '2026-09-19T22:00:00-05:00';

async function capabilities(page, { native = 'success', clipboard = 'success' } = {}) {
    await page.addInitScript(({ native, clipboard }) => {
        window.__shareProbe = { shares: [], copies: [], activations: [] };
        Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
        Object.defineProperty(navigator, 'share', {
            configurable: true,
            value: native === 'missing' ? undefined : (payload) => {
                window.__shareProbe.shares.push(payload);
                window.__shareProbe.activations.push(navigator.userActivation.isActive);
                if (native === 'cancel') return Promise.reject(new DOMException('Synthetic cancellation', 'AbortError'));
                if (native === 'reject') return Promise.reject(new Error('Synthetic provider-private detail'));
                if (native === 'pending') return new Promise((resolve) => { window.__shareProbe.finish = resolve; });
                return Promise.resolve();
            }
        });
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: clipboard === 'missing' ? undefined : {
                writeText(text) {
                    window.__shareProbe.copies.push(text);
                    return clipboard === 'reject'
                        ? Promise.reject(new DOMException('Synthetic clipboard rejection', 'NotAllowedError'))
                        : Promise.resolve();
                }
            }
        });
    }, { native, clipboard });
    await page.clock.setFixedTime(new Date(BEFORE));
}

function widget(page) {
    return page.locator('[data-show-share]');
}

async function assertFits(page, container) {
    const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        viewport: innerWidth
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
    expect(dimensions.body).toBeLessThanOrEqual(dimensions.viewport + 1);
    const bounds = await container.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(dimensions.viewport + 1);
    for (const button of await container.getByRole('button').all()) {
        if (await button.isVisible()) expect((await button.boundingBox()).height).toBeGreaterThanOrEqual(44);
    }
}

test('both fan pages share the same complete canonical show, never the preview or tracking URL', async ({ page }) => {
    await capabilities(page);
    const payloads = [];
    for (const path of ['/', '/qr/']) {
        await page.goto(`${path}?utm_source=synthetic-sticker&token=fixture-private#owner-fixture`);
        const container = widget(page);
        await expect(container).toHaveCount(1);
        await expect(container.locator('[data-show-share-action]')).toHaveText('Share show details');
        expect(await page.evaluate(() => window.__shareProbe.shares)).toEqual([]);
        expect(await page.evaluate(() => window.__shareProbe.copies)).toEqual([]);
        await container.locator('[data-show-share-action]').click();
        await expect(container.getByRole('status')).toContainText('Share options closed');
        const probe = await page.evaluate(() => window.__shareProbe);
        expect(probe.shares).toHaveLength(1);
        expect(probe.copies).toEqual([]);
        expect(probe.activations).toEqual([true]);
        const payload = probe.shares[0];
        expect(Object.keys(payload).sort()).toEqual(['text', 'title', 'url']);
        expect(payload.title).toBe('Rad Dad + Friends with The Fault Lines');
        expect(payload.url).toBe(SHOW_URL);
        for (const fact of ['Saturday, September 19, 2026', '7–10 PM Central (CDT)', 'Guitars & Growlers', '581 W Campbell Rd Suite 101', 'Richardson, TX 75080', 'Free']) {
            expect(payload.text).toContain(fact);
        }
        expect(JSON.stringify(payload)).not.toMatch(/127\.0\.0\.1|utm_|token=|fixture-private|owner-fixture|show-control/);
        payloads.push(payload);
    }
    expect(payloads[0]).toEqual(payloads[1]);
});

for (const path of ['/', '/qr/']) {
    test(`${path} cancellation never silently copies or claims delivery`, async ({ page }) => {
        await capabilities(page, { native: 'cancel' });
        await page.goto(path);
        const container = widget(page);
        await container.locator('[data-show-share-action]').click();
        await expect(container.getByRole('status')).toContainText('Sharing cancelled');
        await expect(container.locator('[data-show-share-action]')).toBeEnabled();
        await expect(container.locator('[data-show-share-fallback]')).toBeVisible();
        expect(await page.evaluate(() => window.__shareProbe.copies)).toEqual([]);
        await expect(container.getByRole('status')).not.toHaveText(/^(Sent|Delivered|Shared|Copied)\b/i);
        await expect(container.locator('[data-show-share-action]')).toBeFocused();
        await container.getByRole('button', { name: 'Copy details', exact: true }).click();
        await expect(container.getByRole('status')).toContainText('Show details copied');
        expect(await page.evaluate(() => window.__shareProbe.copies.length)).toBe(1);
    });

    test(`${path} failed native sharing offers one explicit copy without echoing provider details`, async ({ page }) => {
        await capabilities(page, { native: 'reject' });
        await page.goto(path);
        const container = widget(page);
        await container.locator('[data-show-share-action]').click();
        await expect(container.locator('[data-show-share-fallback]')).toBeVisible();
        await expect(container.getByRole('status')).toContainText('Sharing is unavailable');
        await expect(container.getByRole('status')).not.toContainText('provider-private');
        expect(await page.evaluate(() => window.__shareProbe.copies)).toEqual([]);
        await container.getByRole('button', { name: 'Copy details', exact: true }).click();
        await expect(container.getByRole('status')).toContainText('Show details copied');
        const copied = await page.evaluate(() => window.__shareProbe.copies);
        expect(copied).toHaveLength(1);
        expect(copied[0]).toBe(await container.getByLabel('Show details to copy').inputValue());
        expect(copied[0]).toMatch(/https:\/\/raddadband\.com\/#show$/);
    });

    test(`${path} unsupported native sharing copies only after a click`, async ({ page }) => {
        await capabilities(page, { native: 'missing' });
        await page.goto(path);
        const container = widget(page);
        expect(await page.evaluate(() => window.__shareProbe.copies)).toEqual([]);
        await container.getByRole('button', { name: 'Copy show details', exact: true }).click();
        await expect(container.getByRole('status')).toContainText('Show details copied');
        const probe = await page.evaluate(() => window.__shareProbe);
        expect(probe.shares).toEqual([]);
        expect(probe.copies).toHaveLength(1);
    });

    for (const [width, clipboard] of [[320, 'missing'], [390, 'reject']]) {
        test(`${path} ${width}px clipboard ${clipboard} leaves full selectable details`, async ({ page }) => {
            await page.setViewportSize({ width, height: 844 });
            await capabilities(page, { native: 'missing', clipboard });
            await page.goto(path);
            const container = widget(page);
            await container.locator('[data-show-share-action]').click();
            const text = container.getByLabel('Show details to copy');
            await expect(text).toBeVisible();
            await expect(text).toHaveAttribute('readonly', '');
            await expect(container.getByRole('status')).toContainText('Automatic copy is unavailable');
            await container.getByRole('button', { name: 'Select details', exact: true }).click();
            await expect(text).toBeFocused();
            const selection = await text.evaluate((field) => ({ start: field.selectionStart, end: field.selectionEnd, value: field.value }));
            expect(selection.start).toBe(0);
            expect(selection.end).toBe(selection.value.length);
            expect(selection.value).toContain('581 W Campbell Rd Suite 101');
            expect(selection.value).toContain(SHOW_URL);
            await expect(container.getByRole('status')).not.toHaveText(/^(Copied|Sent|Delivered)\b/i);
            await assertFits(page, container);
        });
    }
}

test('a tab left open shares current show timing on each gesture, including the past-show boundary', async ({ page }) => {
    await capabilities(page);
    await page.goto('/qr/');
    const container = widget(page);
    for (const [time, expected] of [
        [BEFORE, /Join us for a free show/],
        ['2026-09-19T12:00:00-05:00', /Tonight/],
        ['2026-09-19T19:00:00-05:00', /Happening now/],
        [ENDED, /Past show/]
    ]) {
        await page.clock.setFixedTime(new Date(time));
        await container.locator('[data-show-share-action]').click();
        await expect(container.getByRole('status')).toContainText('Share options closed');
        const latest = await page.evaluate(() => window.__shareProbe.shares.at(-1));
        expect(latest.text).toMatch(expected);
        if (time === ENDED) expect(latest.text).not.toMatch(/Join us|Tonight|Happening now/);
    }
    await expect(container.locator('[data-show-share-action]')).toHaveText('Share past show details');
});

test('pending native sharing is single-flight and a late completion cannot claim current timing', async ({ page }) => {
    await capabilities(page, { native: 'pending' });
    await page.clock.setFixedTime(new Date('2026-09-19T21:59:59-05:00'));
    await page.goto('/');
    const container = widget(page);
    const action = container.locator('[data-show-share-action]');
    await action.click();
    await expect(action).toBeDisabled();
    await action.evaluate((button) => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(await page.evaluate(() => window.__shareProbe.shares.length)).toBe(1);
    await page.clock.setFixedTime(new Date(ENDED));
    await page.evaluate(() => window.__shareProbe.finish());
    await expect(action).toBeEnabled();
    await expect(container.getByRole('status')).toContainText('Show timing changed');
    await expect(container.getByLabel('Show details to copy')).toHaveValue(/Past show/);
    expect(await page.evaluate(() => window.__shareProbe.copies)).toEqual([]);
});

test.describe('sharing without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    for (const path of ['/', '/qr/']) {
        test(`${path} retains the canonical show link with no dead share button`, async ({ page }) => {
            await page.goto(path);
            const container = widget(page);
            await expect(container.locator('[data-show-share-action]')).toBeHidden();
            await expect(container.locator('[data-show-share-fallback]')).toBeHidden();
            await expect(container.getByRole('link', { name: 'raddadband.com/#show' })).toBeVisible();
            await expect(container.getByRole('link', { name: 'raddadband.com/#show' })).toHaveAttribute('href', SHOW_URL);
        });
    }
});
