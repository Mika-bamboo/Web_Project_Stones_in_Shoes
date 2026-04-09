import { Leg } from './leg.js';

// Shoe sole points in foot-local coords (must match renderer's SNEAKER_PROFILE).
const SOLE_POINTS = [
  { x: -6, y: 5 },   // heel sole
  { x: 28, y: 5 },   // toe sole
];

// Compute the lowest world-space Y of the shoe sole for a given set of joints.
function soleLowestY(joints) {
  const angle = Math.PI / 2 - joints.footAngle;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  let maxY = -Infinity;
  for (const pt of SOLE_POINTS) {
    const worldY = joints.ankle.y + pt.x * sin + pt.y * cos;
    if (worldY > maxY) maxY = worldY;
  }
  return maxY;
}

export class Walker {
  constructor(groundY) {
    this.right = new Leg({ thighLength: 90, shankLength: 90, footLength: 25, phaseOffset: 0 });
    this.left  = new Leg({ thighLength: 90, shankLength: 90, footLength: 25, phaseOffset: 0.5 });

    this.phase = 0;
    this.cadence = 1.0;                  // gait cycles per second
    this.pelvis = { x: 200, y: 200 };   // corrected each frame by ground constraint
    this.groundY = groundY;

    // Where each foot was planted at its most recent heel-strike (ankle x only)
    this.plantedX = { right: null, left: null };

    // Track which leg was in stance last frame, to detect heel-strike events
    this.wasInStance = { right: true, left: false };

    this.rightJoints = null;
    this.leftJoints = null;
  }

  // Call after setting pelvis position to bootstrap the constraint from frame 1.
  init() {
    // Bootstrap right leg (starts in stance at phase 0)
    const rJoints = this.right.solve(this.pelvis, this.phase);
    this.plantedX.right = rJoints.ankle.x;

    // Correct pelvis X so ankle stays at planted x
    this.pelvis.x += this.plantedX.right - rJoints.ankle.x;

    // Correct pelvis Y so the lowest sole point sits on groundY
    const trial = this.right.solve(this.pelvis, this.phase);
    const lowestY = soleLowestY(trial);
    this.pelvis.y += this.groundY - lowestY;

    // Solve both legs
    this.rightJoints = this.right.solve(this.pelvis, this.phase);
    this.leftJoints  = this.left.solve(this.pelvis, this.phase);
  }

  step(dt) {
    this.phase = (this.phase + dt * this.cadence) % 1;

    // 1. Detect heel-strike events for each leg
    for (const side of ['right', 'left']) {
      const leg = this[side];
      const inStance = leg.isInStance(this.phase);
      if (inStance && !this.wasInStance[side]) {
        // Heel just struck — record the ankle x where the foot planted
        const joints = leg.solve(this.pelvis, this.phase);
        this.plantedX[side] = joints.ankle.x;
      }
      this.wasInStance[side] = inStance;
    }

    // 2. Find the stance leg and correct pelvis
    const stanceSide = this.right.isInStance(this.phase) ? 'right' : 'left';
    const stanceLeg  = this[stanceSide];
    const plantedX   = this.plantedX[stanceSide];

    if (plantedX !== null) {
      // Single trial solve, then correct both X and Y
      const trial = stanceLeg.solve(this.pelvis, this.phase);

      // X constraint: keep stance ankle at planted horizontal position
      this.pelvis.x += plantedX - trial.ankle.x;

      // Y constraint: keep the stance foot's lowest sole point at groundY.
      // Since FK Y positions shift linearly with pelvis.y, we can reuse the
      // trial's footAngle (unchanged by X correction) to compute sole offset.
      const lowestY = soleLowestY(trial);
      this.pelvis.y += this.groundY - lowestY;
    }

    // 3. Solve both legs for rendering
    this.rightJoints = this.right.solve(this.pelvis, this.phase);
    this.leftJoints  = this.left.solve(this.pelvis, this.phase);
  }
}
