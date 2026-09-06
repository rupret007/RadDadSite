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
            || !acceptsHtml(request.headers.get('accept'))
            || !isRecoverablePagePath(requestUrl.pathname)
        ) {
            return response;
        }

        // An internal /index.html substitution leaves nested stale URLs as the
        // browser's base and breaks every relative stylesheet/script/action.
        // Recover at the real root without copying query data or inheriting an
        // unknown fragment. This redirect is temporary, not a permanent alias.
        const recoveryUrl = new URL('/#', request.url);
        return new Response(null, {
            status: 302,
            headers: {
                location: recoveryUrl.toString(),
                'cache-control': 'no-store',
                'referrer-policy': 'no-referrer'
            }
        });
    }
};

function isClosedOwnerPath(pathname) {
    const normalized = pathname.toLowerCase();

    return normalized === '/show-control' || normalized.startsWith('/show-control/');
}

function acceptsHtml(accept) {
    return (accept || '').split(',').some((range) => {
        const [type, ...parameters] = range.trim().toLowerCase().split(';');
        if (type.trim() !== 'text/html') return false;
        const quality = parameters.map((part) => part.trim()).filter((part) => part.startsWith('q='));
        if (quality.length === 0) return true;
        if (quality.length !== 1 || !/^q=(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(quality[0])) return false;
        return Number(quality[0].slice(2)) > 0;
    });
}

function isRecoverablePagePath(pathname) {
    // Only ordinary public page names are eligible, never encoded/reserved
    // paths or file downloads. Canonical pages retain their real missing/error
    // state, so a broken deployment cannot cause a homepage redirect loop.
    if (!/^\/[a-z0-9_-]+(?:\/[a-z0-9_-]+)*(?:\.html|\/)?$/i.test(pathname)) return false;
    const first = pathname.split('/')[1].toLowerCase();
    return !new Set([
        'index.html', 'qr', 'tap', 'nfc', 'assets', 'api', 'worker', 'scripts', 'tests'
    ]).has(first);
}

export default worker;
