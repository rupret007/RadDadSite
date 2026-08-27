// @vitest-environment node

import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(fileURLToPath(new URL('../..', import.meta.url)));
const gptHtmlPath = join(repoRoot, 'GPT', 'index.html');
const FEATURED_VIDEO_ID = '4ReFoSZHL7o';
const RETIRED_VIDEO_ID = ['_IwRtmu', 'TKBY'].join('');
const TEXT_EXTENSIONS = new Set([
    '.css',
    '.html',
    '.js',
    '.json',
    '.md',
    '.mjs',
    '.sh',
    '.txt',
    '.yml',
    '.yaml'
]);
const SKIPPED_DIRECTORY_NAMES = new Set([
    '.git',
    'backup_restore_point',
    'dist',
    'node_modules',
    'playwright-report',
    'test-results'
]);

async function collectTextFiles(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const absolutePath = join(directory, entry.name);

        if (entry.isDirectory()) {
            if (SKIPPED_DIRECTORY_NAMES.has(entry.name)) {
                continue;
            }

            files.push(...await collectTextFiles(absolutePath));
            continue;
        }

        if (!entry.isFile()) {
            continue;
        }

        const extension = entry.name.includes('.')
            ? `.${entry.name.split('.').pop()}`
            : '';

        if (TEXT_EXTENSIONS.has(extension)) {
            files.push(absolutePath);
        }
    }

    return files;
}

describe('ChatGPT Sites video', () => {
    it('features the Wildflower Tomorrow’s Another Day clip on GPT/index.html', async () => {
        const html = await readFile(gptHtmlPath, 'utf8');

        expect(html).toContain(`videoId: "${FEATURED_VIDEO_ID}"`);
        expect(html).toContain(`https://youtu.be/${FEATURED_VIDEO_ID}`);
        expect(html).toContain(`https://i.ytimg.com/vi/${FEATURED_VIDEO_ID}/maxresdefault.jpg`);
        expect(html).toContain('Tomorrow’s Another Day — MxPx cover');
        expect(html).toContain('New on YouTube · Wildflower 2026');
        expect(html).toContain('Rad Dad performing Tomorrow’s Another Day by MxPx live at Wildflower Festival');
        expect(html).not.toContain(RETIRED_VIDEO_ID);
        expect(html).not.toContain('startSeconds: 14');
        expect(html).not.toContain('Starts at 0:14');
    });

    it('does not keep the retired Tomorrow’s Another Day clip outside backup_restore_point', async () => {
        const leftovers = [];

        for (const filePath of await collectTextFiles(repoRoot)) {
            const contents = await readFile(filePath, 'utf8');

            if (contents.includes(RETIRED_VIDEO_ID)) {
                leftovers.push(relative(repoRoot, filePath).split(sep).join('/'));
            }
        }

        expect(leftovers).toEqual([]);
    });
});
