import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CLIENT_SOURCE_PATHS } from './production-artifact.mjs';

export function radDadAnalyticsOrigin(site) {
    if (!site) return '';
    if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(site) || site === 'stalemate') {
        throw new Error('RAD_DAD_GOATCOUNTER_SITE must be a separate Rad Dad GoatCounter site code.');
    }
    return `https://${site}.goatcounter.com`;
}

const arcadePages = CLIENT_SOURCE_PATHS.filter(path => /^play\/[^/]+\.html$/.test(path));
const arcadeConnectPolicy = "connect-src 'self'";

export async function addRadDadAnalytics(clientRoot, origin) {
    if (!origin) return;
    for (const file of ['index.html', 'qr/index.html', ...arcadePages]) {
        const path = join(clientRoot, file);
        const page = file === 'play/hub.html' ? '/play/' : `/${file.replace(/index\.html$/, '')}`;
        let html = await readFile(path, 'utf8');
        if (file.startsWith('play/')) {
            html = html.replace(`${arcadeConnectPolicy};`, `${arcadeConnectPolicy} ${origin};`);
            if (!html.includes(`${arcadeConnectPolicy} ${origin};`)) {
                throw new Error(`Cannot set the analytics content policy in ${file}.`);
            }
        }
        html = html.replace('</head>', `<script defer src="/site-analytics.js" data-rad-dad-analytics="${origin}/count" data-page="${page}"></script>\n</head>`);
        await writeFile(path, html);
    }
}

export function stripRadDadAnalytics(html) {
    return html
        .replace(/<script\b[^>]+data-rad-dad-analytics="[^"]+"[^>]*><\/script>\s*/g, '')
        .replace(/connect-src 'self' https:\/\/[a-z0-9-]+\.goatcounter\.com;/g, `${arcadeConnectPolicy};`);
}
