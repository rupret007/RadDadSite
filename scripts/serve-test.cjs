'use strict';

const { spawn } = require('node:child_process');
const { resolveTestPort } = require('./lib/e2e-test-server.cjs');

const port = resolveTestPort(process.env);
const httpServer = require.resolve('http-server/bin/http-server');
const child = spawn(
    process.execPath,
    [httpServer, '.', '-p', String(port), '-a', '127.0.0.1', '-c-1', '--silent'],
    { stdio: 'inherit' }
);

function shutdown(signal) {
    if (!child.killed) {
        child.kill(signal);
    }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

child.on('exit', (code, signal) => {
    if (signal) {
        process.exit(1);
    }
    process.exit(code ?? 1);
});
