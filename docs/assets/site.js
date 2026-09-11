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

/* Propose an amendment — per-principle form posting to the intake Worker,
   which opens a GitHub Issue for review. Until AMEND_ENDPOINT and
   TURNSTILE_SITE_KEY are filled in, the form opens but explains that
   submissions are not yet connected. */
(function () {
    'use strict';

    var AMEND_ENDPOINT = 'https://culturalpeace-amendments.nell-b82.workers.dev';      // e.g. https://culturalpeace-amendments.<account>.workers.dev
    var TURNSTILE_SITE_KEY = '0x4AAAAAAEwplZBFRHx3WDGk';  // public site key from the Cloudflare Turnstile dashboard
    var TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

    var dialog = document.getElementById('amendDialog');
    var form = document.getElementById('amendForm');
    var buttons = document.querySelectorAll('.amend-btn');
    if (!dialog || !form || !buttons.length) return;

    if (typeof dialog.showModal !== 'function') return; // very old browsers keep a plain page
    var configured = Boolean(AMEND_ENDPOINT && TURNSTILE_SITE_KEY);
    var heading = document.getElementById('amendHeading');
    var status = document.getElementById('amendStatus');
    var submit = document.getElementById('amendSubmit');
    var turnstileBox = document.getElementById('amendTurnstile');
    var principleInput = form.querySelector('input[name="principle"]');
    var cancelBtn = form.querySelector('.amend-actions [data-amend-close]');
    var widgetId = null;
    var turnstileLoading = null;
    var opener = null;

    buttons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            opener = btn;
            openFor(btn.getAttribute('data-principle'), btn.getAttribute('data-title'));
        });
    });

    function openFor(number, title) {
        form.reset();
        form.classList.remove('is-sent');
        setStatus('', '');
        submit.disabled = false;
        if (cancelBtn) cancelBtn.textContent = 'Cancel';
        principleInput.value = number;
        heading.textContent = 'Principle ' + number + ': ' + title;
        dialog.showModal();
        if (!configured) {
            setStatus('The proposal form is not yet connected. Please check back soon.', 'is-error');
            submit.disabled = true;
            return;
        }
        ensureTurnstile().then(renderTurnstile).catch(function () {
            setStatus('The human check could not load. Please try again later.', 'is-error');
            submit.disabled = true;
        });
        var first = form.querySelector('#amend-passage');
        if (first) first.focus();
    }

    function close() {
        if (dialog.open) dialog.close();
    }

    dialog.querySelectorAll('[data-amend-close]').forEach(function (el) {
        el.addEventListener('click', close);
    });
    dialog.addEventListener('click', function (e) {
        if (e.target !== dialog) return;
        // Only treat it as a backdrop click if it is outside the panel itself,
        // otherwise a click on the dialog's own scrollbar would discard the form.
        var r = dialog.getBoundingClientRect();
        var outside = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
        if (outside) close();
    });
    dialog.addEventListener('close', function () {
        if (opener) opener.focus();
    });

    function ensureTurnstile() {
        if (window.turnstile) return Promise.resolve();
        if (turnstileLoading) return turnstileLoading;
        turnstileLoading = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = TURNSTILE_SRC;
            s.async = true;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
        return turnstileLoading;
    }

    function renderTurnstile() {
        if (!window.turnstile) return;
        if (widgetId !== null) {
            window.turnstile.reset(widgetId);
            return;
        }
        widgetId = window.turnstile.render(turnstileBox, {
            sitekey: TURNSTILE_SITE_KEY,
            action: 'amend', // verified server-side by the Worker
            theme: 'light',
            'error-callback': function () {
                setStatus('The human check failed to load. Please reload the page and try again.', 'is-error');
            }
        });
    }

    function setStatus(text, cls) {
        status.className = 'amend-status' + (cls ? ' ' + cls : '');
        status.textContent = text;
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        if (submit.disabled) return;

        var proposal = form.proposal.value.trim();
        var rationale = form.rationale.value.trim();
        if (proposal.length < 10) {
            setStatus('Please give the wording you are proposing.', 'is-error');
            form.proposal.focus();
            return;
        }
        if (!rationale) {
            setStatus('Please say briefly why this change would help.', 'is-error');
            form.rationale.focus();
            return;
        }
        var token = window.turnstile && widgetId !== null ? window.turnstile.getResponse(widgetId) : '';
        if (!token) {
            setStatus('Please complete the human check first.', 'is-error');
            return;
        }

        submit.disabled = true;
        setStatus('Sending your proposal…', '');

        var payload = {
            principle: principleInput.value,
            passage: form.passage.value,
            proposal: proposal,
            rationale: rationale,
            name: form.name.value,
            email: form.email.value,
            website: form.website.value,
            turnstileToken: token
        };

        fetch(AMEND_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(function (res) {
            return res.json().then(function (body) { return { ok: res.ok, body: body }; });
        }).then(function (r) {
            if (!r.ok) throw new Error(r.body && r.body.error ? r.body.error : 'Something went wrong.');
            form.classList.add('is-sent');
            if (cancelBtn) cancelBtn.textContent = 'Close';
            status.className = 'amend-status is-success';
            status.textContent = 'Thank you. Your proposal has been opened for discussion. ';
            if (r.body.url) {
                var a = document.createElement('a');
                a.href = r.body.url;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = 'Follow it here.';
                status.appendChild(a);
            }
        }).catch(function (err) {
            setStatus(err.message || 'Something went wrong. Please try again.', 'is-error');
            submit.disabled = false;
            if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
        });
    });
})();
