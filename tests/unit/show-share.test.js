// @vitest-environment node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { afterEach, describe, expect, it, vi } from 'vitest';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = fs.readFileSync(path.join(root, 'show-state.js'), 'utf8');
const pages = ['index.html', 'qr/index.html'];
const windows = [];
const TITLE = 'Rad Dad + Friends with The Fault Lines';
const URL = 'https://raddadband.com/#show';
const BEFORE = Date.parse('2026-09-10T12:00:00-05:00');
const START = Date.parse('2026-09-19T19:00:00-05:00');
const END = Date.parse('2026-09-19T22:00:00-05:00');

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

async function settle() {
    for (let tick = 0; tick < 12; tick += 1) await Promise.resolve();
}

function loadPage({ page = pages[0], now = BEFORE, share, canShare, writeText, url = 'https://raddadband.com/' } = {}) {
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    // Outside-only deliberately does not run inline scripts or request external
    // scripts, images, or provider frames. Only the real local controller runs.
    const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url });
    const { window } = dom;
    windows.push(window);
    let clock = now;
    vi.spyOn(window.Date, 'now').mockImplementation(() => clock);
    vi.spyOn(window, 'setInterval').mockReturnValue(1);
    vi.spyOn(window, 'clearInterval').mockImplementation(() => {});
    Object.defineProperty(window.navigator, 'share', { configurable: true, value: share });
    Object.defineProperty(window.navigator, 'canShare', { configurable: true, value: canShare });
    Object.defineProperty(window.navigator, 'clipboard', {
        configurable: true,
        value: writeText ? { writeText } : undefined
    });
    window.open = vi.fn();
    window.fetch = vi.fn(() => { throw new Error('Network must never be used by show sharing'); });
    Object.defineProperty(window.navigator, 'sendBeacon', { configurable: true, value: vi.fn() });
    window.eval(source);
    const api = window.RadDadShowState;
    expect(api).toBeTruthy();
    const container = window.document.querySelector('[data-show-share]');
    expect(container, `${page} exposes the fan share action`).not.toBeNull();
    const nodes = {
        action: container.querySelector('[data-show-share-action]'),
        status: container.querySelector('[data-show-share-status]'),
        fallback: container.querySelector('[data-show-share-fallback]'),
        text: container.querySelector('[data-show-share-text]'),
        copy: container.querySelector('[data-show-share-copy]'),
        select: container.querySelector('[data-show-share-select]')
    };
    for (const [name, node] of Object.entries(nodes)) expect(node, `${page}: ${name}`).not.toBeNull();
    const stop = api.start(window.document);
    return { window, document: window.document, api, container, stop, ...nodes, setTime(value) { clock = value; } };
}

function assertPayload(details, phase) {
    expect(Object.isFrozen(details)).toBe(true);
    expect(Object.keys(details).sort()).toEqual(['copyText', 'phase', 'text', 'title', 'url']);
    expect(details.phase).toBe(phase);
    expect(details.title).toBe(TITLE);
    expect(details.url).toBe(URL);
    for (const fact of [TITLE, 'Saturday, September 19, 2026', '7–10 PM Central (CDT)', 'Guitars & Growlers', '581 W Campbell Rd Suite 101', 'Richardson, TX 75080', 'Free']) {
        expect(details.text, `Canonical fact: ${fact}`).toContain(fact);
    }
    expect(details.copyText).toBe(`${details.text}\n${URL}`);
}

afterEach(() => {
    windows.splice(0).forEach((window) => window.close());
    vi.restoreAllMocks();
});

describe('one canonical shareable September 19 show', () => {
    it('uses immutable complete facts and the existing exact Central-time boundaries', () => {
        const { api } = loadPage();
        for (const [time, phase] of [
            [BEFORE, 'upcoming'],
            [Date.parse('2026-09-19T00:00:00-05:00'), 'tonight'],
            [START - 1, 'tonight'], [START, 'live'], [END - 1, 'live'], [END, 'complete']
        ]) assertPayload(api.shareDetails(time), phase);
        expect(api.shareDetails(START).text).toMatch(/live|happening/i);
        expect(api.shareDetails(END).text).toMatch(/past|ended|complete|archive/i);
        expect(api.shareDetails(END).text).not.toMatch(/upcoming|next show|tonight|join us/i);
        expect(() => api.shareDetails(Number.NaN)).toThrow();
    });

    it('keeps sharing facts aligned with calendar and homepage structured event data', () => {
        const { api, document } = loadPage();
        const details = api.shareDetails(BEFORE);
        const calendar = fs.readFileSync(path.join(root, 'assets/rad-dad-friends-guitars-growlers-2026.ics'), 'utf8')
            .replace(/\r?\n[ \t]/g, '').replace(/\\,/g, ',');
        expect(calendar).toContain(`SUMMARY:${details.title}`);
        expect(calendar).toContain('DTSTART:20260920T000000Z');
        expect(calendar).toContain('DTEND:20260920T030000Z');
        expect(calendar).toContain('LOCATION:Guitars & Growlers, 581 W Campbell Rd Suite 101, Richardson, TX 75080');
        const records = Array.from(document.querySelectorAll('script[type="application/ld+json"]')).flatMap((script) => {
            const value = JSON.parse(script.textContent);
            return Array.isArray(value) ? value : value['@graph'] || [value];
        });
        const event = records.find((record) => record['@type'] === 'MusicEvent' || record['@type'] === 'Event');
        expect(event).toBeTruthy();
        expect(Date.parse(event.startDate)).toBe(START);
        expect(Date.parse(event.endDate)).toBe(END);
        expect(event.location.name).toBe('Guitars & Growlers');
        expect(event.location.address.streetAddress).toBe('581 W Campbell Rd Suite 101');
        expect(details.text).toContain(event.location.address.postalCode);
    });

    it.each(pages)('%s supplies accessible progressive controls without a second event source', (page) => {
        const ui = loadPage({ page });
        expect(ui.document.querySelectorAll('[data-show-share]')).toHaveLength(1);
        expect(ui.action.tagName).toBe('BUTTON');
        expect(ui.action.type).toBe('button');
        expect(ui.status.getAttribute('role')).toBe('status');
        expect(ui.text.tagName).toBe('TEXTAREA');
        expect(ui.text.readOnly).toBe(true);
        expect(ui.copy.type).toBe('button');
        expect(ui.select.type).toBe('button');
        expect(ui.fallback.hidden).toBe(true);
        expect(ui.container.textContent).not.toMatch(/send automatically|contacts imported|rsvp confirmed/i);
    });

    it.each(pages)('%s never shares preview hosts, sticker tracking, paths, or owner hashes', async (page) => {
        const share = vi.fn().mockResolvedValue(undefined);
        const ui = loadPage({ page, share, url: 'https://preview.invalid/RadDadSite/qr/?token=fixture-secret&utm_source=sticker#owner-private' });
        ui.action.click();
        await settle();
        expect(share).toHaveBeenCalledExactlyOnceWith({ title: TITLE, text: ui.api.shareDetails(BEFORE).text, url: URL });
        const payload = JSON.stringify(share.mock.calls[0][0]);
        expect(payload).not.toMatch(/preview\.invalid|fixture-secret|utm_|owner-private|RadDadSite|show-control/);
        expect(ui.window.open).not.toHaveBeenCalled();
        expect(ui.window.fetch).not.toHaveBeenCalled();
        expect(ui.window.navigator.sendBeacon).not.toHaveBeenCalled();
    });
});

describe('explicit device sharing and honest recovery', () => {
    it('does nothing at startup and wires repeated start calls only once', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        const writeText = vi.fn().mockResolvedValue(undefined);
        const ui = loadPage({ share, writeText });
        ui.api.start(ui.document);
        ui.api.start(ui.document);
        expect(share).not.toHaveBeenCalled();
        expect(writeText).not.toHaveBeenCalled();
        ui.action.click(); await settle();
        expect(share).toHaveBeenCalledOnce();
        expect(writeText).not.toHaveBeenCalled();
        expect(ui.status.textContent).not.toMatch(/^(sent|delivered)\b/i);
    });

    it('is single-flight while the native share sheet is unsettled', async () => {
        const pending = deferred();
        const share = vi.fn(() => pending.promise);
        const writeText = vi.fn().mockResolvedValue(undefined);
        const ui = loadPage({ share, writeText });
        ui.action.click(); ui.action.click(); ui.action.click();
        expect(share).toHaveBeenCalledOnce();
        expect(ui.action.disabled).toBe(true);
        ui.copy.click();
        expect(writeText).not.toHaveBeenCalled();
        pending.resolve(); await settle();
        expect(ui.action.disabled).toBe(false);
    });

    it('cancelled or unavailable native targets offer explicit copy without copying automatically', async () => {
        const share = vi.fn().mockRejectedValue(Object.assign(new Error('Cancelled fixture'), { name: 'AbortError' }));
        const writeText = vi.fn().mockResolvedValue(undefined);
        const ui = loadPage({ share, writeText });
        ui.action.click(); await settle();
        expect(share).toHaveBeenCalledOnce();
        expect(writeText).not.toHaveBeenCalled();
        expect(ui.action.disabled).toBe(false);
        expect(ui.status.textContent).toMatch(/cancel/i);
        expect(ui.status.textContent).toMatch(/unavailable/i);
        expect(ui.status.textContent).not.toMatch(/^(sent|shared|copied|delivered)\b/i);
        expect(ui.window.open).not.toHaveBeenCalled();
        expect(ui.fallback.hidden).toBe(false);
        expect(ui.text.value).toBe(ui.api.shareDetails(BEFORE).copyText);
        expect(ui.document.activeElement).toBe(ui.action);
        ui.copy.click(); await settle();
        expect(share).toHaveBeenCalledOnce();
        expect(writeText).toHaveBeenCalledExactlyOnceWith(ui.api.shareDetails(BEFORE).copyText);
        expect(ui.status.textContent).toMatch(/copied/i);
    });

    it('a native share rejection exposes explicit copy instead of performing a second action', async () => {
        const share = vi.fn().mockRejectedValue(new Error('Provider fixture secret must not be echoed'));
        const writeText = vi.fn().mockResolvedValue(undefined);
        const ui = loadPage({ share, writeText });
        ui.action.click(); await settle();
        expect(writeText).not.toHaveBeenCalled();
        expect(ui.fallback.hidden).toBe(false);
        expect(ui.text.value).toBe(ui.api.shareDetails(BEFORE).copyText);
        expect(ui.status.textContent).not.toContain('Provider fixture secret');
        expect(ui.status.textContent).not.toMatch(/^(sent|shared|copied|delivered)\b/i);
        ui.copy.click(); await settle();
        expect(writeText).toHaveBeenCalledExactlyOnceWith(ui.api.shareDetails(BEFORE).copyText);
        expect(ui.status.textContent).toMatch(/copied/i);
    });

    it.each(['unsupported', 'throws'])('canShare %s never invokes native sharing or silently copies', async (mode) => {
        const canShare = vi.fn(() => {
            if (mode === 'throws') throw new Error('Device capability fixture failure');
            return false;
        });
        const share = vi.fn().mockResolvedValue(undefined);
        const writeText = vi.fn().mockResolvedValue(undefined);
        const ui = loadPage({ share, canShare, writeText });
        ui.action.click(); await settle();
        expect(canShare).toHaveBeenCalledExactlyOnceWith({ title: TITLE, text: ui.api.shareDetails(BEFORE).text, url: URL });
        expect(share).not.toHaveBeenCalled();
        expect(writeText).not.toHaveBeenCalled();
        expect(ui.fallback.hidden).toBe(false);
        expect(ui.text.value).toBe(ui.api.shareDetails(BEFORE).copyText);
        expect(ui.status.textContent).not.toMatch(/^(sent|shared|copied|delivered)\b/i);
    });

    it('a browser without native sharing copies only after the primary gesture', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        const ui = loadPage({ writeText });
        expect(writeText).not.toHaveBeenCalled();
        ui.action.click(); await settle();
        expect(writeText).toHaveBeenCalledExactlyOnceWith(ui.api.shareDetails(BEFORE).copyText);
        expect(ui.status.textContent).toMatch(/copied/i);
        expect(ui.window.open).not.toHaveBeenCalled();
    });

    it('clipboard rejection preserves full manually selectable details without a success claim', async () => {
        const writeText = vi.fn().mockRejectedValue(new Error('Clipboard fixture denied'));
        const ui = loadPage({ writeText });
        ui.action.click(); await settle();
        expect(ui.fallback.hidden).toBe(false);
        expect(ui.text.value).toBe(ui.api.shareDetails(BEFORE).copyText);
        expect(ui.status.textContent).not.toMatch(/^copied\b/i);
        ui.select.click();
        expect(ui.document.activeElement).toBe(ui.text);
        expect(ui.text.selectionStart).toBe(0);
        expect(ui.text.selectionEnd).toBe(ui.text.value.length);
        expect(writeText).toHaveBeenCalledOnce();
    });

    it('missing clipboard support still exposes useful complete manual text', async () => {
        const ui = loadPage();
        ui.action.click(); await settle();
        expect(ui.fallback.hidden).toBe(false);
        expect(ui.text.value).toBe(ui.api.shareDetails(BEFORE).copyText);
        ui.select.click();
        expect(ui.text.selectionEnd).toBe(ui.text.value.length);
        expect(ui.status.textContent).not.toMatch(/^(sent|shared|copied|delivered)\b/i);
    });

    it('recomputes phase at every share attempt, including a page left open until the show ends', async () => {
        const share = vi.fn().mockResolvedValue(undefined);
        const ui = loadPage({ share, now: START - 1 });
        ui.action.click(); await settle();
        expect(share.mock.calls[0][0].text).toBe(ui.api.shareDetails(START - 1).text);
        ui.setTime(START);
        ui.action.click(); await settle();
        expect(share.mock.calls[1][0].text).toBe(ui.api.shareDetails(START).text);
        ui.setTime(END);
        ui.action.click(); await settle();
        expect(share.mock.calls[2][0].text).toBe(ui.api.shareDetails(END).text);
        expect(share.mock.calls[2][0].text).toMatch(/past|ended|complete|archive/i);
    });

    it('explicit copy after an earlier failed share uses current facts, not an old invitation buffer', async () => {
        const share = vi.fn().mockRejectedValue(new Error('Fixture unsupported'));
        const writeText = vi.fn().mockResolvedValue(undefined);
        const ui = loadPage({ share, writeText, now: END - 1 });
        ui.action.click(); await settle();
        ui.setTime(END);
        ui.copy.click(); await settle();
        expect(writeText).toHaveBeenCalledExactlyOnceWith(ui.api.shareDetails(END).copyText);
        expect(writeText.mock.calls[0][0]).toMatch(/past|ended|complete|archive/i);
    });

    it('does not describe a pre-boundary clipboard completion as freshly copied current details', async () => {
        const pending = deferred();
        const writeText = vi.fn(() => pending.promise);
        const ui = loadPage({ writeText, now: END - 1 });
        ui.action.click();
        expect(writeText).toHaveBeenCalledExactlyOnceWith(ui.api.shareDetails(END - 1).copyText);
        ui.setTime(END);
        pending.resolve(); await settle();
        expect(ui.status.textContent).toMatch(/current|review|changed|updated/i);
        expect(ui.status.textContent).not.toMatch(/^copied\b/i);
        expect(ui.text.value).toBe(ui.api.shareDetails(END).copyText);
    });

    it('stop removes share listeners and ignores a late native completion', async () => {
        const pending = deferred();
        const share = vi.fn(() => pending.promise);
        const ui = loadPage({ share });
        ui.action.click();
        expect(share).toHaveBeenCalledOnce();
        ui.stop();
        const stoppedStatus = ui.status.textContent;
        pending.resolve(); await settle();
        expect(ui.status.textContent).toBe(stoppedStatus);
        ui.action.click();
        expect(share).toHaveBeenCalledOnce();
    });

    it('synchronous native and clipboard exceptions receive the same honest recovery', async () => {
        const share = vi.fn(() => { throw new Error('Native fixture throw'); });
        const writeText = vi.fn(() => { throw new Error('Clipboard fixture throw'); });
        const ui = loadPage({ share, writeText });
        expect(() => ui.action.click()).not.toThrow(); await settle();
        expect(ui.fallback.hidden).toBe(false);
        expect(writeText).not.toHaveBeenCalled();
        expect(() => ui.copy.click()).not.toThrow(); await settle();
        expect(ui.text.value).toBe(ui.api.shareDetails(BEFORE).copyText);
        expect(ui.status.textContent).not.toMatch(/^(sent|shared|copied|delivered)\b/i);
    });
});
