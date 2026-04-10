// Gait cycle data, per gait-model-spec.md §3.
// 11 evenly-spaced samples across one gait cycle, in degrees.
// First and last sample match so the curve loops seamlessly.

export const GAIT = {
  // Hip angle: positive = leg forward, negative = leg back
  hip:   [25,  20,  10,   0,  -5, -10,  -5,  10,  25,  30,  25],
  // Knee angle: positive = knee bent
  knee:  [ 5,  15,  10,   5,   5,  10,  35,  60,  55,  25,   5],
  // Ankle angle (per spec formula `footAngle = shankAngle + π/2 − ankleRad`,
  // a positive value rotates the foot toward straight-down = plantarflex).
  // The values below are the spec's starting curve.
  ankle: [ 0,  -5, -10,  -5,   5,  15, -20, -10,  -5,   0,   0],
};

// Linearly interpolate a sample array at a given phase in [0, 1).
// n = curve.length − 1 is the number of intervals.
export function sampleAt(curve, phase) {
  const n = curve.length - 1;
  const x = phase * n;
  const i = Math.floor(x);
  const f = x - i;
  return curve[i % curve.length] * (1 - f) + curve[(i + 1) % curve.length] * f;
}
