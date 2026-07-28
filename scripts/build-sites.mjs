import { cp, copyFile, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(projectRoot, 'dist');
const clientRoot = resolve(outputRoot, 'client');
const serverRoot = resolve(outputRoot, 'server');

await rm(outputRoot, { force: true, recursive: true });
await mkdir(clientRoot, { recursive: true });
await mkdir(serverRoot, { recursive: true });

await Promise.all([
    copyFile(resolve(projectRoot, 'index.html'), resolve(clientRoot, 'index.html')),
    copyFile(resolve(projectRoot, 'styles.css'), resolve(clientRoot, 'styles.css')),
    copyFile(resolve(projectRoot, 'script.js'), resolve(clientRoot, 'script.js')),
    copyFile(resolve(projectRoot, 'RadDad_Logo.jpg'), resolve(clientRoot, 'RadDad_Logo.jpg')),
    copyFile(resolve(projectRoot, 'worker/index.js'), resolve(serverRoot, 'index.js')),
    cp(resolve(projectRoot, 'assets'), resolve(clientRoot, 'assets'), { recursive: true })
]);

console.log('Sites build ready in dist/');
