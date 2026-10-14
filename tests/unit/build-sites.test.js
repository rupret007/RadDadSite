// @vitest-environment node

import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CLIENT_SOURCE_PATHS, verifyProductionArtifact } from '../../scripts/lib/production-artifact.mjs';

const repoRoot = resolve(import.meta.dirname, '../..');
const temporaryDirectories = [];
const commitSha = '0123456789abcdef0123456789abcdef01234567';

async function fixture() {
    const root = await mkdtemp(join(tmpdir(), 'rad-dad-build-'));
    temporaryDirectories.push(root);
    const projectRoot = join(root, 'checkout');
    for (const path of [...CLIENT_SOURCE_PATHS, 'scripts/build-sites.mjs',
        'scripts/lib/production-artifact.mjs', 'worker/index.js']) {
        const destination = join(projectRoot, path);
        await mkdir(dirname(destination), { recursive: true });
        await cp(join(repoRoot, path), destination);
    }
    return { root, projectRoot };
}

function build(projectRoot, args = [], cwd = projectRoot) {
    return execFileSync(process.execPath, [join(projectRoot, 'scripts/build-sites.mjs'), ...args], {
        cwd,
        encoding: 'utf8',
        stdio: 'pipe',
        env: { ...process.env, DEPLOY_COMMIT_SHA: commitSha, BUILD_TIMESTAMP: '2026-10-14T00:00:00.000Z' }
    });
}

async function snapshot(root) {
    const entries = {};
    for (const name of (await readdir(root)).sort()) {
        const path = join(root, name);
        try {
            entries[name] = await snapshot(path);
        } catch (error) {
            if (error.code !== 'ENOTDIR') throw error;
            entries[name] = (await readFile(path)).toString('base64');
        }
    }
    return entries;
}

afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('build output isolation', () => {
    it.each([false, true])('preserves a previous Sites build with custom output (client only: %s)', async (clientOnly) => {
        const { root, projectRoot } = await fixture();
        build(projectRoot);
        const dist = join(projectRoot, 'dist');
        expect(await readFile(join(dist, 'server/index.js'), 'utf8'))
            .toBe(await readFile(join(projectRoot, 'worker/index.js'), 'utf8'));
        await writeFile(join(dist, 'user-sentinel.txt'), 'keep this build\n');
        const before = await snapshot(dist);
        const outputRoot = join(root, 'temporary output');
        const args = ['--output-dir', outputRoot];
        if (clientOnly) args.push('--client-only');

        expect(build(projectRoot, args)).toContain(outputRoot);
        expect(await snapshot(dist)).toEqual(before);
        await expect(verifyProductionArtifact({ artifactRoot: join(outputRoot, 'client'), expectedSha: commitSha }))
            .resolves.toBeDefined();
        expect((await readdir(outputRoot)).sort()).toEqual(clientOnly ? ['client'] : ['client', 'server']);
        if (!clientOnly) {
            expect(await readFile(join(outputRoot, 'server/index.js'), 'utf8'))
                .toBe(await readFile(join(projectRoot, 'worker/index.js'), 'utf8'));
        }
    });

    it('resolves relative output against the working directory and leaves a clean checkout unchanged', async () => {
        const { root, projectRoot } = await fixture();
        const before = await snapshot(projectRoot);
        build(projectRoot, ['--client-only', '--output-dir', 'temporary output'], root);
        expect(await snapshot(projectRoot)).toEqual(before);
        await expect(verifyProductionArtifact({ artifactRoot: join(root, 'temporary output/client'), expectedSha: commitSha }))
            .resolves.toBeDefined();
    });

    it('rejects incomplete or unknown options before removing existing output', async () => {
        const { projectRoot } = await fixture();
        await mkdir(join(projectRoot, 'dist'));
        await writeFile(join(projectRoot, 'dist/sentinel'), 'keep');
        for (const args of [['--output-dir'], ['--output-dir', ''], ['--output-dir', '--client-only'], ['--unknown']]) {
            expect(() => build(projectRoot, args)).toThrow();
            expect(await readFile(join(projectRoot, 'dist/sentinel'), 'utf8')).toBe('keep');
        }
    });
});
