// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index.js';

const ORIGIN = 'https://preview.example.invalid';
const missing = () => new Response('missing', { status: 404 });

async function request(path, options = {}, result = missing()) {
    const assetFetch = vi.fn(async () => result);
    const input = new Request(`${ORIGIN}${path}`, {
        headers: { accept: 'text/html,application/xhtml+xml;q=0.9' },
        ...options
    });
    const response = await worker.fetch(input, { ASSETS: { fetch: assetFetch } });
    return { response, assetFetch, input, result };
}

describe('working canonical recovery from an old public page link', () => {
    it.each(['/past-show/details/', '/shows/old-night.html', '/missing-public-page'])('%s redirects instead of serving HTML at a broken asset base', async (path) => {
        const { response, assetFetch } = await request(`${path}?token=fixture-secret&next=https://other.invalid/#private`);
        expect(response.status).toBe(302);
        // An explicit empty fragment also prevents browser inheritance of an
        // incoming private/stale fragment, which never reaches a real server.
        expect(response.headers.get('location')).toBe(`${ORIGIN}/#`);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('referrer-policy')).toBe('no-referrer');
        expect(await response.text()).toBe('');
        expect(assetFetch).toHaveBeenCalledOnce();
    });

    it.each(['/', '/index.html', '/qr/'])('does not loop or substitute another page if canonical %s is missing', async (path) => {
        const { response, result, assetFetch } = await request(path);
        expect(response).toBe(result);
        expect(response.status).toBe(404);
        expect(response.headers.get('location')).toBeNull();
        expect(assetFetch).toHaveBeenCalledOnce();
    });

    it.each([
        '/assets/lost.ics', '/assets/missing/', '/missing.js', '/missing.css',
        '/missing.webp', '/missing.json', '/api/missing', '/worker/missing',
        '/scripts/missing', '/tests/missing', '/private/missing',
        '/private/garage-rehearsal-k7m2n9/lost.html', '/.git/config', '/package.json',
        '/%73how-control/', '/old%2fpath/', '/old%2epage'
    ])('keeps missing resource or reserved path %s as a real 404', async (path) => {
        const { response, result } = await request(path);
        expect(response).toBe(result);
        expect(response.headers.get('location')).toBeNull();
    });

    it.each([
        '/GPT/', '/GPT/index.html', '/gPt/nested/old.html',
        '/backup_restore_point/', '/backup_restore_point/index.html',
        '/node_modules/index.html', '/test-results/', '/test-results/index.html',
        '/playwright-report/index.html', '/docs/index.html', '/pr-assets/review/',
        '/dist/client/index.html', '/preview-dist/index.html'
    ])('keeps excluded source/build page %s as the original 404', async (path) => {
        const { response, result, assetFetch, input } = await request(`${path}?source=old-link`);
        expect(response).toBe(result);
        expect(response.status).toBe(404);
        expect(response.headers.get('location')).toBeNull();
        expect(await response.text()).toBe('missing');
        expect(assetFetch).toHaveBeenCalledExactlyOnceWith(input);
    });

    it.each(['/gpt-night/', '/docs-show/recap.html', '/backup_restore_points/'])('still recovers ordinary public name %s without reserving a prefix', async (path) => {
        const { response } = await request(`${path}?source=old-link`);
        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(`${ORIGIN}/#`);
    });

    it.each(['GET', 'HEAD'])('preserves canonical QR aliases for %s with their query', async (method) => {
        for (const alias of ['/qr', '/qr/index.html', '/tap', '/tap/', '/tap/index.html', '/nfc', '/nfc/', '/nfc/index.html']) {
            const { response, assetFetch } = await request(`${alias}?utm_source=fixture`, { method });
            expect(response.status, alias).toBe(301);
            expect(response.headers.get('location'), alias).toBe(`${ORIGIN}/qr/?utm_source=fixture`);
            expect(assetFetch, alias).not.toHaveBeenCalled();
        }
    });

    it.each(['POST', 'PUT', 'DELETE', 'HEAD'])('never converts %s to a homepage navigation', async (method) => {
        const { response, result } = await request('/past-show/details/', { method });
        expect(response).toBe(result);
        expect(response.headers.get('location')).toBeNull();
    });

    it.each(['', '*/*', 'application/json', 'text/html;q=0', 'text/html;q=bogus', 'text/html;q=2', 'text/htmlish'])('does not redirect a client that does not accept HTML: %s', async (accept) => {
        const { response, result } = await request('/past-show/details/', { headers: { accept } });
        expect(response).toBe(result);
    });

    it('respects case and positive quality in an actual HTML accept range', async () => {
        const { response } = await request('/past-show/details/', { headers: { accept: 'application/json, Text/HTML; q=0.8' } });
        expect(response.status).toBe(302);
    });

    it.each([200, 301, 403, 500, 503])('preserves an asset response with status %s without hiding errors', async (status) => {
        const result = new Response('existing response', { status, headers: { 'x-fixture': 'preserved' } });
        const { response, assetFetch, input } = await request('/past-show/details/', {}, result);
        expect(response).toBe(result);
        expect(assetFetch).toHaveBeenCalledExactlyOnceWith(input);
    });

    it.each(['/show-control', '/SHOW-CONTROL/sets', '/show-control/index.html'])('owner boundary %s stays closed before any asset lookup', async (path) => {
        const { response, assetFetch } = await request(path);
        expect(response.status).toBe(404);
        expect(response.headers.get('cache-control')).toBe('no-store');
        expect(response.headers.get('location')).toBeNull();
        expect(assetFetch).not.toHaveBeenCalled();
    });
});
