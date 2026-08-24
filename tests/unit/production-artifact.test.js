// @vitest-environment node

import { execFileSync } from 'node:child_process';
import {
    cp,
    mkdtemp,
    mkdir,
    readFile,
    rm,
    symlink,
    writeFile
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
    CHECKSUM_FILENAME,
    CLIENT_SOURCE_PATHS,
    MANIFEST_FILENAME,
    copyProductionClient,
    finalizeProductionArtifact,
    resolveBuildIdentity,
    verifyProductionArtifact
} from '../../scripts/lib/production-artifact.mjs';

const repoRoot = resolve(import.meta.dirname, '..', '..');
const temporaryDirectories = [];
const TEST_SHA = '0123456789abcdef0123456789abcdef01234567';
const TEST_TIMESTAMP = '2026-07-28T12:34:56.000Z';

async function createTemporaryDirectory() {
    const directory = await mkdtemp(join(tmpdir(), 'rad-dad-artifact-'));
    temporaryDirectories.push(directory);
    return directory;
}

async function seedPayload(artifactRoot) {
    for (const path of CLIENT_SOURCE_PATHS) {
        const destination = join(artifactRoot, path);
        await mkdir(dirname(destination), { recursive: true });
        await writeFile(destination, `fixture:${path}\n`, 'utf8');
    }
}

async function createValidArtifact() {
    const artifactRoot = await createTemporaryDirectory();
    await seedPayload(artifactRoot);
    await finalizeProductionArtifact({
        artifactRoot,
        commitSha: TEST_SHA,
        timestamp: TEST_TIMESTAMP
    });
    return artifactRoot;
}

afterEach(async () => {
    await Promise.all(
        temporaryDirectories.splice(0).map((directory) =>
            rm(directory, { force: true, recursive: true })
        )
    );
});

describe('production artifact identity', () => {
    it('uses exact CI overrides and canonicalizes the timestamp', () => {
        expect(resolveBuildIdentity({
            projectRoot: repoRoot,
            env: {
                DEPLOY_COMMIT_SHA: TEST_SHA.toUpperCase(),
                BUILD_TIMESTAMP: '2026-07-28T07:34:56-05:00'
            }
        })).toEqual({
            commitSha: TEST_SHA,
            timestamp: TEST_TIMESTAMP
        });
    });

    it('falls back to the exact local Git HEAD and its deterministic commit timestamp', () => {
        const expectedSha = execFileSync(
            'git',
            ['rev-parse', '--verify', 'HEAD^{commit}'],
            { cwd: repoRoot, encoding: 'utf8' }
        ).trim();
        const expectedTimestamp = new Date(execFileSync(
            'git',
            ['show', '-s', '--format=%cI', expectedSha],
            { cwd: repoRoot, encoding: 'utf8' }
        ).trim()).toISOString();

        expect(resolveBuildIdentity({
            projectRoot: repoRoot,
            env: {}
        })).toEqual({
            commitSha: expectedSha,
            timestamp: expectedTimestamp
        });
    });

    it('rejects abbreviated or otherwise invalid CI commit identifiers', () => {
        expect(() => resolveBuildIdentity({
            projectRoot: repoRoot,
            env: {
                DEPLOY_COMMIT_SHA: 'abc123',
                BUILD_TIMESTAMP: TEST_TIMESTAMP
            }
        })).toThrow(/exact 40-character Git commit SHA/);
    });
});

describe('production artifact generation', () => {
    it('creates deterministic metadata, a JSON manifest, and complete checksums', async () => {
        const firstRoot = await createValidArtifact();
        const secondRoot = await createValidArtifact();

        for (const filename of ['version.json', MANIFEST_FILENAME, CHECKSUM_FILENAME]) {
            expect(await readFile(join(firstRoot, filename), 'utf8'))
                .toBe(await readFile(join(secondRoot, filename), 'utf8'));
        }

        const manifest = JSON.parse(
            await readFile(join(firstRoot, MANIFEST_FILENAME), 'utf8')
        );
        const checksumLines = (
            await readFile(join(firstRoot, CHECKSUM_FILENAME), 'utf8')
        ).trim().split('\n');

        expect(manifest.commitSha).toBe(TEST_SHA);
        expect(manifest.timestamp).toBe(TEST_TIMESTAMP);
        expect(manifest.files).toHaveLength(CLIENT_SOURCE_PATHS.length + 1);
        expect(checksumLines).toHaveLength(manifest.files.length + 1);
        expect(checksumLines.some((line) => line.endsWith(`  ${MANIFEST_FILENAME}`))).toBe(true);

        await expect(verifyProductionArtifact({
            artifactRoot: firstRoot,
            expectedSha: TEST_SHA
        })).resolves.toMatchObject({
            commitSha: TEST_SHA,
            timestamp: TEST_TIMESTAMP,
            files: CLIENT_SOURCE_PATHS.length + 3
        });
    });

    it('copies only the explicit website allowlist into the client artifact', async () => {
        const artifactRoot = await createTemporaryDirectory();
        await copyProductionClient({
            projectRoot: repoRoot,
            clientRoot: artifactRoot
        });
        await finalizeProductionArtifact({
            artifactRoot,
            commitSha: TEST_SHA,
            timestamp: TEST_TIMESTAMP
        });

        await expect(verifyProductionArtifact({
            artifactRoot,
            expectedSha: TEST_SHA
        })).resolves.toBeDefined();

        await expect(readFile(join(artifactRoot, 'package.json'))).rejects.toThrow();
        await expect(readFile(join(artifactRoot, 'RadDad_OnePage_Site.zip'))).rejects.toThrow();
        await expect(readFile(join(artifactRoot, 'worker/index.js'))).rejects.toThrow();
        await expect(readFile(join(artifactRoot, 'tap/index.html'), 'utf8')).resolves.toBeTruthy();
        await expect(readFile(join(artifactRoot, 'qr/index.html'), 'utf8')).resolves.toBeTruthy();
        await expect(readFile(join(artifactRoot, 'qr/script.js'), 'utf8')).resolves.toBeTruthy();
        await expect(readFile(join(artifactRoot, 'qr/styles.css'), 'utf8')).resolves.toBeTruthy();
    });
});

describe('production artifact verification', () => {
    it('rejects local website references missing from the explicit artifact allowlist', async () => {
        const artifactRoot = await createValidArtifact();
        await writeFile(
            join(artifactRoot, 'index.html'),
            '<link rel="stylesheet" href="styles.css"><img src="assets/not-deployed.webp">\n',
            'utf8'
        );

        await expect(verifyProductionArtifact({
            artifactRoot,
            expectedSha: TEST_SHA
        })).rejects.toThrow(/references a local file missing from the production artifact/);
    });

    it('checks nested landing-page references and directory routes', async () => {
        const artifactRoot = await createValidArtifact();
        await writeFile(
            join(artifactRoot, 'qr/index.html'),
            '<a href="/missing-route/"><img src="../assets/not-deployed.webp"></a>\n',
            'utf8'
        );

        await expect(verifyProductionArtifact({
            artifactRoot,
            expectedSha: TEST_SHA
        })).rejects.toThrow(/qr\/index\.html references a local file missing/);
    });

    it('rejects a payload whose bytes no longer match the manifest or checksums', async () => {
        const artifactRoot = await createValidArtifact();
        await writeFile(join(artifactRoot, 'styles.css'), 'tampered\n', 'utf8');

        await expect(verifyProductionArtifact({
            artifactRoot,
            expectedSha: TEST_SHA
        })).rejects.toThrow(/verification failed for styles\.css/);
    });

    it('rejects an incomplete SHA256SUMS file', async () => {
        const artifactRoot = await createValidArtifact();
        const checksumPath = join(artifactRoot, CHECKSUM_FILENAME);
        const lines = (await readFile(checksumPath, 'utf8')).trim().split('\n');
        await writeFile(checksumPath, `${lines.slice(1).join('\n')}\n`, 'utf8');

        await expect(verifyProductionArtifact({
            artifactRoot,
            expectedSha: TEST_SHA
        })).rejects.toThrow(/must list every artifact file except itself exactly once/);
    });

    it('rejects unsafe and duplicate paths in SHA256SUMS', async () => {
        const cases = [
            {
                name: 'absolute path',
                mutate: (lines) => [
                    lines[0].replace(/  .+$/, '  /etc/passwd'),
                    ...lines.slice(1)
                ],
                pattern: /Unsafe path/
            },
            {
                name: 'parent traversal',
                mutate: (lines) => [
                    lines[0].replace(/  .+$/, '  ../styles.css'),
                    ...lines.slice(1)
                ],
                pattern: /Unsafe path/
            },
            {
                name: 'duplicate path',
                mutate: (lines) => [lines[0], lines[0], ...lines.slice(1)],
                pattern: /Duplicate path/
            }
        ];

        for (const testCase of cases) {
            const artifactRoot = await createValidArtifact();
            const checksumPath = join(artifactRoot, CHECKSUM_FILENAME);
            const lines = (await readFile(checksumPath, 'utf8')).trim().split('\n');
            await writeFile(
                checksumPath,
                `${testCase.mutate(lines).join('\n')}\n`,
                'utf8'
            );

            await expect(
                verifyProductionArtifact({
                    artifactRoot,
                    expectedSha: TEST_SHA
                }),
                testCase.name
            ).rejects.toThrow(testCase.pattern);
        }
    });

    it('verifies the artifact manifest checksum as well as payload checksums', async () => {
        const artifactRoot = await createValidArtifact();
        const manifestPath = join(artifactRoot, MANIFEST_FILENAME);
        await writeFile(
            manifestPath,
            `${await readFile(manifestPath, 'utf8')}\n`,
            'utf8'
        );

        await expect(verifyProductionArtifact({
            artifactRoot,
            expectedSha: TEST_SHA
        })).rejects.toThrow(
            new RegExp(`${CHECKSUM_FILENAME} verification failed for ${MANIFEST_FILENAME}`)
        );
    });

    it('rejects symlinks, dotfiles, unexpected roots, and development files', async () => {
        const baseRoot = await createValidArtifact();

        const cases = [
            {
                name: 'symlink',
                mutate: async (root) => {
                    await symlink(join(root, 'styles.css'), join(root, 'linked.css'));
                },
                pattern: /Symlinks are forbidden/
            },
            {
                name: 'dotfile',
                mutate: async (root) => {
                    await writeFile(join(root, '.env'), 'SECRET=nope\n', 'utf8');
                },
                pattern: /Dotfiles are forbidden/
            },
            {
                name: 'unexpected root entry',
                mutate: async (root) => {
                    await writeFile(join(root, 'notes.txt'), 'not deployable\n', 'utf8');
                },
                pattern: /Unexpected file/
            },
            {
                name: 'development file',
                mutate: async (root) => {
                    await writeFile(join(root, 'package.json'), '{}\n', 'utf8');
                },
                pattern: /Forbidden repository, archive, log, or credential file/
            }
        ];

        for (const testCase of cases) {
            const artifactRoot = await createTemporaryDirectory();
            await cp(baseRoot, artifactRoot, { recursive: true });
            await testCase.mutate(artifactRoot);

            await expect(
                verifyProductionArtifact({
                    artifactRoot,
                    expectedSha: TEST_SHA
                }),
                testCase.name
            ).rejects.toThrow(testCase.pattern);
        }
    });

    it('rejects an artifact that identifies a different commit', async () => {
        const artifactRoot = await createValidArtifact();

        await expect(verifyProductionArtifact({
            artifactRoot,
            expectedSha: 'ffffffffffffffffffffffffffffffffffffffff'
        })).rejects.toThrow(/not expected commit/);
    });
});
