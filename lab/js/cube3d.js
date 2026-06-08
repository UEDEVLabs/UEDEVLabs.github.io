// 3D Rubik's cube renderer (Three.js). Exposes window.Cube3D with imperative methods:
//   const c = Cube3D.create(container, opts)
//   c.setState(stateStr)
//   c.animateMove(token, durationMs).then(...)
//   c.setPaintMode(bool), c.setHighlight(faceLabel|null)
//   c.onStickerClick = (idx) => { ... }
//   c.dispose()
// Internally maintains 27 cubie meshes; animations reparent the 9 affected cubies
// under a pivot, rotate, then snap back and repaint from new state.

(function (global) {
  'use strict';
  const THREE = global.THREE;
  const E = global.CubeEngine;

  // Guard: if Three.js failed to load, don't throw at parse time — leave
  // Cube3D undefined so the boot watchdog can surface a clean error instead.
  if (!THREE) {
    console.error('[cube3d] Three.js not available — 3D cube disabled.');
    return;
  }

  // ---- Tunables -----------------------------------------------------------
  const CUBIE = 1.0;          // cubie edge length
  const GAP = 0.06;           // visible gap between cubies
  const STICKER_INSET = 0.08; // how far sticker sits inside face
  const STICKER_SIZE = 0.86;  // sticker scale vs cubie face
  const STICKER_RADIUS = 0.14;// rounded-rect corner radius (as fraction of cubie)

  // Build a rounded-rect plane geometry for stickers.
  function roundedRectShape(w, h, r) {
    const s = new THREE.Shape();
    const x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y);
    s.lineTo(x + w - r, y);
    s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r);
    s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h);
    s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r);
    s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  const stickerGeom = new THREE.ShapeGeometry(
    roundedRectShape(CUBIE * STICKER_SIZE, CUBIE * STICKER_SIZE, CUBIE * STICKER_RADIUS),
    8
  );

  // Per-face quaternion that orients a sticker outward.
  function faceOrientation(face) {
    const q = new THREE.Quaternion();
    switch (face) {
      case 'U': q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2); break;
      case 'D': q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2); break;
      case 'F': /* default: facing +Z */ break;
      case 'B': q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI); break;
      case 'R': q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2); break;
      case 'L': q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2); break;
    }
    return q;
  }
  function faceNormal(face) {
    switch (face) {
      case 'U': return new THREE.Vector3(0, 1, 0);
      case 'D': return new THREE.Vector3(0, -1, 0);
      case 'F': return new THREE.Vector3(0, 0, 1);
      case 'B': return new THREE.Vector3(0, 0, -1);
      case 'R': return new THREE.Vector3(1, 0, 0);
      case 'L': return new THREE.Vector3(-1, 0, 0);
    }
  }

  // ---- Main factory -------------------------------------------------------
  function create(container, opts = {}) {
    const w = () => container.clientWidth;
    const h = () => container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(36, w() / h(), 0.1, 100);
    camera.position.set(5.2, 4.4, 6.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w(), h());
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.78));
    const key = new THREE.DirectionalLight(0xffffff, 0.85);
    key.position.set(5, 8, 6);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.32);
    fill.position.set(-5, -2, -4);
    scene.add(fill);

    // ---- Build cubies + stickers ------------------------------------------
    const cubeRoot = new THREE.Group();
    scene.add(cubeRoot);

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x101013 });
    const cubieGeom = new THREE.BoxGeometry(CUBIE - GAP, CUBIE - GAP, CUBIE - GAP);

    // Each cubie: { group, pos:[x,y,z], stickers:{face: {mesh, mat, idx}} }
    const cubies = [];
    // Sticker meshes indexed by sticker idx (0..53) for fast repaint + raycast.
    const stickerByIdx = new Array(54).fill(null);

    const stickerMats = {}; // cache MeshBasicMaterial by hex string
    function stickerMat(hex) {
      if (!stickerMats[hex]) {
        stickerMats[hex] = new THREE.MeshBasicMaterial({ color: hex });
      }
      return stickerMats[hex];
    }

    const offset = CUBIE; // cubie center spacing (since edge ≈ CUBIE)
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          const g = new THREE.Group();
          g.position.set(x * offset, y * offset, z * offset);
          const body = new THREE.Mesh(cubieGeom, bodyMat);
          g.add(body);

          const stickers = {};
          for (const face of E.outwardFaces(x, y, z)) {
            const idx = E.stickerIndex(face, x, y, z);
            const mat = stickerMat(E.COLORS.U).clone(); // placeholder; setState repaints
            const mesh = new THREE.Mesh(stickerGeom, mat);
            mesh.quaternion.copy(faceOrientation(face));
            const n = faceNormal(face);
            mesh.position.copy(n).multiplyScalar((CUBIE - GAP) / 2 + 0.004);
            mesh.userData = { stickerIdx: idx, face };
            g.add(mesh);
            stickers[face] = { mesh, mat, idx };
            stickerByIdx[idx] = mesh;
          }
          cubeRoot.add(g);
          cubies.push({ group: g, pos: [x, y, z], stickers });
        }
      }
    }

    // ---- Set / repaint state ----------------------------------------------
    let currentState = E.SOLVED;
    let highlightFace = null;
    let highlightPulse = 0;
    let highlightLayer = null; // {axis, val} when set, only stickers in that layer pulse

    function paint() {
      for (const c of cubies) {
        for (const face in c.stickers) {
          const s = c.stickers[face];
          const ch = currentState[s.idx];
          const hex = E.COLORS[ch] || '#444';
          s.mat.color.set(hex);
          s.mat.opacity = 1;
          s.mat.transparent = false;
        }
      }
    }

    function setState(str) {
      currentState = str;
      paint();
    }
    function getState() { return currentState; }

    // ---- Drag-orbit (lightweight, no OrbitControls dep) -------------------
    let yaw = -Math.PI * 0.18; // around y
    let pitch = Math.PI * 0.15; // around x (pos = tilt down)
    let radius = 8.8;
    function updateCamera() {
      const cx = radius * Math.cos(pitch) * Math.sin(yaw);
      const cz = radius * Math.cos(pitch) * Math.cos(yaw);
      const cy = radius * Math.sin(pitch);
      camera.position.set(cx, cy, cz);
      camera.lookAt(0, 0, 0);
    }
    updateCamera();

    let dragging = false;
    let dragMoved = false;
    let lastX = 0, lastY = 0;
    let downX = 0, downY = 0;
    let pinching = false;
    let pinchStartDist = 0;
    let pinchStartRadius = radius;

    function pinchDistance(touches) {
      const dx = touches[0].clientX - touches[1].clientX;
      const dy = touches[0].clientY - touches[1].clientY;
      return Math.hypot(dx, dy);
    }

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    function pickSticker(clientX, clientY) {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(ndc, camera);
      const meshes = stickerByIdx.filter(Boolean);
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length) return hits[0].object.userData.stickerIdx;
      return -1;
    }

    function onDown(e) {
      dragging = true;
      dragMoved = false;
      const p = e.touches ? e.touches[0] : e;
      downX = lastX = p.clientX;
      downY = lastY = p.clientY;
      renderer.domElement.style.cursor = 'grabbing';
    }
    function onMove(e) {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - lastX;
      const dy = p.clientY - lastY;
      lastX = p.clientX; lastY = p.clientY;
      if (Math.abs(p.clientX - downX) + Math.abs(p.clientY - downY) > 4) dragMoved = true;
      yaw -= dx * 0.008;
      pitch += dy * 0.008;
      pitch = Math.max(-Math.PI * 0.48, Math.min(Math.PI * 0.48, pitch));
      updateCamera();
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      renderer.domElement.style.cursor = 'grab';
      if (!dragMoved) {
        const p = e.changedTouches ? e.changedTouches[0] : e;
        const idx = pickSticker(p.clientX, p.clientY);
        if (idx >= 0 && handlers.onStickerClick) handlers.onStickerClick(idx);
      }
    }
    renderer.domElement.style.cursor = 'grab';
    renderer.domElement.addEventListener('mousedown', onDown);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    renderer.domElement.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pinching = true;
        dragging = false;
        pinchStartDist = pinchDistance(e.touches);
        pinchStartRadius = radius;
        e.preventDefault();
      } else {
        onDown(e);
      }
    }, { passive: false });
    window.addEventListener('touchmove', (e) => {
      if (pinching && e.touches.length === 2) {
        const d = pinchDistance(e.touches);
        const factor = pinchStartDist / d;
        radius = Math.max(5, Math.min(14, pinchStartRadius * factor));
        updateCamera();
        e.preventDefault();
      } else {
        onMove(e);
      }
    }, { passive: false });
    window.addEventListener('touchend', (e) => {
      if (pinching) {
        if (e.touches.length < 2) pinching = false;
        return;
      }
      onUp(e);
    });
    // Prevent page scroll on touch over the cube canvas.
    renderer.domElement.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

    // Zoom with wheel
    renderer.domElement.addEventListener('wheel', (e) => {
      e.preventDefault();
      radius *= 1 + e.deltaY * 0.001;
      radius = Math.max(5, Math.min(14, radius));
      updateCamera();
    }, { passive: false });

    // ---- Highlight (pulsing next-move layer) ------------------------------
    function setHighlight(token) {
      if (!token) { highlightFace = null; highlightLayer = null; return; }
      const m = E.parseMove(token);
      if (!m) { highlightFace = null; highlightLayer = null; return; }
      highlightFace = m.face;
      // axis/val for the layer
      switch (m.face) {
        case 'U': highlightLayer = { axis: 1, val: 1 }; break;
        case 'D': highlightLayer = { axis: 1, val: -1 }; break;
        case 'R': highlightLayer = { axis: 0, val: 1 }; break;
        case 'L': highlightLayer = { axis: 0, val: -1 }; break;
        case 'F': highlightLayer = { axis: 2, val: 1 }; break;
        case 'B': highlightLayer = { axis: 2, val: -1 }; break;
      }
    }

    // ---- Move direction arrow (real solve playback) ----------------------
    // A curved arrow that floats just off the moving face and shows which way
    // the layer turns for the current move. Built lazily, fully guarded.
    let arrowGroup = null;

    function clearMoveArrow() {
      if (arrowGroup) {
        cubeRoot.remove(arrowGroup);
        arrowGroup.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        });
        arrowGroup = null;
      }
    }

    function setMoveArrow(token) {
      try {
        clearMoveArrow();
        if (!token) return;
        const m = E.parseMove(token);
        if (!m) return;

        // Outward normal + clockwise-from-outside flag.
        const normals = {
          U: [0, 1, 0], D: [0, -1, 0],
          R: [1, 0, 0], L: [-1, 0, 0],
          F: [0, 0, 1], B: [0, 0, -1],
        };
        const n = new THREE.Vector3(...normals[m.face]);
        const cw = (m.dir !== -1); // dir +1 or 2 → clockwise; -1 → counter

        const g = new THREE.Group();

        const R = 1.05, tube = 0.075;
        const arc = Math.PI * 1.5;
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        // Arc body — torus around +Z (canonical), later oriented to normal.
        const torus = new THREE.Mesh(
          new THREE.TorusGeometry(R, tube, 10, 44, arc), mat
        );
        g.add(torus);

        // Cone tip. Canonical apex along +Y.
        const cone = new THREE.Mesh(
          new THREE.ConeGeometry(tube * 2.6, tube * 6, 16), mat
        );
        // CCW: tip at angle 1.5π → pos (0,-R,0), dir +x.
        // CW : tip at angle 0    → pos (R,0,0),  dir -y.
        let tipPos, tipDir;
        if (cw) {
          tipPos = new THREE.Vector3(R, 0, 0);
          tipDir = new THREE.Vector3(0, -1, 0);
        } else {
          tipPos = new THREE.Vector3(0, -R, 0);
          tipDir = new THREE.Vector3(1, 0, 0);
        }
        cone.position.copy(tipPos);
        cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tipDir);
        g.add(cone);

        // Orient whole arrow so its circle axis (+Z) points along the normal,
        // and float it just outside the face.
        g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
        g.position.copy(n).multiplyScalar(2.05);

        cubeRoot.add(g);
        arrowGroup = g;
      } catch (e) {
        // Never let arrow drawing break the app.
        console.warn('[cube3d] move arrow failed:', e && e.message);
      }
    }

    // Apply pulse glow to stickers on the highlight layer.
    function applyHighlight(dt) {
      highlightPulse += dt * 4.4;
      const k = (Math.sin(highlightPulse) + 1) * 0.5; // 0..1
      if (!highlightLayer) {
        // No target → just paint normally.
        for (const c of cubies) {
          for (const face in c.stickers) {
            const s = c.stickers[face];
            const ch = currentState[s.idx];
            s.mat.color.set(E.COLORS[ch] || '#444');
          }
        }
        return;
      }
      // Dim everything that is NOT on the target layer so the target pops.
      const dimAmt = 0.62; // how far non-target stickers fade toward dark
      const dark = new THREE.Color(0x0b0c0f);
      const white = new THREE.Color(0xffffff);
      for (const c of cubies) {
        const onLayer = c.pos[highlightLayer.axis] === highlightLayer.val;
        for (const face in c.stickers) {
          const s = c.stickers[face];
          const ch = currentState[s.idx];
          const base = new THREE.Color(E.COLORS[ch] || '#444');
          if (onLayer) {
            // Strong pulsing brighten toward white (0.30 → 0.85).
            base.lerp(white, 0.30 + 0.55 * k);
          } else {
            base.lerp(dark, dimAmt);
          }
          s.mat.color.copy(base);
        }
      }
    }

    // ---- Animate a move ---------------------------------------------------
    let animating = false;
    function animateMove(token, durationMs = 450) {
      if (animating) return Promise.resolve();
      const m = E.parseMove(token);
      if (!m) return Promise.resolve();
      animating = true;

      // Pick layer cubies
      let axis, val, sign;
      switch (m.face) {
        case 'U': axis = 1; val = 1;  sign = -1; break;
        case 'D': axis = 1; val = -1; sign = 1;  break;
        case 'R': axis = 0; val = 1;  sign = -1; break;
        case 'L': axis = 0; val = -1; sign = 1;  break;
        case 'F': axis = 2; val = 1;  sign = -1; break;
        case 'B': axis = 2; val = -1; sign = 1;  break;
      }
      const angle = (m.dir === 2 ? Math.PI : Math.PI / 2) * (m.dir === -1 ? -sign : sign);

      const pivot = new THREE.Group();
      cubeRoot.add(pivot);
      const moved = [];
      for (const c of cubies) {
        if (c.pos[axis] === val) {
          moved.push(c);
          pivot.add(c.group);
        }
      }

      const axisVec = new THREE.Vector3(axis === 0 ? 1 : 0, axis === 1 ? 1 : 0, axis === 2 ? 1 : 0);
      const start = performance.now();
      return new Promise((resolve) => {
        function tick(now) {
          const t = Math.min(1, (now - start) / durationMs);
          // ease-in-out cubic
          const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
          pivot.setRotationFromAxisAngle(axisVec, angle * e);
          if (t < 1) {
            requestAnimationFrame(tick);
          } else {
            // Commit: reparent cubies back, snap pivot, repaint from new state
            const newState = E.applyMove(currentState, token);
            for (const c of moved) {
              cubeRoot.add(c.group);
              c.group.position.set(c.pos[0] * offset, c.pos[1] * offset, c.pos[2] * offset);
              c.group.rotation.set(0, 0, 0);
              c.group.quaternion.identity();
            }
            cubeRoot.remove(pivot);
            currentState = newState;
            paint();
            animating = false;
            resolve();
          }
        }
        requestAnimationFrame(tick);
      });
    }

    // ---- Render loop -------------------------------------------------------
    let lastT = performance.now();
    function render() {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastT) / 1000);
      lastT = now;
      if (highlightLayer) applyHighlight(dt); else paint();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    }
    let raf = requestAnimationFrame(render);

    // ---- Resize -----------------------------------------------------------
    function resize() {
      renderer.setSize(w(), h());
      camera.aspect = w() / h();
      camera.updateProjectionMatrix();
    }
    const ro = new ResizeObserver(resize);
    ro.observe(container);
    // Also refit on window resize / orientation change (covers layout changes
    // that don't always trip the container observer, e.g. mobile tutorial sheet).
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    paint();

    const handlers = { onStickerClick: null };

    return {
      setState, getState, animateMove, setHighlight, setMoveArrow, resize,
      set onStickerClick(fn) { handlers.onStickerClick = fn; },
      get isAnimating() { return animating; },
      resetView() { yaw = -Math.PI * 0.18; pitch = Math.PI * 0.15; radius = 8.8; updateCamera(); },
      dispose() {
        clearMoveArrow();
        cancelAnimationFrame(raf);
        ro.disconnect();
        window.removeEventListener('resize', resize);
        window.removeEventListener('orientationchange', resize);
        renderer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      },
    };
  }

  global.Cube3D = { create };
})(window);
