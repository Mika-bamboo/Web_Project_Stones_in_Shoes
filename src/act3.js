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
import { GAIT, sampleAt } from 'gait';

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

// ── Spec §3 collar-gap breathing table ──────────────────────────────────
// 11 samples across one gait cycle, peaking around toe-off / mid-swing
// when the foot flexes most relative to the leg. Values 0..1, scaled to
// MAX_GAP cm at peak. Pedagogically exaggerated — see spec §3 final note.
const GAP_OPENING = [0.2, 0.1, 0.1, 0.2, 0.4, 0.7, 0.9, 0.8, 0.6, 0.4, 0.2];
const MAX_GAP = 1.2;

function gapOpeningAt(phase) {
  return sampleAt(GAP_OPENING, phase);
}

// ── Shoe: sole (built once) + upper (rebuilt per frame) ────────────────
// Per spec §7 the geometry is cheap to regenerate, but the sole truly
// doesn't change with sliders OR phase, so we build it once. The upper
// (quarter + collar curve) IS function of (collarHeight, heelNotchWidth,
// phase) and rebuilds each frame to animate the collar gap.
function buildSole(params) {
  const {
    footLength = 25,
    footWidth = 9,
    soleThickness = 1.5,
    perimeterSamples = 32,
    bodyMaterial,
    outlineMaterial,
  } = params;

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
  soleGeom.rotateX(-Math.PI / 2);
  soleGeom.translate(0, soleThickness, 0);

  const group = new THREE.Group();
  group.name = 'sole';
  group.add(new THREE.Mesh(soleGeom, bodyMaterial));
  group.add(makeOutline(soleGeom, outlineMaterial));
  return group;
}

function buildUpper(params) {
  const {
    footLength = 25,
    footWidth = 9,
    soleThickness = 1.5,
    collarHeight,
    heelNotchWidth,
    phase = 0,
    perimeterSamples = 32,
    bodyMaterial,
    outlineMaterial,
  } = params;

  const gap = gapOpeningAt(phase) * MAX_GAP;

  const rimPts = [];
  const collarPts = [];
  for (let i = 0; i < perimeterSamples; i++) {
    const θ = (i / perimeterSamples) * Math.PI * 2;
    const { x, z } = footprintAt(θ, footLength, footWidth);
    const h = collarHeightAt(θ, collarHeight, heelNotchWidth);
    rimPts.push(new THREE.Vector3(x, soleThickness, z));

    // Collar vertices push outward in XZ from the ankle's central axis
    // (X=0, Z=0) by `gap` cm — spec §3's "collar visibly breathes".
    // Effect is large at the back (heel) where the collar is close to
    // the ankle, naturally smaller at the toe where (x,z) is far from
    // origin. Skipping points right at the axis (r≈0) avoids div-by-zero.
    let cx = x, cz = z;
    const r = Math.hypot(x, z);
    if (r > 1e-3 && gap > 0) {
      const k = (r + gap) / r;
      cx = x * k;
      cz = z * k;
    }
    collarPts.push(new THREE.Vector3(cx, soleThickness + h, cz));
  }

  const upperGeom = buildStripGeometry(rimPts, collarPts);

  const group = new THREE.Group();
  group.name = 'upper';
  group.add(new THREE.Mesh(upperGeom, bodyMaterial));
  group.add(makeOutline(upperGeom, outlineMaterial));

  // Expose the live collar curve so step 7's collision detection can
  // query the current topline edge in world space.
  group.userData.collarCurve = collarPts;
  return group;
}

// Dispose every BufferGeometry under a Group, then clear children. The
// inverted-hull outline geometries are cloned per-build, so they need
// disposing too.
function disposeGroup(group) {
  group.traverse((o) => o.geometry && o.geometry.dispose());
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

// ── Leg builder + poser (spec §4) ───────────────────────────────────────
// Two cylinders + an implicit ankle joint, posed in the sagittal plane
// (Z=0). The gait curves from gait.js are reused verbatim — the spec
// is explicit about not re-deriving them.
//
// Convention: thigh/shank are unit cylinders authored along +Y. We pin
// the ankle in the shoe (`ankleAt`) and solve UPWARD: knee = ankle +
// (-shankDir)·shankLen, hip = knee + (-thighDir)·thighLen. This is the
// inverse of leg.js's solveLeg(): in Acts 1/2 the foot moves while the
// hip is the spine anchor; in Act 3 the foot is planted inside the shoe
// while the hip swings around it.
function buildLeg(params) {
  const {
    thighLen = 35,
    shankLen = 40,
    legRadius = 4,
    bodyMaterial,
    outlineMaterial,
  } = params;

  const group = new THREE.Group();
  group.name = 'leg';

  // Slight taper on the shank (thicker at knee, narrower at ankle); the
  // thigh is uniform for v1 — spec §9 calls thigh taper a nice-to-have.
  const thighGeom = new THREE.CylinderGeometry(legRadius, legRadius, thighLen, 16);
  const shankGeom = new THREE.CylinderGeometry(legRadius, legRadius * 0.7, shankLen, 16);

  const thigh = new THREE.Mesh(thighGeom, bodyMaterial);
  thigh.name = 'thigh';
  const shank = new THREE.Mesh(shankGeom, bodyMaterial);
  shank.name = 'shank';
  const thighOutline = makeOutline(thighGeom, outlineMaterial);
  const shankOutline = makeOutline(shankGeom, outlineMaterial);

  group.add(thigh, shank, thighOutline, shankOutline);

  return { group, thigh, shank, thighOutline, shankOutline, thighLen, shankLen };
}

// Pose the leg cylinders for a given gait phase, with the ankle pinned
// at `ankleAt` (a THREE.Vector3 in scene space).
function poseLeg(leg, phase, ankleAt) {
  const hipRad  = sampleAt(GAIT.hip,  phase) * Math.PI / 180;
  const kneeRad = sampleAt(GAIT.knee, phase) * Math.PI / 180;

  // In the sagittal plane (XY): a thigh at hipAngle=0 hangs straight down
  // (-Y), forward flex (+hipRad) tilts it toward +X. The shank's world
  // angle is thighAngle - kneeRad (knee folds the shank backward).
  const shankAngle = hipRad - kneeRad;

  // Shank direction is "downward" (ankle-from-knee). To go knee-from-ankle
  // we negate.
  const shankUp = new THREE.Vector3(-Math.sin(shankAngle),  Math.cos(shankAngle), 0);
  const thighUp = new THREE.Vector3(-Math.sin(hipRad),      Math.cos(hipRad),     0);

  const ankle = ankleAt.clone();
  const knee  = ankle.clone().add(shankUp.clone().multiplyScalar(leg.shankLen));
  const hip   = knee.clone().add(thighUp.clone().multiplyScalar(leg.thighLen));

  alignCylinder(leg.shank,        ankle, knee);
  alignCylinder(leg.shankOutline, ankle, knee);
  alignCylinder(leg.thigh,        knee,  hip);
  alignCylinder(leg.thighOutline, knee,  hip);
}

// Position+orient a unit-Y CylinderGeometry mesh so its bottom face lands
// at p1 and top face at p2.
const _Y_AXIS = new THREE.Vector3(0, 1, 0);
function alignCylinder(mesh, p1, p2) {
  const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
  mesh.position.copy(mid);
  const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
  mesh.quaternion.setFromUnitVectors(_Y_AXIS, dir);
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

  // ── Shoe (sole + animated upper) ────────────────────────────────────
  // Sole is built once — fixed footprint, independent of sliders/phase.
  // Upper rebuilds every frame: collar height responds to the two
  // sliders, and the collar curve breathes outward via gapOpeningAt(phase).
  // Slider mapping (range inputs default to 1..10 in index.html):
  //   collarHeight slider value → collar height in cm (1cm…10cm)
  //   heelNotch slider value    → heelNotchWidth (0..1, slider/10)
  function readSliderParams() {
    const ch = collarHeightSlider ? parseFloat(collarHeightSlider.value) : 6;
    const hn = heelNotchSlider ? parseFloat(heelNotchSlider.value) / 10 : 0.4;
    return { collarHeight: ch, heelNotchWidth: hn };
  }

  scene.add(buildSole({ bodyMaterial, outlineMaterial }));

  let upperGroup = null;
  function rebuildUpper(phase) {
    if (upperGroup) {
      scene.remove(upperGroup);
      disposeGroup(upperGroup);
    }
    const { collarHeight, heelNotchWidth } = readSliderParams();
    upperGroup = buildUpper({
      collarHeight,
      heelNotchWidth,
      phase,
      bodyMaterial,
      outlineMaterial,
    });
    scene.add(upperGroup);
  }

  // ── Leg (animated through the gait cycle in place) ──────────────────
  const ankleAt = new THREE.Vector3(0, 6.5, 0);
  const leg = buildLeg({ bodyMaterial, outlineMaterial });
  scene.add(leg.group);

  // Phase is shared between leg pose and collar gap. Cadence chosen
  // slower than a real walk (0.5 Hz = 2s per full cycle) so the user
  // can see the gap breathing clearly. This is pedagogical pacing, not
  // realistic — Act 1/2 already showed real walking speed.
  let currentPhase = 0;
  const PHASE_HZ = 0.5;

  // Initial pose so the first paint is consistent.
  rebuildUpper(currentPhase);
  poseLeg(leg, currentPhase, ankleAt);

  // Slider input restarts the upper rebuild immediately — no need to
  // wait for the next animation tick.
  function onSliderInput() { rebuildUpper(currentPhase); }
  if (collarHeightSlider) collarHeightSlider.addEventListener('input', onSliderInput);
  if (heelNotchSlider)    heelNotchSlider.addEventListener('input', onSliderInput);

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
  let lastTime = null;

  function frame(now) {
    rafId = requestAnimationFrame(frame);
    controls.update();

    if (lastTime !== null) {
      const dt = Math.min((now - lastTime) / 1000, 1 / 30);
      currentPhase = (currentPhase + dt * PHASE_HZ) % 1;
    }
    lastTime = now;

    rebuildUpper(currentPhase);
    poseLeg(leg, currentPhase, ankleAt);

    renderer.render(scene, camera);
  }
  function start() {
    if (running) return;
    running = true;
    lastTime = null; // skip the first dt after a pause
    rafId = requestAnimationFrame(frame);
  }
  function stop() {
    if (!running) return;
    running = false;
    if (rafId !== null) cancelAnimationFrame(rafId);
    rafId = null;
    lastTime = null;
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
