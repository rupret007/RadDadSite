(() => {
    const script = document.currentScript;
    const endpoint = script?.dataset.radDadAnalytics;
    const page = script?.dataset.page;
    const pathname = location.pathname;
    const canonicalPage = pathname === '/play/hub.html' ? '/play/' : pathname.replace(/\/index\.html$/, '/');
    if (!endpoint || !page || canonicalPage !== page || location.origin !== 'https://raddadband.com'
        || window.top !== window || navigator.webdriver || navigator.globalPrivacyControl === true
        || navigator.doNotTrack === '1') return;

    function send(path, { event = false, referrer = '' } = {}) {
        const url = new URL(endpoint);
        url.searchParams.set('p', path);
        if (event) url.searchParams.set('e', '1');
        if (referrer) url.searchParams.set('r', referrer);
        fetch(url, {
            mode: 'no-cors',
            credentials: 'omit',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            keepalive: true
        }).catch(() => { /* Analytics can be blocked without affecting the site. */ });
    }

    function referrerOrigin() {
        if (!document.referrer) return '';
        const referrer = new URL(document.referrer);
        if (!['https:', 'http:'].includes(referrer.protocol) || referrer.origin === location.origin) return '';
        return referrer.origin;
    }

    const actions = new Set(['hangout-open', 'arcade-open', 'booking-email-click', 'booking-call-click', 'music-link-click']);
    const countedActions = new Set();
    document.addEventListener('click', event => {
        const action = event.target.closest?.('[data-analytics-action]')?.dataset.analyticsAction;
        if (!actions.has(action) || countedActions.has(action)) return;
        countedActions.add(action);
        send(action, { event: true });
    }, { capture: true });

    const section = page.startsWith('/play/') ? 'arcade' : page === '/qr/' ? 'qr' : 'home';
    const milestones = [30, 120, 300];
    let elapsed = 0;
    let visibleFrom;
    let timer;
    let next = 0;
    let counted = false;

    function pause() {
        clearTimeout(timer);
        if (visibleFrom === undefined) return;
        elapsed += performance.now() - visibleFrom;
        visibleFrom = undefined;
        while (next < milestones.length && elapsed >= milestones[next] * 1000) {
            send(`engagement-${section}-${milestones[next]}s`, { event: true });
            next++;
        }
    }

    function updateVisibility() {
        pause();
        if (document.visibilityState !== 'visible') return;
        if (!counted) {
            counted = true;
            send(page, { referrer: referrerOrigin() });
        }
        if (next === milestones.length) return;
        visibleFrom = performance.now();
        timer = setTimeout(updateVisibility, milestones[next] * 1000 - elapsed);
    }

    document.addEventListener('visibilitychange', updateVisibility);
    window.addEventListener('pagehide', pause);
    window.addEventListener('pageshow', updateVisibility);
    updateVisibility();
})();
