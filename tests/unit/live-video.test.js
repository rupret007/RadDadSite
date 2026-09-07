import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const scriptSource = fs.readFileSync(path.join(repoRoot, 'live-video.js'), 'utf8');

function loadPage(relativeHtml, url) {
    const rawHtml = fs.readFileSync(path.join(repoRoot, relativeHtml), 'utf8')
        .replace(/<script\b[^>]*><\/script>/gi, '');
    const dom = new JSDOM(rawHtml, {
        pretendToBeVisual: true,
        runScripts: 'dangerously',
        url
    });
    const { window } = dom;
    const dialog = window.document.querySelector('#live-video-dialog');
    const timers = new Map();
    let timerId = 0;

    window.setTimeout = vi.fn((callback, delay) => {
        const id = ++timerId;
        timers.set(id, { callback, delay });
        return id;
    });
    window.clearTimeout = vi.fn((id) => timers.delete(id));

    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => {
        dialog.removeAttribute('open');
        dialog.dispatchEvent(new window.Event('close'));
    });

    window.eval(scriptSource);

    return {
        dialog, document: window.document, window, timers,
        frame: () => dialog.querySelector('[data-video-frame]'),
        retry: () => dialog.querySelector('[data-video-retry]'),
        status: () => dialog.querySelector('[data-video-status]').textContent,
        expire() {
            for (const [id, timer] of [...timers]) {
                timers.delete(id);
                timer.callback();
            }
        }
    };
}

function click(window, element, options = {}) {
    const event = new window.MouseEvent('click', { bubbles: true, button: 0, cancelable: true, ...options });
    element.dispatchEvent(event);
    return event;
}

const PAGES = [
    ['homepage', 'index.html', 'https://raddadband.com/'],
    ['QR', 'qr/index.html', 'https://raddadband.com/qr/']
];

describe('shared inline live-video player', () => {
    it.each(PAGES)('keeps %s dialog interior/edges open but closes for each outside edge', (_label, html, url) => {
        const page = loadPage(html, url);
        const card = page.document.querySelector('[data-inline-video]');
        vi.spyOn(page.dialog, 'getBoundingClientRect').mockReturnValue({ left: 20, top: 30, right: 320, bottom: 430 });
        click(page.window, card);
        const frame = page.frame();
        const press = (clientX, clientY) => page.dialog.dispatchEvent(new page.window.MouseEvent('pointerdown', { bubbles: true, button: 0, clientX, clientY }));
        for (const [clientX, clientY] of [[100, 100], [20, 30], [320, 430]]) {
            press(clientX, clientY);
            click(page.window, page.dialog, { clientX, clientY });
            expect(page.dialog.open).toBe(true);
            expect(page.frame()).toBe(frame);
            expect(frame.hasAttribute('src')).toBe(true);
            expect(page.dialog.close).not.toHaveBeenCalled();
        }
        press(100, 100);
        click(page.window, page.dialog, { clientX: 19, clientY: 100 });
        expect(page.dialog.open).toBe(true);
        press(19, 100);
        page.dialog.dispatchEvent(new page.window.Event('pointercancel'));
        click(page.window, page.dialog, { clientX: 19, clientY: 100 });
        expect(page.dialog.open).toBe(true);
        for (const [clientX, clientY] of [[19, 100], [321, 100], [100, 29], [100, 431]]) {
            press(clientX, clientY);
            click(page.window, page.dialog, { clientX, clientY });
            expect(page.dialog.open).toBe(false);
            expect(page.frame().hasAttribute('src')).toBe(false);
            expect(page.timers.size).toBe(0);
            expect(page.document.activeElement).toBe(card);
            click(page.window, card);
        }
        page.window.close();
    });

    it.each([
        ['homepage', 'index.html', 'https://raddadband.com/', 'All the Small Things — blink-182 cover', 'Wildflower 2026 · Live performance'],
        ['QR', 'qr/index.html', 'https://raddadband.com/qr/', 'All the Small Things', 'blink-182 cover']
    ])('loads a validated YouTube video after an explicit plain click on %s', (label, html, url, title, context) => {
        const { dialog, document, window } = loadPage(html, url);
        const card = document.querySelector('[data-inline-video]');
        const originalFrame = dialog.querySelector('[data-video-frame]');
        const click = new window.MouseEvent('click', { bubbles: true, button: 0, cancelable: true });

        expect(label).toBeTruthy();
        expect(originalFrame.hasAttribute('src')).toBe(false);
        card.dispatchEvent(click);
        const frame = dialog.querySelector('[data-video-frame]');

        expect(frame).not.toBe(originalFrame);
        expect(click.defaultPrevented).toBe(true);
        expect(dialog.showModal).toHaveBeenCalledOnce();
        expect(frame.src).toBe('https://www.youtube-nocookie.com/embed/9Re_0wjIbfQ?autoplay=1&rel=0');
        expect(frame.title).toBe(`Watch Rad Dad perform ${title}`);
        expect(dialog.querySelector('#live-video-title').textContent).toBe(title);
        expect(dialog.querySelector('[data-video-context]').textContent).toBe(context);
        expect(dialog.querySelector('[data-video-youtube]').href).toBe(
            'https://www.youtube.com/watch?v=9Re_0wjIbfQ'
        );
        expect(document.documentElement.classList.contains('has-video-dialog')).toBe(true);
    });

    it.each([
        ['homepage', 'index.html', 'https://raddadband.com/'],
        ['QR', 'qr/index.html', 'https://raddadband.com/qr/']
    ])('clears playback and restores focus when the fan closes the %s dialog', (_label, html, url) => {
        const { dialog, document, window } = loadPage(html, url);
        const card = document.querySelector('[data-inline-video]');
        card.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));
        const frame = dialog.querySelector('[data-video-frame]');
        dialog.querySelector('[data-video-close]').click();

        expect(dialog.close).toHaveBeenCalledOnce();
        expect(frame.hasAttribute('src')).toBe(false);
        expect(document.activeElement).toBe(card);
        expect(document.documentElement.classList.contains('has-video-dialog')).toBe(false);
    });

    it.each([
        ['homepage', 'index.html', 'https://raddadband.com/'],
        ['QR', 'qr/index.html', 'https://raddadband.com/qr/']
    ])('does not intercept a %s card when its YouTube receipt is invalid', (_label, html, url) => {
        const { dialog, document, window } = loadPage(html, url);
        const card = document.querySelector('[data-inline-video]');
        card.href = 'https://example.com/watch?v=4ReFoSZHL7o';
        const click = new window.MouseEvent('click', { bubbles: true, button: 0, cancelable: true });

        card.dispatchEvent(click);

        expect(click.defaultPrevented).toBe(false);
        expect(dialog.showModal).not.toHaveBeenCalled();
        expect(dialog.querySelector('[data-video-frame]').hasAttribute('src')).toBe(false);
    });

    it('keeps the homepage featured and linoleum tapes as direct YouTube cards', () => {
        const { document } = loadPage('index.html', 'https://raddadband.com/');
        const cards = [...document.querySelectorAll('#watch .video-card')];

        expect(cards).toHaveLength(5);
        expect(cards.filter((card) => card.hasAttribute('data-inline-video'))).toHaveLength(3);
        expect(cards[0].href).toBe('https://www.youtube.com/watch?v=4ReFoSZHL7o');
        expect(cards[0].hasAttribute('data-inline-video')).toBe(false);
        expect(cards[4].href).toBe('https://www.youtube.com/watch?v=e9mR2sgnJ00');
        expect(cards[4].hasAttribute('data-inline-video')).toBe(false);
    });

    it.each(PAGES)('keeps %s loading bounded and provides only an explicit retry after a stall', (_label, html, url) => {
        const page = loadPage(html, url);
        const card = page.document.querySelector('[data-inline-video]');
        expect(page.status()).toBe('');
        click(page.window, card);
        const firstFrame = page.frame();
        const firstUrl = firstFrame.src;

        expect(page.status()).toContain('Opening this video');
        expect(page.retry().disabled).toBe(true);
        expect([...page.timers.values()].map((timer) => timer.delay)).toEqual([10_000]);
        click(page.window, page.retry());
        expect(page.frame()).toBe(firstFrame);
        expect(page.timers.size).toBe(1);

        page.expire();
        expect(page.status()).toContain('taking longer than expected');
        expect(page.status()).toContain('watch this video on YouTube');
        expect(page.retry().disabled).toBe(false);
        expect(firstFrame.hasAttribute('src')).toBe(false);
        expect(page.timers.size).toBe(0);
        page.expire();
        expect(page.frame()).toBe(firstFrame);

        click(page.window, page.retry());
        expect(page.frame()).not.toBe(firstFrame);
        expect(page.frame().src).toBe(firstUrl);
        expect(page.retry().disabled).toBe(true);
        expect(page.timers.size).toBe(1);
        expect(page.dialog.showModal).toHaveBeenCalledOnce();
    });

    it.each(PAGES)('does not mistake a %s frame load for verified playback', (_label, html, url) => {
        const page = loadPage(html, url);
        click(page.window, page.document.querySelector('[data-inline-video]'));
        const loadedFrame = page.frame();
        loadedFrame.dispatchEvent(new page.window.Event('load'));

        expect(page.status()).toContain('Use the player controls');
        expect(page.status()).toContain('If it does not play');
        expect(page.status()).not.toMatch(/\bplaying\b|successful|ready to play/i);
        expect(page.retry().disabled).toBe(false);
        expect(page.timers.size).toBe(0);
        expect(loadedFrame.hasAttribute('src')).toBe(true);
        page.expire();
        expect(page.frame()).toBe(loadedFrame);

        click(page.window, page.retry());
        expect(page.frame()).not.toBe(loadedFrame);
        expect(loadedFrame.hasAttribute('src')).toBe(false);
        expect(page.status()).toContain('Opening this video');
    });

    it.each(PAGES)('offers %s manual recovery after a frame error and ignores retired frame events', (_label, html, url) => {
        const page = loadPage(html, url);
        click(page.window, page.document.querySelector('[data-inline-video]'));
        const failedFrame = page.frame();
        failedFrame.dispatchEvent(new page.window.Event('error'));

        expect(page.status()).toContain('could not be opened here');
        expect(failedFrame.hasAttribute('src')).toBe(false);
        expect(page.retry().disabled).toBe(false);
        expect(page.timers.size).toBe(0);

        click(page.window, page.retry());
        const retryFrame = page.frame();
        const pendingStatus = page.status();
        failedFrame.dispatchEvent(new page.window.Event('load'));
        failedFrame.dispatchEvent(new page.window.Event('error'));
        expect(page.frame()).toBe(retryFrame);
        expect(page.status()).toBe(pendingStatus);
        expect(page.retry().disabled).toBe(true);
        expect(page.timers.size).toBe(1);

        retryFrame.dispatchEvent(new page.window.Event('load'));
        expect(page.status()).toContain('If it does not play');
        expect(page.retry().disabled).toBe(false);
        expect(page.timers.size).toBe(0);
    });

    it.each(PAGES)('retires %s playback and status when closed, including a close then another card', (_label, html, url) => {
        const page = loadPage(html, url);
        const cards = [...page.document.querySelectorAll('[data-inline-video]')];
        click(page.window, cards[0]);
        const firstFrame = page.frame();
        const retiredTimeout = [...page.timers.values()][0].callback;
        page.dialog.close();

        expect(firstFrame.hasAttribute('src')).toBe(false);
        expect(page.status()).toBe('');
        expect(page.retry().disabled).toBe(true);
        expect(page.timers.size).toBe(0);
        expect(page.document.activeElement).toBe(cards[0]);
        click(page.window, page.retry());
        expect(page.frame()).toBe(firstFrame);

        click(page.window, cards[1]);
        const secondFrame = page.frame();
        expect(secondFrame.src).toContain('/embed/GCy4nHIqV5k?');
        const pendingStatus = page.status();
        firstFrame.dispatchEvent(new page.window.Event('load'));
        firstFrame.dispatchEvent(new page.window.Event('error'));
        retiredTimeout();
        page.dialog.dispatchEvent(new page.window.Event('close'));
        expect(page.dialog.open).toBe(true);
        expect(page.frame()).toBe(secondFrame);
        expect(page.status()).toBe(pendingStatus);
        expect(page.retry().disabled).toBe(true);
        expect(page.timers.size).toBe(1);

        page.dialog.querySelector('[data-video-close]').click();
        expect(page.document.activeElement).toBe(cards[1]);
        expect(secondFrame.hasAttribute('src')).toBe(false);
        expect(page.timers.size).toBe(0);
    });

    it.each(PAGES)('stops %s inline audio when the fan normally follows the exact YouTube fallback', (_label, html, url) => {
        const page = loadPage(html, url);
        const card = page.document.querySelector('[data-inline-video]');
        click(page.window, card);
        const frame = page.frame();
        const fallback = page.dialog.querySelector('[data-video-youtube]');
        const event = click(page.window, fallback);

        expect(event.defaultPrevented).toBe(false);
        expect(fallback.href).toBe(card.href);
        expect(fallback.target).toBe('_blank');
        expect(fallback.rel).toBe('noopener noreferrer');
        expect(page.dialog.open).toBe(false);
        expect(frame.hasAttribute('src')).toBe(false);
        expect(page.status()).toBe('');
        expect(page.document.activeElement).toBe(card);
        expect(page.timers.size).toBe(0);
    });

    it.each(PAGES)('preserves %s modifier-click behavior on both original cards and fallback links', (_label, html, url) => {
        const page = loadPage(html, url);
        const card = page.document.querySelector('[data-inline-video]');
        for (const modifier of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
            expect(click(page.window, card, modifier).defaultPrevented).toBe(false);
        }
        expect(page.dialog.showModal).not.toHaveBeenCalled();
        expect(page.frame().hasAttribute('src')).toBe(false);

        click(page.window, card);
        const frame = page.frame();
        const fallback = page.dialog.querySelector('[data-video-youtube]');
        for (const modifier of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { altKey: true }, { button: 1 }]) {
            expect(click(page.window, fallback, modifier).defaultPrevented).toBe(false);
        }
        expect(page.dialog.open).toBe(true);
        expect(page.frame()).toBe(frame);
        expect(frame.hasAttribute('src')).toBe(true);
        expect(page.dialog.close).not.toHaveBeenCalled();
    });

    it.each(PAGES.flatMap(([label, html, url]) => [true, false].flatMap(persisted =>
        ['opening', 'loaded'].map(state => ({ label, html, url, persisted, state }))
    )))('retires $label video on page exit (persisted=$persisted, state=$state)', ({ html, url, persisted, state }) => {
        const page = loadPage(html, url);
        const cards = [...page.document.querySelectorAll('[data-inline-video]')];
        click(page.window, cards[0]);
        const retiredFrame = page.frame();
        const retiredTimeout = [...page.timers.values()][0].callback;
        if (state === 'loaded') retiredFrame.dispatchEvent(new page.window.Event('load'));
        const focus = vi.spyOn(cards[0], 'focus');

        page.window.dispatchEvent(new page.window.PageTransitionEvent('pagehide', { persisted }));

        expect(page.dialog.open).toBe(false);
        expect(retiredFrame.hasAttribute('src')).toBe(false);
        expect(page.document.documentElement.classList.contains('has-video-dialog')).toBe(false);
        expect(page.timers.size).toBe(0);
        expect(page.status()).toBe('');
        expect(page.retry().disabled).toBe(true);
        expect(focus).not.toHaveBeenCalled();

        // Returning, repeated lifecycle events, and retired provider callbacks
        // must not reopen the old selection or make its retry active.
        page.window.dispatchEvent(new page.window.PageTransitionEvent('pagehide', { persisted }));
        page.window.dispatchEvent(new page.window.PageTransitionEvent('pageshow', { persisted }));
        retiredFrame.dispatchEvent(new page.window.Event('load'));
        retiredFrame.dispatchEvent(new page.window.Event('error'));
        retiredTimeout();
        click(page.window, page.retry());
        expect(page.dialog.open).toBe(false);
        expect(page.frame()).toBe(retiredFrame);
        expect(page.frame().hasAttribute('src')).toBe(false);
        expect(page.status()).toBe('');
        expect(page.timers.size).toBe(0);

        click(page.window, cards[1]);
        expect(page.dialog.open).toBe(true);
        expect(page.frame()).not.toBe(retiredFrame);
        expect(page.frame().src).toContain('/embed/GCy4nHIqV5k?');
        retiredTimeout();
        page.dialog.dispatchEvent(new page.window.Event('close'));
        expect(page.dialog.open).toBe(true);
        expect(page.status()).toContain('Opening');
        expect(page.timers.size).toBe(1);
        page.dialog.querySelector('[data-video-close]').click();
        expect(page.document.activeElement).toBe(cards[1]);
        expect(page.timers.size).toBe(0);
    });

    it('does not start an embed when native modal opening fails', () => {
        const page = loadPage('index.html', 'https://raddadband.com/');
        page.dialog.showModal = vi.fn(() => { throw new Error('Synthetic unavailable dialog'); });
        const card = page.document.querySelector('[data-inline-video]');

        expect(click(page.window, card).defaultPrevented).toBe(false);
        expect(page.frame().hasAttribute('src')).toBe(false);
        expect(page.status()).toBe('');
        expect(page.timers.size).toBe(0);
    });
});
