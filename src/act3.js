// Act 3 — 3D scene per act3-3d-spec.md.
//
// Self-contained Three.js renderer mounted on #canvas3. Acts 1, 2, 4, 5, 6
// remain 2D Canvas; only Act 3 uses Three.js. The render loop is paused
// when the viewport is off-screen so the page stays responsive while
// scrolling through the rest of the article (spec §10).
//
// Build ladder from spec §8 — implemented incrementally. This file currently
// completes step 1 (empty scene + test cube + OrbitControls). Subsequent
// steps replace the test cube with the parametric shoe, then add leg,
// phase animation, stones, and collision.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createAct3View(opts) {
  const { canvasEl, viewportEl } = opts;
  if (!canvasEl || !viewportEl) return;

  // ── Renderer / scene / camera ────────────────────────────────────────
  // Antialias on; pixel ratio capped at 2 per spec §11 risk table.
  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();

  // Camera: 3/4 view from outside the foot, ~80cm distance (spec §12).
  // FOV narrow enough that the shoe doesn't fish-eye.
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 500);
  // Spec defaults: 30° elevation, -20° azimuth, distance ~80cm.
  // In our coordinate convention (+Y up, +Z toward viewer), that maps to:
  const camDist = 80;
  const elev = THREE.MathUtils.degToRad(30);
  const azim = THREE.MathUtils.degToRad(-20);
  camera.position.set(
    camDist * Math.cos(elev) * Math.sin(azim),
    camDist * Math.sin(elev),
    camDist * Math.cos(elev) * Math.cos(azim),
  );
  camera.lookAt(0, 5, 0);

  // ── Lighting (spec §5: single directional + soft ambient, no shadows) ─
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(30, 60, 40);
  scene.add(keyLight);

  // ── Theme-aware background ───────────────────────────────────────────
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    const dark = darkQuery.matches;
    scene.background = new THREE.Color(dark ? 0x111111 : 0xffffff);
  }
  applyTheme();
  darkQuery.addEventListener('change', applyTheme);

  // ── OrbitControls (spec §5: constrain so user can't break the scene) ─
  const controls = new OrbitControls(camera, canvasEl);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 30;
  controls.maxDistance = 160;
  controls.minPolarAngle = THREE.MathUtils.degToRad(15);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(85); // never below ground
  controls.target.set(0, 5, 0);
  controls.update();

  // ── Step 1 placeholder: a single test cube ───────────────────────────
  // Will be replaced in step 2 with the parametric shoe.
  const testCube = new THREE.Mesh(
    new THREE.BoxGeometry(10, 10, 10),
    new THREE.MeshToonMaterial({ color: 0xffffff }),
  );
  testCube.position.set(0, 5, 0);
  scene.add(testCube);

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

  // ── Render loop, paused when viewport is off-screen (spec §10) ───────
  let running = false;
  let rafId = null;

  function frame() {
    rafId = requestAnimationFrame(frame);
    controls.update();
    // Step-1 visual: slowly rotate the test cube so it's obvious the
    // render loop is alive. Will be removed in step 2.
    testCube.rotation.y += 0.01;
    renderer.render(scene, camera);
  }

  function start() {
    if (running) return;
    running = true;
    frame();
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
