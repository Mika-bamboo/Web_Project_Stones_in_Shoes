// Drawing functions, per gait-model-spec.md §5.
//
// All drawing uses the current ctx.strokeStyle / ctx.fillStyle, so the
// caller is responsible for setting those (e.g. for dark-mode themes)
// before invoking these helpers.

// Sneaker profile in foot-local coordinates. Sized at ~49 px toe-to-heel
// and ~21 px tall — x scaled 1.3× from the previous version to match
// real-body proportions (foot ≈ 30% of leg length for an 80+80 = 160 px
// leg). Y stays the same so the shoe doesn't gain vertical bulk.
// Silhouette: low-top athletic sneaker with a flat rubber sole, rounded
// toe cap, rounded heel counter, and a V-shaped collar opening.
// Convention: (0, 0) = ankle joint, +x = toward toe, +y = toward sole.
// Points are in counter-clockwise order around the outline.
const SNEAKER = [
  // Back of heel counter, climbing toward the collar.
  { x: -11,   y:  -7   },
  { x:  -9,   y: -10   },
  { x:  -4,   y: -11   },   // top of collar, behind the ankle

  // Collar opening — concave dip where the ankle emerges.
  { x:   0,   y:  -7.5 },   // ankle center (deepest point of the opening)
  { x:   5,   y:  -7.5 },
  { x:   9,   y: -11   },   // top of collar, in front of the ankle

  // Vamp sloping forward and down toward the toe cap.
  { x:  13.5, y: -10   },
  { x:  19.5, y:  -7.5 },
  { x:  25.5, y:  -4.5 },

  // Rounded toe cap — curls from the top of the vamp around to the sole.
  { x:  30,   y:  -0.5 },
  { x:  33,   y:   2.5 },
  { x:  34,   y:   6   },
  { x:  33,   y:   9   },

  // Flat sole running back to the heel.
  { x:  29,   y:  10   },
  { x:  19.5, y:  10   },
  { x:  10,   y:  10   },
  { x:  -2,   y:  10   },
  { x: -11,   y:  10   },

  // Rounded heel counter — curves from the sole back up to the collar.
  { x: -13.5, y:   6.5 },
  { x: -15,   y:   2.5 },
  { x: -13.5, y:  -2   },
  // closePath loops back to (-11, -7)
];

// Sole contact points — every vertex of SNEAKER that could be the lowest
// point of the shoe in world space across the gait cycle (the flat sole,
// the toe cap corners where it meets the sole, and the heel back-curve
// corner which becomes the lowest at heel strike).
// Exported so walker.js can clamp the lowest of these to groundY.
export const SOLE_POINTS = [
  { x:  34,   y:  6   },   // toe cap front
  { x:  33,   y:  9   },   // toe cap bottom-front
  { x:  29,   y: 10   },
  { x:  19.5, y: 10   },
  { x:  10,   y: 10   },
  { x:  -2,   y: 10   },
  { x: -11,   y: 10   },
  { x: -13.5, y:  6.5 },   // heel back-curve (lowest at heel strike)
];

// Sole tracing path. A subset of SNEAKER vertices that follows just the
// bottom (rubber sole) edge from the heel back-curve corner forward to
// the toe-cap bottom corner. Drawn as a second stroke pass with a
// thicker line so the sole reads as a distinct rubber stripe.
const SOLE_PATH = [
  { x: -13.5, y:  6.5 },
  { x: -11,   y: 10   },
  { x:  -2,   y: 10   },
  { x:  10,   y: 10   },
  { x:  19.5, y: 10   },
  { x:  29,   y: 10   },
  { x:  33,   y:  9   },
];

// Maximum sole y in foot-local coordinates — the sole depth. Used as a
// seed pelvis height before the per-frame clamp takes over, and surfaced
// in the main.js debug overlay as a version fingerprint.
export const SOLE_DEPTH = 10;

// drawShoe(ctx, ankle, footAngle, flashIntensity = 0)
//
// `flashIntensity` is a number in [0, 1]. When non-zero, a third stroke
// pass overlays the shoe outline with a red glow whose alpha equals the
// intensity — used to flash the shoe red briefly when a stone enters.
export function drawShoe(ctx, ankle, footAngle, flashIntensity = 0) {
  ctx.save();
  ctx.translate(ankle.x, ankle.y);
  // Align foot-local +x with the world-space foot direction
  // (sin footAngle, cos footAngle). `ctx.rotate(θ)` sends (1,0) to
  // (cos θ, sin θ), so we need θ = π/2 − footAngle.
  ctx.rotate(Math.PI / 2 - footAngle);

  // 1. Upper outline (full SNEAKER polygon, normal stroke).
  ctx.beginPath();
  ctx.moveTo(SNEAKER[0].x, SNEAKER[0].y);
  for (let i = 1; i < SNEAKER.length; i++) {
    ctx.lineTo(SNEAKER[i].x, SNEAKER[i].y);
  }
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.stroke();

  // 2. Sole stripe (just the bottom edge, thicker stroke). Same color
  //    as the upper. Visually reads as a rubber sole because the line
  //    is twice as thick as the rest of the outline.
  ctx.beginPath();
  ctx.moveTo(SOLE_PATH[0].x, SOLE_PATH[0].y);
  for (let i = 1; i < SOLE_PATH.length; i++) {
    ctx.lineTo(SOLE_PATH[i].x, SOLE_PATH[i].y);
  }
  ctx.lineWidth = 4;
  ctx.stroke();

  // 3. Red flash overlay (only when something just entered this shoe).
  //    Fills the shoe polygon with semi-transparent red so the entire
  //    silhouette glows, and re-strokes the outline at full alpha for
  //    edge definition. The fill alpha is capped below 1 so trapped
  //    stones drawn behind the leg (in main.js, before drawLeg) remain
  //    partially visible underneath the glow as it fades.
  if (flashIntensity > 0) {
    const savedFill   = ctx.fillStyle;
    const savedStroke = ctx.strokeStyle;

    // Build the SNEAKER path once and reuse it for fill + stroke.
    ctx.beginPath();
    ctx.moveTo(SNEAKER[0].x, SNEAKER[0].y);
    for (let i = 1; i < SNEAKER.length; i++) {
      ctx.lineTo(SNEAKER[i].x, SNEAKER[i].y);
    }
    ctx.closePath();

    // Fill — bright red, alpha proportional to (and below) the flash
    // intensity so the glow fades smoothly with the timer.
    ctx.fillStyle = `rgba(255, 50, 50, ${flashIntensity * 0.6})`;
    ctx.fill();

    // Outline — same shade at full flash alpha, lineWidth 4 so the
    // shoe edge pops while the fill is visible.
    ctx.strokeStyle = `rgba(220, 30, 30, ${flashIntensity})`;
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.fillStyle   = savedFill;
    ctx.strokeStyle = savedStroke;
  }

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

// drawLeg(ctx, leg, flashIntensity = 0) — flashIntensity is forwarded
// to drawShoe so the shoe of this leg flashes red when set.
export function drawLeg(ctx, leg, flashIntensity = 0) {
  drawLegTube(ctx, leg.hip,  leg.knee,  16);                   // thigh
  drawLegTube(ctx, leg.knee, leg.ankle, 14);                   // shank
  drawShoe  (ctx, leg.ankle, leg.footAngle, flashIntensity);
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

// In-shoe stones are drawn in red to signal "trapped"; static and
// flying stones use whatever ctx.fillStyle the caller already set
// (the theme stroke color in main.js).
const TRAPPED_STONE_COLOR = '#cc0000';

export function drawStones(ctx, stones) {
  const defaultFill = ctx.fillStyle;
  for (const s of stones) {
    ctx.fillStyle = (s.state === 'inshoe') ? TRAPPED_STONE_COLOR : defaultFill;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = defaultFill;
}
