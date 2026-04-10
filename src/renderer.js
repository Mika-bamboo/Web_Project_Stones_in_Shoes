// Drawing functions for the gait model.

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
  drawLegTube(ctx, joints.ankle, joints.toe, 10);    // foot segment

  // Joint dots for clarity
  drawJointDot(ctx, joints.hip, 5);
  drawJointDot(ctx, joints.knee, 4);
  drawJointDot(ctx, joints.ankle, 4);
  drawJointDot(ctx, joints.toe, 3);
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
