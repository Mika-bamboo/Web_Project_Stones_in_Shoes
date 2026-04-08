// Gait cycle data — hand-simplified from Winter's biomechanics reference.
// 11 samples per joint across one cycle, in degrees.
// Phase 0.0 = right heel strike. Phase ~0.6 = right toe-off.

export const GAIT_SAMPLES = {
  // Hip: flexed forward at heel strike, extends through stance, flexes again in swing
  hip:   [25,  20,  10,   0,  -5, -10,  -5,  10,  25,  30,  25],
  // Knee: small flex during loading, extends mid-stance, large flex in swing
  knee:  [ 5,  15,  10,   5,   5,  10,  35,  60,  55,  25,   5],
  // Ankle: dorsiflexes through stance, big plantarflexion at toe-off, recovers in swing
  ankle: [ 0,  -5, -10,  -5,   5,  15, -20, -10,  -5,   0,   0],
};

export function sampleCurve(curve, phase) {
  const n = curve.length - 1;          // 10 intervals for 11 samples
  const x = phase * n;
  const i = Math.floor(x);
  const f = x - i;
  const a = curve[i % curve.length];
  const b = curve[(i + 1) % curve.length];
  return (a * (1 - f) + b * f) * Math.PI / 180;  // return radians
}

export const hipAngle   = (phase) => sampleCurve(GAIT_SAMPLES.hip,   phase);
export const kneeAngle  = (phase) => sampleCurve(GAIT_SAMPLES.knee,  phase);
export const ankleAngle = (phase) => sampleCurve(GAIT_SAMPLES.ankle, phase);
