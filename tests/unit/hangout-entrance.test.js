import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const BAND_LAB_PAGE = 'private/garage-rehearsal-k7m2n9/index.html';
const PUBLIC_SURFACE = [
    'index.html',
    'play/index.html',
    'play/hub.html',
    'qr/index.html',
    'tap/index.html',
    'nfc/index.html',
    'script.js',
    'styles.css',
    'live-video.js'
];

describe('unlisted Hang Out entrance', () => {
    it('puts Play games on the band desk and keeps it off the public site', async () => {
        const html = await readFile(join(repoRoot, BAND_LAB_PAGE), 'utf8');
        const hangout = html.match(/<section class="band-lab-hangout"[\s\S]*?<\/section>/)?.[0] ?? '';
        const webjam = html.match(/<aside\b[^]*?<\/aside>/i)?.[0] ?? '';
        const setlist = html.match(/<ol class="band-lab-setlist">[\s\S]*?<\/ol>/)?.[0] ?? '';
        const link = hangout.match(/<a\b[^>]*>[\s\S]*?<\/a>/)?.[0] ?? '';
        const href = link.match(/href="([^"]+)"/)?.[1] ?? '';
        const url = new URL(href);

        expect(html).toContain('name="robots" content="noindex, nofollow, noarchive"');
        expect(hangout).toContain('>Play games<');
        expect(hangout).toContain('>Hang Out<');
        expect(hangout).toContain('referrerpolicy="no-referrer"');
        expect(link).not.toMatch(/target=/i);
        expect(url.protocol).toBe('https:');
        expect(url.pathname).toBe('/beta/');
        expect(url.search).toBe('?via=rad-dad');
        expect(url.hash).toBe('');
        expect(url.username).toBe('');
        expect(url.password).toBe('');
        expect(url.hostname.endsWith('.workers.dev')).toBe(true);
        expect(url.hostname).not.toBe('raddadband.com');
        expect(setlist).not.toContain('via=rad-dad');
        expect(webjam).not.toContain('via=rad-dad');
        expect(webjam).not.toMatch(/<iframe\b/i);
        expect(html.match(/via=rad-dad/g)).toHaveLength(1);

        for (const relativePath of PUBLIC_SURFACE) {
            const source = await readFile(join(repoRoot, relativePath), 'utf8');
            expect(source, relativePath).not.toContain('via=rad-dad');
            expect(source, relativePath).not.toContain('/beta/');
        }
    });
});