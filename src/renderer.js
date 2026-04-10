// Drawing functions, per gait-model-spec.md §5.
//
// All drawing uses the current ctx.strokeStyle / ctx.fillStyle, so the
// caller is responsible for setting those (e.g. for dark-mode themes)
// before invoking these helpers.

// Sneaker profile in foot-local coordinates. Scaled ~2.5x from spec §5
// with additional vertices for a rounded toe cap, rounded heel, and a
// visible collar-opening dip at the ankle.
// Convention: (0, 0) = ankle joint, +x = toward toe, +y = toward sole.
// Points are in counter-clockwise order (outline of the shoe silhouette).
const SNEAKER = [
  // Back-top of the heel counter.
  { x: -20, y: -22 },
  { x: -12, y: -25 },
  { x:  -4, y: -26 },   // top of collar, just behind the ankle

  // Collar opening — the top of the shoe dips inward where the ankle
  // emerges (creates a visible concave arc at the ankle).
  { x:   0, y: -18 },   // ankle center (deepest point of the opening)
  { x:   6, y: -18 },
  { x:  14, y: -26 },   // top of collar, just in front of the ankle

  // Vamp sloping forward toward the toe.
  { x:  22, y: -24 },
  { x:  34, y: -20 },
  { x:  48, y: -14 },
  { x:  62, y:  -8 },

  // Rounded toe cap, curving over the top and around to the sole.
  { x:  75, y:   0 },
  { x:  83, y:  10 },
  { x:  85, y:  20 },
  { x:  80, y:  27 },

  // Flat sole from toe back to heel.
  { x:  68, y:  32 },
  { x:  45, y:  33 },
  { x:  15, y:  33 },
  { x: -10, y:  32 },
  { x: -22, y:  28 },

  // Rounded heel curving back up to the collar.
  { x: -30, y:  18 },
  { x: -33, y:   0 },
  { x: -30, y: -10 },
  { x: -25, y: -18 },
  // closePath loops back to (-20, -22)
];

// Sole contact points — the subset of SNEAKER that lies on the bottom of
// the shoe. Exported so walker.js can clamp the lowest of these to groundY
// each frame. Ordered from toe to heel.
export const SOLE_POINTS = [
  { x:  80, y: 27 },
  { x:  68, y: 32 },
  { x:  45, y: 33 },
  { x:  15, y: 33 },
  { x: -10, y: 32 },
  { x: -22, y: 28 },
];

// Maximum sole y in foot-local coordinates. Useful as a "neutral-standing
// sole depth" for initial pelvis height before the per-frame clamp kicks in.
export const SOLE_DEPTH = 33;

export function drawShoe(ctx, ankle, footAngle) {
  ctx.save();
  ctx.translate(ankle.x, ankle.y);
  // Align foot-local +x with the world-space foot direction
  // (sin footAngle, cos footAngle). `ctx.rotate(θ)` sends (1,0) to
  // (cos θ, sin θ), so we need θ = π/2 − footAngle.
  // (Spec §5 shows `footAngle − π/2`; that sign is backwards — verify with
  //  footAngle = 0: foot-local (1,0) must map to world (0,1), which only
  //  `π/2 − footAngle` achieves.)
  ctx.rotate(Math.PI / 2 - footAngle);

  ctx.beginPath();
  ctx.moveTo(SNEAKER[0].x, SNEAKER[0].y);
  for (let i = 1; i < SNEAKER.length; i++) {
    ctx.lineTo(SNEAKER[i].x, SNEAKER[i].y);
  }
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}

export function drawLegTube(ctx, a, b, width = 14) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const nx = -dy / len, ny = dx / len;    // perpendicular unit vector
  const w = width / 2;

  ctx.beginPath();
  ctx.moveTo(a.x + nx * w, a.y + ny * w);
  ctx.lineTo(b.x + nx * w, b.y + ny * w);
  ctx.lineTo(b.x - nx * w, b.y - ny * w);
  ctx.lineTo(a.x - nx * w, a.y - ny * w);
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawJointDot(ctx, pos, radius = 4) {
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

export function drawLeg(ctx, leg) {
  drawLegTube(ctx, leg.hip,  leg.knee,  16);   // thigh
  drawLegTube(ctx, leg.knee, leg.ankle, 14);   // shank
  drawShoe  (ctx, leg.ankle, leg.footAngle);
  drawJointDot(ctx, leg.hip,  5);
  drawJointDot(ctx, leg.knee, 4);
}

// Scrolling ground: the line stays fixed on screen, but the tick marks
// scroll backward as `scrollX` grows, giving the illusion of forward motion.
export function drawGround(ctx, groundY, scrollX, viewWidth) {
  // Ground line spans the full canvas width.
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(viewWidth, groundY);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Tick marks every 50 px, shifted by −scrollX so they slide left.
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  const tickSpacing = 50;
  const offset = ((scrollX % tickSpacing) + tickSpacing) % tickSpacing;
  for (let x = -offset; x <= viewWidth; x += tickSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x, groundY + 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
}

export function drawStones(ctx, stones) {
  for (const s of stones) {
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
}
