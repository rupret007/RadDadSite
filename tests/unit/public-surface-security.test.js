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
const WORKER_PATH = 'worker/index.js';
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

    it('keeps the Apple Music embeds referrer-restricted and sandboxed', async () => {
        for (const relativePath of ['index.html', 'qr/index.html']) {
            const html = await readFile(join(repoRoot, relativePath), 'utf8');
            const iframes = [...html.matchAll(/<iframe\b[^>]*>/gi)].map((match) => match[0]);
            const appleFrames = iframes.filter((tag) => tag.includes('embed.music.apple.com'));

            expect(appleFrames, relativePath).toHaveLength(1);

            for (const tag of appleFrames) {
                expect(tag, relativePath).toContain('sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"');
                expect(tag, relativePath).toContain('referrerpolicy="strict-origin-when-cross-origin"');
                expect(tag, relativePath).not.toContain('allow-same-origin allow-scripts allow-popups allow-top-navigation"');
            }
        }
    });

    it('keeps the QR video frame dormant and narrowly sandboxed until a validated tap', async () => {
        const html = await readFile(join(repoRoot, 'qr/index.html'), 'utf8');
        const script = await readFile(join(repoRoot, 'qr/script.js'), 'utf8');
        const videoFrame = html.match(/<iframe\b[^>]*\bdata-video-frame[^>]*>/i)?.[0];

        expect(videoFrame).toBeTruthy();
        expect(videoFrame).not.toMatch(/\bsrc=/i);
        expect(videoFrame).toContain('sandbox="allow-scripts allow-same-origin allow-presentation"');
        expect(videoFrame).toContain('referrerpolicy="strict-origin-when-cross-origin"');
        expect(videoFrame).not.toContain('allow-popups');
        expect(script).toContain('https://www.youtube-nocookie.com/embed/');
        expect(script).toContain("['www.youtube.com', 'youtube.com'].includes(watchUrl.hostname)");
        expect(script).toContain("watchUrl.pathname === '/watch'");
        expect(script).toContain('/^[A-Za-z0-9_-]{11}$/');
    });

    it('fails closed in the worker for /show-control instead of disguising it as the homepage', async () => {
        const source = await readFile(join(repoRoot, WORKER_PATH), 'utf8');

        expect(source).toContain('isClosedOwnerPath');
        expect(source).toContain("normalized === '/show-control'");
        expect(source).toContain("normalized.startsWith('/show-control/')");
        expect(source).toContain('status: 404');
        expect(source).toContain("'cache-control': 'no-store'");
        expect(source).not.toContain('chatgpt.site');
        expect(source.indexOf('isClosedOwnerPath(requestUrl.pathname)')).toBeLessThan(
            source.indexOf("fallbackUrl.pathname = '/index.html'")
        );
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
