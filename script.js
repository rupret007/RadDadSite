/* Shared, progressive enhancement. All navigation and streaming links work without JavaScript. */
(function () {
    'use strict';
    let initialized = false;
    function start() {
        if (initialized) return;
        initialized = true;
        const logo = document.getElementById('logo');
        function showLogoFallback() {
            logo.hidden = true;
            const brand = logo.closest('.brand');
            if (brand && !brand.querySelector('.logo-fallback')) {
                const fallback = document.createElement('span');
                fallback.className = 'logo-fallback';
                fallback.textContent = 'RAD DAD';
                brand.prepend(fallback);
            }
        }
        if (logo) {
            logo.addEventListener('error', showLogoFallback);
            if (logo.complete && logo.naturalWidth === 0) showLogoFallback();
        }

        const header = document.querySelector('.site-header');
        function measureHeader() {
            const height = header?.getBoundingClientRect().height;
            if (height > 0) document.documentElement.style.setProperty('--header-height', `${Math.ceil(height)}px`);
        }
        if (header && 'ResizeObserver' in window) new ResizeObserver(measureHeader).observe(header);
        window.addEventListener('resize', measureHeader, { passive: true });
        measureHeader();

        document.querySelectorAll('[data-load-preview]').forEach((button) => {
            const host = button.parentElement;
            const template = host.querySelector('template[data-preview-template]');
            if (!template) return;
            button.hidden = false;
            button.addEventListener('click', () => {
                if (host.querySelector('iframe')) return;
                host.append(template.content.cloneNode(true));
                button.hidden = true;
            });
            window.addEventListener('pagehide', () => {
                host.querySelectorAll('iframe').forEach((frame) => frame.remove());
                button.hidden = false;
            });
        });

        // Share a fixed public band URL, never a preview, query string or private fragment.
        const share = document.querySelector('[data-share-band]');
        const status = document.querySelector('[data-share-status]');
        const fallback = document.querySelector('[data-share-fallback]');
        const copy = document.querySelector('[data-copy-band]');
        if (!share || !status || !fallback || !copy) return;
        const bandUrl = 'https://raddadband.com/';
        let busy = false;
        let generation = 0;
        share.hidden = false;
        const showFallback = () => { fallback.hidden = false; status.textContent = 'Copy the band website below.'; };
        share.addEventListener('click', async () => {
            if (busy) return;
            if (typeof navigator.share !== 'function') { showFallback(); return; }
            busy = true;
            share.disabled = true;
            const request = ++generation;
            status.textContent = '';
            try {
                await navigator.share({ title: 'Rad Dad | DFW Cover Band', text: 'Pop-punk, punk and alternative covers from Dallas–Fort Worth.', url: bandUrl });
                if (request === generation) status.textContent = 'Sharing options closed.';
            } catch (error) {
                if (request !== generation) return;
                if (error?.name === 'AbortError') status.textContent = 'Sharing canceled.';
                else showFallback();
            } finally {
                if (request === generation) { busy = false; share.disabled = false; }
            }
        });
        copy.addEventListener('click', async () => {
            if (copy.disabled) return;
            copy.disabled = true;
            const request = generation;
            try {
                if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
                await navigator.clipboard.writeText(bandUrl);
                if (request === generation) status.textContent = 'Band website copied.';
            } catch {
                if (request === generation) status.textContent = 'Select the website address and copy it manually.';
            } finally {
                if (request === generation) copy.disabled = false;
            }
        });
        window.addEventListener('pagehide', () => {
            generation += 1;
            busy = false;
            share.disabled = false;
            copy.disabled = false;
            status.textContent = '';
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
    else start();
}());
