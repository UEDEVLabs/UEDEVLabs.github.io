/* global React, ColorScan, CubeEngine */
// Camera-based cube scanner modal — with live sampling preview and per-sticker
// correction inside the modal.

const { useState: useStateC, useEffect: useEffectC, useRef: useRefC } = React;

const SCAN_FACES = [
  { f: 'U', label: 'TOP face',    hint: 'Hold the cube flat with TOP facing the camera. Position so the FRONT row is at the bottom of the grid.' },
  { f: 'R', label: 'RIGHT face',  hint: 'Rotate so the right side faces the camera, with the TOP edge upward.' },
  { f: 'F', label: 'FRONT face',  hint: 'Hold the cube normally, FRONT facing the camera, TOP edge upward.' },
  { f: 'D', label: 'BOTTOM face', hint: 'Flip the cube so the BOTTOM faces the camera. The FRONT row is at the TOP of the grid.' },
  { f: 'L', label: 'LEFT face',   hint: 'Rotate so the left side faces the camera, TOP edge upward.' },
  { f: 'B', label: 'BACK face',   hint: 'Rotate so the back faces the camera, TOP edge upward.' },
];

const ALL_COLORS = ['U', 'R', 'F', 'D', 'L', 'B'];

function CameraScanModal({ open, onClose, onApply }) {
  const videoRef = useRefC(null);
  const streamRef = useRefC(null);
  const [error, setError] = useStateC(null);
  const [permState, setPermState] = useStateC('idle');
  const [stepIdx, setStepIdx] = useStateC(0);
  // captures = { U: { samples:[9 rgb], thumb, overrides:{idx:faceLabel} }, ... }
  const [captures, setCaptures] = useStateC({});
  const [hasSwitch, setHasSwitch] = useStateC(false);
  const [facing, setFacing] = useStateC('environment');
  const [liveSamples, setLiveSamples] = useStateC(null);

  // ----- Camera lifecycle ---------------------------------------------------
  useEffectC(() => {
    if (!open) { stopStream(); return; }
    startStream(facing);
    return () => stopStream();
    // eslint-disable-next-line
  }, [open, facing]);

  async function startStream(which) {
    setError(null);
    setPermState('requesting');
    try {
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: which },
          width: { ideal: 1280 },
          height: { ideal: 1280 },
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        setHasSwitch(devices.filter((d) => d.kind === 'videoinput').length > 1);
      } catch (_) {}
      setPermState('ready');
    } catch (e) {
      setPermState('denied');
      setError(e.message || 'Could not access camera');
    }
  }

  function stopStream() {
    const s = streamRef.current;
    if (s) { s.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  // ----- Live preview loop --------------------------------------------------
  useEffectC(() => {
    if (!open || permState !== 'ready') { setLiveSamples(null); return; }
    let raf, last = 0, stopped = false;
    function tick(now) {
      if (stopped) return;
      if (now - last > 180) {
        const v = videoRef.current;
        if (v && v.videoWidth) {
          try {
            const s = ColorScan.sampleFace(v, 0.72, 0.32);
            if (s) setLiveSamples(s);
          } catch (_) {}
        }
        last = now;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }, [open, permState]);

  // ----- Capture current face ----------------------------------------------
  function captureCurrent() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const samples = ColorScan.sampleFace(v, 0.72, 0.35);
    if (!samples) return;
    const thumb = makeThumb(v, 0.72);
    const face = SCAN_FACES[stepIdx].f;
    const updated = { samples, thumb, overrides: {} };
    setCaptures((c) => ({ ...c, [face]: updated }));
    const next = nextUncapturedAfter(stepIdx, { ...captures, [face]: 1 });
    if (next != null) setStepIdx(next);
  }

  function nextUncapturedAfter(from, caps) {
    for (let i = 1; i <= SCAN_FACES.length; i++) {
      const k = (from + i) % SCAN_FACES.length;
      if (!caps[SCAN_FACES[k].f]) return k;
    }
    return null;
  }

  function retake(face) {
    setCaptures((c) => {
      const next = { ...c };
      delete next[face];
      return next;
    });
    const idx = SCAN_FACES.findIndex((s) => s.f === face);
    if (idx >= 0) setStepIdx(idx);
  }

  // Cycle a single sticker's color override (U → R → F → D → L → B → null).
  function cycleSticker(face, idx) {
    setCaptures((c) => {
      const cap = c[face];
      if (!cap) return c;
      // Compute current effective color.
      const current = cap.overrides[idx] || classifySingle(cap, idx, c);
      const next = ALL_COLORS[(ALL_COLORS.indexOf(current) + 1) % ALL_COLORS.length];
      return { ...c, [face]: { ...cap, overrides: { ...cap.overrides, [idx]: next } } };
    });
  }

  function makeThumb(video, cropFraction) {
    const vw = video.videoWidth, vh = video.videoHeight;
    const sz = Math.min(vw, vh) * cropFraction;
    const sx = (vw - sz) / 2, sy = (vh - sz) / 2;
    const c = document.createElement('canvas');
    c.width = 120; c.height = 120;
    const ctx = c.getContext('2d');
    ctx.drawImage(video, sx, sy, sz, sz, 0, 0, 120, 120);
    return c.toDataURL('image/jpeg', 0.78);
  }

  // Helper: predict the color for a single sticker using current captures.
  // Used to seed override cycling. Returns face label.
  function classifySingle(cap, idx, allCaps) {
    if (idx === 4) return cap.face || null;
    // If we have all 6 captures, run the full classifier and pick out this idx.
    const order = ['U','R','F','D','L','B'];
    if (order.every((f) => allCaps[f])) {
      const facesByLabel = {};
      for (const f of order) facesByLabel[f] = allCaps[f].samples;
      const { state } = ColorScan.classifyState(facesByLabel);
      const myFace = Object.keys(allCaps).find((f) => allCaps[f] === cap);
      const off = order.indexOf(myFace) * 9 + idx;
      return state[off];
    }
    return 'U';
  }

  // ----- Apply --------------------------------------------------------------
  function apply() {
    if (!ALL_COLORS.every((f) => captures[f])) {
      setError('Capture all six faces before applying');
      return;
    }
    const facesByLabel = {};
    for (const f of ALL_COLORS) facesByLabel[f] = captures[f].samples;
    let { state, counts, balanced } = ColorScan.classifyState(facesByLabel);
    // Apply per-sticker overrides on top.
    const arr = state.split('');
    for (const f of ALL_COLORS) {
      const cap = captures[f];
      if (!cap.overrides) continue;
      const off = ALL_COLORS.indexOf(f) * 9;
      for (const k in cap.overrides) {
        arr[off + Number(k)] = cap.overrides[k];
      }
    }
    state = arr.join('');
    // Recompute counts after overrides.
    const finalCounts = { U:0,R:0,F:0,D:0,L:0,B:0 };
    for (const ch of state) finalCounts[ch] = (finalCounts[ch]||0) + 1;
    const finalBalanced = ALL_COLORS.every((f) => finalCounts[f] === 9);
    onApply({ state, balanced: finalBalanced, counts: finalCounts });
    stopStream();
  }

  if (!open) return null;

  const capturedCount = Object.keys(captures).length;
  const allDone = capturedCount === SCAN_FACES.length;
  const current = SCAN_FACES[stepIdx];
  const currentCap = captures[current.f];

  // Build per-sticker effective colors for the current captured face preview.
  let stickerColors = null;
  if (currentCap) {
    // Try the full classifier if all faces are captured; otherwise just
    // anchor against current face's center.
    const facesByLabel = {};
    for (const f of ALL_COLORS) if (captures[f]) facesByLabel[f] = captures[f].samples;
    if (ALL_COLORS.every((f) => facesByLabel[f])) {
      const { state } = ColorScan.classifyState(facesByLabel);
      const off = ALL_COLORS.indexOf(current.f) * 9;
      stickerColors = state.slice(off, off + 9).split('');
    } else {
      // single-face classification using own center as anchor
      const center = ColorScan.rgbToLab(currentCap.samples[4]);
      // also include any other available centers as anchors
      const anchors = { [current.f]: center };
      for (const f of ALL_COLORS) if (captures[f]) anchors[f] = ColorScan.rgbToLab(captures[f].samples[4]);
      stickerColors = currentCap.samples.map((s, i) => {
        if (i === 4) return current.f;
        const lab = ColorScan.rgbToLab(s);
        let best = current.f, bestD = Infinity;
        for (const af in anchors) {
          const dL = lab[0]-anchors[af][0], da = lab[1]-anchors[af][1], db = lab[2]-anchors[af][2];
          const d = dL*dL+da*da+db*db;
          if (d < bestD) { bestD = d; best = af; }
        }
        return best;
      });
    }
    // Apply overrides for display.
    for (const k in (currentCap.overrides || {})) stickerColors[k] = currentCap.overrides[k];
  }

  return (
    <div className="scan-overlay">
      <div className="scan-modal">
        <div className="scan-head">
          <div>
            <div className="scan-eyebrow">Face {capturedCount} / {SCAN_FACES.length} captured</div>
            <div className="scan-title">{current.label}</div>
          </div>
          <button className="tut-x" onClick={() => { stopStream(); onClose(); }}>×</button>
        </div>

        <div className="scan-viewport">
          <video ref={videoRef} playsInline muted autoPlay className="scan-video" />
          <ScanOverlay samples={liveSamples} />
          {permState === 'requesting' && (
            <div className="scan-msg">
              <div className="spinner"></div>
              <div>Requesting camera permission…</div>
            </div>
          )}
          {permState === 'denied' && (
            <div className="scan-msg error">
              <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Camera unavailable</div>
              <div className="muted small">{error || 'Permission denied'}</div>
              <button className="btn ghost" style={{ marginTop: 12 }}
                onClick={() => startStream(facing)}>Try again</button>
            </div>
          )}
        </div>

        <div className="scan-hint">{current.hint}</div>

        {/* Capture preview for current face */}
        {currentCap && stickerColors && (
          <div className="scan-preview">
            <div className="scan-preview-grid">
              {[0,1,2,3,4,5,6,7,8].map((i) => (
                <button key={i}
                  className={`scan-sw ${i === 4 ? 'center' : ''}`}
                  style={{ background: CubeEngine.COLORS[stickerColors[i]] }}
                  onClick={() => i !== 4 && cycleSticker(current.f, i)}
                  title={i === 4 ? 'Center (locked)' : `Detected as ${stickerColors[i]} — tap to cycle`}>
                  <span className="scan-sw-label">{stickerColors[i]}</span>
                </button>
              ))}
            </div>
            <div className="scan-preview-meta">
              <div className="muted small">Detected colors for this face. Tap any sticker to fix.</div>
              <button className="btn ghost" onClick={() => retake(current.f)}>↻ Retake</button>
            </div>
          </div>
        )}

        <div className="scan-actions">
          {hasSwitch && (
            <button className="btn ghost icon"
              onClick={() => setFacing(facing === 'environment' ? 'user' : 'environment')}
              title="Flip camera">⇄</button>
          )}
          <button className="btn ghost"
            onClick={() => setStepIdx((stepIdx + SCAN_FACES.length - 1) % SCAN_FACES.length)}>← Prev</button>
          <button className="btn primary big" onClick={captureCurrent}
            disabled={permState !== 'ready'}>
            {currentCap ? 'Re-capture' : 'Capture'}
          </button>
          <button className="btn ghost"
            onClick={() => setStepIdx((stepIdx + 1) % SCAN_FACES.length)}>Next →</button>
        </div>

        <div className="scan-thumbs">
          {SCAN_FACES.map((s, i) => {
            const cap = captures[s.f];
            return (
              <button key={s.f}
                className={`scan-thumb ${i === stepIdx ? 'active' : ''} ${cap ? 'filled' : ''}`}
                onClick={() => setStepIdx(i)}
                title={cap ? s.label : `${s.label} — not captured yet`}>
                <div className="scan-thumb-label">{s.f}</div>
                {cap ? (
                  <img src={cap.thumb} alt={s.label} />
                ) : (
                  <div className="scan-thumb-empty">+</div>
                )}
              </button>
            );
          })}
        </div>

        <div className="scan-foot">
          <div className="muted small">
            Move the cube so the yellow dots land on sticker centers. The dots fill with the color being detected — adjust until they match.
          </div>
          <button className="btn primary big"
            disabled={!allDone}
            onClick={apply}>
            Apply → Cube
          </button>
        </div>

        {error && allDone && (
          <div className="scan-error">{error}</div>
        )}
      </div>
    </div>
  );
}

// 3x3 grid overlay over the video. If samples provided, fill the dots.
function ScanOverlay({ samples }) {
  return (
    <svg className="scan-grid" viewBox="0 0 300 300" preserveAspectRatio="none">
      <rect x="42" y="42" width="216" height="216" fill="none"
        stroke="rgba(255,255,255,0.9)" strokeWidth="2" rx="6" />
      {[1, 2].map((i) => (
        <line key={`v${i}`} x1={42 + (216 * i) / 3} y1="42"
          x2={42 + (216 * i) / 3} y2="258"
          stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
      ))}
      {[1, 2].map((i) => (
        <line key={`h${i}`} x1="42" y1={42 + (216 * i) / 3}
          x2="258" y2={42 + (216 * i) / 3}
          stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" />
      ))}
      {[0,1,2].map((r) =>
        [0,1,2].map((c) => {
          const idx = r * 3 + c;
          const sample = samples && samples[idx];
          const fill = sample ? `rgb(${Math.round(sample.r)},${Math.round(sample.g)},${Math.round(sample.b)})` : 'rgba(255,213,0,0.85)';
          return (
            <g key={`${r}-${c}`}>
              <circle
                cx={42 + (216 / 3) * (c + 0.5)}
                cy={42 + (216 / 3) * (r + 0.5)}
                r="11"
                fill={fill}
                stroke="rgba(0,0,0,0.55)"
                strokeWidth="2.5" />
              <circle
                cx={42 + (216 / 3) * (c + 0.5)}
                cy={42 + (216 / 3) * (r + 0.5)}
                r="11" fill="none"
                stroke="rgba(255,255,255,0.9)" strokeWidth="1.2" />
            </g>
          );
        })
      )}
    </svg>
  );
}

window.CameraScanModal = CameraScanModal;
