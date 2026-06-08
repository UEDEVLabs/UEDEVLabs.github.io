// Solver wrapper around the `cubejs` library (Kociemba two-phase).
//
// Runs the solver INSIDE A WEB WORKER so the (synchronous, multi-second)
// initSolver() and solve() calls never freeze the UI. A Blob worker
// importScripts the cubejs CDN files — importScripts is allowed cross-origin
// inside a worker, so this works without hosting the lib locally.
//
// Falls back to a main-thread synchronous solve if Workers are unavailable.
//
// Exposes window.Solver: ensureInit, solve, randomScramble.

(function (global) {
  'use strict';

  const CUBEJS_URLS = [
    'https://cdn.jsdelivr.net/gh/ldez/cubejs@master/lib/cube.js',
    'https://cdn.jsdelivr.net/gh/ldez/cubejs@master/lib/solve.js',
  ];
  const SOLVE_TIMEOUT_MS = 12000; // if no answer by now, treat as unsolvable/stuck

  // ---- Worker plumbing -----------------------------------------------------

  let worker = null;
  let workerReady = null;       // Promise resolving when initSolver() done in worker
  let reqId = 0;
  const pending = new Map();     // id -> { resolve, reject, timer }
  let workerBroken = false;

  function buildWorker() {
    const src = `
      var URLS = ${JSON.stringify(CUBEJS_URLS)};
      try { importScripts.apply(null, URLS); }
      catch (e) { self.postMessage({ type: 'fatal', error: 'load failed: ' + e.message }); }
      try {
        Cube.initSolver();
        self.postMessage({ type: 'ready' });
      } catch (e) {
        self.postMessage({ type: 'fatal', error: 'init failed: ' + e.message });
      }
      self.onmessage = function (ev) {
        var id = ev.data.id;
        var facelets = ev.data.facelets;
        try {
          var c = Cube.fromString(facelets);
          // Reject unsolvable states fast if the lib supports it.
          if (typeof c.isSolvable === 'function' && !c.isSolvable()) {
            self.postMessage({ type: 'result', id: id, ok: false, error: 'unsolvable' });
            return;
          }
          var sol = c.solve();
          if (typeof sol !== 'string' || !sol.trim()) {
            self.postMessage({ type: 'result', id: id, ok: false, error: 'no-solution' });
          } else {
            self.postMessage({ type: 'result', id: id, ok: true, solution: sol });
          }
        } catch (e) {
          self.postMessage({ type: 'result', id: id, ok: false, error: e.message || 'solve-error' });
        }
      };
    `;
    const blob = new Blob([src], { type: 'application/javascript' });
    const url = URL.createObjectURL(blob);
    const w = new Worker(url);
    return w;
  }

  function loadCubejsMainThread() {
    if (global.Cube && global.Cube.initSolver) return Promise.resolve();
    if (loadCubejsMainThread._p) return loadCubejsMainThread._p;
    loadCubejsMainThread._p = new Promise((resolve, reject) => {
      let remaining = CUBEJS_URLS.length;
      let failed = false;
      CUBEJS_URLS.forEach((url) => {
        const s = document.createElement('script');
        s.src = url;
        s.async = false; // preserve execution order (cube.js before solve.js)
        s.onload = () => { if (!failed && --remaining === 0) resolve(); };
        s.onerror = () => { failed = true; reject(new Error('load failed: ' + url)); };
        document.head.appendChild(s);
      });
    });
    return loadCubejsMainThread._p;
  }

  function mainThreadInit() {
    return loadCubejsMainThread().then(() => new Promise((resolve, reject) => {
      try {
        if (!global.Cube || !global.Cube.initSolver) throw new Error('cubejs not loaded');
        // Yield once so the loading spinner can paint before the heavy sync call.
        setTimeout(() => {
          try { global.Cube.initSolver(); resolve(); }
          catch (e) { reject(e); }
        }, 30);
      } catch (e) { reject(e); }
    }));
  }

  function ensureInit() {
    if (workerReady) return workerReady;
    workerReady = new Promise((resolve, reject) => {
      // No worker support, or a previous worker attempt failed → main thread.
      if (workerBroken || typeof Worker === 'undefined' || typeof Blob === 'undefined') {
        mainThreadInit().then(resolve, reject);
        return;
      }
      let settled = false;
      try {
        worker = buildWorker();
      } catch (e) {
        workerBroken = true;
        mainThreadInit().then(resolve, reject);
        return;
      }
      // If the worker doesn't report ready in time, assume it's blocked and
      // fall back to the main thread.
      const readyTimer = setTimeout(() => {
        if (settled) return;
        settled = true;
        workerBroken = true;
        try { worker.terminate(); } catch (_) {}
        worker = null;
        mainThreadInit().then(resolve, reject);
      }, 9000);

      worker.onmessage = (ev) => {
        const m = ev.data;
        if (m.type === 'ready') {
          if (settled) return;
          settled = true;
          clearTimeout(readyTimer);
          resolve();
          return;
        }
        if (m.type === 'fatal') {
          if (settled) return;
          settled = true;
          clearTimeout(readyTimer);
          workerBroken = true;
          try { worker.terminate(); } catch (_) {}
          worker = null;
          mainThreadInit().then(resolve, reject);
          return;
        }
        if (m.type === 'result') {
          const entry = pending.get(m.id);
          if (!entry) return;
          clearTimeout(entry.timer);
          pending.delete(m.id);
          if (m.ok) entry.resolve(m.solution);
          else entry.reject(new Error(m.error || 'solve failed'));
        }
      };
      worker.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(readyTimer);
        workerBroken = true;
        try { worker.terminate(); } catch (_) {}
        worker = null;
        mainThreadInit().then(resolve, reject);
      };
    }).catch((e) => {
      workerReady = null; // allow a later retry
      throw e;
    });
    return workerReady;
  }

  // ---- Public solve --------------------------------------------------------

  function translateError(msg) {
    if (/unsolvable/i.test(msg)) {
      return 'This color combination can\'t exist on a real cube. Check for swapped or duplicated stickers.';
    }
    if (/no-solution|timeout|stuck/i.test(msg)) {
      return 'Couldn\'t find a solution — the cube state is likely impossible. Double-check your colors.';
    }
    if (/load failed|not loaded/i.test(msg)) {
      return 'Solver failed to load. Check your internet connection and reload.';
    }
    return msg;
  }

  async function solve(stateStr) {
    await ensureInit();

    // Main-thread fallback path.
    if (workerBroken || !worker) {
      try {
        const c = global.Cube.fromString(stateStr);
        if (typeof c.isSolvable === 'function' && !c.isSolvable()) {
          throw new Error('unsolvable');
        }
        const sol = c.solve();
        if (typeof sol !== 'string' || !sol.trim()) throw new Error('no-solution');
        return sol.trim().split(/\s+/).filter(Boolean);
      } catch (e) {
        throw new Error(translateError(e.message || 'solve-error'));
      }
    }

    // Worker path with timeout.
    const id = ++reqId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(translateError('timeout')));
      }, SOLVE_TIMEOUT_MS);
      pending.set(id, {
        resolve: (sol) => resolve(sol.trim().split(/\s+/).filter(Boolean)),
        reject: (err) => reject(new Error(translateError(err.message || 'solve-error'))),
        timer,
      });
      worker.postMessage({ id, facelets: stateStr });
    });
  }

  // ---- Scramble ------------------------------------------------------------

  function randomScramble(len = 22) {
    const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
    const suffixes = ['', "'", '2'];
    const out = [];
    let last = null, beforeLast = null;
    while (out.length < len) {
      const f = faces[Math.floor(Math.random() * 6)];
      if (f === last) continue;
      if ((f === 'U' && last === 'D') || (f === 'D' && last === 'U') ||
          (f === 'L' && last === 'R') || (f === 'R' && last === 'L') ||
          (f === 'F' && last === 'B') || (f === 'B' && last === 'F')) {
        if (beforeLast === f) continue;
      }
      out.push(f + suffixes[Math.floor(Math.random() * 3)]);
      beforeLast = last;
      last = f;
    }
    return out;
  }

  global.Solver = { ensureInit, solve, randomScramble };
})(window);
