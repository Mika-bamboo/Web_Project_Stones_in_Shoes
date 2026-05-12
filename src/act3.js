// Act 3 — 3D scene per act3-3d-spec.md.
//
// Build ladder (spec §8 + addendum §9):
//   1. Empty scene + test cube         ← done
//   2. Footprint outline only          ← done
//   3. Sole slab                       ← done
//   4. Side silhouette curve           ← done
//   5. Closed-top lofted shell         ← done
//   6. Open the top via collarHeightAt ← done
//   7. Hook up sliders                 ← CURRENT
//   8. Static leg
//   9. Animate phase + gap breathing
//  10. 3D stones (scroll-triggered)
//  11. Collar-gap collision + counter
//
// Step 5 lofts half-ellipse cross-sections along the length with
// closed tops — the "moccasin" stage. Step 6 carves an oval opening on
// top so the foot can enter; the carve region runs from inside the
// heel cup back to the throat. End caps shrink the cross-section to a
// point at the tips so the heel and toe round in 3D.
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

// Step-7 sliders will drive these; spec §12 defaults for now.
const COLLAR_HEIGHT  = 6.0;
const HEEL_NOTCH     = 0.4;

const lerp = (a, b, t) => a * (1 - t) + b * t;

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

// ── Upper top-edge height along the length (addendum §3) ───────────────
// t ∈ [0, 1] across the full shoe (0 = heel tip, 1 = toe tip). Piecewise
// linear between four anatomical anchors:
//   heelTop  — heel cup, dipped from ankleTop by HEEL_NOTCH
//   ankleTop — collar peak  (≈ t = 0.15 per formula)
//   throatTop — laces dip   (≈ t = 0.40)
//   toeTop   — toe box rim  (≈ t = 0.85)
// Without these anchors the upper reads as a wedge instead of a shoe.
function upperHeightAlongLength(t, collarHeight = COLLAR_HEIGHT, heelNotch = HEEL_NOTCH) {
  const heelTop   = collarHeight * (1 - heelNotch * 0.5);
  const ankleTop  = collarHeight;
  const throatTop = collarHeight * 0.65;
  // Clamp the toe rim and tip so they stay below the ankle peak across
  // the full slider range. At collarHeight = 6 this matches the
  // addendum's 2.0 / 0.5 defaults; at low collars the toe scales down
  // proportionally so the silhouette doesn't invert.
  const toeTop    = Math.min(2.0, collarHeight * 0.35);
  const toeTipTop = Math.min(0.5, collarHeight * 0.10);
  if (t < 0.15) return lerp(heelTop,   ankleTop,  t / 0.15);
  if (t < 0.40) return lerp(ankleTop,  throatTop, (t - 0.15) / 0.25);
  if (t < 0.85) return lerp(throatTop, toeTop,    (t - 0.40) / 0.45);
  return              lerp(toeTop,    toeTipTop, (t - 0.85) / 0.15);
}

// ── Topline carve (addendum §5) ────────────────────────────────────────
// The collar opening is an oval in (t, jNorm) parameter space sitting
// on the apex of the half-ellipse loft. jNorm = 0 is the lateral rim,
// 0.5 is the cross-section apex over the foot, 1 is the medial rim.
// Quads inside this oval are skipped, leaving the topline as a hole on
// top of the shell.
//
// Range: extends back from inside the heel cup (so the cup wall stays
// visible from above) forward to the throat. The sinusoidal taper
// shapes the opening's perimeter into a smooth oval.
const OPENING_T_BACK   = 0.06;
const OPENING_T_FRONT  = 0.55;
const OPENING_MAX_HALF = 0.32;

function openingHalfWidthAt(t) {
  if (t <= OPENING_T_BACK || t >= OPENING_T_FRONT) return 0;
  const u = (t - OPENING_T_BACK) / (OPENING_T_FRONT - OPENING_T_BACK);
  // Slight back-bias: widest near the ankle (~25% along the opening),
  // narrowing into the throat.
  const profile = Math.sin(u * Math.PI) * (1 - 0.18 * u);
  return OPENING_MAX_HALF * profile;
}

function isInOpening(t, jNorm) {
  const halfWid = openingHalfWidthAt(t);
  return halfWid > 0.01 && Math.abs(jNorm - 0.5) < halfWid;
}

// ── Shoe upper (addendum §4 + §5) ──────────────────────────────────────
// Sample nLength cross-sections along the length. Each cross-section
// is a half-ellipse at apex height upperHeightAlongLength(t), width
// halfWidthAt(s), both scaled to 0 at the tips so the heel and toe
// round in 3D. Adjacent cross-sections form quads; quads inside the
// topline carve are skipped, leaving the foot opening.
function buildShoeUpper(bodyMaterial, outlineMaterial, collarHeight, heelNotch) {
  const nLength = 60;
  const nCross  = 24;
  const stride  = nCross + 1;

  const positions = [];
  for (let i = 0; i <= nLength; i++) {
    const t = i / nLength;
    const { x, scale, s } = lengthCoords(t);
    const w = halfWidthAt(s) * scale;
    const h = upperHeightAlongLength(t, collarHeight, heelNotch) * scale;
    for (let j = 0; j <= nCross; j++) {
      const a = (j / nCross) * Math.PI;
      const z = w * Math.cos(a);
      const y = SOLE_THICKNESS + h * Math.sin(a);
      positions.push(x, y, z);
    }
  }

  const indices = [];
  for (let i = 0; i < nLength; i++) {
    const tCenter = (i + 0.5) / nLength;
    const inBody = lengthCoords(tCenter).scale === 1;
    for (let j = 0; j < nCross; j++) {
      const jNorm = (j + 0.5) / nCross;
      // Only carve within the body; rounded heel + toe caps stay closed
      // so the heel cup and toe box are solid.
      if (inBody && isInOpening(tCenter, jNorm)) continue;

      const v00 = i * stride + j;
      const v01 = v00 + 1;
      const v10 = (i + 1) * stride + j;
      const v11 = v10 + 1;
      // CCW from outside the shell.
      indices.push(v00, v10, v11);
      indices.push(v00, v11, v01);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();

  const group = new THREE.Group();
  group.name = 'shoeUpper';
  group.add(new THREE.Mesh(geom, bodyMaterial));
  group.add(makeOutline(geom, outlineMaterial));
  return group;
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
  const { canvasEl, viewportEl, collarHeightSlider, heelNotchSlider } = opts;
  if (!canvasEl || !viewportEl) return;

  // Slider → parameter mappings (spec §12: collarHeight 3–10 cm,
  // heelNotch 0–1). Sliders run 1–10 in the HTML; collarHeight maps
  // directly to cm, heelNotch divides by 10 to land in [0.1, 1.0].
  function readCollarHeight() {
    return collarHeightSlider
      ? parseFloat(collarHeightSlider.value)
      : COLLAR_HEIGHT;
  }
  function readHeelNotch() {
    return heelNotchSlider
      ? parseFloat(heelNotchSlider.value) / 10
      : HEEL_NOTCH;
  }

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(35, 1, 1, 500);
  camera.position.set(28, 22, 30);
  const lookTarget = new THREE.Vector3(4, 3, 0);
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

  // Upper rebuilds whenever a slider changes (spec §7). The geometry is
  // small enough that full rebuild is cheaper than vertex mutation.
  let upperGroup = buildShoeUpper(
    bodyMaterial, outlineMaterial,
    readCollarHeight(), readHeelNotch(),
  );
  scene.add(upperGroup);

  function rebuildUpper() {
    scene.remove(upperGroup);
    upperGroup.traverse((obj) => {
      if (obj.isMesh && obj.geometry) obj.geometry.dispose();
    });
    upperGroup = buildShoeUpper(
      bodyMaterial, outlineMaterial,
      readCollarHeight(), readHeelNotch(),
    );
    scene.add(upperGroup);
  }

  // Slider readouts: show the live numeric value next to each slider so
  // users see cause and effect. The .val span next to each <input> is
  // already wired by index.html; we just overwrite its text.
  function valSpanFor(slider) {
    if (!slider) return null;
    return document.querySelector(`.val[data-for="${slider.id}"]`);
  }
  if (collarHeightSlider) {
    const span = valSpanFor(collarHeightSlider);
    const onInput = () => {
      if (span) span.textContent = `${readCollarHeight().toFixed(0)} cm`;
      rebuildUpper();
    };
    collarHeightSlider.addEventListener('input', onInput);
    onInput();
  }
  if (heelNotchSlider) {
    const span = valSpanFor(heelNotchSlider);
    const onInput = () => {
      if (span) span.textContent = readHeelNotch().toFixed(1);
      rebuildUpper();
    };
    heelNotchSlider.addEventListener('input', onInput);
    onInput();
  }

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
