import { Leg } from './leg.js';

const ANKLE_HEIGHT = 8;   // pixels above groundY where ankle is planted
const FOOT_MARGIN = 8;    // visual clearance: half foot tube width (5) + toe dot radius (3)

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

    // 4. Clamp: ensure no drawn part of either foot goes below ground
    const clampY = this.groundY - FOOT_MARGIN;
    const lowestY = Math.max(
      this.rightJoints.ankle.y, this.rightJoints.toe.y,
      this.leftJoints.ankle.y, this.leftJoints.toe.y,
    );
    if (lowestY > clampY) {
      this.pelvis.y -= lowestY - clampY;
      this.rightJoints = this.right.solve(this.pelvis, this.phase);
      this.leftJoints  = this.left.solve(this.pelvis, this.phase);
    }
  }
}
