// Color sampling + classification for camera-based cube scanning.
//
// sampleFace(video, cropFraction) → array of 9 RGB samples (one per sticker
// of a 3x3 face), read from the central square crop of the video frame.
//
// classifyState(facesByLabel) → 54-char state string. For each face, the
// CENTER sticker (sample index 4) is treated as that face's reference color.
// Every other sticker is assigned to whichever face's center it's closest to
// in CIELAB color space, which gives reasonable lighting invariance.

(function (global) {
  'use strict';

  // ---- Sampling -----------------------------------------------------------

  // Pulls 9 averaged RGB samples from a 3x3 grid centred in the video frame.
  // cropFraction: 0..1, the size of the centred square relative to min(vw,vh).
  // patchFraction: size of the averaging patch inside each grid cell.
  function sampleFace(video, cropFraction = 0.72, patchFraction = 0.35) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return null;

    const sz = Math.min(vw, vh) * cropFraction;
    const sx = (vw - sz) / 2;
    const sy = (vh - sz) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sz);
    canvas.height = Math.round(sz);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, sx, sy, sz, sz, 0, 0, canvas.width, canvas.height);

    const cellSize = canvas.width / 3;
    const patchSize = Math.max(4, Math.round(cellSize * patchFraction));

    const samples = [];
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        const cx = (c + 0.5) * cellSize;
        const cy = (r + 0.5) * cellSize;
        const x = Math.max(0, Math.round(cx - patchSize / 2));
        const y = Math.max(0, Math.round(cy - patchSize / 2));
        const w = Math.min(patchSize, canvas.width - x);
        const h = Math.min(patchSize, canvas.height - y);
        const data = ctx.getImageData(x, y, w, h).data;
        let R = 0, G = 0, B = 0;
        const n = data.length / 4;
        // Use median-ish by trimming outliers: collect, sort each channel,
        // discard top/bottom 20%, average the rest. Helps with reflections.
        const Rs = [], Gs = [], Bs = [];
        for (let i = 0; i < data.length; i += 4) {
          Rs.push(data[i]); Gs.push(data[i + 1]); Bs.push(data[i + 2]);
        }
        Rs.sort((a, b) => a - b); Gs.sort((a, b) => a - b); Bs.sort((a, b) => a - b);
        const lo = Math.floor(n * 0.2), hi = Math.ceil(n * 0.8);
        let count = 0;
        for (let i = lo; i < hi; i++) { R += Rs[i]; G += Gs[i]; B += Bs[i]; count++; }
        samples.push({ r: R / count, g: G / count, b: B / count });
      }
    }
    return samples;
  }

  // ---- Color space conversion: sRGB → CIE Lab -----------------------------
  // Standard formulas. Used so distance respects perceptual hue more than RGB.
  function srgbToLinear(c) {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  function rgbToXyz(r, g, b) {
    const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
    return [
      R * 0.4124 + G * 0.3576 + B * 0.1805,
      R * 0.2126 + G * 0.7152 + B * 0.0722,
      R * 0.0193 + G * 0.1192 + B * 0.9505,
    ];
  }
  function xyzToLab([x, y, z]) {
    // D65 reference white
    const Xn = 0.95047, Yn = 1.0, Zn = 1.08883;
    const fx = labF(x / Xn), fy = labF(y / Yn), fz = labF(z / Zn);
    return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
  }
  function labF(t) {
    return t > 0.008856 ? Math.cbrt(t) : (7.787 * t + 16 / 116);
  }
  function rgbToLab(c) {
    return xyzToLab(rgbToXyz(c.r, c.g, c.b));
  }
  function labDist(a, b) {
    const dL = a[0] - b[0], da = a[1] - b[1], db = a[2] - b[2];
    return dL * dL + da * da + db * db;
  }

  // ---- Classification -----------------------------------------------------

  // facesByLabel: { U:[9 rgb], R:[9], F:[9], D:[9], L:[9], B:[9] }
  // Returns { state, counts, balanced }
  //
  // Strategy:
  //   1. Treat the 6 center stickers as ground-truth anchors (their color
  //      defines what that face's color IS, regardless of lighting).
  //   2. Assign every other sticker to its nearest anchor in CIE-Lab.
  //   3. Refinement: balance counts to exactly 9 per color by swapping the
  //      least-confident over-count sticker into the most-needed under-count
  //      color. This guarantees a valid color distribution.
  function classifyState(facesByLabel) {
    const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];

    const anchors = {};
    for (const f of FACE_ORDER) anchors[f] = rgbToLab(facesByLabel[f][4]);

    const stickers = []; // {face, idx, pos, dists:{f:d}, assigned, isCenter}
    for (const f of FACE_ORDER) {
      for (let i = 0; i < 9; i++) {
        const isCenter = (i === 4);
        const lab = rgbToLab(facesByLabel[f][i]);
        const dists = {};
        let best = null, bestD = Infinity;
        for (const af of FACE_ORDER) {
          const d = labDist(lab, anchors[af]);
          dists[af] = d;
          if (d < bestD) { bestD = d; best = af; }
        }
        stickers.push({
          face: f,
          idx: i,
          pos: FACE_ORDER.indexOf(f) * 9 + i,
          dists,
          assigned: isCenter ? f : best,
          isCenter,
        });
      }
    }

    function counts() {
      const c = { U: 0, R: 0, F: 0, D: 0, L: 0, B: 0 };
      for (const s of stickers) c[s.assigned]++;
      return c;
    }

    // Iterative balancing.
    for (let iter = 0; iter < 60; iter++) {
      const c = counts();
      const over = [], under = [];
      for (const f of FACE_ORDER) {
        if (c[f] > 9) over.push(f);
        if (c[f] < 9) under.push(f);
      }
      if (!over.length) break;

      let bestSwap = null;
      let bestCost = Infinity;
      for (const ov of over) {
        const candidates = stickers.filter((s) => !s.isCenter && s.assigned === ov);
        for (const s of candidates) {
          for (const un of under) {
            const cost = s.dists[un] - s.dists[ov]; // cost to switch
            if (cost < bestCost) {
              bestCost = cost;
              bestSwap = { sticker: s, to: un };
            }
          }
        }
      }
      if (!bestSwap) break;
      bestSwap.sticker.assigned = bestSwap.to;
    }

    const state = new Array(54);
    for (const s of stickers) state[s.pos] = s.assigned;
    const c = counts();
    const balanced = FACE_ORDER.every((f) => c[f] === 9);
    return { state: state.join(''), counts: c, balanced };
  }

  // Expose helpers for the UI preview swatches.
  function rgbToCss(c) {
    return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
  }

  global.ColorScan = { sampleFace, classifyState, rgbToCss, rgbToLab, labDist };
})(window);
