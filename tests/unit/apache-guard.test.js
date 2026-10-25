// @vitest-environment node
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CLIENT_SOURCE_PATHS } from '../../scripts/lib/production-artifact.mjs';

const root = fileURLToPath(new URL('../..', import.meta.url));
const guard = await readFile(new URL('../../.htaccess', import.meta.url), 'utf8');
const directives = guard.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
const patterns = directives.map(line => {
    const match = line.match(/^RedirectMatch 404 "\(\?i\)(.+)"$/);
    if (!match) throw new Error(`Unexpected Apache boundary directive: ${line}`);
    return new RegExp(match[1], 'i');
});
const denied = path => patterns.some(pattern => pattern.test(path));

describe('legacy Apache root mirror source boundary', () => {
    it.each([
        '/.git/HEAD', '/.github/workflows/test.yml', '/.openai/hosting.json',
        '/.env', '/.env.production', '/.htaccess', '/README.md', '/package.json',
        '/package-lock.json', '/scripts/build-sites.mjs', '/tests/e2e/homepage.spec.js',
        '/test-results/', '/node_modules/', '/GPT/', '/GPT/index.html',
        '/gPt/nested/index.html', '/backup_restore_point/index.html',
        '/private/garage-rehearsal-k7m2n9/index.html', '/worker/index.js',
        '/docs/PUBLIC_LINK_RECOVERY.md', '/pr-assets/review.png', '/dist/client/index.html',
        '/preview-dist/index.html', '/playwright-report/index.html',
        '/playwright.config.js', '/vitest.config.js',
        '/RadDad_OnePage_Site.zip', '/RadDad_OnePage_Site_v2.zip',
        '/RadDad_OnePage_Site_v3.zip', '/RadDad_OnePage_Site_v4.zip', '/RadDad_Website.zip'
    ])('returns a source-boundary error for %s', path => {
        expect(denied(path), path).toBe(true);
    });

    it('preserves every explicit production client path and public release metadata', () => {
        for (const path of [...CLIENT_SOURCE_PATHS, 'version.json', 'artifact-manifest.json', 'SHA256SUMS']) {
            expect(denied('/' + path), path).toBe(false);
        }
    });

    it.each([
        '/', '/qr/', '/qr/index.html', '/tap/', '/nfc/index.html',
        '/.well-known/acme-challenge/verification-token', '/gpt-night/index.html',
        '/docs-show/recap.html', '/private-party/index.html', '/package.json-example',
        '/assets/README.md', '/play/assets/chess/chessground-10.5.0-source.tar.gz',
        '/play/assets/chess/stockfish-19.0.1-source.tar.gz'
    ])('preserves public roots, named GPL source and boundary neighbor %s', path => {
        expect(denied(path), path).toBe(false);
    });

    it('covers every tracked nonpublic root entry so future source additions require a guard decision', () => {
        const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
        const publicRoots = new Set(CLIENT_SOURCE_PATHS.map(path => path.split('/')[0]));
        const entries = new Map();
        for (const path of [...tracked, '.htaccess']) {
            const first = path.split('/')[0];
            if (!publicRoots.has(first)) entries.set(first, path.includes('/'));
        }
        const uncovered = [...entries].filter(([name, directory]) => !denied('/' + name + (directory ? '/source-boundary-probe' : '')));
        expect(uncovered, 'New source-only root paths must be denied without blocking the public inventory').toEqual([]);
    });
});
