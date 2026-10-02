const { test, expect } = require('./fixtures');
// Promotion was retired. Changing the browser clock or returning from a tab
// must never revive the old event, even when JavaScript is unavailable.
for (const path of ['/', '/qr/']) {
    for (const at of ['2026-09-10T12:00:00-05:00','2026-09-19T20:00:00-05:00','2026-10-02T12:00:00-05:00','2027-01-01T12:00:00-06:00']) {
        test(`${path} stays evergreen at ${at}`, async ({ page }) => {
            await page.clock.setFixedTime(new Date(at));
            await page.goto(path);
            await expect(page.locator('a[download], [data-show-primary-action], [data-show-share]')).toHaveCount(0);
            await expect(page.locator('script[src*="show-state"]')).toHaveCount(0);
            await expect(page.locator('h1')).not.toContainText('Friends');
            await expect(page.locator('body')).not.toContainText('Live now');
            await page.evaluate(() => { window.dispatchEvent(new Event('pageshow')); document.dispatchEvent(new Event('visibilitychange')); });
            await expect(page.locator('html')).not.toHaveAttribute('data-show-phase');
            await expect(page.locator('[data-upcoming-shows], #next-show')).toContainText('No upcoming dates posted yet');
        });
    }
}
test('old shared homepage show fragment resolves to an explicitly dated past-show card', async ({ page }) => {
    await page.goto('/#show');
    await expect(page.locator('#show')).toContainText('Past show');
    await expect(page.locator('#show')).toContainText('September 19, 2026');
    await expect(page.locator('#show a[href$=".ics"], #show a[href*="maps"]')).toHaveCount(0);
});
