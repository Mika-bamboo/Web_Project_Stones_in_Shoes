// Act 3 — static foot-in-shoe line art at the photo's down-the-leg angle.
//
// Style matches Acts 1/2: plain theme background, single stroke color,
// light gray fill for limbs/shoe. No carpet, no sock stripes, no accent
// color — just monochrome outlines. Animation will be added later.
//
// Scene:
//   • leg tube rising from the bottom-left, tilted toward upper-right
//   • narrow sock band where the leg meets the shoe collar
//   • oxford-style shoe silhouette pointing up-right, with laces, toe
//     cap seam, and a visible collar opening

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

  function theme() {
    // Shared with Acts 1/2 so the three canvases read as one world.
    return darkMode
      ? { bg: '#111111', stroke: '#e4e4e4', fill: '#191919', fillAlt: '#222222', inside: '#050505' }
      : { bg: '#ffffff', stroke: '#1a1a1a', fill: '#f4f4f4', fillAlt: '#e8e8e8', inside: '#d9d9d9' };
  }

  function draw() {
    resize();
    const W = canvasEl.width  / (window.devicePixelRatio || 1);
    const H = canvasEl.height / (window.devicePixelRatio || 1);
    if (W === 0 || H === 0) return;

    const t = theme();

    ctx.fillStyle = t.bg;
    ctx.fillRect(0, 0, W, H);

    // Scene geometry — anchor points scale with viewport.
    // Leg rises from near the bottom-left; ankle sits just past the
    // middle, with the toe tipping into the upper-right quadrant.
    const ankle = { x: W * 0.44, y: H * 0.58 };
    const toe   = { x: W * 0.86, y: H * 0.22 };
    const legBase = { x: W * 0.12, y: H * 1.05 };

    drawLeg(ctx, legBase, ankle, t);
    drawShoe(ctx, ankle, toe, t);
  }

  requestAnimationFrame(draw);
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(draw).observe(viewportEl);
  } else {
    window.addEventListener('resize', draw);
  }
}

// ── Leg ──────────────────────────────────────────────────────────────
// A tapered tube from an off-canvas base point up to the ankle. Wider
// at the base (thigh/calf) than at the ankle. Filled in light theme
// gray and outlined in the theme stroke color — same treatment the
// side-profile walker uses for the trousers in Acts 1/2.

function drawLeg(ctx, base, ankle, t) {
  const dx = ankle.x - base.x;
  const dy = ankle.y - base.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;

  // Unit perpendicular to the leg axis.
  const px = -dy / len;
  const py =  dx / len;

  const baseHalfW  = Math.max(28, len * 0.16);
  const ankleHalfW = Math.max(18, len * 0.09);

  const bL = { x: base.x  + px * baseHalfW,   y: base.y  + py * baseHalfW  };
  const bR = { x: base.x  - px * baseHalfW,   y: base.y  - py * baseHalfW  };
  const aR = { x: ankle.x - px * ankleHalfW,  y: ankle.y - py * ankleHalfW };
  const aL = { x: ankle.x + px * ankleHalfW,  y: ankle.y + py * ankleHalfW };

  // Body.
  ctx.beginPath();
  ctx.moveTo(bL.x, bL.y);
  ctx.lineTo(bR.x, bR.y);
  ctx.lineTo(aR.x, aR.y);
  ctx.lineTo(aL.x, aL.y);
  ctx.closePath();
  ctx.fillStyle = t.fill;
  ctx.fill();
  ctx.strokeStyle = t.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Sock band: a short slightly-wider strip just below the ankle where
  // the sock cuff shows above the shoe. Two parallel faint lines read
  // as ribbing.
  const bandT0 = 0.84;
  const bandT1 = 0.98;
  const bandHalfW = ankleHalfW + 2;
  const sBL = lerp2(bL, aL, bandT0);
  const sBR = lerp2(bR, aR, bandT0);
  const sTL = lerp2(bL, aL, bandT1);
  const sTR = lerp2(bR, aR, bandT1);
  // Expand the band outward slightly so it peeks past the leg outline.
  const expand = (p, outwardSign) => ({
    x: p.x + px * outwardSign * 2,
    y: p.y + py * outwardSign * 2,
  });
  const eBL = expand(sBL,  1);
  const eBR = expand(sBR, -1);
  const eTR = expand(sTR, -1);
  const eTL = expand(sTL,  1);
  ctx.beginPath();
  ctx.moveTo(eBL.x, eBL.y);
  ctx.lineTo(eBR.x, eBR.y);
  ctx.lineTo(eTR.x, eTR.y);
  ctx.lineTo(eTL.x, eTL.y);
  ctx.closePath();
  ctx.fillStyle = t.bg;
  ctx.fill();
  ctx.strokeStyle = t.stroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Two ribbing lines across the band, parallel to the ankle edge.
  ctx.save();
  ctx.globalAlpha = 0.35;
  for (const rt of [0.88, 0.93]) {
    const rL = expand(lerp2(bL, aL, rt),  1);
    const rR = expand(lerp2(bR, aR, rt), -1);
    ctx.beginPath();
    ctx.moveTo(rL.x, rL.y);
    ctx.lineTo(rR.x, rR.y);
    ctx.stroke();
  }
  ctx.restore();
}

// ── Shoe ─────────────────────────────────────────────────────────────
// Drawn in a rotated local frame (origin = ankle, +x = toward toe) so
// the outline, laces, and seam all share the same axis regardless of
// the overall perspective tilt.

function drawShoe(ctx, ankle, toe, t) {
  const dx = toe.x - ankle.x;
  const dy = toe.y - ankle.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const angle = Math.atan2(dy, dx);

  // Shoe proportions in foot-local units. `len` is ankle-to-toe.
  const heelX   = -len * 0.35;
  const collarX = -len * 0.12;
  const toeX    =  len;
  const halfW   =  len * 0.34;

  ctx.save();
  ctx.translate(ankle.x, ankle.y);
  ctx.rotate(angle);

  // 1. Outline — asymmetric oval with a rounder toe and a flatter heel.
  ctx.beginPath();
  ctx.moveTo(heelX, 0);
  // Lateral (bottom of rotated frame): heel → midfoot → toe.
  ctx.bezierCurveTo(
    heelX - 4,    halfW * 0.85,
    collarX,      halfW * 1.02,
    toeX * 0.35,  halfW * 0.95,
  );
  ctx.bezierCurveTo(
    toeX * 0.72,  halfW * 0.88,
    toeX * 0.94,  halfW * 0.50,
    toeX,         halfW * 0.08,
  );
  // Toe cap.
  ctx.bezierCurveTo(
    toeX,         -halfW * 0.08,
    toeX * 0.94, -halfW * 0.50,
    toeX * 0.72, -halfW * 0.88,
  );
  // Medial (top of rotated frame): toe → midfoot → heel.
  ctx.bezierCurveTo(
    toeX * 0.35, -halfW * 0.95,
    collarX,     -halfW * 1.02,
    heelX - 4,   -halfW * 0.85,
  );
  ctx.closePath();

  ctx.fillStyle = t.fillAlt;
  ctx.fill();
  ctx.strokeStyle = t.stroke;
  ctx.lineWidth = 2;
  ctx.stroke();

  // 2. Collar opening — darker ellipse centered where the sock emerges.
  const openCx = -len * 0.02;
  const openRx = halfW * 0.58;
  const openRy = halfW * 0.82;
  ctx.beginPath();
  ctx.ellipse(openCx, 0, openRx, openRy, 0, 0, Math.PI * 2);
  ctx.fillStyle = t.inside;
  ctx.fill();
  ctx.strokeStyle = t.stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 3. Throat + laces. The throat is a narrow diamond running from the
  //    front of the collar opening toward the toe; laces zig-zag across
  //    it between two rows of eyelets.
  const throatStart = openCx + openRx * 0.95;
  const throatEnd   = toeX * 0.55;
  const throatWidAtCollar = halfW * 0.36;
  const throatWidAtToe    = halfW * 0.14;

  ctx.beginPath();
  ctx.moveTo(throatStart,  throatWidAtCollar);
  ctx.lineTo(throatEnd,    throatWidAtToe);
  ctx.lineTo(throatEnd,   -throatWidAtToe);
  ctx.lineTo(throatStart, -throatWidAtCollar);
  ctx.closePath();
  ctx.fillStyle = t.fill;
  ctx.fill();
  ctx.strokeStyle = t.stroke;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Eyelets — three pairs evenly distributed along the throat edges.
  const eyeletCount = 3;
  const eyelets = [];
  for (let i = 0; i < eyeletCount; i++) {
    const s = (i + 0.5) / eyeletCount;
    const x = throatStart + (throatEnd - throatStart) * s;
    const halfAtS = throatWidAtCollar + (throatWidAtToe - throatWidAtCollar) * s;
    eyelets.push({ x, yTop: -halfAtS * 0.85, yBot: halfAtS * 0.85 });
  }
  ctx.fillStyle = t.stroke;
  for (const e of eyelets) {
    ctx.beginPath();
    ctx.arc(e.x, e.yTop, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(e.x, e.yBot, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Lace strings — criss-cross between adjacent eyelets, then a short
  // straight bar at each pair for the classic lacing look.
  ctx.strokeStyle = t.stroke;
  ctx.lineWidth = 1.3;
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
  ctx.lineWidth = 1.5;
  for (const e of eyelets) {
    ctx.beginPath();
    ctx.moveTo(e.x, e.yTop);
    ctx.lineTo(e.x, e.yBot);
    ctx.stroke();
  }

  // 4. Toe cap seam — a shallow curve marking where the toe box meets
  //    the vamp. Faint so it reads as stitching, not an outline.
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.beginPath();
  ctx.moveTo(toeX * 0.62,  halfW * 0.90);
  ctx.bezierCurveTo(
    toeX * 0.56,  halfW * 0.30,
    toeX * 0.56, -halfW * 0.30,
    toeX * 0.62, -halfW * 0.90,
  );
  ctx.strokeStyle = t.stroke;
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();

  ctx.restore();
}

// ── Helpers ──────────────────────────────────────────────────────────

function lerp2(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
