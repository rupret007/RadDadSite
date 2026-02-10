// Smooth animations and interactions
document.addEventListener('DOMContentLoaded', function() {
    // Logo loading animation and error handling
    const logo = document.getElementById('logo');
    if (logo) {
        logo.addEventListener('load', function() {
            this.classList.add('loading');
        });
        
        // Handle logo loading error
        logo.addEventListener('error', function() {
            this.style.display = 'none';
            // Check if fallback already exists to prevent duplicates
            const parent = this.parentElement;
            if (parent && !parent.querySelector('.logo-fallback')) {
                const fallback = document.createElement('div');
                fallback.className = 'logo-fallback';
                fallback.style.cssText = 'color: white; font-size: 1.5rem; font-weight: bold; text-align: center;';
                fallback.textContent = 'Rad Dad';
                parent.appendChild(fallback);
            }
        });
        
        // If image is already loaded
        if (logo.complete) {
            logo.classList.add('loading');
        }
    }

    // Add parallax effect to decorations on scroll (throttled for performance)
    const decorations = document.querySelectorAll('.decoration');
    let ticking = false;
    
    function updateParallax() {
        const currentScroll = window.scrollY || window.pageYOffset;
        
        decorations.forEach((dec, index) => {
            const speed = 0.5 + (index * 0.1);
            const yPos = -(currentScroll * speed);
            dec.style.transform = `translateY(${yPos}px)`;
        });
        
        ticking = false;
    }
    
    window.addEventListener('scroll', function() {
        if (!ticking) {
            window.requestAnimationFrame(updateParallax);
            ticking = true;
        }
    });

    // Add hover effect to video container
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
        videoContainer.addEventListener('mouseenter', function() {
            this.style.transition = 'all 0.3s ease';
        });
    }

    // Add ripple effect to all links
    const links = document.querySelectorAll('.social-link, .contact-link, .festival-link');
    links.forEach(link => {
        link.addEventListener('click', function(e) {
            const ripple = document.createElement('span');
            const rect = this.getBoundingClientRect();
            const size = Math.max(rect.width, rect.height);
            const x = e.clientX - rect.left - size / 2;
            const y = e.clientY - rect.top - size / 2;
            
            ripple.style.width = ripple.style.height = size + 'px';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            ripple.classList.add('ripple');
            
            this.appendChild(ripple);
            
            setTimeout(() => {
                if (ripple && ripple.parentNode) {
                    ripple.remove();
                }
            }, 600);
        });
    });

    // Intersection Observer for fade-in animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                // Unobserve after animation to prevent unnecessary callbacks
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Observe sections
    const sections = document.querySelectorAll('.festival-section, .video-section, .social-section, .contact-section');
    sections.forEach(section => {
        section.style.opacity = '0';
        section.style.transform = 'translateY(20px)';
        section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(section);
    });

    // Add dynamic gradient to logo on hover
    const logoWrapper = document.querySelector('.logo-wrapper');
    if (logoWrapper) {
        logoWrapper.addEventListener('mouseenter', function() {
            this.style.background = 'linear-gradient(135deg, rgba(255, 0, 110, 0.1) 0%, rgba(131, 56, 236, 0.1) 100%)';
        });
        
        logoWrapper.addEventListener('mouseleave', function() {
            this.style.background = 'var(--dark-surface)';
        });
    }
    
    // Add ripple effect styles dynamically (inside DOMContentLoaded)
    const style = document.createElement('style');
    style.textContent = `
        .ripple {
            position: absolute;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.3);
            transform: scale(0);
            animation: ripple-animation 0.6s ease-out;
            pointer-events: none;
        }
        
        @keyframes ripple-animation {
            to {
                transform: scale(4);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});
