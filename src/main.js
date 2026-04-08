// Step 2: Single right leg with ground constraint.
// Pelvis moves forward in world space per the spec's ground constraint.
// Camera follows pelvis so figure stays centered.

import { Walker } from './walker.js';
import { drawLeg, drawGround } from './renderer.js';

const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('viewport1');

// --- Responsive sizing (retina-aware) ---
function resize() {
  const rect = viewport.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
resize();
window.addEventListener('resize', resize);

// --- Dark mode detection ---
let darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  darkMode = e.matches;
});

// --- Deferred init: create walker on first frame when layout is ready ---
let walker = null;
let lastTime = null;

function frame(now) {
  const vrect = viewport.getBoundingClientRect();
  const W = vrect.width;
  const H = vrect.height;

  // Initialize walker on the first frame (layout is guaranteed complete)
  if (!walker) {
    const groundY = H * 0.78;
    walker = new Walker(groundY);
    walker.pelvis = { x: W * 0.5, y: groundY - 170 };
    walker.init();
    lastTime = now;
    requestAnimationFrame(frame);
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  walker.step(dt);

  // --- Camera offset: figure stays centered ---
  const cameraX = walker.pelvis.x - W / 2;

  // Clear (screen space — before transform)
  ctx.clearRect(0, 0, W, H);
  const bg = darkMode ? '#111111' : '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const strokeColor = darkMode ? '#e4e4e4' : '#1a1a1a';
  ctx._strokeColor = strokeColor;

  // Apply camera transform — everything below draws in world space
  ctx.save();
  ctx.translate(-cameraX, 0);

  // Ground line with tick marks (world space)
  drawGround(ctx, walker.groundY, cameraX, W);

  // Draw the right leg (world space)
  drawLeg(ctx, walker.rightJoints);

  ctx.restore();
  // --- Back to screen space ---

  // Debug overlay (screen space, not affected by camera)
  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = strokeColor;
  ctx.globalAlpha = 0.3;
  ctx.textAlign = 'left';
  const stanceSwing = walker.phase < 0.6 ? 'stance' : 'swing';
  ctx.fillText(`phase: ${walker.phase.toFixed(2)}  (${stanceSwing})  pelvis.x: ${walker.pelvis.x.toFixed(0)}`, 12, H - 12);
  ctx.restore();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
