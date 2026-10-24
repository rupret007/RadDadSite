import { cp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { verifyProductionArtifact } from './lib/production-artifact.mjs';

// Only the approved, verified client artifact crosses into the separate preview deployment.
const root = resolve(import.meta.dirname, '..');
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
        html = html.replace(/<head\b[^>]*>/i, '$&\n<meta name="robots" content="noindex,nofollow,noarchive">');
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
await writeFile(join(target, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
await writeFile(join(target, 'vercel.json'), JSON.stringify({
    trailingSlash: true,
    cleanUrls: false,
    headers: [{ source: '/(.*)', headers: [
        { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ] }]
}, null, 2) + '\n');
// The reviewed variant has different bytes. Don't expose checksums for the unmodified build.
for (const name of ['artifact-manifest.json', 'SHA256SUMS']) await rm(join(target, name));
console.log(`Separate preview ready in ${target}; base artifact: ${JSON.stringify(verified)}.`);
