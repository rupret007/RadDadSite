// @vitest-environment node

import http from 'node:http';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const repoRoot = join(fileURLToPath(new URL('../..', import.meta.url)));
const {
    DEFAULT_TEST_PORT,
    assertRadDadHomepage,
    assertRadDadTestOrigin,
    resolveTestPort,
    testBaseURL
} = require('../../scripts/lib/e2e-test-server.cjs');

const servers = [];

afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    })));
});

function listen(html, statusCode = 200) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((_request, response) => {
            response.writeHead(statusCode, { 'content-type': 'text/html; charset=utf-8' });
            response.end(html);
        });
        server.listen(0, '127.0.0.1', () => {
            servers.push(server);
            const { port } = server.address();
            resolve(`http://127.0.0.1:${port}/`);
        });
        server.on('error', reject);
    });
}

describe('local e2e test port', () => {
    it('defaults serve:test and Playwright to 4317 unless RAD_DAD_TEST_PORT is set', () => {
        const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
        const playwrightSource = readFileSync(join(repoRoot, 'playwright.config.js'), 'utf8');
        const serveSource = readFileSync(join(repoRoot, 'scripts/serve-test.cjs'), 'utf8');
        const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');

        expect(DEFAULT_TEST_PORT).toBe(4317);
        expect(resolveTestPort({})).toBe(4317);
        expect(resolveTestPort({ RAD_DAD_TEST_PORT: '' })).toBe(4317);
        expect(testBaseURL({})).toBe('http://127.0.0.1:4317');
        expect(resolveTestPort({ RAD_DAD_TEST_PORT: '5120' })).toBe(5120);
        expect(testBaseURL({ RAD_DAD_TEST_PORT: '5120' })).toBe('http://127.0.0.1:5120');

        expect(pkg.scripts['serve:test']).toBe('node scripts/serve-test.cjs');
        expect(pkg.scripts['serve:test']).not.toMatch(/-p\s*4173\b/);
        expect(serveSource).toContain('resolveTestPort(process.env)');
        expect(serveSource).toContain("'-p'");
        expect(playwrightSource).toContain("require('./scripts/lib/e2e-test-server.cjs')");
        expect(playwrightSource).toContain('testBaseURL(process.env)');
        expect(playwrightSource).toContain('node scripts/serve-test.cjs');
        expect(playwrightSource).not.toMatch(/4173/);
        expect(readme).toContain('4317');
        expect(readme).toContain('RAD_DAD_TEST_PORT=4317');
        expect(readme).not.toContain('RAD_DAD_TEST_PORT=4273');
        expect(readme).not.toContain('4173');
    });

    it('rejects an invalid RAD_DAD_TEST_PORT the same way Playwright used to', () => {
        expect(() => resolveTestPort({ RAD_DAD_TEST_PORT: '80' })).toThrow(
            'RAD_DAD_TEST_PORT must be an integer between 1024 and 65535.'
        );
        expect(() => resolveTestPort({ RAD_DAD_TEST_PORT: 'not-a-port' })).toThrow(
            'RAD_DAD_TEST_PORT must be an integer between 1024 and 65535.'
        );
    });

    it('does not skip e2e when a listener already occupies the test port', () => {
        const playwrightSource = readFileSync(join(repoRoot, 'playwright.config.js'), 'utf8');
        const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');

        expect(playwrightSource).toMatch(/reuseExistingServer:\s*!process\.env\.CI/);
        expect(playwrightSource).toContain('assert-test-origin.setup.js');
        expect(playwrightSource).not.toMatch(/test\.skip|skipIf|SKIP_E2E|describe\.skip/);
        expect(readme).toMatch(/not skipped/i);
    });

    it('fails fast when the occupant is not a Rad Dad homepage', async () => {
        expect(() => assertRadDadHomepage(
            '<!doctype html><title>Vite + React</title>',
            'http://127.0.0.1:4317/'
        )).toThrow(/not a Rad Dad server/);

        expect(() => assertRadDadHomepage(
            '<!doctype html><h1>Rad Dad</h1>',
            'http://127.0.0.1:4317/'
        )).toThrow(/title is missing/);

        const foreignOrigin = await listen('<!doctype html><title>Some other local project</title>');
        await expect(assertRadDadTestOrigin(foreignOrigin)).rejects.toThrow(/not a Rad Dad server/);
    });

    it('accepts the real homepage title at a Rad Dad occupant', async () => {
        const homepage = readFileSync(join(repoRoot, 'index.html'), 'utf8');
        const title = homepage.match(/<title>([^<]*)<\/title>/)[1];

        expect(title).toContain('Rad Dad');
        expect(assertRadDadHomepage(homepage, 'http://127.0.0.1:4317/')).toBe(title);

        const origin = await listen(homepage);
        await expect(assertRadDadTestOrigin(origin)).resolves.toBe(title);
    });
});
