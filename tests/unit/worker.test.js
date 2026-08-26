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
