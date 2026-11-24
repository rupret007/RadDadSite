// @vitest-environment node
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { radDadAnalyticsOrigin } from '../../scripts/lib/site-analytics.mjs';

const script = readFileSync(new URL('../../site-analytics.js', import.meta.url), 'utf8');
const origin = 'https://rad-dad-test.goatcounter.com';
const windows = [];
afterEach(() => windows.splice(0).forEach(window => window.close()));

function visit({
    url = 'https://raddadband.com/?invite=private#secret',
    page = '/',
    referrer = 'https://example.org/path?secret=private#invite',
    visible = true,
    privacy = false
} = {}) {
    const { window } = new JSDOM(`
        <script data-rad-dad-analytics="${origin}/count" data-page="${page}"></script>
        <button data-analytics-action="hangout-open"><span>Open Hang Out</span></button>
        <button data-analytics-action="private-name">Unapproved event</button>
    `, { url, referrer, runScripts: 'outside-only' });
    windows.push(window);
    const { document, performance } = window;
    const sent = vi.fn().mockResolvedValue({});
    window.fetch = sent;
    Object.defineProperties(document, {
        currentScript: { value: document.querySelector('script') },
        visibilityState: { get: () => visible ? 'visible' : 'hidden' }
    });
    Object.defineProperty(window.navigator, 'globalPrivacyControl', { value: privacy });
    let time = 0;
    let timer;
    vi.spyOn(performance, 'now').mockImplementation(() => time);
    window.setTimeout = (callback, wait) => { timer = { callback, at: time + wait }; };
    window.clearTimeout = () => { timer = undefined; };
    window.eval(script);
    return {
        sent,
        document,
        advance: ms => {
            time += ms;
            if (timer && time >= timer.at) timer.callback();
        },
        setVisible: next => {
            visible = next;
            document.dispatchEvent(new window.Event('visibilitychange'));
        }
    };
}

function payloads(sent) {
    return sent.mock.calls.map(([url]) => Object.fromEntries(url.searchParams));
}

describe('Rad Dad traffic reporting', () => {
    it('requires a separate GoatCounter site code, with analytics off when unset', () => {
        expect(radDadAnalyticsOrigin(undefined)).toBe('');
        expect(radDadAnalyticsOrigin('')).toBe('');
        expect(radDadAnalyticsOrigin('rad-dad-test')).toBe(origin);
        for (const site of ['stalemate', 'a.invalid', 'https://rad-dad-test.goatcounter.com', 'test\" onerror=\"x', '-bad']) {
            expect(() => radDadAnalyticsOrigin(site)).toThrow('separate Rad Dad GoatCounter');
        }
    });

    it('counts a fixed page and one fixed click without sending URLs, identifiers or duplicate actions', () => {
        const { sent, document } = visit();
        document.querySelector('span').click();
        document.querySelector('span').click();
        document.querySelector('[data-analytics-action="private-name"]').click();
        expect(payloads(sent)).toEqual([{ p: '/', r: 'https://example.org' }, { p: 'hangout-open', e: '1' }]);
        for (const [url, options] of sent.mock.calls) {
            expect(url.origin + url.pathname).toBe(origin + '/count');
            expect(options).toMatchObject({ credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true });
        }
    });

    it('counts visible time once per milestone and pauses for hidden tabs', () => {
        const { sent, advance, setVisible } = visit({ url: 'https://raddadband.com/play/hub.html', page: '/play/', visible: false });
        expect(sent).not.toHaveBeenCalled();
        advance(600_000);
        setVisible(true);
        advance(15_000);
        setVisible(false);
        advance(600_000);
        expect(payloads(sent)).toEqual([{ p: '/play/', r: 'https://example.org' }]);
        setVisible(true);
        advance(15_000);
        advance(90_000);
        advance(180_000);
        setVisible(false);
        setVisible(true);
        advance(600_000);
        expect(payloads(sent)).toEqual([
            { p: '/play/', r: 'https://example.org' },
            { p: 'engagement-arcade-30s', e: '1' },
            { p: 'engagement-arcade-120s', e: '1' },
            { p: 'engagement-arcade-300s', e: '1' }
        ]);
    });

    it('skips previews, unapproved routes and browsers with Global Privacy Control enabled', () => {
        for (const config of [
            { url: 'https://rad-dad-design-preview.jeffstory007.chatgpt.site/' },
            { url: 'https://raddadband.com/private/example' },
            { url: 'https://raddadband.com/tap/' },
            { privacy: true }
        ]) expect(visit(config).sent).not.toHaveBeenCalled();
    });
});
