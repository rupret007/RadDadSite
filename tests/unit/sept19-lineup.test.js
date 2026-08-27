// @vitest-environment node

import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(fileURLToPath(new URL('../..', import.meta.url)));
const faultLinesUrl = 'https://www.facebook.com/thefaultlinestx';

const restoredFlyerHashes = {
    'assets/rad-dad-friends-guitars-growlers-2026-1122.webp': '1852f6465f86fb758ecd0943205787e1e28fb174110c2bafb7c9f5b16dd0df51',
    'assets/rad-dad-friends-guitars-growlers-2026-561.webp': 'd64b98e773538e9e6ddfc369f6cfc4caeb3a63963f6b4803aa52f16ccd299772',
    'assets/rad-dad-friends-guitars-growlers-2026-full.png': '7858ec235a804018bd1f43660b57dc8038f323c83c52635a5b7d833b625031d7',
    'assets/rad-dad-friends-guitars-growlers-2026-v2-1024.webp': 'b5357548195eb811fd60930f210fc625ec130df83427bdc7d20b3c7800238ea6',
    'assets/rad-dad-friends-guitars-growlers-2026-v2-512.webp': 'f37942e8fead53321c397e89e924f0729e0fc8619a7c9534ea275dfd42531857',
    'assets/rad-dad-friends-guitars-growlers-2026-v2-full.png': '7f0754e73afe1f0e9dd67a20ea832d40bd655c2e6e7f1d2d27913448b2374b0a',
    'assets/rad-dad-social-2026-v2.png': 'e171fdebc43092ec3405d6b60a9aa8afaef02cf2fee9519c72bee2d94737f99e',
    'assets/rad-dad-social-2026.png': 'cd8ff5869a6b9376697046337a31af414554165714e9d089fa6de77791dcc314'
};

const forbiddenBillTalk = [
    /\bopener\b/i,
    /\bopening\b/i,
    /\bheadliner\b/i,
    /\bheadline\b/i,
    /\bspecial guest\b/i,
    /\bsupporting\b/i,
    /\bdoors at\b/i,
    /\bset time\b/i,
    /\bset times\b/i
];

function section(html, id) {
    const match = html.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?<\\/section>`, 'i'));
    expect(match, `page must keep the ${id} section`).not.toBeNull();
    return match[0];
}

function featuredShowCard(html) {
    const match = html.match(/<article class="show-card show-card--featured">[\s\S]*?<\/article>/i);
    expect(match, 'homepage must keep the featured September show card').not.toBeNull();
    return match[0];
}

describe('September 19 public lineup', () => {
    it('keeps Friends as the show identity and adds The Fault Lines on every live surface', async () => {
        const homepage = await readFile(join(repoRoot, 'index.html'), 'utf8');
        const qr = await readFile(join(repoRoot, 'qr', 'index.html'), 'utf8');
        const calendar = await readFile(
            join(repoRoot, 'assets', 'rad-dad-friends-guitars-growlers-2026.ics'),
            'utf8'
        );
        const hero = section(homepage, 'show');
        const qrShow = section(qr, 'next-show');
        const showCard = featuredShowCard(homepage);

        for (const surface of [homepage, hero, showCard, qrShow, calendar]) {
            expect(surface).toContain('Friends');
            expect(surface).toContain('The Fault Lines');
        }

        expect(hero).toContain('event-title__friends-row');
        expect(hero).toContain('event-title__friends');
        expect(qrShow).toContain('Rad Dad <span>+ Friends</span>');
        expect(homepage).toContain(faultLinesUrl);
        expect(qrShow).toContain(faultLinesUrl);
        expect(calendar).toContain('SUMMARY:Rad Dad + Friends with The Fault Lines');
        expect(calendar).toContain('7:00 PM');
        expect(calendar).not.toContain('DTEND');
    });

    it('retains the restored Friends treatment and exact approved flyer assets', async () => {
        const css = await readFile(join(repoRoot, 'styles.css'), 'utf8');

        expect(css).toContain('.event-title__friends-row');
        expect(css).toContain('.event-title__friends');

        for (const [relativePath, expectedHash] of Object.entries(restoredFlyerHashes)) {
            const data = await readFile(join(repoRoot, relativePath));
            const actualHash = createHash('sha256').update(data).digest('hex');
            expect(actualHash, relativePath).toBe(expectedHash);
        }
    });

    it('does not invent bill order, extra scheduling facts, or a set claim', async () => {
        const homepage = await readFile(join(repoRoot, 'index.html'), 'utf8');
        const qr = await readFile(join(repoRoot, 'qr', 'index.html'), 'utf8');
        const calendar = await readFile(
            join(repoRoot, 'assets', 'rad-dad-friends-guitars-growlers-2026.ics'),
            'utf8'
        );
        const surfaces = [section(homepage, 'show'), section(qr, 'next-show'), calendar];

        for (const surface of surfaces) {
            const lower = surface.toLowerCase();

            for (const pattern of forbiddenBillTalk) {
                expect(surface).not.toMatch(pattern);
            }

            expect(lower).not.toContain('sponsor');
            expect(lower).not.toContain('presented by');
            expect(lower).not.toContain('epk');
        }

        expect(homepage).not.toContain('7–10');
        expect(homepage).not.toContain('10:00 PM');
        expect(qr).not.toContain('7–10');
        expect(qr).not.toContain('10:00 PM');
        expect(homepage).not.toMatch(/The Story Of Us[\s\S]{0,80}part of the set/i);
        expect(qr.toLowerCase()).not.toContain('part of the set');
    });

    it('has no flyer renderer capable of overwriting the restored artwork', async () => {
        const packageJson = JSON.parse(await readFile(join(repoRoot, 'package.json'), 'utf8'));

        expect(packageJson.scripts).not.toHaveProperty('build:flyers');
        await expect(access(join(repoRoot, 'scripts', 'render-flyers.mjs'))).rejects.toThrow();
        await expect(access(join(repoRoot, 'scripts', 'flyers', 'sept19-2026.html'))).rejects.toThrow();
    });
});
