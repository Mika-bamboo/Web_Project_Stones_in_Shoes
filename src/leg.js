// Forward kinematics for a single leg, per gait-model-spec.md §3.
// Y-axis points down (Canvas convention).

import { GAIT, sampleAt } from './gait.js?v=28';

// Given a hip position, a phase in [0, 1), and a leg geometry `config`
// ({ thighLen, shankLen, footLen }), compute joint positions and footAngle.
export function solveLeg(hipPos, phase, config) {
  const { thighLen, shankLen, footLen } = config;

  // Sample the joint-angle curves at this phase.
  const hipDeg   = sampleAt(GAIT.hip,   phase);
  const kneeDeg  = sampleAt(GAIT.knee,  phase);
  const ankleDeg = sampleAt(GAIT.ankle, phase);

  const hipRad   = hipDeg   * Math.PI / 180;
  const kneeRad  = kneeDeg  * Math.PI / 180;
  const ankleRad = ankleDeg * Math.PI / 180;

  // Thigh hangs from hip. 0° = straight down. Positive = forward.
  const thighAngle = hipRad;
  const knee = {
    x: hipPos.x + thighLen * Math.sin(thighAngle),
    y: hipPos.y + thighLen * Math.cos(thighAngle),
  };

  // Shank hangs from knee. Knee flexion bends it backward (behind the thigh).
  const shankAngle = thighAngle - kneeRad;
  const ankle = {
    x: knee.x + shankLen * Math.sin(shankAngle),
    y: knee.y + shankLen * Math.cos(shankAngle),
  };

  // Foot extends forward from ankle.
  // At 0° ankle, foot is perpendicular to shank (pointing forward in world).
  const footAngle = shankAngle + Math.PI / 2 - ankleRad;
  const toe = {
    x: ankle.x + footLen * Math.sin(footAngle),
    y: ankle.y + footLen * Math.cos(footAngle),
  };

  return { hip: { ...hipPos }, knee, ankle, toe, footAngle };
}
