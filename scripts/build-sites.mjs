import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    copyProductionClient,
    finalizeProductionArtifact,
    resolveBuildIdentity,
    verifyProductionArtifact
} from './lib/production-artifact.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(projectRoot, 'dist');
const clientRoot = resolve(outputRoot, 'client');
const serverRoot = resolve(outputRoot, 'server');
const clientOnly = process.argv.slice(2).includes('--client-only');

await rm(outputRoot, { force: true, recursive: true });
await mkdir(clientRoot, { recursive: true });

await copyProductionClient({ projectRoot, clientRoot });

const identity = resolveBuildIdentity({ projectRoot });
await finalizeProductionArtifact({
    artifactRoot: clientRoot,
    ...identity
});
await verifyProductionArtifact({
    artifactRoot: clientRoot,
    expectedSha: identity.commitSha
});

if (!clientOnly) {
    await mkdir(serverRoot, { recursive: true });
    await copyFile(resolve(projectRoot, 'worker/index.js'), resolve(serverRoot, 'index.js'));
}

console.log(
    clientOnly
        ? `Production artifact ready in dist/client for ${identity.commitSha}`
        : `Sites build ready in dist/ for ${identity.commitSha}`
);
