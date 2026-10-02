const { test, expect } = require('./fixtures');

const SOCIALS = [
    ['Instagram', 'https://www.instagram.com/rad.dad.band/'],
    ['Facebook', 'https://www.facebook.com/people/Rad-Dad/61581475409339/'],
    ['YouTube', 'https://www.youtube.com/@RadDadBand']
];

async function expectSocialLinks(page) {
    const socials = page.getByRole('navigation', { name: 'Rad Dad social media', exact: true });
    await expect(socials).toBeVisible();
    await expect(socials.getByRole('link')).toHaveCount(3);

    for (const [name, href] of SOCIALS) {
        const link = socials.getByRole('link', { name: `Rad Dad on ${name} (opens in a new tab)`, exact: true });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('href', href);
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        await expect(link.locator('svg')).toHaveAttribute('aria-hidden', 'true');
        await expect(link.locator('svg')).toHaveAttribute('focusable', 'false');
        await expect(page.locator(`#contact .social-nav a[href="${href}"]`)).toHaveCount(1);
    }

    return socials;
}

for (const width of [320, 390, 768, 800, 801, 1440]) {
    test(`social icons fit the initial header at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/');
        const socials = await expectSocialLinks(page);

        const layout = await socials.locator('a').evaluateAll((links) => {
            const header = document.querySelector('.site-header').getBoundingClientRect();
            return links.map((link) => {
                const rect = link.getBoundingClientRect();
                const hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
                return {
                    width: rect.width,
                    height: rect.height,
                    onScreen: rect.left >= 0 && rect.right <= window.innerWidth,
                    inHeader: rect.top >= header.top && rect.bottom <= header.bottom,
                    unobstructed: link === hit || link.contains(hit)
                };
            });
        });

        for (const link of layout) {
            expect(link.width).toBeGreaterThanOrEqual(44);
            expect(link.height).toBeGreaterThanOrEqual(44);
            expect(link.onScreen).toBe(true);
            expect(link.inHeader).toBe(true);
            expect(link.unobstructed).toBe(true);
        }

        await expect(page.getByRole('navigation', { name: 'Primary navigation', exact: true }).getByRole('link')).toHaveCount(4);
    });
}

test('social icons support keyboard focus and reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const socials = await expectSocialLinks(page);
    const links = socials.getByRole('link');
    await links.nth(0).focus();

    for (let index = 0; index < SOCIALS.length; index += 1) {
        await expect(links.nth(index)).toBeFocused();
        await expect(links.nth(index)).toHaveCSS('outline-style', 'solid');
        // The site-wide reduced-motion rule keeps a 0.01ms !important duration.
        // transition-property: none proves these icons cannot animate regardless
        // of that harmless computed duration or its browser serialization.
        await expect(links.nth(index)).toHaveCSS('transition-property', 'none');
        if (index < SOCIALS.length - 1) await page.keyboard.press('Tab');
    }
});

test.describe('social icons without JavaScript', () => {
    test.use({ javaScriptEnabled: false });

    test('remain visible and linked on a phone', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        await expectSocialLinks(page);
    });
});
