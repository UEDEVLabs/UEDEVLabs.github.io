// Per-move solve explanation, computed from REAL cube state (not invented).
//
// For each move in a solution we determine:
//   - which solved-position "slots" become correctly filled (a piece placed)
//   - which become un-filled (a piece temporarily moved out — a setup move)
//   - the current high-level objective (white face → middle layer → last layer)
//
// This lets the UI say, truthfully, WHY a given move matters: "Places the
// white-green edge", "Sets up the next piece", "Finishing the last layer", etc.
//
// Works for ANY solution (optimal or not) because it reads the cube directly.

(function (global) {
  'use strict';
  const E = global.CubeEngine;
  const SOLVED = E.SOLVED;

  const COLOR_NAME = {
    U: 'white', D: 'yellow', F: 'green', B: 'blue', R: 'red', L: 'orange',
  };

  // ---- Build the 20 movable cubies (12 edges, 8 corners) -------------------
  // Each: { key, type:'edge'|'corner', indices:[...], faces:[...],
  //         solvedColors:[...], layer:'white'|'middle'|'yellow', name }
  const CUBIES = (function build() {
    const out = [];
    for (let x = -1; x <= 1; x++)
      for (let y = -1; y <= 1; y++)
        for (let z = -1; z <= 1; z++) {
          const faces = E.outwardFaces(x, y, z);
          if (faces.length < 2) continue; // skip centers & core
          const indices = faces.map((f) => E.stickerIndex(f, x, y, z));
          const solvedColors = indices.map((i) => SOLVED[i]);
          const type = faces.length === 2 ? 'edge' : 'corner';
          // Layer classification by the colors the piece carries.
          let layer;
          if (solvedColors.includes('U')) layer = 'white';
          else if (solvedColors.includes('D')) layer = 'yellow';
          else layer = 'middle';
          const name = solvedColors
            .filter((c) => c !== undefined)
            .map((c) => COLOR_NAME[c])
            .join('-');
          out.push({ key: indices.join(','), type, indices, faces, solvedColors, layer, name });
        }
    return out;
  })();

  // A cubie's *location* is "filled correctly" when every sticker at that
  // location matches SOLVED (right piece, right orientation).
  function filledSet(state) {
    const set = new Set();
    for (const c of CUBIES) {
      let ok = true;
      for (const idx of c.indices) {
        if (state[idx] !== SOLVED[idx]) { ok = false; break; }
      }
      if (ok) set.add(c.key);
    }
    return set;
  }

  function cubieByKey(key) {
    return CUBIES.find((c) => c.key === key);
  }

  // High-level objective given what's currently filled.
  function objectiveFor(filled) {
    const whiteDone = CUBIES.filter((c) => c.layer === 'white').every((c) => filled.has(c.key));
    const middleDone = CUBIES.filter((c) => c.layer === 'middle').every((c) => filled.has(c.key));
    if (!whiteDone) return { key: 'white', title: 'Building the white face', blurb: 'Getting the white cross and corners home — your solid foundation.' };
    if (!middleDone) return { key: 'middle', title: 'Solving the middle layer', blurb: 'Slotting the four side edges so the bottom two layers are complete.' };
    return { key: 'yellow', title: 'Finishing the last layer', blurb: 'Orienting and positioning the final yellow pieces.' };
  }

  // ---- Annotate a whole solution ------------------------------------------
  // Returns array (length = moves.length) of:
  //   { effect, kind:'place'|'setup'|'adjust', placed:[names], objective:{...} }
  function annotate(startState, moves) {
    const out = [];
    let state = startState;
    let filled = filledSet(state);
    for (let i = 0; i < moves.length; i++) {
      const tok = moves[i];
      const next = E.applyMove(state, tok);
      const nextFilled = filledSet(next);

      const newlyFilled = [];
      const removed = [];
      for (const key of nextFilled) if (!filled.has(key)) newlyFilled.push(key);
      for (const key of filled) if (!nextFilled.has(key)) removed.push(key);

      // Objective is based on the state BEFORE the move (what we're working on).
      const objective = objectiveFor(filled);

      let kind, effect, placed = [];
      if (newlyFilled.length > 0) {
        kind = 'place';
        placed = newlyFilled.map((k) => cubieByKey(k));
        const p = placed[0];
        const relevant = placed.find((c) => c.layer === objective.key) || p;
        const extra = newlyFilled.length - 1;
        effect = `Locks the ${relevant.name} ${relevant.type} into place`;
        if (extra > 0) effect += ` and ${extra} more piece${extra > 1 ? 's' : ''}`;
      } else if (removed.length > 0) {
        kind = 'setup';
        const r = cubieByKey(removed[0]);
        effect = `Moves the ${r.name} ${r.type} aside to reach the next piece`;
      } else {
        kind = 'adjust';
        effect = 'Rotates a layer to line up the next piece';
      }

      out.push({
        effect, kind,
        placed: placed.map((c) => c.name),
        objective,
        homeAfter: nextFilled.size,
        total: CUBIES.length,
      });
      state = next;
      filled = nextFilled;
    }
    return out;
  }

  // Progress counts for a state (for a progress meter).
  function progress(state) {
    const filled = filledSet(state);
    const total = CUBIES.length;
    return { filled: filled.size, total };
  }

  global.SolveExplain = { annotate, progress, objectiveFor, filledSet };
})(window);
