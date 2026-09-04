import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
    copyFile,
    lstat,
    mkdir,
    readFile,
    readdir,
    stat,
    writeFile
} from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

export const VERSION_FILENAME = 'version.json';
export const MANIFEST_FILENAME = 'artifact-manifest.json';
export const CHECKSUM_FILENAME = 'SHA256SUMS';

export const CLIENT_SOURCE_PATHS = Object.freeze([
    'RadDad_Logo.jpg',
    'assets/rad-dad-friends-guitars-growlers-2026-1122.webp',
    'assets/rad-dad-friends-guitars-growlers-2026-561.webp',
    'assets/rad-dad-friends-guitars-growlers-2026-v2-1024.webp',
    'assets/rad-dad-friends-guitars-growlers-2026-v2-512.webp',
    'assets/rad-dad-friends-guitars-growlers-2026-v2-full.png',
    'assets/rad-dad-friends-guitars-growlers-2026-full.png',
    'assets/rad-dad-friends-guitars-growlers-2026.ics',
    'assets/rad-dad-social-2026-v2.png',
    'assets/rad-dad-social-2026.png',
    'assets/rad-dad-tap-og.png',
    'assets/story-of-us-cassette-render.webp',
    'assets/story-of-us-cover.webp',
    'assets/the-middle-jimmy-eat-world-thumbnail.webp',
    'assets/wildflower-2026-poster-720.webp',
    'assets/wildflower-she-green-day.webp',
    'index.html',
    'nfc/index.html',
    'qr/index.html',
    'qr/script.js',
    'qr/styles.css',
    'script.js',
    'show-state.js',
    'styles.css',
    'tap/index.html'
]);

const PAYLOAD_PATHS = Object.freeze([
    ...CLIENT_SOURCE_PATHS,
    VERSION_FILENAME
].sort());

const ALL_ARTIFACT_PATHS = Object.freeze([
    ...PAYLOAD_PATHS,
    MANIFEST_FILENAME,
    CHECKSUM_FILENAME
].sort());

const ALLOWED_PATHS = new Set(ALL_ARTIFACT_PATHS);
const ALLOWED_DIRECTORIES = new Set(
    ALL_ARTIFACT_PATHS.flatMap((path) => {
        const directories = [];
        const segments = path.split('/');

        for (let index = 1; index < segments.length; index += 1) {
            directories.push(segments.slice(0, index).join('/'));
        }

        return directories;
    })
);

const PROHIBITED_SEGMENTS = new Set([
    '.git',
    '.github',
    '.openai',
    'GPT',
    'backup_restore_point',
    'node_modules',
    'playwright-report',
    'scripts',
    'test-results',
    'tests',
    'worker'
]);

const PROHIBITED_FILENAMES = new Set([
    'package.json',
    'package-lock.json',
    'README',
    'README.md',
    'npm-debug.log',
    'playwright.config.js',
    'vitest.config.js'
]);

const SHA_PATTERN = /^[0-9a-f]{40}$/;
const CHECKSUM_PATTERN = /^[0-9a-f]{64}$/;

function toPosixPath(path) {
    return path.split(sep).join('/');
}

function stableJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeSha(value, label) {
    const normalized = String(value ?? '').trim().toLowerCase();

    if (!SHA_PATTERN.test(normalized)) {
        throw new Error(`${label} must be an exact 40-character Git commit SHA.`);
    }

    return normalized;
}

function normalizeTimestamp(value, label) {
    const normalized = String(value ?? '').trim();

    if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(normalized)
    ) {
        throw new Error(`${label} must be a valid ISO-8601 timestamp.`);
    }

    const date = new Date(normalized);

    if (Number.isNaN(date.valueOf())) {
        throw new Error(`${label} must be a valid ISO-8601 timestamp.`);
    }

    return date.toISOString();
}

function normalizeSourceDateEpoch(value) {
    const normalized = String(value ?? '').trim();

    if (!/^\d+$/.test(normalized)) {
        throw new Error('SOURCE_DATE_EPOCH must contain whole Unix seconds.');
    }

    const milliseconds = Number(normalized) * 1000;

    if (!Number.isSafeInteger(milliseconds)) {
        throw new Error('SOURCE_DATE_EPOCH is outside the supported date range.');
    }

    return new Date(milliseconds).toISOString();
}

function git(projectRoot, args) {
    try {
        return execFileSync('git', args, {
            cwd: projectRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        }).trim();
    } catch (error) {
        const details = error.stderr?.trim();
        throw new Error(
            `Unable to read build identity from Git${details ? `: ${details}` : '.'}`,
            { cause: error }
        );
    }
}

export function resolveBuildIdentity({
    projectRoot,
    env = process.env
}) {
    const commitSha = env.DEPLOY_COMMIT_SHA
        ? normalizeSha(env.DEPLOY_COMMIT_SHA, 'DEPLOY_COMMIT_SHA')
        : env.GITHUB_SHA
            ? normalizeSha(env.GITHUB_SHA, 'GITHUB_SHA')
            : normalizeSha(
                git(projectRoot, ['rev-parse', '--verify', 'HEAD^{commit}']),
                'Git HEAD'
            );

    let timestamp;

    if (env.BUILD_TIMESTAMP) {
        timestamp = normalizeTimestamp(env.BUILD_TIMESTAMP, 'BUILD_TIMESTAMP');
    } else if (env.SOURCE_DATE_EPOCH) {
        timestamp = normalizeSourceDateEpoch(env.SOURCE_DATE_EPOCH);
    } else {
        timestamp = normalizeTimestamp(
            git(projectRoot, ['show', '-s', '--format=%cI', commitSha]),
            'Git commit timestamp'
        );
    }

    return { commitSha, timestamp };
}

function hasDotSegment(path) {
    return path.split('/').some((segment) => segment.startsWith('.'));
}

function prohibitedReason(path) {
    const segments = path.split('/');
    const filename = segments.at(-1);

    if (segments.some((segment) => PROHIBITED_SEGMENTS.has(segment))) {
        return 'repository or development directory';
    }

    if (
        PROHIBITED_FILENAMES.has(filename)
        || /^\.env(?:\.|$)/i.test(filename)
        || /\.(?:zip|tar|tgz|gz|log|key|pem|p12|pfx)$/i.test(filename)
    ) {
        return 'repository, archive, log, or credential file';
    }

    return null;
}

async function hashFile(path) {
    const contents = await readFile(path);
    return createHash('sha256').update(contents).digest('hex');
}

async function inspectArtifactTree(artifactRoot) {
    const rootDetails = await lstat(artifactRoot);

    if (rootDetails.isSymbolicLink() || !rootDetails.isDirectory()) {
        throw new Error('Production artifact root must be a real directory, not a symlink.');
    }

    const files = [];

    async function visit(directory) {
        const entries = await readdir(directory, { withFileTypes: true });

        for (const entry of entries) {
            const absolutePath = resolve(directory, entry.name);
            const relativePath = toPosixPath(relative(artifactRoot, absolutePath));

            if (hasDotSegment(relativePath)) {
                throw new Error(`Dotfiles are forbidden in the production artifact: ${relativePath}`);
            }

            const reason = prohibitedReason(relativePath);

            if (reason) {
                throw new Error(`Forbidden ${reason} in the production artifact: ${relativePath}`);
            }

            if (entry.isSymbolicLink()) {
                throw new Error(`Symlinks are forbidden in the production artifact: ${relativePath}`);
            }

            if (entry.isDirectory()) {
                if (!ALLOWED_DIRECTORIES.has(relativePath)) {
                    throw new Error(`Unexpected directory in the production artifact: ${relativePath}`);
                }

                await visit(absolutePath);
                continue;
            }

            if (!entry.isFile()) {
                throw new Error(`Unsupported filesystem entry in the production artifact: ${relativePath}`);
            }

            if (!ALLOWED_PATHS.has(relativePath)) {
                throw new Error(`Unexpected file in the production artifact: ${relativePath}`);
            }

            files.push(relativePath);
        }
    }

    await visit(artifactRoot);
    files.sort();

    return files;
}

function localReferencePath(reference, sourcePath) {
    const value = reference.trim().replaceAll('&amp;', '&');

    if (!value || value.startsWith('#')) {
        return null;
    }

    let url;

    try {
        url = new URL(value, `https://artifact.invalid/${sourcePath}`);
    } catch {
        throw new Error(`Invalid local resource reference in ${sourcePath}: ${reference}`);
    }

    if (url.origin !== 'https://artifact.invalid') {
        return null;
    }

    let path;

    try {
        path = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch {
        throw new Error(`Invalid encoded resource path in ${sourcePath}: ${reference}`);
    }

    if (url.pathname.endsWith('/')) {
        path = path ? `${path}index.html` : 'index.html';
    } else if (!path) {
        return null;
    }

    if (path.split('/').includes('..') || path.includes('\\')) {
        throw new Error(`Unsafe local resource reference in ${sourcePath}: ${reference}`);
    }

    return path;
}

async function validateLocalReferences(artifactRoot) {
    const references = [];
    const singleUrlPattern = /\b(?:href|poster|src)\s*=\s*(["'])(.*?)\1/gi;
    const sourceSetPattern = /\b(?:imagesrcset|srcset)\s*=\s*(["'])(.*?)\1/gi;
    const cssUrlPattern = /\burl\(\s*(?:(["'])(.*?)\1|([^)"'\s]+))\s*\)/gi;

    for (const sourcePath of CLIENT_SOURCE_PATHS) {
        if (!sourcePath.endsWith('.html') && !sourcePath.endsWith('.css')) {
            continue;
        }

        const contents = await readFile(resolve(artifactRoot, sourcePath), 'utf8');

        if (sourcePath.endsWith('.html')) {
            for (const match of contents.matchAll(singleUrlPattern)) {
                references.push({ reference: match[2], sourcePath });
            }

            for (const match of contents.matchAll(sourceSetPattern)) {
                for (const candidate of match[2].split(',')) {
                    const reference = candidate.trim().split(/\s+/, 1)[0];
                    references.push({ reference, sourcePath });
                }
            }
        }

        if (sourcePath.endsWith('.css')) {
            for (const match of contents.matchAll(cssUrlPattern)) {
                references.push({
                    reference: match[2] ?? match[3],
                    sourcePath
                });
            }
        }
    }

    for (const { reference, sourcePath } of references) {
        const path = localReferencePath(reference, sourcePath);

        if (path && !ALLOWED_PATHS.has(path)) {
            throw new Error(
                `${sourcePath} references a local file missing from the production artifact: ${path}`
            );
        }
    }
}

function assertExactKeys(value, expectedKeys, label) {
    const actualKeys = Object.keys(value).sort();
    const sortedExpectedKeys = [...expectedKeys].sort();

    if (JSON.stringify(actualKeys) !== JSON.stringify(sortedExpectedKeys)) {
        throw new Error(`${label} has unexpected or missing fields.`);
    }
}

async function readJson(path, label) {
    let value;

    try {
        value = JSON.parse(await readFile(path, 'utf8'));
    } catch (error) {
        throw new Error(`${label} is not valid JSON.`, { cause: error });
    }

    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${label} must contain a JSON object.`);
    }

    return value;
}

function validateVersion(version, expectedSha) {
    assertExactKeys(version, ['commitSha', 'timestamp'], VERSION_FILENAME);
    const commitSha = normalizeSha(version.commitSha, `${VERSION_FILENAME}.commitSha`);
    const timestamp = normalizeTimestamp(version.timestamp, `${VERSION_FILENAME}.timestamp`);

    if (version.timestamp !== timestamp) {
        throw new Error(`${VERSION_FILENAME}.timestamp must use canonical UTC ISO-8601 format.`);
    }

    if (expectedSha && commitSha !== normalizeSha(expectedSha, 'Expected commit SHA')) {
        throw new Error(
            `${VERSION_FILENAME} identifies ${commitSha}, not expected commit ${expectedSha}.`
        );
    }

    return { commitSha, timestamp };
}

function validateManifestShape(manifest, identity) {
    assertExactKeys(
        manifest,
        ['artifactRoot', 'commitSha', 'files', 'schemaVersion', 'timestamp'],
        MANIFEST_FILENAME
    );

    if (manifest.schemaVersion !== 1) {
        throw new Error(`${MANIFEST_FILENAME}.schemaVersion must be 1.`);
    }

    if (manifest.artifactRoot !== 'dist/client') {
        throw new Error(`${MANIFEST_FILENAME}.artifactRoot must be "dist/client".`);
    }

    if (
        manifest.commitSha !== identity.commitSha
        || manifest.timestamp !== identity.timestamp
    ) {
        throw new Error(`${MANIFEST_FILENAME} identity does not match ${VERSION_FILENAME}.`);
    }

    if (!Array.isArray(manifest.files)) {
        throw new Error(`${MANIFEST_FILENAME}.files must be an array.`);
    }
}

function parseChecksumFile(contents) {
    if (!contents.endsWith('\n')) {
        throw new Error(`${CHECKSUM_FILENAME} must end with a newline.`);
    }

    const entries = new Map();
    const lines = contents.slice(0, -1).split('\n');

    for (const line of lines) {
        const match = /^([0-9a-f]{64})  ([^\r\n]+)$/.exec(line);

        if (!match) {
            throw new Error(`Malformed ${CHECKSUM_FILENAME} entry: ${line}`);
        }

        const [, checksum, path] = match;

        if (
            path.startsWith('/')
            || path.includes('\\')
            || path.split('/').includes('..')
            || path === CHECKSUM_FILENAME
        ) {
            throw new Error(`Unsafe path in ${CHECKSUM_FILENAME}: ${path}`);
        }

        if (entries.has(path)) {
            throw new Error(`Duplicate path in ${CHECKSUM_FILENAME}: ${path}`);
        }

        entries.set(path, checksum);
    }

    return entries;
}

export async function copyProductionClient({ projectRoot, clientRoot }) {
    for (const relativePath of CLIENT_SOURCE_PATHS) {
        const sourcePath = resolve(projectRoot, relativePath);
        const destinationPath = resolve(clientRoot, relativePath);
        const sourceDetails = await lstat(sourcePath);

        if (sourceDetails.isSymbolicLink() || !sourceDetails.isFile()) {
            throw new Error(`Production source must be a regular file: ${relativePath}`);
        }

        await mkdir(dirname(destinationPath), { recursive: true });
        await copyFile(sourcePath, destinationPath);
    }
}

export async function finalizeProductionArtifact({
    artifactRoot,
    commitSha,
    timestamp
}) {
    const identity = {
        commitSha: normalizeSha(commitSha, 'Artifact commit SHA'),
        timestamp: normalizeTimestamp(timestamp, 'Artifact timestamp')
    };

    await writeFile(
        resolve(artifactRoot, VERSION_FILENAME),
        stableJson(identity),
        'utf8'
    );

    const files = [];

    for (const path of PAYLOAD_PATHS) {
        const absolutePath = resolve(artifactRoot, path);
        const details = await stat(absolutePath);

        if (!details.isFile()) {
            throw new Error(`Expected production payload file is missing: ${path}`);
        }

        files.push({
            path,
            bytes: details.size,
            sha256: await hashFile(absolutePath)
        });
    }

    const manifest = {
        schemaVersion: 1,
        artifactRoot: 'dist/client',
        commitSha: identity.commitSha,
        timestamp: identity.timestamp,
        files
    };

    await writeFile(
        resolve(artifactRoot, MANIFEST_FILENAME),
        stableJson(manifest),
        'utf8'
    );

    const checksumPaths = [...PAYLOAD_PATHS, MANIFEST_FILENAME].sort();
    const checksumLines = [];

    for (const path of checksumPaths) {
        checksumLines.push(`${await hashFile(resolve(artifactRoot, path))}  ${path}`);
    }

    await writeFile(
        resolve(artifactRoot, CHECKSUM_FILENAME),
        `${checksumLines.join('\n')}\n`,
        'utf8'
    );

    return manifest;
}

export async function verifyProductionArtifact({
    artifactRoot,
    expectedSha
}) {
    const actualFiles = await inspectArtifactTree(artifactRoot);

    if (JSON.stringify(actualFiles) !== JSON.stringify(ALL_ARTIFACT_PATHS)) {
        const missing = ALL_ARTIFACT_PATHS.filter((path) => !actualFiles.includes(path));
        throw new Error(`Production artifact is missing required files: ${missing.join(', ')}`);
    }

    await validateLocalReferences(artifactRoot);

    const version = await readJson(
        resolve(artifactRoot, VERSION_FILENAME),
        VERSION_FILENAME
    );
    const identity = validateVersion(version, expectedSha);
    const manifest = await readJson(
        resolve(artifactRoot, MANIFEST_FILENAME),
        MANIFEST_FILENAME
    );

    validateManifestShape(manifest, identity);

    if (manifest.files.length !== PAYLOAD_PATHS.length) {
        throw new Error(`${MANIFEST_FILENAME} does not describe every payload file.`);
    }

    for (let index = 0; index < PAYLOAD_PATHS.length; index += 1) {
        const expectedPath = PAYLOAD_PATHS[index];
        const entry = manifest.files[index];

        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            throw new Error(`${MANIFEST_FILENAME}.files[${index}] must be an object.`);
        }

        assertExactKeys(entry, ['bytes', 'path', 'sha256'], `${MANIFEST_FILENAME} file entry`);

        if (entry.path !== expectedPath) {
            throw new Error(
                `${MANIFEST_FILENAME} paths must be complete, unique, and sorted; expected ${expectedPath}.`
            );
        }

        if (!Number.isSafeInteger(entry.bytes) || entry.bytes < 0) {
            throw new Error(`${MANIFEST_FILENAME} has an invalid byte count for ${entry.path}.`);
        }

        if (!CHECKSUM_PATTERN.test(entry.sha256)) {
            throw new Error(`${MANIFEST_FILENAME} has an invalid SHA-256 for ${entry.path}.`);
        }

        const absolutePath = resolve(artifactRoot, entry.path);
        const details = await stat(absolutePath);
        const actualChecksum = await hashFile(absolutePath);

        if (details.size !== entry.bytes || actualChecksum !== entry.sha256) {
            throw new Error(`${MANIFEST_FILENAME} verification failed for ${entry.path}.`);
        }
    }

    const checksumEntries = parseChecksumFile(
        await readFile(resolve(artifactRoot, CHECKSUM_FILENAME), 'utf8')
    );
    const expectedChecksumPaths = [...PAYLOAD_PATHS, MANIFEST_FILENAME].sort();

    if (
        JSON.stringify([...checksumEntries.keys()].sort())
        !== JSON.stringify(expectedChecksumPaths)
    ) {
        throw new Error(`${CHECKSUM_FILENAME} must list every artifact file except itself exactly once.`);
    }

    for (const path of expectedChecksumPaths) {
        const actualChecksum = await hashFile(resolve(artifactRoot, path));

        if (checksumEntries.get(path) !== actualChecksum) {
            throw new Error(`${CHECKSUM_FILENAME} verification failed for ${path}.`);
        }
    }

    return {
        ...identity,
        files: ALL_ARTIFACT_PATHS.length
    };
}
