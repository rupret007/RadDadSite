// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPreview, PREVIEW_URL } from '../../scripts/build-preview.mjs';
import { verifyPreviewArtifact } from '../../scripts/verify-preview.mjs';
import { CLIENT_SOURCE_PATHS, finalizeProductionArtifact } from '../../scripts/lib/production-artifact.mjs';

const roots = [];
const SHA = '0123456789abcdef0123456789abcdef01234567';
async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'raddad-preview-'));
    roots.push(root);
    const artifactRoot = join(root, 'dist/client');
    for (const path of CLIENT_SOURCE_PATHS) {
        const file = join(artifactRoot, path);
        await mkdir(dirname(file), { recursive: true });
        const content = path.endsWith('.html')
            ? '<!doctype html><html><head><link rel="canonical" href="https://raddadband.com/"><meta property="og:url" content="https://raddadband.com/"><meta property="og:image" content="https://raddadband.com/RadDad_Logo.jpg"><meta name="twitter:image" content="https://raddadband.com/RadDad_Logo.jpg"></head><body>Review fixture</body></html>'
            : `fixture:${path}`;
        await writeFile(file, content);
    }
    await finalizeProductionArtifact({ artifactRoot, commitSha: SHA, timestamp: '2026-10-24T10:00:00Z' });
    return root;
}
afterEach(async () => Promise.all(roots.splice(0).map(path => rm(path, { recursive: true, force: true }))));

describe('independent Sites review artifact', () => {
    it('reproducibly packages preview URLs, noindex, share behavior and hashes without production config', async () => {
        const root = await fixture();
        await mkdir(join(root, '.openai'));
        const productionConfig = '{"project_id":"established-site-do-not-touch"}';
        await writeFile(join(root, '.openai/hosting.json'), productionConfig);
        const first = await buildPreview({ projectRoot: root });
        expect(first.manifest.sourceCommitSha).toBe(SHA);
        for (const path of ['index.html', 'qr/index.html', 'play/turdtris.html']) {
            const html = await readFile(join(first.target, path), 'utf8');
            expect(html).toContain('noindex,nofollow,noarchive');
            expect(html).not.toContain('rel="canonical"');
            const route = path.replace(/index\.html$/, '').replace(/\.html$/, '');
            expect(html).toContain(`property="og:url" content="${new URL(route, PREVIEW_URL).href}"`);
            expect(html).toContain(`property="og:image" content="${PREVIEW_URL}RadDad_Logo.jpg"`);
            expect(html).toContain(`name="twitter:image" content="${PREVIEW_URL}RadDad_Logo.jpg"`);
            if (path !== 'play/turdtris.html') {
                expect(html).toContain('data-design-preview');
                expect(html).toContain('RAD DAD · DESIGN PREVIEW');
            }
            const hash = createHash('sha256').update(html).digest('hex');
            expect(first.manifest.files.find(file => file.path === path).sha256).toBe(hash);
        }
        expect(await readFile(join(first.target, 'robots.txt'), 'utf8')).toBe('User-agent: *\nDisallow: /\n');
        for (const path of ['vercel.json', '.openai/hosting.json', 'artifact-manifest.json', 'SHA256SUMS']) {
            await expect(readFile(join(first.target, path))).rejects.toThrow();
        }
        expect(await readFile(join(root, '.openai/hosting.json'), 'utf8')).toBe(productionConfig);
        const second = await buildPreview({ projectRoot: root });
        expect(second.manifest).toEqual(first.manifest);
        await expect(verifyPreviewArtifact({ artifactRoot: first.target, manifestPath: join(root, 'preview-artifact.json'), expectedSha: SHA })).resolves.toMatchObject({ sourceCommitSha: SHA });
    });

    it('refuses an unapproved public file before replacing an existing review package', async () => {
        const root = await fixture();
        await mkdir(join(root, 'preview-dist'));
        await writeFile(join(root, 'preview-dist/previous.txt'), 'previous verified review');
        await writeFile(join(root, 'dist/client/private-config.json'), '{"private":true}');
        await expect(buildPreview({ projectRoot: root })).rejects.toThrow();
        expect(await readFile(join(root, 'preview-dist/previous.txt'), 'utf8')).toBe('previous verified review');
        await expect(readFile(join(root, 'preview-dist/private-config.json'))).rejects.toThrow();
    });

    it('rejects stale, modified and over-copied snapshot contents', async () => {
        const root = await fixture();
        const { target } = await buildPreview({ projectRoot: root });
        const options = { artifactRoot: target, manifestPath: join(root, 'preview-artifact.json'), expectedSha: SHA };
        await expect(verifyPreviewArtifact({ ...options, expectedSha: 'a'.repeat(40) })).rejects.toThrow('identity');
        await writeFile(join(target, 'private-config.json'), 'unapproved');
        await expect(verifyPreviewArtifact(options)).rejects.toThrow('inventory');
        await rm(join(target, 'private-config.json'));
        await writeFile(join(target, 'script.js'), '// changed after verification');
        await expect(verifyPreviewArtifact(options)).rejects.toThrow('checksum');
    });
});
