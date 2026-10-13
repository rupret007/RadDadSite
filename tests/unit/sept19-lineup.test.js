// @vitest-environment node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
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

describe('September 19 archive integrity', () => {
    it('keeps the event in past shows without promoting it in either hero', async () => {
        const homepage = await readFile(join(repoRoot, 'index.html'), 'utf8');
        const qr = await readFile(join(repoRoot, 'qr', 'index.html'), 'utf8');
        const archive = homepage.match(/<article[^>]*id="show"[\s\S]*?<\/article>/)[0];
        expect(archive).toContain('Past show');
        expect(archive).toContain('Rad Dad + Friends');
        expect(archive).toContain('The Fault Lines');
        expect(archive).toContain(faultLinesUrl);
        expect(qr).not.toContain('September 19');
        expect(homepage).not.toContain('EventScheduled');
        expect(qr).not.toContain('EventScheduled');
    });
    it('retains approved historical calendar and flyer bytes for existing links', async () => {
        const calendar = await readFile(join(repoRoot, 'assets/rad-dad-friends-guitars-growlers-2026.ics'), 'utf8');
        expect(calendar).toContain('DTSTART:20260920T000000Z');
        expect(calendar).toContain('DTEND:20260920T030000Z');
        expect(calendar).toContain('SUMMARY:Rad Dad + Friends with The Fault Lines');
        for (const [relativePath, expectedHash] of Object.entries(restoredFlyerHashes)) {
            expect(createHash('sha256').update(await readFile(join(repoRoot, relativePath))).digest('hex'), relativePath).toBe(expectedHash);
        }
    });
    it('does not invent lineup order, set times or sponsorship in the archive', async () => {
        const html = await readFile(join(repoRoot, 'index.html'), 'utf8');
        const archive = html.match(/<article[^>]*id="show"[\s\S]*?<\/article>/)[0];
        expect(archive).not.toMatch(/\b(opener|opening|headliner|headline|supporting|set times?|sponsor)\b/i);
        expect(archive).not.toMatch(/download|Get Directions|Add to Calendar/);
    });
});
