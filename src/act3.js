// Act 3 — 3D scene per act3-3d-spec.md.
//
// Static parametric shoe built as a lofted half-ellipse shell over a
// foot-shaped sole, per act3-shoe-shape-addendum.md. No sliders, no leg,
// no stones yet.
//
// Construction (addendum §1):
//   1. Footprint outline (top view)     → halfWidthAt(s)
//   2. Side silhouette (height profile) → heightAt(s)
//   3. Half-ellipse cross-section swept along the length → upper shell
//   4. Topline carve (the collar opening) → openingHalfWidthAt(s)
//   5. Sole slab extruded below the footprint.
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
const FOOT_LENGTH    = 25;          // length of the body (excl. caps)
const SOLE_THICKNESS = 1.5;
const COLLAR_HEIGHT  = 7.0;         // ankle peak height (future slider)
const HEEL_NOTCH     = 0.4;         // heel cup dip 0..1 (future slider)

const HEEL_BODY_X    = -5;
const TOE_BODY_X     = HEEL_BODY_X + FOOT_LENGTH;

// End-cap rounding. Heel cap is short so the heel notch curve stays
// visible from behind; toe cap is longer for a clean rounded toe box.
const HEEL_CAP_FRAC  = 0.06;
const TOE_CAP_FRAC   = 0.10;
const HEEL_CAP_REACH = 1.4;
const TOE_CAP_REACH  = 2.8;

const lerp = (a, b, t) => a * (1 - t) + b * t;

// ── Footprint: half-width along the length (addendum §2) ───────────────
// s ∈ [0,1]: 0 = heel-body, 1 = toe-body.
// Anatomy: heel-cup taper, arch dip at ~0.45, ball-of-foot bulge at
// ~0.78, narrowing toe. Without the ball bulge the silhouette reads as
// a wedge — that bulge is the signature foot-shape feature.
function halfWidthAt(s) {
  const baseline  = 3.8;
  const ballBulge =  Math.exp(-Math.pow((s - 0.78) * 3.6, 2)) * 1.5;
  const archDip   = -Math.exp(-Math.pow((s - 0.45) * 6.0, 2)) * 0.9;
  const heelTrim  = -Math.exp(-Math.pow((s - 0.00) * 4.5, 2)) * 0.6;
  const toeTrim   = -Math.exp(-Math.pow((s - 1.00) * 4.0, 2)) * 1.0;
  return baseline + ballBulge + archDip + heelTrim + toeTrim;
}

// ── Side silhouette: upper height along the length (addendum §3) ───────
// Returns the half-ellipse cross-section apex height above the sole top.
// Four anchors: heel cup (dipped by HEEL_NOTCH), ankle peak (the
// collar height), throat (where the laces start, dips down), toe box.
function heightAt(s) {
  const heelTop   = COLLAR_HEIGHT * (1 - HEEL_NOTCH * 0.5);
  const ankleTop  = COLLAR_HEIGHT;
  const throatTop = COLLAR_HEIGHT * 0.55;
  const toeTop    = 2.2;
  if (s < 0.20) return lerp(heelTop,   ankleTop,  s / 0.20);
  if (s < 0.50) return lerp(ankleTop,  throatTop, (s - 0.20) / 0.30);
  if (s < 0.90) return lerp(throatTop, toeTop,    (s - 0.50) / 0.40);
  return                 lerp(toeTop,  1.4,       (s - 0.90) / 0.10);
}

// ── Length sweep with rounded heel and toe caps ────────────────────────
// t ∈ [0,1] covers the FULL shoe (heel tip to toe tip). Within the body
// region, scale is 1 and `s` parameterizes the curves above. Within the
// cap regions, the cross-section is scaled to 0 along a quarter-circle
// in the XZ plane — that gives a 3D hemispherical rounding at each end.
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

// ── Topline carve: the collar opening (addendum §5) ────────────────────
// At each s along the body, skip the top portion of the cross-section
// so the shell has an oval opening up top. jNorm ∈ [0,1]: 0 = lateral
// rim, 0.5 = apex above foot, 1 = medial rim. The opening starts just
// forward of the heel (so the heel cup wall remains closed and visible
// from behind) and ends at the throat.
const OPENING_S_BACK   = 0.10;
const OPENING_S_FRONT  = 0.55;
const OPENING_MAX_HALF = 0.30;

function openingHalfWidthAt(s) {
  if (s <= OPENING_S_BACK || s >= OPENING_S_FRONT) return 0;
  const u = (s - OPENING_S_BACK) / (OPENING_S_FRONT - OPENING_S_BACK);
  // Sinusoidal taper, slightly biased back so the widest part of the
  // opening sits over the ankle rather than the throat.
  const profile = Math.sin(u * Math.PI) * (1 - 0.15 * u);
  return OPENING_MAX_HALF * profile;
}

function isInOpening(s, jNorm) {
  const halfWid = openingHalfWidthAt(s);
  return halfWid > 0.01 && Math.abs(jNorm - 0.5) < halfWid;
}

// ── Sole ────────────────────────────────────────────────────────────────
// ExtrudeGeometry of the footprint outline. The outline walks the
// perimeter using the same lengthCoords + halfWidthAt so the sole edge
// matches the upper exactly.
function buildSole(bodyMaterial, outlineMaterial) {
  const N = 96;
  const shape = new THREE.Shape();
  for (let i = 0; i <= N; i++) {
    // 0 → heel tip; lateral side forward to toe tip at u=0.5; medial
    // side back to heel tip at u=1.
    const u = i / N;
    const lateral = u < 0.5;
    const t = lateral ? (u * 2) : ((1 - u) * 2);
    const sign = lateral ? 1 : -1;
    const { x, scale, s } = lengthCoords(t);
    const z = sign * halfWidthAt(s) * scale;
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

// ── Shoe upper (lofted shell, addendum §4) ─────────────────────────────
// Sample nLength cross-sections along the length. Each cross-section is
// a half-ellipse parameterized by j ∈ [0, nCross]: a = j/nCross * π,
// y = sole_top + h*sin(a), z = w*cos(a). Adjacent cross-sections are
// connected with quads; quads inside the topline carve are skipped.
function buildShoeUpper(bodyMaterial, outlineMaterial) {
  const nLength = 56;
  const nCross  = 24;
  const stride  = nCross + 1;

  const positions = [];
  for (let i = 0; i <= nLength; i++) {
    const t = i / nLength;
    const { x, scale, s } = lengthCoords(t);
    const w = halfWidthAt(s) * scale;
    const h = heightAt(s)   * scale;
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
    const lc = lengthCoords(tCenter);
    // Only the body region carries the topline carve; the rounded cap
    // regions stay closed so the toe box and heel cup are solid.
    const canCarve = lc.scale === 1;
    for (let j = 0; j < nCross; j++) {
      const jNorm = (j + 0.5) / nCross;
      if (canCarve && isInOpening(lc.s, jNorm)) continue;

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
