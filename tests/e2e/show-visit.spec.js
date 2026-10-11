const { test, expect } = require('./fixtures');
// Replaces retired directions/calendar UI with explicit archive and booking contracts.
test('past events stay dated, ordered and separate from upcoming-show announcements', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.past-shows .show-status')).toHaveText(['Past show','Past show','Past show']);
    expect(await page.locator('.past-shows time').evaluateAll(nodes => nodes.map(n => n.dateTime))).toEqual(['2026-09-19','2026-05-16','2026-04-11']);
    await expect(page.locator('[data-upcoming-shows] time')).toHaveCount(0);
    await expect(page.locator('[data-upcoming-shows]')).not.toContainText('September');
    await expect(page.locator('[data-upcoming-shows]')).toContainText('No upcoming dates posted yet. Follow Rad Dad for show announcements.');
    await expect(page.locator('#shows-title')).not.toContainText(/catch|come to the next|next one|next show/i);
    await expect(page.locator('[data-upcoming-shows] a[href*="instagram.com/rad.dad.band"]')).toBeVisible();
    await expect(page.locator('[data-upcoming-shows] a[href="#contact"]')).toBeVisible();
    await expect(page.locator('.past-shows a[href*="maps"], .past-shows a[download]')).toHaveCount(0);
});
test('past-show video and current booking links lead somewhere useful', async ({ page }) => {
    await page.goto('/');
    await page.locator('.past-shows a[href="#live-tapes"]').click();
    await expect(page).toHaveURL(/#live-tapes$/);
    await expect(page.locator('.video-grid a')).toHaveCount(5);
    await page.locator('[data-upcoming-shows] a[href="#contact"]').click();
    await expect(page.locator('#contact a[href^="mailto:"]')).toBeVisible();
});
test.describe('archive without JavaScript', () => {
    test.use({ javaScriptEnabled: false });
    test('never claims a past show is upcoming', async ({ page }) => {
        await page.goto('/#show');
        await expect(page.locator('#show')).toContainText('Past show');
        await expect(page.locator('#show')).not.toContainText('Next show');
        await expect(page.locator('a[download]')).toHaveCount(0);
    });
});
