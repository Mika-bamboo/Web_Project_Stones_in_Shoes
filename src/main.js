// Frame loop for the gait animation, wiring walker + stones + renderer
// per gait-model-spec.md §7 build order.
//
// Exposed as a reusable factory `createGaitView(opts)` so each act that
// needs a walking figure can mount its own independent instance with
// per-act framing, controls, and overlays. Act 1 and Act 2 are wired at
// the bottom of this file.
//
// Imports are bare specifiers resolved by the `<script type="importmap">`
// block in index.html. Cache-busting `?v=N` lives there — do not add a
// suffix here or it'll bypass the importmap.
import { Walker } from 'walker';
import { StoneSystem } from 'stones';
import { drawLeg, drawGround, drawStones, drawStoneTrails, buildSneakerProfile, SOLE_DEPTH } from 'renderer';

// Dark-mode detection (shared across all views).
let darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  darkMode = e.matches;
});

// ── View factory ────────────────────────────────────────────────────
//
// One `createGaitView(opts)` call = one canvas running its own walker +
// stone system on its own rAF loop. Views are fully independent: Act 1's
// counter doesn't affect Act 2, and vice versa.
//
// Framing — below-waist zoom-and-crop — is a render-time transform only.
// Walker and stones stay in their world coordinates; the transform maps
// world (walker.pelvisX, walker.groundY) to screen (W/2, H * groundScreenY).
// Higher zoom = closer crop on the feet; smaller groundScreenY = more
// headroom above the ground.
//
// Options:
//   canvasEl, viewportEl   — required DOM handles
//   zoom, groundScreenY    — framing
//   showTrails             — dotted parabolic arcs behind flying stones
//   stoneCountEl           — optional element whose textContent tracks
//                            trapped-stone count
//   restartBtn             — optional button that resets the view
//   debugOverlay           — draws phase / worldX / stone counts corner
//                            text (Act 1 uses this as a version marker)
//   speedSlider            — optional <input type="range"> driving
//                            walker.cadence (value 1–10 → 0.2–2.0 Hz)
//   stoneSizeSlider        — optional <input type="range"> driving stone
//                            radius range (value 2–8 mm)
//   shoeProfileFn          — optional () => points[] callback invoked
//                            each frame; lets Act 3 regenerate the shoe
//                            outline live from collar-height / heel-notch
//                            sliders without rebuilding the view
function createGaitView(opts) {
  const {
    canvasEl,
    viewportEl,
    zoom = 1.7,
    groundScreenY = 0.85,
    showTrails = false,
    stoneCountEl = null,
    restartBtn = null,
    debugOverlay = false,
    speedSlider = null,
    stoneSizeSlider = null,
    shoeProfileFn = null,
  } = opts;

  if (!canvasEl || !viewportEl) return;

  const ctx = canvasEl.getContext('2d');
  let lastShownTrappedCount = -1;

  let walker = null;
  let stones = null;
  let lastTime = null;

  function resetView() {
    walker = null;
    stones = null;
    lastTime = null;
    lastShownTrappedCount = -1;
    if (stoneCountEl) stoneCountEl.textContent = '0';
  }

  if (restartBtn) {
    restartBtn.addEventListener('click', resetView);
  }

  // Retina-aware sizing. Also re-anchors the walker's ground line to the
  // current viewport height — without this, resizing the window after
  // walker initialization leaves groundY frozen at the old height, and
  // the shoe either floats above or sinks below the drawn ground line.
  function resize() {
    const rect = viewportEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const targetW = rect.width  * dpr;
    const targetH = rect.height * dpr;
    if (canvasEl.width !== targetW || canvasEl.height !== targetH) {
      canvasEl.width  = targetW;
      canvasEl.height = targetH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    if (walker) {
      const newGroundY = rect.height * 0.78;
      if (newGroundY !== walker.groundY) {
        // Static stones are frozen at (groundY − r) from when they spawned,
        // so shift them by the same delta to keep them on the ground.
        // Flying stones will self-correct on their next landing; in-shoe
        // stones are pinned to the foot and re-projected each frame.
        const dy = newGroundY - walker.groundY;
        walker.groundY = newGroundY;
        if (stones) {
          for (const s of stones.stones) {
            if (s.state === 'static') s.y += dy;
          }
        }
      }
    }
  }

  // Slider-driven parameters.
  // Speed: slider 1–10 maps to cadence 0.2–2.0 Hz (default slider 5 = 1.0).
  function applySpeed() {
    if (!walker || !speedSlider) return;
    const v = parseFloat(speedSlider.value);
    walker.cadence = v * 0.2;
  }
  // Stone size: slider 2–8 (mm) maps to radius range. At slider=4 we
  // recover the default (min=3, max=6). Larger values produce bigger
  // (heavier) stones that won't arc as high — which is the key insight
  // of Act 2 when paired with the speed slider.
  function applyStoneSize() {
    if (!stones || !stoneSizeSlider) return;
    const v = parseFloat(stoneSizeSlider.value);
    stones.minR = v * 0.75;
    stones.maxR = v * 1.5;
  }
  if (speedSlider) {
    speedSlider.addEventListener('input', applySpeed);
  }
  if (stoneSizeSlider) {
    stoneSizeSlider.addEventListener('input', applyStoneSize);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    resize();

    const W = canvasEl.width  / (window.devicePixelRatio || 1);
    const H = canvasEl.height / (window.devicePixelRatio || 1);
    if (W === 0 || H === 0) return;

    // One-time initialization on the first valid frame.
    if (!walker) {
      const groundY = H * 0.78;
      walker = new Walker(groundY);
      stones = new StoneSystem();
      lastTime = now;
      // Apply initial slider state if wired.
      applySpeed();
      applyStoneSize();
      return;
    }

    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;

    walker.update(dt);
    stones.update(walker, dt);

    if (stoneCountEl && stones.trappedCount !== lastShownTrappedCount) {
      stoneCountEl.textContent = String(stones.trappedCount);
      lastShownTrappedCount = stones.trappedCount;
    }

    // Clear + background (screen space, no zoom).
    ctx.clearRect(0, 0, W, H);
    const bg = darkMode ? '#111111' : '#ffffff';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const stroke = darkMode ? '#e4e4e4' : '#1a1a1a';
    ctx.strokeStyle = stroke;
    ctx.fillStyle   = stroke;

    // ─── Enter zoomed world transform ────────────────────────────────
    ctx.save();
    const tx = W / 2 - zoom * walker.pelvisX;
    const ty = H * groundScreenY - zoom * walker.groundY;
    ctx.translate(tx, ty);
    ctx.scale(zoom, zoom);

    drawGround(ctx, walker.groundY, walker.worldX, W);

    const trouserFill = darkMode ? '#191919' : '#f4f4f4';
    const rightFlash = walker.getShoeFlashIntensity('right');
    const leftFlash  = walker.getShoeFlashIntensity('left');
    const rightPhase = walker.phase;
    const leftPhase  = (walker.phase + 0.5) % 1;
    const shoeProfile = shoeProfileFn ? shoeProfileFn() : null;
    drawLeg(ctx, walker.leftLeg,  leftFlash,  trouserFill, leftPhase,  shoeProfile);
    drawLeg(ctx, walker.rightLeg, rightFlash, trouserFill, rightPhase, shoeProfile);

    // Stones drawn AFTER legs. Trails first (behind stones), then stones.
    ctx.save();
    ctx.translate(walker.pelvisX - walker.worldX, 0);
    if (showTrails) drawStoneTrails(ctx, stones.stones);
    drawStones(ctx, stones.stones);
    ctx.restore();

    ctx.restore();
    // ─── Exit zoomed world transform ────────────────────────────────

    if (debugOverlay) {
      ctx.save();
      ctx.font = '12px monospace';
      ctx.globalAlpha = 0.3;
      ctx.textAlign = 'left';
      ctx.fillText(
        `phase: ${walker.phase.toFixed(2)}  worldX: ${walker.worldX.toFixed(0)}  stones: ${stones.stones.length}  trapped: ${stones.trappedCount}  sd:${SOLE_DEPTH}  zoom:${zoom}`,
        12, H - 12,
      );
      ctx.restore();
    }
  }

  requestAnimationFrame(frame);

  return { reset: resetView };
}

// ── Act 1: full-figure below-waist framing, debug overlay on ────────
createGaitView({
  canvasEl: document.getElementById('canvas1'),
  viewportEl: document.getElementById('viewport1'),
  zoom: 1.7,
  groundScreenY: 0.85,
  showTrails: false,
  stoneCountEl: document.getElementById('stoneCount'),
  restartBtn: document.getElementById('restartBtn'),
  debugOverlay: true,
});

// ── Act 2: close-up on the outsole at toe-off, with parabolic trails
//    and live speed/stone-size sliders.
//
// Framing choice: zoom=2.2 zooms in ~30% more than Act 1 (1.7) so the
// outsole and toe-off moment dominate the frame, but not so much that
// stone arcs — which peak ~150 world-px above launch at default
// settings — leave the top of the viewport entirely. groundScreenY=0.85
// matches Act 1 so the ground anchor feels continuous when scrolling
// between the two acts.
createGaitView({
  canvasEl: document.getElementById('canvas2'),
  viewportEl: document.getElementById('viewport2'),
  zoom: 2.2,
  groundScreenY: 0.85,
  showTrails: true,
  speedSlider: document.getElementById('speed2'),
  stoneSizeSlider: document.getElementById('stoneSize2'),
  restartBtn: document.getElementById('restartBtn2'),
});

// ── Act 3: extreme close-up on the ankle/collar with live-editable
//    shoe geometry. The existing gait cycle rotates the foot under the
//    ankle, so the V-shaped collar opening naturally sweeps past the
//    ankle each step — that's the "breathing door" the narrative wants
//    to highlight. The collarHeight + heelNotch sliders feed
//    buildSneakerProfile() per frame so shape edits take effect live.
//
//    Slider mapping:
//      collarHeight (1–10) → h = 6 + slider   (range 7..16, default@3 = 9)
//      heelNotch    (1–10) → w = slider       (range 1..10, default@7 = 7)
//    The reference SNEAKER in renderer.js corresponds to collarHeight
//    slider = 5 (h=11) and heelNotch slider = 5 (w=5).
const collarHeightSlider = document.getElementById('collarHeight');
const heelNotchSlider    = document.getElementById('heelNotch');
createGaitView({
  canvasEl: document.getElementById('canvas3'),
  viewportEl: document.getElementById('viewport3'),
  zoom: 4.5,
  groundScreenY: 1.05,   // push ground off-frame so the ankle fills the view
  showTrails: false,
  shoeProfileFn: () => buildSneakerProfile({
    collarHeight: collarHeightSlider ? 6 + parseFloat(collarHeightSlider.value) : undefined,
    heelNotch:    heelNotchSlider    ?     parseFloat(heelNotchSlider.value)    : undefined,
  }),
});
