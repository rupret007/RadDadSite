const { defineConfig } = require('@playwright/test');

const rawTestPort = process.env.RAD_DAD_TEST_PORT || '4173';
const testPort = Number(rawTestPort);

if (!Number.isInteger(testPort) || testPort < 1024 || testPort > 65535) {
    throw new Error('RAD_DAD_TEST_PORT must be an integer between 1024 and 65535.');
}

const testBaseURL = `http://127.0.0.1:${testPort}`;
const serveCommand = process.platform === 'win32'
    ? `npx.cmd --no-install http-server . -p ${testPort} -a 127.0.0.1 -c-1 --silent`
    : `npx --no-install http-server . -p ${testPort} -a 127.0.0.1 -c-1 --silent`;

module.exports = defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    expect: {
        timeout: 5000
    },
    fullyParallel: false,
    retries: process.env.CI ? 1 : 0,
    reporter: [
        ['list'],
        ['html', { open: 'never' }]
    ],
    use: {
        baseURL: testBaseURL,
        browserName: 'chromium',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        video: 'retain-on-failure'
    },
    webServer: {
        command: serveCommand,
        url: testBaseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 30000
    }
});
