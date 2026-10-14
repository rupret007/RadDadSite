import { copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
    copyProductionClient,
    finalizeProductionArtifact,
    resolveBuildIdentity,
    verifyProductionArtifact
} from './lib/production-artifact.mjs';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values } = parseArgs({
    options: {
        'client-only': { type: 'boolean', default: false },
        'output-dir': { type: 'string' }
    }
});
if (values['output-dir'] === '') {
    throw new Error('--output-dir must not be empty');
}
// Custom output paths are relative to the caller, while the default stays in the checkout.
const outputRoot = values['output-dir'] === undefined
    ? resolve(projectRoot, 'dist')
    : resolve(values['output-dir']);
const clientRoot = resolve(outputRoot, 'client');
const serverRoot = resolve(outputRoot, 'server');
const clientOnly = values['client-only'];

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
        ? `Production artifact ready in ${clientRoot} for ${identity.commitSha}`
        : `Sites build ready in ${outputRoot} for ${identity.commitSha}`
);
