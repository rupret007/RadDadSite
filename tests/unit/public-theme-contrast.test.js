// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(fileURLToPath(new URL('../..', import.meta.url)));
const PUBLIC_HTML = [
    'index.html',
    'qr/index.html',
    'tap/index.html',
    'nfc/index.html',
    'GPT/index.html'
];
const TEXT_ON_DARK = ['cream', 'muted', 'blue', 'blue-bright', 'lime', 'amber'];
const BUTTON_ON_ACCENT = ['blue', 'blue-bright', 'lime'];
const DARK_SURFACES = ['ink', 'ink-soft', 'surface', 'surface-raised'];

function hexToRgb(hex) {
    const value = hex.replace('#', '');
    return [
        parseInt(value.slice(0, 2), 16),
        parseInt(value.slice(2, 4), 16),
        parseInt(value.slice(4, 6), 16)
    ];
}

function channel(component) {
    const value = component / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
    const [red, green, blue] = hexToRgb(hex);
    return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

function contrast(first, second) {
    const lighter = Math.max(luminance(first), luminance(second));
    const darker = Math.min(luminance(first), luminance(second));
    return (lighter + 0.05) / (darker + 0.05);
}

function mixHex(foreground, background, alpha) {
    const [fr, fg, fb] = hexToRgb(foreground);
    const [br, bg, bb] = hexToRgb(background);
    return `#${[fr, fg, fb]
        .map((value, index) => Math.round(value * alpha + [br, bg, bb][index] * (1 - alpha))
            .toString(16)
            .padStart(2, '0'))
        .join('')}`;
}

function readRootTokens(css) {
    const block = css.match(/:root\s*\{([^}]+)\}/);
    expect(block, 'styles.css exposes a :root token block').not.toBeNull();
    return Object.fromEntries([...block[1].matchAll(/--([a-z-]+):\s*([^;]+);/g)]
        .map(([, name, value]) => [name, value.trim()]));
}

function readLineAlpha(value) {
    const match = value.match(/^rgba\(\s*244,\s*240,\s*230,\s*([0-9.]+)\s*\)$/);
    expect(match, `expected cream-on-ink line token, got ${value}`).not.toBeNull();
    return Number(match[1]);
}

describe('public dark theme contrast', () => {
    it('keeps a lifted warm-dark canvas and WCAG AA text, button, and focus tokens', async () => {
        const css = await readFile(join(repoRoot, 'styles.css'), 'utf8');
        const tokens = readRootTokens(css);

        expect(css).toMatch(/color-scheme:\s*dark/);
        expect(tokens.ink).toMatch(/^#[0-9a-f]{6}$/i);
        expect(tokens.ink.toLowerCase()).not.toBe('#000000');
        expect(tokens.ink.toLowerCase()).not.toBe('#020810');
        expect(contrast(tokens.ink, '#000000')).toBeGreaterThanOrEqual(1.12);
        expect(contrast(tokens.cream, tokens.ink)).toBeGreaterThan(contrast(tokens.ink, '#000000'));

        for (const surface of DARK_SURFACES) {
            for (const name of TEXT_ON_DARK) {
                expect(
                    contrast(tokens[name], tokens[surface]),
                    `${name} on ${surface}`
                ).toBeGreaterThanOrEqual(4.5);
            }
            expect(contrast(tokens.pink, tokens[surface]), `pink on ${surface}`).toBeGreaterThanOrEqual(3);
        }

        for (const accent of BUTTON_ON_ACCENT) {
            expect(contrast(tokens.ink, tokens[accent]), `ink on ${accent}`).toBeGreaterThanOrEqual(4.5);
        }

        expect(contrast(tokens.lime, tokens.ink), 'focus ring').toBeGreaterThanOrEqual(3);
        expect(contrast(
            mixHex('#f4f0e6', tokens.ink, readLineAlpha(tokens['line-strong'])),
            tokens.ink
        ), 'interactive border').toBeGreaterThanOrEqual(3);

        expect(css).toMatch(/a:focus-visible,\s*button:focus-visible,\s*summary:focus-visible,\s*input:focus-visible,\s*textarea:focus-visible/);
        expect(css).toMatch(/outline:\s*3px\s+solid\s+var\(--lime\)/);
    });

    it('keeps public pages and redirect shells on the same dark theme-color', async () => {
        const css = await readFile(join(repoRoot, 'styles.css'), 'utf8');
        const tokens = readRootTokens(css);

        for (const relativePath of PUBLIC_HTML) {
            const html = await readFile(join(repoRoot, relativePath), 'utf8');
            expect(html, relativePath).toContain(`<meta name="theme-color" content="${tokens.ink}">`);
        }

        const sharedCss = [
            await readFile(join(repoRoot, 'styles.css'), 'utf8'),
            await readFile(join(repoRoot, 'qr/styles.css'), 'utf8')
        ].join('\n');
        expect(sharedCss).toMatch(/color-scheme:\s*dark/);
    });

    it('keeps redirect-shell text, links, and focus rings at AA on the warm canvas', async () => {
        for (const relativePath of ['tap/index.html', 'nfc/index.html', 'GPT/index.html']) {
            const html = await readFile(join(repoRoot, relativePath), 'utf8');
            expect(html).toContain('background: #171410');
            expect(html).toContain('color: #f4f0e6');
            expect(html).toContain('color: #20baff');
            expect(html).toContain('outline: 3px solid #b5dc08');
            expect(contrast('#f4f0e6', '#171410')).toBeGreaterThanOrEqual(4.5);
            expect(contrast('#20baff', '#171410')).toBeGreaterThanOrEqual(4.5);
            expect(contrast('#b5dc08', '#171410')).toBeGreaterThanOrEqual(3);
        }
    });
});
