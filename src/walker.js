import { Leg } from './leg.js';

const ANKLE_HEIGHT = 8;  // pixels above groundY where ankle is planted

export class Walker {
  constructor(groundY) {
    this.right = new Leg({ thighLength: 90, shankLength: 90, footLength: 35, phaseOffset: 0 });

    this.phase = 0;
    this.cadence = 1.0;                  // gait cycles per second
    this.pelvis = { x: 200, y: 200 };   // corrected each frame by ground constraint
    this.groundY = groundY;

    // Where the foot was planted at its most recent heel-strike
    this.plantedHeel = null;

    // Track which leg was in stance last frame, to detect heel-strike events
    this.wasInStance = true;

    this.rightJoints = null;
  }

  // Call after setting pelvis position to bootstrap the constraint from frame 1.
  init() {
    const joints = this.right.solve(this.pelvis, this.phase);
    this.plantedHeel = { x: joints.ankle.x, y: this.groundY - ANKLE_HEIGHT };

    // Correct pelvis so ankle sits at the planted position
    this.pelvis.x += this.plantedHeel.x - joints.ankle.x;
    this.pelvis.y += this.plantedHeel.y - joints.ankle.y;
    this.rightJoints = this.right.solve(this.pelvis, this.phase);
  }

  step(dt) {
    this.phase = (this.phase + dt * this.cadence) % 1;

    // 1. Detect heel-strike: transition from swing to stance
    const inStance = this.right.isInStance(this.phase);
    if (inStance && !this.wasInStance) {
      const joints = this.right.solve(this.pelvis, this.phase);
      this.plantedHeel = { x: joints.ankle.x, y: this.groundY - ANKLE_HEIGHT };
    }
    this.wasInStance = inStance;

    // 2. During stance, correct pelvis so the ankle stays planted
    if (inStance && this.plantedHeel) {
      const trial = this.right.solve(this.pelvis, this.phase);
      this.pelvis.x += this.plantedHeel.x - trial.ankle.x;
      this.pelvis.y += this.plantedHeel.y - trial.ankle.y;
    }
    // During swing: no constraint — pelvis holds position (single-leg "skip")

    // 3. Solve for rendering
    this.rightJoints = this.right.solve(this.pelvis, this.phase);

    // 4. Clamp: ensure no part of the foot goes below ground
    const lowestY = Math.max(this.rightJoints.ankle.y, this.rightJoints.toe.y);
    if (lowestY > this.groundY) {
      this.pelvis.y -= lowestY - this.groundY;
      this.rightJoints = this.right.solve(this.pelvis, this.phase);
    }
  }
}
