import { createHash } from 'node:crypto';
import { cp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyProductionArtifact } from './lib/production-artifact.mjs';

// Only the approved, verified client artifact crosses into the separate preview deployment.
export const PREVIEW_URL = 'https://rad-dad-design-preview.jeffstory007.chatgpt.site/';
export const PREVIEW_OMITTED_ASSETS = [
    'rad-dad-friends-guitars-growlers-2026-full.png',
    'rad-dad-friends-guitars-growlers-2026-v2-full.png',
    'rad-dad-social-2026.png',
    'rad-dad-social-2026-v2.png',
    'rad-dad-tap-og.png'
].map(name => 'assets/' + name);
export async function buildPreview({ projectRoot = resolve(import.meta.dirname, '..') } = {}) {
    const root = projectRoot;
    const source = join(root, 'dist/client');
    const target = join(root, 'preview-dist');
    const verified = await verifyProductionArtifact({ artifactRoot: source });
    await rm(target, { recursive: true, force: true });
    await cp(source, target, { recursive: true });
    async function pages(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) { await pages(path); continue; }
            if (!entry.name.endsWith('.html')) continue;
            let html = await readFile(path, 'utf8');
            html = html.replace(/<meta\b[^>]*name=["']robots["'][^>]*>\s*/gi, '')
                .replace(/<link\b[^>]*rel=["']canonical["'][^>]*>\s*/gi, '')
                .replace(/<meta\b[^>]*property=["']og:url["'][^>]*>\s*/gi, '');
            const pagePath = relative(target, path).split('\\').join('/').replace(/index\.html$/, '').replace(/\.html$/, '');
            html = html.replace(/<head\b[^>]*>/i, `$&\n<meta name="robots" content="noindex,nofollow,noarchive">\n<meta property="og:url" content="${new URL(pagePath, PREVIEW_URL).href}">`);
            html = html.replace(/<meta\b[^>]*>/gi, tag => {
                if (!/\b(?:property|name)=["'](?:og:image|twitter:image)["']/i.test(tag)) return tag;
                return tag.replace(/\bcontent=(["'])(.*?)\1/i, (match, quote, value) => {
                    const image = new URL(value, new URL(pagePath, PREVIEW_URL));
                    if (image.hostname === 'raddadband.com') image.host = new URL(PREVIEW_URL).host;
                    return `content=${quote}${image.href}${quote}`;
                });
            });
            if (path === join(target, 'index.html') || path === join(target, 'qr/index.html')) {
                html = html.replace(/<body\b/i, '<body data-design-preview');
                const cssPath = path === join(target, 'index.html') ? 'raddad.css' : '../raddad.css';
                if (!html.includes('href="raddad.css"')) html = html.replace('</head>', `<link rel="stylesheet" href="${cssPath}">\n</head>`);
                html = html.replace(/<body\b[^>]*>/i, '$&\n<aside class="review-notice" aria-label="Design preview">RAD DAD · DESIGN PREVIEW</aside>');
                html = html.replace('>Band website</label>', '>Preview link</label>');
            }
            await writeFile(path, html);
        }
    }
    await pages(target);
    // These legacy print/social exports are unused by either review page. Keep them
    // in the verified source artifact, but don't upload them to the preview host.
    const reviewMarkup = (await Promise.all(['index.html', 'qr/index.html', 'styles.css', 'qr/styles.css', 'raddad.css', 'script.js']
        .map(path => readFile(join(target, path), 'utf8')))).join('\n');
    for (const path of PREVIEW_OMITTED_ASSETS) {
        const name = path.slice('assets/'.length);
        if (reviewMarkup.includes(name)) throw new Error(`Preview still references ${name}; keep the asset.`);
        await rm(join(target, 'assets', name));
    }
    await writeFile(join(target, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
    // The reviewed variant has different bytes. Don't expose checksums for the unmodified build.
    for (const name of ['artifact-manifest.json', 'SHA256SUMS']) await rm(join(target, name));
    // This manifest stays outside the public tree and verifies the exact snapshot
    // copied to the independent Sites repository. Never reuse the base checksums.
    const files = [];
    async function hashes(dir) {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) await hashes(path);
            else files.push({ path: relative(target, path).split('\\').join('/'), sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
        }
    }
    await hashes(target);
    const version = JSON.parse(await readFile(join(target, 'version.json'), 'utf8'));
    const manifest = { previewUrl: PREVIEW_URL, sourceCommitSha: version.commitSha, files: files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0) };
    await writeFile(join(root, 'preview-artifact.json'), JSON.stringify(manifest, null, 2) + '\n');
    return { target, verified, manifest };
}
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const result = await buildPreview();
    console.log(`Separate Sites preview ready in ${result.target}; source ${result.manifest.sourceCommitSha}; ${result.manifest.files.length} public files.`);
}
