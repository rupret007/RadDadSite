import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const htmlPath = path.join(repoRoot, 'index.html');
const scriptPath = path.join(repoRoot, 'script.js');
const rawHtml = fs.readFileSync(htmlPath, 'utf8').replace(
    /<script\b[^>]*\bsrc=["']script\.js["'][^>]*><\/script>/i,
    ''
);
const scriptSource = fs.readFileSync(scriptPath, 'utf8');

function loadHomepage() {
    const dom = new JSDOM(rawHtml, {
        pretendToBeVisual: true,
        runScripts: 'dangerously',
        url: 'http://127.0.0.1:4173/'
    });
    const { window } = dom;

    window.eval(scriptSource);
    window.document.dispatchEvent(new window.Event('DOMContentLoaded', { bubbles: true }));

    return {
        document: window.document,
        window
    };
}

describe('homepage script behavior', () => {
    it('hides a failed logo and creates exactly one fallback across repeated errors', () => {
        const { document, window } = loadHomepage();
        const brand = document.querySelector('.brand');
        const logo = document.getElementById('logo');

        logo.dispatchEvent(new window.Event('error'));
        logo.dispatchEvent(new window.Event('error'));

        const fallbacks = document.querySelectorAll('.logo-fallback');

        expect(logo.hidden).toBe(true);
        expect(fallbacks).toHaveLength(1);
        expect(fallbacks[0].textContent).toBe('RAD DAD');
        expect(brand.contains(fallbacks[0])).toBe(true);
    });
});
