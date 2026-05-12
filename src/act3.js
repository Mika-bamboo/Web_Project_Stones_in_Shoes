// Act 3 — 3D scene per act3-3d-spec.md.
//
// Build ladder (spec §8 + addendum §9):
//   1. Empty scene + test cube         ← CURRENT
//   2. Footprint outline only
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
// This file currently implements step 1 only: a viewport-sized renderer,
// theme-aware background, orbit camera with sensible constraints, an
// IntersectionObserver pause/resume, and a single test cube so sizing,
// theme, and controls are all visually verifiable before any shoe
// geometry is added. Toon material + inverted-hull outline are wired up
// here so later steps inherit the line-art style (spec §5).
//
// Coordinate convention (used from step 2 onward):
//   +X = forward (toe), +Y = up, +Z = lateral side of the (right) foot.
//   Distances in centimeters (spec §12).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Inverted-hull outline (spec §5) ─────────────────────────────────────
function makeOutline(geometry, outlineMaterial) {
  const g = geometry.clone();
  if (!g.attributes.normal) g.computeVertexNormals();
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const inflate = 0.08;
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

  // 3/4 view, slightly elevated. Spec §12 starting camera.
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 500);
  camera.position.set(18, 14, 20);
  const lookTarget = new THREE.Vector3(0, 2, 0);
  camera.lookAt(lookTarget);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.85);
  keyLight.position.set(20, 40, 20);
  scene.add(keyLight);

  // Theme-aware materials. Toon body + back-side black hull for the
  // line-art outline (spec §5). Re-applied on color-scheme change so
  // Act 3 follows the rest of the page.
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

  // Orbit controls. Constrain so the user can't go below the ground
  // plane or flip the camera upside-down (spec §5).
  const controls = new OrbitControls(camera, canvasEl);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 10;
  controls.maxDistance = 80;
  controls.minPolarAngle = THREE.MathUtils.degToRad(15);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(85);
  controls.target.copy(lookTarget);
  controls.update();

  // ── Step-1 test cube ────────────────────────────────────────────────
  // A 4 cm cube at the origin. Sits above the y=0 ground plane so the
  // line-art outline reads clearly against the page background. Will be
  // removed once step 2 (footprint outline) is in place.
  {
    const cubeGeom = new THREE.BoxGeometry(4, 4, 4);
    cubeGeom.translate(0, 2, 0);
    const cube = new THREE.Mesh(cubeGeom, bodyMaterial);
    cube.name = 'testCube';
    scene.add(cube);
    scene.add(makeOutline(cubeGeom, outlineMaterial));
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
