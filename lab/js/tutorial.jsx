/* global React, CubeEngine, LBL_TUTORIAL */
// Beginner tutorial overlay. Renders a side sheet with the 7 LBL phases,
// algorithm chips, tips, and demo controls. Drives the 3D cube via two
// callbacks the parent provides: setCubeState(stateStr) and playMoves(tokens, speed).

const { useState: useStateT, useEffect: useEffectT, useMemo: useMemoT } = React;

// Small 3x3 face diagram. `pattern` is a 9-char string (color letters or 'X').
// `ring` is an array of cell indices to draw an attention ring around.
function FaceDiagram({ pattern, ring = [], size = 64 }) {
  const cell = size / 3;
  const gap = Math.max(2, size * 0.04);
  const inner = cell - gap;
  const ringSet = new Set(ring);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
      style={{ display: 'block', borderRadius: 6 }}>
      <rect x="0" y="0" width={size} height={size} rx="6" fill="#000" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
        const r = Math.floor(i / 3), c = i % 3;
        const ch = pattern[i];
        const fill = ch === 'X' ? '#2a2e38' : (CubeEngine.COLORS[ch] || '#2a2e38');
        const x = c * cell + gap / 2, y = r * cell + gap / 2;
        return (
          <g key={i}>
            <rect x={x} y={y} width={inner} height={inner}
              rx={Math.max(2, inner * 0.16)} fill={fill}
              stroke="rgba(0,0,0,0.4)" strokeWidth="0.5" />
            {ringSet.has(i) && (
              <rect x={x - 0.5} y={y - 0.5} width={inner + 1} height={inner + 1}
                rx={Math.max(2, inner * 0.16)} fill="none"
                stroke="#fff" strokeWidth="2" />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function TutorialPanel({ open, onClose, setCubeState, playMoves, cubeBusy, setHighlight }) {
  const phases = LBL_TUTORIAL.PHASES;
  const [pi, setPi] = useStateT(0);
  const [moveIdx, setMoveIdx] = useStateT(0);
  const [autoLoad, setAutoLoad] = useStateT(true);

  const phase = phases[pi];
  const moves = useMemoT(() => LBL_TUTORIAL.demoMoves(phase), [pi]);

  // When phase changes (or panel opens), load the start state for that phase.
  useEffectT(() => {
    if (!open) return;
    if (!autoLoad) return;
    setCubeState(LBL_TUTORIAL.startState(phase));
    setMoveIdx(0);
    setHighlight && setHighlight(moves[0] || null);
    // eslint-disable-next-line
  }, [open, pi]);

  // Update highlight when moveIdx changes.
  useEffectT(() => {
    if (!open) { setHighlight && setHighlight(null); return; }
    setHighlight && setHighlight(moves[moveIdx] || null);
  }, [open, moveIdx, pi]);

  async function playAll() {
    if (cubeBusy()) return;
    setCubeState(LBL_TUTORIAL.startState(phase));
    setMoveIdx(0);
    await new Promise((r) => setTimeout(r, 180));
    for (let i = 0; i < moves.length; i++) {
      await playMoves([moves[i]], 1);
      setMoveIdx(i + 1);
    }
  }

  async function stepOne() {
    if (cubeBusy()) return;
    if (moveIdx >= moves.length) return;
    await playMoves([moves[moveIdx]], 0.9);
    setMoveIdx((i) => i + 1);
  }

  function resetPhase() {
    setCubeState(LBL_TUTORIAL.startState(phase));
    setMoveIdx(0);
  }

  if (!open) return null;

  return (
    <div className="tut-overlay">
      <div className="tut-sheet">
        <div className="tut-head">
          <div>
            <div className="tut-eyebrow">{phase.eyebrow}</div>
            <div className="tut-title">{phase.title}</div>
          </div>
          <button className="tut-x" onClick={onClose} title="Close tutorial">×</button>
        </div>

        <div className="tut-nav">
          {phases.map((p, i) => (
            <button key={p.id}
              className={`tut-step ${i === pi ? 'active' : ''} ${i < pi ? 'done' : ''}`}
              onClick={() => setPi(i)}
              title={p.title}>
              <span className="tut-step-num">{i + 1}</span>
            </button>
          ))}
        </div>

        <div className="tut-story">{phase.story}</div>

        {phase.why && (
          <div className="tut-why">
            <div className="tut-why-icon">?</div>
            <div>
              <div className="tut-why-label">Why this step</div>
              <div className="tut-why-text">{phase.why}</div>
            </div>
          </div>
        )}

        {phase.diagrams && phase.diagrams.length > 0 && (
          <div className="tut-goal">
            <div className="tut-label">What you're aiming for</div>
            <div className={`tut-diagrams ${phase.diagrams.length >= 3 ? 'flow' : ''}`}>
              {phase.diagrams.map((d, i) => (
                <React.Fragment key={i}>
                  {i > 0 && phase.diagrams.length >= 3 && (
                    <div className="tut-diagram-arrow">→</div>
                  )}
                  <figure className="tut-diagram">
                    <FaceDiagram pattern={d.pattern} ring={d.ring || []}
                      size={phase.diagrams.length >= 3 ? 56 : 64} />
                    <figcaption>{d.label}</figcaption>
                  </figure>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <div className="tut-alg-block">
          <div className="tut-label">Algorithm</div>
          <div className="tut-alg">
            {moves.map((tok, i) => (
              <span key={i}
                className={`tut-tok ${i < moveIdx ? 'done' : ''} ${i === moveIdx ? 'next' : ''}`}>
                {tok}
              </span>
            ))}
          </div>
        </div>

        <div className="tut-controls">
          <button className="btn ghost" onClick={resetPhase} title="Reset phase">⟲ Reset</button>
          <button className="btn ghost" onClick={stepOne} disabled={moveIdx >= moves.length}>
            Step ▶
          </button>
          <button className="btn primary" onClick={playAll}>
            Play demo
          </button>
        </div>

        <div className="tut-tips">
          <div className="tut-label">Tips</div>
          <ul>
            {phase.tips.map((t, i) => (<li key={i}>{t}</li>))}
          </ul>
        </div>

        <div className="tut-foot">
          <button className="btn ghost"
            onClick={() => setPi(Math.max(0, pi - 1))}
            disabled={pi === 0}>
            ← Previous
          </button>
          <div className="tut-progress">{pi + 1} / {phases.length}</div>
          <button className="btn ghost"
            onClick={() => setPi(Math.min(phases.length - 1, pi + 1))}
            disabled={pi === phases.length - 1}>
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

window.TutorialPanel = TutorialPanel;
