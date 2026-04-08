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
      // Heel just struck. Record the ankle x where the foot planted.
      const joints = this.right.solve(this.pelvis, this.phase);
      this.plantedHeel = { x: joints.ankle.x };
    }
    this.wasInStance = inStance;

    // 2. During stance, correct only pelvis X so the ankle stays planted horizontally.
    //    Pelvis Y stays fixed — vertical position is set at init.
    if (inStance && this.plantedHeel) {
      const trial = this.right.solve(this.pelvis, this.phase);
      this.pelvis.x += this.plantedHeel.x - trial.ankle.x;
    }
    // During swing: no constraint — pelvis holds position (causes the "skip")

    // 3. Solve for rendering
    this.rightJoints = this.right.solve(this.pelvis, this.phase);
  }
}
