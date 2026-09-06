// @vitest-environment node

import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLIENT_SOURCE_PATHS } from '../../scripts/lib/production-artifact.mjs';

const repoRoot = join(fileURLToPath(new URL('../..', import.meta.url)));
const BAND_LAB_DIR = 'private/garage-rehearsal-k7m2n9';
const BAND_LAB_PAGE = `${BAND_LAB_DIR}/index.html`;
const TURDANOID_HUB = `${BAND_LAB_DIR}/turdanoid/index.html`;

describe('unlisted band lab', () => {
    it('exists as a noindex page with a same-origin Turdanoid hub and a non-live WebJam slot', async () => {
        const html = await readFile(join(repoRoot, BAND_LAB_PAGE), 'utf8');

        expect(html).toContain('name="robots" content="noindex, nofollow, noarchive"');
        expect(html).toContain('name="googlebot" content="noindex, nofollow, noarchive"');
        expect(html).not.toMatch(/<link rel="canonical"/i);
        expect(html).not.toMatch(/<nav\b/i);
        expect(html).not.toContain('href="https://raddadband.com/"');
        expect(html).not.toContain('href="/"');
        expect(html).not.toContain('href="../../"');
        expect(html).toContain('src="turdanoid/index.html"');
        expect(html).toContain('sandbox="allow-scripts allow-same-origin"');
        expect(html).toContain('Coming for band eyes only');
        expect(html).toContain('WebJam-shaped hole');
        expect(html).toContain('Nothing loads. Nothing pretends to stream.');
        expect(html).not.toMatch(/href=["'][^"']*webjam/i);
    });

    it('keeps the vendored six-game hub playable without rewriting Neon', async () => {
        const hub = await readFile(join(repoRoot, TURDANOID_HUB), 'utf8');
        const sourceNote = await readFile(join(repoRoot, `${BAND_LAB_DIR}/turdanoid/SOURCE.txt`), 'utf8');

        expect(sourceNote).toContain('600b96caa3064368f44cc8b79eb8c97950211fee');
        expect(hub).toContain('href="TurdAnoid.html"');
        expect(hub).toContain('href="turdtris.html"');
        expect(hub).toContain('href="turdjack.html"');
        expect(hub).toContain('href="crapeights.html"');
        expect(hub).toContain('href="turdrummy.html"');
        expect(hub).toContain('href="turdspades.html"');
        expect(hub).toContain('href="neon-arkanoid.html"');

        await Promise.all([
            access(join(repoRoot, `${BAND_LAB_DIR}/turdanoid/TurdAnoid.html`)),
            access(join(repoRoot, `${BAND_LAB_DIR}/turdanoid/game.js`)),
            access(join(repoRoot, `${BAND_LAB_DIR}/turdanoid/assets/turdsuite.js`)),
            access(join(repoRoot, `${BAND_LAB_DIR}/turdanoid/games/table-continue-core.js`))
        ]);
    });

    it('stays out of the production public-site artifact allowlist', () => {
        expect(CLIENT_SOURCE_PATHS.some((path) => path.startsWith('private/'))).toBe(false);
        expect(CLIENT_SOURCE_PATHS).not.toContain(BAND_LAB_PAGE);
    });
});
