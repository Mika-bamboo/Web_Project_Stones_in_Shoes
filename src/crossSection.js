// Act 3 — static illustration of a foot-in-shoe, viewed at the same
// down-the-leg angle as the reference photo. No gait kinematics, no
// stones, no shared state with Acts 1/2. Animation will be added later.
//
// Composition (mirrors the reference image):
//   • carpet background, top-left corner showing a sliver of a white
//     surface (the laptop edge in the photo)
//   • navy trouser leg entering from the lower-left
//   • white ribbed sock with thin pink/blue stripes at the cuff,
//     emerging from the trouser into the shoe collar
//   • black leather oxford-style shoe pointing to the upper-right,
//     with laces over the throat and a rounded toe cap
//
// The whole scene is drawn once on init and again on every resize.

export function createCrossSectionView(opts) {
  const { canvasEl, viewportEl } = opts;
  if (!canvasEl || !viewportEl) return;

  const ctx = canvasEl.getContext('2d');

  let darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    darkMode = e.matches;
    draw();
  });

  function resize() {
    const rect = viewportEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const dpr = window.devicePixelRatio || 1;
    const targetW = rect.width  * dpr;
    const targetH = rect.height * dpr;
    if (canvasEl.width !== targetW || canvasEl.height !== targetH) {
      canvasEl.width  = targetW;
      canvasEl.height = targetH;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return true;
    }
    return false;
  }

  function draw() {
    if (!resize() && canvasEl.width === 0) return;
    const W = canvasEl.width  / (window.devicePixelRatio || 1);
    const H = canvasEl.height / (window.devicePixelRatio || 1);
    if (W === 0 || H === 0) return;

    drawCarpet(ctx, W, H, darkMode);
    drawLaptopCorner(ctx, W, H, darkMode);
    drawTrouser(ctx, W, H);
    drawSock(ctx, W, H);
    drawShoe(ctx, W, H);
  }

  // Initial draw — wait one frame so the viewport has a measured size.
  requestAnimationFrame(draw);
  // Subsequent draws on container size changes.
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(draw).observe(viewportEl);
  } else {
    window.addEventListener('resize', draw);
  }
}

// ── Background: carpet + speckle ─────────────────────────────────────

function drawCarpet(ctx, W, H, darkMode) {
  const base = darkMode ? '#3a3a3a' : '#8a8a88';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, W, H);

  // Procedural speckle. Density scales with viewport area so a wider
  // canvas doesn't look bare. Seeded from a small loop counter so the
  // pattern is stable across redraws (no flicker on resize).
  const speckleCount = Math.floor((W * H) / 90);
  const lightSpeckle = darkMode ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.18)';
  const darkSpeckle  = darkMode ? 'rgba(0,0,0,0.30)'      : 'rgba(0,0,0,0.18)';

  for (let i = 0; i < speckleCount; i++) {
    const x = pseudoRand(i * 3 + 1) * W;
    const y = pseudoRand(i * 3 + 2) * H;
    const r = 0.4 + pseudoRand(i * 3 + 3) * 0.9;
    ctx.fillStyle = (i % 2 === 0) ? lightSpeckle : darkSpeckle;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Sliver of a white object (laptop in the photo) jutting in from the
// upper-left corner. Draws as a tilted polygon with a thin grey edge.
function drawLaptopCorner(ctx, W, H, darkMode) {
  const fill   = darkMode ? '#cfcfcf' : '#ededea';
  const edge   = darkMode ? '#888888' : '#bcbcb8';
  const span   = Math.min(W, H) * 0.55;

  ctx.beginPath();
  ctx.moveTo(0, H * 0.32);
  ctx.lineTo(span * 0.95, 0);
  ctx.lineTo(0, 0);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(0, H * 0.32);
  ctx.lineTo(span * 0.95, 0);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ── Trouser leg ──────────────────────────────────────────────────────
// A tapered navy quad rising from the lower-left corner, ending at the
// sock cuff. Tilt matches the photo's perspective.

function drawTrouser(ctx, W, H) {
  // Anchor points relative to the canvas size so the geometry scales.
  const cuffCx = W * 0.40;
  const cuffCy = H * 0.62;
  const cuffHalfW = W * 0.16;

  // Bottom corners — wider, anchored at the lower-left edge of the canvas.
  const baseLx = -W * 0.05;
  const baseLy = H * 1.05;
  const baseRx = W * 0.42;
  const baseRy = H * 1.05;

  // Cuff corners. Tilted so the front of the cuff (toward the shoe) is
  // higher than the back.
  const cuffBackX  = cuffCx - cuffHalfW * 1.05;
  const cuffBackY  = cuffCy + 18;
  const cuffFrontX = cuffCx + cuffHalfW * 0.95;
  const cuffFrontY = cuffCy - 8;

  // Fill — gradient from a slightly darker navy at the back to a brighter
  // navy at the cuff, suggesting the soft falloff of fabric.
  const grad = ctx.createLinearGradient(baseLx, baseLy, cuffFrontX, cuffFrontY);
  grad.addColorStop(0, '#161a2a');
  grad.addColorStop(1, '#252b44');

  ctx.beginPath();
  ctx.moveTo(baseLx, baseLy);
  ctx.lineTo(baseRx, baseRy);
  ctx.lineTo(cuffFrontX, cuffFrontY);
  ctx.lineTo(cuffBackX,  cuffBackY);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle vertical fabric folds — three faint dark stripes running
  // roughly along the leg's long axis.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i++) {
    const t = i / 4;
    const topX = cuffBackX + (cuffFrontX - cuffBackX) * t;
    const topY = cuffBackY + (cuffFrontY - cuffBackY) * t;
    const botX = baseLx + (baseRx - baseLx) * t;
    const botY = baseLy + (baseRy - baseLy) * t;
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.lineTo(botX, botY);
    ctx.stroke();
  }
  ctx.restore();

  // Cuff edge — a thin dark line where the trouser stops and the sock
  // shows through. Reads as the hem.
  ctx.beginPath();
  ctx.moveTo(cuffBackX,  cuffBackY);
  ctx.lineTo(cuffFrontX, cuffFrontY);
  ctx.strokeStyle = '#0a0c18';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ── Sock ─────────────────────────────────────────────────────────────
// A short tilted "tube" between the trouser cuff and the shoe collar.
// White base with thin pink and blue ribbed stripes — a nod to the
// reference photo without being literal.

function drawSock(ctx, W, H) {
  // Sock outline: trapezoidal strip from trouser cuff to shoe collar.
  const cuffCx = W * 0.40;
  const cuffCy = H * 0.62;
  const cuffHalfW = W * 0.16;
  const cuffBackX  = cuffCx - cuffHalfW * 1.05;
  const cuffBackY  = cuffCy + 18;
  const cuffFrontX = cuffCx + cuffHalfW * 0.95;
  const cuffFrontY = cuffCy - 8;

  // Top-of-sock corners (where the shoe collar takes over). Slightly
  // narrower than the trouser cuff and shifted toward the shoe.
  const topBackX  = W * 0.43;
  const topBackY  = H * 0.55;
  const topFrontX = W * 0.62;
  const topFrontY = H * 0.46;

  // Sock body fill.
  ctx.beginPath();
  ctx.moveTo(cuffBackX,  cuffBackY);
  ctx.lineTo(cuffFrontX, cuffFrontY);
  ctx.lineTo(topFrontX,  topFrontY);
  ctx.lineTo(topBackX,   topBackY);
  ctx.closePath();
  ctx.fillStyle = '#f3f1ea';
  ctx.fill();

  // Striped band: 5 thin stripes (pink, white, blue, white, pink) running
  // perpendicular to the sock's long axis. Each stripe is a quad
  // interpolated between the cuff edge and the top edge.
  const stripes = [
    { t0: 0.20, t1: 0.28, color: '#e69aae' },  // pink
    { t0: 0.32, t1: 0.40, color: '#7fb6df' },  // blue
    { t0: 0.44, t1: 0.52, color: '#e69aae' },  // pink
  ];
  for (const s of stripes) {
    const a = lerpPt(cuffBackX,  cuffBackY,  topBackX,  topBackY,  s.t0);
    const b = lerpPt(cuffFrontX, cuffFrontY, topFrontX, topFrontY, s.t0);
    const c = lerpPt(cuffFrontX, cuffFrontY, topFrontX, topFrontY, s.t1);
    const d = lerpPt(cuffBackX,  cuffBackY,  topBackX,  topBackY,  s.t1);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fillStyle = s.color;
    ctx.fill();
  }

  // Ribbing — many faint dark lines parallel to the long axis. Sells the
  // "thick athletic sock" texture from the photo.
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.6;
  const ribCount = 14;
  for (let i = 1; i < ribCount; i++) {
    const t = i / ribCount;
    const a = lerpPt(cuffBackX, cuffBackY, cuffFrontX, cuffFrontY, t);
    const b = lerpPt(topBackX,  topBackY,  topFrontX,  topFrontY,  t);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();

  // Top edge — where the sock meets the shoe collar.
  ctx.beginPath();
  ctx.moveTo(topBackX,  topBackY);
  ctx.lineTo(topFrontX, topFrontY);
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

// ── Shoe ─────────────────────────────────────────────────────────────
// Black leather oxford-style silhouette pointing to the upper-right.
// Drawn in its own rotated frame so the lace pattern + toe cap stay
// aligned with the foot's long axis regardless of the perspective tilt.

function drawShoe(ctx, W, H) {
  // Anchor: roughly where the ankle sits on top of the shoe (where the
  // sock disappears into the collar).
  const ankleX = W * 0.52;
  const ankleY = H * 0.50;

  // Foot points toward upper-right of the canvas. The angle is the
  // axis from ankle to toe in screen-space radians.
  const footAngle = -Math.PI * 0.18;   // slight upward tilt

  // Length and width of the visible shoe in the chosen frame, scaled to
  // fit the viewport.
  const len = Math.min(W, H) * 0.72;
  const wid = Math.min(W, H) * 0.34;

  ctx.save();
  ctx.translate(ankleX, ankleY);
  ctx.rotate(footAngle);

  // ── Shoe outline (foot-local coordinates: +x = toward toe) ────────
  // Asymmetric oval with a flatter back (heel counter), a long forefoot,
  // and a slightly squared toe.
  const halfW = wid / 2;
  const heelX   = -len * 0.30;   // back of the heel
  const collarX = -len * 0.12;   // where the topline starts
  const toeX    =  len * 0.70;   // tip of the toe

  ctx.beginPath();
  ctx.moveTo(heelX,         halfW * 0.05);
  // Outer (lateral) side: heel → midfoot → toe
  ctx.bezierCurveTo(heelX - 2,   halfW * 0.85,
                    collarX,     halfW * 1.02,
                    toeX * 0.45, halfW * 0.95);
  ctx.bezierCurveTo(toeX * 0.78, halfW * 0.90,
                    toeX * 0.96, halfW * 0.55,
                    toeX,        halfW * 0.05);
  // Toe tip
  ctx.bezierCurveTo(toeX,         -halfW * 0.05,
                    toeX,         -halfW * 0.55,
                    toeX * 0.96,  -halfW * 0.55);
  // Inner (medial) side: toe → midfoot → heel
  ctx.bezierCurveTo(toeX * 0.78, -halfW * 0.92,
                    toeX * 0.45, -halfW * 0.95,
                    collarX,     -halfW * 1.02);
  ctx.bezierCurveTo(heelX - 2,   -halfW * 0.85,
                    heelX,       -halfW * 0.05,
                    heelX,        halfW * 0.05);
  ctx.closePath();

  // Leather fill with a soft highlight along the upper edge — sells
  // "polished black leather" without going photoreal.
  const grad = ctx.createLinearGradient(0, -halfW, 0, halfW);
  grad.addColorStop(0,    '#2a2422');
  grad.addColorStop(0.45, '#0e0c0b');
  grad.addColorStop(1,    '#1a1614');
  ctx.fillStyle = grad;
  ctx.fill();

  // Outline.
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // ── Collar opening ───────────────────────────────────────────────
  // Where the sock disappears into the shoe. A dark oval centered on the
  // ankle in foot-local coords (i.e. near x = collarX).
  const openCx = -len * 0.04;
  const openRx = halfW * 0.62;
  const openRy = halfW * 0.85;
  ctx.beginPath();
  ctx.ellipse(openCx, 0, openRx, openRy, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#0a0807';
  ctx.fill();
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.stroke();

  // ── Throat & laces ───────────────────────────────────────────────
  // The throat is a thin diamond running forward from the collar toward
  // the toe; laces zig-zag across it.
  const throatStart = openCx + openRx * 0.85;
  const throatEnd   = toeX * 0.55;
  const throatWid   = halfW * 0.32;

  // Throat panel (slightly browner leather under the laces).
  ctx.beginPath();
  ctx.moveTo(throatStart,  throatWid * 0.75);
  ctx.lineTo(throatEnd,    throatWid * 0.20);
  ctx.lineTo(throatEnd,   -throatWid * 0.20);
  ctx.lineTo(throatStart, -throatWid * 0.75);
  ctx.closePath();
  ctx.fillStyle = '#1f1816';
  ctx.fill();

  // Lace eyelets — three pairs along the throat edges.
  const eyeletCount = 3;
  const eyelets = [];
  for (let i = 0; i < eyeletCount; i++) {
    const t = (i + 0.5) / eyeletCount;
    const xt = throatStart + (throatEnd - throatStart) * t;
    const yTop = -throatWid * (0.75 - 0.55 * t);
    const yBot =  throatWid * (0.75 - 0.55 * t);
    eyelets.push({ x: xt, yTop, yBot });
  }
  ctx.fillStyle = '#000000';
  for (const e of eyelets) {
    ctx.beginPath();
    ctx.arc(e.x, e.yTop, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(e.x, e.yBot, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lace strings — diagonals between the eyelets, plus straight bars.
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < eyeletCount - 1; i++) {
    ctx.beginPath();
    ctx.moveTo(eyelets[i].x,     eyelets[i].yTop);
    ctx.lineTo(eyelets[i + 1].x, eyelets[i + 1].yBot);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(eyelets[i].x,     eyelets[i].yBot);
    ctx.lineTo(eyelets[i + 1].x, eyelets[i + 1].yTop);
    ctx.stroke();
  }
  // Straight horizontal bars at each eyelet pair, drawn over the X-cross
  // for the classic "criss-cross with bars" lacing look.
  ctx.lineWidth = 1.6;
  for (const e of eyelets) {
    ctx.beginPath();
    ctx.moveTo(e.x, e.yTop);
    ctx.lineTo(e.x, e.yBot);
    ctx.stroke();
  }

  // ── Toe cap stitch ───────────────────────────────────────────────
  // A faint curved line marking the cap at the front of the shoe.
  ctx.beginPath();
  ctx.moveTo(toeX * 0.55,  halfW * 0.92);
  ctx.bezierCurveTo(toeX * 0.55,  halfW * 0.30,
                    toeX * 0.55, -halfW * 0.30,
                    toeX * 0.55, -halfW * 0.92);
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Subtle highlight strip along the top of the shoe — sells the curved
  // leather surface catching light.
  ctx.beginPath();
  ctx.moveTo(collarX, -halfW * 0.55);
  ctx.bezierCurveTo(toeX * 0.40, -halfW * 0.78,
                    toeX * 0.78, -halfW * 0.55,
                    toeX * 0.92, -halfW * 0.20);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 5;
  ctx.stroke();

  ctx.restore();
}

// ── Helpers ──────────────────────────────────────────────────────────

// Linear interpolation between two screen-space points, returned as
// {x, y}. Used by the sock striping to place quads along the long axis.
function lerpPt(ax, ay, bx, by, t) {
  return { x: ax + (bx - ax) * t, y: ay + (by - ay) * t };
}

// Cheap deterministic pseudo-random in [0, 1). Stable across redraws so
// the carpet speckle doesn't shimmer when the canvas resizes.
function pseudoRand(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}
