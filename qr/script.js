document.documentElement.classList.add('js');

const revealItems = document.querySelectorAll('[data-reveal]');

if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -7%'
    });

    revealItems.forEach((item) => revealObserver.observe(item));
} else {
    revealItems.forEach((item) => item.classList.add('is-visible'));
}

const currentYear = document.querySelector('#current-year');
if (currentYear) currentYear.textContent = new Date().getFullYear();

const liveVideoDialog = document.querySelector('#live-video-dialog');
const liveVideoFrame = liveVideoDialog?.querySelector('[data-video-frame]');
const liveVideoTitle = liveVideoDialog?.querySelector('#live-video-title');
const liveVideoContext = liveVideoDialog?.querySelector('[data-video-context]');
const liveVideoLink = liveVideoDialog?.querySelector('[data-video-youtube]');
const liveVideoClose = liveVideoDialog?.querySelector('[data-video-close]');
let liveVideoTrigger = null;

function getYouTubeVideo(card) {
    try {
        const watchUrl = new URL(card.href, window.location.href);
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

function resetLiveVideo() {
    liveVideoFrame?.removeAttribute('src');
    document.documentElement.classList.remove('has-video-dialog');

    if (liveVideoTrigger) {
        liveVideoTrigger.focus({ preventScroll: true });
        liveVideoTrigger = null;
    }
}

document.querySelectorAll('[data-inline-video]').forEach((card) => {
    card.addEventListener('click', (event) => {
        const isPlainPrimaryClick = event.button === 0
            && !event.metaKey
            && !event.ctrlKey
            && !event.shiftKey
            && !event.altKey;
        const video = getYouTubeVideo(card);

        if (!isPlainPrimaryClick
            || !video
            || !liveVideoDialog
            || !liveVideoFrame
            || !liveVideoTitle
            || !liveVideoContext
            || !liveVideoLink
            || typeof liveVideoDialog.showModal !== 'function') return;

        liveVideoTitle.textContent = video.title;
        liveVideoContext.textContent = video.context;
        liveVideoLink.href = video.watchUrl;
        liveVideoFrame.title = `Watch Rad Dad perform ${video.title}`;
        liveVideoFrame.src = video.embedUrl;
        liveVideoTrigger = card;

        try {
            liveVideoDialog.showModal();
        } catch {
            resetLiveVideo();
            return;
        }

        document.documentElement.classList.add('has-video-dialog');
        event.preventDefault();
    });
});

liveVideoClose?.addEventListener('click', () => liveVideoDialog.close());

liveVideoDialog?.addEventListener('click', (event) => {
    if (event.target === liveVideoDialog) liveVideoDialog.close();
});

liveVideoDialog?.addEventListener('close', resetLiveVideo);
