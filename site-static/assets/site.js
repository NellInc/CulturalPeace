/* Cultural Peace — shared interactions: sticky header, progress bar,
   back-to-top, and reveal-on-scroll. No dependencies. */
(function () {
    'use strict';

    var header = document.querySelector('.site-header');
    var progressBar = document.getElementById('progressBar');
    var backToTop = document.getElementById('backToTop');
    var ticking = false;

    function onScroll() {
        var scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        if (header) {
            header.classList.toggle('scrolled', scrollTop > 60);
        }

        if (progressBar) {
            var docHeight = document.documentElement.scrollHeight - window.innerHeight;
            var pct = docHeight > 0 ? Math.min(1, Math.max(0, scrollTop / docHeight)) : 0;
            progressBar.style.transform = 'scaleX(' + pct + ')';
        }

        if (backToTop) {
            backToTop.classList.toggle('visible', scrollTop > 600);
        }

        ticking = false;
    }

    window.addEventListener('scroll', function () {
        if (!ticking) {
            window.requestAnimationFrame(onScroll);
            ticking = true;
        }
    }, { passive: true });

    onScroll();

    if (backToTop) {
        backToTop.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // Reveal-on-scroll for elements marked .reveal
    var revealables = document.querySelectorAll('.reveal');
    if (revealables.length && 'IntersectionObserver' in window &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });
        revealables.forEach(function (el) { observer.observe(el); });
    } else {
        revealables.forEach(function (el) { el.classList.add('revealed'); });
    }
})();
