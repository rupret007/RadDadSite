const { test, expect } = require('./fixtures');
test('the legacy GPT page forwards to the evergreen homepage instead of a separate stale site', async ({ page }) => {
    await page.goto('/GPT/index.html?source=old-link#watch');
    await expect(page).toHaveURL(/\/\?source=old-link#watch$/);
    await expect(page).toHaveTitle('Rad Dad | DFW Pop-Punk Cover Band');
    await expect(page.locator('#watch .video-card')).toHaveCount(5);
});
test.describe('legacy redirect without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('meta refresh still reaches the band homepage', async ({ page }) => {
        await page.goto('/GPT/index.html');
        await expect(page).toHaveTitle('Rad Dad | DFW Pop-Punk Cover Band');
    });
});
