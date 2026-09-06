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

    dialog.showModal = vi.fn(() => dialog.setAttribute('open', ''));
    dialog.close = vi.fn(() => {
        dialog.removeAttribute('open');
        dialog.dispatchEvent(new window.Event('close'));
    });

    window.eval(scriptSource);

    return { dialog, document: window.document, window };
}

describe('shared inline live-video player', () => {
    it.each([
        ['homepage', 'index.html', 'https://raddadband.com/', 'All the Small Things — blink-182 cover', 'Wildflower 2026 · Live performance'],
        ['QR', 'qr/index.html', 'https://raddadband.com/qr/', 'All the Small Things', 'blink-182 cover']
    ])('loads a validated YouTube video after an explicit plain click on %s', (label, html, url, title, context) => {
        const { dialog, document, window } = loadPage(html, url);
        const card = document.querySelector('[data-inline-video]');
        const frame = dialog.querySelector('[data-video-frame]');
        const click = new window.MouseEvent('click', { bubbles: true, button: 0, cancelable: true });

        expect(label).toBeTruthy();
        expect(frame.hasAttribute('src')).toBe(false);
        card.dispatchEvent(click);

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
        const frame = dialog.querySelector('[data-video-frame]');

        card.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));
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
});
