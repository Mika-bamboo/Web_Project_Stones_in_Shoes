import { Leg } from './leg.js';

export class Walker {
  constructor(groundY) {
    this.right = new Leg({ thighLength: 90, shankLength: 90, footLength: 35, phaseOffset: 0 });

    this.phase = 0;
    this.cadence = 1.0;                  // gait cycles per second
    this.pelvis = { x: 0, y: 0 };       // fixed position, set by init()
    this.groundY = groundY;

    // Treadmill ground offset — scrolls left during stance
    this.groundOffset = 0;

    // Ankle x at heel-strike (in pelvis-relative coords) and ground offset at that moment
    this.plantedAnkleX = null;
    this.plantedGroundOffset = 0;

    this.wasInStance = true;
    this.rightJoints = null;
  }

  // Call after setting pelvis position. Bootstraps the constraint from frame 1.
  // Corrects pelvis.y so the foot sits exactly on the ground.
  init() {
    this.rightJoints = this.right.solve(this.pelvis, this.phase);

    // Find the lowest point of the foot and raise pelvis so it sits on groundY
    const lowestY = Math.max(this.rightJoints.ankle.y, this.rightJoints.toe.y);
    this.pelvis.y -= lowestY - this.groundY;

    this.rightJoints = this.right.solve(this.pelvis, this.phase);
    this.plantedAnkleX = this.rightJoints.ankle.x;
    this.plantedGroundOffset = this.groundOffset;
  }

  step(dt) {
    this.phase = (this.phase + dt * this.cadence) % 1;

    // Solve FK with fixed pelvis
    this.rightJoints = this.right.solve(this.pelvis, this.phase);

    // 1. Detect heel-strike: transition from swing to stance
    const inStance = this.right.isInStance(this.phase);
    if (inStance && !this.wasInStance) {
      this.plantedAnkleX = this.rightJoints.ankle.x;
      this.plantedGroundOffset = this.groundOffset;
    }
    this.wasInStance = inStance;

    // 2. During stance, scroll the ground so the ankle stays "planted" on it.
    //    The ankle moves in screen space (FK output), so the ground must shift
    //    by the same amount to keep the foot stationary relative to the ground.
    if (inStance && this.plantedAnkleX !== null) {
      const ankleDrift = this.rightJoints.ankle.x - this.plantedAnkleX;
      this.groundOffset = this.plantedGroundOffset + ankleDrift;
    }
    // During swing: ground holds position (single-leg "skip")
  }
}
