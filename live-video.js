(function initializeRadDadLiveVideo(global) {
    'use strict';

    const document = global.document;
    const liveVideoDialog = document.querySelector('#live-video-dialog');
    let liveVideoFrame = liveVideoDialog?.querySelector('[data-video-frame]');
    const liveVideoFrameTemplate = liveVideoFrame?.cloneNode(false);
    const liveVideoTitle = liveVideoDialog?.querySelector('#live-video-title');
    const liveVideoContext = liveVideoDialog?.querySelector('[data-video-context]');
    const liveVideoLink = liveVideoDialog?.querySelector('[data-video-youtube]');
    const liveVideoClose = liveVideoDialog?.querySelector('[data-video-close]');
    const liveVideoStatus = liveVideoDialog?.querySelector('[data-video-status]');
    const liveVideoRetry = liveVideoDialog?.querySelector('[data-video-retry]');
    const OPENING_DEADLINE_MS = 10_000;
    let liveVideoTrigger = null;
    let selectedVideo = null;
    let openingAttempt = null;
    let backdropPress = false;

    function isPlainPrimaryClick(event) {
        return event.button === 0
            && !event.metaKey
            && !event.ctrlKey
            && !event.shiftKey
            && !event.altKey;
    }

    function getYouTubeVideo(card) {
        try {
            const watchUrl = new URL(card.href, global.location.href);
            const isYouTube = watchUrl.protocol === 'https:'
                && ['www.youtube.com', 'youtube.com'].includes(watchUrl.hostname)
                && watchUrl.pathname === '/watch';
            const videoId = watchUrl.searchParams.get('v');

            if (!isYouTube || !/^[A-Za-z0-9_-]{11}$/.test(videoId || '')) return null;

            const title = card.querySelector('figcaption strong')?.textContent?.trim();
            const context = card.querySelector('figcaption > span')?.textContent?.trim();
            if (!title || !context) return null;

            return {
                context,
                embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`,
                title,
                watchUrl: watchUrl.href
            };
        } catch {
            return null;
        }
    }

    function retireOpeningAttempt() {
        if (!openingAttempt) return;
        const retired = openingAttempt;
        openingAttempt = null;
        global.clearTimeout(retired.timer);
        retired.frame.removeEventListener('load', retired.onLoad);
        retired.frame.removeEventListener('error', retired.onError);
    }

    function beginOpeningAttempt(video) {
        retireOpeningAttempt();
        const previousFrame = liveVideoFrame;
        const frame = liveVideoFrameTemplate.cloneNode(false);
        frame.removeAttribute('src');
        frame.title = `Watch Rad Dad perform ${video.title}`;
        const attempt = { frame, timer: null, onLoad: null, onError: null };
        openingAttempt = attempt;
        liveVideoFrame = frame;
        liveVideoRetry.disabled = true;
        liveVideoStatus.textContent = 'Opening this video. You can also watch it on YouTube.';

        function settle(message, stopPlayback = false) {
            if (openingAttempt !== attempt || selectedVideo !== video
                || liveVideoFrame !== frame || !liveVideoDialog.open) return;
            retireOpeningAttempt();
            // A timed-out navigation must not begin autoplay after the fan has
            // already been offered a manual retry or a different watch path.
            if (stopPlayback) frame.removeAttribute('src');
            liveVideoStatus.textContent = message;
            liveVideoRetry.disabled = false;
        }

        attempt.onLoad = () => settle(
            'Use the player controls to start the video. If it does not play, try again or watch on YouTube.'
        );
        attempt.onError = () => settle(
            'The embedded player could not be opened here. Try again, or watch this video on YouTube.', true
        );
        frame.addEventListener('load', attempt.onLoad);
        frame.addEventListener('error', attempt.onError);
        attempt.timer = global.setTimeout(() => settle(
            'The embedded player is taking longer than expected. Try again, or watch this video on YouTube.', true
        ), OPENING_DEADLINE_MS);

        // A fresh element keeps a late load/error from an old navigation from
        // settling this attempt. A frame load is not proof of playable media.
        frame.src = video.embedUrl;
        previousFrame.removeAttribute('src');
        previousFrame.replaceWith(frame);
    }

    function resetLiveVideo() {
        backdropPress = false;
        retireOpeningAttempt();
        selectedVideo = null;
        liveVideoFrame?.removeAttribute('src');
        if (liveVideoStatus) liveVideoStatus.textContent = '';
        if (liveVideoRetry) liveVideoRetry.disabled = true;
        document.documentElement.classList.remove('has-video-dialog');

        if (liveVideoTrigger) {
            liveVideoTrigger.focus({ preventScroll: true });
            liveVideoTrigger = null;
        }
    }

    document.querySelectorAll('[data-inline-video]').forEach((card) => {
        card.addEventListener('click', (event) => {
            const video = getYouTubeVideo(card);

            if (!isPlainPrimaryClick(event)
                || !video
                || !liveVideoDialog
                || !liveVideoFrame
                || !liveVideoTitle
                || !liveVideoContext
                || !liveVideoLink
                || !liveVideoStatus
                || !liveVideoRetry
                || !liveVideoFrameTemplate
                || typeof liveVideoDialog.showModal !== 'function') return;

            liveVideoTitle.textContent = video.title;
            liveVideoContext.textContent = video.context;
            liveVideoLink.href = video.watchUrl;
            liveVideoTrigger = card;

            try {
                liveVideoDialog.showModal();
            } catch {
                resetLiveVideo();
                return;
            }

            selectedVideo = video;
            beginOpeningAttempt(video);
            document.documentElement.classList.add('has-video-dialog');
            event.preventDefault();
        });
    });

    function closeLiveVideo() {
        liveVideoDialog.close();
        // Native close events are queued; stop playback immediately on an
        // explicit close or a normal activation of the YouTube fallback link.
        resetLiveVideo();
    }

    liveVideoClose?.addEventListener('click', closeLiveVideo);

    liveVideoRetry?.addEventListener('click', () => {
        if (!selectedVideo || openingAttempt || !liveVideoDialog.open) return;
        beginOpeningAttempt(selectedVideo);
    });

    liveVideoLink?.addEventListener('click', (event) => {
        if (isPlainPrimaryClick(event) && selectedVideo && liveVideoDialog.open) closeLiveVideo();
        // Preserve the anchor's native destination, target and modifier keys.
    });

    function isBackdropPoint(event) {
        if (event.target !== liveVideoDialog) return false;
        const bounds = liveVideoDialog.getBoundingClientRect();
        return event.clientX < bounds.left || event.clientX > bounds.right
            || event.clientY < bounds.top || event.clientY > bounds.bottom;
    }

    liveVideoDialog?.addEventListener('pointerdown', (event) => {
        backdropPress = isPlainPrimaryClick(event) && isBackdropPoint(event);
    });
    liveVideoDialog?.addEventListener('pointercancel', () => { backdropPress = false; });
    liveVideoDialog?.addEventListener('click', (event) => {
        // A drag from the panel can finish with dialog as the click target.
        // Require both ends outside; interior/border interactions keep playing.
        const dismiss = backdropPress && isBackdropPoint(event);
        backdropPress = false;
        if (dismiss) closeLiveVideo();
    });

    liveVideoDialog?.addEventListener('close', () => {
        // Ignore a queued close from an earlier opening if a new card has
        // already reopened this same dialog.
        if (!liveVideoDialog.open) resetLiveVideo();
    });

    global.addEventListener('pagehide', () => {
        // Retire the autoplay source and deadline before a history entry can
        // preserve them. Returning requires a fresh tap, even from page cache.
        // Skip the ordinary scripted focus return while leaving the document.
        liveVideoTrigger = null;
        resetLiveVideo();
        if (liveVideoDialog?.open) liveVideoDialog.close();
    });
}(window));
