document.addEventListener('DOMContentLoaded', function () {
    const logo = document.getElementById('logo');

    if (!logo) {
        return;
    }

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

    logo.addEventListener('error', showLogoFallback);

    if (logo.complete && logo.naturalWidth === 0) {
        showLogoFallback();
    }
});
