import { resolve } from 'node:path';
import { verifyProductionArtifact } from './lib/production-artifact.mjs';

function parseArguments(argv) {
    const options = {
        artifactRoot: resolve(process.cwd(), 'dist/client'),
        expectedSha: process.env.DEPLOY_COMMIT_SHA || process.env.GITHUB_SHA
    };

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        const value = argv[index + 1];

        if (argument === '--artifact-dir' && value) {
            options.artifactRoot = resolve(process.cwd(), value);
            index += 1;
            continue;
        }

        if (argument === '--expected-sha' && value) {
            options.expectedSha = value;
            index += 1;
            continue;
        }

        throw new Error(`Unknown or incomplete verifier argument: ${argument}`);
    }

    return options;
}

const options = parseArguments(process.argv.slice(2));
const result = await verifyProductionArtifact(options);

console.log(
    `Verified dist/client for ${result.commitSha} (${result.files} files, all checksums valid).`
);
