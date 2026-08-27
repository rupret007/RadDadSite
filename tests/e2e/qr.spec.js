const { test, expect } = require('@playwright/test');

test.describe('tap, NFC, and QR landing pages', () => {
    test('/tap/ redirects to /qr/ via client-side JavaScript', async ({ page }) => {
        await page.goto('/tap/');

        await expect(page).toHaveURL(/\/qr\/$/);
        await expect(page).toHaveTitle('Rad Dad | The Cover Band Covering Its Own Cover');
    });

    test('/tap preserves query params and hash through redirect', async ({ page }) => {
        await page.goto('/tap/?utm_source=sticker&utm_campaign=v7#song');

        await expect(page).toHaveURL(/\/qr\/\?utm_source=sticker&utm_campaign=v7#song$/);
    });

    test('/nfc/ preserves legacy links while using the canonical QR content', async ({ page }) => {
        await page.goto('/nfc/?utm_source=legacy#wildflower');

        await expect(page).toHaveURL(/\/qr\/\?utm_source=legacy#wildflower$/);
        await expect(page).toHaveTitle('Rad Dad | The Cover Band Covering Its Own Cover');
    });

    test('tag and NFC aliases contain static fallbacks canonicalized to /qr/', async ({ page }) => {
        for (const path of ['/tap/index.html', '/nfc/index.html']) {
            const response = await page.request.get(path);
            const html = await response.text();

            expect(response.ok()).toBe(true);
            expect(html).toContain('meta http-equiv="refresh"');
            expect(html).toContain('url=../qr/');
            expect(html).toContain('rel="canonical" href="https://raddadband.com/qr/"');
            expect(html).toContain("new URL('../qr/', window.location.href)");
            expect(html).toContain('window.location.replace');
            expect(html).toContain('href="../qr/"');
            expect(html).not.toContain('url=/qr/');
        }
    });

    test('tag and NFC aliases stay inside a project-site base without redirect loops', async ({ page }) => {
        const projectPrefix = '/RadDadSite';

        await page.route('**/RadDadSite/**', async (route) => {
            const proxiedUrl = new URL(route.request().url());
            proxiedUrl.pathname = proxiedUrl.pathname.slice(projectPrefix.length) || '/';
            await route.continue({ url: proxiedUrl.toString() });
        });

        for (const alias of ['tap', 'nfc']) {
            const navigations = [];
            const recordNavigation = (frame) => {
                if (frame === page.mainFrame()) {
                    navigations.push(frame.url());
                }
            };
            page.on('framenavigated', recordNavigation);

            await page.goto(`${projectPrefix}/${alias}/?utm_source=project-site#wildflower`);

            const expectedUrl = `http://127.0.0.1:4173${projectPrefix}/qr/?utm_source=project-site#wildflower`;
            await expect(page).toHaveURL(expectedUrl);
            await expect(page).toHaveTitle('Rad Dad | The Cover Band Covering Its Own Cover');
            await page.waitForTimeout(200);

            const destinationNavigations = navigations.filter((url) => url === expectedUrl);
            expect(destinationNavigations).toHaveLength(1);
            expect(navigations.some((url) => /\/qr\/qr\//.test(url))).toBe(false);

            page.off('framenavigated', recordNavigation);
        }
    });

    test('/qr/ loads the Story Of Us landing page with correct metadata', async ({ page }) => {
        await page.goto('/qr/');

        await expect(page).toHaveTitle('Rad Dad | The Cover Band Covering Its Own Cover');
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://raddadband.com/qr/');
        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
            'content',
            'https://raddadband.com/assets/rad-dad-tap-og.png'
        );
        await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
            'content',
            'The cover band covering its own cover.'
        );
        await expect(page.locator('meta[name="description"]')).toHaveAttribute(
            'content',
            /Story Of Us/
        );
    });

    test('/qr/ presents the hero with cassette render and call-to-action', async ({ page }) => {
        await page.goto('/qr/');

        const hero = page.locator('.hero');
        await expect(hero.getByRole('heading', { level: 1 })).toContainText('cover band');
        await expect(hero.getByRole('heading', { level: 1 })).toContainText('own cover');
        await expect(hero.locator('.hero__lede')).toContainText('Rad Dad is a cover band');

        const cassetteImg = hero.locator('.cassette-render img');
        await expect(cassetteImg).toBeVisible();
        await expect(cassetteImg).toHaveAttribute('alt', /Story Of Us/);
        await expect(cassetteImg).toHaveAttribute('src', /story-of-us-cassette-render\.webp/);

        await expect(hero.getByRole('link', { name: /Start with our song/ })).toHaveAttribute('href', '#song');
        await expect(hero.getByRole('link', { name: /full band site/ })).toHaveAttribute('href', '../');
    });

    test('/qr/ embeds The Story Of Us Apple Music player with streaming links', async ({ page }) => {
        await page.goto('/qr/');

        const songSection = page.locator('#song');
        await expect(songSection.getByRole('heading', { level: 2 })).toContainText('song that became');
        await expect(songSection).toContainText('It started as a solo release');
        await expect(songSection).toContainText('it became ours');
        await expect(songSection).not.toContainText(/setlist/i);
        await expect(songSection).not.toContainText(/part of the set/i);

        const playerCard = songSection.locator('.player-card');
        await expect(playerCard).toBeVisible();
        await expect(playerCard.locator('iframe')).toHaveAttribute(
            'src',
            /embed\.music\.apple\.com.*1827102667/
        );

        const serviceLinks = playerCard.locator('.service-links');
        await expect(serviceLinks.getByRole('link', { name: 'Apple Music' })).toHaveAttribute(
            'href',
            /music\.apple\.com.*1827102667/
        );
        await expect(serviceLinks.getByRole('link', { name: 'Amazon Music' })).toHaveAttribute(
            'href',
            /music\.amazon\.com/
        );
        await expect(serviceLinks.getByRole('link', { name: 'Spotify' })).toHaveAttribute(
            'href',
            /open\.spotify\.com/
        );
        await expect(serviceLinks.getByRole('link', { name: 'YouTube Music' })).toHaveAttribute(
            'href',
            /music\.youtube\.com/
        );
    });

    test('/qr/ features the latest Wildflower video and earlier live performances', async ({ page }) => {
        await page.goto('/qr/');

        const wildflowerSection = page.locator('#wildflower');
        await expect(wildflowerSection.getByRole('heading', { level: 2 })).toContainText('songs outside');
        await expect(wildflowerSection).toContainText('Texas Credit Union Stage');

        const liveCards = wildflowerSection.locator('.live-card');
        await expect(liveCards).toHaveCount(4);

        const tomorrowsAnotherDay = liveCards.nth(0);
        await expect(tomorrowsAnotherDay).toContainText('Tomorrow’s Another Day');
        await expect(tomorrowsAnotherDay).toContainText('MxPx');
        await expect(tomorrowsAnotherDay).toHaveAttribute('href', 'https://www.youtube.com/watch?v=4ReFoSZHL7o');
        await expect(tomorrowsAnotherDay.locator('img')).toHaveAttribute(
            'src',
            'https://img.youtube.com/vi/4ReFoSZHL7o/maxresdefault.jpg'
        );
        await expect(tomorrowsAnotherDay.locator('.live-card__stamp')).toHaveText('New video');

        const allTheSmallThings = liveCards.nth(1);
        await expect(allTheSmallThings).toContainText('All the Small Things');
        await expect(allTheSmallThings).toContainText('blink-182');
        await expect(allTheSmallThings).toHaveAttribute('href', 'https://www.youtube.com/watch?v=9Re_0wjIbfQ');
        await expect(allTheSmallThings.locator('.live-card__stamp')).toHaveText("Wildflower '26");

        const theMiddle = liveCards.nth(2);
        await expect(theMiddle).toContainText('The Middle');
        await expect(theMiddle).toContainText('Jimmy Eat World');
        await expect(theMiddle).toHaveAttribute('href', 'https://www.youtube.com/watch?v=iMrxzCQ7lVs');

        const linoleum = liveCards.nth(3);
        await expect(linoleum).toContainText('Linoleum');
        await expect(linoleum).toContainText('NOFX');
        await expect(linoleum).toHaveAttribute('href', 'https://www.youtube.com/watch?v=e9mR2sgnJ00');

        await expect(wildflowerSection.locator('.youtube-strip')).toHaveAttribute(
            'href',
            'https://www.youtube.com/@RadDadBand'
        );
    });

    test('/qr/ promotes the next show with v2 flyer and event actions', async ({ page }) => {
        await page.goto('/qr/');

        const nextShowSection = page.locator('#next-show');
        await expect(nextShowSection.getByRole('heading', { level: 2 })).toContainText('Rad Dad');
        await expect(nextShowSection.getByRole('heading', { level: 2 })).toContainText('Friends');
        await expect(nextShowSection.getByRole('link', { name: 'The Fault Lines' })).toHaveAttribute(
            'href',
            'https://www.facebook.com/thefaultlinestx'
        );

        const facts = nextShowSection.locator('.next-show-facts');
        await expect(facts).toContainText('September 19');
        await expect(facts).toContainText('7–10 PM');
        await expect(facts).toContainText('Guitars & Growlers');
        await expect(facts).toContainText('Richardson, Texas');
        await expect(facts).toContainText('Free show');

        const calendarLink = nextShowSection.getByRole('link', { name: 'Add to calendar' });
        await expect(calendarLink).toHaveAttribute('href', '../assets/rad-dad-friends-guitars-growlers-2026.ics');
        await expect(calendarLink).toHaveAttribute('download', '');

        const directionsLink = nextShowSection.getByRole('link', { name: 'Get directions' });
        await expect(directionsLink).toHaveAttribute('href', 'https://maps.app.goo.gl/Gr79GmmXAxMH5SkP6');

        const flyerLink = nextShowSection.locator('.next-show-flyer');
        await expect(flyerLink).toHaveAttribute(
            'href',
            '../assets/rad-dad-friends-guitars-growlers-2026-v2-full.png'
        );
        const flyerImg = flyerLink.locator('img');
        await expect(flyerImg).toHaveAttribute('width', '1024');
        await expect(flyerImg).toHaveAttribute('height', '1536');
        await expect(flyerImg).toHaveAttribute('src', /rad-dad-friends-guitars-growlers-2026-v2-full\.png/);

        await expect(nextShowSection.locator('.next-show-details')).toHaveAttribute('href', '../#show');
    });

    test('/qr/ includes follow links and footer navigation back to main site', async ({ page }) => {
        await page.goto('/qr/');

        const followSection = page.locator('#follow');
        await expect(followSection.getByRole('heading', { level: 2 })).toContainText('stay for the');

        const followLinks = followSection.locator('.follow-links');
        await expect(followLinks.getByRole('link', { name: 'YouTube' })).toHaveAttribute(
            'href',
            'https://www.youtube.com/@RadDadBand'
        );
        await expect(followLinks.getByRole('link', { name: 'Instagram' })).toHaveAttribute(
            'href',
            'https://www.instagram.com/rad.dad.band/'
        );
        await expect(followLinks.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
            'href',
            'https://www.facebook.com/people/Rad-Dad/61581475409339/'
        );
        await expect(followLinks.getByRole('link', { name: /full site/ })).toHaveAttribute('href', '../');

        const footer = page.locator('.tap-footer');
        await expect(footer.locator('.tap-brand')).toHaveAttribute('href', '../');
        await expect(footer).toContainText('North Texas');
    });

    test('/qr/ shared assets load successfully', async ({ page }) => {
        await page.goto('/qr/');

        const [cassetteResponse, calendarResponse, flyerResponse, ogImageResponse] = await Promise.all([
            page.request.get('/assets/story-of-us-cassette-render.webp'),
            page.request.get('/assets/rad-dad-friends-guitars-growlers-2026.ics'),
            page.request.get('/assets/rad-dad-friends-guitars-growlers-2026-v2-full.png'),
            page.request.get('/assets/rad-dad-tap-og.png')
        ]);

        expect(cassetteResponse.ok()).toBe(true);
        expect(cassetteResponse.headers()['content-type']).toContain('image/webp');

        expect(calendarResponse.ok()).toBe(true);
        expect(await calendarResponse.text()).toContain('SUMMARY:Rad Dad + Friends with The Fault Lines');

        expect(flyerResponse.ok()).toBe(true);
        expect(flyerResponse.headers()['content-type']).toContain('image/png');

        expect(ogImageResponse.ok()).toBe(true);
        expect(ogImageResponse.headers()['content-type']).toContain('image/png');
    });

    test('/qr/ is responsive and overflow-free on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/qr/');

        const layout = await page.evaluate(() => ({
            bodyScrollWidth: document.body.scrollWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            viewportWidth: window.innerWidth
        }));

        expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
        expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);

        await expect(page.locator('.tap-header')).toBeVisible();
        await expect(page.locator('.hero')).toBeVisible();
        await expect(page.locator('#song')).toBeVisible();
    });
});
