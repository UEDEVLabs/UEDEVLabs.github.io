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

  /* ---- World cards: play on hover or focus ---- */
  [].forEach.call(document.querySelectorAll('video[data-hoverplay]'), function (v) {
    var card = v.closest('.xw__card') || v.parentNode;
    var on = function () { if (calm) return; v.preload = 'auto'; play(v); card.classList.add('is-playing'); };
    var off = function () { v.pause(); card.classList.remove('is-playing'); };
    card.addEventListener('pointerenter', on); card.addEventListener('pointerleave', off);
    card.addEventListener('focusin', on); card.addEventListener('focusout', off);
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

  /* ---- Nav ---- */
  var nav = document.getElementById('nav'), burger = nav && nav.querySelector('.burger');
  if (burger) burger.addEventListener('click', function () {
    var o = nav.classList.toggle('open'); burger.setAttribute('aria-expanded', o ? 'true' : 'false');
  });
  if (nav) addEventListener('scroll', function () { nav.classList.toggle('scrolled', scrollY > 10); }, { passive: true });
})();
