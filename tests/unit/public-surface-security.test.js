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
    'nfc/index.html'
];
const PUBLIC_CLIENT_TEXT = [
    ...PUBLIC_HTML,
    'script.js',
    'qr/script.js',
    'styles.css',
    'qr/styles.css'
];
const PUBLIC_SHOW_BOARD = 'https://rad-dad-show-night.jeffstory007.chatgpt.site/';
const ALLOWED_BOARD_HREFS = [
    `${PUBLIC_SHOW_BOARD}#official-sets`,
    `${PUBLIC_SHOW_BOARD}#suggestions`
];

function boardHrefs(html) {
    return [...html.matchAll(/https:\/\/rad-dad-show-night\.jeffstory007\.chatgpt\.site\/[^"'\\\s]*/g)]
        .map((match) => match[0]);
}

function targetBlankTags(html) {
    return [...html.matchAll(/<a\b[^>]*\btarget=["']_blank["'][^>]*>/gi)].map((match) => match[0]);
}

describe('public surface security', () => {
    it('keeps /show-control off every public client surface', async () => {
        for (const relativePath of PUBLIC_CLIENT_TEXT) {
            const source = await readFile(join(repoRoot, relativePath), 'utf8');

            expect(source, relativePath).not.toContain('/show-control');
            expect(source, relativePath).not.toContain('show-control');
        }
    });

    it('limits homepage and QR board links to the two public review-safe anchors', async () => {
        for (const relativePath of PUBLIC_HTML) {
            const html = await readFile(join(repoRoot, relativePath), 'utf8');
            const hrefs = boardHrefs(html);

            if (relativePath === 'tap/index.html' || relativePath === 'nfc/index.html') {
                expect(hrefs, relativePath).toEqual([]);
                continue;
            }

            expect(hrefs, relativePath).toEqual(ALLOWED_BOARD_HREFS);
        }
    });

    it('isolates every new-tab link and rejects script or data URLs', async () => {
        for (const relativePath of PUBLIC_HTML) {
            const html = await readFile(join(repoRoot, relativePath), 'utf8');

            expect(html, relativePath).not.toMatch(/href=["']javascript:/i);
            expect(html, relativePath).not.toMatch(/href=["']data:/i);

            const blankTargets = targetBlankTags(html);

            if (relativePath === 'index.html' || relativePath === 'qr/index.html') {
                expect(blankTargets.length, `${relativePath} should keep external actions`).toBeGreaterThan(0);
            }

            for (const tag of blankTargets) {
                expect(tag, relativePath).toMatch(/\brel=["'][^"']*noopener[^"']*["']/i);
                expect(tag, relativePath).toMatch(/\brel=["'][^"']*noreferrer[^"']*["']/i);
            }
        }
    });
});
