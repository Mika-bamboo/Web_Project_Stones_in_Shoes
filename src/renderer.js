// Drawing functions for the gait model.
// Step 1: leg tubes only (thigh, shank, foot segments).

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
