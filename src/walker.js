// Walker, per gait-model-spec.md §4 "Simple approach: scrolling world".
//
// The pelvis stays at a fixed screen x. The walker advances a `worldX`
// counter each frame, which the renderer uses to scroll the ground backward.
// This sidesteps pelvis-correction bugs entirely — the stance foot never
// needs to stay planted in screen space because the ground is what moves.

import { solveLeg } from './leg.js';

const LEG_CONFIG = { thighLen: 80, shankLen: 80, footLen: 30 };

export class Walker {
  constructor(groundY) {
    this.phase = 0;
    this.cadence = 1.0;        // gait cycles per second
    this.groundY = groundY;
    this.worldX = 0;           // distance walked in world units (ground scroll)
    this.strideLength = 120;   // world px per full gait cycle
    this.pelvisX = 300;        // fixed screen x where the walker is centered

    this.pelvis = null;
    this.rightLeg = null;
    this.leftLeg  = null;
  }

  update(dt) {
    // Advance the single driving variable.
    this.phase = (this.phase + dt * this.cadence) % 1;
    this.worldX += dt * this.cadence * this.strideLength;

    // Pelvis stays at a fixed screen x, with a small vertical bob that
    // peaks twice per cycle (once for each leg's mid-stance). The sign
    // is negative so the pelvis lifts *upward* (smaller y in canvas y-down).
    const pelvisBaseY = this.groundY - 170;
    const bob = -Math.abs(Math.sin(this.phase * 2 * Math.PI)) * 4;
    this.pelvis = { x: this.pelvisX, y: pelvisBaseY + bob };

    // Solve both legs from the shared pelvis at their respective phase offsets.
    this.rightLeg = solveLeg(this.pelvis, this.phase,                     LEG_CONFIG);
    this.leftLeg  = solveLeg(this.pelvis, (this.phase + 0.5) % 1,         LEG_CONFIG);
  }
}
