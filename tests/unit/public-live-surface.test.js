// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(fileURLToPath(new URL('../..', import.meta.url)));
const homepagePath = join(repoRoot, 'index.html');
const qrPath = join(repoRoot, 'qr', 'index.html');
const FEATURED_VIDEO_ID = '4ReFoSZHL7o';
const RETIRED_VIDEO_ID = ['_IwRtmu', 'TKBY'].join('');
const OFFICIAL_SET_SONG_TITLES = [
    'Basket Case',
    'The Rock Show',
    'Ruby Soho',
    'The Story Of Us',
    'The Story of Us'
];

function coversSection(html) {
    const match = html.match(/<section[^>]*id="covers"[\s\S]*?<\/section>/i);

    expect(match, 'homepage must keep the public covers section').not.toBeNull();
    return match[0];
}

function songSection(html) {
    const match = html.match(/<section[^>]*id="song"[\s\S]*?<\/section>/i);

    expect(match, 'QR landing page must keep the Story Of Us song section').not.toBeNull();
    return match[0];
}

describe('public live surface honesty', () => {
    it('does not present the homepage artist wall as a setlist', async () => {
        const html = await readFile(homepagePath, 'utf8');
        const covers = coversSection(html);

        expect(covers).toContain('From the Rad Dad covers');
        expect(covers).toContain('Playing hits from');
        expect(covers).toContain('Selections vary by show');
        expect(covers).toContain('aria-label="Cover note"');
        expect(covers).toContain('Green Day');
        expect(covers.toLowerCase()).not.toContain('setlist');
        expect(covers.toLowerCase()).not.toContain('part of the set');

        for (const title of OFFICIAL_SET_SONG_TITLES) {
            expect(covers).not.toContain(title);
        }
    });

    it('does not claim The Story Of Us is part of the official set', async () => {
        const qr = await readFile(qrPath, 'utf8');
        const song = songSection(qr);

        expect(song).toContain('It started as a solo release');
        expect(song).toContain('it became ours');
        expect(song).toContain('The Story Of Us');
        expect(song.toLowerCase()).not.toContain('setlist');
        expect(song.toLowerCase()).not.toContain('part of the set');
        expect(qr.toLowerCase()).not.toContain('setlist');
        expect(qr.toLowerCase()).not.toContain('part of the set');
    });

    it('keeps the official next show and current Wildflower clip on public live routes', async () => {
        const homepage = await readFile(homepagePath, 'utf8');
        const qr = await readFile(qrPath, 'utf8');

        expect(homepage).toContain('September 19, 2026');
        expect(homepage).toContain('Guitars &amp; Growlers');
        expect(homepage).toContain('The Fault Lines');
        expect(qr).toContain('The Fault Lines');
        expect(homepage).toContain(FEATURED_VIDEO_ID);
        expect(homepage).not.toContain(RETIRED_VIDEO_ID);
        expect(qr).toContain(FEATURED_VIDEO_ID);
        expect(qr).not.toContain(RETIRED_VIDEO_ID);
        expect(qr.toLowerCase()).not.toContain('setlist');
        expect(qr.toLowerCase()).not.toContain('part of the set');
    });
});
