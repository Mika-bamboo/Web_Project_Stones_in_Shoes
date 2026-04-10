import { Leg } from './leg.js';

// Sole contact points in foot-local coordinates. These match the heel and
// ball-of-foot points on renderer.js's SNEAKER_PROFILE (y = +6 is the sole).
// The ball is deliberately inboard of the toe tip so the toe-tip can lift
// past it during the swing-leg kick.
const HEEL_LOCAL = { x: -8, y: 6 };
const TOE_LOCAL  = { x: 28, y: 6 };

// Project a foot-local point into world coordinates given a solved joint set.
// Uses the same rotation convention as renderer.js drawShoe:
//   canvas rotation θ = π/2 − joints.footAngle
function worldOfFootLocal(joints, local) {
  const theta = Math.PI / 2 - joints.footAngle;
  const c = Math.cos(theta), s = Math.sin(theta);
  return {
    x: joints.ankle.x + local.x * c - local.y * s,
    y: joints.ankle.y + local.x * s + local.y * c,
  };
}

export class Walker {
  constructor(groundY) {
    this.right = new Leg({ thighLength: 90, shankLength: 90, footLength: 35, phaseOffset: 0 });
    this.left  = new Leg({ thighLength: 90, shankLength: 90, footLength: 35, phaseOffset: 0.5 });

    this.phase = 0;
    this.cadence = 1.0;                  // gait cycles per second
    this.pelvis = { x: 200, y: 200 };    // corrected each frame by ground constraint
    this.groundY = groundY;

    // Where each leg's sole pivot is planted in world space (null = in swing).
    // The pivot starts as the heel at heel-strike and transitions to the
    // ball-of-foot once the foot has rolled past foot-flat.
    this.plantedContact = { right: null, left: null };
    this.pivotLocal     = { right: HEEL_LOCAL, left: HEEL_LOCAL };

    // The enforcedSide is the leg whose sole pivot currently drives the
    // pelvis. It flips at every heel-strike so the most recently planted
    // leg always wins — this avoids a snap-back at the end of double support.
    this.enforcedSide = 'right';

    // Track which leg was in stance last frame, to detect heel-strike events.
    this.wasInStance = { right: true, left: false };

    this.rightJoints = null;
    this.leftJoints  = null;
  }

  // Call after setting pelvis position to bootstrap the constraint from frame 1.
  init() {
    // Reset transient state so NaN-recovery re-enters a consistent state.
    this.plantedContact = { right: null, left: null };
    this.pivotLocal     = { right: HEEL_LOCAL, left: HEEL_LOCAL };
    this.enforcedSide   = 'right';
    this.wasInStance    = { right: true, left: false };

    // Solve the right leg once with the caller's initial pelvis guess, then
    // shift pelvis.y so the right heel sole sits exactly on the ground line.
    let rJoints = this.right.solve(this.pelvis, this.phase);
    const heel0 = worldOfFootLocal(rJoints, HEEL_LOCAL);
    this.pelvis.y += this.groundY - heel0.y;

    rJoints = this.right.solve(this.pelvis, this.phase);
    const heel1 = worldOfFootLocal(rJoints, HEEL_LOCAL);
    this.plantedContact.right = { x: heel1.x, y: this.groundY };

    this.rightJoints = rJoints;
    this.leftJoints  = this.left.solve(this.pelvis, this.phase);
  }

  step(dt) {
    this.phase = (this.phase + dt * this.cadence) % 1;

    // ── 1. Heel-strike detection ──
    // When a leg enters stance, plant its heel on the ground line and make
    // it the enforced side. Taking over enforcement at heel-strike (rather
    // than at toe-off of the other leg) means the newly planted foot is
    // anchored from the moment it touches the ground, avoiding any visible
    // snap-back at the end of the double-support window.
    for (const side of ['right', 'left']) {
      const inStance = this[side].isInStance(this.phase);
      if (inStance && !this.wasInStance[side]) {
        const trial = this[side].solve(this.pelvis, this.phase);
        const heelW = worldOfFootLocal(trial, HEEL_LOCAL);
        this.plantedContact[side] = { x: heelW.x, y: this.groundY };
        this.pivotLocal[side] = HEEL_LOCAL;
        this.enforcedSide = side;
      }
      this.wasInStance[side] = inStance;
    }

    // ── 2. Enforce the sole-pivot constraint on the enforced leg ──
    const stanceSide = this.enforcedSide;
    const stanceLeg  = this[stanceSide];
    const planted    = this.plantedContact[stanceSide];

    if (planted) {
      const trial = stanceLeg.solve(this.pelvis, this.phase);

      // 2a. Heel → toe-ball pivot transition. Once the foot has rolled past
      //     foot-flat (canvas rotation crosses zero), the ball of the foot
      //     becomes the lower sole point and takes over the pivot. We re-plant
      //     at (toeW.x, groundY) — using groundY rather than toeW.y so any
      //     sub-pixel drift is snapped out at the transition moment.
      if (this.pivotLocal[stanceSide] === HEEL_LOCAL) {
        const heelW = worldOfFootLocal(trial, HEEL_LOCAL);
        const toeW  = worldOfFootLocal(trial, TOE_LOCAL);
        if (toeW.y > heelW.y) {
          this.pivotLocal[stanceSide] = TOE_LOCAL;
          this.plantedContact[stanceSide] = { x: toeW.x, y: this.groundY };
        }
      }

      // 2b. Shift the pelvis so the current pivot sits exactly at its planted
      //     point. IK is translation-equivariant, so a pelvis delta propagates
      //     unchanged to every downstream joint and to the foot-local pivot.
      const pivotW = worldOfFootLocal(trial, this.pivotLocal[stanceSide]);
      const target = this.plantedContact[stanceSide];
      this.pelvis.x += target.x - pivotW.x;
      this.pelvis.y += target.y - pivotW.y;
    }

    // ── 3. Solve both legs with the corrected pelvis for rendering ──
    this.rightJoints = this.right.solve(this.pelvis, this.phase);
    this.leftJoints  = this.left.solve(this.pelvis, this.phase);
  }
}
