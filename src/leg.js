import { hipAngle, kneeAngle, ankleAngle } from './gait.js';

export class Leg {
  constructor({ thighLength, shankLength, footLength, phaseOffset = 0 }) {
    this.thighLength = thighLength;
    this.shankLength = shankLength;
    this.footLength  = footLength;
    this.phaseOffset = phaseOffset;     // 0 for right leg, 0.5 for left
  }

  // Returns world-space joint positions for the given hip position and global phase.
  // Angle convention: 0 = straight down. Positive = leg swings forward (+x).
  solve(hipPos, globalPhase) {
    const phase = (globalPhase + this.phaseOffset) % 1;

    const thetaHip   = hipAngle(phase);
    const thetaKnee  = kneeAngle(phase);     // knee flex bends shank backward relative to thigh
    const thetaAnkle = ankleAngle(phase);     // ankle flex tilts foot relative to shank

    // Thigh vector: from hip, angled thetaHip from straight-down
    const thighDir = { x: Math.sin(thetaHip), y: Math.cos(thetaHip) };
    const knee = {
      x: hipPos.x + this.thighLength * thighDir.x,
      y: hipPos.y + this.thighLength * thighDir.y,
    };

    // Shank vector: thigh angle MINUS knee flex (knee bends the shank backward)
    const thetaShank = thetaHip - thetaKnee;
    const shankDir = { x: Math.sin(thetaShank), y: Math.cos(thetaShank) };
    const ankle = {
      x: knee.x + this.shankLength * shankDir.x,
      y: knee.y + this.shankLength * shankDir.y,
    };

    // Foot vector: perpendicular-ish to shank, modulated by ankle angle
    // At neutral ankle, foot points forward (+x). Plantarflexion rotates toe down.
    const thetaFoot = thetaShank + Math.PI / 2 - thetaAnkle;
    const footDir = { x: Math.sin(thetaFoot), y: Math.cos(thetaFoot) };
    const toe = {
      x: ankle.x + this.footLength * footDir.x,
      y: ankle.y + this.footLength * footDir.y,
    };

    return { hip: { ...hipPos }, knee, ankle, toe, footAngle: thetaFoot, phase };
  }

  isInStance(globalPhase) {
    const phase = (globalPhase + this.phaseOffset) % 1;
    return phase < 0.5;
  }
}
