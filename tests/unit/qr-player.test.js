import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const rawHtml = fs.readFileSync(path.join(repoRoot, 'qr', 'index.html'), 'utf8').replace(
    /<script\b[^>]*\bsrc=["']script\.js[^"']*["'][^>]*><\/script>/i,
    ''
);
const scriptSource = fs.readFileSync(path.join(repoRoot, 'qr', 'script.js'), 'utf8');

function loadQrPage() {
    const dom = new JSDOM(rawHtml, {
        pretendToBeVisual: true,
        runScripts: 'dangerously',
        url: 'https://raddadband.com/qr/'
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

describe('QR inline live-video player', () => {
    it('loads only a validated YouTube video after an explicit plain click', () => {
        const { dialog, document, window } = loadQrPage();
        const card = document.querySelector('[data-inline-video]');
        const frame = dialog.querySelector('[data-video-frame]');
        const click = new window.MouseEvent('click', { bubbles: true, button: 0, cancelable: true });

        expect(frame.hasAttribute('src')).toBe(false);
        card.dispatchEvent(click);

        expect(click.defaultPrevented).toBe(true);
        expect(dialog.showModal).toHaveBeenCalledOnce();
        expect(frame.src).toBe('https://www.youtube-nocookie.com/embed/9Re_0wjIbfQ?autoplay=1&rel=0');
        expect(frame.title).toBe('Watch Rad Dad perform All the Small Things');
        expect(dialog.querySelector('#live-video-title').textContent).toBe('All the Small Things');
        expect(dialog.querySelector('[data-video-youtube]').href).toBe(
            'https://www.youtube.com/watch?v=9Re_0wjIbfQ'
        );
        expect(document.documentElement.classList.contains('has-video-dialog')).toBe(true);
    });

    it('clears playback and restores focus when the fan closes the dialog', () => {
        const { dialog, document, window } = loadQrPage();
        const card = document.querySelector('[data-inline-video]');
        const frame = dialog.querySelector('[data-video-frame]');

        card.dispatchEvent(new window.MouseEvent('click', { bubbles: true, button: 0, cancelable: true }));
        dialog.querySelector('[data-video-close]').click();

        expect(dialog.close).toHaveBeenCalledOnce();
        expect(frame.hasAttribute('src')).toBe(false);
        expect(document.activeElement).toBe(card);
        expect(document.documentElement.classList.contains('has-video-dialog')).toBe(false);
    });

    it('does not intercept a card when its YouTube receipt is invalid', () => {
        const { dialog, document, window } = loadQrPage();
        const card = document.querySelector('[data-inline-video]');
        card.href = 'https://example.com/watch?v=4ReFoSZHL7o';
        const click = new window.MouseEvent('click', { bubbles: true, button: 0, cancelable: true });

        card.dispatchEvent(click);

        expect(click.defaultPrevented).toBe(false);
        expect(dialog.showModal).not.toHaveBeenCalled();
        expect(dialog.querySelector('[data-video-frame]').hasAttribute('src')).toBe(false);
    });
});
