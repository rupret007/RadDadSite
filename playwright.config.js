const { defineConfig } = require('@playwright/test');

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
        baseURL: 'http://127.0.0.1:4173',
        browserName: 'chromium',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
        video: 'retain-on-failure'
    },
    webServer: {
        command: process.platform === 'win32'
            ? 'cmd /d /s /c "npm.cmd run serve:test"'
            : 'npm run serve:test',
        url: 'http://127.0.0.1:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 30000
    }
});
