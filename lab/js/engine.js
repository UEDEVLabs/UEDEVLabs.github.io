// Rubik's Cube engine: facelet indexing + move application.
// State is a 54-char string in standard Kociemba order:
//   U(0-8) R(9-17) F(18-26) D(27-35) L(36-44) B(45-53)
// Each face is 9 stickers in reading order (Kociemba's unfolded layout).
//
// Move cycles are derived PROGRAMMATICALLY from 3D rotation math, not
// hand-coded — way safer.

(function (global) {
  'use strict';

  // ----- Constants ----------------------------------------------------------

  const SOLVED = 'UUUUUUUUU' + 'RRRRRRRRR' + 'FFFFFFFFF' +
                 'DDDDDDDDD' + 'LLLLLLLLL' + 'BBBBBBBBB';

  const COLORS = {
    U: '#FFFFFF', // white
    D: '#FFD500', // yellow
    F: '#009B48', // green
    B: '#0046AD', // blue
    R: '#B71234', // red
    L: '#FF5800', // orange
  };

  const FACE_ORDER = ['U', 'R', 'F', 'D', 'L', 'B'];
  const FACE_NAMES = {
    U: 'Up', R: 'Right', F: 'Front', D: 'Down', L: 'Left', B: 'Back',
  };

  // ----- Sticker indexing ---------------------------------------------------
  // For face F: given cubie position (x,y,z) with that face outward,
  // return the index 0..53 (Kociemba order).

  function stickerIndex(face, x, y, z) {
    switch (face) {
      case 'U': return 0  + (z + 1) * 3 + (x + 1);
      case 'R': return 9  + (1 - y) * 3 + (1 - z);
      case 'F': return 18 + (1 - y) * 3 + (x + 1);
      case 'D': return 27 + (1 - z) * 3 + (x + 1);
      case 'L': return 36 + (1 - y) * 3 + (z + 1);
      case 'B': return 45 + (1 - y) * 3 + (1 - x);
    }
    return -1;
  }
  const CENTERS = { U: 4, R: 13, F: 22, D: 31, L: 40, B: 49 };

  function outwardFaces(x, y, z) {
    const out = [];
    if (y === 1)  out.push('U');
    if (y === -1) out.push('D');
    if (x === 1)  out.push('R');
    if (x === -1) out.push('L');
    if (z === 1)  out.push('F');
    if (z === -1) out.push('B');
    return out;
  }

  // ----- Sticker registry ---------------------------------------------------
  // List of all 54 stickers: {idx, pos:[x,y,z], dir:[dx,dy,dz], face}.
  const STICKERS = [];
  (function build() {
    const faceDir = {
      U: [0, 1, 0], D: [0, -1, 0],
      R: [1, 0, 0], L: [-1, 0, 0],
      F: [0, 0, 1], B: [0, 0, -1],
    };
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++)
          for (const face of outwardFaces(x, y, z)) {
            STICKERS.push({
              idx: stickerIndex(face, x, y, z),
              pos: [x, y, z],
              dir: faceDir[face],
              face,
            });
          }
  })();

  function dirToFace(d) {
    if (d[1] === 1) return 'U';
    if (d[1] === -1) return 'D';
    if (d[0] === 1) return 'R';
    if (d[0] === -1) return 'L';
    if (d[2] === 1) return 'F';
    if (d[2] === -1) return 'B';
    return null;
  }

  // ----- Rotation primitives -----------------------------------------------
  // Rotate a vec3 90° around axis (0=x,1=y,2=z) by sign (+1 or -1).
  // For axis x: rotation [+1] sends +y→+z, +z→-y  (matches "right-hand around +x").
  function rot90(v, axis, sign) {
    const [x, y, z] = v;
    if (axis === 0) {
      // around x: y' = -sign*z, z' = sign*y
      return [x, -sign * z, sign * y];
    }
    if (axis === 1) {
      // around y: x' = sign*z, z' = -sign*x
      return [sign * z, y, -sign * x];
    }
    // around z: x' = -sign*y, y' = sign*x
    return [-sign * y, sign * x, v[2]];
  }

  // ----- Move definitions ---------------------------------------------------
  // For each base move (clockwise viewed from outside that face), give:
  //   axis: which coord (0=x, 1=y, 2=z)
  //   layer: which value of that coord (-1 or +1)
  //   sign:  rotation sign per rot90 convention
  //
  // Derivation: "clockwise from outside" means a right-hand rotation
  // around the OUTWARD normal of that face. So for U (normal +y), sign = +1
  // around +y. For D (normal -y), clockwise from outside means right-hand
  // around -y = sign -1 around +y.
  const BASE_MOVES = {
    U: { axis: 1, layer: 1,  sign: -1 },
    D: { axis: 1, layer: -1, sign: +1 },
    R: { axis: 0, layer: 1,  sign: -1 },
    L: { axis: 0, layer: -1, sign: +1 },
    F: { axis: 2, layer: 1,  sign: -1 },
    B: { axis: 2, layer: -1, sign: +1 },
  };

  // For a quarter-turn move, produce a permutation array `perm[54]` where
  // sticker at position perm[i] in OLD state moves TO position i in NEW state.
  // Equivalently new[i] = old[perm[i]].
  function buildPerm(move) {
    const { axis, layer, sign } = move;
    const perm = new Array(54);
    for (let i = 0; i < 54; i++) perm[i] = i; // identity for stickers not in layer
    for (const s of STICKERS) {
      if (s.pos[axis] !== layer) continue;
      const newPos = rot90(s.pos, axis, sign);
      const newDir = rot90(s.dir, axis, sign);
      const newFace = dirToFace(newDir);
      const newIdx = stickerIndex(newFace, newPos[0], newPos[1], newPos[2]);
      perm[newIdx] = s.idx; // new position newIdx pulls from old position s.idx
    }
    return perm;
  }

  // Precompute permutations for each base move.
  const PERMS = {};
  for (const f of FACE_ORDER) PERMS[f] = buildPerm(BASE_MOVES[f]);

  function applyPerm(state, perm) {
    let out = '';
    for (let i = 0; i < 54; i++) out += state[perm[i]];
    return out;
  }

  // ----- Move parsing + application ----------------------------------------

  function parseMove(tok) {
    if (!tok) return null;
    const face = tok[0];
    if (!BASE_MOVES[face]) return null;
    let dir = 1;
    if (tok.length > 1) {
      if (tok[1] === "'") dir = -1;
      else if (tok[1] === '2') dir = 2;
    }
    return { face, dir };
  }

  function applyMove(state, tok) {
    const m = parseMove(tok);
    if (!m) return state;
    const p = PERMS[m.face];
    if (m.dir === 1) return applyPerm(state, p);
    if (m.dir === -1) {
      // inverse = apply 3 times (cheap for once-per-frame UI moves)
      return applyPerm(applyPerm(applyPerm(state, p), p), p);
    }
    return applyPerm(applyPerm(state, p), p);
  }

  function applyMoves(state, tokens) {
    if (typeof tokens === 'string') tokens = tokens.trim().split(/\s+/);
    for (const t of tokens) if (t) state = applyMove(state, t);
    return state;
  }

  function inverseMoves(tokens) {
    if (typeof tokens === 'string') tokens = tokens.trim().split(/\s+/);
    return tokens.slice().reverse().map((t) => {
      const m = parseMove(t);
      if (!m) return t;
      if (m.dir === 1) return m.face + "'";
      if (m.dir === -1) return m.face;
      return m.face + '2';
    });
  }

  // ----- Validation ---------------------------------------------------------

  // Validate sticker counts and that the 6 centers carry 6 distinct colors.
  // We DO NOT require a specific orientation — centers define which face is which.
  function quickValid(state) {
    if (state.length !== 54) return { ok: false, reason: 'Wrong length' };
    const counts = {};
    for (const c of state) counts[c] = (counts[c] || 0) + 1;
    const keys = Object.keys(counts);
    if (keys.length !== 6) return { ok: false, reason: `Need 6 distinct colors (have ${keys.length})` };
    for (const k of keys) {
      if (counts[k] !== 9) return { ok: false, reason: `Need 9 of each color (${k}: ${counts[k]})` };
    }
    // Check centers are 6 distinct values
    const centerVals = FACE_ORDER.map((f) => state[CENTERS[f]]);
    const uniq = new Set(centerVals);
    if (uniq.size !== 6) return { ok: false, reason: 'Two faces share the same center color' };
    return { ok: true };
  }

  // Normalize a painted state so each center's color becomes that face's label.
  // E.g. if user has 'D' (yellow) at the U center, all 'D' stickers become 'U'
  // and all 'U' stickers become 'D'. Result is a canonical Kociemba string.
  function normalizeState(state) {
    const map = {};
    for (const f of FACE_ORDER) {
      const colorAtCenter = state[CENTERS[f]];
      map[colorAtCenter] = f;
    }
    let out = '';
    for (let i = 0; i < 54; i++) out += map[state[i]] || state[i];
    return out;
  }

  // ----- Pretty notation ----------------------------------------------------

  function tokenLabel(tok) {
    const m = parseMove(tok);
    if (!m) return tok;
    const face = FACE_NAMES[m.face];
    if (m.dir === 1) return `${face} clockwise`;
    if (m.dir === -1) return `${face} counter-clockwise`;
    if (m.dir === 2) return `${face} 180°`;
    return tok;
  }

  // ----- Self-check (cheap) -------------------------------------------------
  // Verify that applying X X X X = identity for each base face.
  (function selfCheck() {
    for (const f of FACE_ORDER) {
      let s = SOLVED;
      for (let i = 0; i < 4; i++) s = applyMove(s, f);
      if (s !== SOLVED) {
        console.error('[engine] self-check FAILED for face', f, s);
      }
    }
    // And X X' = identity
    for (const f of FACE_ORDER) {
      const s = applyMove(applyMove(SOLVED, f), f + "'");
      if (s !== SOLVED) console.error('[engine] self-check inverse FAILED for', f, s);
    }
  })();

  // ----- Export -------------------------------------------------------------

  global.CubeEngine = {
    SOLVED, COLORS, FACE_ORDER, FACE_NAMES, CENTERS,
    stickerIndex, outwardFaces,
    applyMove, applyMoves, inverseMoves, parseMove,
    quickValid, normalizeState, tokenLabel,
    BASE_MOVES, // exposed so cube3d uses same axis/sign convention
  };
})(window);
