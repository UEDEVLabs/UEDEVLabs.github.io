// Beginner Layer-By-Layer solver. Produces a HUMAN-method solution where every
// move belongs to a teachable phase. Validated to 100% solve-rate over
// thousands of random scrambles (see dev harness).
//
// We build the FIRST layer on D (bottom) and finish on U (top) with standard
// last-layer algorithms. "Turning the cube" is bookkeeping via a y-frame
// relabel (k = 0..3) so recorded moves stay in the fixed physical frame and
// centers never move (final state == SOLVED exactly).
//
// Method:
//   • Cross (bottom):     BFS per edge (shortest, preserving placed edges)
//   • First layer corners: BFS over insertion-trigger macros, per corner
//   • Middle edges:        BFS over insertion macros, per edge
//   • Last layer:          BFS over curated algorithm macros per sub-stage
//                          (orient edges → orient corners → permute corners →
//                           permute edges), guaranteeing every case is handled.

(function (global) {
  'use strict';
  const E = global.CubeEngine;
  const SOLVED = E.SOLVED;
  const ap = (s, q) => E.applyMoves(s, q);
  const inv = (q) => E.inverseMoves(q).join(' ');

  const FACES = ['U', 'D', 'R', 'L', 'F', 'B'];
  const AUFS = ['', 'U', 'U2', "U'"];

  // y-frame relabel (U/D fixed)
  const YCYC = { U: 'U', D: 'D', F: 'R', R: 'B', B: 'L', L: 'F' };
  function relabel(seq, k) {
    if (!k) return seq;
    return seq.trim().split(/\s+/).map((t) => {
      let f = t[0]; for (let i = 0; i < k; i++) f = YCYC[f]; return f + t.slice(1);
    }).join(' ');
  }
  function conj(a, alg) { return (a ? a + ' ' : '') + alg + (a ? ' ' + inv(a) : ''); }

  // Target facelet groups (must equal SOLVED)
  const CROSS = [[28, 25], [32, 16], [34, 52], [30, 43]];
  const F1 = [[29, 26, 15], [27, 24, 44], [35, 51, 17], [33, 53, 42]];
  const MID = [[23, 12], [21, 41], [48, 14], [50, 39]];
  const gS = (s, g) => { for (const i of g) if (s[i] !== SOLVED[i]) return false; return true; };

  // LL recognition
  const U_C = [0, 2, 6, 8], U_E = [1, 3, 5, 7];
  const CS = [[[20, 22], [9, 13]], [[18, 22], [38, 40]], [[11, 13], [47, 49]], [[36, 40], [45, 49]]];

  // ---- BFS (single moves) for the cross ------------------------------------
  const ALL = (() => { const m = []; for (const f of FACES) for (const x of ['', "'", '2']) m.push(f + x); return m; })();
  function bfs(start, goal, maxD) {
    if (goal(start)) return [];
    const v = new Set([start]); let fr = [[start, []]];
    for (let d = 0; d < maxD; d++) {
      const nx = [];
      for (const [s, p] of fr) {
        const last = p.length ? p[p.length - 1][0] : '';
        for (const mv of ALL) {
          if (mv[0] === last) continue;
          const ns = E.applyMove(s, mv);
          if (v.has(ns)) continue;
          v.add(ns); const np = p.concat(mv);
          if (goal(ns)) return np; nx.push([ns, np]);
        }
      }
      fr = nx; if (!fr.length) break;
    }
    return null;
  }
  // ---- BFS over macro sequences --------------------------------------------
  function bfsMac(start, goal, macs, maxD) {
    if (goal(start)) return [];
    const v = new Set([start]); let fr = [[start, []]];
    for (let d = 0; d < maxD; d++) {
      const nx = [];
      for (const [s, p] of fr) {
        for (const m of macs) {
          const ns = ap(s, m);
          if (v.has(ns)) continue;
          v.add(ns); const np = p.concat(m);
          if (goal(ns)) return np; nx.push([ns, np]);
        }
      }
      fr = nx; if (!fr.length) break;
    }
    return null;
  }

  // ---- Macro sets ----------------------------------------------------------
  const cornerTrig = ["R U R' U'", "R U' R'", "F' U' F", "U R U' R'", "R U2 R' U'", "R U R'"];
  const cornerMac = [];
  for (const a of ['U', 'U2', "U'"]) cornerMac.push(a);
  for (let k = 0; k < 4; k++) for (const t of cornerTrig) cornerMac.push(relabel(t, k));

  const midTrig = ["U R U' R' U' F' U F", "U' L' U L U F U' F'"];
  const midMac = [];
  for (const a of ['U', 'U2', "U'"]) midMac.push(a);
  for (let k = 0; k < 4; k++) for (const t of midTrig) midMac.push(relabel(t, k));

  const SUNE = "R U R' U R U2 R'", ASUNE = "R U2 R' U' R U' R'";
  const CCYC = "U R U' L' U R' U' L", CCYCi = inv(CCYC);
  const ECYC = "R U' R U R U R U' R' U' R2", ECYCi = inv(ECYC);
  const FRU = "F R U R' U' F'";
  const ollEdgeMac = AUFS.map((a) => (a ? a + ' ' : '') + FRU);
  const ollCornMac = []; for (const a of AUFS) for (const x of [SUNE, ASUNE]) ollCornMac.push((a ? a + ' ' : '') + x);
  const pllCornMac = []; for (const a of AUFS) for (const x of [CCYC, CCYCi]) pllCornMac.push((a ? a + ' ' : '') + x);
  const pllEdgeMac = []; for (const a of AUFS) for (const x of [ECYC, ECYCi]) pllEdgeMac.push(conj(a, x));

  // ---- Phase metadata (teaching) -------------------------------------------
  const PHASES = [
    { id: 'cross', title: 'Bottom cross', why: 'Build a cross on the bottom face, matching each edge to its side center. This is the foundation every other piece is placed against.' },
    { id: 'f1', title: 'Bottom corners', why: 'Drop the four bottom corners into place to finish the entire first layer — a solid, solved base you never have to touch again.' },
    { id: 'mid', title: 'Middle layer', why: 'Slot the four middle edges between the centers. Now the bottom two layers are complete and only the top remains.' },
    { id: 'oll-edges', title: 'Top cross', why: 'Flip the top edges so they form a cross on top. We orient pieces (which way they face) before worrying about position.' },
    { id: 'oll-corners', title: 'Orient top corners', why: 'Twist every top corner so the top face is one solid color. The top is now fully oriented — just out of order.' },
    { id: 'pll-corners', title: 'Place top corners', why: 'Cycle the top corners into their correct positions. Corners first, because moving them won’t disturb the edges we fix next.' },
    { id: 'pll-edges', title: 'Place top edges', why: 'The final step: cycle the last edges home. Nothing else can break now, so the cube clicks into a full solve.' },
  ];

  // ---- Optimizer (cancel adjacent same-face turns), keeps phase tags -------
  const AMT = { '': 1, '2': 2, "'": 3 };
  function optimize(moves, phaseOf) {
    let arr = moves.map((t, i) => [t, phaseOf[i]]);
    let changed = true;
    while (changed) {
      changed = false;
      const out = [];
      for (const [t, ph] of arr) {
        if (out.length && out[out.length - 1][0][0] === t[0]) {
          const [pt, pph] = out[out.length - 1];
          const tot = (AMT[pt.slice(1)] + AMT[t.slice(1)]) % 4;
          out.pop();
          if (tot === 1) out.push([pt[0], pph]);
          else if (tot === 2) out.push([pt[0] + '2', pph]);
          else if (tot === 3) out.push([pt[0] + "'", pph]);
          // tot===0 → fully cancels, push nothing
          changed = true;
        } else {
          out.push([t, ph]);
        }
      }
      arr = out;
    }
    return { moves: arr.map((x) => x[0]), phaseOf: arr.map((x) => x[1]) };
  }

  // ---- Main solve ----------------------------------------------------------
  function solve(input) {
    let s = input;
    const mv = [], ph = [];
    let cp = 0;
    const rec = (seq) => {
      const t = seq.trim().split(/\s+/).filter(Boolean);
      for (const x of t) { s = E.applyMove(s, x); mv.push(x); ph.push(cp); }
    };

    // Cross (per edge)
    cp = 0; const lk = [];
    for (let e = 0; e < 4; e++) {
      lk.push(CROSS[e]); const g = (x) => lk.every((q) => gS(x, q));
      const p = bfs(s, g, 7); if (!p) return { ok: false, stage: 'cross' }; rec(p.join(' '));
    }
    // First-layer corners
    cp = 1; const lkc = [...CROSS];
    for (let c = 0; c < 4; c++) {
      lkc.push(F1[c]); const g = (x) => lkc.every((q) => gS(x, q));
      const p = bfsMac(s, g, cornerMac, 6); if (!p) return { ok: false, stage: 'f1' }; rec(p.join(' '));
    }
    // Middle edges
    cp = 2; const lkm = [...CROSS, ...F1];
    for (let m = 0; m < 4; m++) {
      lkm.push(MID[m]); const g = (x) => lkm.every((q) => gS(x, q));
      const p = bfsMac(s, g, midMac, 6); if (!p) return { ok: false, stage: 'mid' }; rec(p.join(' '));
    }
    // LL: orient edges
    cp = 3; let p = bfsMac(s, (x) => U_E.every((i) => x[i] === 'U'), ollEdgeMac, 6);
    if (!p) return { ok: false, stage: 'oll-edges' }; rec(p.join(' '));
    // LL: orient corners
    cp = 4; p = bfsMac(s, (x) => U_C.every((i) => x[i] === 'U'), ollCornMac, 8);
    if (!p) return { ok: false, stage: 'oll-corners' }; rec(p.join(' '));
    // LL: permute corners
    cp = 5; p = bfsMac(s, (x) => AUFS.some((a) => { const t = a ? ap(x, a) : x; return CS.every((c) => c.every(([i, ctr]) => t[i] === t[ctr])); }), pllCornMac, 9);
    if (!p) return { ok: false, stage: 'pll-corners' }; rec(p.join(' '));
    for (const a of AUFS) { const t = a ? ap(s, a) : s; if (CS.every((c) => c.every(([i, ctr]) => t[i] === t[ctr]))) { if (a) rec(a); break; } }
    // LL: permute edges
    cp = 6; p = bfsMac(s, (x) => x === SOLVED, pllEdgeMac, 6);
    if (!p) return { ok: false, stage: 'pll-edges' }; rec(p.join(' '));
    for (const a of AUFS) { const t = a ? ap(s, a) : s; if (t === SOLVED) { if (a) rec(a); break; } }

    if (s !== SOLVED) return { ok: false, stage: 'final' };

    const opt = optimize(mv, ph);
    // Verify optimizer didn't change correctness.
    if (ap(input, opt.moves.join(' ')) !== SOLVED) {
      return { ok: true, moves: mv, phaseOf: ph, phases: PHASES };
    }
    return { ok: true, moves: opt.moves, phaseOf: opt.phaseOf, phases: PHASES };
  }

  global.LBLSolver = { solve, PHASES };
})(window);
