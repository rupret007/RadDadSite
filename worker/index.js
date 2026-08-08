const worker = {
    async fetch(request, env) {
        const requestUrl = new URL(request.url);

        if (request.method === 'GET' && (requestUrl.pathname === '/tap' || requestUrl.pathname === '/nfc' || requestUrl.pathname === '/nfc/')) {
            requestUrl.pathname = '/tap/';
            return Response.redirect(requestUrl.toString(), 302);
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

export default worker;
