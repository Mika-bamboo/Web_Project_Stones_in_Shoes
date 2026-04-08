// Gait cycle data — hand-simplified from Winter's biomechanics reference.
// 11 samples per joint across one cycle, in degrees.
// Phase 0.0 = right heel strike. Phase 0.5 = stance/swing boundary.
//
// Stone launch window: φ ∈ [0.45, 0.50) — late stance, before the
// stance handoff. The toe is ~6px above ground with forward+upward
// velocity from the rolling motion. The spec's original [0.55, 0.65]
// was shifted earlier because the FK model places the toe below
// ground at toe-off due to geometric mismatch during stance handoff.

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

// Stone launch window (per-leg effective phase)
export const LAUNCH_WINDOW = [0.45, 0.50];
