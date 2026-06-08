// Beginner Layer-By-Layer (LBL) tutorial data.
// Each phase defines an algorithm in standard notation. The demo's start state
// is automatically the algorithm's inverse applied to SOLVED, so running the
// algorithm in demo mode always finishes on a perfectly solved cube.
//
// Each phase ALSO carries teaching content:
//   why      — the reasoning / mental model behind the step (beginner-friendly)
//   diagrams — array of { pattern, label, ring? } face diagrams. `pattern` is a
//              9-char string read top-left→bottom-right; each char is a color
//              letter (U white, D yellow, F green, R red, L orange, B blue) or
//              'X' for a neutral "not-yet / don't-care" cell. `ring` is an array
//              of cell indices (0..8) to draw an attention ring around.

(function (global) {
  'use strict';
  const E = global.CubeEngine;

  const PHASES = [
    {
      id: 'cross',
      title: 'White cross',
      eyebrow: 'Phase 1 of 7',
      story: 'Build a white plus on top. Each white-edge piece must also match its side-center color so the cross is correctly aligned.',
      why: 'The cross is your anchor. These four edges are the only pieces that border BOTH the white center and a colored side-center — so once they are placed and color-matched, every other piece has a fixed reference to build against. Skip the matching and the whole solve quietly drifts out of alignment.',
      diagrams: [
        { pattern: 'XUXUUUXUX', label: 'Aim for a white plus', ring: [1, 3, 5, 7] },
        { pattern: 'XFXXUXXXX', label: 'Edge color must match its side center', ring: [1] },
      ],
      tips: [
        'White face up. Look for white edges scattered around the cube.',
        'This step is intuitive — most edges go up with a single F, R, or B turn.',
        'Each edge has two colors: the white goes on top, the other must line up with its matching side center.',
      ],
      alg: "F2",
    },
    {
      id: 'corners',
      title: 'White corners',
      eyebrow: 'Phase 2 of 7',
      story: 'Place the four white corners under their slots, then "sledgehammer" each one up with R U R\' U\'. Repeat until the corner snaps in (max 5 times per corner).',
      why: 'Corners lock the entire first layer solid. A corner touches three faces, so a correctly placed white corner pins down two side colors at once — finishing the white face turns the bottom third of the cube into a rigid, trustworthy base you never have to revisit.',
      diagrams: [
        { pattern: 'UUUUUUUUU', label: 'Goal: a fully solid white face', ring: [0, 2, 6, 8] },
      ],
      tips: [
        'Find a white corner in the top layer. Spin the top until it sits directly above its slot.',
        'Run R U R\' U\' and check. Repeat (up to 5×) until the white corner drops in facing up.',
        'White sticker pointing sideways? Same trigger still works — just keep repeating.',
      ],
      alg: "R U R' U'",
    },
    {
      id: 'f2l',
      title: 'Middle layer edges',
      eyebrow: 'Phase 3 of 7',
      story: 'Now the four middle-layer edges. Flip the cube so white is on the bottom. Find an edge on top with no yellow, align it with its side center, then send it left or right.',
      why: 'These are the last pieces that DON\'T involve yellow — yellow belongs on the final face. By pairing them now, you finish the entire bottom two layers, so everything left to solve lives on the top face where you can see it all at once. That visibility is what makes the last four steps possible.',
      diagrams: [
        { pattern: 'XXXFFFFFF', label: 'Two layers of a side face done', ring: [3, 4, 5] },
        { pattern: 'XXXXDXXXX', label: 'No yellow on an edge → it belongs in the middle', ring: [4] },
      ],
      tips: [
        'Right insert: U R U\' R\' U\' F\' U F (shown below)',
        'Left insert: U\' L\' U L U F U\' F\' (mirror of the above)',
        'Yellow on top of an edge means it belongs on the LAST layer, not the middle — skip it.',
      ],
      alg: "U R U' R' U' F' U F",
    },
    {
      id: 'yellow-cross',
      title: 'Yellow cross',
      eyebrow: 'Phase 4 of 7',
      story: 'Make a yellow plus on top using F R U R\' U\' F\'. You\'ll first see one of three shapes — a dot, an L, or a line — and the algorithm progresses you through them.',
      why: 'From here you only control the top layer, so the strategy splits in two: first ORIENT (get yellow facing up), then POSITION. Flipping the edges into a cross before worrying about where they go means each later step can\'t undo this one. The same short algorithm walks any starting shape forward: dot → L → line → cross.',
      diagrams: [
        { pattern: 'XXXXDXXXX', label: '1. Dot', ring: [4] },
        { pattern: 'XDXXDDXXX', label: '2. L-shape', ring: [1, 4, 5] },
        { pattern: 'XXXDDDXXX', label: '3. Line', ring: [3, 4, 5] },
        { pattern: 'XDXDDDXDX', label: '4. Cross', ring: [1, 3, 5, 7] },
      ],
      tips: [
        'Dot (no yellow edges up): apply once → you get an L.',
        'L: hold it pointing to the top-left, then apply → you get a line.',
        'Line: hold it horizontal, then apply → you get the cross.',
      ],
      alg: "F R U R' U' F'",
    },
    {
      id: 'yellow-corners-orient',
      title: 'Orient yellow corners',
      eyebrow: 'Phase 5 of 7',
      story: 'Twist all four top corners so yellow faces up. The "sune" algorithm — R U R\' U R U2 R\' — does the work. Hold an unsolved corner at the front-right and run it once or twice.',
      why: 'Same principle as the cross: orientation FIRST, position SECOND. We force every corner to point yellow up and deliberately ignore whether it\'s in the right spot yet. Solving one idea at a time — first "which way does it face", later "where does it go" — is exactly what keeps the beginner method memorizable.',
      diagrams: [
        { pattern: 'DDDDDDDDD', label: 'Goal: the whole top face is yellow', ring: [0, 2, 6, 8] },
      ],
      tips: [
        'Hold an un-yellowed corner at the front-right, then run the sune.',
        'Don\'t panic if the cube looks scrambled mid-way — keep the same orientation between repeats.',
        'After at most a few sunes, every yellow sticker points up.',
      ],
      alg: "R U R' U R U2 R'",
    },
    {
      id: 'yellow-corners-permute',
      title: 'Position yellow corners',
      eyebrow: 'Phase 6 of 7',
      story: 'Yellow is on top but the corners may be in the wrong corners. This trigger cycles three corners and leaves one in place.',
      why: 'The top is solid yellow, but a corner can be yellow-up and STILL be in the wrong location. We swap corners home before edges because, at this stage, cycling the corners doesn\'t disturb the edges — so fixing them first leaves the edges free to be the very last thing you solve.',
      diagrams: [
        { pattern: 'RDDDDDDDL', label: 'Corner side-stickers must match their faces', ring: [0, 2, 6, 8] },
      ],
      tips: [
        'Find a corner that\'s already in its correct spot — hold it at the back-right.',
        'Run U R U\' L\' U R\' U\' L. The other three corners cycle into place.',
        'No corner correct yet? Run the trigger once from any angle to create one, then repeat.',
      ],
      alg: "U R U' L' U R' U' L",
    },
    {
      id: 'yellow-edges',
      title: 'Position yellow edges',
      eyebrow: 'Phase 7 of 7',
      story: 'Final step. Corners are done; only the top edges are out of place. This algorithm rotates three of the top edges in a cycle while leaving the fourth (and the rest of the cube) untouched.',
      why: 'Everything is solid yellow and the corners are home — only the four top edges might be cycled out of order. Because this is the very last step, there is nothing left to protect: you simply rotate three edges at a time until they click into their matching faces and the cube is solved.',
      diagrams: [
        { pattern: 'XDXDDDXDX', label: 'Only the edges remain to cycle', ring: [1, 3, 5, 7] },
        { pattern: 'DDDDDDDDD', label: 'Solved!', ring: [] },
      ],
      tips: [
        'Look at the top edges — is any one already in its correct spot? Hold that edge at the BACK.',
        'Run the algorithm — the other three edges cycle into place. Done.',
        'If NO edge is correct yet, run the algorithm once from any angle; that leaves exactly one correct. Then apply tip #1.',
      ],
      alg: "R U' R U R U R U' R' U' R2",
    },
  ];

  // Compute the inverse of a move sequence string.
  function invertAlg(algStr) {
    const tokens = algStr.trim().split(/\s+/);
    return tokens.slice().reverse().map((t) => {
      const face = t[0];
      const mod = t.slice(1);
      if (mod === "'") return face;
      if (mod === '2') return face + '2';
      return face + "'";
    }).join(' ');
  }

  // start state = SOLVED with the inverse-of-alg applied, so alg returns SOLVED.
  function startState(phase) {
    const inv = invertAlg(phase.alg);
    return E.applyMoves(E.SOLVED, inv);
  }
  function endState(phase) {
    return E.SOLVED;
  }
  function demoMoves(phase) {
    return phase.alg.trim().split(/\s+/);
  }

  global.LBL_TUTORIAL = { PHASES, startState, endState, demoMoves, invertAlg };
})(window);
