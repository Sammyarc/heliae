(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');
  var reducedQuery = matchMedia('(prefers-reduced-motion: reduce)');
  var reduced = reducedQuery.matches;
  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  var motion = !reduced && gsap && ScrollTrigger;

  /* ---------- Smooth scroll: Lenis is loaded when the browser is idle ---------- */
  var lenis = null;
  var BAR_H = 76;

  function scrollToY(y) {
    if (lenis) lenis.scrollTo(y);
    else window.scrollTo({ top: y, behavior: reduced ? 'auto' : 'smooth' });
  }

  // Sticky panels report their stuck position, so compute where each panel sits in the flow.
  var panelsWrap = document.querySelector('.panels');
  var panels = panelsWrap ? [].slice.call(panelsWrap.querySelectorAll('.panel')) : [];
  function panelTop(index) {
    var base = panelsWrap.getBoundingClientRect().top + window.scrollY;
    var y = base;
    for (var i = 0; i < index; i++) {
      var cs = getComputedStyle(panels[i]);
      y += panels[i].offsetHeight + parseFloat(cs.marginBottom);
    }
    // land where the panel sticks (just below the compact bar)
    return y - (parseFloat(getComputedStyle(panels[index] || panels[0]).top) || 10);
  }

  function targetY(el) {
    var idx = panels.indexOf(el);
    if (idx > -1) return panelTop(idx);
    var y = el.getBoundingClientRect().top + window.scrollY;
    return Math.max(0, y - (el.id === 'top' ? y : BAR_H + 10));
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href').slice(1);
    var el = id ? document.getElementById(id) : null;
    if (!el) return;
    e.preventDefault();
    var go = function () { scrollToY(targetY(el)); };
    if (menuOpen) { setMenu(false, true); requestAnimationFrame(go); } else go();
    if (history.replaceState) history.replaceState(null, '', '#' + id);
  });

  /* ---------- Menu ---------- */
  var menu = document.getElementById('menu');
  var openers = [].slice.call(document.querySelectorAll('[data-menu-open]'));
  var closeBtn = menu.querySelector('[data-menu-close]');
  var menuOpen = false;
  var lastOpener = null;
  var savedY = 0;
  var lockMode = null;
  var FOCUSABLE = 'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])';

  function setMenu(state, keepFocus) {
    if (state === menuOpen) return;
    menuOpen = state;
    menu.classList.toggle('is-open', state);
    root.classList.toggle('is-menu-open', state);
    openers.forEach(function (b) { b.setAttribute('aria-expanded', String(state)); });
    if (state) menu.removeAttribute('inert'); else menu.setAttribute('inert', '');

    // one lock at a time: Lenis if it has loaded, otherwise pin the body; release whichever was used
    if (state) {
      if (lenis) { lenis.stop(); lockMode = 'lenis'; }
      else {
        lockMode = 'pin';
        savedY = window.scrollY;
        document.body.style.position = 'fixed';
        document.body.style.top = -savedY + 'px';
        document.body.style.left = '0';
        document.body.style.right = '0';
      }
    } else if (lockMode === 'lenis') {
      if (lenis) lenis.start();
      lockMode = null;
    } else if (lockMode === 'pin') {
      lockMode = null;
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      window.scrollTo(0, savedY);
    }

    if (state) closeBtn.focus({ preventScroll: true });
    else if (!keepFocus && lastOpener) lastOpener.focus({ preventScroll: true });
  }

  openers.forEach(function (b) {
    b.addEventListener('click', function () { lastOpener = b; setMenu(true); });
  });
  closeBtn.addEventListener('click', function () { setMenu(false); });

  document.addEventListener('keydown', function (e) {
    if (!menuOpen) return;
    if (e.key === 'Escape') { setMenu(false); return; }
    if (e.key !== 'Tab') return;
    var list = [].slice.call(menu.querySelectorAll(FOCUSABLE));
    var first = list[0], last = list[list.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------- Compact bar after the hero ---------- */
  var bar = document.getElementById('bar');
  var hero = document.querySelector('.hero');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      var visible = !entries[0].isIntersecting;
      bar.classList.toggle('is-visible', visible);
      bar.querySelectorAll('a, button').forEach(function (el) { el.tabIndex = visible ? 0 : -1; });
      root.style.setProperty('--bar-visible', visible ? '1' : '0');
    }, { rootMargin: '-90px 0px 0px 0px' }).observe(hero);
  }

  /* ---------- Marquee: repeat the set until half the track covers the window ---------- */
  document.querySelectorAll('[data-marquee]').forEach(function (track) {
    var set = [].slice.call(track.children);
    var win = track.parentElement;
    function fill() {
      while (track.children.length > set.length) track.removeChild(track.lastElementChild);
      var copies = 1;
      while (track.scrollWidth / 2 < win.clientWidth || copies % 2) {
        set.forEach(function (li) {
          var c = li.cloneNode(true);
          c.setAttribute('aria-hidden', 'true');
          track.appendChild(c);
        });
        copies++;
        if (copies > 12) break;
      }
    }
    fill();
    var t;
    window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(fill, 200); });
  });

  /* ---------- FAQ accordions ---------- */
  document.querySelectorAll('.faq button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq');
      var open = btn.getAttribute('aria-expanded') !== 'true';
      // one answer open per panel, so the copy above is never pushed out of a fixed-height panel
      if (open) {
        item.parentElement.querySelectorAll('.faq.is-open').forEach(function (other) {
          if (other === item) return;
          other.classList.remove('is-open');
          other.querySelector('button').setAttribute('aria-expanded', 'false');
        });
      }
      btn.setAttribute('aria-expanded', String(open));
      item.classList.toggle('is-open', open);
    });
  });

  /* ---------- Carousels ---------- */
  document.querySelectorAll('[data-carousel]').forEach(function (car) {
    var track = car.querySelector('.carousel__track');
    var slides = [].slice.call(track.children);
    var barsWrap = car.querySelector('.progress__bars');
    var count = car.querySelector('.progress__count');
    var interval = Number(car.dataset.interval) || 6000;
    var index = 0;
    var flags = { hover: false, focus: false, offscreen: true, hidden: false };
    car.style.setProperty('--dur', interval + 'ms');

    var bars = slides.map(function (s, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', 'Show ' + (i + 1) + ' of ' + slides.length);
      b.appendChild(document.createElement('i'));
      b.addEventListener('click', function () { go(i); });
      barsWrap.appendChild(b);
      b.querySelector('i').addEventListener('animationend', function () {
        if (i === index) go((index + 1) % slides.length);
      });
      return b;
    });

    function offset(i) {
      return slides[i].offsetLeft - slides[0].offsetLeft;
    }
    function go(i) {
      index = i;
      track.style.transform = 'translateX(' + (-offset(i)) + 'px)';
      slides.forEach(function (s, k) {
        s.classList.toggle('is-active', k === i);
        s.setAttribute('aria-hidden', k === i ? 'false' : 'true');
      });
      bars.forEach(function (b, k) {
        b.classList.remove('is-active');
        b.removeAttribute('aria-current');
        if (k === i) {
          void b.offsetWidth; // restart the fill animation
          b.classList.add('is-active');
          b.setAttribute('aria-current', 'true');
        }
      });
      count.textContent = (i + 1) + ' / ' + slides.length;
    }
    function sync() {
      car.classList.toggle('is-paused', flags.hover || flags.focus || flags.offscreen || flags.hidden);
    }
    car.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse') { flags.hover = true; sync(); } });
    car.addEventListener('pointerleave', function () { flags.hover = false; sync(); });
    car.addEventListener('focusin', function () { flags.focus = true; sync(); });
    car.addEventListener('focusout', function () { flags.focus = false; sync(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { flags.offscreen = !en[0].isIntersecting; sync(); }, { threshold: .25 }).observe(car);
    } else { flags.offscreen = false; }
    document.addEventListener('visibilitychange', function () { flags.hidden = document.hidden; sync(); });

    // swipe
    var vp = car.querySelector('.carousel__viewport');
    var sx = null, sy = 0;
    vp.addEventListener('pointerdown', function (e) { sx = e.clientX; sy = e.clientY; });
    vp.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      sx = null;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        go(dx < 0 ? Math.min(index + 1, slides.length - 1) : Math.max(index - 1, 0));
      }
    });
    vp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') go(Math.min(index + 1, slides.length - 1));
      if (e.key === 'ArrowLeft') go(Math.max(index - 1, 0));
    });

    sync();
    go(0);
    var rt;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(function () {
        track.style.transition = 'none';
        track.style.transform = 'translateX(' + (-offset(index)) + 'px)';
        void track.offsetWidth;
        track.style.transition = '';
      }, 120);
    });
  });

  /* ---------- Horizontal rail with arrows ---------- */
  document.querySelectorAll('[data-rail]').forEach(function (rail) {
    var section = rail.closest('section');
    var prev = section.querySelector('[data-rail-prev]');
    var next = section.querySelector('[data-rail-next]');
    var items = [].slice.call(rail.children);
    function startAt() {
      var pad = parseFloat(getComputedStyle(rail).paddingLeft) || 0;
      if (items[1] && innerWidth > 799) rail.scrollLeft = items[1].offsetLeft - rail.offsetLeft - pad;
    }
    function update() {
      var max = rail.scrollWidth - rail.clientWidth - 2;
      if (prev) prev.disabled = rail.scrollLeft <= 2;
      if (next) next.disabled = rail.scrollLeft >= max;
    }
    function step(dir) {
      rail.scrollBy({ left: dir * rail.clientWidth * .6, behavior: reduced ? 'auto' : 'smooth' });
    }
    if (prev) prev.addEventListener('click', function () { step(-1); });
    if (next) next.addEventListener('click', function () { step(1); });
    rail.addEventListener('scroll', update, { passive: true });
    startAt();
    update();
  });

  /* ---------- Info dialog (concept placeholders, no data sent) ---------- */
  var INFO = {
    waitlist: ['Heliae Knit', 'Our merino capsule arrives in spring. Waitlist sign-ups open with the launch; this concept page does not collect details yet.'],
    login: ['Member login', 'Members manage fittings, their wardrobe and their seasonal edit from the Heliae app. Login is not part of this concept page.'],
    join: ['Book your first fitting', 'Membership is $199 a year and starts with a 20-minute fitting. This is a concept page, so no booking or payment is taken here.'],
    people: ['The design team', 'Heliae is a fictional label. The people and biographies on this page are illustrative and the portraits are stock photography.'],
    swatches: ['Free swatches', 'Members can request up to eight cloth swatches each season, posted within three working days.'],
    video: ['A word from our founder', 'A two-minute film on why we started cutting to measure. Video is not included in this concept page.'],
    contact: ['Talk to the atelier', 'Message, call or email the atelier team any time at hello@heliae.example.com. This address is a placeholder.'],
    atelier: ['Heliae Atelier', 'Ateliers in New York, Los Angeles, Chicago and nine more US cities, open Tuesday to Sunday, 10am to 7pm.'],
    gift: ['Gift a membership', 'Give a year of fittings, edits and alterations. Gift cards are delivered by email on the date you choose.'],
    story: ['Our story', 'Heliae began on a single cutting table with one idea: patterns should be drafted from people, not size charts.'],
    careers: ['Join the team', 'We are hiring tailors, pattern cutters and stylists across our ateliers.'],
    journal: ['Journal', 'Essays on cloth, cut and care from the people who make Heliae.'],
    partners: ['Partnerships', 'We work with independent stylists, small mills and companies that dress their teams.'],
    social: ['Follow Heliae', 'Heliae is a concept label, so these social profiles do not exist yet.'],
    guide: ['Fit & Fabric guides', 'Our guides explain how a garment should sit on you and how to choose and care for cloth. They are not part of this concept page.'],
    terms: ['Terms', 'This is a concept landing page for a fictional label. No orders, memberships or payments are processed.'],
    privacy: ['Privacy policy', 'This page does not collect, store or send personal information. The sign-up form is a front-end preview only.'],
    returns: ['Returns', 'Every made-to-measure piece includes free alterations until it fits. Unworn pieces can be returned within 30 days.']
  };
  var dialog = document.getElementById('info');
  var dTitle = document.getElementById('info-title');
  var dBody = document.getElementById('info-body');
  var dialogOpener = null;
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-info]');
    if (!t) return;
    var c = INFO[t.dataset.info];
    if (!c || typeof dialog.showModal !== 'function') return;
    dialogOpener = t;
    dTitle.textContent = c[0];
    dBody.textContent = c[1];
    if (lenis) lenis.stop();
    dialog.showModal();
  });
  dialog.addEventListener('close', function () {
    if (lenis) lenis.start();
    if (dialogOpener) dialogOpener.focus({ preventScroll: true });
  });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });

  /* ---------- Newsletter (front-end preview only) ---------- */
  var form = document.querySelector('.signup');
  if (form) {
    var msg = form.querySelector('.signup__msg');
    var input = form.querySelector('input');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!input.checkValidity() || !input.value.trim()) {
        msg.textContent = 'Please enter a valid email address.';
        msg.classList.add('is-error');
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      input.removeAttribute('aria-invalid');
      msg.classList.remove('is-error');
      msg.textContent = 'Thanks. In a live site the Fit Guide would be on its way. Nothing was sent.';
      form.reset();
    });
  }

  /* ---------- GSAP motion: subtle, transform + opacity only (same system as Healora) ---------- */
  var ctx = null;
  var mm = null;
  if (motion) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.defaults({ ease: 'expo.out', duration: 1.1 });

    ctx = gsap.context(function () {
      var $ = function (sel, scope) { return [].slice.call((scope || document).querySelectorAll(sel)); };
      var list = function (targets) {
        if (targets && typeof targets.length === 'number' && typeof targets !== 'string' && !Array.isArray(targets)) targets = [].slice.call(targets);
        return (Array.isArray(targets) ? targets : [targets])
          .reduce(function (all, t) { return all.concat(typeof t === 'string' ? $(t) : [t]); }, [])
          .filter(Boolean);
      };
      // CSS hover transitions on transform would fight the tween, so pause them while it runs.
      var guard = function (els) {
        return {
          onStart: function () { els.forEach(function (el) { el.classList.add('is-tweening'); }); },
          onComplete: function () { els.forEach(function (el) { el.classList.remove('is-tweening'); gsap.set(el, { clearProps: 'transform,opacity,visibility' }); }); }
        };
      };
      var rise = function (targets, trigger, vars) {
        var els = list(targets);
        if (!els.length) return null;
        var trig = typeof trigger === 'string' ? document.querySelector(trigger) : trigger;
        var v = Object.assign({ y: 32, autoAlpha: 0, stagger: 0.09 }, guard(els), vars || {});
        v.scrollTrigger = { trigger: trig || els[0], start: 'top 82%', once: true };
        return gsap.from(els, v);
      };
      var scaleIn = function (targets, trigger, start) {
        var els = list(targets);
        if (!els.length) return null;
        return gsap.from(els, { scale: 1.12, duration: 1.8, ease: 'power3.out', scrollTrigger: { trigger: trigger, start: start || 'top 85%', once: true } });
      };

      /* hero intro */
      var hero = document.querySelector('.hero');
      gsap.timeline({ defaults: { duration: 1.2 } })
        .from('.hero__media img', { scale: 1.08, duration: 2.2, ease: 'power3.out' }, 0)
        .from('.announce > *', { y: -12, autoAlpha: 0, stagger: 0.06, duration: 0.9 }, 0)
        .from('.nav', Object.assign({ y: -24, autoAlpha: 0 }, guard([document.querySelector('.nav')])), 0.1)
        .from('.hero__eyebrow', { y: 24, autoAlpha: 0 }, 0.18)
        .from('.hero h1', { y: 46, autoAlpha: 0 }, 0.24)
        .from('.hero__sub', { y: 30, autoAlpha: 0 }, 0.36)
        .from('.hero__cta', Object.assign({ y: 26, autoAlpha: 0 }, guard(list('.hero__cta'))), 0.46)
        .from('.hero__stats li', { y: 30, autoAlpha: 0, stagger: 0.08 }, 0.58);
      root.classList.remove('anim-pending');
      // gentle parallax as the hero scrolls away
      gsap.to('.hero__media img', { yPercent: 7, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
      gsap.to('.hero__copy', { y: -40, autoAlpha: 0.4, ease: 'none', scrollTrigger: { trigger: hero, start: '35% top', end: 'bottom top', scrub: true } });

      /* mill towns */
      rise('.mills__faces img', '.mills', { y: 0, scale: 0.6, stagger: 0.08, duration: 0.9, ease: 'back.out(1.8)' });
      rise('.mills__lead h2', '.mills', { y: 18, delay: 0.15 });
      rise('.marquee', '.mills', { y: 20, delay: 0.25 });

      /* how it works */
      rise('.how__head > *', '.how__head', { stagger: 0.1 });
      rise('.step', '.steps', { y: 40, stagger: 0.12 });
      scaleIn('.step__media > img', '.steps');
      rise('.ui-confirm, .ui-picks', '.steps', { y: 30, delay: 0.45, stagger: 0.24 });
      rise('.step .ui-phone', '.steps', { y: 60, delay: 0.4, stagger: 0.24, duration: 1.4 });

      /* feature panels: sticky stack on wide screens, plain blocks when stacked */
      mm = gsap.matchMedia();
      mm.add('(min-width: 1101px) and (min-height: 700px), (min-width: 800px) and (min-aspect-ratio: 1001/1000) and (min-height: 700px)', function () {
        panels.forEach(function (panel, i) {
          // sticky panels report their stuck position, so trigger from where each one sits in the flow
          // (no invalidateOnRefresh here: it would re-record the from() end state while hidden)
          gsap.timeline({ scrollTrigger: { start: function () { return Math.max(0, panelTop(i) - innerHeight * (i === 0 ? 0.75 : 0.5)); }, once: true } })
            .from(panel.querySelector('.stage'), { scale: 1.12, duration: 1.8, ease: 'power3.out' }, 0)
            .from($('.panel__copy > *', panel), { y: 36, autoAlpha: 0, stagger: 0.1 }, 0.15)
            .from($('.panel__index li', panel), { x: 18, autoAlpha: 0, stagger: 0.06 }, 0.25)
            .from($('.scr, .ui-progress, .ui-chat', panel), { y: 40, autoAlpha: 0, duration: 1.3 }, 0.3)
            .from($('.faq', panel), { y: 24, autoAlpha: 0, stagger: 0.08 }, 0.35);
          // the panel underneath eases back as the next one slides over it
          if (i < panels.length - 1) {
            gsap.to(panel, {
              scale: 0.94, ease: 'none',
              scrollTrigger: { start: function () { return panelTop(i + 1) - innerHeight; }, end: function () { return panelTop(i + 1); }, scrub: true }
            });
          }
        });
      });
      mm.add('(max-width: 799px), (max-width: 1100px) and (max-aspect-ratio: 1/1), (max-height: 699px)', function () {
        panels.forEach(function (panel) {
          scaleIn(panel.querySelector('.stage'), panel, 'top 88%');
          rise($('.panel__copy > *, .faq', panel), panel.querySelector('.panel__body'), { stagger: 0.08 });
        });
      });

      /* value table */
      rise(['.value__kicker', '.value h2'], '.value', { stagger: 0.1 });
      rise('.value__table tr', '.value__table', { y: 18, stagger: 0.045, duration: 0.9 });
      rise('.value > .btn', '.value__table', { y: 24, delay: 0.45 });

      /* design leads */
      rise('.people h2', '.people');
      rise('.person', '.rail--people', { y: 40, stagger: 0.12 });

      /* member stories */
      rise(['.stories__rating', '.stories h2'], '.stories', { stagger: 0.1 });
      gsap.from('.stories__rating svg', { scale: 0, autoAlpha: 0, duration: 0.7, ease: 'back.out(2)', delay: 0.2, scrollTrigger: { trigger: '.stories__rating', start: 'top 88%', once: true } });
      rise('.stories .carousel__viewport', '.stories .carousel', { y: 50 });
      rise('.stories .progress', '.stories .carousel', { y: 20, delay: 0.3 });

      /* worn by */
      rise(['.worn h2', '.worn__arrows'], '.worn', { stagger: 0.1 });
      rise('.rail--worn > *', '.rail--worn', { y: 50, stagger: 0.07 });

      /* membership */
      rise('.plan__gallery', '.plan', { x: -36, y: 0 });
      scaleIn('.plan__slide:first-child .stage', '.plan__gallery');
      rise('.plan__body > *', '.plan__body', { stagger: 0.08 });

      /* closing photo + footer */
      gsap.from('.finale__media img', { scale: 1.1, duration: 2, ease: 'power3.out', scrollTrigger: { trigger: '.cta', start: 'top 80%', once: true } });
      gsap.fromTo('.finale__media img', { yPercent: -5 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
      rise('.cta h2', '.cta', { y: 46 });
      rise('.cta .hero__cta', '.cta', { delay: 0.15 });
      rise(['.footer__intro', '.footer__col'], '.footer', { y: 28, stagger: 0.1 });
      rise('.footer__base', '.footer__base', { y: 16 });
    });

    window.addEventListener('load', function () { ScrollTrigger.refresh(); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { ScrollTrigger.refresh(); });
  } else {
    root.classList.remove('anim-pending');
  }

  /* ---------- Lenis, deferred until idle and driven by GSAP's ticker ---------- */
  function startLenis() {
    if (!window.Lenis || reduced) return;
    lenis = new window.Lenis({
      duration: 1.1,
      easing: function (t) { return 1 - Math.pow(1 - t, 4); },
      smoothWheel: true,
      syncTouch: false,
      autoRaf: !motion
    });
    if (motion) {
      // one clock for smooth scroll and ScrollTrigger
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) { if (lenis) lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  }
  if (!reduced) {
    var loadLenis = function () {
      var s = document.createElement('script');
      s.src = 'assets/vendor/lenis.min.js';
      s.async = true;
      s.onload = startLenis;
      document.head.appendChild(s);
    };
    if ('requestIdleCallback' in window) requestIdleCallback(loadLenis, { timeout: 2500 });
    else setTimeout(loadLenis, 1500);
  }

  /* ---------- Phone screens: project a 375×812 iPhone screen onto the photographed phone ----------
     Each .screen carries the four measured corners of the blank screen in image pixels
     (data-quad: TL TR BR BL) and the photo's natural size (data-img). A homography maps the
     flat screen onto that quad, so perspective, lean and size match the photo exactly. */
  var SCREEN_W = 375, SCREEN_H = 812;
  function solve(A, b) {
    var n = b.length;
    for (var i = 0; i < n; i++) {
      var max = i;
      for (var r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[max][i])) max = r;
      var tmp = A[i]; A[i] = A[max]; A[max] = tmp;
      var tb = b[i]; b[i] = b[max]; b[max] = tb;
      for (var k = i + 1; k < n; k++) {
        var f = A[k][i] / A[i][i];
        b[k] -= f * b[i];
        for (var j = i; j < n; j++) A[k][j] -= f * A[i][j];
      }
    }
    var x = new Array(n);
    for (var row = n - 1; row >= 0; row--) {
      var s = b[row];
      for (var col = row + 1; col < n; col++) s -= A[row][col] * x[col];
      x[row] = s / A[row][row];
    }
    return x;
  }
  function homography(dst) {
    var src = [[0, 0], [SCREEN_W, 0], [SCREEN_W, SCREEN_H], [0, SCREEN_H]];
    var A = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], u = dst[i][0], v = dst[i][1];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    var h = solve(A, b);
    return 'matrix3d(' + [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1].map(function (n) { return +n.toFixed(9); }).join(',') + ')';
  }
  var screens = [].slice.call(document.querySelectorAll('.screen[data-quad]'));
  function mapScreen(el) {
    var stage = el.parentElement;
    var size = el.dataset.img.split(' ').map(Number);
    var q = el.dataset.quad.split(' ').map(Number);
    var scale = stage.clientWidth / size[0];
    if (!scale) return;
    // corners in stage pixels, pushed out 1.5 image px so no white fringe of the photo shows
    var cx = (q[0] + q[2] + q[4] + q[6]) / 4, cy = (q[1] + q[3] + q[5] + q[7]) / 4;
    var dst = [0, 2, 4, 6].map(function (i) {
      var dx = q[i] - cx, dy = q[i + 1] - cy, len = Math.hypot(dx, dy) || 1;
      return [(q[i] + dx / len * 1.5) * scale, (q[i + 1] + dy / len * 1.5) * scale];
    });
    el.style.left = '0'; el.style.top = '0';
    el.style.width = SCREEN_W + 'px'; el.style.height = SCREEN_H + 'px';
    el.style.transform = homography(dst);
    el.classList.add('is-mapped');
  }
  if (screens.length) {
    screens.forEach(mapScreen);
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function (entries) {
        entries.forEach(function (en) { screens.forEach(function (s) { if (s.parentElement === en.target) mapScreen(s); }); });
      });
      screens.forEach(function (s) { ro.observe(s.parentElement); });
    } else {
      window.addEventListener('resize', function () { screens.forEach(mapScreen); });
    }
  }

  /* ---------- Steps become a swipe rail on phones: make it keyboard scrollable there ---------- */
  var steps = document.querySelector('.steps');
  var phoneQuery = matchMedia('(max-width: 799px)');
  function stepsFocus() {
    if (phoneQuery.matches) { steps.tabIndex = 0; steps.setAttribute('aria-label', 'How it works, four steps, scrollable'); }
    else { steps.removeAttribute('tabindex'); steps.removeAttribute('aria-label'); }
  }
  if (steps) { stepsFocus(); phoneQuery.addEventListener('change', stepsFocus); }

  // Switching to reduced motion while the page is open: undo every tween and stop smooth scroll.
  reducedQuery.addEventListener('change', function (e) {
    reduced = e.matches;
    if (!reduced) return;
    if (mm) mm.revert();
    if (ctx) ctx.revert();
    root.classList.remove('anim-pending');
    if (lenis && !menuOpen) { lenis.destroy(); lenis = null; }
  });
})();
