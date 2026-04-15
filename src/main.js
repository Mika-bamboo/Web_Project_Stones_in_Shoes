// Frame loop for the gait animation, wiring walker + stones + renderer
// per gait-model-spec.md §7 build order.

// Cache-buster `?v=N` on every relative import so a plain refresh picks
// up animation-code changes. Bump this in lockstep with index.html's
// `<script src="src/main.js?v=N">` whenever you touch walker/leg/
// renderer/stones. Keep all ?v= values identical across the project.
import { Walker } from './walker.js?v=14';
import { StoneSystem } from './stones.js?v=14';
import { drawLeg, drawGround, drawStones, SOLE_DEPTH } from './renderer.js?v=14';

const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('viewport1');
// Optional — index.html has `<span id="stoneCount">` to show how many
// stones have been trapped in the shoe. Guarded so main.js still works
// if the element ever gets removed.
const stoneCountEl = document.getElementById('stoneCount');
let lastShownTrappedCount = -1;

// Restart-button DOM lookup. The actual click handler is wired further
// down (after walker/stones/lastTime are declared) so the closure binds
// to those variables in normal scope, not via TDZ.
const restartBtn = document.getElementById('restartBtn');

// ─── Framing ──────────────────────────────────────────────────────────
// Below-waist zoom-and-crop. Walker, stones, and gait all stay in their
// existing world coordinates; this is purely a render-time transform.
//
// ZOOM is the scale factor applied to every world-space unit. At 1.7×, a
// 160 px leg renders at 272 screen px, which fills ~60% of a typical
// viewport vertically.
//
// The reference-point mapping is: world `(walker.pelvisX, walker.groundY)`
// is placed at screen `(W / 2, H * GROUND_SCREEN_Y)`. That centers the
// walker horizontally and pins the ground near the bottom of the viewport,
// which leaves just enough headroom to show the pelvis at the top of the
// visible area and creates the "below-waist" framing.
//
// Everything is tunable in these two constants — no changes elsewhere.
const ZOOM = 1.7;
const GROUND_SCREEN_Y = 0.85;

// Dark-mode detection.
let darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  darkMode = e.matches;
});

// Retina-aware sizing.
function resize() {
  const rect = viewport.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = rect.width  * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let walker = null;
let stones = null;
let lastTime = null;

// Now that walker/stones/lastTime exist, wire the restart-button click
// handler. Setting them to null causes the next frame's init block
// (`if (!walker) { ... }`) to rebuild everything from scratch — same
// path as the very first frame after page load.
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    walker = null;
    stones = null;
    lastTime = null;
    lastShownTrappedCount = -1;
    if (stoneCountEl) stoneCountEl.textContent = '0';
  });
}

function frame(now) {
  requestAnimationFrame(frame);
  resize();

  const W = canvas.width  / (window.devicePixelRatio || 1);
  const H = canvas.height / (window.devicePixelRatio || 1);
  if (W === 0 || H === 0) return;

  // One-time initialization on the first valid frame.
  if (!walker) {
    const groundY = H * 0.78;
    walker = new Walker(groundY);
    stones = new StoneSystem();
    lastTime = now;
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  walker.update(dt);
  stones.update(walker, dt);

  // Push the trapped-stone count to the DOM element (only when it
  // changes, to avoid thrashing layout).
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
  // Canvas transform sends (x, y) in the subsequent draws to
  //   screen_x = tx + ZOOM * x
  //   screen_y = ty + ZOOM * y
  // Solving for tx, ty so that world (pelvisX, groundY) lands at
  // (W/2, H * GROUND_SCREEN_Y):
  ctx.save();
  const tx = W / 2 - ZOOM * walker.pelvisX;
  const ty = H * GROUND_SCREEN_Y - ZOOM * walker.groundY;
  ctx.translate(tx, ty);
  ctx.scale(ZOOM, ZOOM);

  // Ground (world space). Ticks scroll with walker.worldX; the `W` here
  // is used inside drawGround as a loop upper bound and intentionally
  // over-draws a bit past the zoomed viewport — harmless, gets clipped.
  drawGround(ctx, walker.groundY, walker.worldX, W);

  // ── In-shoe stones (drawn BEFORE legs) ──
  // Trapped stones are drawn first so the leg / shoe outlines render on
  // top of them — visually they look "inside" the shoe instead of
  // floating in front of it. Static and flying stones are drawn AFTER
  // the legs further down so they appear in front of the foot.
  const inShoeStones  = stones.stones.filter(s => s.state === 'inshoe');
  const groundedFlying = stones.stones.filter(s => s.state !== 'inshoe');
  ctx.save();
  ctx.translate(walker.pelvisX - walker.worldX, 0);
  drawStones(ctx, inShoeStones);
  ctx.restore();

  // Legs — back leg first for correct occlusion. Each leg carries its
  // own shoe-flash intensity (0..1) so that drawShoe knows whether to
  // overlay a red glow when a stone just entered.
  const legsWithFlash = [
    { leg: walker.rightLeg, flash: walker.getShoeFlashIntensity('right') },
    { leg: walker.leftLeg,  flash: walker.getShoeFlashIntensity('left')  },
  ];
  legsWithFlash.sort((a, b) => a.leg.ankle.x - b.leg.ankle.x);
  drawLeg(ctx, legsWithFlash[0].leg, legsWithFlash[0].flash);
  drawLeg(ctx, legsWithFlash[1].leg, legsWithFlash[1].flash);

  // ── Static + flying stones (drawn AFTER legs) ──
  ctx.save();
  ctx.translate(walker.pelvisX - walker.worldX, 0);
  drawStones(ctx, groundedFlying);
  ctx.restore();

  ctx.restore();
  // ─── Exit zoomed world transform ────────────────────────────────

  // Debug overlay (screen space, unaffected by zoom).
  ctx.save();
  ctx.font = '12px monospace';
  ctx.globalAlpha = 0.3;
  ctx.textAlign = 'left';
  // `sd:` exposes the loaded renderer.js's SOLE_DEPTH as a version marker:
  //   sd:10   = current leg-proportional shoe
  //   sd:6.5  = earlier halved profile
  //   sd:13   = earlier spec-size profile
  //   sd:33   = earliest 2.5x scaled profile
  // If this shows anything other than sd:10, the browser is serving a
  // cached copy of renderer.js and you need a hard refresh.
  ctx.fillText(
    `phase: ${walker.phase.toFixed(2)}  worldX: ${walker.worldX.toFixed(0)}  stones: ${stones.stones.length}  trapped: ${stones.trappedCount}  sd:${SOLE_DEPTH}  zoom:${ZOOM}`,
    12, H - 12,
  );
  ctx.restore();
}

requestAnimationFrame(frame);
