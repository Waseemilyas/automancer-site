/* ═══════════════════════════════════════════
   AUTOMANCER — main.js
   Scroll reveals · nav scroll state · mobile menu
   Minimal, dependency-free, reduced-motion aware.
   ═══════════════════════════════════════════ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.addEventListener('DOMContentLoaded', function () {
    /* ── Scroll reveal ── */
    var revealEls = document.querySelectorAll('.reveal, .reveal-stagger');
    if (revealEls.length) {
      if (reduce || !('IntersectionObserver' in window)) {
        revealEls.forEach(function (el) { el.classList.add('is-visible'); });
      } else {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-visible');
              io.unobserve(entry.target);
            }
          });
        }, { threshold: 0.1, rootMargin: '0px 0px -8% 0px' });
        revealEls.forEach(function (el) { io.observe(el); });
      }
    }

    /* ── Nav scroll state ── */
    var nav = document.querySelector('.nav');
    if (nav) {
      var onScroll = function () {
        nav.classList.toggle('nav--scrolled', window.scrollY > 60);
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* ── Mobile menu ── */
    var hamburger = document.querySelector('.hamburger');
    var menu = document.querySelector('.mobile-menu');
    var closeBtn = document.querySelector('.mobile-menu__close');
    if (hamburger && menu) {
      var setOpen = function (open) {
        menu.classList.toggle('is-open', open);
        hamburger.setAttribute('aria-expanded', String(open));
        hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        document.body.style.overflow = open ? 'hidden' : '';
      };
      hamburger.addEventListener('click', function () {
        setOpen(!menu.classList.contains('is-open'));
      });
      if (closeBtn) closeBtn.addEventListener('click', function () { setOpen(false); });
      menu.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { setOpen(false); });
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false);
      });
    }
  });
})();
