const { test: base, expect } = require('@playwright/test');

// These are browser fixtures, not assertions about any live provider. Every
// external response is synthetic; only this test server can receive traffic.
const test = base.extend({
    serviceWorkers: 'block',
    launchOptions: async ({ launchOptions }, use) => {
        await use({
            ...launchOptions,
            args: [
                ...(launchOptions.args || []),
                '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1'
            ]
        });
    },
    _offlineNetwork: [async ({ context, baseURL }, use) => {
        const localOrigin = new URL(baseURL).origin;
        const unexpected = [];
        const isLocal = (value) => new URL(value, baseURL).origin === localOrigin;

        // APIRequestContext bypasses browser routing. Guard the direct request
        // methods used for local artifact checks as well as browser requests.
        const api = context.request;
        const originals = new Map();
        for (const method of ['fetch', 'get', 'post', 'put', 'patch', 'delete', 'head']) {
            const original = api[method];
            originals.set(method, original);
            api[method] = function localRequestOnly(input, ...args) {
                const url = typeof input === 'string' ? input : input.url();
                if (!isLocal(url)) {
                    throw new Error(`Offline browser fixture refused API request: ${url}`);
                }
                return original.call(this, input, ...args);
            };
        }

        await context.route('**/*', async (route) => {
            const request = route.request();
            const url = new URL(request.url());
            if (isLocal(url.href)) {
                await route.continue();
                return;
            }
            if (request.method() === 'GET' && url.protocol === 'https:') {
                if (url.hostname === 'fonts.googleapis.com' && request.resourceType() === 'stylesheet') {
                    await route.fulfill({ contentType: 'text/css', body: '/* Offline font fallback. */' });
                    return;
                }
                if (['img.youtube.com', 'i.ytimg.com'].includes(url.hostname) && request.resourceType() === 'image') {
                    await route.fulfill({
                        contentType: 'image/svg+xml',
                        body: '<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#18232b"/></svg>'
                    });
                    return;
                }
                if ((url.hostname === 'embed.music.apple.com' || (
                    ['www.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname) && url.pathname.startsWith('/embed/')
                )) && request.resourceType() === 'document') {
                    await route.fulfill({
                        contentType: 'text/html',
                        body: '<!doctype html><html lang="en"><title>Offline media fixture</title><body>Provider playback is not exercised by this test.</body></html>'
                    });
                    return;
                }
            }
            unexpected.push(`${request.method()} ${url.origin}${url.pathname}`);
            await route.abort('blockedbyclient');
        });
        await context.routeWebSocket('**/*', (socket) => socket.close());

        try {
            await use();
        } finally {
            for (const [method, original] of originals) api[method] = original;
            expect(unexpected, 'No unexpected external network requests').toEqual([]);
        }
    }, { auto: true }]
});

module.exports = { test, expect };
