// Act 3 — "looking down at your own shoe collar while sitting" view.
//
// This module is intentionally self-contained. It shares NOTHING with
// Acts 1/2: no Walker, no StoneSystem, no gait kinematics, no
// scrolling-world camera, no side-profile sneaker silhouette. The
// camera angle — an oblique top-down from behind-above — demands a
// completely different scene graph, so it gets its own renderer.
//
// Scene layout (world coords, origin = ankle joint at canvas center):
//   • +x = toward the foot's right (lateral)
//   • +y = toward the heel (into the screen, projected as "down")
//   • +z would be "up out of the shoe" (toward camera), drawn as y-offset
//
// The oblique projection compresses y by FORESHORTEN so the elongated
// shoe outline fits in a 16:9 viewport and reads as a top-down-ish shape
// rather than a straight top-down footprint.

const FORESHORTEN     = 0.62;   // vertical compression factor for the projection
const PHASE_FREQ      = 0.55;   // Hz — gait-cycle breathing cadence

// Shoe footprint (in world units, pre-foreshortening).
const SHOE_HALF_W     = 42;     // half-width (x)
const SHOE_HALF_L     = 95;     // half-length (y); heel at +y, toe at -y
const UPPER_INSET     = 4;      // how much the fabric upper sits inside the sole

// Collar opening (topline) — located over the back third of the shoe
// where the ankle sits.
const COLLAR_CY       = 42;     // y-offset from origin (toward heel)
const COLLAR_RX_BASE  = 28;     // half-width of the topline oval
const COLLAR_RY_BASE  = 36;     // half-length of the topline oval

// Shin cross-section, centered at origin.
const SHIN_R          = 20;

// Hovering decorative stones on the topline rim.
const NUM_STONES      = 7;

export function createCrossSectionView(opts) {
  const {
    canvasEl,
    viewportEl,
    collarHeightSlider = null,
    heelNotchSlider    = null,
  } = opts;
  if (!canvasEl || !viewportEl) return;

  const ctx = canvasEl.getContext('2d');

  // Dark-mode tracking local to this view so it doesn't depend on main.js.
  let darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    darkMode = e.matches;
  });

  // Seed the decorative stones once. Each one sits at a fixed angle on
  // the topline rim and bobs radially with a tiny independent phase.
  const stones = [];
  for (let i = 0; i < NUM_STONES; i++) {
    stones.push({
      angle:       (i / NUM_STONES) * Math.PI * 2 + Math.random() * 0.4,
      radiusK:     0.96 + Math.random() * 0.06,
      bobPhase:    Math.random(),
      bobFreq:     0.4 + Math.random() * 0.6,
      r:           1.8 + Math.random() * 1.2,
    });
  }

  let phase = 0;
  let lastTime = null;

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
  }

  // Slider mappings. Defaults (collarHeight=3, heelNotch=7 per HTML) land
  // on a low-ish, wide-notched sneaker — a clear "breathing door" look.
  function readParams() {
    const chRaw = collarHeightSlider ? parseFloat(collarHeightSlider.value) : 3;
    const hnRaw = heelNotchSlider    ? parseFloat(heelNotchSlider.value)    : 7;
    return {
      // Collar height → width of the visible ring between outer topline
      // and the inner collar-wall ellipse. Small height = thin rim,
      // large height = thick ring (boot-like).
      collarRing: 2 + chRaw * 1.4,   // px of inset
      // Heel notch → how far the back of the topline is pulled inward
      // (toward the shin). Bigger slider = more pronounced notch.
      notchDepth: 2 + hnRaw * 1.2,   // px of inward displacement
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    resize();
    const W = canvasEl.width  / (window.devicePixelRatio || 1);
    const H = canvasEl.height / (window.devicePixelRatio || 1);
    if (W === 0 || H === 0) return;

    if (lastTime === null) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 1 / 30);
    lastTime = now;
    phase = (phase + dt * PHASE_FREQ) % 1;

    const { collarRing, notchDepth } = readParams();

    // "Breathing" — the shoe drifts forward (−y) and back (+y) underneath
    // the fixed shin as the foot plantar/dorsiflexes. This makes the
    // gap visibly asymmetric: heel notch yawns open when the shoe slides
    // forward, tightens on the other side. Sinusoidal, smooth loop.
    const wave = Math.sin(2 * Math.PI * phase);
    const shoeDy = wave * 7;        // world units of drift
    // The collar itself also dilates slightly — soft material flexing.
    const ringK = 1 + wave * 0.04;  // ±4% scale on the topline

    // ── Paint ───────────────────────────────────────────────────────
    const bg        = darkMode ? '#111111' : '#ffffff';
    const stroke    = darkMode ? '#e4e4e4' : '#1a1a1a';
    const upperFill = darkMode ? '#1a1a1a' : '#f7f7f5';
    const soleFill  = darkMode ? '#222222' : '#e8e6e2';
    const accent    = '#D85A30';
    const gapFill   = darkMode ? 'rgba(216,90,48,0.28)' : 'rgba(216,90,48,0.18)';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.translate(W / 2, H / 2);

    // 1. Sole — outermost oval.
    ovalPath(ctx, 0, shoeDy * FORESHORTEN, SHOE_HALF_W, SHOE_HALF_L * FORESHORTEN);
    ctx.fillStyle = soleFill;
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = stroke;
    ctx.stroke();

    // 2. Upper — slightly inset oval. Covers most of the sole.
    ovalPath(
      ctx, 0, shoeDy * FORESHORTEN,
      SHOE_HALF_W - UPPER_INSET,
      (SHOE_HALF_L - UPPER_INSET) * FORESHORTEN,
    );
    ctx.fillStyle = upperFill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.stroke();

    // 3. Collar opening — the topline. Drawn as the gap fill first, then
    //    the outline on top. The heel-notch V is a concavity at the back.
    const toplineCy = (COLLAR_CY + shoeDy) * FORESHORTEN;
    const toplineRx = COLLAR_RX_BASE * ringK;
    const toplineRy = COLLAR_RY_BASE * FORESHORTEN * ringK;

    // Fill the opening with the accent "gap" tint — the hero color.
    toplinePath(ctx, 0, toplineCy, toplineRx, toplineRy, notchDepth);
    ctx.fillStyle = gapFill;
    ctx.fill();

    // 4. Inner collar wall — an offset ellipse inside the topline that
    //    hints at collar depth. Dashed + faint so it reads as "the
    //    bottom of the collar cavity, further from the camera."
    const innerRx = Math.max(SHIN_R + 3, toplineRx - collarRing);
    const innerRy = Math.max(
      (SHIN_R + 3) * FORESHORTEN,
      toplineRy - collarRing * FORESHORTEN,
    );
    ctx.beginPath();
    ctx.ellipse(0, toplineCy, innerRx, innerRy, 0, 0, Math.PI * 2);
    ctx.save();
    ctx.globalAlpha = 0.45;
    ctx.setLineDash([3, 3]);
    ctx.lineWidth = 1;
    ctx.strokeStyle = stroke;
    ctx.stroke();
    ctx.restore();

    // 5. Topline outline — drawn AFTER the inner wall so it reads as the
    //    front-most rim. Accent color to emphasize it as the entry edge.
    toplinePath(ctx, 0, toplineCy, toplineRx, toplineRy, notchDepth);
    ctx.lineWidth = 2;
    ctx.strokeStyle = accent;
    ctx.stroke();

    // 6. Shin — cylinder cross-section with a radial gradient so it
    //    reads as 3D rather than a flat disc.
    const shinGrad = ctx.createRadialGradient(
      -SHIN_R * 0.35, -SHIN_R * 0.35, SHIN_R * 0.1,
      0, 0, SHIN_R,
    );
    if (darkMode) {
      shinGrad.addColorStop(0, '#5a4a3a');
      shinGrad.addColorStop(1, '#2a2018');
    } else {
      shinGrad.addColorStop(0, '#f0d9bf');
      shinGrad.addColorStop(1, '#b08060');
    }
    ctx.beginPath();
    ctx.arc(0, 0, SHIN_R, 0, Math.PI * 2);
    ctx.fillStyle = shinGrad;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 7. Hovering stones on the topline rim. Each sits at a fixed
    //    angular position on the outer topline and bobs radially.
    ctx.fillStyle = stroke;
    for (const s of stones) {
      s.bobPhase = (s.bobPhase + dt * s.bobFreq) % 1;
      const bob = Math.sin(2 * Math.PI * s.bobPhase) * 0.03;
      const k = s.radiusK + bob;
      const x = toplineRx * k * Math.cos(s.angle);
      const y = toplineCy + toplineRy * k * Math.sin(s.angle);
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 8. Labels — drawn in screen space (outside the centered transform).
    drawLabels(ctx, W, H, stroke, toplineCy, toplineRx, toplineRy);
  }

  requestAnimationFrame(frame);
}

// ── Drawing helpers ──────────────────────────────────────────────────

function ovalPath(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
}

// Topline = ellipse with an inward-pulled region at the back (+y) that
// forms the heel notch. `notchDepth` in world units, applied as radial
// scaling in a narrow angular band centered on a = π/2 (canvas-y-down).
//
// We sample the ellipse at `steps` points and compute a per-angle radial
// scale `1 - k(a)` where k(a) is a cosine bump of width `notchSpan`
// centered at π/2. The result is a smooth, scalloped dip at the heel.
function toplinePath(ctx, cx, cy, rx, ry, notchDepth) {
  const steps = 72;
  const notchSpan = Math.PI / 3;        // ~60° of angular influence
  const notchCenter = Math.PI / 2;      // canvas +y = toward heel
  // Convert world-unit depth into a dimensionless radial-scale amplitude
  // using the ellipse's short radius as a reference. Clamped so extreme
  // slider values can't invert the curve.
  const amp = Math.min(0.55, notchDepth / Math.min(rx, ry));

  ctx.beginPath();
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const da = angularDistance(a, notchCenter);
    let k = 1;
    if (da < notchSpan) {
      // Cosine bump: 1 at center, 0 at edges of the span.
      const t = da / notchSpan;
      const bump = 0.5 * (1 + Math.cos(Math.PI * t));  // 1 → 0
      k = 1 - amp * bump;
    }
    const x = cx + rx * k * Math.cos(a);
    const y = cy + ry * k * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// Smallest unsigned angular distance between two angles in [0, 2π).
function angularDistance(a, b) {
  let d = Math.abs(a - b);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}

// Label callouts with leader lines. Positions are chosen once per frame
// relative to the current topline geometry so they track collar-size
// changes without clipping.
function drawLabels(ctx, W, H, color, toplineCyCentered, toplineRx, toplineRy) {
  const cx = W / 2;
  const cy = H / 2;
  ctx.save();
  ctx.font = '11px sans-serif';
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.75;
  ctx.lineWidth = 1;

  const items = [
    { label: 'topline',    anchorDx:  toplineRx,         anchorDy: toplineCyCentered,                   tx:  toplineRx + 28, ty: toplineCyCentered - 12, align: 'left'  },
    { label: 'heel notch', anchorDx:  0,                 anchorDy: toplineCyCentered + toplineRy - 6,   tx: -toplineRx - 28, ty: toplineCyCentered + toplineRy + 6, align: 'right' },
    { label: 'ankle',      anchorDx:  0,                 anchorDy: 0,                                   tx:  toplineRx + 28, ty: -18,                     align: 'left'  },
    { label: 'collar',     anchorDx: -toplineRx * 0.75,  anchorDy: toplineCyCentered - toplineRy * 0.4, tx: -toplineRx - 28, ty: toplineCyCentered - toplineRy - 6, align: 'right' },
  ];

  for (const it of items) {
    const ax = cx + it.anchorDx;
    const ay = cy + it.anchorDy;
    const tx = cx + it.tx;
    const ty = cy + it.ty;
    // Clamp to viewport so labels don't drift off-canvas at small sizes.
    const cx2 = Math.max(8, Math.min(W - 8, tx));
    const cy2 = Math.max(12, Math.min(H - 4, ty));
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(cx2, cy2);
    ctx.stroke();
    ctx.textAlign = it.align;
    ctx.textBaseline = 'middle';
    ctx.fillText(it.label, cx2 + (it.align === 'left' ? 3 : -3), cy2);
  }

  ctx.restore();
}
