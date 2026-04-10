// Step 4 of gait-model-spec §8: two legs with shoes, sole-pivot ground
// constraint (see walker.js), camera-follow. Stones (step 5) not yet wired.

import { Walker } from './walker.js';
import { drawLeg, drawGround } from './renderer.js';

const canvas = document.getElementById('canvas1');
const ctx = canvas.getContext('2d');
const viewport = document.getElementById('viewport1');

// --- Dark mode detection ---
let darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  darkMode = e.matches;
});

// --- Responsive sizing (retina-aware) — called every frame ---
function resize() {
  const rect = viewport.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let walker = null;
let lastTime = null;

function frame(now) {
  requestAnimationFrame(frame);

  // Resize canvas every frame to handle layout changes
  resize();

  const W = canvas.width / (window.devicePixelRatio || 1);
  const H = canvas.height / (window.devicePixelRatio || 1);
  if (W === 0 || H === 0) return;

  // Create walker on first valid frame
  if (!walker) {
    const groundY = H * 0.78;
    walker = new Walker(groundY);
    walker.pelvis = { x: 0, y: groundY - 170 };
    walker.init();
    lastTime = now;
    return;
  }

  const dt = Math.min((now - lastTime) / 1000, 1 / 30);
  lastTime = now;

  walker.step(dt);

  // Guard against NaN — reset if detected
  if (isNaN(walker.pelvis.x) || isNaN(walker.pelvis.y)) {
    walker.pelvis = { x: 0, y: walker.groundY - 170 };
    walker.init();
    return;
  }

  // Camera offset: figure stays horizontally centered
  const cameraX = walker.pelvis.x - W / 2;

  // Clear
  ctx.clearRect(0, 0, W, H);
  const bg = darkMode ? '#111111' : '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const strokeColor = darkMode ? '#e4e4e4' : '#1a1a1a';
  ctx._strokeColor = strokeColor;

  // World-space drawing with camera offset
  ctx.save();
  ctx.translate(-cameraX, 0);

  drawGround(ctx, walker.groundY, cameraX, W);

  // Draw back leg first, front leg second (occlusion by ankle x-position)
  const legs = [walker.rightJoints, walker.leftJoints];
  legs.sort((a, b) => a.ankle.x - b.ankle.x);  // back leg (smaller x) first
  drawLeg(ctx, legs[0]);
  drawLeg(ctx, legs[1]);

  ctx.restore();

  // Debug overlay (screen space)
  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = strokeColor;
  ctx.globalAlpha = 0.3;
  ctx.textAlign = 'left';
  ctx.fillText(`phase: ${walker.phase.toFixed(2)}  pelvis.x: ${walker.pelvis.x.toFixed(0)}`, 12, H - 12);
  ctx.restore();
}

requestAnimationFrame(frame);
