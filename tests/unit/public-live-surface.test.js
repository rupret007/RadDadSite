// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
const root = new URL('../../', import.meta.url);
async function page(path = 'index.html') {
    const html = await readFile(new URL(path, root), 'utf8');
    return { html, doc: new JSDOM(html).window.document };
}
const paths = ['index.html', 'qr/index.html'];
const videos = ['4ReFoSZHL7o', '9Re_0wjIbfQ', 'GCy4nHIqV5k', 'iMrxzCQ7lVs', 'e9mR2sgnJ00'];
describe('evergreen public band surfaces', () => {
    it.each(paths)('%s identifies a cover band, not a current event or original-song project', async path => {
        const { html, doc } = await page(path);
        const metadata = JSON.parse(doc.querySelector('script[type="application/ld+json"]').textContent);
        expect(metadata['@type']).toBe('MusicGroup');
        expect(metadata.name).toBe('Rad Dad');
        expect(metadata.description).toContain('cover band');
        expect(metadata.sameAs).toHaveLength(3);
        expect(metadata).not.toHaveProperty('startDate');
        expect(doc.querySelectorAll('h1')).toHaveLength(1);
        expect(doc.title).not.toMatch(/September|Friends|own cover/i);
        expect(html).not.toMatch(/our (?:one |only )?original|our song|came from inside|became ours|covering its own cover/i);
        expect(doc.querySelector('[data-show-primary-action], [data-show-share], [data-show-visit], a[download], a[href*="maps.app"]')).toBeNull();
        expect(doc.querySelector('script[src*="show-state"]')).toBeNull();
    });
    it.each(paths)('%s credits The Story Of Us as a Taylor Swift cover recording by Jeff Story', async path => {
        const { doc } = await page(path);
        const song = doc.querySelector('.song-desk');
        expect(song.textContent).toContain('Taylor Swift cover');
        expect(song.textContent).toContain('Jeff Story');
        expect(song.querySelector('a[href^="https://music.apple.com"]').href).toContain('1827102893');
        expect(song.querySelector('a[href^="https://music.amazon.com"]').href).toContain('B0FHPB9FN7');
        expect(song.querySelector('iframe')).toBeNull();
        expect(song.querySelector('template').content.querySelector('iframe').src).toContain('embed.music.apple.com');
    });
    it.each(paths)('%s preserves all five performance receipts and three progressive players', async path => {
        const { doc } = await page(path);
        const cards = [...doc.querySelectorAll('.video-grid .video-card')];
        expect(cards.map(card => new URL(card.href).searchParams.get('v'))).toEqual(videos);
        expect(cards.filter(card => card.hasAttribute('data-inline-video'))).toHaveLength(3);
        expect(cards[0].hasAttribute('data-inline-video')).toBe(false);
        expect(cards[4].hasAttribute('data-inline-video')).toBe(false);
        expect(doc.querySelector('[data-video-frame]').hasAttribute('src')).toBe(false);
    });
    it('puts live performances before the covers wall and booking within the first section', async () => {
        const { doc } = await page();
        expect([...doc.querySelectorAll('main > section')].map(node => node.id)).toEqual(['home','watch','covers','band','','shows','contact']);
        expect(doc.querySelector('#home a[href="#watch"]')).not.toBeNull();
        expect(doc.querySelector('#home a[href="#contact"]')).not.toBeNull();
        expect(doc.querySelectorAll('.artist-wall > li')).toHaveLength(14);
        expect(doc.querySelectorAll('.artist-wall a')).toHaveLength(0);
    });
    it('keeps the dated September show only in history and invents no upcoming date', async () => {
        const { doc } = await page();
        expect(doc.querySelector('#home').textContent).not.toContain('September');
        expect(doc.querySelector('#show .show-status').textContent).toBe('Past show');
        expect(doc.querySelector('#show time').dateTime).toBe('2026-09-19');
        expect(doc.querySelectorAll('[data-upcoming-shows] time')).toHaveLength(0);
        expect(doc.querySelector('[data-upcoming-shows]').textContent).toContain('No upcoming dates posted yet');
        expect(doc.querySelectorAll('.show-card--featured')).toHaveLength(0);
    });
    it('keeps a space in the hero lede so phones do not glue alternative.The together', async () => {
        const { doc } = await page();
        const lede = doc.querySelector('.band-hero__lede').textContent;
        expect(lede).not.toContain('alternative.The');
        expect(lede).toContain('’90s alternative. The songs you know, played loud.');
    });
    it('does not imply a next show when no upcoming dates are in the markup', async () => {
        const home = await page();
        const qr = await page('qr/index.html');
        const emptySentence = 'No upcoming dates posted yet. Follow Rad Dad for show announcements.';
        const nextShowClaim = /catch|come to the next|next one|next show/i;

        expect(home.doc.querySelector('#shows-title').textContent).not.toMatch(nextShowClaim);
        expect(qr.doc.querySelector('#qr-shows-title').textContent).not.toMatch(nextShowClaim);
        expect(home.doc.querySelector('[data-upcoming-shows]').textContent).toContain(emptySentence);
        expect(qr.doc.querySelector('#next-show').textContent).toContain(emptySentence);
        expect(home.doc.querySelector('[data-upcoming-shows] a[href*="instagram.com/rad.dad.band"]')).not.toBeNull();
        expect(home.doc.querySelector('[data-upcoming-shows] a[href="#contact"]')).not.toBeNull();
        expect(home.doc.querySelectorAll('.show-card--past')).toHaveLength(3);
        expect(qr.doc.querySelector('#next-show a[href="../#shows"]').textContent).toContain('Show updates & past shows');
    });
    it.each(paths)('%s has a valid local destination for every same-page hash', async path => {
        const { doc } = await page(path);
        for (const a of doc.querySelectorAll('a[href^="#"]')) {
            expect(doc.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))), a.outerHTML).not.toBeNull();
        }
        expect(doc.querySelectorAll('.header-socials a')).toHaveLength(3);
        expect(doc.querySelectorAll('form')).toHaveLength(0);
    });
});
