// Step 2: Single right leg with ground constraint.
// Pelvis moves forward in world space per the spec's ground constraint.

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

// --- Walker setup ---
const rect = viewport.getBoundingClientRect();
const groundY = rect.height * 0.78;
const walker = new Walker(groundY);

walker.pelvis = { x: rect.width * 0.3, y: groundY - 170 };
walker.init();

let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  walker.step(dt);

  const vrect = viewport.getBoundingClientRect();
  const W = vrect.width;
  const H = vrect.height;

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Background
  const bg = darkMode ? '#111111' : '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const strokeColor = darkMode ? '#e4e4e4' : '#1a1a1a';
  ctx._strokeColor = strokeColor;

  // Ground line
  drawGround(ctx, walker.groundY, W);

  // Draw the right leg
  drawLeg(ctx, walker.rightJoints);

  // Phase label
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
