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
    // Shared by both fan surfaces; checked against the existing event and ICS.
    // Never share a preview URL, tracking query, private fragment, or guessed event.
    const SHARE_FACTS = Object.freeze({
        title: 'Rad Dad + Friends with The Fault Lines',
        date: 'Saturday, September 19, 2026',
        time: '7–10 PM Central (CDT)',
        venue: 'Guitars & Growlers',
        street: '581 W Campbell Rd Suite 101',
        city: 'Richardson, TX 75080',
        cover: 'Free show',
        url: 'https://raddadband.com/#show'
    });

    function isPlainActivation(event) {
        return event.button === 0
            && !event.metaKey
            && !event.ctrlKey
            && !event.shiftKey
            && !event.altKey;
    }

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
                watchTitle: 'Hear Rad Dad before the show',
                watchLede: 'Start with the song that became ours, then the Wildflower tapes.',
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
                watchTitle: 'Hear Rad Dad before the show',
                watchLede: 'Start with the song that became ours, then the Wildflower tapes.',
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
                watchTitle: 'Hear Rad Dad before the show',
                watchLede: 'Start with the song that became ours, then the Wildflower tapes.',
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
            watchTitle: 'Watch Rad Dad live',
            watchLede: 'The Wildflower tapes and The Story Of Us stay on this page.',
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

    function shareDetails(now = Date.now()) {
        const { phase } = getShowState(now);
        const introduction = {
            upcoming: 'Join us for a free show.',
            tonight: 'Tonight — free live music.',
            live: 'Happening now — until 10 PM Central (CDT).',
            complete: 'Past show — September 19, 2026.'
        }[phase];
        const text = [
            introduction, SHARE_FACTS.title, SHARE_FACTS.date, SHARE_FACTS.time,
            SHARE_FACTS.venue, SHARE_FACTS.street, SHARE_FACTS.city, SHARE_FACTS.cover
        ].join('\n');

        return Object.freeze({
            phase,
            title: SHARE_FACTS.title,
            text,
            url: SHARE_FACTS.url,
            copyText: `${text}\n${SHARE_FACTS.url}`
        });
    }

    function initializeShowSharing(root) {
        let active = true;
        let busy = false;
        const widgets = Array.from(root.querySelectorAll('[data-show-share]')).map((container) => ({
            container,
            action: container.querySelector('[data-show-share-action]'),
            status: container.querySelector('[data-show-share-status]'),
            fallback: container.querySelector('[data-show-share-fallback]'),
            text: container.querySelector('[data-show-share-text]'),
            copy: container.querySelector('[data-show-share-copy]'),
            select: container.querySelector('[data-show-share-select]')
        })).filter((widget) => Object.values(widget).every(Boolean));
        const removers = [];

        function message(widget, text) {
            if (active) widget.status.textContent = text;
        }

        function refresh() {
            if (!active) return;
            const details = shareDetails();
            const native = typeof global.navigator?.share === 'function';
            widgets.forEach((widget) => {
                widget.action.hidden = false;
                widget.action.disabled = busy;
                widget.copy.disabled = busy;
                widget.action.setAttribute('aria-busy', String(busy));
                widget.copy.setAttribute('aria-busy', String(busy));
                const subject = details.phase === 'complete' ? 'past show details' : 'show details';
                widget.action.textContent = busy ? 'Please wait…' : `${native ? 'Share' : 'Copy'} ${subject}`;
                if (!widget.fallback.hidden && widget.text.value !== details.copyText) {
                    widget.text.value = details.copyText;
                    message(widget, 'Show timing changed. Review the updated details before copying.');
                }
            });
        }

        function showFallback(widget, selectText = false) {
            if (!active) return;
            widget.text.value = shareDetails().copyText;
            widget.fallback.hidden = false;
            if (selectText) {
                widget.text.focus({ preventScroll: true });
                widget.text.select();
            } else {
                widget.copy.focus({ preventScroll: true });
            }
        }

        function finish(widget, details) {
            if (!active) return false;
            busy = false;
            refresh();
            if (details.phase !== shareDetails().phase) {
                showFallback(widget);
                message(widget, 'Show timing changed while that action was open. Review the current details below before using them.');
                return false;
            }
            return true;
        }

        async function copyDetails(widget) {
            if (!active || busy) return;
            const details = shareDetails();
            busy = true;
            refresh();
            message(widget, 'Copying show details…');
            try {
                if (typeof global.navigator?.clipboard?.writeText !== 'function') {
                    throw new Error('Clipboard unavailable');
                }
                // Invoked directly from this copy gesture, never after a share failure.
                await global.navigator.clipboard.writeText(details.copyText);
                if (finish(widget, details)) {
                    message(widget, 'Show details copied. Paste them wherever you choose.');
                }
            } catch {
                if (!finish(widget, details)) return;
                showFallback(widget, true);
                message(widget, 'Automatic copy is unavailable. The details are selected below; use your device’s Copy command.');
            }
        }

        async function shareShow(widget) {
            if (!active || busy) return;
            if (typeof global.navigator?.share !== 'function') {
                await copyDetails(widget);
                return;
            }
            const details = shareDetails();
            const payload = { title: details.title, text: details.text, url: details.url };
            busy = true;
            refresh();
            message(widget, 'Opening your device’s share options…');
            try {
                if (typeof global.navigator.canShare === 'function' && !global.navigator.canShare(payload)) {
                    throw new Error('Sharing unavailable');
                }
                // No await before this call: preserve the browser's user activation.
                await global.navigator.share(payload);
                if (finish(widget, details)) {
                    message(widget, 'Share options closed. Delivery is handled by the app you chose.');
                }
            } catch (error) {
                if (!finish(widget, details)) return;
                if (error?.name === 'AbortError') {
                    // The API also uses AbortError when no share targets exist.
                    // Offer an explicit alternative, never infer consent to copy.
                    showFallback(widget);
                    widget.action.focus({ preventScroll: true });
                    message(widget, 'Sharing cancelled or unavailable. Nothing was copied; copy the details below if you prefer.');
                } else {
                    showFallback(widget);
                    message(widget, 'Sharing is unavailable here. Copy the show details below instead.');
                }
            }
        }

        function bind(element, event, listener) {
            element.addEventListener(event, listener);
            removers.push(() => element.removeEventListener(event, listener));
        }

        widgets.forEach((widget) => {
            bind(widget.action, 'click', () => { void shareShow(widget); });
            bind(widget.copy, 'click', () => { void copyDetails(widget); });
            bind(widget.select, 'click', () => {
                if (!active || busy) return;
                showFallback(widget, true);
                message(widget, 'Show details selected. Use your device’s Copy command.');
            });
        });
        refresh();

        return {
            refresh,
            stop() {
                active = false;
                removers.forEach((remove) => remove());
                widgets.forEach((widget) => { widget.action.hidden = true; });
            }
        };
    }

    function configuredAction(action, state) {
        const key = state.primaryActionKey;
        const liveAction = key === 'live' ? LIVE_PRIMARY_ACTION : null;
        const href = liveAction?.href || action.dataset[`${key}Href`];
        const label = liveAction?.label || action.dataset[`${key}Label`];

        return href && label ? { href, label, key } : null;
    }

    function applyExternalLinkAttrs(action, href) {
        if (href.startsWith('https://')) {
            action.setAttribute('target', '_blank');
            action.setAttribute('rel', 'noopener noreferrer');
        } else {
            action.removeAttribute('target');
            action.removeAttribute('rel');
        }
    }

    function applyPrimaryActions(root, state) {
        root.querySelectorAll('[data-show-primary-action]').forEach((action) => {
            const configured = configuredAction(action, state);
            const labelNode = action.querySelector('[data-show-primary-label]');

            if (!configured || !labelNode) {
                action.hidden = true;
                return;
            }

            action.hidden = false;
            action.setAttribute('href', configured.href);
            action.setAttribute('aria-label', configured.label);
            labelNode.textContent = configured.label;

            if (configured.key === 'upcoming' && action.dataset.upcomingDownload === 'true') {
                action.setAttribute('download', '');
            } else {
                action.removeAttribute('download');
            }

            applyExternalLinkAttrs(action, configured.href);
        });
    }

    function applyStripActions(root, state) {
        root.querySelectorAll('[data-show-strip-action]').forEach((action) => {
            const configured = configuredAction(action, state);
            const labelNode = action.querySelector('[data-show-strip-label]');

            // Keep the persistent status strip visible if a phase is
            // misconfigured; the static HTML fallback remains the show panel.
            if (!configured || !labelNode) return;

            action.setAttribute('href', configured.href);
            labelNode.textContent = configured.label;
            applyExternalLinkAttrs(action, configured.href);
        });
    }

    function focusInPageAction(root, action) {
        const href = action.getAttribute('href');

        if (!href || !href.startsWith('#') || href.length < 2) return;

        const target = root.getElementById(href.slice(1));
        if (!target) return;

        if (!target.hasAttribute('tabindex')) {
            target.tabIndex = -1;
        }
        target.focus({ preventScroll: false });
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
        setText(root, '[data-show-watch-title]', state.watchTitle);
        setText(root, '[data-show-watch-lede]', state.watchLede);

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
        root.querySelectorAll('[data-show-visit]').forEach((visit) => {
            const summary = visit.querySelector('[data-show-visit-title]');
            if (summary) summary.textContent = state.phase === 'complete' ? 'Venue details' : 'Plan your visit';
            visit.querySelectorAll('[data-show-visit-directions]').forEach((action) => {
                // Keep the disclosure open and keyboard focus useful when a
                // returning fan's directions action expires at show end.
                if (state.hideDirections && root.activeElement === action) {
                    summary?.focus({ preventScroll: true });
                }
                action.hidden = state.hideDirections;
            });
        });

        applyPrimaryActions(root, state);
        applyStripActions(root, state);
        return state;
    }

    function start(root = global.document) {
        if (activeDocuments.has(root)) {
            return activeDocuments.get(root);
        }

        const sharing = initializeShowSharing(root);
        const refresh = () => {
            applyShowState(root, Date.now());
            sharing.refresh();
        };
        const onInPageAction = (event) => {
            const origin = event.target?.nodeType === 1
                ? event.target
                : event.target?.parentElement;
            const action = origin?.closest?.(
                '[data-show-primary-action], [data-show-strip-action]'
            );
            if (!action || !root.contains(action) || !isPlainActivation(event)) return;
            focusInPageAction(root, action);
        };
        const interval = global.setInterval(refresh, 60 * 1000);
        // Refresh the entire fan journey immediately on return from a map,
        // background tab or back/forward cache, including an open visit panel.
        root.addEventListener('visibilitychange', refresh);
        global.addEventListener('pageshow', refresh);
        root.addEventListener('click', onInPageAction);
        const stop = () => {
            global.clearInterval(interval);
            root.removeEventListener('visibilitychange', refresh);
            global.removeEventListener('pageshow', refresh);
            root.removeEventListener('click', onInPageAction);
            sharing.stop();
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
        shareDetails,
        start
    });
}(window));
