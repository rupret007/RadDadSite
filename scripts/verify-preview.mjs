import { createHash } from 'node:crypto';
import { lstat, readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLIENT_SOURCE_PATHS } from './lib/production-artifact.mjs';
import { PREVIEW_URL, PREVIEW_OMITTED_ASSETS } from './build-preview.mjs';

export async function verifyPreviewArtifact({ artifactRoot, manifestPath, expectedSha }) {
    if (!/^[a-f0-9]{40}$/.test(expectedSha || '')) throw new Error('An exact expected source SHA is required.');
    if ((await lstat(artifactRoot)).isSymbolicLink()) throw new Error('Preview root must not be a symlink.');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (manifest.previewUrl !== PREVIEW_URL || manifest.sourceCommitSha !== expectedSha) throw new Error('Preview identity mismatch.');
    const expected = [...CLIENT_SOURCE_PATHS.filter(path => !PREVIEW_OMITTED_ASSETS.includes(path)), 'version.json', 'robots.txt'].sort();
    const actual = [];
    async function walk(dir, prefix = '') {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const path = prefix + entry.name;
            if (entry.isDirectory()) await walk(join(dir, entry.name), path + '/');
            else if (entry.isFile()) actual.push(path);
            else throw new Error(`Unsupported preview entry: ${path}`);
        }
    }
    await walk(artifactRoot);
    const listed = manifest.files?.map(file => file.path).sort();
    if (JSON.stringify(actual.sort()) !== JSON.stringify(expected) || JSON.stringify(listed) !== JSON.stringify(expected)) {
        throw new Error('Preview public inventory mismatch.');
    }
    for (const file of manifest.files) {
        const bytes = await readFile(join(artifactRoot, file.path));
        if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Preview checksum mismatch: ${file.path}`);
        if (file.path.endsWith('.html') && !bytes.toString().includes('noindex,nofollow,noarchive')) throw new Error(`Missing preview noindex: ${file.path}`);
    }
    const version = JSON.parse(await readFile(join(artifactRoot, 'version.json'), 'utf8'));
    if (version.commitSha !== expectedSha) throw new Error('Published preview version mismatch.');
    for (const path of ['index.html', 'qr/index.html']) {
        const html = await readFile(join(artifactRoot, path), 'utf8');
        if (!html.includes('data-design-preview') || !html.includes('RAD DAD · DESIGN PREVIEW')) throw new Error('Missing preview identity/share mode.');
    }
    if (await readFile(join(artifactRoot, 'robots.txt'), 'utf8') !== 'User-agent: *\nDisallow: /\n') throw new Error('Invalid preview robots policy.');
    return { sourceCommitSha: expectedSha, fileCount: actual.length, previewUrl: PREVIEW_URL };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const args = process.argv.slice(2);
    const root = resolve(import.meta.dirname, '..');
    const value = name => {
        const at = args.indexOf(name);
        return at < 0 ? null : args[at + 1];
    };
    const result = await verifyPreviewArtifact({
        artifactRoot: resolve(value('--artifact-dir') || join(root, 'preview-dist')),
        manifestPath: join(root, 'preview-artifact.json'),
        expectedSha: value('--expected-sha')
    });
    console.log(JSON.stringify(result));
}
