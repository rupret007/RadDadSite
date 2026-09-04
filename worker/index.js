const worker = {
    async fetch(request, env) {
        const requestUrl = new URL(request.url);

        const canonicalQrPath = '/qr/';
        const qrAliases = new Set([
            '/qr',
            '/qr/index.html',
            '/tap',
            '/tap/',
            '/tap/index.html',
            '/nfc',
            '/nfc/',
            '/nfc/index.html'
        ]);

        if (request.method === 'GET' && qrAliases.has(requestUrl.pathname)) {
            requestUrl.pathname = canonicalQrPath;
            return Response.redirect(requestUrl.toString(), 301);
        }

        if (isClosedOwnerPath(requestUrl.pathname)) {
            return new Response('Not found', {
                status: 404,
                headers: {
                    'cache-control': 'no-store',
                    'content-type': 'text/plain; charset=utf-8'
                }
            });
        }

        const response = await env.ASSETS.fetch(request);

        if (
            response.status !== 404
            || request.method !== 'GET'
            || !request.headers.get('accept')?.includes('text/html')
        ) {
            return response;
        }

        const fallbackUrl = new URL(request.url);
        fallbackUrl.pathname = '/index.html';

        return env.ASSETS.fetch(new Request(fallbackUrl, request));
    }
};

function isClosedOwnerPath(pathname) {
    const normalized = pathname.toLowerCase();

    return normalized === '/show-control' || normalized.startsWith('/show-control/');
}

export default worker;
