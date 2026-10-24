/* LCM 3D Navigation AI: moving-obstacle prediction, drawn live and kept to one idea.
   Three drones leave the same start at different moments and meet the same sliding gate. Each plans
   in space and time (A* over position and time, against where the gate will be), so each finds a
   different best route: straight through while it is open, wait at the gate, or go under the wall.
   It runs only while on screen; with reduced motion it shows a single frame. */
(function () {
  var box = document.querySelector('[data-gauntlet]');
  if (!box) return;
  var cv = box.querySelector('canvas'), cx = cv.getContext('2d');
  var calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MONO = (getComputedStyle(document.documentElement).getPropertyValue('--mono') || 'monospace').trim();

  var W = 32, H = 18, WH = W * H;          // the hall, in cells (16:9)
  var DT = 0.1, CYCLE = 7, PERIOD = 70;    // one time step; the gate repeats every 7 s
  var CLEAR = 0.45, HOR = 400;
  var START = [2, 8], GOAL = [29, 8];

  /* ---- The gate: open 2 s, closes over .5 s, shut 4 s, opens over .5 s ---- */
  var sm = function (x) { return x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x); };
  var phase = function (T) { return ((T % CYCLE) + CYCLE) % CYCLE; };
  var open = function (T) { var p = phase(T); return p < 2 ? 1 : p < 2.5 ? sm(1 - (p - 2) / 0.5) : p < 6.5 ? 0 : sm((p - 6.5) / 0.5); };
  var WALLS = [[13, 0, 1.2, 6], [13, 11, 1.2, 4.5]];      // the gap under the wall is y 15.5 to 18
  var door = function (T) { return [13.1, 6 - 5 * open(T), 1, 5]; };
  var dRect = function (px, py, r) {
    var dx = Math.max(r[0] - px, 0, px - r[0] - r[2]), dy = Math.max(r[1] - py, 0, py - r[1] - r[3]);
    return Math.sqrt(dx * dx + dy * dy);
  };
  var cache = [];
  function occ(t) {
    var k = ((t % PERIOD) + PERIOD) % PERIOD, g = cache[k];
    if (g) return g;
    g = cache[k] = new Uint8Array(WH);
    var rs = WALLS.concat([door(k * DT)]);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      for (var i = 0; i < rs.length; i++) if (dRect(x + 0.5, y + 0.5, rs[i]) < CLEAR) { g[y * W + x] = 1; break; }
    }
    return g;
  }

  /* ---- Space-time A*: a move takes time (2 steps straight, 3 diagonal, 1 to hover), and every cell
     it touches must be clear at the moment it is there. Hovering costs a little less than moving, and
     a late wait a little less than an early one, so a drone flies up to the gate and waits there. ---- */
  var MOVES = [[0, 0, 1], [1, 0, 2], [-1, 0, 2], [0, 1, 2], [0, -1, 2], [1, 1, 3], [1, -1, 3], [-1, 1, 3], [-1, -1, 3]];
  var CAP = 200000, NX = new Uint8Array(CAP), NY = new Uint8Array(CAP), NT = new Int32Array(CAP), NP = new Int32Array(CAP);
  var FK = new Float32Array(CAP), G = new Float32Array(CAP), seen = new Uint8Array(HOR * WH);
  function plan(t0) {
    seen.fill(0);
    var n = 0, heap = [], gx = GOAL[0], gy = GOAL[1];
    var h = function (x, y) { var dx = Math.abs(gx - x), dy = Math.abs(gy - y); return 3 * Math.min(dx, dy) + 2 * Math.abs(dx - dy); };
    var less = function (a, b) { return FK[a] < FK[b] || (FK[a] === FK[b] && NT[a] > NT[b]); };
    var push = function (x, y, t, p, g) {
      if (n >= CAP) return;
      NX[n] = x; NY[n] = y; NT[n] = t; NP[n] = p; G[n] = g; FK[n] = g + h(x, y);
      var i = heap.push(n++) - 1;
      while (i) { var q = (i - 1) >> 1; if (!less(heap[i], heap[q])) break; var s = heap[i]; heap[i] = heap[q]; heap[q] = s; i = q; }
    };
    var pop = function () {
      var top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        for (var i = 0; ;) {
          var l = 2 * i + 1, r = l + 1, m = i;
          if (l < heap.length && less(heap[l], heap[m])) m = l;
          if (r < heap.length && less(heap[r], heap[m])) m = r;
          if (m === i) break;
          var s = heap[i]; heap[i] = heap[m]; heap[m] = s; i = m;
        }
      }
      return top;
    };
    push(START[0], START[1], t0, -1, 0);
    while (heap.length) {
      var i = pop(), x = NX[i], y = NY[i], t = NT[i], rt = t - t0;
      if (x === gx && y === gy) {
        var path = [];
        for (var k = i; k >= 0; k = NP[k]) path.push([NX[k], NY[k], NT[k]]);
        return path.reverse();
      }
      var key = rt * WH + y * W + x;
      if (seen[key]) continue;
      seen[key] = 1;
      if (occ(t + 1)[y * W + x]) continue;
      for (var j = 0; j < 9; j++) {
        var mv = MOVES[j], nx = x + mv[0], ny = y + mv[1], dur = mv[2];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || rt + dur >= HOR || seen[(rt + dur) * WH + ny * W + nx]) continue;
        var ok = true;
        for (var s = 1; ok && s <= dur; s++) ok = !occ(t + s)[ny * W + nx];
        if (ok && mv[0] && mv[1]) ok = !occ(t + 2)[y * W + nx] && !occ(t + 2)[ny * W + x];
        if (ok) push(nx, ny, t + dur, i, G[i] + (dur === 1 && !mv[0] && !mv[1] ? 1 + 0.04 * (1 - rt / HOR) : dur * 1.06));
      }
    }
    return null;
  }
  // What a plan does at the gate.
  function read(p) {
    var wait = 0, run = 0, under = false;
    for (var i = 1; i < p.length; i++) {
      if (p[i][0] === p[i - 1][0] && p[i][1] === p[i - 1][1]) { run++; wait = Math.max(wait, run); } else run = 0;
      if (p[i][0] === 13 && p[i][1] >= 15) under = true;
    }
    return { kind: under ? 'under' : wait * DT >= 0.4 ? 'wait' : 'straight', wait: wait * DT };
  }

  /* ---- The scene: one departure time for each answer, found by asking the planner ---- */
  var COLORS = { straight: '#2fe06a', wait: '#5ee0ff', under: '#c39bff' };
  var SHORT = { straight: function () { return 'straight through'; }, wait: function (r) { return 'waits ' + r.wait.toFixed(1) + ' s'; }, under: function () { return 'under the wall'; } };
  var SAY = {
    straight: function () { return 'Gate open on arrival · straight through'; },
    wait: function (r) { return 'Gate opens soon · waits ' + r.wait.toFixed(1) + ' s'; },
    under: function () { return 'Gate shut too long · under the wall'; },
  };
  // Every departure moment in one gate cycle, sorted by what its plan does. The gate repeats every
  // 7 s, so a moment one lap later behaves the same; the three departures are chosen to fit the
  // shortest scene, at least 1.5 s apart, with a wait of about a second. The 70 test plans run in
  // short slices once the demo nears the screen, so they never hold up the page.
  var runs = [], SCENE = CYCLE, LEAD = 0, ready = false, busy = false;
  function setup(then) {
    if (ready || busy) return;
    busy = true;
    var found = { straight: [], wait: [], under: [] }, L = 0;
    (function slice() {
      var until = performance.now() + 10;
      for (; L < CYCLE - 0.01 && performance.now() < until; L += 0.1) {
        var p = plan(Math.round(L / DT));
        if (!p) continue;
        var r = read(p);
        if (r.kind === 'wait' && (r.wait < 0.6 || r.wait > 2)) continue;
        [0, CYCLE].forEach(function (lap) {
          found[r.kind].push({ L: L + lap, read: r, path: p.map(function (q) { return [q[0], q[1], q[2] + Math.round(lap / DT)]; }) });
        });
      }
      if (L < CYCLE - 0.01) { setTimeout(slice, 0); return; }
      var bestCost = Infinity;
      found.straight.forEach(function (a) { found.wait.forEach(function (b) { found.under.forEach(function (c) {
        var t = [a.L, b.L, c.L].sort(function (x, y) { return x - y; });
        if (t[1] - t[0] < 1.5 || t[2] - t[1] < 1.5) return;
        var cost = t[2] - t[0] + Math.abs(b.read.wait - 1.2);
        if (cost < bestCost) { bestCost = cost; runs = [a, b, c]; }
      }); }); });
      runs.sort(function (a, b) { return a.L - b.L; });
      runs.forEach(function (r, k) {
        r.name = 'ABC'[k]; r.color = COLORS[r.read.kind]; r.say = SAY[r.read.kind](r.read); r.short = SHORT[r.read.kind](r.read);
        r.end = r.path[r.path.length - 1][2] * DT;
        r.lane = (k - 1) * 0.42;                         // drawn a little apart, so routes through the gate stay readable
        r.trail = []; r.vx = null;
      });
      SCENE = runs.length ? Math.max.apply(null, runs.map(function (r) { return r.end; })) + 2.2 : CYCLE;
      LEAD = runs.length ? runs[0].L - 0.8 : 0;
      T = LEAD; ready = true; busy = false;
      then();
    })();
  }

  function at(path, tau) {
    var i = 0;
    while (i + 1 < path.length && path[i + 1][2] <= tau) i++;
    var a = path[i], b = path[Math.min(i + 1, path.length - 1)];
    var f = b[2] > a[2] ? Math.min(1, (tau - a[2]) / (b[2] - a[2])) : 1;
    return { x: a[0] + 0.5 + (b[0] - a[0]) * f, y: a[1] + 0.5 + (b[1] - a[1]) * f, i: i };
  }
  // Corner-cutting (Chaikin) for drawing a grid route as a flight line.
  function round(pts) {
    if (pts.length < 3) return pts;
    var out = [pts[0]];
    for (var i = 0; i + 1 < pts.length; i++) {
      var a = pts[i], b = pts[i + 1];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    return out;
  }
  // Time moves on; each drone eases toward where its plan has it, which rounds the grid's corners.
  function advance(dt) {
    T += dt;
    if (T > SCENE) { T = LEAD; runs.forEach(function (r) { r.trail = []; r.vx = null; }); }
    var tau = T / DT, k = 1 - Math.exp(-dt * 12);
    runs.forEach(function (r) {
      if (tau < r.path[0][2]) return;
      var now = at(r.path, tau), tx = now.x, ty = now.y + r.lane;
      if (r.vx == null) { r.vx = tx; r.vy = ty; }
      r.vx += (tx - r.vx) * k; r.vy += (ty - r.vy) * k;
      var l = r.trail[r.trail.length - 1];
      if (!l || Math.hypot(l[0] - r.vx, l[1] - r.vy) > 0.08) r.trail.push([r.vx, r.vy]);
    });
  }
  function waitingFor(path, i, tau) {
    var a = path[i], j = i;
    while (j + 1 < path.length && path[j + 1][0] === a[0] && path[j + 1][1] === a[1]) j++;
    return j > i ? (path[j][2] - tau) * DT : 0;
  }

  /* ---- Drawing ---- */
  var px = 1, fontPx = 11, compact = false, T = 0;
  function rrect(x, y, w, h, r) {
    cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r);
    cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath();
  }
  function text(s, x, y, color, align, size) {
    cx.font = '600 ' + (size || fontPx) + 'px ' + MONO; cx.textAlign = align || 'left'; cx.fillStyle = color;
    cx.fillText(s.toUpperCase(), x, y);
  }
  function pill(s, x, y, color) {
    cx.font = '600 ' + fontPx + 'px ' + MONO;
    var tw = cx.measureText(s.toUpperCase()).width + 16 * px, th = fontPx + 10 * px;
    x = Math.max(4 * px, Math.min(cv.width - tw - 4 * px, x - tw / 2));
    cx.fillStyle = 'rgba(5,9,7,.86)'; rrect(x, y - th / 2, tw, th, th / 2); cx.fill();
    cx.strokeStyle = color; cx.lineWidth = px; cx.stroke();
    text(s, x + tw / 2, y + fontPx * 0.36, color, 'center');
  }
  function draw() {
    var w = cv.width, hgt = cv.height, s = w / W, tau = T / DT;
    var fade = Math.min(1, Math.max(0, (SCENE - T) / 0.8));
    cx.setTransform(1, 0, 0, 1, 0, 0);
    var bg = cx.createRadialGradient(w * 0.4, hgt * 0.45, 0, w * 0.4, hgt * 0.45, w * 0.8);
    bg.addColorStop(0, '#0f1d15'); bg.addColorStop(1, '#050806');
    cx.fillStyle = bg; cx.fillRect(0, 0, w, hgt);
    cx.setTransform(s, 0, 0, s, 0, 0);
    var hair = 1 / s;

    cx.lineWidth = hair; cx.beginPath();
    for (var gx = 1; gx < W; gx++) { cx.moveTo(gx, 0); cx.lineTo(gx, H); }
    for (var gy = 1; gy < H; gy++) { cx.moveTo(0, gy); cx.lineTo(W, gy); }
    cx.strokeStyle = 'rgba(255,255,255,.035)'; cx.stroke();

    // start and goal
    [START, GOAL].forEach(function (g) {
      cx.strokeStyle = 'rgba(139,255,176,.55)'; cx.lineWidth = 1.5 * hair;
      cx.beginPath(); cx.arc(g[0] + 0.5, g[1] + 0.5, 0.9, 0, Math.PI * 2); cx.stroke();
    });

    // the wall, and the gate where it will be in a second (dashed): what each drone plans against
    cx.fillStyle = '#17231c'; cx.strokeStyle = 'rgba(139,255,176,.3)'; cx.lineWidth = 1.2 * hair;
    WALLS.forEach(function (r) { rrect(r[0], r[1], r[2], r[3], 0.2); cx.fill(); cx.stroke(); });
    cx.setLineDash([3 * hair, 3 * hair]); cx.strokeStyle = 'rgba(255,179,71,.55)';
    var gd = door(T + 1); rrect(gd[0], gd[1], gd[2], gd[3], 0.2); cx.stroke();
    cx.setLineDash([]);
    var dd = door(T), dg = cx.createLinearGradient(0, dd[1], 0, dd[1] + dd[3]);
    dg.addColorStop(0, '#ffc15e'); dg.addColorStop(1, '#ff6a3d');
    cx.shadowColor = 'rgba(255,128,60,.7)'; cx.shadowBlur = 16 * px; cx.fillStyle = dg;
    rrect(dd[0], dd[1], dd[2], dd[3], 0.2); cx.fill(); cx.shadowBlur = 0;

    // drones: the route already flown, the plan still to fly (rounded), the drone
    runs.forEach(function (r) {
      r.now = null;
      if (tau < r.path[0][2] || !r.trail.length) return;
      var now = at(r.path, tau), p = r.path, done = tau >= p[p.length - 1][2];
      cx.strokeStyle = r.color; cx.lineWidth = 0.22; cx.lineJoin = cx.lineCap = 'round'; cx.globalAlpha = 0.5 * fade;
      cx.beginPath(); cx.moveTo(r.trail[0][0], r.trail[0][1]);
      r.trail.forEach(function (q) { cx.lineTo(q[0], q[1]); });
      cx.stroke();
      if (!done) {
        var ahead = [[r.vx, r.vy]];
        for (var k = now.i + 1; k < p.length; k++) {
          var q = [p[k][0] + 0.5, p[k][1] + 0.5 + r.lane], l = ahead[ahead.length - 1];
          if (q[0] !== l[0] || q[1] !== l[1]) ahead.push(q);
        }
        ahead = round(round(ahead));
        cx.globalAlpha = 0.75 * fade; cx.lineWidth = 1.6 * hair; cx.setLineDash([2.5 * hair, 4 * hair]);
        cx.beginPath(); cx.moveTo(ahead[0][0], ahead[0][1]);
        ahead.forEach(function (q) { cx.lineTo(q[0], q[1]); });
        cx.stroke(); cx.setLineDash([]);
        cx.globalAlpha = fade; cx.shadowColor = r.color; cx.shadowBlur = 18 * px; cx.fillStyle = r.color;
        cx.beginPath(); cx.arc(r.vx, r.vy, 0.55, 0, Math.PI * 2); cx.fill();
        cx.shadowBlur = 0; cx.fillStyle = '#f2fff5';
        cx.beginPath(); cx.arc(r.vx, r.vy, 0.24, 0, Math.PI * 2); cx.fill();
      }
      cx.globalAlpha = 1;
      r.now = now; r.done = done;
    });

    // words, in screen pixels
    cx.setTransform(1, 0, 0, 1, 0, 0);
    cx.globalAlpha = fade;
    text('Start', (START[0] + 0.5) * s, (START[1] + 2.4) * s, 'rgba(159,178,165,.8)', 'center');
    text('Goal', (GOAL[0] + 0.5) * s, (GOAL[1] + 2.4) * s, 'rgba(159,178,165,.8)', 'center');
    var o = open(T), ph = phase(T);
    var gateSays = o >= 1 ? 'Gate open' : ph >= 2 && ph < 2.5 ? 'Gate closing' : 'Opens in ' + Math.max(0, 6.5 - ph).toFixed(1) + ' s';
    text(gateSays, 13.6 * s, 0.9 * s + fontPx, o >= 1 ? '#8bffb0' : '#ffc15e', 'center');
    // the key: who left when, and what its plan chose
    var row = 0, kx = (compact ? 17.4 : 16.2) * s, ky = 1.1 * s + fontPx;
    runs.forEach(function (r) {
      if (!r.now) return;
      var y = ky + row++ * (fontPx * (compact ? 1.6 : 2.5)), when = (r.L - runs[0].L).toFixed(1) + ' s';
      cx.fillStyle = r.color; cx.beginPath(); cx.arc(kx + fontPx * 0.4, y - fontPx * 0.35, fontPx * 0.38, 0, Math.PI * 2); cx.fill();
      if (compact) { text(r.name + ' ' + when + ' · ' + r.short, kx + fontPx * 1.3, y, r.color); return; }
      text(r.name + ' leaves at ' + when, kx + fontPx * 1.3, y, '#e6f2e9');
      text(r.say, kx + fontPx * 1.3, y + fontPx * 1.15, r.color, 'left', Math.round(fontPx * 0.88));
    });
    // a drone holding at the gate shows its countdown
    runs.forEach(function (r) {
      if (!r.now || r.done) return;
      var left = waitingFor(r.path, r.now.i, tau);
      if (left > 0.15) pill('Waits ' + left.toFixed(1) + ' s', r.vx * s, (r.vy - 1.6) * s, r.color);
    });
    cx.globalAlpha = 1;
  }

  /* ---- Size, visibility and the loop ---- */
  function fit() {
    var rc = box.getBoundingClientRect();
    if (!rc.width) return;
    px = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(rc.width * px); cv.height = Math.round(rc.width * H / W * px);
    compact = rc.width < 640;
    fontPx = Math.round(Math.max(8.5, Math.min(13, rc.width / 72)) * px);
    draw();
  }
  var on = false, raf = 0, last = 0;
  function frame(now) {
    raf = 0;
    if (!on) return;
    advance(last ? Math.min(0.05, (now - last) / 1000) : 0);
    last = now; draw();
    raf = requestAnimationFrame(frame);
  }
  var wake = function () { if (ready && on && !calm && !raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };

  var start = function () {
    setup(function () {
      // With reduced motion: one frame, as the last drone reaches the gate.
      if (calm && runs.length) { var stop = Math.min(SCENE - 1, runs[runs.length - 1].L + 2.2); while (T < stop) advance(1 / 60); }
      draw(); wake();
    });
  };
  fit();                                                 // the empty hall until the scene is ready
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(box); else addEventListener('resize', fit);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) { on = e[0].isIntersecting; if (on) start(); wake(); }, { rootMargin: '300px 0px' }).observe(box);
  } else { on = true; start(); }
  document.addEventListener('visibilitychange', wake);
})();
