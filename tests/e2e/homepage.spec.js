const { test, expect } = require('@playwright/test');

const EXPECTED_TITLE = 'Rad Dad + Friends with The Fault Lines at Guitars & Growlers | September 19, 2026';
const CALENDAR_PATH = 'assets/rad-dad-friends-guitars-growlers-2026.ics';
const FLYER_PATH = 'assets/rad-dad-friends-guitars-growlers-2026-v2-full.png';
const FLYER_ASPECT_RATIO = 1024 / 1536;

async function getFlyerLayout(page) {
    const flyer = page.locator('.event-flyer');

    await expect(flyer).toBeVisible();
    await expect.poll(() => flyer.evaluate((image) => image.naturalWidth)).toBeGreaterThan(0);

    return flyer.evaluate((image) => {
        const rect = image.getBoundingClientRect();

        return {
            bottom: rect.bottom,
            height: rect.height,
            left: rect.left,
            offsetHeight: image.offsetHeight,
            offsetWidth: image.offsetWidth,
            right: rect.right,
            top: rect.top,
            width: rect.width
        };
    });
}

test('loads the event-first homepage with the expected title and section order', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(EXPECTED_TITLE);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://raddadband.com/');
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
        'content',
        'https://raddadband.com/assets/rad-dad-social-2026-v2.png'
    );
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute('content', '1200');
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute('content', '630');
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Green Day/);

    const sectionOrder = await page.locator('main > section').evaluateAll((sections) =>
        sections.map((section) => section.id)
    );
    const heroOrder = await page.locator('.hero-grid > div').evaluateAll((elements) =>
        elements.map((element) => element.className)
    );
    const eventData = JSON.parse(
        await page.locator('script[type="application/ld+json"]').textContent()
    );

    expect(sectionOrder).toEqual(['show', 'covers', 'watch', 'shows', 'contact']);
    expect(heroOrder).toEqual(['flyer-stage', 'hero-copy']);
    expect(eventData).toMatchObject({
        '@type': 'MusicEvent',
        name: 'Rad Dad + Friends with The Fault Lines',
        startDate: '2026-09-19T19:00:00-05:00',
        endDate: '2026-09-19T22:00:00-05:00',
        isAccessibleForFree: true,
        location: {
            name: 'Guitars & Growlers'
        },
        performer: [
            {
                name: 'Rad Dad'
            },
            {
                name: 'The Fault Lines',
                url: 'https://www.facebook.com/thefaultlinestx'
            }
        ]
    });
    expect(eventData).not.toHaveProperty('offers');
    expect(eventData).not.toHaveProperty('organizer');
});

test('presents the September event, flyer, and useful event actions', async ({ page }) => {
    await page.goto('/');

    const hero = page.locator('#show');
    const eventTitle = hero.getByRole('heading', { level: 1, name: 'Rad Dad + Friends' });
    await expect(eventTitle).toBeVisible();
    await expect(eventTitle.locator('.event-title__friends')).toHaveAttribute('aria-hidden', 'true');
    await expect(eventTitle.locator('.event-title__friends > span')).toHaveCount(7);
    await expect(eventTitle.locator('.event-title__friends-row .sr-only')).toHaveText('+ Friends');
    await expect(hero).toContainText('Guitars & Growlers');
    await expect(hero).toContainText('Richardson, Texas');
    await expect(hero).toContainText('September 19, 2026');
    await expect(hero).toContainText('7:00–10:00 PM');
    await expect(hero).toContainText('Free show');
    await expect(hero.getByRole('link', { name: 'The Fault Lines' })).toHaveAttribute(
        'href',
        'https://www.facebook.com/thefaultlinestx'
    );

    const flyer = hero.locator('.event-flyer');
    await expect(flyer).toBeVisible();
    await expect(flyer).toHaveAttribute('width', '1024');
    await expect(flyer).toHaveAttribute('height', '1536');
    await expect(flyer).toHaveAttribute('fetchpriority', 'high');
    await expect(flyer).toHaveAttribute(
        'alt',
        'Rad Dad + Friends at Guitars & Growlers in Richardson, Texas — September 19, 2026, 7–10 PM; free show.'
    );

    const actions = hero.locator('.event-actions');
    await expect(actions).toHaveAttribute('role', 'group');
    await expect(actions).toHaveAttribute('aria-label', 'Event actions');
    const calendarLink = actions.getByRole('link', { name: 'Add to Calendar' });
    const directionsLink = actions.getByRole('link', { name: 'Get Directions' });
    const fullFlyerLink = actions.getByRole('link', { name: 'View Full Flyer' });

    await expect(calendarLink).toHaveAttribute('href', CALENDAR_PATH);
    await expect(calendarLink).toHaveAttribute('download', '');
    await expect(directionsLink).toHaveAttribute('href', 'https://maps.app.goo.gl/Gr79GmmXAxMH5SkP6');
    await expect(directionsLink).toHaveAttribute('target', '_blank');
    await expect(fullFlyerLink).toHaveAttribute('href', FLYER_PATH);
    await expect(fullFlyerLink).toHaveAttribute('target', '_blank');
    await expect(hero.locator('.flyer-link')).toHaveAttribute('href', FLYER_PATH);

    const [calendarResponse, flyerResponse] = await Promise.all([
        page.request.get(`/${CALENDAR_PATH}`),
        page.request.get(`/${FLYER_PATH}`)
    ]);

    expect(calendarResponse.ok()).toBe(true);
    expect(await calendarResponse.text()).toContain('SUMMARY:Rad Dad + Friends with The Fault Lines');
    expect(flyerResponse.ok()).toBe(true);
    expect(flyerResponse.headers()['content-type']).toContain('image/png');
});

test('shows an accessible graphic artist wall without song titles', async ({ page }) => {
    await page.goto('/');

    const covers = page.locator('#covers');
    const artistItems = covers.locator('.artist-wall > li');
    const artistNames = await artistItems.locator('.artist-name').allTextContents();

    await expect(covers).toHaveAttribute('aria-labelledby', 'covers-title');
    await expect(covers.locator('.section-kicker')).toHaveText('From the Rad Dad covers');
    await expect(covers.getByRole('heading', { level: 2, name: 'Playing hits from bands like' })).toBeVisible();
    await expect(covers).toContainText('Selections vary by show');
    await expect(covers.locator('.covers-poster__footer')).toHaveAttribute('aria-label', 'Cover note');
    await expect(covers).not.toContainText(/setlist/i);
    await expect(covers.locator('.artist-wall')).toHaveAttribute('role', 'list');
    await expect(artistItems).toHaveCount(14);
    expect(artistNames.map((name) => name.trim())).toEqual([
        'Green Day',
        'blink-182',
        'Bowling for Soup',
        'Jimmy Eat World',
        'NOFX',
        'MxPx',
        'Rancid',
        'Nirvana',
        'Taylor Swift',
        'Blur',
        'The Beatles',
        'Pennywise',
        'Me First & the Gimme Gimmes',
        'Sublime'
    ]);

    for (const removedSong of [
        'Basket Case',
        'The Rock Show',
        'The Middle',
        'Linoleum',
        'Tomorrow’s Another Day',
        'Ruby Soho',
        'In Bloom',
        'The Story of Us'
    ]) {
        await expect(covers).not.toContainText(removedSong);
    }

    await expect(covers).not.toContainText('Little Richard');
    await expect(covers).not.toContainText('Willie Nelson');
    await expect(covers).not.toContainText('Pop • Punk • Alt');

    const motifs = covers.locator('.artist-motif');
    await expect(motifs).toHaveCount(2);
    for (const motif of await motifs.all()) {
        await expect(motif).toHaveAttribute('aria-hidden', 'true');
    }

    for (const viewport of [
        { width: 320, height: 568 },
        { width: 390, height: 844 },
        { width: 1440, height: 900 },
        { width: 2048, height: 943 }
    ]) {
        await page.setViewportSize(viewport);
        await page.goto('/');

        const layout = await page.locator('#covers .artist-wall > li').evaluateAll((items) => ({
            bodyScrollWidth: document.body.scrollWidth,
            documentScrollWidth: document.documentElement.scrollWidth,
            items: items.map((item) => {
                const rect = item.getBoundingClientRect();
                const nameRect = item.querySelector('.artist-name').getBoundingClientRect();

                return {
                    clientWidth: item.clientWidth,
                    left: rect.left,
                    nameLeft: nameRect.left,
                    nameRight: nameRect.right,
                    right: rect.right,
                    scrollWidth: item.scrollWidth,
                    width: rect.width
                };
            }),
            viewportWidth: window.innerWidth
        }));

        expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
        expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);

        for (const item of layout.items) {
            expect(item.left).toBeGreaterThanOrEqual(-1);
            expect(item.right).toBeLessThanOrEqual(layout.viewportWidth + 1);
            expect(item.nameLeft).toBeGreaterThanOrEqual(-1);
            expect(item.nameRight).toBeLessThanOrEqual(layout.viewportWidth + 1);
            expect(item.width).toBeGreaterThan(0);
        }

        const nirvanaLineCount = await page
            .locator('.artist-name--nirvana')
            .evaluate((element) => {
                const range = document.createRange();
                range.selectNodeContents(element);

                return new Set(
                    [...range.getClientRects()].map((rect) => Math.round(rect.top))
                ).size;
            });

        expect(nirvanaLineCount).toBe(1);
    }
});

test('keeps the 2026 show history, all five videos, and stable contact links', async ({ page }) => {
    await page.goto('/');

    const showCards = page.locator('#shows .show-card');
    await expect(showCards).toHaveCount(3);
    await expect(showCards.locator('time.show-date')).toHaveCount(3);
    await expect(showCards.locator('time.show-date > small')).toHaveCount(3);

    const showTitles = await showCards.locator('h3').allTextContents();
    expect(showTitles.map((title) => title.trim())).toEqual([
        'Rad Dad + Friends · The Fault Lines',
        'Wildflower Arts & Music Festival',
        'Downtown Dallas Arts and Music Festival'
    ]);

    const featuredShow = showCards.nth(0);
    await expect(featuredShow).toHaveClass(/show-card--featured/);
    await expect(featuredShow.locator('.show-status')).toHaveText('Next show');
    await expect(featuredShow.locator('time.show-date')).toHaveAttribute('datetime', '2026-09-19');
    await expect(featuredShow.locator('.show-date .sr-only')).toHaveText('September 19, 2026');
    await expect(featuredShow).toContainText('SEP');
    await expect(featuredShow).toContainText('19');
    await expect(featuredShow).toContainText('2026');
    await expect(featuredShow).toContainText('7:00–10:00 PM · Free show');

    const pastShows = page.locator('#shows .show-card--past');
    await expect(pastShows).toHaveCount(2);
    await expect(pastShows.nth(0).locator('.show-status')).toHaveText('Earlier this year');
    await expect(pastShows.nth(0).locator('time.show-date')).toHaveAttribute('datetime', '2026-05-16');
    await expect(pastShows.nth(0).locator('.show-date .sr-only')).toHaveText('May 16, 2026');
    await expect(pastShows.nth(0)).toContainText('MAY');
    await expect(pastShows.nth(0)).toContainText('16');
    await expect(pastShows.nth(1).locator('.show-status')).toHaveText('Earlier this year');
    await expect(pastShows.nth(1).locator('time.show-date')).toHaveAttribute('datetime', '2026-04-11');
    await expect(pastShows.nth(1).locator('.show-date .sr-only')).toHaveText('April 11, 2026');
    await expect(pastShows.nth(1)).toContainText('APR');
    await expect(pastShows.nth(1)).toContainText('11');

    const videos = page.locator('#watch .video-card');
    await expect(videos).toHaveCount(5);
    await expect(videos.nth(0)).toContainText('Tomorrow’s Another Day — MxPx cover');
    await expect(videos.nth(0)).toContainText('New on YouTube · Wildflower 2026');
    await expect(videos.nth(0)).toHaveAttribute('href', 'https://www.youtube.com/watch?v=4ReFoSZHL7o');
    await expect(videos.nth(0).locator('img')).toHaveAttribute(
        'src',
        'https://img.youtube.com/vi/4ReFoSZHL7o/maxresdefault.jpg'
    );
    await expect(videos.nth(1)).toContainText('All the Small Things — blink-182 cover');
    await expect(videos.nth(1)).toContainText('Wildflower 2026 · Live performance');
    await expect(videos.nth(1)).toHaveAttribute('href', 'https://www.youtube.com/watch?v=9Re_0wjIbfQ');
    await expect(videos.nth(1).locator('img')).toHaveAttribute(
        'src',
        'https://img.youtube.com/vi/9Re_0wjIbfQ/maxresdefault.jpg'
    );
    await expect(videos.nth(2)).toContainText('She — Green Day cover');
    await expect(videos.nth(2)).toContainText('Wildflower 2026 · Live performance');
    await expect(videos.nth(2)).toHaveAttribute('href', 'https://www.youtube.com/watch?v=GCy4nHIqV5k');
    await expect(videos.nth(2).locator('img')).toHaveAttribute(
        'src',
        'https://img.youtube.com/vi/GCy4nHIqV5k/maxresdefault.jpg'
    );
    await expect(videos.nth(3)).toContainText('The Middle — Jimmy Eat World cover');
    await expect(videos.nth(3)).toContainText('Wildflower 2026 · Featured performance');
    await expect(videos.nth(3)).toHaveAttribute('href', 'https://www.youtube.com/watch?v=iMrxzCQ7lVs');
    const middleThumbnail = videos.nth(3).locator('img');
    await expect(middleThumbnail).toHaveAttribute('src', 'assets/the-middle-jimmy-eat-world-thumbnail.webp');
    await expect(middleThumbnail).toHaveAttribute('width', '1280');
    await expect(middleThumbnail).toHaveAttribute('height', '720');
    await expect(middleThumbnail).not.toHaveClass(/video-card__fallback/);
    await middleThumbnail.scrollIntoViewIfNeeded();
    await expect.poll(() => middleThumbnail.evaluate((image) => [
        image.naturalWidth,
        image.naturalHeight
    ])).toEqual([1280, 720]);

    const middleThumbnailResponse = await page.request.get('/assets/the-middle-jimmy-eat-world-thumbnail.webp');
    expect(middleThumbnailResponse.ok()).toBe(true);
    expect(middleThumbnailResponse.headers()['content-type']).toContain('image/webp');
    await expect(videos.nth(4)).toContainText('Linoleum — NOFX cover');
    await expect(videos.nth(4)).toContainText('Wildflower 2026 · Live performance');
    await expect(videos.nth(4)).toHaveAttribute('href', 'https://www.youtube.com/watch?v=e9mR2sgnJ00');
    await expect(videos.nth(4).locator('img')).toHaveAttribute(
        'src',
        'https://img.youtube.com/vi/e9mR2sgnJ00/maxresdefault.jpg'
    );

    await expect(page.locator('#watch .section-heading > .text-link')).toHaveAttribute(
        'href',
        'https://www.youtube.com/@RadDadBand'
    );

    const contact = page.locator('#contact');
    await expect(contact.getByRole('link', { name: 'Email Rad Dad' })).toHaveAttribute(
        'href',
        'mailto:rad.dad.band@gmail.com'
    );
    await expect(contact.getByRole('link', { name: 'Call (214) 697-0584' })).toHaveAttribute(
        'href',
        'tel:+12146970584'
    );

    const socialLinks = contact.locator('.social-nav');
    await expect(socialLinks.getByRole('link', { name: 'Instagram' })).toHaveAttribute(
        'href',
        'https://www.instagram.com/rad.dad.band/'
    );
    await expect(socialLinks.getByRole('link', { name: 'Facebook' })).toHaveAttribute(
        'href',
        'https://www.facebook.com/people/Rad-Dad/61581475409339/'
    );
    await expect(socialLinks.getByRole('link', { name: 'YouTube' })).toHaveAttribute(
        'href',
        'https://www.youtube.com/@RadDadBand'
    );
});

test('stacks five videos with equal-sized featured and spotlight cards above the smaller secondary clip', async ({ page }) => {
    for (const viewport of [
        { width: 390, height: 844 },
        { width: 1440, height: 900 },
        { width: 2048, height: 1000 }
    ]) {
        await page.setViewportSize(viewport);
        await page.goto('/');

        const [featured, spotlight1, spotlight2, spotlight3, secondary] = await page
            .locator('#watch .video-card')
            .evaluateAll((cards) => cards.map((card) => {
                const cardRect = card.getBoundingClientRect();
                const imageRect = card.querySelector('.video-card__image').getBoundingClientRect();

                return {
                    card: {
                        bottom: cardRect.bottom,
                        left: cardRect.left,
                        right: cardRect.right,
                        top: cardRect.top
                    },
                    image: {
                        height: imageRect.height,
                        width: imageRect.width
                    }
                };
            }));

        expect(spotlight1.card.top - featured.card.bottom).toBeGreaterThanOrEqual(16);
        expect(spotlight2.card.top - spotlight1.card.bottom).toBeGreaterThanOrEqual(16);
        expect(spotlight3.card.top - spotlight2.card.bottom).toBeGreaterThanOrEqual(16);
        expect(secondary.card.top - spotlight3.card.bottom).toBeGreaterThanOrEqual(16);
        expect(featured.image.width).toBeCloseTo(spotlight1.image.width, 1);
        expect(featured.image.height).toBeCloseTo(spotlight1.image.height, 1);
        expect(featured.image.width).toBeCloseTo(spotlight2.image.width, 1);
        expect(featured.image.height).toBeCloseTo(spotlight2.image.height, 1);
        expect(featured.image.width).toBeCloseTo(spotlight3.image.width, 1);
        expect(featured.image.height).toBeCloseTo(spotlight3.image.height, 1);
        expect(featured.image.width).toBeGreaterThanOrEqual(secondary.image.width * 1.12);
        expect(featured.image.height).toBeGreaterThanOrEqual(secondary.image.height * 1.12);
        expect(spotlight1.image.width).toBeGreaterThanOrEqual(secondary.image.width * 1.12);
        expect(spotlight1.image.height).toBeGreaterThanOrEqual(secondary.image.height * 1.12);
        expect(spotlight2.image.width).toBeGreaterThanOrEqual(secondary.image.width * 1.12);
        expect(spotlight2.image.height).toBeGreaterThanOrEqual(secondary.image.height * 1.12);
        expect(spotlight3.image.width).toBeGreaterThanOrEqual(secondary.image.width * 1.12);
        expect(spotlight3.image.height).toBeGreaterThanOrEqual(secondary.image.height * 1.12);

        for (const video of [featured, spotlight1, spotlight2, spotlight3, secondary]) {
            expect(video.card.left).toBeGreaterThanOrEqual(-1);
            expect(video.card.right).toBeLessThanOrEqual(viewport.width + 1);
        }
    }
});

test('keeps the mobile page overflow-free with a prominent, uncropped flyer', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const flyer = await getFlyerLayout(page);
    const viewport = page.viewportSize();
    const layout = await page.evaluate(() => ({
        bodyScrollWidth: document.body.scrollWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportWidth: window.innerWidth
    }));

    expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(layout.bodyScrollWidth).toBeLessThanOrEqual(layout.viewportWidth + 1);
    expect(flyer.left).toBeGreaterThanOrEqual(-4);
    expect(flyer.right).toBeLessThanOrEqual(viewport.width + 4);
    expect(flyer.offsetWidth).toBeGreaterThanOrEqual(viewport.width * 0.85);
    expect(flyer.offsetHeight).toBeGreaterThanOrEqual(viewport.height * 0.48);
    expect(flyer.top).toBeLessThan(viewport.height * 0.2);
    expect(flyer.bottom).toBeLessThan(viewport.height);
    expect(flyer.offsetWidth / flyer.offsetHeight).toBeCloseTo(FLYER_ASPECT_RATIO, 2);
});

test('gives the flyer a strong side-by-side desktop presentation', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');

    const flyer = await getFlyerLayout(page);
    const heroCopy = await page.locator('.hero-copy').evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return {
            left: rect.left,
            right: rect.right
        };
    });
    const viewport = page.viewportSize();
    const visibleFlyerHeight = Math.min(flyer.bottom, viewport.height) - Math.max(flyer.top, 0);

    expect(flyer.offsetWidth).toBeGreaterThanOrEqual(viewport.width * 0.38);
    expect(flyer.offsetHeight).toBeGreaterThanOrEqual(viewport.height * 0.72);
    expect(flyer.top).toBeLessThan(viewport.height * 0.2);
    expect(visibleFlyerHeight).toBeGreaterThanOrEqual(viewport.height * 0.75);
    expect(heroCopy.left - flyer.right).toBeGreaterThan(16);
    expect(flyer.right).toBeLessThanOrEqual(viewport.width + 4);
    expect(flyer.offsetWidth / flyer.offsetHeight).toBeCloseTo(FLYER_ASPECT_RATIO, 2);

    const flyerFrame = page.locator('.flyer-link');
    const alignment = await flyerFrame.evaluate((element) => ({
        flyerTransform: getComputedStyle(element).transform,
        outlineTransform: getComputedStyle(element.parentElement, '::before').transform
    }));

    expect(alignment.flyerTransform).toBe('none');
    expect(alignment.outlineTransform).toBe('none');

    await flyerFrame.scrollIntoViewIfNeeded();
    const beforeHover = await flyerFrame.boundingBox();
    expect(beforeHover).not.toBeNull();

    await flyerFrame.hover();
    await flyerFrame.evaluate(async (element) => {
        await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });

    const afterHover = await flyerFrame.boundingBox();
    expect(afterHover).not.toBeNull();

    for (const key of ['x', 'y', 'width', 'height']) {
        expect(afterHover[key]).toBeCloseTo(beforeHover[key], 1);
    }
});
