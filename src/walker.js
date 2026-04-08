import { Leg } from './leg.js';

export class Walker {
  constructor(groundY) {
    this.right = new Leg({ thighLength: 90, shankLength: 90, footLength: 35, phaseOffset: 0 });

    this.phase = 0;
    this.cadence = 1.0;                  // gait cycles per second
    this.pelvis = { x: 200, y: 200 };   // will be corrected each frame
    this.groundY = groundY;

    // Where the foot was planted at its most recent heel-strike
    this.plantedHeel = null;

    // Track whether leg was in stance last frame, to detect heel-strike events
    this.wasInStance = true;

    this.rightJoints = null;
  }

  step(dt) {
    this.phase = (this.phase + dt * this.cadence) % 1;

    // 1. Detect heel-strike: transition from swing to stance
    const inStance = this.right.isInStance(this.phase);
    if (inStance && !this.wasInStance) {
      // Heel just struck. Solve once with current pelvis to find where the foot contacts ground.
      const joints = this.right.solve(this.pelvis, this.phase);
      // Plant using the lowest foot point (toe or ankle), not the ankle alone,
      // so the sole sits on the ground rather than the ankle joint.
      const footDrop = Math.max(0, joints.toe.y - joints.ankle.y);
      this.plantedHeel = { x: joints.ankle.x, y: this.groundY - footDrop };
    }
    this.wasInStance = inStance;

    // 2. During stance, correct pelvis so the ankle stays planted
    if (inStance && this.plantedHeel) {
      const trial = this.right.solve(this.pelvis, this.phase);
      this.pelvis.x += this.plantedHeel.x - trial.ankle.x;
      this.pelvis.y += this.plantedHeel.y - trial.ankle.y;
    }
    // During swing: no constraint — pelvis holds position (causes the "skip")

    // 3. Solve for rendering
    this.rightJoints = this.right.solve(this.pelvis, this.phase);
  }
}
