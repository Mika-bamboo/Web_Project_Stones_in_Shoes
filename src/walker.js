// Walker, per gait-model-spec.md §4 "Simple approach: scrolling world".
//
// The pelvis stays at a fixed screen x. The walker advances a `worldX`
// counter each frame, which the renderer uses to scroll the ground backward.
// This sidesteps the hairy pelvis-correction story entirely — the stance
// foot never needs to stay planted in screen space because the ground is
// what moves.
//
// Ground clamp (added to address the sinking bug): after solving the legs
// at a tentative pelvis height, we compute the lowest world-space y of
// any sole point belonging to a stance foot and shift the pelvis so that
// point sits exactly on groundY. The legs are then re-solved. This is
// *not* a pelvis-correction constraint in the "stance foot stays planted
// in screen x" sense — it only touches pelvis.y. It prevents the shoe
// from cutting through the ground line at all phases.

import { solveLeg } from './leg.js?v=14';
import { SOLE_POINTS, SOLE_DEPTH } from './renderer.js?v=14';

const LEG_CONFIG = { thighLen: 80, shankLen: 80, footLen: 30 };

// Rough pelvis height for the first tentative solve. The per-frame clamp
// overrides this, so the exact value only matters for the first solve's
// numerical stability: thigh + shank + sole depth is a reasonable seed.
const PELVIS_SEED = LEG_CONFIG.thighLen + LEG_CONFIG.shankLen + SOLE_DEPTH;

// Per-side "shoe flash" timer used to render a brief red glow around a
// shoe when a stone enters it. stones.js calls walker.triggerShoeFlash()
// from _trapStone; the timer linearly decays in walker.update(); the
// renderer reads the intensity (0..1) via getShoeFlashIntensity() and
// blends a red overlay on top of the shoe outline.
const SHOE_FLASH_DURATION = 0.35;   // seconds

// Return the maximum (most-downward in canvas y-down) world y of any
// sole point on this leg's shoe, given the solved joint set.
// Uses the same rotation convention as renderer.js drawShoe:
//   canvas rotation θ = π/2 − leg.footAngle.
function lowestSoleY(leg) {
  const theta = Math.PI / 2 - leg.footAngle;
  const c = Math.cos(theta), s = Math.sin(theta);
  let maxY = -Infinity;
  for (const pt of SOLE_POINTS) {
    const y = leg.ankle.y + pt.x * s + pt.y * c;
    if (y > maxY) maxY = y;
  }
  return maxY;
}

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

    // Remaining flash time per side, in seconds. Decays each update().
    this.shoeFlash = { right: 0, left: 0 };
  }

  // Called by stones.js when a stone enters this shoe — fires a brief
  // red glow on the matching shoe.
  triggerShoeFlash(side) {
    this.shoeFlash[side] = SHOE_FLASH_DURATION;
  }

  // Linear flash intensity in [0, 1]; 0 means "no flash".
  getShoeFlashIntensity(side) {
    return this.shoeFlash[side] / SHOE_FLASH_DURATION;
  }

  update(dt) {
    // Advance the single driving variable.
    this.phase = (this.phase + dt * this.cadence) % 1;
    this.worldX += dt * this.cadence * this.strideLength;

    // Decay the per-shoe flash timers. Runs before stone entry detection
    // (which lives in stones.update, called after walker.update from
    // main.js), so a freshly-triggered flash starts at full strength
    // for that frame's render.
    this.shoeFlash.right = Math.max(0, this.shoeFlash.right - dt);
    this.shoeFlash.left  = Math.max(0, this.shoeFlash.left  - dt);

    // 1. Tentative solve at a rough standing height.
    this.pelvis = { x: this.pelvisX, y: this.groundY - PELVIS_SEED };
    const rightPhase = this.phase;
    const leftPhase  = (this.phase + 0.5) % 1;
    this.rightLeg = solveLeg(this.pelvis, rightPhase, LEG_CONFIG);
    this.leftLeg  = solveLeg(this.pelvis, leftPhase,  LEG_CONFIG);

    // 2. Ground clamp: find the lowest sole point among stance feet and
    //    shift pelvis.y so that point sits exactly on groundY.
    //    A leg is in stance while its local phase is below 0.6 (spec §2).
    //    Swing feet are excluded because they naturally lift above the
    //    ground and we don't want them to drag the pelvis down.
    const rightInStance = rightPhase < 0.6;
    const leftInStance  = leftPhase  < 0.6;

    let lowestY = -Infinity;
    if (rightInStance) {
      const y = lowestSoleY(this.rightLeg);
      if (y > lowestY) lowestY = y;
    }
    if (leftInStance) {
      const y = lowestSoleY(this.leftLeg);
      if (y > lowestY) lowestY = y;
    }

    if (lowestY > -Infinity) {
      // IK is translation-equivariant, so shifting pelvis.y by Δ shifts
      // every joint (and every sole point) by the same Δ. One re-solve
      // is enough to get the corrected joint set for rendering.
      const delta = this.groundY - lowestY;
      this.pelvis.y += delta;
      this.rightLeg = solveLeg(this.pelvis, rightPhase, LEG_CONFIG);
      this.leftLeg  = solveLeg(this.pelvis, leftPhase,  LEG_CONFIG);
    }
  }
}
