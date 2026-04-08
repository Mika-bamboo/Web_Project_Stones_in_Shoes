// Step 1: Single right leg, pelvis fixed in space, no ground constraint, no shoe.
// The leg should flex through a recognizable gait cycle in place.

import { Leg } from './leg.js';
import { drawLeg } from './renderer.js';

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

// --- The single right leg ---
const rightLeg = new Leg({
  thighLength: 90,
  shankLength: 90,
  footLength: 35,
  phaseOffset: 0,
});

let phase = 0;
const cadence = 1.0;  // gait cycles per second
let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);  // clamp to avoid huge jumps
  lastTime = now;

  phase = (phase + dt * cadence) % 1;

  const rect = viewport.getBoundingClientRect();
  const W = rect.width;
  const H = rect.height;

  // Fixed hip position: centered horizontally, upper third vertically
  const hipPos = { x: W / 2, y: H * 0.25 };

  const joints = rightLeg.solve(hipPos, phase);

  // Clear
  ctx.clearRect(0, 0, W, H);

  // Background
  const bg = darkMode ? '#111111' : '#ffffff';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Set stroke color for renderer
  const strokeColor = darkMode ? '#e4e4e4' : '#1a1a1a';
  ctx._strokeColor = strokeColor;

  // Draw the leg
  drawLeg(ctx, joints);

  // Phase label (bottom-left, faint)
  ctx.save();
  ctx.font = '12px monospace';
  ctx.fillStyle = strokeColor;
  ctx.globalAlpha = 0.3;
  ctx.textAlign = 'left';
  const stanceSwing = phase < 0.6 ? 'stance' : 'swing';
  ctx.fillText(`phase: ${phase.toFixed(2)}  (${stanceSwing})`, 12, H - 12);
  ctx.restore();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
