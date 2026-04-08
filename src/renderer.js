// Drawing functions for the gait model.

// Sneaker profile in foot-local coordinates.
// (0, 0) = ankle, (35, 0) = toe tip (+x along foot direction).
// Y axis: negative = up (top of shoe), positive = down (sole).
const SNEAKER_PROFILE = [
  // Start at heel, sole bottom
  { x: -8, y: 6 },
  // Sole bottom — flat along the ground
  { x: 38, y: 6 },
  // Toe box — curves up
  { x: 40, y: 4 },
  { x: 40, y: 0 },
  { x: 38, y: -4 },
  // Upper — runs back toward ankle
  { x: 28, y: -8 },
  { x: 18, y: -10 },
  // Throat / collar area
  { x: 6, y: -10 },
  // Collar top — above ankle
  { x: -2, y: -10 },
  // Heel counter — back and down
  { x: -8, y: -8 },
  { x: -10, y: -2 },
  // Back to heel sole
  { x: -8, y: 6 },
];

export function drawShoe(ctx, joints, profile) {
  ctx.save();
  ctx.translate(joints.ankle.x, joints.ankle.y);
  ctx.rotate(joints.footAngle - Math.PI / 2);  // align +x with foot direction

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

  // Sole line (thicker, separates sole from upper)
  ctx.beginPath();
  ctx.moveTo(-8, 3);
  ctx.lineTo(38, 3);
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

  // Tick marks every 50 world-space pixels
  ctx.lineWidth = 1;
  ctx.strokeStyle = strokeColor;
  ctx.globalAlpha = 0.3;
  const firstTick = Math.floor(left / 50) * 50;
  for (let x = firstTick; x <= right; x += 50) {
    ctx.beginPath();
    ctx.moveTo(x, groundY);
    ctx.lineTo(x, groundY + 6);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
}
