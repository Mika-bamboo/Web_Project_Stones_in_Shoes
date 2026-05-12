// Act 3 — 3D scene per act3-3d-spec.md.
//
// Build ladder (spec §8 + addendum §9):
//   1. Empty scene + test cube         ← done
//   2. Footprint outline only          ← done
//   3. Sole slab                       ← CURRENT
//   4. Side silhouette curve
//   5. Closed-top lofted shell
//   6. Open the top via collarHeightAt
//   7. Hook up sliders
//   8. Static leg
//   9. Animate phase + gap breathing
//  10. 3D stones (scroll-triggered)
//  11. Collar-gap collision + counter
//
// Step 3 extrudes the step-2 footprint downward by SOLE_THICKNESS into a
// foot-shaped puck. The sole's bottom sits on the ground (y = 0); its
// top, at y = SOLE_THICKNESS, is where the upper attaches in later
// steps. Same `halfWidthAt` and `lengthCoords` as step 2 — the sole
// inherits the verified silhouette instead of redefining it.
//
// Coordinate convention:
//   +X = forward (toe), +Y = up, +Z = lateral side of the (right) foot.
//   Distances in centimeters (spec §12).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Foot geometry constants (spec §12) ──────────────────────────────────
const FOOT_LENGTH    = 25;
const SOLE_THICKNESS = 1.5;
const HEEL_BODY_X    = -8;
const TOE_BODY_X     = HEEL_BODY_X + FOOT_LENGTH;

const HEEL_CAP_FRAC  = 0.06;
const TOE_CAP_FRAC   = 0.10;
const HEEL_CAP_REACH = 1.4;
const TOE_CAP_REACH  = 2.8;

// ── Footprint half-width along the length (addendum §2) ────────────────
// Coefficients tuned against addendum §11:
//   max ≈ 5.05 cm @ s ≈ 0.72  (ball)
//   min in body ≈ 3.13 cm @ s ≈ 0.43  (arch)
//   heel tip ≈ 2.49 cm, toe tip ≈ 2.74 cm (both rounded)
function halfWidthAt(s) {
  const baseline  = 3.6;
  const ballBulge =  Math.exp(-Math.pow((s - 0.78) * 3.5, 2)) * 1.7;
  const heelCup   =  Math.exp(-Math.pow((s - 0.10) * 5.0, 2)) * 0.5;
  const archDip   = -Math.exp(-Math.pow((s - 0.45) * 8.0, 2)) * 0.9;
  const heelTaper = -Math.exp(-Math.pow((s - 0.00) * 8.0, 2)) * 1.5;
  const toeTaper  = -Math.exp(-Math.pow((s - 1.00) * 5.5, 2)) * 1.8;
  return baseline + ballBulge + heelCup + archDip + heelTaper + toeTaper;
}

// t ∈ [0, 1] across the FULL shoe length. The body region runs at
// scale = 1 with `s` parameterizing the curves; cap regions ride a
// quarter-circle so the cross-section closes smoothly at each tip.
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

// ── Sole (addendum §6) ──────────────────────────────────────────────────
// Build a closed 2D Shape tracing the footprint perimeter, then extrude
// vertically. Shape-Y stores the footprint's world-Z so that after
// rotateX(+π/2), the lateral side (positive Z) lands on world +Z. The
// translate puts the bottom of the slab at y = 0 (ground).
function buildSole(bodyMaterial, outlineMaterial) {
  const N = 128;
  const half = N / 2;
  const shape = new THREE.Shape();
  for (let i = 0; i <= half; i++) {
    const t = i / half;
    const { x, scale, s } = lengthCoords(t);
    const z = halfWidthAt(s) * scale;
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
  }
  for (let i = half - 1; i > 0; i--) {
    const t = i / half;
    const { x, scale, s } = lengthCoords(t);
    const z = -halfWidthAt(s) * scale;
    shape.lineTo(x, z);
  }

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: SOLE_THICKNESS,
    bevelEnabled: false,
  });
  geom.rotateX(Math.PI / 2);
  geom.translate(0, SOLE_THICKNESS, 0);

  const group = new THREE.Group();
  group.name = 'sole';
  group.add(new THREE.Mesh(geom, bodyMaterial));
  group.add(makeOutline(geom, outlineMaterial));
  return group;
}

// ── Inverted-hull outline (spec §5) ─────────────────────────────────────
function makeOutline(geometry, outlineMaterial) {
  const g = geometry.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const inflate = 0.10;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + nor.getX(i) * inflate,
      pos.getY(i) + nor.getY(i) * inflate,
      pos.getZ(i) + nor.getZ(i) * inflate,
    );
  }
  return new THREE.Mesh(g, outlineMaterial);
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

  const camera = new THREE.PerspectiveCamera(35, 1, 1, 500);
  camera.position.set(28, 22, 30);
  const lookTarget = new THREE.Vector3(4, 1, 0);
  camera.lookAt(lookTarget);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(20, 40, 20);
  scene.add(keyLight);

  // Theme-aware materials. Toon body + back-side hull outline so the
  // sole reads as flat-shaded line art (spec §5).
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const bodyMaterial = new THREE.MeshToonMaterial({
    color: 0xffffff,
    side: THREE.FrontSide,
  });
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0x1a1a1a,
    side: THREE.BackSide,
  });
  function applyTheme() {
    const dark = darkQuery.matches;
    scene.background = new THREE.Color(dark ? 0x111111 : 0xffffff);
    bodyMaterial.color.setHex(dark ? 0xdddddd : 0xffffff);
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

  scene.add(buildSole(bodyMaterial, outlineMaterial));

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
