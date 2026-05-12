// Act 3 — 3D scene per act3-3d-spec.md.
//
// Step-2 build (revision): static parametric shoe — sole + closed-dome
// upper with a rounded toe, rounded heel, and a carved-out collar
// opening on top. No sliders, no leg, no stones yet.
//
// Coordinate convention:
//   +X = forward (toe direction), heel at −X
//   +Y = up
//   +Z = lateral side of the (right) foot
//   Origin at the heel-arch hinge, on top of the sole.
// Distances in centimeters (spec §12).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Fixed dimensions ────────────────────────────────────────────────────
const HEEL_BACK = -5;
const FOOT_LENGTH = 25;
const FOOT_WIDTH = 9;
const SOLE_THICKNESS = 1.5;

// ── Foot/upper profile (along the BODY portion, excluding end caps) ────
// `s` ∈ [0, 1]: 0 = heel-end-of-body, 1 = toe-end-of-body.
// Cross-section is a half-ellipse: half-width = widthAt(s), height above
// sole = heightAt(s).
const WIDTH_KEYS = [
  [0.00, 3.4],   // heel
  [0.40, 4.5],   // ball (widest)
  [0.80, 3.6],
  [1.00, 2.4],   // narrows toward toe cap
];

const HEIGHT_KEYS = [
  [0.00, 6.2],   // heel counter rim
  [0.12, 8.4],   // ankle/throat back peak (highest point of the upper)
  [0.32, 6.2],   // throat front (dips before the vamp)
  [0.58, 5.4],   // vamp / instep
  [0.85, 3.8],
  [1.00, 2.8],   // toe-box rim height (before toe cap rounds it off)
];

function lerpKeys(keys, s) {
  if (s <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (s <= keys[i + 1][0]) {
      const t = (s - keys[i][0]) / (keys[i + 1][0] - keys[i][0]);
      return keys[i][1] * (1 - t) + keys[i + 1][1] * t;
    }
  }
  return keys[keys.length - 1][1];
}

const widthAt  = (s) => lerpKeys(WIDTH_KEYS,  s);
const heightAt = (s) => lerpKeys(HEIGHT_KEYS, s);

// ── End-cap rounding ────────────────────────────────────────────────────
// The length parameter t ∈ [0, 1] covers the entire shoe end-to-end:
//   t ∈ [0, HEEL_CAP_FRAC]:   rounded heel cap (cross-section grows from 0)
//   t ∈ [HEEL_CAP_FRAC, 1 − TOE_CAP_FRAC]:  the body (uses widthAt/heightAt)
//   t ∈ [1 − TOE_CAP_FRAC, 1]:  rounded toe cap (cross-section shrinks to 0)
// The caps trace a quarter-circle in the XZ plane so the X coordinate
// curves around back/forward instead of stopping flat. Result: rounded
// ends, no teardrop point, no backward-pointing cone.
const HEEL_CAP_FRAC = 0.10;
const TOE_CAP_FRAC  = 0.13;
const HEEL_CAP_REACH = 2.5; // how far back beyond HEEL_BACK the heel curves
const TOE_CAP_REACH  = 3.0; // how far forward beyond the body the toe curves

function lengthCoords(t) {
  if (t < HEEL_CAP_FRAC) {
    const a = (t / HEEL_CAP_FRAC) * (Math.PI / 2);
    return {
      x: HEEL_BACK - HEEL_CAP_REACH * Math.cos(a),
      scale: Math.sin(a),
      sCore: 0,
    };
  }
  if (t > 1 - TOE_CAP_FRAC) {
    const a = ((t - (1 - TOE_CAP_FRAC)) / TOE_CAP_FRAC) * (Math.PI / 2);
    return {
      x: HEEL_BACK + FOOT_LENGTH + TOE_CAP_REACH * Math.sin(a),
      scale: Math.cos(a),
      sCore: 1,
    };
  }
  const sCore = (t - HEEL_CAP_FRAC) / (1 - HEEL_CAP_FRAC - TOE_CAP_FRAC);
  return {
    x: HEEL_BACK + sCore * FOOT_LENGTH,
    scale: 1,
    sCore,
  };
}

// ── Collar opening (carved into the back-top of the upper) ──────────────
// The opening is an ellipse in (t, jNorm) space, where jNorm ∈ [0, 1] is
// the normalized cross-section index (0 = lateral rim, 0.5 = top of foot,
// 1 = medial rim). Centered behind the throat peak.
const COLLAR_T_BACK   = 0.13;
const COLLAR_T_FRONT  = 0.42;
const COLLAR_J_HALFWID = 0.20;

function isInCollarOpening(t, jNorm) {
  if (t < COLLAR_T_BACK || t > COLLAR_T_FRONT) return false;
  // Taper the opening width to a smooth oval — narrower at the very
  // back (heel notch) and at the throat front, widest in the middle.
  const tNorm = (t - COLLAR_T_BACK) / (COLLAR_T_FRONT - COLLAR_T_BACK);
  const taper = Math.sin(tNorm * Math.PI);
  const halfWid = COLLAR_J_HALFWID * taper;
  return Math.abs(jNorm - 0.5) < halfWid;
}

// ── Sole ────────────────────────────────────────────────────────────────
// ExtrudeGeometry of a 2D foot-shaped outline. The outline includes the
// rounded heel/toe end-caps so the sole matches the upper's footprint.
function buildSole(bodyMaterial, outlineMaterial) {
  const N = 64;
  const shape = new THREE.Shape();
  for (let i = 0; i <= N; i++) {
    // 0 → tip-of-heel (lateral side); 0.5 → tip-of-toe; 1 → tip-of-heel
    // (medial side). Walk the body forward along the lateral side, then
    // back along the medial side.
    const u = i / N;
    const lateral = u < 0.5;
    const t = lateral ? (u * 2) : ((1 - u) * 2);
    const sign = lateral ? 1 : -1;
    const { x, scale, sCore } = lengthCoords(t);
    const z = sign * widthAt(sCore) * scale;
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
  }

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: SOLE_THICKNESS,
    bevelEnabled: false,
  });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, SOLE_THICKNESS, 0);

  const group = new THREE.Group();
  group.name = 'sole';
  group.add(new THREE.Mesh(geom, bodyMaterial));
  group.add(makeOutline(geom, outlineMaterial));
  return group;
}

// ── Shoe upper ──────────────────────────────────────────────────────────
// Parametric grid (i along the length, j around the half-ellipse cross-
// section). Quads inside the collar opening are skipped, leaving a hole
// on top. Rounded toe + heel caps are part of the grid (no separate
// fan), so silhouette is smooth everywhere.
function buildShoeUpper(bodyMaterial, outlineMaterial) {
  const nLength = 40;
  const nCross  = 18;
  const stride  = nCross + 1;

  const positions = [];
  for (let i = 0; i <= nLength; i++) {
    const t = i / nLength;
    const { x, scale, sCore } = lengthCoords(t);
    const w = widthAt(sCore) * scale;
    const h = heightAt(sCore) * scale;
    for (let j = 0; j <= nCross; j++) {
      const a = (j / nCross) * Math.PI;
      const z = w * Math.cos(a);
      const y = SOLE_THICKNESS + h * Math.sin(a);
      positions.push(x, y, z);
    }
  }

  const indices = [];
  for (let i = 0; i < nLength; i++) {
    for (let j = 0; j < nCross; j++) {
      const tCenter = (i + 0.5) / nLength;
      const jNorm   = (j + 0.5) / nCross;
      if (isInCollarOpening(tCenter, jNorm)) continue;

      const v00 = i * stride + j;
      const v01 = v00 + 1;
      const v10 = (i + 1) * stride + j;
      const v11 = v10 + 1;
      // CCW from outside the dome (which is the visible side).
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

// ── Inverted-hull outline (spec §5) ─────────────────────────────────────
function makeOutline(geometry, outlineMaterial) {
  const g = geometry.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const inflate = 0.18;
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

  // 3/4 view from the front-lateral, slightly elevated. Spec §12 defaults.
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 500);
  camera.position.set(36, 28, 38);
  const lookTarget = new THREE.Vector3(5, 5, 0);
  camera.lookAt(lookTarget);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(40, 80, 40);
  scene.add(keyLight);

  // Theme-aware background + materials.
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const bodyMaterial = new THREE.MeshToonMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
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
  controls.minDistance = 25;
  controls.maxDistance = 140;
  controls.minPolarAngle = THREE.MathUtils.degToRad(15);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
  controls.target.copy(lookTarget);
  controls.update();

  scene.add(buildSole(bodyMaterial, outlineMaterial));
  scene.add(buildShoeUpper(bodyMaterial, outlineMaterial));

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
