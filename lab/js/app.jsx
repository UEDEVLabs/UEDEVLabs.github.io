/* global React, ReactDOM, CubeEngine, Cube3D, Solver, CubeNet */
// Main app for the Rubik's Cube Solver.
const { useState, useEffect, useRef, useCallback, useMemo } = React;
const E = CubeEngine;

// ------------- Helpers ------------------------------------------------------

// Group a flat sequence of moves into phases for the explanation track.
// We use a heuristic that splits the solution into "Orient → Place → Finish"
// using cubejs' two-phase boundary: Kociemba's phase 1 ends when the cube
// reaches a G1 subset state. Without internal access we approximate by
// splitting roughly into thirds and labelling phases narratively.
function buildPhases(moves) {
  if (!moves.length) return [];
  const phases = [];
  const n = moves.length;
  // Three coarse phases; tuned to feel natural at 18-22 move solutions.
  const cuts = [Math.floor(n / 3), Math.floor((2 * n) / 3), n];
  const titles = ['Orienting the cube', 'Aligning the layers', 'Final placement'];
  const blurbs = [
    'Setting up corner & edge orientation so every piece can be placed.',
    'Routing pieces to where they belong — the cube starts to take shape.',
    'Last permutations — the solver finishes with the fewest possible moves.',
  ];
  let start = 0;
  for (let i = 0; i < 3; i++) {
    if (cuts[i] === start) continue;
    phases.push({
      start, end: cuts[i],
      title: titles[i],
      blurb: blurbs[i],
    });
    start = cuts[i];
  }
  return phases;
}

function phaseAt(phases, moveIdx) {
  for (const p of phases) {
    if (moveIdx >= p.start && moveIdx < p.end) return p;
  }
  return null;
}

function formatTime(ms) {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ------------- Tweaks ------------------------------------------------------
const COLOR_SCHEMES = {
  classic: { U:'#FFFFFF', D:'#FFD500', F:'#009B48', B:'#0046AD', R:'#B71234', L:'#FF5800' },
  pastel:  { U:'#F7F4EA', D:'#FFE082', F:'#9CD9A6', B:'#9DBEEA', R:'#F2A2A6', L:'#F6C28B' },
  neon:    { U:'#F2F7FF', D:'#FFE600', F:'#00FFA3', B:'#2E7BFF', R:'#FF2D6F', L:'#FF8A1F' },
  jewel:   { U:'#EDE7DA', D:'#E8B500', F:'#1F7A3A', B:'#2A4A8F', R:'#8C1B2E', L:'#D9591F' },
};
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "scheme": "classic",
  "bodyColor": "#101013",
  "animSpeed": 1.0,
  "showHints": true
}/*EDITMODE-END*/;

// ------------- App ----------------------------------------------------------

function App() {
  const [t, setTweak] = (window.useTweaks || (() => [TWEAK_DEFAULTS, () => {}]))(TWEAK_DEFAULTS);

  // Apply color scheme by mutating CubeEngine.COLORS in place so 3D & net both pick up.
  useEffect(() => {
    const sc = COLOR_SCHEMES[t.scheme] || COLOR_SCHEMES.classic;
    Object.assign(E.COLORS, sc);
    if (cube3dRef.current) cube3dRef.current.setState(cube3dRef.current.getState());
  }, [t.scheme]);
  const stageRef = useRef(null);
  const cube3dRef = useRef(null);

  // State string the user is composing (paint mode) or that the solver works from.
  const [scrambledState, setScrambledState] = useState(E.SOLVED);
  // The state currently shown in 3D (may differ during playback).
  const [displayState, setDisplayState] = useState(E.SOLVED);
  const [mode, setMode] = useState('paint'); // 'paint' | 'ready' | 'solving' | 'solved'
  const [selectedColor, setSelectedColor] = useState('U');

  const [solution, setSolution] = useState([]); // array of move tokens
  const [annotations, setAnnotations] = useState([]); // per-move {effect,kind,...}
  const [lblPhaseOf, setLblPhaseOf] = useState(null); // per-move phase index (beginner mode) or null
  const [lblPhases, setLblPhases] = useState(null);   // phase metadata array (beginner mode)
  const [solveMethod, setSolveMethod] = useState('teach'); // 'teach' (beginner) | 'fast' (optimal)
  const [moveIdx, setMoveIdx] = useState(0);    // 0..solution.length (inclusive: end = solved)

  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1.0); // 0.25..3
  const [solverReady, setSolverReady] = useState(false);
  const [solverInitializing, setSolverInitializing] = useState(false);
  const [error, setError] = useState(null);
  const [showNet, setShowNet] = useState(true);
  const [showHints, setShowHints] = useState(true); // pulse highlight on next move
  const [paintBrushIdx, setPaintBrushIdx] = useState(null); // for net hover indication
  const [learnOpen, setLearnOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanToast, setScanToast] = useState(null);

  // Timer (starts on first play, stops when solved or reset).
  const [timerStart, setTimerStart] = useState(null);
  const [timerNow, setTimerNow] = useState(null);

  // ----- Mount 3D ------------------------------------------------------------
  useEffect(() => {
    if (!stageRef.current) return;
    const c = Cube3D.create(stageRef.current);
    cube3dRef.current = c;
    c.onStickerClick = (idx) => {
      // Sticker click handler is set imperatively but reads latest state via ref-ish trick.
      handleStickerClick(idx);
    };
    return () => c.dispose();
    // eslint-disable-next-line
  }, []);

  // Latest state refs (so onStickerClick sees current values).
  const modeRef = useRef(mode);
  const colorRef = useRef(selectedColor);
  const scrambledRef = useRef(scrambledState);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { colorRef.current = selectedColor; }, [selectedColor]);
  useEffect(() => { scrambledRef.current = scrambledState; }, [scrambledState]);

  function handleStickerClick(idx) {
    if (modeRef.current !== 'paint') return;
    const next = scrambledRef.current.split('');
    next[idx] = colorRef.current;
    const newState = next.join('');
    setScrambledState(newState);
    setDisplayState(newState);
    if (cube3dRef.current) cube3dRef.current.setState(newState);
  }

  // ----- Solver init ---------------------------------------------------------
  function initSolver() {
    if (solverReady || solverInitializing) return Promise.resolve();
    setSolverInitializing(true);
    return Solver.ensureInit().then(() => {
      setSolverReady(true);
      setSolverInitializing(false);
    }).catch((e) => {
      setError(`Could not initialise solver: ${e.message}`);
      setSolverInitializing(false);
    });
  }

  // NOTE: solver init is fully lazy — it only runs when the user clicks Solve
  // (see handleSolve). We deliberately do NOT warm it up on mount: the solver
  // spins up a Web Worker that fetches the Kociemba library, and doing that
  // eagerly kept the page from ever reaching "network idle" in some embeds,
  // which looked like the page never finishing loading.

  // ----- Validity ------------------------------------------------------------
  const validity = useMemo(() => E.quickValid(scrambledState), [scrambledState]);

  // ----- Solve action --------------------------------------------------------
  async function handleSolve() {
    setError(null);
    if (!validity.ok) {
      setError(validity.reason);
      return;
    }
    const canonical = E.normalizeState(scrambledState);

    // BEGINNER (teach) method — runs locally, every move has a phase + reason.
    if (solveMethod === 'teach') {
      try {
        const r = window.LBLSolver.solve(canonical);
        if (!r || !r.ok) {
          setError('Could not build a beginner solution for this state. Try “Fastest” instead.');
          return;
        }
        setSolution(r.moves);
        setLblPhaseOf(r.phaseOf);
        setLblPhases(r.phases);
        setAnnotations([]);
        setMoveIdx(0);
        setMode('solving');
        setDisplayState(scrambledState);
        if (cube3dRef.current) cube3dRef.current.setState(scrambledState);
        setTimerStart(null);
        setTimerNow(null);
        setPlaying(true);
      } catch (e) {
        setError('Could not build a beginner solution. Try “Fastest” instead.');
      }
      return;
    }

    // FASTEST (optimal) method — Kociemba in a worker.
    if (!solverReady) {
      try { await initSolver(); } catch (e) { return; }
    }
    try {
      const moves = await Solver.solve(canonical);
      setSolution(moves);
      setLblPhaseOf(null);
      setLblPhases(null);
      try {
        setAnnotations(window.SolveExplain ? window.SolveExplain.annotate(canonical, moves) : []);
      } catch (e) { setAnnotations([]); }
      setMoveIdx(0);
      setMode('solving');
      setDisplayState(scrambledState);
      if (cube3dRef.current) cube3dRef.current.setState(scrambledState);
      setTimerStart(null);
      setTimerNow(null);
      setPlaying(true);
    } catch (e) {
      setError(e.message || 'This cube state cannot be solved');
    }
  }

  function handleScramble() {
    const moves = Solver.randomScramble(22);
    const newState = E.applyMoves(E.SOLVED, moves);
    setScrambledState(newState);
    setDisplayState(newState);
    if (cube3dRef.current) cube3dRef.current.setState(newState);
    setSolution([]);
    setAnnotations([]);
    setMoveIdx(0);
    setMode('paint');
    setError(null);
  }

  function handleReset() {
    setScrambledState(E.SOLVED);
    setDisplayState(E.SOLVED);
    if (cube3dRef.current) cube3dRef.current.setState(E.SOLVED);
    setSolution([]);
    setAnnotations([]);
    setMoveIdx(0);
    setMode('paint');
    setError(null);
    setTimerStart(null);
    setTimerNow(null);
    setPlaying(false);
  }

  function handleRewind() {
    setPlaying(false);
    setMoveIdx(0);
    if (solution.length) setMode('solving'); // leave the "Solved" state on restart
    setDisplayState(scrambledState);
    if (cube3dRef.current) cube3dRef.current.setState(scrambledState);
    setTimerStart(null);
    setTimerNow(null);
  }

  // ----- Playback engine -----------------------------------------------------
  // When `playing` is true and moveIdx < solution.length, repeatedly animate.
  const playingRef = useRef(playing);
  const moveIdxRef = useRef(moveIdx);
  const displayRef = useRef(displayState);
  const speedRef = useRef(speed);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { moveIdxRef.current = moveIdx; }, [moveIdx]);
  useEffect(() => { displayRef.current = displayState; }, [displayState]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    if (!playing) return;
    if (moveIdx >= solution.length) { setPlaying(false); return; }
    if (!cube3dRef.current) return;
    // Start timer if not started
    if (timerStart == null) setTimerStart(performance.now());

    let cancelled = false;
    async function loop() {
      while (!cancelled && playingRef.current && moveIdxRef.current < solution.length) {
        const tok = solution[moveIdxRef.current];
        const dur = 450 / speedRef.current;
        cube3dRef.current.setMoveArrow(tok); // show direction during the turn
        await cube3dRef.current.animateMove(tok, dur);
        if (cancelled) return;
        const newState = E.applyMove(displayRef.current, tok);
        setDisplayState(newState);
        displayRef.current = newState;
        setMoveIdx((i) => i + 1);
        moveIdxRef.current = moveIdxRef.current + 1;
        if (moveIdxRef.current >= solution.length) {
          setPlaying(false);
          setMode('solved');
          break;
        }
      }
    }
    loop();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [playing]);

  // Timer tick
  useEffect(() => {
    if (timerStart == null || mode === 'solved') return;
    const id = setInterval(() => setTimerNow(performance.now()), 100);
    return () => clearInterval(id);
  }, [timerStart, mode]);

  // ----- Step controls -------------------------------------------------------
  async function stepForward() {
    if (cube3dRef.current?.isAnimating) return;
    if (moveIdx >= solution.length) return;
    const tok = solution[moveIdx];
    await cube3dRef.current.animateMove(tok, 350 / speed);
    const newState = E.applyMove(displayState, tok);
    setDisplayState(newState);
    setMoveIdx(moveIdx + 1);
    if (moveIdx + 1 >= solution.length) setMode('solved');
  }
  async function stepBack() {
    if (cube3dRef.current?.isAnimating) return;
    if (moveIdx <= 0) return;
    const prevTok = solution[moveIdx - 1];
    const inv = E.inverseMoves([prevTok])[0];
    await cube3dRef.current.animateMove(inv, 350 / speed);
    const newState = E.applyMoves(scrambledState, solution.slice(0, moveIdx - 1));
    setDisplayState(newState);
    setMoveIdx(moveIdx - 1);
    if (mode === 'solved') setMode('solving');
  }
  function jumpTo(idx) {
    if (cube3dRef.current?.isAnimating) return;
    setPlaying(false);
    const newState = E.applyMoves(scrambledState, solution.slice(0, idx));
    setDisplayState(newState);
    if (cube3dRef.current) cube3dRef.current.setState(newState);
    setMoveIdx(idx);
    setMode(idx >= solution.length ? 'solved' : 'solving');
  }

  // ----- Next-move highlight + direction arrow -------------------------------
  useEffect(() => {
    if (!cube3dRef.current) return;
    const c = cube3dRef.current;
    if ((mode === 'solving' || mode === 'solved') && moveIdx < solution.length && !playing) {
      // Show which way the upcoming move turns, on the real cube.
      if (showHints) c.setHighlight(solution[moveIdx]);
      else c.setHighlight(null);
      c.setMoveArrow(solution[moveIdx]);
    } else {
      c.setHighlight(null);
      if (!playing) c.setMoveArrow(null);
    }
  }, [mode, moveIdx, solution, playing, showHints]);

  // ----- Keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    function onKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      switch (e.key.toLowerCase()) {
        case ' ': e.preventDefault(); if (solution.length) setPlaying((p) => !p); break;
        case 'arrowright': e.preventDefault(); if (solution.length) stepForward(); break;
        case 'arrowleft': e.preventDefault(); if (solution.length) stepBack(); break;
        case 'r': handleReset(); break;
        case 's': if (mode === 'paint' && validity.ok) handleSolve(); break;
        case 'n': setShowNet((v) => !v); break;
        case 'h': setShowHints((v) => !v); break;
        case 'z': handleRewind(); break;
        // Color selection: 1..6 → U R F D L B
        case '1': setSelectedColor('U'); break;
        case '2': setSelectedColor('R'); break;
        case '3': setSelectedColor('F'); break;
        case '4': setSelectedColor('D'); break;
        case '5': setSelectedColor('L'); break;
        case '6': setSelectedColor('B'); break;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Re-paint body color when bodyColor tweak changes.
  useEffect(() => {
    if (!cube3dRef.current) return;
    const root = stageRef.current?.querySelector('canvas');
    // Body color is set per-material; expose via cube3d if needed. For now,
    // we set CSS background hint and rely on scheme-driven sticker contrast.
    if (stageRef.current) stageRef.current.style.setProperty('--cube-body', t.bodyColor);
  }, [t.bodyColor]);

  // ----- Derived -------------------------------------------------------------
  const phases = useMemo(() => buildPhases(solution), [solution]);
  const currentPhase = phaseAt(phases, moveIdx);
  const nextMove = mode === 'solving' && moveIdx < solution.length ? solution[moveIdx] : null;
  const elapsed = timerStart != null && timerNow != null ? timerNow - timerStart : 0;

  // ----- UI ------------------------------------------------------------------
  return (
    <div className="layout">
      {/* HEADER */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark"></div>
          <div className="brand-text">
            <div className="brand-name">Cube<span className="brand-suffix">Solver</span></div>
            <div className="brand-sub">Kociemba two-phase · 22 moves or fewer</div>
          </div>
        </div>
        <div className="topbar-actions">
          <button className="btn ghost" onClick={() => setScanOpen(true)} title="Scan with camera">
            <span className="kbd">◉</span><span className="btn-text">Scan</span>
          </button>
          <button className="btn ghost" onClick={() => setLearnOpen(true)} title="Learn the beginner method">
            <span className="kbd">?</span><span className="btn-text">Learn</span>
          </button>
          <button className="btn ghost" onClick={handleScramble} title="Scramble (random state)">
            <span className="kbd">⤳</span><span className="btn-text">Scramble</span>
          </button>
          <button className="btn ghost" onClick={handleReset} title="Reset (R)">
            <span className="kbd">⟲</span><span className="btn-text">Reset</span>
          </button>
        </div>
      </header>

      {/* MAIN STAGE */}
      <main className="stage">
        <div className="cube-stage" ref={stageRef}></div>

        {/* TOP-LEFT: phase / status */}
        <div className="overlay top-left">
          {mode === 'paint' && (
            <div className="card">
              <div className="card-eyebrow">Step 1 of 2</div>
              <div className="card-title">Paint your cube</div>
              <div className="card-body">
                Drag to rotate the 3D cube. Pick a color below and click stickers to paint them — including centers.
              </div>
            </div>
          )}
          {mode === 'solving' && lblPhases && lblPhaseOf && (() => {
            const pi = lblPhaseOf[Math.min(moveIdx, lblPhaseOf.length - 1)] ?? 0;
            const phase = lblPhases[pi];
            if (!phase) return null;
            return (
              <div className="card">
                <div className="card-eyebrow">Step {pi + 1} of {lblPhases.length} · Beginner method</div>
                <div className="card-title">{phase.title}</div>
                <div className="card-body">{phase.why}</div>
              </div>
            );
          })()}
          {mode === 'solving' && !lblPhases && (
            <div className="card">
              <div className="card-eyebrow">Optimal solution</div>
              <div className="card-title">Watch &amp; learn</div>
              <div className="card-body">Each move below shows which face turns, which way, and what it accomplishes on the cube.</div>
            </div>
          )}
          {(mode === 'solving' || mode === 'solved') && (
            <MoveGuide
              token={moveIdx < solution.length ? solution[moveIdx] : null}
              prevToken={moveIdx > 0 ? solution[moveIdx - 1] : null}
              moveIdx={moveIdx}
              total={solution.length}
              playing={playing}
              annotation={moveIdx < solution.length ? annotations[moveIdx] : (annotations[moveIdx - 1] || null)}
              phaseInfo={lblPhases && lblPhaseOf ? (() => {
                const idx = moveIdx < solution.length ? moveIdx : moveIdx - 1;
                const pi = lblPhaseOf[Math.max(0, Math.min(idx, lblPhaseOf.length - 1))] ?? 0;
                return { title: lblPhases[pi] ? lblPhases[pi].title : '', step: pi + 1, total: lblPhases.length };
              })() : null}
            />
          )}
          {mode === 'solved' && (
            <div className="card success">
              <div className="card-eyebrow">Done</div>
              <div className="card-title">Solved ✦</div>
              <div className="card-body">
                {solution.length} moves · {formatTime(elapsed)}
              </div>
            </div>
          )}
        </div>

        {/* TOP-RIGHT: net mini-map */}
        {showNet && (
          <div className="overlay top-right">
            <div className="net-card">
              <div className="net-header">All six faces</div>
              <CubeNet
                state={displayState}
                highlightFace={nextMove ? E.parseMove(nextMove).face : null}
                selectedIdx={paintBrushIdx}
                compact
              />
            </div>
          </div>
        )}

        {/* BOTTOM-RIGHT: stats */}
        <div className="overlay bottom-right">
          <div className="stat-pill">
            <div className="stat-num">{solution.length ? `${moveIdx}/${solution.length}` : '—'}</div>
            <div className="stat-label">moves</div>
          </div>
          <div className="stat-pill">
            <div className="stat-num">{timerStart != null ? formatTime(elapsed) : '0:00'}</div>
            <div className="stat-label">time</div>
          </div>
        </div>

        {/* CENTER LOADER */}
        {solverInitializing && (
          <div className="overlay center">
            <div className="loader">
              <div className="spinner"></div>
              <div>Warming up Kociemba tables…</div>
              <div className="muted small">~3 seconds, one time only</div>
            </div>
          </div>
        )}

        {/* ERRORS */}
        {error && (
          <div className="overlay bottom-center error-toast">
            <strong>Can't solve.</strong> {error}
            <button className="link" onClick={() => setError(null)}>dismiss</button>
          </div>
        )}
      </main>

      {/* BOTTOM PANEL */}
      <footer className="bottombar">
        {mode === 'paint' && (
          <PaintPanel
            selected={selectedColor}
            onSelect={setSelectedColor}
            validity={validity}
            onSolve={handleSolve}
            solverReady={solverReady || solverInitializing}
            solveMethod={solveMethod}
            setSolveMethod={setSolveMethod}
          />
        )}
        {(mode === 'solving' || mode === 'solved') && (
          <PlaybackPanel
            solution={solution}
            moveIdx={moveIdx}
            playing={playing}
            setPlaying={setPlaying}
            speed={speed}
            setSpeed={setSpeed}
            stepBack={stepBack}
            stepForward={stepForward}
            jumpTo={jumpTo}
            rewind={handleRewind}
            backToPaint={() => { handleRewind(); setMode('paint'); setSolution([]); setAnnotations([]); }}
          />
        )}
      </footer>

      {window.TutorialPanel && (
        <window.TutorialPanel
          open={learnOpen}
          onClose={() => {
            setLearnOpen(false);
            if (cube3dRef.current) cube3dRef.current.setHighlight(null);
          }}
          setCubeState={(s) => {
            setDisplayState(s);
            setScrambledState(s);
            if (cube3dRef.current) cube3dRef.current.setState(s);
            setSolution([]);
            setMoveIdx(0);
            setMode('paint');
          }}
          playMoves={async (tokens, sp) => {
            if (!cube3dRef.current) return;
            for (const tok of tokens) {
              await cube3dRef.current.animateMove(tok, 450 / (sp || 1));
              const ns = E.applyMove(displayRef.current, tok);
              setDisplayState(ns);
              displayRef.current = ns;
              setScrambledState(ns);
            }
          }}
          cubeBusy={() => cube3dRef.current?.isAnimating}
          setHighlight={(tok) => cube3dRef.current && cube3dRef.current.setHighlight(tok)}
        />
      )}

      {window.CameraScanModal && (
        <window.CameraScanModal
          open={scanOpen}
          onClose={() => setScanOpen(false)}
          onApply={({ state, balanced, counts }) => {
            setScrambledState(state);
            setDisplayState(state);
            if (cube3dRef.current) cube3dRef.current.setState(state);
            setSolution([]);
            setMoveIdx(0);
            setMode('paint');
            setScanOpen(false);
            if (!balanced) {
              const summary = Object.entries(counts).map(([f, n]) => `${f}:${n}`).join(' ');
              setScanToast({ kind: 'warn', text: `Detected ${summary}. Some stickers may need fixing — click any sticker to correct.` });
            } else {
              setScanToast({ kind: 'ok', text: 'All 54 stickers detected. Review the cube and tap any sticker to correct.' });
            }
            setTimeout(() => setScanToast(null), 7000);
          }}
        />
      )}

      {scanToast && (
        <div className={`scan-toast ${scanToast.kind}`}>
          {scanToast.text}
          <button className="link" onClick={() => setScanToast(null)}>dismiss</button>
        </div>
      )}

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Colors" />
          <window.TweakRadio label="Scheme" value={t.scheme}
            options={['classic','pastel','neon','jewel']}
            onChange={(v) => setTweak('scheme', v)} />
          <window.TweakColor label="Cube body" value={t.bodyColor}
            options={['#101013','#1a1a22','#3a2a2a','#f4f1ea']}
            onChange={(v) => setTweak('bodyColor', v)} />
          <window.TweakSection label="Playback" />
          <window.TweakSlider label="Default speed" value={t.animSpeed}
            min={0.25} max={3} step={0.05} unit="\u00d7"
            onChange={(v) => setTweak('animSpeed', v)} />
          <window.TweakToggle label="Show next-move hint" value={t.showHints}
            onChange={(v) => { setTweak('showHints', v); setShowHints(v); }} />
        </window.TweaksPanel>
      )}
    </div>
  );
}

// --------- Sub-panels -------------------------------------------------------

// MoveGuide — shows, for the current move of the REAL solve, which face turns
// and which direction, as a face diagram with a curved arrow + plain English.
function MoveGuide({ token, prevToken, moveIdx, total, playing, annotation, phaseInfo }) {
  const show = token || prevToken;
  const active = token || prevToken;
  const m = active ? E.parseMove(active) : null;
  const faceColor = m ? E.COLORS[m.face] : '#444';

  // Direction: 'cw' | 'ccw' | 'double'
  let dir = 'cw';
  if (m) {
    if (m.dir === -1) dir = 'ccw';
    else if (m.dir === 2) dir = 'double';
    else dir = 'cw';
  }

  const plain = active ? E.tokenLabel(active) : '';
  const eyebrow = token
    ? (playing ? 'Now turning' : 'Next move')
    : 'Last move';

  // In beginner mode, the "reason" is the phase goal; otherwise the piece-level effect.
  const reason = phaseInfo ? `${phaseInfo.title}` : (annotation ? annotation.effect : null);
  const kind = phaseInfo ? 'phase' : (annotation ? annotation.kind : null);
  const homeAfter = (!phaseInfo && annotation) ? annotation.homeAfter : null;
  const totalPieces = annotation ? annotation.total : 20;
  const kindIcon = phaseInfo ? `${phaseInfo.step}` : (kind === 'place' ? '✓' : (kind === 'setup' ? '↺' : '→'));

  return (
    <div className="card move-guide">
      <div className="mg-row">
        <RotationDiagram faceColor={faceColor} dir={dir} face={m ? m.face : 'U'} />
        <div className="mg-text">
          <div className="card-eyebrow">{eyebrow} · {Math.min(moveIdx + (token ? 1 : 0), total)} / {total}</div>
          <div className="mg-token">{active || '—'}</div>
          <div className="mg-plain">{plain}</div>
        </div>
      </div>
      {reason && (
        <div className={`mg-reason ${kind}`}>
          <span className="mg-reason-icon">{kindIcon}</span>
          <span className="mg-reason-text">
            {phaseInfo
              ? <span>Working on <strong>{reason}</strong> — step {phaseInfo.step} of {phaseInfo.total}</span>
              : reason}
          </span>
        </div>
      )}
      {homeAfter != null && (
        <div className="mg-progress">
          <div className="mg-progress-bar">
            <div className="mg-progress-fill" style={{ width: `${(homeAfter / totalPieces) * 100}%` }}></div>
          </div>
          <div className="mg-progress-label">{homeAfter}/{totalPieces} pieces home</div>
        </div>
      )}
    </div>
  );
}

// A 3x3 face square in the face's color with a bold curved rotation arrow.
function RotationDiagram({ faceColor, dir, face }) {
  const size = 76;
  const pad = 8;
  const inner = size - pad * 2;
  const cell = inner / 3;
  // Arrow geometry: a 270° arc centered on the face with an arrowhead.
  const cx = size / 2, cy = size / 2;
  const r = inner * 0.42;
  // For 'ccw' we mirror horizontally.
  const sweep = dir === 'ccw' ? 0 : 1;
  // Arc from top (-90°) around 270°.
  const startA = -Math.PI / 2;
  const endA = startA + (dir === 'ccw' ? -1 : 1) * Math.PI * 1.5;
  const ax1 = cx + r * Math.cos(startA), ay1 = cy + r * Math.sin(startA);
  const ax2 = cx + r * Math.cos(endA), ay2 = cy + r * Math.sin(endA);
  // Arrowhead at end, tangent direction.
  const tangent = endA + (dir === 'ccw' ? -1 : 1) * Math.PI / 2;
  const headLen = 7;
  const hx = ax2, hy = ay2;
  const h1x = hx - headLen * Math.cos(tangent - 0.4);
  const h1y = hy - headLen * Math.sin(tangent - 0.4);
  const h2x = hx - headLen * Math.cos(tangent + 0.4);
  const h2y = hy - headLen * Math.sin(tangent + 0.4);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mg-diagram">
      <rect x="0" y="0" width={size} height={size} rx="9" fill="#000" />
      {/* 3x3 grid of the face color */}
      {[0,1,2].map((rr) => [0,1,2].map((cc) => (
        <rect key={`${rr}-${cc}`}
          x={pad + cc * cell + 1.5} y={pad + rr * cell + 1.5}
          width={cell - 3} height={cell - 3}
          rx="3" fill={faceColor} opacity="0.92" />
      )))}
      {/* rotation arc */}
      {dir === 'double' ? (
        <g>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#fff" strokeWidth="3.5"
            strokeDasharray="3 4" opacity="0.95" />
          <text x={cx} y={cy + 5} textAnchor="middle" fontSize="15" fontWeight="700"
            fill="#fff" style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 3 }}>180°</text>
        </g>
      ) : (
        <g>
          <path
            d={`M ${ax1} ${ay1} A ${r} ${r} 0 1 ${sweep} ${ax2} ${ay2}`}
            fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round"
            style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 5.5 }} />
          <path
            d={`M ${ax1} ${ay1} A ${r} ${r} 0 1 ${sweep} ${ax2} ${ay2}`}
            fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
          <polygon points={`${hx},${hy} ${h1x},${h1y} ${h2x},${h2y}`} fill="#fff"
            stroke="#000" strokeWidth="1" />
        </g>
      )}
    </svg>
  );
}

function PaintPanel({ selected, onSelect, validity, onSolve, solverReady, solveMethod, setSolveMethod }) {
  const order = ['U', 'R', 'F', 'D', 'L', 'B'];
  return (
    <div className="paint-panel">
      <div className="palette">
        <div className="panel-label">Paint color</div>
        <div className="swatches">
          {order.map((f, i) => (
            <button key={f}
              className={`swatch ${selected === f ? 'active' : ''}`}
              style={{ background: E.COLORS[f] }}
              onClick={() => onSelect(f)}
              title={`${E.FACE_NAMES[f]} (${i + 1})`}>
              <span className="swatch-key">{i + 1}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="paint-actions">
        <div className="method-toggle" title="Beginner shows the why behind every move; Fastest is the shortest solution.">
          <button className={`method-opt ${solveMethod === 'teach' ? 'active' : ''}`}
            onClick={() => setSolveMethod('teach')}>Teach me</button>
          <button className={`method-opt ${solveMethod === 'fast' ? 'active' : ''}`}
            onClick={() => setSolveMethod('fast')}>Fastest</button>
        </div>
        <div className="validity">
          {validity.ok
            ? <span className="ok">✓ Valid color counts</span>
            : <span className="bad">⚠ {validity.reason}</span>}
        </div>
        <button className="btn primary big"
          disabled={!validity.ok}
          onClick={onSolve}>
          {solveMethod === 'teach' ? 'Solve & teach' : (solverReady ? 'Solve' : 'Solve…')}
          <span className="kbd">S</span>
        </button>
      </div>
    </div>
  );
}

function PlaybackPanel({ solution, moveIdx, playing, setPlaying, speed, setSpeed,
                        stepBack, stepForward, jumpTo, rewind, backToPaint }) {
  // Render move tokens as chips; clicking a chip jumps to that index.
  const trackRef = useRef(null);
  useEffect(() => {
    if (!trackRef.current) return;
    const active = trackRef.current.querySelector('.chip.active');
    if (active) active.scrollIntoView ? null : null; // no-op (rule says no scrollIntoView)
    // Manual scroll instead:
    if (active) {
      const t = trackRef.current;
      const left = active.offsetLeft - t.clientWidth / 2 + active.clientWidth / 2;
      t.scrollTo({ left, behavior: 'smooth' });
    }
  }, [moveIdx]);

  return (
    <div className="play-panel">
      <div className="play-controls">
        <button className="btn ghost icon" onClick={rewind} title="Restart (Z)">⏮</button>
        <button className="btn ghost icon" onClick={stepBack} title="Step back (←)">◀</button>
        <button className="btn primary icon play-btn"
          onClick={() => setPlaying(!playing)} title="Play/Pause (Space)">
          {playing ? '⏸' : '▶'}
        </button>
        <button className="btn ghost icon" onClick={stepForward} title="Step forward (→)">▶</button>
        <button className="btn ghost" onClick={backToPaint} title="Back to paint">Edit cube</button>
      </div>

      <div className="play-track" ref={trackRef}>
        {solution.map((tok, i) => (
          <button key={i}
            className={`chip ${i < moveIdx ? 'done' : ''} ${i === moveIdx ? 'active' : ''}`}
            onClick={() => jumpTo(i)}
            title={E.tokenLabel(tok)}>
            <span className="chip-num">{i + 1}</span>
            <span className="chip-tok">{tok}</span>
          </button>
        ))}
      </div>

      <div className="play-speed">
        <span className="panel-label small">Speed</span>
        <input type="range" min="0.25" max="3" step="0.05"
          value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))} />
        <span className="speed-val">{speed.toFixed(2)}×</span>
      </div>
    </div>
  );
}

window.App = App;
