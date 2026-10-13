const { test, expect } = require('./fixtures');

const SAMPLE_SELECTORS = [
    'h1',
    'h2',
    '.band-hero__lede',
    '.section-kicker',
    '.button--primary',
    '.button--secondary',
    '.text-link',
    '.site-nav a',
    '.header-socials__link',
    '.share-button',
    '.band-members dt',
    '.band-members dd',
    '.upcoming-shows p',
    '.contact-note',
    '.footer-layout a',
    '.video-card__label',
    'figcaption > span:last-child'
];

const contrastScript = `(() => {
    function parseColor(value) {
        const match = String(value || '').match(/rgba?\\(([^)]+)\\)/i);
        if (!match) return [0, 0, 0, 0];
        const parts = match[1].split(',').map((part) => parseFloat(part.trim()));
        return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
    }
    function channel(component) {
        const value = component / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }
    function luminance(rgb) {
        return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
    }
    function contrast(first, second) {
        const lighter = Math.max(luminance(first), luminance(second));
        const darker = Math.min(luminance(first), luminance(second));
        return (lighter + 0.05) / (darker + 0.05);
    }
    function blend(foreground, background) {
        const alpha = foreground[3];
        if (alpha >= 1) return [foreground[0], foreground[1], foreground[2], 1];
        if (alpha <= 0) return background;
        return [
            foreground[0] * alpha + background[0] * (1 - alpha),
            foreground[1] * alpha + background[1] * (1 - alpha),
            foreground[2] * alpha + background[2] * (1 - alpha),
            1
        ];
    }
    function effectiveBackground(element) {
        const stack = [];
        let node = element;
        while (node && node.nodeType === 1) {
            stack.push(parseColor(getComputedStyle(node).backgroundColor));
            node = node.parentElement;
        }
        let background = [23, 20, 16, 1];
        for (let index = stack.length - 1; index >= 0; index -= 1) {
            background = blend(stack[index], background);
        }
        return background;
    }
    function isLarge(style) {
        const size = parseFloat(style.fontSize);
        const weight = parseInt(style.fontWeight, 10) || 400;
        return size >= 24 || (size >= 18.66 && weight >= 700);
    }
    function hasOwnText(element) {
        return [...element.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
    }
    function isVisible(element) {
        const style = getComputedStyle(element);
        if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) {
            return false;
        }
        const box = element.getBoundingClientRect();
        return box.width > 0 && box.height > 0;
    }

    const root = getComputedStyle(document.documentElement);
    const failures = [];
    let checked = 0;
    for (const selector of ${JSON.stringify(SAMPLE_SELECTORS)}) {
        for (const element of document.querySelectorAll(selector)) {
            if (!isVisible(element) || !hasOwnText(element)) continue;
            checked += 1;
            const style = getComputedStyle(element);
            const background = effectiveBackground(element);
            const foreground = blend(parseColor(style.color), background);
            const ratio = contrast(foreground, background);
            const needed = isLarge(style) ? 3 : 4.5;
            if (ratio < needed) {
                failures.push({
                    selector,
                    text: element.innerText.trim().slice(0, 80),
                    ratio: Number(ratio.toFixed(2)),
                    needed
                });
            }
        }
    }

    const focus = [];
    const focusables = [
        document.querySelector('.brand'),
        document.querySelector('.site-nav a'),
        document.querySelector('.header-socials__link'),
        document.querySelector('.button--primary'),
        document.querySelector('.button--secondary'),
        document.querySelector('.share-button:not([hidden]), [data-copy-band]')
    ].filter(Boolean);
    for (const element of focusables) {
        element.focus();
        const style = getComputedStyle(element);
        const background = effectiveBackground(element.parentElement || element);
        const outline = blend(parseColor(style.outlineColor), background);
        focus.push({
            name: (element.getAttribute('aria-label') || element.innerText || '').trim().slice(0, 60),
            outline: style.outline,
            width: parseFloat(style.outlineWidth),
            ratio: Number(contrast(outline, background).toFixed(2))
        });
    }

    return {
        colorScheme: root.colorScheme,
        ink: root.getPropertyValue('--ink').trim(),
        themeColor: document.querySelector('meta[name="theme-color"]')?.content || '',
        checked,
        failures,
        focus
    };
})()`;

for (const path of ['/', '/qr/']) {
    for (const width of [1280, 390]) {
        test(`${path} keeps WCAG AA text, links, buttons, and focus rings at ${width}px`, async ({ page }) => {
            await page.setViewportSize({ width, height: width === 1280 ? 800 : 844 });
            await page.goto(path);
            const audit = await page.evaluate(contrastScript);
            expect(audit.colorScheme).toMatch(/dark/);
            expect(audit.ink).toBe('#171410');
            expect(audit.themeColor).toBe('#171410');
            expect(audit.checked).toBeGreaterThan(8);
            expect(audit.failures, JSON.stringify(audit.failures, null, 2)).toEqual([]);
            expect(audit.focus.length).toBeGreaterThanOrEqual(4);
            for (const ring of audit.focus) {
                expect(ring.width, ring.name).toBeGreaterThanOrEqual(3);
                expect(ring.ratio, ring.name).toBeGreaterThanOrEqual(3);
                expect(ring.outline, ring.name).toMatch(/rgb\(181,\s*220,\s*8\)/);
            }
        });
    }
}
