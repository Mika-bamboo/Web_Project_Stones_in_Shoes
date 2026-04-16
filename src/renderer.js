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

// drawMuscledTube — a tapered, asymmetric-bulging muscle shape along
// the segment from `a` to `b`. Takes two half-width arrays:
//
//   backWidths[i]  — outward distance on the "+perp" side of the centerline
//   frontWidths[i] — outward distance on the "-perp" side
//
// The perpendicular (`nx = -dy/L, ny = dx/L`) points to the anatomical
// *back* of the leg regardless of leg orientation, because our gait
// curves keep the distal joint below the proximal joint (`dy > 0`) at
// every phase. So `backWidths` always controls the calf / hamstring
// side and `frontWidths` always controls the tibia / quadriceps side.
//
// Both arrays must be the same length. With n = 6 we get 5 outline
// segments per side (10 total), enough to read as a smooth curve at
// ZOOM=1.7 without bezier math.
export function drawMuscledTube(ctx, a, b, backWidths, frontWidths, doFill = false) {
  const n = backWidths.length;
  if (n < 2 || frontWidths.length !== n) return;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  // Perpendicular pointing to the anatomical back side of the leg.
  const nx = -dy / len, ny = dx / len;

  ctx.beginPath();
  // Back side (+perp), walking a → b.
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    const w = backWidths[i];
    const px = cx + nx * w;
    const py = cy + ny * w;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  // Front side (-perp), walking b → a (reverse order so the polygon closes cleanly).
  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1);
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    const w = frontWidths[i];
    ctx.lineTo(cx - nx * w, cy - ny * w);
  }
  ctx.closePath();
  // When doFill is true, fill the polygon with whatever ctx.fillStyle
  // the caller set (typically a trouser / background color) before
  // stroking the outline. This gives the fabric a solid look and
  // ensures the front leg cleanly occludes the back leg.
  if (doFill) ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
}

// Anatomically-asymmetric muscle profiles. Each pair gives half-widths
// for the back and front of the segment, sampled at 6 evenly-spaced
// points from the proximal joint to the distal joint.
//
// Thigh: quadriceps (front) is a bit thicker than hamstrings (back),
// with a glute tuck at the hip on the back side; both sides meet at a
// narrow knee.
const THIGH_BACK_PROFILE  = [9,   9,   8,   7.5, 6.5, 6];   // hamstring + glute
const THIGH_FRONT_PROFILE = [7,   9,   9.5, 8.5, 7,   6];   // quadriceps

// Shank: pronounced calf bulge (high on the shank, around t=0.2) on the
// back side; the front is nearly flat (tibia bone), tapering gently.
const SHANK_BACK_PROFILE  = [6,  10,  9.5, 7,   5.5, 4.5]; // gastrocnemius
const SHANK_FRONT_PROFILE = [5,   5.5, 5,   4.5, 4,   3.5]; // tibia

// ── Trouser profiles ────────────────────────────────────────────────
// Removed. The old two-segment trouser used separate thigh and shank
// profiles via drawMuscledTube. Replaced by drawTrouser (below), which
// draws one continuous polygon from hip to ankle with blended knee
// perpendiculars, loose-suit widths, and phase-driven sway.

// ── Single-piece suit trouser ──────────────────────────────────────
// Draws a SINGLE filled + stroked polygon from hip to ankle, with:
//
//  1. Suit-trouser widths — wide, straight, barely tapered, symmetric
//     front/back (fabric hides muscle contour). Totals: thigh 23–24,
//     shank 17–22, matching at the knee (21) for continuity.
//
//  2. Blended knee perpendicular — the thigh segment's perpendicular
//     and the shank segment's perpendicular are averaged at the knee,
//     so the trouser outline transitions smoothly around the bend
//     instead of showing a seam/gap between two separate shapes.
//
//  3. Phase-driven fabric sway — a sinusoidal offset (±SWAY_AMP px at
//     the ankle, 0 at the hip) that oscillates with the leg's local
//     gait phase, giving the hem a natural flutter as the leg swings.
//     Back and front sides sway slightly out of phase for realism.
//
// Parameters:
//   hip, knee, ankle — world-space joint positions from solveLeg.
//   localPhase — this leg's local gait phase (0–1); drives the sway.
//   fillColor  — CSS color for the fabric fill, or null for outline-only.
function drawTrouser(ctx, hip, knee, ankle, localPhase, fillColor) {
  // ── Suit trouser half-widths per side, 6 samples each ──
  const thighBack  = [12,   12,   12,   11.5, 11,  10.5];
  const thighFront = [11,   12,   12,   11.5, 11,  10.5];
  const shankBack  = [10.5, 11,   10.5, 10,   9.5,  8.5];
  const shankFront = [10.5, 11,   10.5, 10,   9.5,  8.5];
  const N = 6;

  // ── Segment geometry ──
  const tdx = knee.x - hip.x,   tdy = knee.y - hip.y;
  const sdx = ankle.x - knee.x, sdy = ankle.y - knee.y;
  const tlen = Math.hypot(tdx, tdy);
  const slen = Math.hypot(sdx, sdy);
  if (tlen === 0 || slen === 0) return;

  // Raw perpendiculars: anatomical "back" side of each segment.
  const tnx = -tdy / tlen, tny = tdx / tlen;
  const snx = -sdy / slen, sny = sdx / slen;

  // Blended knee perpendicular (average of thigh + shank, renormalized).
  let knx = (tnx + snx) / 2, kny = (tny + sny) / 2;
  const klen = Math.hypot(knx, kny) || 1;
  knx /= klen; kny /= klen;

  // ── Gravity-drape blend ──
  // The trouser is fabric, not a rigid tube. When the leg tilts, the
  // trouser doesn't foreshorten — it hangs down due to gravity. We
  // simulate this by blending the perpendicular direction toward pure
  // horizontal (-1, 0) as overallT increases from hip (0) to ankle (1).
  // At the hip the trouser follows the leg exactly (waistband is
  // attached). At the ankle the offset is mostly horizontal (hem hangs).
  const DRAPE = 0.55;  // 0 = rigid tube, 1 = fully horizontal at ankle

  function drapedPerp(rawNx, rawNy, overallT) {
    const df = overallT * DRAPE;
    let dnx = rawNx * (1 - df) + (-1) * df;   // blend toward -x (back)
    let dny = rawNy * (1 - df);                // blend toward 0 (horizontal)
    const len = Math.hypot(dnx, dny) || 1;
    return { x: dnx / len, y: dny / len };
  }

  // ── Phase-driven fabric sway ──
  const SWAY_AMP = 3;
  const phaseRad = localPhase * 2 * Math.PI;
  function sway(overallT, isFront) {
    const offset = isFront ? Math.PI * 0.35 : 0;
    return Math.sin(phaseRad + offset + overallT * 1.2) * SWAY_AMP * overallT;
  }

  // ── Build the single polygon ──
  ctx.beginPath();

  // BACK side (hip → knee → ankle)
  for (let i = 0; i <= N - 2; i++) {
    const t = i / (N - 1);
    const oT = t * 0.5;
    const cx = hip.x + tdx * t, cy = hip.y + tdy * t;
    const p = drapedPerp(tnx, tny, oT);
    const w = thighBack[i] + sway(oT, false);
    if (i === 0) ctx.moveTo(cx + p.x * w, cy + p.y * w);
    else         ctx.lineTo(cx + p.x * w, cy + p.y * w);
  }
  // knee blend (back)
  {
    const p = drapedPerp(knx, kny, 0.5);
    const w = ((thighBack[N - 1] + shankBack[0]) / 2) + sway(0.5, false);
    ctx.lineTo(knee.x + p.x * w, knee.y + p.y * w);
  }
  // shank (back)
  for (let i = 1; i <= N - 1; i++) {
    const t = i / (N - 1);
    const oT = 0.5 + t * 0.5;
    const cx = knee.x + sdx * t, cy = knee.y + sdy * t;
    const p = drapedPerp(snx, sny, oT);
    const w = shankBack[i] + sway(oT, false);
    ctx.lineTo(cx + p.x * w, cy + p.y * w);
  }

  // FRONT side (ankle → knee → hip, reversed)
  for (let i = N - 1; i >= 1; i--) {
    const t = i / (N - 1);
    const oT = 0.5 + t * 0.5;
    const cx = knee.x + sdx * t, cy = knee.y + sdy * t;
    const p = drapedPerp(snx, sny, oT);
    const w = shankFront[i] + sway(oT, true);
    ctx.lineTo(cx - p.x * w, cy - p.y * w);
  }
  // knee blend (front)
  {
    const p = drapedPerp(knx, kny, 0.5);
    const w = ((thighFront[N - 1] + shankFront[0]) / 2) + sway(0.5, true);
    ctx.lineTo(knee.x - p.x * w, knee.y - p.y * w);
  }
  // thigh (front, reversed)
  for (let i = N - 2; i >= 0; i--) {
    const t = i / (N - 1);
    const oT = t * 0.5;
    const cx = hip.x + tdx * t, cy = hip.y + tdy * t;
    const p = drapedPerp(tnx, tny, oT);
    const w = thighFront[i] + sway(oT, true);
    ctx.lineTo(cx - p.x * w, cy - p.y * w);
  }

  ctx.closePath();

  if (fillColor) {
    const saved = ctx.fillStyle;
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.fillStyle = saved;
  }
  ctx.lineWidth = 2;
  ctx.stroke();
}

export function drawJointDot(ctx, pos, radius = 4) {
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fill();
}

// drawLeg(ctx, leg, flashIntensity, trouserFill, localPhase)
//
// When `trouserFill` is a CSS color, draws a single-piece suit trouser
// from hip to ankle (continuous, no knee gap) using drawTrouser, with
// phase-driven fabric sway. Only the hip dot is drawn (knee is hidden
// under the fabric). When `trouserFill` is null, bare-muscle outlines
// are drawn with both joint dots.
export function drawLeg(ctx, leg, flashIntensity = 0, trouserFill = null, localPhase = 0) {
  if (trouserFill) {
    drawTrouser(ctx, leg.hip, leg.knee, leg.ankle, localPhase, trouserFill);
    drawJointDot(ctx, leg.hip, 5);     // waistband marker — visible
    // knee dot omitted: hidden under fabric
  } else {
    drawMuscledTube(ctx, leg.hip,  leg.knee,  THIGH_BACK_PROFILE, THIGH_FRONT_PROFILE);
    drawMuscledTube(ctx, leg.knee, leg.ankle, SHANK_BACK_PROFILE, SHANK_FRONT_PROFILE);
    drawJointDot(ctx, leg.hip,  5);
    drawJointDot(ctx, leg.knee, 4);
  }
  drawShoe(ctx, leg.ankle, leg.footAngle, flashIntensity);
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
