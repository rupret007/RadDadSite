const { assertRadDadTestOrigin } = require('../../scripts/lib/e2e-test-server.cjs');

module.exports = async function globalSetup(config) {
    const origin = config.projects?.[0]?.use?.baseURL || config.use?.baseURL;

    if (!origin) {
        throw new Error('Playwright baseURL is not configured.');
    }

    await assertRadDadTestOrigin(origin);
};
