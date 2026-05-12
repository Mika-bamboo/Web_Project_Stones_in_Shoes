// Act 3 — 3D scene per act3-3d-spec.md, step-1 scaffold only.
//
// Self-contained Three.js renderer mounted on #canvas3. Acts 1, 2, 4, 5, 6
// remain 2D Canvas; only Act 3 uses Three.js. The render loop is paused
// when the viewport is off-screen so the page stays responsive while
// scrolling through the rest of the article (spec §10).
//
// This is the bare structure: empty scene, a single rotating test cube
// for visual confirmation that the renderer is alive, OrbitControls
// constrained per spec §5. No shoe, no leg, no stones yet — those land
// in subsequent steps once the structure here is verified.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export function createAct3View(opts) {
  const { canvasEl, viewportEl } = opts;
  if (!canvasEl || !viewportEl) return;

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();

  // 3/4 view of the scene origin. Distance chosen so a ~25cm shoe at
  // origin would frame nicely later; for the cube it just looks fine.
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 500);
  camera.position.set(45, 38, 50);
  const lookTarget = new THREE.Vector3(0, 5, 0);
  camera.lookAt(lookTarget);

  // Single directional light + soft ambient (spec §5: no shadows).
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(40, 80, 40);
  scene.add(keyLight);

  // Theme-aware background so the canvas blends with the page.
  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  function applyTheme() {
    scene.background = new THREE.Color(darkQuery.matches ? 0x111111 : 0xffffff);
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

  // ── Placeholder: a single test cube to confirm the renderer is alive.
  // Slowly rotates so it's obvious the render loop is running. Replaced
  // in step 2 with the parametric shoe.
  const testCube = new THREE.Mesh(
    new THREE.BoxGeometry(10, 10, 10),
    new THREE.MeshToonMaterial({ color: 0xffffff }),
  );
  testCube.position.copy(lookTarget);
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

  // ── Render loop, paused when off-screen (spec §10) ───────────────────
  let running = false;
  let rafId = null;

  function frame() {
    rafId = requestAnimationFrame(frame);
    controls.update();
    testCube.rotation.y += 0.01;
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
