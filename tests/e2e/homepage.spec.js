const { test, expect } = require('@playwright/test');

test('loads the homepage and preserves the expected section order', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle('Rad Dad - Pop Punk Cover Band');
    await expect(page.locator('.shows-section')).toHaveCount(1);

    const sectionOrder = await page.locator('main > section').evaluateAll((sections) =>
        sections.map((section) => section.className)
    );

    expect(sectionOrder).toEqual([
        'festival-section',
        'video-section',
        'shows-section',
        'social-section',
        'contact-section'
    ]);
});

test('renders the upcoming shows content and keeps the previous-video thumbnail without text', async ({ page }) => {
    await page.goto('/');

    const showCards = page.locator('.show-card');
    await expect(showCards).toHaveCount(2);

    await expect(showCards.nth(0)).toContainText('Downtown Dallas Arts and Music Festival');
    await expect(showCards.nth(0)).toContainText('Saturday, April 11, 2026');
    await expect(showCards.nth(0)).toContainText('Zound Sounds Stage');
    await expect(showCards.nth(0)).toContainText('TBA');
    await expect(showCards.nth(0).locator('.show-link')).toHaveAttribute('href', 'https://ddamf.com/');

    await expect(showCards.nth(1)).toContainText('Wildflower Arts & Music Festival');
    await expect(showCards.nth(1)).toContainText('Saturday, May 16, 2026 at 1:45 PM');
    await expect(showCards.nth(1)).toContainText('Texas Credit Union Stage');
    await expect(showCards.nth(1)).toContainText('1:45 PM');
    await expect(showCards.nth(1).locator('.show-link')).toHaveAttribute('href', 'https://wildflowerfestival.com/tickets/');

    await expect(page.locator('.video-thumbnail-link--prev')).toHaveCount(1);
    await expect(page.getByText('Previous video', { exact: true })).toHaveCount(0);
});

test('keeps the mobile layout free of horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const cards = page.locator('.show-card');
    await expect(cards).toHaveCount(2);

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    expect(hasOverflow).toBe(false);
});
