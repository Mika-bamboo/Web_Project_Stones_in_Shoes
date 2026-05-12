// Act 3 — 3D scene per act3-3d-spec.md.
//
// Self-contained Three.js renderer mounted on #canvas3. Acts 1, 2, 4, 5, 6
// remain 2D Canvas; only Act 3 uses Three.js. The render loop is paused
// when the viewport is off-screen so the page stays responsive while
// scrolling through the rest of the article (spec §10).
//
// Build ladder from spec §8 — implemented incrementally. Currently
// completes step 2 (static parametric shoe). Subsequent steps wire the
// sliders, add the leg, animate the gait phase, spawn stones, and wire
// collar-gap collision.
//
// Coordinate convention:
//   +X = forward (toe direction), heel at −X
//   +Y = up
//   +Z = lateral side of the (right) foot
//   Origin = ankle base (on top of the sole, at the heel-to-arch hinge)
// All distances in centimeters, matching the spec's §12 reference table.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Spec §3 collar parameterization ─────────────────────────────────────
// Angle θ around the foot, with θ=0 at the HEEL (back) and θ=π at the TOE
// (front). cos(θ)=+1 at the back, sin(θ)=±1 on the sides — matching the
// spec's reference function exactly. (The spec text says "0° forward over
// toe" but its sample code labels cos(angle) as "+1 at back"; we go with
// the code, which is the unambiguous artifact.)
function collarHeightAt(angle, collarHeight, heelNotchWidth) {
  const back = Math.cos(angle);
  const side = Math.abs(Math.sin(angle));

  let h = collarHeight * (0.3 + 0.7 * side);
  if (back > 0) {
    h -= back * heelNotchWidth * collarHeight * 0.6;
  }
  return Math.max(h, 0.5);
}

// Sole footprint outline at angle θ. Tapered ellipse — wider at the
// midfoot (ball of the foot) than the heel. Returns { x, z } on the rim.
// θ=0 → heel (-X), θ=π → toe (+X).
function footprintAt(angle, footLength, footWidth) {
  // Heel at X = HEEL_BACK, toe at X = HEEL_BACK + footLength.
  // Origin (ankle) is positioned so the heel sits ~5cm behind it.
  const HEEL_BACK = -5;
  const ellCx = HEEL_BACK + footLength / 2;
  const hl = footLength / 2;
  const hw = footWidth / 2;
  const x = ellCx - hl * Math.cos(angle);

  // Width modulation: narrower at heel and tip, fuller across the midfoot.
  // sin(angle) ranges -1..1; |sin| peaks at the sides. Multiplying by a
  // mild (1 + 0.15·sin(angle)) tapers the ball of the foot slightly wider
  // than the heel — recognizable shoe silhouette without being asymmetric
  // enough to break left/right symmetry.
  const taper = 1 + 0.15 * Math.sin(angle);
  const z = hw * taper * Math.sin(angle);
  return { x, z };
}

// ── Shoe builder ────────────────────────────────────────────────────────
// Returns a Group containing the sole + upper meshes (and their black
// outline shells). All geometry is created fresh each call — cheap, and
// per spec §7 cleaner than mutating vertices in place.
function buildShoe(params) {
  const {
    footLength = 25,
    footWidth = 9,
    soleThickness = 1.5,
    collarHeight = 6,
    heelNotchWidth = 0.4,
    perimeterSamples = 32,
    bodyMaterial,
    outlineMaterial,
  } = params;

  const group = new THREE.Group();
  group.name = 'shoe';

  // ── 1. Sole ────────────────────────────────────────────────────────
  // ExtrudeGeometry from the footprint shape. Build the shape in XY
  // (Three.js Shape's native plane), then rotate so the footprint lies
  // in the world XZ plane with thickness along +Y.
  const shape = new THREE.Shape();
  for (let i = 0; i <= perimeterSamples; i++) {
    const θ = (i / perimeterSamples) * Math.PI * 2;
    const { x, z } = footprintAt(θ, footLength, footWidth);
    if (i === 0) shape.moveTo(x, z); else shape.lineTo(x, z);
  }

  const soleGeom = new THREE.ExtrudeGeometry(shape, {
    depth: soleThickness,
    bevelEnabled: false,
  });
  // Shape was authored in XY (Z = -depth..0 after extrusion). Rotate so
  // the footprint lies in XZ; then translate so the sole bottom is at
  // Y=0 and top (rim) is at Y=soleThickness.
  soleGeom.rotateX(-Math.PI / 2);
  soleGeom.translate(0, soleThickness, 0);

  const sole = new THREE.Mesh(soleGeom, bodyMaterial);
  sole.name = 'sole';
  group.add(sole);
  group.add(makeOutline(soleGeom, outlineMaterial));

  // ── 2. Upper (quarter + collar) ────────────────────────────────────
  // Vertical strip wrapping around the sole rim. Top edge = the collar
  // curve (height varies with angle per collarHeightAt). Bottom edge =
  // the rim at Y = soleThickness.
  const rimPts = [];
  const collarPts = [];
  for (let i = 0; i < perimeterSamples; i++) {
    const θ = (i / perimeterSamples) * Math.PI * 2;
    const { x, z } = footprintAt(θ, footLength, footWidth);
    const h = collarHeightAt(θ, collarHeight, heelNotchWidth);
    rimPts.push(new THREE.Vector3(x, soleThickness, z));
    collarPts.push(new THREE.Vector3(x, soleThickness + h, z));
  }

  const upperGeom = buildStripGeometry(rimPts, collarPts);

  const upper = new THREE.Mesh(upperGeom, bodyMaterial);
  upper.name = 'upper';
  group.add(upper);
  group.add(makeOutline(upperGeom, outlineMaterial));

  // Expose the live collar curve so future steps (collision detection)
  // can query the topline edge in world space.
  group.userData.collarCurve = collarPts;

  return group;
}

// Build a closed-strip BufferGeometry between two equal-length rings of
// points (bottom and top). DoubleSide — there's no inside surface to
// worry about for v1, and toon shading reads fine on either face.
function buildStripGeometry(bottomPts, topPts) {
  const n = bottomPts.length;
  const positions = new Float32Array(n * 2 * 3);
  const indices = [];

  for (let i = 0; i < n; i++) {
    positions[i * 6 + 0] = bottomPts[i].x;
    positions[i * 6 + 1] = bottomPts[i].y;
    positions[i * 6 + 2] = bottomPts[i].z;
    positions[i * 6 + 3] = topPts[i].x;
    positions[i * 6 + 4] = topPts[i].y;
    positions[i * 6 + 5] = topPts[i].z;
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = i * 2;       // bottom_i
    const b = i * 2 + 1;   // top_i
    const c = j * 2;       // bottom_j
    const d = j * 2 + 1;   // top_j
    indices.push(a, c, d);
    indices.push(a, d, b);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// Inverted-hull outline (spec §5). Renders the back faces of a slightly
// inflated copy in solid black; together with the toon-shaded front
// faces this reads as a line-art outline — same look as the 2D acts.
function makeOutline(geometry, outlineMaterial) {
  const outlineGeom = geometry.clone();
  // Inflate vertices along their normals. computeVertexNormals() was
  // already called in buildStripGeometry / by ExtrudeGeometry; for the
  // sole we rely on ExtrudeGeometry's own normals.
  if (!outlineGeom.attributes.normal) outlineGeom.computeVertexNormals();
  const pos = outlineGeom.attributes.position;
  const nor = outlineGeom.attributes.normal;
  const inflate = 0.18; // cm
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(
      i,
      pos.getX(i) + nor.getX(i) * inflate,
      pos.getY(i) + nor.getY(i) * inflate,
      pos.getZ(i) + nor.getZ(i) * inflate,
    );
  }
  pos.needsUpdate = true;
  return new THREE.Mesh(outlineGeom, outlineMaterial);
}

// ────────────────────────────────────────────────────────────────────────
// View factory
// ────────────────────────────────────────────────────────────────────────
export function createAct3View(opts) {
  const {
    canvasEl,
    viewportEl,
    collarHeightSlider = null,
    heelNotchSlider = null,
  } = opts;
  if (!canvasEl || !viewportEl) return;

  const renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();

  // 3/4 view from outside-front of the foot, looking back toward the
  // ankle. Spec §12 starting values; tuned to frame the shoe nicely.
  const camera = new THREE.PerspectiveCamera(35, 1, 1, 500);
  camera.position.set(45, 38, 50);
  const lookTarget = new THREE.Vector3(6, 6, 0);
  camera.lookAt(lookTarget);

  // Single directional light + soft ambient (spec §5: no shadows).
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(40, 80, 40);
  scene.add(keyLight);

  // Theme-aware background. Materials are theme-aware too — the toon
  // shoe is white in light mode, very light grey in dark mode so the
  // outlines still read against the dark page background.
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

  // ── Shoe — rebuilt live from the two sliders (spec §7) ──────────────
  // Materials are cached and reused; only the geometry is regenerated on
  // each rebuild, so there's no shader recompile and no flicker.
  // Slider mapping (range inputs default to 1..10 in index.html):
  //   collarHeight slider value → collar height in cm (1cm…10cm)
  //   heelNotch slider value    → heelNotchWidth (0..1, slider/10)
  function readSliderParams() {
    const ch = collarHeightSlider ? parseFloat(collarHeightSlider.value) : 6;
    const hn = heelNotchSlider ? parseFloat(heelNotchSlider.value) / 10 : 0.4;
    return { collarHeight: ch, heelNotchWidth: hn };
  }

  let shoe = null;
  function rebuildShoe() {
    if (shoe) {
      scene.remove(shoe);
      shoe.traverse((o) => o.geometry && o.geometry.dispose());
    }
    const { collarHeight, heelNotchWidth } = readSliderParams();
    shoe = buildShoe({
      collarHeight,
      heelNotchWidth,
      bodyMaterial,
      outlineMaterial,
    });
    scene.add(shoe);
  }
  rebuildShoe();

  if (collarHeightSlider) collarHeightSlider.addEventListener('input', rebuildShoe);
  if (heelNotchSlider)    heelNotchSlider.addEventListener('input', rebuildShoe);

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

  return { renderer, scene, camera, rebuildShoe };
}
