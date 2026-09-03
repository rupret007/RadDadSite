// @vitest-environment node

import { describe, expect, it, vi } from 'vitest';
import worker from '../../worker/index.js';

describe('QR route aliases', () => {
    it.each([
        '/qr',
        '/qr/index.html',
        '/tap',
        '/tap/',
        '/tap/index.html',
        '/nfc',
        '/nfc/',
        '/nfc/index.html'
    ])('redirects %s to the one canonical landing page', async (path) => {
        const assetFetch = vi.fn();
        const response = await worker.fetch(
            new Request(`https://raddadband.com${path}?utm_source=route-test`),
            { ASSETS: { fetch: assetFetch } }
        );

        expect(response.status).toBe(301);
        expect(response.headers.get('location')).toBe(
            'https://raddadband.com/qr/?utm_source=route-test'
        );
        expect(assetFetch).not.toHaveBeenCalled();
    });

    it('does not create a /show-control route and never leaves the site for that path', async () => {
        const assetResponse = new Response('<h1>Rad Dad</h1>', {
            status: 200,
            headers: { 'content-type': 'text/html' }
        });
        const assetFetch = vi.fn(async (request) => {
            if (new URL(request.url).pathname === '/index.html') {
                return assetResponse;
            }

            return new Response('missing', { status: 404 });
        });

        const response = await worker.fetch(
            new Request('https://raddadband.com/show-control', {
                headers: { accept: 'text/html' }
            }),
            { ASSETS: { fetch: assetFetch } }
        );

        expect(response).toBe(assetResponse);
        expect(assetFetch).toHaveBeenCalledTimes(2);
        expect(new URL(assetFetch.mock.calls[0][0].url).pathname).toBe('/show-control');
        expect(new URL(assetFetch.mock.calls[1][0].url).pathname).toBe('/index.html');
        expect(response.headers.get('location')).toBeNull();
    });

    it('serves /qr/ through the asset binding instead of redirecting it', async () => {
        const assetResponse = new Response('<h1>Rad Dad</h1>', {
            headers: { 'content-type': 'text/html' }
        });
        const assetFetch = vi.fn(async () => assetResponse);
        const request = new Request('https://raddadband.com/qr/');

        const response = await worker.fetch(request, { ASSETS: { fetch: assetFetch } });

        expect(response).toBe(assetResponse);
        expect(assetFetch).toHaveBeenCalledOnce();
        expect(assetFetch).toHaveBeenCalledWith(request);
    });
});
