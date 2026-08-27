// @vitest-environment node

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(fileURLToPath(new URL('../..', import.meta.url)));

const FORBIDDEN_BILL_TALK = [
    'opener',
    'opening',
    'headliner',
    'headline',
    'special guest',
    'supporting',
    'doors at',
    'set time',
    'set times'
];

function showHero(html) {
    const match = html.match(/<section[^>]*id="show"[\s\S]*?<\/section>/i);
    expect(match, 'homepage must keep the September show hero').not.toBeNull();
    return match[0];
}

function nextShow(html) {
    const match = html.match(/<section[^>]*id="next-show"[\s\S]*?<\/section>/i);
    expect(match, 'QR page must keep the next-show section').not.toBeNull();
    return match[0];
}

function featuredShowCard(html) {
    const match = html.match(/<article class="show-card show-card--featured">[\s\S]*?<\/article>/i);
    expect(match, 'homepage must keep the featured September show card').not.toBeNull();
    return match[0];
}

describe('September 19 public lineup', () => {
    it('names Rad Dad and The Fault Lines on the homepage, QR show block, and calendar', async () => {
        const homepage = await readFile(join(repoRoot, 'index.html'), 'utf8');
        const qr = await readFile(join(repoRoot, 'qr', 'index.html'), 'utf8');
        const calendar = await readFile(
            join(repoRoot, 'assets', 'rad-dad-friends-guitars-growlers-2026.ics'),
            'utf8'
        );

        const hero = showHero(homepage);
        const showCard = featuredShowCard(homepage);
        const qrShow = nextShow(qr);

        for (const surface of [hero, showCard, qrShow, calendar, homepage]) {
            expect(surface).toContain('Rad Dad');
            expect(surface).toContain('The Fault Lines');
        }

        expect(calendar).toContain('SUMMARY:Rad Dad and The Fault Lines');
        expect(calendar).toContain('DESCRIPTION:Free show. Rad Dad and The Fault Lines at Guitars & Growlers.');
        expect(hero).toContain('Rad Dad and The Fault Lines play a free night');
        expect(qrShow).toContain('come hear Rad Dad and The Fault Lines');
    });

    it('does not invent bill order, extra bands, or set times on public show copy', async () => {
        const homepage = await readFile(join(repoRoot, 'index.html'), 'utf8');
        const qr = await readFile(join(repoRoot, 'qr', 'index.html'), 'utf8');
        const calendar = await readFile(
            join(repoRoot, 'assets', 'rad-dad-friends-guitars-growlers-2026.ics'),
            'utf8'
        );
        const flyerSource = await readFile(
            join(repoRoot, 'scripts', 'flyers', 'sept19-2026.html'),
            'utf8'
        );

        const surfaces = [showHero(homepage), nextShow(qr), calendar, flyerSource];

        for (const surface of surfaces) {
            const lower = surface.toLowerCase();

            for (const phrase of FORBIDDEN_BILL_TALK) {
                const pattern = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                expect(lower).not.toMatch(pattern);
            }

            expect(lower).not.toContain('sponsor');
            expect(lower).not.toContain('presented by');
            expect(lower).not.toContain('epk');
        }

        expect(homepage).toContain('mailto:rad.dad.band@gmail.com');
        expect(homepage).not.toMatch(/The Story Of Us[\s\S]{0,80}part of the set/i);
        expect(qr.toLowerCase()).not.toContain('part of the set');
    });

    it('keeps the printable flyer source honest: both bands, no fake sponsors', async () => {
        const flyerSource = await readFile(
            join(repoRoot, 'scripts', 'flyers', 'sept19-2026.html'),
            'utf8'
        );

        expect(flyerSource).toContain('Rad Dad');
        expect(flyerSource).toContain('The Fault Lines');
        expect(flyerSource).toContain('September 19, 2026');
        expect(flyerSource).toContain('Guitars &amp; Growlers');
        expect(flyerSource).toContain('7–10 PM');
        expect(flyerSource).toContain('Free show');
        expect(flyerSource).toContain('raddadband.com');
        expect(flyerSource).not.toContain('Green Day');
        expect(flyerSource).not.toContain('blink-182');
        expect(flyerSource.toLowerCase()).not.toContain('friends');
    });
});
