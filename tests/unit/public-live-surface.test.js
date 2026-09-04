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
const PUBLIC_SHOW_BOARD = 'https://rad-dad-show-night.jeffstory007.chatgpt.site/';
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

function artistWall(html) {
    const match = html.match(/<ul class="artist-wall"[\s\S]*?<\/ul>/i);

    expect(match, 'homepage must keep the flyer artist wall').not.toBeNull();
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

function homepageSongDesk(html) {
    const match = html.match(/<article class="song-desk"[\s\S]*?<\/article>/i);

    expect(match, 'homepage must keep the Story Of Us listen desk').not.toBeNull();
    return match[0];
}

function heroSection(html) {
    const match = html.match(/<section[^>]*class="hero page-shell"[\s\S]*?<\/section>/i);

    expect(match, 'QR landing page must keep the music-first hero').not.toBeNull();
    return match[0];
}

function participationSection(html) {
    const match = html.match(/<section[^>]*id="join-show"[\s\S]*?<\/section>/i);

    expect(match, 'page must keep the public show-board bridge').not.toBeNull();
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

    it('puts The Story Of Us on the homepage listen path without calling it a setlist', async () => {
        const homepage = await readFile(homepagePath, 'utf8');
        const covers = coversSection(homepage);
        const desk = homepageSongDesk(homepage);

        expect(desk).toContain('id="our-song"');
        expect(desk).toContain('The Story Of Us');
        expect(desk).toContain('It started as a solo release');
        expect(desk).toContain('embed.music.apple.com/us/album/the-story-of-us/1827102667');
        expect(desk).toContain('sandbox="allow-forms allow-popups allow-same-origin allow-scripts allow-top-navigation-by-user-activation"');
        expect(desk).toContain('https://music.apple.com/us/album/the-story-of-us/1827102667?i=1827102893');
        expect(desk).toContain('https://music.amazon.com/tracks/B0FHPB9FN7');
        expect(desk).toContain('href="qr/#song"');
        expect(desk).toContain('href="#join-show"');
        expect(desk).toContain('Help shape the night');
        expect(desk).toContain('href="#show"');
        expect(desk).toContain('September 19 show');
        expect(desk).toContain('referrerpolicy="strict-origin-when-cross-origin"');
        expect(desk).not.toContain('open.spotify.com/search');
        expect(desk).not.toContain('music.youtube.com/search');
        expect(desk.toLowerCase()).not.toContain('setlist');
        expect(desk.toLowerCase()).not.toContain('part of the set');
        expect(covers).not.toContain('The Story Of Us');
        expect(covers).not.toContain('The Story of Us');
    });

    it('does not turn the flyer wall into artist links or official-set titles', async () => {
        const homepage = await readFile(homepagePath, 'utf8');
        const wall = artistWall(coversSection(homepage));

        expect(wall).not.toContain('<a');
        expect(wall).not.toContain('href=');

        for (const title of OFFICIAL_SET_SONG_TITLES) {
            expect(wall).not.toContain(title);
        }
    });

    it('closes leftover listen loops from the 2026 show tape and QR next-show', async () => {
        const homepage = await readFile(homepagePath, 'utf8');
        const qr = await readFile(qrPath, 'utf8');
        const featured = featuredShowCard(homepage);
        const song = songSection(qr);
        const nextShow = nextShowSection(qr);

        expect(featured).toContain('href="#our-song"');
        expect(featured).toContain('Hear The Story Of Us');
        expect(homepage).toContain('href="#live-tapes">Hear the Wildflower tapes</a>');
        expect(homepage).toContain('assets/wildflower-she-green-day.webp');
        expect(song).toContain('aria-label="Show and listen paths"');
        expect(song).toContain('href="#next-show">September 19 show</a>');
        expect(song).toContain('href="#join-show">Help shape the night</a>');
        expect(song).toContain('referrerpolicy="strict-origin-when-cross-origin"');
        expect(nextShow).toContain('href="#song">Hear The Story Of Us</a>');
        expect(qr).toContain('https://www.youtube.com/watch?v=GCy4nHIqV5k');
        expect(qr).toContain('../assets/wildflower-she-green-day.webp');
        expect(qr).toContain('href="../#shows"');
        expect(qr).not.toContain('/show-control');
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

    it('connects both discovery routes to one review-only public show board', async () => {
        const homepage = participationSection(await readFile(homepagePath, 'utf8'));
        const qr = participationSection(await readFile(qrPath, 'utf8'));

        for (const surface of [homepage, qr]) {
            expect(surface).toContain(`${PUBLIC_SHOW_BOARD}#official-sets`);
            expect(surface).toContain(`${PUBLIC_SHOW_BOARD}#suggestions`);
            expect(surface).toContain('See the running order');
            expect(surface).toContain('Suggest a song');
            expect(surface).toContain('goes to the band for review');
            expect(surface).toContain('never changes the official show automatically');
            expect(surface).toContain('public show-night board');
            expect(surface).not.toContain('/show-control');
            expect(surface).not.toContain('will be played');
            expect(surface).toContain('Looking for the date?');
            expect(surface).toContain('September 19 at Guitars');
        }

        for (const destination of ['#official-sets', '#suggestions']) {
            expect(homepage.match(new RegExp(destination, 'g'))).toHaveLength(1);
            expect(qr.match(new RegExp(destination, 'g'))).toHaveLength(1);
        }
    });

    it('makes the next Friends action the same calendar action on homepage and QR', async () => {
        const homepage = await readFile(homepagePath, 'utf8');
        const qr = await readFile(qrPath, 'utf8');
        const featured = featuredShowCard(homepage);
        const hero = heroSection(qr);
        const nextShow = nextShowSection(qr);

        expect(featured).toContain('Hear The Story Of Us');
        expect(featured).toContain('Add to Calendar');
        expect(featured).toContain('Get Directions');
        expect(featured).toContain('href="#our-song"');
        expect(featured).toContain('href="#show"');
        expect(featured).toContain('Show details');
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

        expect(homepage).toContain('href="#covers"');
        expect(homepage).toContain('href="#our-song">Listen</a>');
        expect(homepage).toContain('aria-label="Show and listen paths"');
        expect(homepage).toContain('href="#our-song">Hear Rad Dad</a>');
        expect(qr).toContain('class="next-show-strip"');
        expect(qr).toContain('href="#next-show"');
        expect(qr.match(/data-inline-video/g)).toHaveLength(3);
        expect(qr).toContain('id="live-video-dialog"');
        expect(qr).toContain('data-video-frame');
        expect(qr).not.toMatch(/data-video-frame[^>]+src=/);
        expect(qr).not.toContain('open.spotify.com/search');
        expect(qr).not.toContain('music.youtube.com/search');
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
