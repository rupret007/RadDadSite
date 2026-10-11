import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const scriptSource = fs.readFileSync(path.join(repoRoot, 'script.js'), 'utf8');
const BAND_URL = 'https://raddadband.com/';
const PAGES = [
    ['homepage', 'index.html', 'https://raddadband.com/'],
    ['QR', 'qr/index.html', 'https://raddadband.com/qr/']
];
const windows = [];

async function settle() {
    for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
}

function loadPage(relativeHtml, url, { share, writeText } = {}) {
    const rawHtml = fs.readFileSync(path.join(repoRoot, relativeHtml), 'utf8')
        .replace(/<script\b[^>]*><\/script>/gi, '');
    const dom = new JSDOM(rawHtml, {
        pretendToBeVisual: true,
        runScripts: 'dangerously',
        url
    });
    const { window } = dom;
    windows.push(window);

    const copyCalls = [];
    Object.defineProperty(window.navigator, 'share', {
        configurable: true,
        value: share
    });
    Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: {
            writeText: async (text) => {
                copyCalls.push(text);
                if (typeof writeText === 'function') return writeText(text);
            }
        }
    });

    window.eval(scriptSource);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

    return {
        window,
        document: window.document,
        copyCalls,
        share: window.document.querySelector('[data-share-band]'),
        status: window.document.querySelector('[data-share-status]'),
        fallback: window.document.querySelector('[data-share-fallback]'),
        copy: window.document.querySelector('[data-copy-band]'),
        urlField: window.document.querySelector('#band-share-url')
    };
}

afterEach(() => {
    windows.splice(0).forEach((window) => window.close());
});

describe('public band share AbortError recovery', () => {
    it.each(PAGES)('%s AbortError never copies and leaves a manual Copy path', async (_label, html, url) => {
        const share = async () => {
            throw Object.assign(new Error('Canceled fixture'), { name: 'AbortError' });
        };
        const page = loadPage(html, url, { share });

        page.share.click();
        await settle();

        expect(page.copyCalls).toEqual([]);
        expect(page.fallback.hidden).toBe(false);
        expect(page.copy.hidden).toBe(false);
        expect(page.copy.disabled).toBe(false);
        expect(page.share.disabled).toBe(false);
        expect(page.urlField.value).toBe(BAND_URL);
        expect(page.status.textContent).toMatch(/canceled/i);
        expect(page.status.textContent).toMatch(/unavailable/i);
        expect(page.status.textContent).not.toMatch(/sent|delivered|copied/i);
        expect(page.status.textContent).not.toBe('Sharing options closed.');

        page.copy.click();
        await settle();

        expect(page.copyCalls).toEqual([BAND_URL]);
        expect(page.status.textContent).toBe('Band website copied.');
    });

    it.each(PAGES)('%s unsupported sharing still waits for a separate Copy click', async (_label, html, url) => {
        const page = loadPage(html, url, { share: undefined });

        page.share.click();
        await settle();

        expect(page.copyCalls).toEqual([]);
        expect(page.fallback.hidden).toBe(false);
        expect(page.status.textContent).toBe('Copy the band website below.');
        expect(page.status.textContent).not.toMatch(/sent|delivered/i);

        page.copy.click();
        await settle();

        expect(page.copyCalls).toEqual([BAND_URL]);
    });
});
