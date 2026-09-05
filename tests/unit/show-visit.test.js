// @vitest-environment node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(root, 'show-state.js'), 'utf8');
const BEFORE = Date.parse('2026-09-10T12:00:00-05:00');
const LIVE = Date.parse('2026-09-19T21:59:59-05:00');
const END = Date.parse('2026-09-19T22:00:00-05:00');
const windows = [];

function loadPage(page = 'index.html', now = BEFORE) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    // Real markup and controller, with no provider frames or remote scripts run.
    const { window } = new JSDOM(html, {
        runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://raddadband.com/'
    });
    windows.push(window);
    let clock = now;
    vi.spyOn(window.Date, 'now').mockImplementation(() => clock);
    vi.spyOn(window, 'setInterval').mockReturnValue(1);
    vi.spyOn(window, 'clearInterval').mockImplementation(() => {});
    window.eval(source);
    const document = window.document;
    const visit = document.querySelector('[data-show-visit]');
    expect(visit, `${page} contains visit planning`).not.toBeNull();
    return {
        window, document, visit, api: window.RadDadShowState,
        title: visit.querySelector('[data-show-visit-title]'),
        directions: visit.querySelector('[data-show-visit-directions]'),
        setTime(value) { clock = value; }
    };
}

afterEach(() => {
    windows.splice(0).forEach((window) => window.close());
    vi.restoreAllMocks();
});

describe('readable venue details share the existing event facts', () => {
    it.each(['index.html', 'qr/index.html'])('%s exposes calendar and share facts without JavaScript', (page) => {
        const ui = loadPage(page);
        const calendar = fs.readFileSync(path.join(root, 'assets/rad-dad-friends-guitars-growlers-2026.ics'), 'utf8')
            .replace(/\r?\n[ \t]/g, '').replace(/\\,/g, ',');
        const location = calendar.match(/^LOCATION:(.+)$/m)[1].trim();
        const share = ui.api.shareDetails(BEFORE).text;
        const readable = ui.visit.textContent.replace(/\s+/g, ' ').trim();
        const address = location.slice('Guitars & Growlers, '.length);
        for (const part of address.split(', ')) {
            expect(readable).toContain(part);
            expect(share).toContain(part);
        }
        expect(readable).toContain('September 19, 2026');
        expect(readable).toContain('7–10 PM Central (CDT)');
        expect(share).toContain('7–10 PM Central (CDT)');
        expect(calendar).toContain('DTSTART:20260920T000000Z');
        expect(calendar).toContain('DTEND:20260920T030000Z');
        expect(ui.visit.tagName).toBe('DETAILS');
        expect(ui.title.tagName).toBe('SUMMARY');
        expect(ui.visit.firstElementChild).toBe(ui.title);
        expect(ui.visit.open).toBe(false);
        expect(ui.title.textContent).toBe('Plan your visit');
        expect(ui.directions.hidden).toBe(false);
        expect(ui.visit.querySelector('iframe, form, [download], [href$=".ics"]')).toBeNull();
    });

    it('changes the travel invitation into historical venue information without closing it', () => {
        const ui = loadPage();
        ui.visit.open = true;
        ui.api.apply(ui.document, LIVE);
        expect(ui.title.textContent).toBe('Plan your visit');
        expect(ui.directions.hidden).toBe(false);
        ui.api.apply(ui.document, END);
        expect(ui.title.textContent).toBe('Venue details');
        expect(ui.directions.hidden).toBe(true);
        expect(ui.visit.open).toBe(true);
        expect(ui.visit.textContent).toContain('581 W Campbell Rd Suite 101');
        const venue = ui.visit.querySelector('a[href="https://guitarsandgrowlers.com/locations"]');
        expect(venue).not.toBeNull();
        expect(venue.hidden).toBe(false);
    });
});

describe('returning fans see current show timing', () => {
    it.each(['pageshow', 'visibilitychange'])('%s refreshes the whole show without waiting for its interval', (event) => {
        const ui = loadPage('qr/index.html', LIVE);
        const stop = ui.api.start(ui.document);
        ui.visit.open = true;
        expect(ui.document.documentElement.dataset.showPhase).toBe('live');
        ui.setTime(END);
        const target = event === 'pageshow' ? ui.window : ui.document;
        target.dispatchEvent(new ui.window.Event(event));
        expect(ui.document.documentElement.dataset.showPhase).toBe('complete');
        expect(ui.title.textContent).toBe('Venue details');
        expect(ui.directions.hidden).toBe(true);
        expect(ui.visit.open).toBe(true);
        expect(ui.document.querySelector('[data-show-primary-action]').getAttribute('href')).toBe('#wildflower');
        expect(ui.document.querySelector('[data-show-status]').textContent).toBe('Show complete');
        expect(ui.document.querySelector('[data-show-share-action]').textContent).toMatch(/past show details$/);
        stop();
    });

    it('stopped controllers ignore return events and a fresh start resumes updates only once', () => {
        const ui = loadPage('index.html', LIVE);
        const stop = ui.api.start(ui.document);
        expect(ui.api.start(ui.document)).toBe(stop);
        expect(ui.window.setInterval).toHaveBeenCalledOnce();
        stop();
        ui.setTime(END);
        ui.window.dispatchEvent(new ui.window.Event('pageshow'));
        ui.document.dispatchEvent(new ui.window.Event('visibilitychange'));
        expect(ui.document.documentElement.dataset.showPhase).toBe('live');
        expect(ui.title.textContent).toBe('Plan your visit');
        expect(ui.directions.hidden).toBe(false);
        expect(ui.window.clearInterval).toHaveBeenCalledOnce();
        const stopAgain = ui.api.start(ui.document);
        expect(ui.document.documentElement.dataset.showPhase).toBe('complete');
        expect(ui.directions.hidden).toBe(true);
        expect(ui.window.setInterval).toHaveBeenCalledTimes(2);
        ui.setTime(LIVE);
        ui.window.dispatchEvent(new ui.window.Event('pageshow'));
        expect(ui.document.documentElement.dataset.showPhase).toBe('live');
        expect(ui.directions.hidden).toBe(false);
        stopAgain();
    });
});
