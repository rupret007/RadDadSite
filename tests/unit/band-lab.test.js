// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { readFile, access, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLIENT_SOURCE_PATHS } from '../../scripts/lib/production-artifact.mjs';

const repoRoot = join(fileURLToPath(new URL('../..', import.meta.url)));
const BAND_LAB_DIR = 'private/garage-rehearsal-k7m2n9';
const BAND_LAB_PAGE = `${BAND_LAB_DIR}/index.html`;
const BAND_LAB_NEXT_PLAY = `${BAND_LAB_DIR}/next-play.js`;
const TURDANOID_DIR = `${BAND_LAB_DIR}/turdanoid`;
const TURDANOID_HUB = `${TURDANOID_DIR}/index.html`;
const BAND_LAB_DOC = 'docs/BAND_LAB.md';
const TURDANOID_PIN = '600b96caa3064368f44cc8b79eb8c97950211fee';
const SEWER_SET = [
    { label: 'TurdAnoid Turbo', href: 'turdanoid/TurdAnoid.html', page: 'TurdAnoid.html' },
    { label: 'Turdtris', href: 'turdanoid/turdtris.html', page: 'turdtris.html' },
    { label: 'Crapjack 21', href: 'turdanoid/turdjack.html', page: 'turdjack.html' },
    { label: 'Crappy Eights', href: 'turdanoid/crapeights.html', page: 'crapeights.html' },
    { label: 'TurdRummy', href: 'turdanoid/turdrummy.html', page: 'turdrummy.html' },
    { label: 'TurdSpades', href: 'turdanoid/turdspades.html', page: 'turdspades.html' }
];

// Git blob SHAs from rupret007/Turdanoid @ TURDANOID_PIN. Update SOURCE.txt
// and this map together if the vendored snapshot is intentionally re-pinned.
const VENDORED_BLOBS = Object.freeze({
    'TurdAnoid.html': '8bf18983b923e36971d4602d4e0c91e048d07366',
    'favicon.svg': '248223aa66a71be257c85a258792d73e251fb46f',
    'crapeights.html': '5838236bc00725074567e71ab6afe6aee2f0aa4a',
    'game.js': 'e3ede9b0906d9e91f7b82e102b97750fd340fec8',
    'turdrummy.html': 'cc21e4fffa9755be63c3428c88e1fba45fe95888',
    'index.html': 'afa142ee0dcbeea4e8639d63d8ffcd9dafe41739',
    'neon-arkanoid.html': '91da7fd8a4b589ac0f9277c7f72ba52eafc7be8d',
    'turdtris.html': '8cc809816959bdba2410633fbdddac1032c66e7c',
    'hub.html': '81c5bb81596c58a412ce24178104500c6ecd12de',
    'assets/turdsuite.js': '81abd59da5beae3adf477c9611232d954ea2a8d5',
    'assets/turdsuite.css': '293760b47d553d6349f5248aff6d3b30a9b6264d',
    'turdjack.html': 'cb43b6e1e6c154916776a7c26ca0975d5a156623',
    'turdspades.html': '7d64703e278ab55125b3f6ca347293e0f4b72f6d',
    'games/table-continue-core.js': '9d7e18ff87b483d43cdb13ebf5f427c8bf2b6c28'
});

const ENGINE_SOURCES_LEFT_BEHIND = [
    'games/cards.js',
    'games/crapeights-engine.js',
    'games/table-continue.js',
    'games/turdanoid_logic.js',
    'games/turdjack-engine.js',
    'games/turdrummy-engine.js',
    'games/turdspades-engine.js',
    'games/turdtris-engine.js',
    'games/turdtris_logic.js'
];

function gitHashObject(relativePath) {
    return execFileSync('git', ['hash-object', relativePath], {
        cwd: repoRoot,
        encoding: 'utf8'
    }).trim();
}

describe('unlisted band lab', () => {
    it('exists as a noindex page with a same-origin Turdanoid hub and a non-live WebJam slot', async () => {
        const html = await readFile(join(repoRoot, BAND_LAB_PAGE), 'utf8');
        const webjam = html.match(/<aside\b[^]*?<\/aside>/i)?.[0] ?? '';

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
        expect(webjam).toBeTruthy();
        expect(webjam).not.toMatch(/<iframe\b/i);
        expect(webjam).not.toMatch(/src=["']https?:/i);
        expect(html).not.toMatch(/navigator\.share|clipboard|shareDetails/i);
        expect(html).toContain('href="turdanoid/index.html"');
        expect(html).toContain('Open the sewer full-page');
        expect(html).toContain('src="turdanoid/games/table-continue-core.js"');
        expect(html).toContain('src="next-play.js"');
        expect(html).toContain('Reserved seat. Not a stream. Not a date.');
    });

    it('names the six-game sewer set as same-folder doors and keeps return-visit leftovers honest', async () => {
        const html = await readFile(join(repoRoot, BAND_LAB_PAGE), 'utf8');
        const leftovers = await readFile(join(repoRoot, BAND_LAB_DOC), 'utf8');
        const setlist = html.match(/<ol class="band-lab-setlist">[^]*?<\/ol>/)?.[0] ?? '';
        const stickerHrefs = [...setlist.matchAll(/href="([^"]+)"/g)].map((match) => match[1]);

        expect(setlist).toBeTruthy();
        for (const game of SEWER_SET) {
            expect(setlist).toContain(game.label);
            expect(setlist).toContain(`href="${game.href}"`);
        }
        expect(stickerHrefs).toEqual(SEWER_SET.map((game) => game.href));
        expect(setlist).not.toMatch(/https?:/i);
        expect(setlist).not.toContain('neon-arkanoid');
        expect(html).toContain('data-band-lab-next-play');
        expect(html).toContain('Open the sewer hub');
        expect(html).toContain('This URL is not a lock.');
        expect(html).toContain('Arcade mid-run saves stay parked with Turdanoid #8.');
        expect(html).toContain('Obscurity is not access control.');
        expect(html).toContain('No share widget on purpose.');
        expect(html).toContain('PRE_KAREN leftovers');
        expect(leftovers).toContain('Obscurity is not access control.');
        expect(leftovers).toContain(TURDANOID_PIN);
        expect(leftovers).toContain('does **not** add `/private/` to that allowlist');
        expect(leftovers).toContain('2b1864fa118962abf98c5cf34acdbf58f4f1d699');
        expect(leftovers).toContain('never writes those keys');
    });

    it('resolves one next-play ticket from allowlisted continue or last-played only', async () => {
        const { JSDOM } = await import('jsdom');
        const source = await readFile(join(repoRoot, BAND_LAB_NEXT_PLAY), 'utf8');
        const html = `<!DOCTYPE html><html><body>
            <div data-band-lab-next>
                <a data-band-lab-next-play href="turdanoid/index.html">Open the sewer hub</a>
                <span data-band-lab-next-note>fallback</span>
            </div>
        </body></html>`;
        const { window } = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.test/private/lab/' });
        window.eval(source);
        const api = window.BandLabNextPlay;
        const storage = {
            values: Object.create(null),
            getItem(key) {
                return Object.prototype.hasOwnProperty.call(this.values, key) ? this.values[key] : null;
            },
            setItem(key, value) {
                this.values[key] = String(value);
            }
        };

        expect(api.SEWER_GAMES.map((game) => game.page)).toEqual(SEWER_SET.map((game) => game.page));
        expect(api.resolveNextPlay(storage, null)).toMatchObject({
            kind: 'hub',
            href: 'turdanoid/index.html',
            action: 'Open the sewer hub'
        });

        storage.setItem(api.LAST_GAME_KEY, 'turdtris.html');
        expect(api.resolveNextPlay(storage, null)).toMatchObject({
            kind: 'again',
            page: 'turdtris.html',
            href: 'turdanoid/turdtris.html',
            action: 'Play Turdtris again'
        });

        storage.setItem(api.LAST_GAME_KEY, 'neon-arkanoid.html');
        expect(api.resolveNextPlay(storage, null).kind).toBe('hub');

        storage.setItem(api.LAST_GAME_KEY, '<img src=x onerror=alert(1)>');
        expect(api.resolveNextPlay(storage, null).kind).toBe('hub');

        storage.setItem(api.LAST_GAME_KEY, 'TurdAnoid.html');
        const continueFirst = api.resolveNextPlay(storage, {
            listLiveContinuePages() {
                return ['turdspades.html', 'javascript:alert(1)', 'neon-arkanoid.html'];
            }
        });
        expect(continueFirst).toMatchObject({
            kind: 'continue',
            page: 'turdspades.html',
            href: 'turdanoid/turdspades.html',
            action: 'Continue TurdSpades'
        });

        const ignoredUnknown = api.resolveNextPlay(storage, {
            listLiveContinuePages() {
                return ['evil.html', 'neon-arkanoid.html'];
            }
        });
        expect(ignoredUnknown.kind).toBe('again');
        expect(ignoredUnknown.page).toBe('TurdAnoid.html');

        const thrown = api.resolveNextPlay({
            getItem() {
                throw new Error('blocked');
            }
        }, {
            listLiveContinuePages() {
                throw new Error('bad store');
            }
        });
        expect(thrown.kind).toBe('hub');

        api.applyNextPlay(window.document, {
            href: 'turdanoid/turdjack.html',
            action: '<img src=x>Crapjack',
            note: '<script>alert(1)</script>'
        });
        const link = window.document.querySelector('[data-band-lab-next-play]');
        const note = window.document.querySelector('[data-band-lab-next-note]');
        expect(link.getAttribute('href')).toBe('turdanoid/turdjack.html');
        expect(link.textContent).toBe('<img src=x>Crapjack');
        expect(note.textContent).toBe('<script>alert(1)</script>');
        expect(link.querySelector('img')).toBeNull();
        expect(note.querySelector('script')).toBeNull();
        expect(source).not.toMatch(/innerHTML/);
        expect(source).not.toMatch(/navigator\.share|clipboard/i);
    });

    it('keeps the vendored six-game hub playable without rewriting Neon', async () => {
        const hub = await readFile(join(repoRoot, TURDANOID_HUB), 'utf8');
        const sourceNote = await readFile(join(repoRoot, `${TURDANOID_DIR}/SOURCE.txt`), 'utf8');

        expect(sourceNote).toContain(TURDANOID_PIN);
        expect(sourceNote).toContain('Do not silently re-pin.');
        expect(hub).toContain('href="TurdAnoid.html"');
        expect(hub).toContain('href="turdtris.html"');
        expect(hub).toContain('href="turdjack.html"');
        expect(hub).toContain('href="crapeights.html"');
        expect(hub).toContain('href="turdrummy.html"');
        expect(hub).toContain('href="turdspades.html"');
        expect(hub).toContain('href="neon-arkanoid.html"');

        await Promise.all([
            access(join(repoRoot, `${TURDANOID_DIR}/TurdAnoid.html`)),
            access(join(repoRoot, `${TURDANOID_DIR}/game.js`)),
            access(join(repoRoot, `${TURDANOID_DIR}/assets/turdsuite.js`)),
            access(join(repoRoot, `${TURDANOID_DIR}/games/table-continue-core.js`))
        ]);
    });

    it('blob-matches the documented Turdanoid pin and leaves unused engine sources behind', async () => {
        const sourceNote = await readFile(join(repoRoot, `${TURDANOID_DIR}/SOURCE.txt`), 'utf8');
        expect(sourceNote).toContain(`Pinned commit: ${TURDANOID_PIN}`);

        for (const [relativePath, expectedSha] of Object.entries(VENDORED_BLOBS)) {
            expect(gitHashObject(`${TURDANOID_DIR}/${relativePath}`), relativePath).toBe(expectedSha);
        }

        const presentEngines = await Promise.all(
            ENGINE_SOURCES_LEFT_BEHIND.map(async (relativePath) => {
                try {
                    await access(join(repoRoot, TURDANOID_DIR, relativePath));
                    return relativePath;
                } catch {
                    return null;
                }
            })
        );

        expect(presentEngines.filter(Boolean)).toEqual([]);

        const vendorFiles = await readdir(join(repoRoot, TURDANOID_DIR), { recursive: true });
        expect(vendorFiles.filter((name) => name.endsWith('.js') || name.endsWith('.html')))
            .not
            .toContain('games/turdanoid_logic.js');
        expect(vendorFiles).not.toContain('games/turdjack-engine.js');
    });

    it('stays out of the production public-site artifact allowlist', () => {
        expect(CLIENT_SOURCE_PATHS.some((path) => path.startsWith('private/'))).toBe(false);
        expect(CLIENT_SOURCE_PATHS).not.toContain(BAND_LAB_PAGE);
        expect(CLIENT_SOURCE_PATHS).not.toContain(BAND_LAB_NEXT_PLAY);
        expect(CLIENT_SOURCE_PATHS).not.toContain(BAND_LAB_DOC);
        expect(CLIENT_SOURCE_PATHS.some((path) => path.includes('turdanoid'))).toBe(false);
        expect(CLIENT_SOURCE_PATHS.some((path) => path.includes('next-play'))).toBe(false);
    });
});
