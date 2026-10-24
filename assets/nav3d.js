/* UEDEV — LCM 3D Navigation AI product layer
   Loops play only while on screen, world cards play on hover, the hero loop has a pause
   button, YouTube loads on click, and .xr blocks fade in. With reduced motion or Save-Data
   nothing autoplays. Without this file every page still reads and plays in full. */
(function () {
  var doc = document.documentElement;
  doc.classList.add('js');
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !!(navigator.connection && navigator.connection.saveData);

  function play(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }

  /* ---- Posters, fetched only as their loop comes near the screen ---- */
  var lazy = [].slice.call(document.querySelectorAll('video[data-poster]'));
  var setPoster = function (v) { v.poster = v.dataset.poster; v.removeAttribute('data-poster'); };
  if ('IntersectionObserver' in window) {
    var near = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { setPoster(e.target); near.unobserve(e.target); } });
    }, { rootMargin: '800px 0px' });
    lazy.forEach(function (v) { near.observe(v); });
  } else lazy.forEach(setPoster);

  /* ---- Loops that play while in view, starting only after the page has loaded, so no video
     download competes with the first paint (the hero shows its poster until then) ---- */
  var auto = [].slice.call(document.querySelectorAll('video[data-autoplay]'));
  if (calm) {
    auto.forEach(function (v) { v.removeAttribute('autoplay'); v.pause(); });
  } else if ('IntersectionObserver' in window) {
    var seen = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (v.dataset.userPaused) return;
        if (e.isIntersecting) { if (v.preload === 'none') v.preload = 'auto'; play(v); } else v.pause();
      });
    }, { threshold: 0.25 });
    var start = function () { auto.forEach(function (v) { seen.observe(v); }); };
    if (document.readyState === 'complete') start(); else addEventListener('load', start);
  }

  /* ---- A hero loop fades in over its first-frame still once it is really playing ---- */
  [].forEach.call(document.querySelectorAll('video[data-hero]'), function (v) {
    v.addEventListener('playing', function () { v.parentNode.classList.add('is-playing'); });
  });

  /* ---- Hero pause / play ---- */
  [].forEach.call(document.querySelectorAll('.xplay[data-target]'), function (btn) {
    var v = document.getElementById(btn.dataset.target);
    if (!v) return;
    var sync = function () {
      var paused = v.paused;
      btn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      btn.setAttribute('aria-label', paused ? 'Play background video' : 'Pause background video');
    };
    btn.addEventListener('click', function () {
      if (v.paused) { delete v.dataset.userPaused; play(v); } else { v.dataset.userPaused = '1'; v.pause(); }
    });
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
    sync();
  });

  /* ---- World cards: a mouse plays the clip on hover; the card's button plays it on touch or
     keyboard (and under reduced motion, since pressing it is an explicit request) ---- */
  [].forEach.call(document.querySelectorAll('video[data-hoverplay]'), function (v) {
    var card = v.closest('.xw__card') || v.parentNode;
    var btn = card.querySelector('.xw__play');
    var what = btn ? btn.getAttribute('aria-label').replace(/^(Play|Pause) clip: /, '') : '';
    var mark = function (on) {
      card.classList.toggle('is-playing', on);
      if (btn) { btn.setAttribute('aria-pressed', on ? 'true' : 'false'); btn.setAttribute('aria-label', (on ? 'Pause' : 'Play') + ' clip: ' + what); }
    };
    var start = function () { v.preload = 'auto'; play(v); mark(true); };
    var stop = function () { v.pause(); mark(false); };
    card.addEventListener('pointerenter', function (e) { if (e.pointerType === 'mouse' && !calm) start(); });
    card.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') stop(); });
    if (btn) btn.addEventListener('click', function (e) { e.preventDefault(); if (v.paused) start(); else stop(); });
  });

  /* ---- YouTube: a poster until clicked ---- */
  [].forEach.call(document.querySelectorAll('.xyt[data-yt]'), function (btn) {
    btn.addEventListener('click', function (ev) {
      ev.preventDefault();
      var f = document.createElement('iframe');
      f.src = 'https://www.youtube-nocookie.com/embed/' + btn.dataset.yt + '?autoplay=1&rel=0&modestbranding=1';
      f.title = btn.dataset.title || 'Video';
      f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      f.allowFullscreen = true;
      f.referrerPolicy = 'strict-origin-when-cross-origin';
      btn.appendChild(f);
      btn.removeAttribute('href');
    }, { once: true });
  });

  /* ---- Reveal ---- */
  var rev = [].slice.call(document.querySelectorAll('.xr'));
  var show = function (el) { el.classList.add('in'); };
  if (calm || !('IntersectionObserver' in window)) rev.forEach(show);
  else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    rev.forEach(function (el) { io.observe(el); });
    setTimeout(function () { rev.forEach(show); }, 3000);
  }

  /* ---- Nav: the mobile menu, and the Use cases menu (hover opens it with a mouse; the button
     opens it for touch and keyboard; Escape or a click elsewhere closes it) ---- */
  var nav = document.getElementById('nav'), burger = nav && nav.querySelector('.burger');
  var setMenu = function (open) {
    nav.classList.toggle('open', open); burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Menu');
  };
  if (burger) {
    burger.addEventListener('click', function () { setMenu(!nav.classList.contains('open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('.nav__links a')) setMenu(false); });
  }
  [].forEach.call(document.querySelectorAll('.nav__dd'), function (dd) {
    var b = dd.querySelector('.nav__ddbtn');
    var set = function (open) { dd.classList.toggle('open', open); b.setAttribute('aria-expanded', open ? 'true' : 'false'); };
    b.addEventListener('click', function () { set(!dd.classList.contains('open')); });
    dd.addEventListener('keydown', function (e) { if (e.key === 'Escape') { set(false); b.focus(); } });
    document.addEventListener('click', function (e) { if (!dd.contains(e.target)) set(false); });
    dd.addEventListener('focusout', function (e) { if (!dd.contains(e.relatedTarget)) set(false); });
  });
  if (nav) addEventListener('scroll', function () { nav.classList.toggle('scrolled', scrollY > 10); }, { passive: true });

  /* ---- On this page: the bar sits under the top bar, and marks the section being read ---- */
  var toc = document.querySelector('.xtoc');
  if (toc && nav) {
    var setH = function () { doc.style.setProperty('--navh', nav.offsetHeight + 'px'); };
    setH(); addEventListener('resize', setH, { passive: true });
    var links = [].slice.call(toc.querySelectorAll('a[href^="#"]'));
    if ('IntersectionObserver' in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) {
            var on = a.getAttribute('href') === '#' + e.target.id;
            a.classList.toggle('is-here', on);
            if (on) { a.setAttribute('aria-current', 'location'); if (a.scrollIntoView && toc.scrollWidth > toc.clientWidth) toc.querySelector('.xtoc__in').scrollLeft = a.offsetLeft - 80; }
            else a.removeAttribute('aria-current');
          });
        });
      }, { rootMargin: '-35% 0px -60% 0px' });
      links.forEach(function (a) { var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) spy.observe(t); });
    }
  }
})();
