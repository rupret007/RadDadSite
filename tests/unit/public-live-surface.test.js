// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(fileURLToPath(new URL('../..', import.meta.url)));
const homepagePath = join(repoRoot, 'index.html');
const qrPath = join(repoRoot, 'qr', 'index.html');
const tapPath = join(repoRoot, 'tap', 'index.html');
const nfcPath = join(repoRoot, 'nfc', 'index.html');
const calendarPath = join(repoRoot, 'assets', 'rad-dad-friends-guitars-growlers-2026.ics');
const FEATURED_VIDEO_ID = '4ReFoSZHL7o';
const RETIRED_VIDEO_ID = ['_IwRtmu', 'TKBY'].join('');
const OFFICIAL_SET_SONG_TITLES = [
    'Basket Case',
    'The Rock Show',
    'Ruby Soho',
    'The Story Of Us',
    'The Story of Us'
];
const FORBIDDEN_LINEUP = ['Fault Lines', 'thefaultlinestx'];

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

function nextShowSection(html) {
    const match = html.match(/<section[^>]*id="next-show"[\s\S]*?<\/section>/i);

    expect(match, 'QR landing page must keep the next-show section').not.toBeNull();
    return match[0];
}

function featuredShowCard(html) {
    const match = html.match(/<article class="show-card show-card--featured"[\s\S]*?<\/article>/i);

    expect(match, 'homepage must keep the featured next-show card').not.toBeNull();
    return match[0];
}

function heroSection(html) {
    const match = html.match(/<section[^>]*class="hero page-shell"[\s\S]*?<\/section>/i);

    expect(match, 'QR landing page must keep the music-first hero').not.toBeNull();
    return match[0];
}

function rejectForbiddenLineup(source, label) {
    const lower = source.toLowerCase();

    for (const name of FORBIDDEN_LINEUP) {
        expect(lower, `${label} must not name ${name}`).not.toContain(name.toLowerCase());
    }
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
        expect(homepage).toContain(FEATURED_VIDEO_ID);
        expect(homepage).not.toContain(RETIRED_VIDEO_ID);
        expect(qr).toContain('September 19, 2026');
        expect(qr).toContain(FEATURED_VIDEO_ID);
        expect(qr).not.toContain(RETIRED_VIDEO_ID);
        expect(qr.toLowerCase()).not.toContain('setlist');
        expect(qr.toLowerCase()).not.toContain('part of the set');
    });

    it('makes the next Friends action the same calendar action on homepage and QR', async () => {
        const homepage = await readFile(homepagePath, 'utf8');
        const qr = await readFile(qrPath, 'utf8');
        const featured = featuredShowCard(homepage);
        const hero = heroSection(qr);
        const nextShow = nextShowSection(qr);

        expect(featured).toContain('Add to Calendar');
        expect(featured).not.toContain('Save the date');
        expect(featured).toContain('rad-dad-friends-guitars-growlers-2026.ics');
        expect(hero).toContain('Start with our song');
        expect(hero).toContain('href="#next-show"');
        expect(hero).toContain('See the September 19 show');
        expect(hero).not.toContain('See the full band site');
        expect(nextShow).toContain('Saturday, September 19, 2026');
        expect(nextShow).toContain('7&ndash;10 PM');
        expect(nextShow).toContain('Add to Calendar');
        expect(nextShow).toContain('Get Directions');
        expect(nextShow).toContain('Rad Dad <span>+ Friends</span>');
        expect(nextShow).toContain('aria-label="Open the full Rad Dad + Friends event flyer"');
        expect(nextShow).toContain('7–10 PM; free show.');
        expect(nextShow).not.toContain('Rad Dad and Friends');
    });

    it('keeps alias pages as redirect shims and names no extra band', async () => {
        const homepage = await readFile(homepagePath, 'utf8');
        const qr = await readFile(qrPath, 'utf8');
        const tap = await readFile(tapPath, 'utf8');
        const nfc = await readFile(nfcPath, 'utf8');
        const calendar = await readFile(calendarPath, 'utf8');

        for (const [label, source] of [
            ['homepage', homepage],
            ['QR landing page', qr],
            ['tap alias', tap],
            ['nfc alias', nfc],
            ['calendar', calendar]
        ]) {
            expect(source.toLowerCase(), `${label} must not claim an official set`).not.toContain('setlist');
            expect(source.toLowerCase(), `${label} must not claim set membership`).not.toContain('part of the set');
        }

        // The Fault Lines are named on the show surfaces, but the alias
        // redirect shims stay content-free.
        for (const [label, source] of [['tap alias', tap], ['nfc alias', nfc]]) {
            rejectForbiddenLineup(source, label);
        }

        expect(calendar).toContain('SUMMARY:Rad Dad + Friends');
        expect(calendar).toContain('DTSTART:20260920T000000Z');
        expect(calendar).toContain('DTEND:20260920T030000Z');

        for (const [label, source] of [['tap alias', tap], ['nfc alias', nfc]]) {
            expect(source, `${label} must keep the prefix-safe QR redirect`).toContain("new URL('../qr/', window.location.href)");
            expect(source, `${label} must keep the music continue action`).toContain('Continue to the music');
            expect(source, `${label} must not duplicate landing-page content`).not.toContain('The Story Of Us');
            expect(source, `${label} must not duplicate the Friends flyer`).not.toContain('rad-dad-friends-guitars-growlers-2026-v2-full.png');
        }
    });
});
