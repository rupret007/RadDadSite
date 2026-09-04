(function initializeRadDadShowState(global) {
    'use strict';

    const SHOW_TIMING = Object.freeze({
        dayStartsAt: Date.parse('2026-09-19T00:00:00-05:00'),
        startsAt: Date.parse('2026-09-19T19:00:00-05:00'),
        endsAt: Date.parse('2026-09-19T22:00:00-05:00')
    });
    const LIVE_PRIMARY_ACTION = Object.freeze({
        href: 'https://rad-dad-show-night.jeffstory007.chatgpt.site/#official-sets',
        label: 'See the running order'
    });
    const DAY_MS = 24 * 60 * 60 * 1000;
    const activeDocuments = new WeakMap();

    function getShowState(now = Date.now()) {
        const timestamp = Number(now);

        if (!Number.isFinite(timestamp)) {
            throw new TypeError('Show-state time must be a finite timestamp.');
        }

        if (timestamp < SHOW_TIMING.dayStartsAt) {
            const daysToGo = Math.max(
                1,
                Math.ceil((SHOW_TIMING.dayStartsAt - timestamp) / DAY_MS)
            );
            const tomorrow = daysToGo === 1;

            return Object.freeze({
                phase: 'upcoming',
                status: tomorrow ? 'Tomorrow' : 'Next show',
                detail: tomorrow
                    ? 'Tomorrow · 7–10 PM · Free'
                    : `${daysToGo} days to go · September 19 · 7–10 PM · Free`,
                referencePrefix: tomorrow ? 'Tomorrow’s show is' : 'The next show is',
                historyIntro: 'The next show is locked in. Here’s where Rad Dad has already turned it up this year.',
                participationKicker: 'Make some noise before the show',
                sectionKicker: 'Hear it live',
                linkLabel: tomorrow ? 'Tomorrow’s show' : 'September 19 show',
                seeLinkLabel: tomorrow ? 'See tomorrow’s show' : 'See the September 19 show',
                detailsLinkLabel: tomorrow ? 'See tomorrow’s show details' : 'See full show details',
                cardActionsLabel: tomorrow ? 'Tomorrow’s show actions' : 'Next show actions',
                primaryActionKey: 'upcoming',
                hideCalendar: false,
                hideDirections: false,
                archiveCard: false
            });
        }

        if (timestamp < SHOW_TIMING.startsAt) {
            return Object.freeze({
                phase: 'tonight',
                status: 'Tonight',
                detail: 'Tonight · 7–10 PM · Free',
                referencePrefix: 'Tonight’s show is',
                historyIntro: 'Tonight is locked in. Here’s where Rad Dad has already turned it up this year.',
                participationKicker: 'Make some noise before tonight’s show',
                sectionKicker: 'Hear it tonight',
                linkLabel: 'Tonight’s show',
                seeLinkLabel: 'See tonight’s show',
                detailsLinkLabel: 'See tonight’s show details',
                cardActionsLabel: 'Tonight’s show actions',
                primaryActionKey: 'tonight',
                hideCalendar: false,
                hideDirections: false,
                archiveCard: false
            });
        }

        if (timestamp < SHOW_TIMING.endsAt) {
            return Object.freeze({
                phase: 'live',
                status: 'Live now',
                detail: 'Happening now · until 10 PM · Free',
                referencePrefix: 'The show is live at',
                historyIntro: 'Rad Dad + Friends is happening now. The earlier 2026 shows are below.',
                participationKicker: 'Follow the show live',
                sectionKicker: 'Live right now',
                linkLabel: 'Live show details',
                seeLinkLabel: 'See the live show',
                detailsLinkLabel: 'See live show details',
                cardActionsLabel: 'Live show actions',
                primaryActionKey: 'live',
                hideCalendar: true,
                hideDirections: false,
                archiveCard: false
            });
        }

        return Object.freeze({
            phase: 'complete',
            status: 'Show complete',
            detail: 'September 19 · thanks for coming',
            referencePrefix: 'That show was at',
            historyIntro: 'September 19 is now in the archive with the other 2026 shows.',
            participationKicker: 'Keep the next set loud',
            sectionKicker: 'From the show',
            linkLabel: 'September 19 show archive',
            seeLinkLabel: 'See the September 19 show archive',
            detailsLinkLabel: 'See the September 19 show archive',
            cardActionsLabel: 'September 19 show archive actions',
            primaryActionKey: 'complete',
            hideCalendar: true,
            hideDirections: true,
            archiveCard: true
        });
    }

    function setText(root, selector, value) {
        root.querySelectorAll(selector).forEach((element) => {
            element.textContent = value;
        });
    }

    function applyPrimaryActions(root, state) {
        root.querySelectorAll('[data-show-primary-action]').forEach((action) => {
            const key = state.primaryActionKey;
            const liveAction = key === 'live' ? LIVE_PRIMARY_ACTION : null;
            const href = liveAction?.href || action.dataset[`${key}Href`];
            const label = liveAction?.label || action.dataset[`${key}Label`];
            const labelNode = action.querySelector('[data-show-primary-label]');

            if (!href || !label || !labelNode) {
                action.hidden = true;
                return;
            }

            action.hidden = false;
            action.setAttribute('href', href);
            action.setAttribute('aria-label', label);
            labelNode.textContent = label;

            if (key === 'upcoming' && action.dataset.upcomingDownload === 'true') {
                action.setAttribute('download', '');
            } else {
                action.removeAttribute('download');
            }

            if (href.startsWith('https://')) {
                action.setAttribute('target', '_blank');
                action.setAttribute('rel', 'noopener noreferrer');
            } else {
                action.removeAttribute('target');
                action.removeAttribute('rel');
            }
        });
    }

    function applyShowState(root = global.document, now = Date.now()) {
        const state = getShowState(now);
        const documentElement = root.documentElement;

        if (documentElement) {
            documentElement.dataset.showPhase = state.phase;
        }

        setText(root, '[data-show-status]', state.status);
        setText(root, '[data-show-detail]', state.detail);
        setText(root, '[data-show-reference-prefix]', state.referencePrefix);
        setText(root, '[data-show-history-intro]', state.historyIntro);
        setText(root, '[data-show-participation-kicker]', state.participationKicker);
        setText(root, '[data-show-section-kicker]', state.sectionKicker);
        setText(root, '[data-show-link-label]', state.linkLabel);
        setText(root, '[data-show-see-link-label]', state.seeLinkLabel);
        setText(root, '[data-show-details-link-label]', state.detailsLinkLabel);

        root.querySelectorAll('[data-show-calendar]').forEach((element) => {
            element.hidden = state.hideCalendar;
        });
        root.querySelectorAll('[data-show-directions]').forEach((element) => {
            element.hidden = state.hideDirections;
        });
        root.querySelectorAll('[data-show-card-actions]').forEach((element) => {
            element.setAttribute('aria-label', state.cardActionsLabel);
        });
        root.querySelectorAll('[data-show-card]').forEach((element) => {
            element.classList.toggle('show-card--featured', !state.archiveCard);
            element.classList.toggle('show-card--past', state.archiveCard);
        });
        root.querySelectorAll('[data-show-moment]').forEach((element) => {
            element.dataset.phase = state.phase;
        });

        applyPrimaryActions(root, state);
        return state;
    }

    function start(root = global.document) {
        if (activeDocuments.has(root)) {
            return activeDocuments.get(root);
        }

        const refresh = () => applyShowState(root, Date.now());
        const interval = global.setInterval(refresh, 60 * 1000);
        const stop = () => {
            global.clearInterval(interval);
            activeDocuments.delete(root);
        };

        refresh();
        activeDocuments.set(root, stop);
        return stop;
    }

    global.RadDadShowState = Object.freeze({
        SHOW_TIMING,
        apply: applyShowState,
        get: getShowState,
        start
    });
}(window));
