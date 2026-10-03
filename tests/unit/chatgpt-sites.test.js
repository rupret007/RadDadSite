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
    it('redirects the legacy GPT page to the canonical band homepage', async () => {
        const html = await readFile(gptHtmlPath, 'utf8');
        expect(html).toContain('content="noindex"');
        expect(html).toContain('content="0; url=../"');
        expect(html).toContain('href="https://raddadband.com/"');
        expect(html).toContain("new URL('../', window.location.href)");
        expect(html).not.toMatch(/September|EventScheduled|original song/i);
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
