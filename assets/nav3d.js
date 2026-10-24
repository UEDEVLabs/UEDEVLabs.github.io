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

  /* ---- Hero reel: the highlight clips play in turn. Each cut fades the next clip in over the last
     with a slow push-in and a light sweep; the clip buttons show progress and jump to a clip. A clip
     is fetched only as its turn comes, and nothing plays before the page has loaded, while the hero
     is off screen or the tab is hidden, or (with reduced motion or Save-Data) until Play is pressed. ---- */
  [].forEach.call(document.querySelectorAll('[data-reel]'), function (reel) {
    var clips = [].slice.call(reel.querySelectorAll('video'));
    var hero = reel.closest('.xh') || reel.parentNode;
    var media = reel.closest('.xh__media');
    var btn = document.querySelector('.xplay[data-target="' + reel.id + '"]');
    if (!clips.length) return;
    var two = function (n) { return (n < 10 ? '0' : '') + n; };

    var ui = document.createElement('div');
    ui.className = 'xreel__ui';
    ui.innerHTML = '<p class="xreel__cap"><span class="xreel__n"></span><b></b><span class="xreel__place"></span></p>' +
      '<div class="xreel__segs" role="group" aria-label="Highlight clips">' + clips.map(function (v, i) {
        return '<button type="button" class="xreel__seg" aria-label="Show clip ' + (i + 1) + ' of ' + clips.length + ': ' +
          v.dataset.title + '"><i></i></button>';
      }).join('') + '</div>';
    hero.appendChild(ui);
    var segs = [].slice.call(ui.querySelectorAll('.xreel__seg'));
    var cap = ui.querySelector('.xreel__cap');

    var cur = -1, want = -1, stopped = calm, away = false, started = false, raf = 0, wait = 0;
    var fetchClip = function (v) { if (v && !v.dataset.fetched) { v.dataset.fetched = '1'; v.preload = 'auto'; v.load(); } };
    var label = function (i) {
      var v = clips[i];
      cap.classList.remove('in'); void cap.offsetWidth;
      cap.children[0].textContent = two(i + 1) + ' / ' + two(clips.length);
      cap.children[1].textContent = v.dataset.title;
      cap.children[2].textContent = v.dataset.place;
      cap.classList.add('in');
      segs.forEach(function (s, k) {
        s.classList.toggle('done', k < i); s.classList.toggle('now', k === i);
        s.firstChild.style.transform = k === i ? 'scaleX(0)' : '';
        if (k === i) s.setAttribute('aria-current', 'true'); else s.removeAttribute('aria-current');
      });
    };
    var sync = function () {
      if (!btn) return;
      btn.setAttribute('aria-pressed', stopped ? 'true' : 'false');
      btn.setAttribute('aria-label', stopped ? 'Play the highlight reel' : 'Pause the highlight reel');
    };
    // Cut to clip i once it is really playing, so a fade never shows a black frame.
    var go = function (i) {
      var next = clips[i], prev = clips[cur];
      if (i === cur || stopped) return;
      want = i; clearTimeout(wait);
      fetchClip(next);
      next.currentTime = 0;
      var cut = function () {
        next.removeEventListener('playing', cut);
        if (want !== i) { if (clips[cur] !== next) next.pause(); return; }
        reel.classList.remove('is-cut'); void reel.offsetWidth; reel.classList.add('is-cut');
        next.classList.remove('is-drift'); next.classList.add('is-on');
        setTimeout(function () { if (cur === i) next.classList.add('is-drift'); }, 1400);
        if (prev && prev !== next) {
          prev.classList.remove('is-on', 'is-drift');
          setTimeout(function () { if (clips[cur] !== prev) prev.pause(); }, 1200);
        }
        if (media) media.classList.add('is-playing');
        cur = i; label(i);
        fetchClip(clips[(i + 1) % clips.length]);
      };
      next.addEventListener('playing', cut);
      play(next);
      // A clip that will not start keeps the current one looping; the next turn tries again.
      wait = setTimeout(function () { next.removeEventListener('playing', cut); if (want === i) want = cur; }, 6000);
    };
    // Advance a little before the clip ends; the current clip loops while the next one buffers.
    var tick = function () {
      raf = 0;
      if (stopped || away) return;
      var v = clips[cur];
      if (v && v.duration) {
        var p = Math.min(1, v.currentTime / v.duration);
        if (segs[cur]) segs[cur].firstChild.style.transform = 'scaleX(' + p + ')';
        if (v.duration - v.currentTime < 1.0 && want === cur) go((cur + 1) % clips.length);
      }
      raf = requestAnimationFrame(tick);
    };
    var run = function () {
      if (stopped || away) return;
      if (cur < 0) go(0); else play(clips[cur]);
      if (!raf) raf = requestAnimationFrame(tick);
    };
    var hold = function () { if (clips[cur]) clips[cur].pause(); if (raf) { cancelAnimationFrame(raf); raf = 0; } };
    clips.forEach(function (v) { v.loop = true; });
    segs.forEach(function (s, i) {
      s.addEventListener('click', function () {
        stopped = false; sync();
        segs.forEach(function (x) { x.firstChild.style.transform = ''; });
        go(i); run();
      });
    });
    if (btn) btn.addEventListener('click', function () {
      stopped = !stopped; sync();
      if (stopped) hold(); else run();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (e) { away = !e[0].isIntersecting; if (away) hold(); else if (started) run(); }, { threshold: 0.15 }).observe(hero);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) hold(); else if (started && !away) run(); });
    label(0); sync();
    var begin = function () { started = true; run(); };
    if (document.readyState === 'complete') begin(); else addEventListener('load', begin);
  });

  /* ---- Hero pause / play ---- */
  [].forEach.call(document.querySelectorAll('.xplay[data-target]'), function (btn) {
    var v = document.getElementById(btn.dataset.target);
    if (!v || v.tagName !== 'VIDEO') return;
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
