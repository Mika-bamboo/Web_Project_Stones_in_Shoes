// Act 3 — 3D scene per act3-3d-spec.md.
//
// Step-2 build: empty Three.js scene + a static parametric shoe (sole
// slab + closed-dome upper). No sliders, no leg, no stones, no collar
// opening yet — those land in subsequent steps. Goal at this rung is
// "looks like a shoe from a 3/4 angle. Ugly is fine; recognizable is
// required" (spec §8 step 2).
//
// Coordinate convention:
//   +X = forward (toe direction), heel at −X
//   +Y = up
//   +Z = lateral side of the (right) foot
//   Origin at the heel-arch hinge, on top of the sole.
// All distances in centimeters (spec §12).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Foot profile ────────────────────────────────────────────────────────
// `s` is fractional position along the foot length: 0 = heel, 1 = toe.
// `widthAt(s)` is the half-width of the footprint at that station.
// `heightAt(s)` is the height of the shoe-upper dome above the sole at
// that station. Both are sampled-then-linearly-interpolated keyframes —
// gives a foot-like silhouette without resorting to nonlinear fits.

const HEEL_BACK = -5;        // x-coordinate of the back-of-heel
const FOOT_LENGTH = 25;
const FOOT_WIDTH = 9;
const SOLE_THICKNESS = 1.5;

const WIDTH_KEYS = [
  [0.00, 3.4],   // heel cap (slightly narrower than the ball)
  [0.40, 4.5],   // ball of the foot (widest)
  [0.80, 3.4],
  [1.00, 0.3],   // toe tip (nearly collapses to a point)
];

const HEIGHT_KEYS = [
  [0.00, 6.5],   // heel counter rim
  [0.18, 9.5],   // ankle / throat peak (highest point of the upper)
  [0.42, 7.5],   // instep
  [0.72, 5.0],   // forefoot
  [1.00, 0.0],   // toe tip (collapses)
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

// ── Sole ────────────────────────────────────────────────────────────────
// ExtrudeGeometry of the 2D footprint outline, with thickness along +Y.
// The outline is sampled from widthAt() so the sole rim matches the
// shoe-upper rim exactly — no floating gaps where the two meet.
function buildSole(bodyMaterial, outlineMaterial) {
  const N = 48;
  const shape = new THREE.Shape();
  for (let i = 0; i <= N; i++) {
    // Travel: 0 = back-of-heel, 0.5 = toe tip via lateral side,
    // 1 = back-of-heel via medial side.
    const t = i / N;
    const lateral = t < 0.5;
    const s = lateral ? (t * 2) : ((1 - t) * 2);
    const sign = lateral ? 1 : -1;
    const x = HEEL_BACK + s * FOOT_LENGTH;
    const z = sign * widthAt(s);
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
  }

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: SOLE_THICKNESS,
    bevelEnabled: false,
  });
  // Authored in XY, then rotated so the footprint lies in XZ and the
  // sole top sits at Y = SOLE_THICKNESS.
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, SOLE_THICKNESS, 0);

  const group = new THREE.Group();
  group.name = 'sole';
  group.add(new THREE.Mesh(geom, bodyMaterial));
  group.add(makeOutline(geom, outlineMaterial));
  return group;
}

// ── Shoe upper ──────────────────────────────────────────────────────────
// Closed dome surface over the foot. Parametric grid (i, j) where i is
// along the foot length (heel→toe) and j sweeps the half-ellipse cross-
// section from the lateral rim (j=0), over the top of the foot, to the
// medial rim (j=nCross). A single-vertex heel cap closes the back; the
// toe collapses to a point because heightAt(1)=0, widthAt(1)≈0.
function buildShoeUpper(bodyMaterial, outlineMaterial) {
  const nLength = 28;
  const nCross  = 14;

  const positions = [];
  for (let i = 0; i <= nLength; i++) {
    const s = i / nLength;
    const x = HEEL_BACK + s * FOOT_LENGTH;
    const w = widthAt(s);
    const h = heightAt(s);
    for (let j = 0; j <= nCross; j++) {
      const a = (j / nCross) * Math.PI;       // 0 = lateral, π = medial
      const z = w * Math.cos(a);
      const y = SOLE_THICKNESS + h * Math.sin(a);
      positions.push(x, y, z);
    }
  }

  const indices = [];
  const stride = nCross + 1;
  for (let i = 0; i < nLength; i++) {
    for (let j = 0; j < nCross; j++) {
      const v00 = i * stride + j;
      const v01 = v00 + 1;
      const v10 = (i + 1) * stride + j;
      const v11 = v10 + 1;
      // Outward (lateral, top) is the visible side; wind CCW from there.
      indices.push(v00, v10, v11);
      indices.push(v00, v11, v01);
    }
  }

  // Heel cap: fan from a centroid vertex to the i=0 cross-section ring.
  // Without this the back of the shoe is open.
  const heelCenterIdx = positions.length / 3;
  positions.push(HEEL_BACK - 0.4, SOLE_THICKNESS + heightAt(0) * 0.45, 0);
  for (let j = 0; j < nCross; j++) {
    // Viewed from behind the heel (-X), CCW order goes j → j+1 → center.
    indices.push(j + 1, j, heelCenterIdx);
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
// Renders a slightly-inflated back-face-only clone in solid black, which
// reads as a line-art outline at silhouette edges. Same look as Acts 1/2.
function makeOutline(geometry, outlineMaterial) {
  const g = geometry.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const inflate = 0.18; // cm
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

  // 3/4 view from the front-lateral of the foot, looking back at the
  // throat/ankle area where the action will be in later steps.
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 500);
  camera.position.set(42, 30, 42);
  const lookTarget = new THREE.Vector3(6, 4, 0);
  camera.lookAt(lookTarget);

  // Single directional light + soft ambient (spec §5: no shadows).
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(40, 80, 40);
  scene.add(keyLight);

  // Theme-aware background. Toon body material is white in light mode,
  // light grey in dark mode so the outlines still read against the page.
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

  // OrbitControls — constrained per spec §5/§11.
  const controls = new OrbitControls(camera, canvasEl);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 160;
  controls.minPolarAngle = THREE.MathUtils.degToRad(15);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
  controls.target.copy(lookTarget);
  controls.update();

  // ── Static shoe (hardcoded params) ──────────────────────────────────
  scene.add(buildSole(bodyMaterial, outlineMaterial));
  scene.add(buildShoeUpper(bodyMaterial, outlineMaterial));

  // ── Resize handling ──────────────────────────────────────────────────
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

  // ── Render loop, paused when off-screen (spec §10) ───────────────────
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
