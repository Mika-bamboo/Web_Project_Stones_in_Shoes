import { Leg } from './leg.js';

const ANKLE_HEIGHT = 8;   // pixels above groundY where ankle is planted

// Shoe sole points in foot-local coords (must match renderer's SNEAKER_PROFILE).
// These are the lowest points of the shoe that must not go below groundY.
const SOLE_POINTS = [
  { x: -8, y: 6 },   // heel sole
  { x: 38, y: 6 },   // toe sole
];

// Compute the lowest world-space Y of the shoe sole for a given set of joints.
function soleLowestY(joints) {
  const angle = joints.footAngle - Math.PI / 2;
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
    this.right = new Leg({ thighLength: 90, shankLength: 90, footLength: 35, phaseOffset: 0 });
    this.left  = new Leg({ thighLength: 90, shankLength: 90, footLength: 35, phaseOffset: 0.5 });

    this.phase = 0;
    this.cadence = 1.0;                  // gait cycles per second
    this.pelvis = { x: 200, y: 200 };   // corrected each frame by ground constraint
    this.groundY = groundY;

    // Where each foot was planted at its most recent heel-strike
    this.plantedHeel = { right: null, left: null };

    // Track which leg was in stance last frame, to detect heel-strike events
    this.wasInStance = { right: true, left: false };

    this.rightJoints = null;
    this.leftJoints = null;
  }

  // Call after setting pelvis position to bootstrap the constraint from frame 1.
  init() {
    // Bootstrap right leg (starts in stance at phase 0)
    const rJoints = this.right.solve(this.pelvis, this.phase);
    this.plantedHeel.right = { x: rJoints.ankle.x, y: this.groundY - ANKLE_HEIGHT };

    // Correct pelvis so right ankle sits at the planted position
    this.pelvis.x += this.plantedHeel.right.x - rJoints.ankle.x;
    this.pelvis.y += this.plantedHeel.right.y - rJoints.ankle.y;

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
        // Heel just struck — record where the ankle planted
        const joints = leg.solve(this.pelvis, this.phase);
        this.plantedHeel[side] = { x: joints.ankle.x, y: this.groundY - ANKLE_HEIGHT };
      }
      this.wasInStance[side] = inStance;
    }

    // 2. Find the stance leg and correct pelvis so its ankle stays planted
    const stanceSide = this.right.isInStance(this.phase) ? 'right' : 'left';
    const stanceLeg  = this[stanceSide];
    const planted    = this.plantedHeel[stanceSide];

    if (planted) {
      const trial = stanceLeg.solve(this.pelvis, this.phase);
      this.pelvis.x += planted.x - trial.ankle.x;
      this.pelvis.y += planted.y - trial.ankle.y;
    }

    // 3. Solve both legs for rendering
    this.rightJoints = this.right.solve(this.pelvis, this.phase);
    this.leftJoints  = this.left.solve(this.pelvis, this.phase);

    // 4. Clamp: ensure no shoe sole point goes below groundY.
    //    Transforms the shoe's sole points from foot-local to world space.
    const lowestY = Math.max(
      soleLowestY(this.rightJoints),
      soleLowestY(this.leftJoints),
    );
    if (lowestY > this.groundY) {
      this.pelvis.y -= lowestY - this.groundY;
      this.rightJoints = this.right.solve(this.pelvis, this.phase);
      this.leftJoints  = this.left.solve(this.pelvis, this.phase);
    }
  }
}
