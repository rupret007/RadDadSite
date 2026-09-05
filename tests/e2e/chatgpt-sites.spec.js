const { test, expect } = require('./fixtures');

test('ChatGPT Sites page features the Wildflower Tomorrow’s Another Day clip', async ({ page }) => {
    await page.goto('/GPT/index.html');

    await expect(page).toHaveTitle('Rad Dad | Pop Punk Cover Band');
    await expect(page.locator('#videoHeading')).toHaveText('Tomorrow’s Another Day — MxPx cover');
    await expect(page.locator('#welcomeLine')).toHaveText('New on YouTube · Wildflower 2026');
    await expect(page.locator('#openOnYouTube')).toHaveAttribute('href', 'https://youtu.be/4ReFoSZHL7o');
    await expect(page.locator('#videoOverlay')).toHaveAttribute(
        'aria-label',
        'Play Tomorrow’s Another Day — MxPx cover'
    );
    await expect(page.locator('#videoFrame')).toHaveAttribute(
        'title',
        'Rad Dad performing Tomorrow’s Another Day by MxPx live at Wildflower Festival'
    );

    const html = await page.content();
    expect(html).toContain('videoId: "4ReFoSZHL7o"');
    expect(html).not.toContain(['_IwRtmu', 'TKBY'].join(''));
});
