import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const flyerPage = join(repoRoot, 'scripts', 'flyers', 'sept19-2026.html');
const assetsDir = join(repoRoot, 'assets');

const OUTPUTS = [
    {
        id: 'poster-v2',
        png: 'rad-dad-friends-guitars-growlers-2026-v2-full.png',
        webps: [
            { file: 'rad-dad-friends-guitars-growlers-2026-v2-1024.webp', width: 1024 },
            { file: 'rad-dad-friends-guitars-growlers-2026-v2-512.webp', width: 512 }
        ]
    },
    {
        id: 'poster-v1',
        png: 'rad-dad-friends-guitars-growlers-2026-full.png',
        webps: [
            { file: 'rad-dad-friends-guitars-growlers-2026-1122.webp', width: 1122 },
            { file: 'rad-dad-friends-guitars-growlers-2026-561.webp', width: 561 }
        ]
    },
    {
        id: 'social',
        png: 'rad-dad-social-2026-v2.png',
        copies: ['rad-dad-social-2026.png']
    }
];

function ffmpeg(args) {
    execFileSync('ffmpeg', args, { stdio: 'pipe' });
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
    deviceScaleFactor: 1,
    viewport: { width: 1400, height: 1800 }
});

await page.goto(`file://${flyerPage}`, { waitUntil: 'networkidle' });
await page.evaluate(async () => {
    if (document.fonts?.ready) {
        await document.fonts.ready;
    }
});

await mkdir(assetsDir, { recursive: true });

for (const output of OUTPUTS) {
    const board = page.locator(`#${output.id}`);
    const pngPath = join(assetsDir, output.png);

    await board.screenshot({
        path: pngPath,
        type: 'png',
        animations: 'disabled'
    });

    for (const copy of output.copies ?? []) {
        ffmpeg(['-y', '-i', pngPath, join(assetsDir, copy)]);
    }

    for (const webp of output.webps ?? []) {
        ffmpeg([
            '-y',
            '-i',
            pngPath,
            '-vf',
            `scale=${webp.width}:-1`,
            '-c:v',
            'libwebp',
            '-quality',
            '82',
            join(assetsDir, webp.file)
        ]);
    }
}

await browser.close();
