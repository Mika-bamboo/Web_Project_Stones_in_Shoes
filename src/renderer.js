// Drawing functions for the gait model.

// Sneaker profile in foot-local coordinates.
// (0, 0) = ankle, (footLength=25, 0) = toe tip (+x along foot direction).
// Y axis: negative = up (top of shoe), positive = down (sole).
const SNEAKER_PROFILE = [
  // Start at heel, sole bottom
  { x: -6, y: 5 },
  // Sole bottom — flat along the ground
  { x: 28, y: 5 },
  // Toe box — curves up
  { x: 29, y: 3 },
  { x: 29, y: 0 },
  { x: 27, y: -3 },
  // Upper — runs back toward ankle
  { x: 20, y: -6 },
  { x: 13, y: -8 },
  // Throat / collar area
  { x: 4, y: -8 },
  // Collar top — above ankle
  { x: -2, y: -8 },
  // Heel counter — back and down
  { x: -6, y: -6 },
  { x: -7, y: -2 },
  // Back to heel sole
  { x: -6, y: 5 },
];

export function drawShoe(ctx, joints, profile) {
  ctx.save();
  ctx.translate(joints.ankle.x, joints.ankle.y);
  ctx.rotate(Math.PI / 2 - joints.footAngle);  // align +x with foot direction

  ctx.beginPath();
  ctx.moveTo(profile[0].x, profile[0].y);
  for (let i = 1; i < profile.length; i++) {
    ctx.lineTo(profile[i].x, profile[i].y);
  }
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ctx._strokeColor || '#000';
  ctx.fillStyle = 'transparent';
  ctx.stroke();

  // Sole line (separates sole from upper)
  ctx.beginPath();
  ctx.moveTo(-6, 2);
  ctx.lineTo(28, 2);
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}

export function drawLegTube(ctx, a, b, width = 16) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const nx = -dy / len, ny = dx / len;     // perpendicular unit vector
  const w = width / 2;

  ctx.beginPath();
  ctx.moveTo(a.x + nx * w, a.y + ny * w);
  ctx.lineTo(b.x + nx * w, b.y + ny * w);
  ctx.lineTo(b.x - nx * w, b.y - ny * w);
  ctx.lineTo(a.x - nx * w, a.y - ny * w);
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ctx._strokeColor || '#000';
  ctx.stroke();
}

export function drawJointDot(ctx, pos, radius = 4) {
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = ctx._strokeColor || '#000';
  ctx.fill();
}

export function drawLeg(ctx, joints) {
  drawLegTube(ctx, joints.hip, joints.knee, 16);    // thigh
  drawLegTube(ctx, joints.knee, joints.ankle, 14);   // shank

  // Shoe replaces the bare foot segment
  drawShoe(ctx, joints, SNEAKER_PROFILE);

  // Joint dots at hip and knee only (ankle is inside the shoe)
  drawJointDot(ctx, joints.hip, 5);
  drawJointDot(ctx, joints.knee, 4);
}

export function drawGround(ctx, groundY, cameraX, viewWidth) {
  const strokeColor = ctx._strokeColor || '#000';

  // Ground line spans the visible world range
  const left = cameraX;
  const right = cameraX + viewWidth;

  ctx.beginPath();
  ctx.moveTo(left, groundY);
  ctx.lineTo(right, groundY);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  // Tick marks every 50 world-space pixels (drawn upward so ground fill doesn't cover them)
  ctx.lineWidth = 1;
  ctx.strokeStyle = strokeColor;
  ctx.globalAlpha = 0.3;
  const firstTick = Math.floor(left / 50) * 50;
  for (let x = firstTick; x <= right; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x, groundY - 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
}

// Filled rectangle from groundY downward — drawn AFTER the figure
// to occlude any geometry that dips below the ground line.
// Then redraws the ground line and tick marks on top.
export function drawGroundFill(ctx, groundY, canvasH, cameraX, viewWidth, bgColor) {
  const left = cameraX;
  const right = cameraX + viewWidth;

  // Fill below ground with background color
  ctx.fillStyle = bgColor;
  ctx.fillRect(left, groundY, right - left, canvasH);

  // Redraw ground line on top of the fill
  const strokeColor = ctx._strokeColor || '#000';
  ctx.beginPath();
  ctx.moveTo(left, groundY);
  ctx.lineTo(right, groundY);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = strokeColor;
  ctx.stroke();

  // Redraw tick marks on top of the fill
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  const firstTick = Math.floor(left / 50) * 50;
  for (let x = firstTick; x <= right; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x, groundY - 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
}
