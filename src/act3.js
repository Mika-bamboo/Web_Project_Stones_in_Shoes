// Act 3 — 3D scene per act3-3d-spec.md.
//
// Build ladder (spec §8 + addendum §9):
//   1. Empty scene + test cube         ← done
//   2. Footprint outline only          ← CURRENT
//   3. Sole slab
//   4. Side silhouette curve
//   5. Closed-top lofted shell
//   6. Open the top via collarHeightAt
//   7. Hook up sliders
//   8. Static leg
//   9. Animate phase + gap breathing
//  10. 3D stones (scroll-triggered)
//  11. Collar-gap collision + counter
//
// Step 2 renders just the footprint as a closed line at ground level
// (y = 0). The whole shoe build inherits this outline — the sole is
// extruded from it (step 3), and every cross-section of the upper is
// anchored on it (step 5). Getting it right here is the addendum's
// §11 prerequisite for everything later.
//
// Coordinate convention:
//   +X = forward (toe), +Y = up, +Z = lateral side of the (right) foot.
//   Origin sits roughly under the ankle/arch hinge.
//   Distances in centimeters (spec §12).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Foot geometry constants (spec §12) ──────────────────────────────────
const FOOT_LENGTH    = 25;       // body length (heel-body to toe-body)
const HEEL_BODY_X    = -8;       // X of the back-end of the body
const TOE_BODY_X     = HEEL_BODY_X + FOOT_LENGTH;

// Rounded end caps: the very heel and toe curl back along a quarter-arc
// in XZ so the outline is smooth at the tips instead of squared off. A
// shallow heel cap keeps the heel notch readable from behind in later
// steps; a longer toe cap shapes the toe box.
const HEEL_CAP_FRAC  = 0.06;
const TOE_CAP_FRAC   = 0.10;
const HEEL_CAP_REACH = 1.4;
const TOE_CAP_REACH  = 2.8;

// ── Footprint: half-width along the length (addendum §2) ───────────────
// s ∈ [0, 1]: 0 = heel-body, 1 = toe-body.
// Sum of Gaussian-shaped bumps tuned to satisfy the §11 sanity check:
//   - maximum near s = 0.75 (ball of foot)
//   - minimum between heel and toe near s = 0.45 (arch)
//   - rounded but nonzero half-width at both tips (~2 cm)
//   - heel narrower than ball, body wider than arch
function halfWidthAt(s) {
  const baseline  = 3.6;
  const ballBulge =  Math.exp(-Math.pow((s - 0.78) * 3.5, 2)) * 1.7;
  const heelCup   =  Math.exp(-Math.pow((s - 0.10) * 5.0, 2)) * 0.5;
  const archDip   = -Math.exp(-Math.pow((s - 0.45) * 8.0, 2)) * 0.9;
  const heelTaper = -Math.exp(-Math.pow((s - 0.00) * 8.0, 2)) * 1.5;
  const toeTaper  = -Math.exp(-Math.pow((s - 1.00) * 5.5, 2)) * 1.8;
  return baseline + ballBulge + heelCup + archDip + heelTaper + toeTaper;
}

// t ∈ [0, 1] covers the FULL shoe (heel tip to toe tip). Within the
// body, scale is 1 and `s` parameterizes the curves. Within the cap
// regions, scale rides a quarter-circle from 0 → 1 (or 1 → 0) so the
// cross-section closes smoothly at the tips.
function lengthCoords(t) {
  if (t < HEEL_CAP_FRAC) {
    const a = (t / HEEL_CAP_FRAC) * (Math.PI / 2);
    return {
      x: HEEL_BODY_X - HEEL_CAP_REACH * Math.cos(a),
      scale: Math.sin(a),
      s: 0,
    };
  }
  if (t > 1 - TOE_CAP_FRAC) {
    const a = ((t - (1 - TOE_CAP_FRAC)) / TOE_CAP_FRAC) * (Math.PI / 2);
    return {
      x: TOE_BODY_X + TOE_CAP_REACH * Math.sin(a),
      scale: Math.cos(a),
      s: 1,
    };
  }
  const s = (t - HEEL_CAP_FRAC) / (1 - HEEL_CAP_FRAC - TOE_CAP_FRAC);
  return {
    x: HEEL_BODY_X + s * FOOT_LENGTH,
    scale: 1,
    s,
  };
}

// Sample the perimeter as a closed line: walk the lateral side from
// heel tip to toe tip (z > 0), then the medial side back to heel tip
// (z < 0). LineLoop wraps the last vertex back to the first.
function buildFootprintOutline(material) {
  const N = 128;
  const half = N / 2;
  const positions = [];
  for (let i = 0; i <= half; i++) {
    const t = i / half;
    const { x, scale, s } = lengthCoords(t);
    positions.push(x, 0, halfWidthAt(s) * scale);
  }
  for (let i = half - 1; i > 0; i--) {
    const t = i / half;
    const { x, scale, s } = lengthCoords(t);
    positions.push(x, 0, -halfWidthAt(s) * scale);
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const loop = new THREE.LineLoop(geom, material);
  loop.name = 'footprintOutline';
  return loop;
}

// ────────────────────────────────────────────────────────────────────────
// View factory
// ────────────────────────────────────────────────────────────────────────
export function createAct3View(opts) {
  const { canvasEl, viewportEl } = opts;
  if (!canvasEl || !viewportEl) return;

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();

  // 3/4 view, slightly elevated. Framed wider than step 1's cube so
  // the full 25 cm outline fits comfortably in a 16:9 viewport.
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 500);
  camera.position.set(28, 22, 30);
  const lookTarget = new THREE.Vector3(4, 0, 0);
  camera.lookAt(lookTarget);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(20, 40, 20);
  scene.add(keyLight);

  // Theme-aware materials. The outline uses LineBasicMaterial because
  // the footprint at this step is a 1D curve, not a 2D surface — the
  // toon + inverted-hull pipeline from step 1 kicks in once we have
  // real meshes again (step 3 onward).
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const outlineMaterial = new THREE.LineBasicMaterial({ color: 0x1a1a1a });
  function applyTheme() {
    const dark = darkQuery.matches;
    scene.background = new THREE.Color(dark ? 0x111111 : 0xffffff);
    outlineMaterial.color.setHex(dark ? 0xe4e4e4 : 0x1a1a1a);
  }
  applyTheme();
  darkQuery.addEventListener('change', applyTheme);

  const controls = new OrbitControls(camera, canvasEl);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 15;
  controls.maxDistance = 120;
  controls.minPolarAngle = THREE.MathUtils.degToRad(15);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
  controls.target.copy(lookTarget);
  controls.update();

  scene.add(buildFootprintOutline(outlineMaterial));

  // ── Resize ──────────────────────────────────────────────────────────
  function resize() {
    const rect = viewportEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    renderer.setSize(rect.width, rect.height, false);
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
  }
  resize();
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(viewportEl);
  } else {
    window.addEventListener('resize', resize);
  }

  // ── Render loop, paused when off-screen (spec §10) ──────────────────
  let running = false;
  let rafId = null;
  function frame() {
    rafId = requestAnimationFrame(frame);
    controls.update();
    renderer.render(scene, camera);
  }
  function start() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    if (!running) return;
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
  }
  if (typeof IntersectionObserver !== 'undefined') {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) start(); else stop();
      }
    }, { threshold: 0.05 });
    io.observe(viewportEl);
  } else {
    start();
  }

  return { renderer, scene, camera };
}
