// Frame loop for the gait animation, wiring walker + stones + renderer
// per gait-model-spec.md §7 build order.

// Cache-buster `?v=N` on every relative import so a plain refresh picks
// up animation-code changes. Bump this in lockstep with index.html's
// `<script src="src/main.js?v=N">` whenever you touch walker/leg/
// renderer/stones. Keep all ?v= values identical across the project.
import { Walker } from './walker.js?v=7';
import { StoneSystem } from './stones.js?v=7';
import { drawLeg, drawGround, drawStones, SOLE_DEPTH } from './renderer.js?v=7';

const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('viewport1');

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

  // Clear + background.
  ctx.clearRect(0, 0, W, H);
  const bg = darkMode ? '#111111' : '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const stroke = darkMode ? '#e4e4e4' : '#1a1a1a';
  ctx.strokeStyle = stroke;
  ctx.fillStyle   = stroke;

  // Ground (fixed on screen, ticks scroll with walker.worldX).
  drawGround(ctx, walker.groundY, walker.worldX, W);

  // Legs. Back leg drawn first for correct occlusion.
  const legs = [walker.rightLeg, walker.leftLeg];
  legs.sort((a, b) => a.ankle.x - b.ankle.x);
  drawLeg(ctx, legs[0]);
  drawLeg(ctx, legs[1]);

  // Stones live in world coords; translate to screen.
  ctx.save();
  ctx.translate(walker.pelvisX - walker.worldX, 0);
  drawStones(ctx, stones.stones);
  ctx.restore();

  // Debug overlay.
  ctx.save();
  ctx.font = '12px monospace';
  ctx.globalAlpha = 0.3;
  ctx.textAlign = 'left';
  // `sd:${SOLE_DEPTH}` exposes the currently-loaded renderer.js version:
  //   sd:6.5  = halved profile (00125c9)
  //   sd:13   = spec-size profile (85689e9)
  //   sd:33   = 2.5x scaled profile (6768d3b)
  // If this shows anything other than sd:6.5, the browser is serving a
  // cached copy of renderer.js and you need a hard refresh.
  ctx.fillText(
    `phase: ${walker.phase.toFixed(2)}  worldX: ${walker.worldX.toFixed(0)}  stones: ${stones.stones.length}  sd:${SOLE_DEPTH}`,
    12, H - 12,
  );
  ctx.restore();
}

requestAnimationFrame(frame);
