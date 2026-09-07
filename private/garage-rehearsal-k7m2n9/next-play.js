(function initializeBandLabNextPlay(global) {
    'use strict';

    const LAST_GAME_KEY = 'turdsuite_last_game';
    const HUB_HREF = 'turdanoid/index.html';
    const SEWER_GAMES = Object.freeze([
        Object.freeze({ page: 'TurdAnoid.html', label: 'TurdAnoid Turbo' }),
        Object.freeze({ page: 'turdtris.html', label: 'Turdtris' }),
        Object.freeze({ page: 'turdjack.html', label: 'Crapjack 21' }),
        Object.freeze({ page: 'crapeights.html', label: 'Crappy Eights' }),
        Object.freeze({ page: 'turdrummy.html', label: 'TurdRummy' }),
        Object.freeze({ page: 'turdspades.html', label: 'TurdSpades' })
    ]);
    const GAME_BY_PAGE = Object.freeze(Object.fromEntries(
        SEWER_GAMES.map((game) => [game.page, game])
    ));
    const HUB_PLAY = Object.freeze({
        kind: 'hub',
        page: '',
        label: 'Turdanoid hub',
        href: HUB_HREF,
        action: 'Open the sewer hub',
        note: 'After you play on this phone, this ticket names Continue or last-played. Reload or come back.'
    });

    function hrefForPage(page) {
        return `turdanoid/${page}`;
    }

    function allowlistedGame(page) {
        return Object.prototype.hasOwnProperty.call(GAME_BY_PAGE, page)
            ? GAME_BY_PAGE[page]
            : null;
    }

    function liveContinuePages(storage, tableContinue) {
        if (!tableContinue || typeof tableContinue.listLiveContinuePages !== 'function') {
            return [];
        }

        let listed;
        try {
            listed = tableContinue.listLiveContinuePages(storage);
        } catch {
            return [];
        }

        if (!Array.isArray(listed)) {
            return [];
        }

        return listed.filter((page) => allowlistedGame(page));
    }

    function lastPlayedPage(storage) {
        if (!storage || typeof storage.getItem !== 'function') {
            return '';
        }

        let last = '';
        try {
            last = String(storage.getItem(LAST_GAME_KEY) || '');
        } catch {
            return '';
        }

        return allowlistedGame(last) ? last : '';
    }

    function resolveNextPlay(storage, tableContinue) {
        const continuing = liveContinuePages(storage, tableContinue);
        if (continuing.length) {
            const page = continuing[0];
            const game = GAME_BY_PAGE[page];
            return {
                kind: 'continue',
                page,
                label: game.label,
                href: hrefForPage(page),
                action: `Continue ${game.label}`,
                note: 'Unfinished table on this phone. Arcade mid-run saves stay parked with Turdanoid #8.'
            };
        }

        const last = lastPlayedPage(storage);
        if (last) {
            const game = GAME_BY_PAGE[last];
            return {
                kind: 'again',
                page: last,
                label: game.label,
                href: hrefForPage(last),
                action: `Play ${game.label} again`,
                note: 'Last opened on this phone. A new phone is a blank desk. This URL is not a lock.'
            };
        }

        return { ...HUB_PLAY };
    }

    function applyNextPlay(root, play) {
        if (!root || !play) {
            return;
        }

        const link = root.querySelector('[data-band-lab-next-play]');
        const note = root.querySelector('[data-band-lab-next-note]');

        if (link) {
            link.setAttribute('href', play.href);
            link.textContent = play.action;
        }

        if (note) {
            note.textContent = play.note;
        }
    }

    function isNextPlayStorageKey(key, tableContinue) {
        if (key == null) {
            return true;
        }

        const continueKey = tableContinue && tableContinue.CONTINUE_KEY;
        return key === LAST_GAME_KEY || (typeof continueKey === 'string' && key === continueKey);
    }

    function bind(root, storage, tableContinue) {
        const render = function renderNextPlay() {
            applyNextPlay(root, resolveNextPlay(storage, tableContinue));
        };

        render();

        if (typeof global.addEventListener === 'function') {
            global.addEventListener('storage', function onBandLabStorage(event) {
                if (isNextPlayStorageKey(event && event.key, tableContinue)) {
                    render();
                }
            });
            global.addEventListener('pageshow', render);
        }

        const document = global.document;
        if (document && typeof document.addEventListener === 'function') {
            document.addEventListener('visibilitychange', function onBandLabVisible() {
                if (document.visibilityState === 'visible') {
                    render();
                }
            });
        }

        return render;
    }

    function boot() {
        const document = global.document;
        if (!document) {
            return;
        }

        const root = document.querySelector('[data-band-lab-next]');
        if (!root) {
            return;
        }

        bind(root, global.localStorage, global.TurdSuiteTableContinue || null);
    }

    global.BandLabNextPlay = Object.freeze({
        LAST_GAME_KEY,
        HUB_HREF,
        SEWER_GAMES,
        resolveNextPlay,
        applyNextPlay,
        bind,
        boot
    });

    if (global.document && global.document.readyState === 'loading') {
        global.document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
}(typeof window !== 'undefined' ? window : globalThis));
