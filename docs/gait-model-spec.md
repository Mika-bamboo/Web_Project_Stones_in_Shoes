# Gait Animation — Build Spec (Simplified)

This document is the authoritative spec for how the walking figure in the Stone-In-Shoe Simulator must be built. It supersedes any earlier animation guidance in `PROJECT_BLUEPRINT.md` Section 6 and `design-spec.md`.

---

## 1. Core idea

The entire walk is driven by **one number**: `phase` (0 to 1). Everything on screen — joint positions, shoe angle, pelvis height — is a function of phase. Two legs share the same phase, offset by 0.5.

```
phase φ ∈ [0, 1)         ← advances with time (or scroll)
   ↓
joint positions           ← lookup/interpolate from keyframe tables
   ↓
rendering                 ← draw legs + shoes at those positions
   ↓
stone launch              ← measure toe velocity at toe-off, launch stones
```

**The implementation approach is flexible.** You can use forward kinematics from angle curves, direct position keyframes, or a hybrid. What matters is that `phase` is the single input and the output looks like walking.

---

## 2. Gait cycle timing

One full cycle = one complete stride (right heel strike → next right heel strike).

| Phase | Event | What happens |
|-------|-------|-------------|
| 0.0 | Right heel strike | Right foot contacts ground, begins stance |
| 0.0–0.6 | Right stance | Right foot on ground, body rolls forward over it |
| 0.5 | Left heel strike | Left foot contacts ground (half-cycle offset) |
| 0.6 | Right toe-off | Right foot lifts off — **this is when stones get kicked** |
| 0.6–1.0 | Right swing | Right foot in the air, swinging forward |
| 1.0 | Right heel strike again | Cycle repeats |

The left leg does the same thing but offset by 0.5 in phase.

---

## 3. Recommended approach: angle-driven legs

Each leg has three joints (hip, knee, ankle) whose angles vary with phase. Sample values below come from simplified biomechanics data. **These are starting points — tune them until the walk looks right.**

```js
// 11 evenly-spaced samples across one gait cycle, in degrees.
// Linearly interpolate between samples. First and last value should match for looping.
const GAIT = {
  // Hip angle: positive = leg forward, negative = leg back
  hip:   [25,  20,  10,   0,  -5, -10,  -5,  10,  25,  30,  25],
  // Knee angle: positive = knee bent
  knee:  [ 5,  15,  10,   5,   5,  10,  35,  60,  55,  25,   5],
  // Ankle angle: positive = toes up (dorsiflexion), negative = toes down (plantarflexion)
  ankle: [ 0,  -5, -10,  -5,   5,  15, -20, -10,  -5,   0,   0],
};

// Interpolate a sample array at a given phase (0–1)
function sampleAt(curve, phase) {
  const n = curve.length - 1;
  const x = phase * n;
  const i = Math.floor(x);
  const f = x - i;
  return curve[i % curve.length] * (1 - f) + curve[(i + 1) % curve.length] * f;
}
```

### Forward kinematics (simplified)

Given angles in degrees, compute joint positions. Y-axis points down (Canvas convention).

```js
function solveLeg(hipPos, phase, config) {
  const { thighLen, shankLen, footLen } = config;

  // Get angles in radians
  const hipDeg   = sampleAt(GAIT.hip, phase);
  const kneeDeg  = sampleAt(GAIT.knee, phase);
  const ankleDeg = sampleAt(GAIT.ankle, phase);

  const hipRad   = hipDeg * Math.PI / 180;
  const kneeRad  = kneeDeg * Math.PI / 180;
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
  // At 0° ankle, foot is perpendicular to shank (pointing forward).
  // Positive ankle angle (dorsiflexion) tilts toes up.
  const footAngle = shankAngle + Math.PI / 2 - ankleRad;
  const toe = {
    x: ankle.x + footLen * Math.sin(footAngle),
    y: ankle.y + footLen * Math.cos(footAngle),
  };

  return { hip: hipPos, knee, ankle, toe, footAngle };
}
```

### If the FK math gives you trouble

The angle chain above (`thighAngle → shankAngle → footAngle`) is the most common source of bugs. If you can't get it working correctly, here's a **simpler fallback**: keyframe the *positions* directly instead of computing them from angles.

Record `{ knee, ankle, toe }` positions relative to the hip for each of the 11 phase samples, then just interpolate between them. This gives up some mathematical elegance but is much harder to get wrong. You can extract these positions by running the FK once with known-correct code, logging the outputs, and baking them into a table.

---

## 4. Making the walk move forward: the ground rule

The walker needs to move across the screen. The key constraint: **the stance foot must not slide on the ground.** 

### Simple approach: scrolling world

Instead of moving the pelvis and correcting it, keep the walker roughly centered and scroll the ground backward. This is simpler and avoids the pelvis-correction bugs entirely.

```js
class Walker {
  constructor(groundY) {
    this.phase = 0;
    this.groundY = groundY;
    this.worldX = 0;           // how far the walker has traveled (for scrolling ground)
    this.strideLength = 120;   // pixels per full gait cycle — tune to match leg reach
  }

  update(dt, speed) {
    // Advance phase
    const cadence = speed;   // cycles per second
    this.phase = (this.phase + dt * cadence) % 1;
    this.worldX += dt * cadence * this.strideLength;

    // Pelvis stays at a fixed screen X, but bobs vertically
    const pelvisX = 300;     // or wherever you want the walker centered
    const pelvisBaseY = this.groundY - 170;   // tune for leg lengths
    const bob = -Math.abs(Math.sin(this.phase * 2 * Math.PI)) * 4;
    const pelvis = { x: pelvisX, y: pelvisBaseY + bob };

    // Solve both legs
    const config = { thighLen: 80, shankLen: 80, footLen: 30 };
    this.rightLeg = solveLeg(pelvis, this.phase, config);
    this.leftLeg  = solveLeg((this.phase + 0.5) % 1, config);

    // Ground offset for rendering — everything except the walker scrolls
    this.groundOffset = this.worldX;
  }
}
```

### Better approach: pelvis correction (if you want the walker to actually walk across the screen)

After solving the stance leg, check where its ankle ended up. Shift the pelvis so the ankle sits at the correct planted position on the ground. This is what makes the walk look real — the hip rolls over the planted foot.

```js
// After solving the stance leg:
const stanceAnkle = stanceLeg.ankle;
const correction = plantedAnkleX - stanceAnkle.x;
pelvis.x += correction;
// Re-solve both legs with the corrected pelvis
```

This is more realistic but also more bug-prone. **Get the simple version working first**, then upgrade if needed.

---

## 5. Drawing the shoe

The shoe is drawn relative to the ankle, rotated by the foot angle. This ensures it moves with the foot naturally.

```js
function drawShoe(ctx, ankle, footAngle, shoeProfile) {
  ctx.save();
  ctx.translate(ankle.x, ankle.y);
  ctx.rotate(footAngle - Math.PI / 2);  // rotate so foot-forward = screen-right

  // Draw the shoe profile in local coordinates
  // (0,0) = ankle, positive X = toward toe
  ctx.beginPath();
  ctx.moveTo(shoeProfile[0].x, shoeProfile[0].y);
  for (const pt of shoeProfile.slice(1)) {
    ctx.lineTo(pt.x, pt.y);
  }
  ctx.closePath();
  ctx.stroke();

  ctx.restore();
}
```

A basic sneaker profile to start with:

```js
const SNEAKER = [
  { x: -8, y: -15 },   // back of heel, above ankle
  { x: -12, y: 0 },    // back of heel, at ankle level
  { x: -12, y: 12 },   // bottom of heel
  { x: 30, y: 12 },    // sole, toward toe
  { x: 35, y: 5 },     // toe cap
  { x: 35, y: -2 },    // top of toe
  { x: 15, y: -8 },    // top of vamp
  { x: 5, y: -12 },    // throat / lace area
  { x: -5, y: -15 },   // collar, back toward ankle
];
```

Tune these numbers until the shoe looks right. The exact shape matters less than getting it attached to the ankle correctly.

---

## 6. Stone launch at toe-off

When a leg passes through the toe-off phase (around φ = 0.55–0.65), measure the toe's velocity by comparing its position to the previous frame, and launch a stone with that velocity.

```js
// Each frame, for each leg:
if (prevToePos) {
  const vx = (toe.x - prevToePos.x) / dt;
  const vy = (toe.y - prevToePos.y) / dt;
  
  const legPhase = (globalPhase + offset) % 1;
  if (legPhase > 0.55 && legPhase < 0.65) {
    launchStone(toe.x, toe.y, vx * 0.4, -Math.abs(vy) * 0.6 - 80);
  }
}
prevToePos = { x: toe.x, y: toe.y };
```

Stones are then simple projectiles under gravity. Nothing fancy needed.

---

## 7. Build order

Build and verify each step before moving to the next. Don't skip ahead.

1. **One leg, fixed pelvis, no ground.** Just render the right leg cycling through its gait. You should see it swing back and forth. If the knee bends the wrong way or the foot points up when it should point down, fix the angle math here.

2. **Add the shoe.** It should rotate with the foot through the whole cycle. If it slides or detaches, the `ctx.translate/rotate` in `drawShoe` is wrong.

3. **Add the second leg** at phase offset 0.5. Both legs should move in opposition.

4. **Add forward motion.** Either scroll the ground or implement pelvis correction. The stance foot must not slide.

5. **Add stones.** They should launch from the toe at toe-off and arc through the air.

---

## 8. Configuration reference

Suggested starting values (all in pixels, tune freely):

| Parameter | Value | Notes |
|-----------|-------|-------|
| Thigh length | 80 | Hip to knee |
| Shank length | 80 | Knee to ankle |
| Foot length | 30 | Ankle to toe |
| Ground Y | 350 | On a 400px-tall canvas |
| Pelvis Y | ~170px above ground | Depends on leg lengths |
| Stride length | 120 | Pixels per full cycle |
| Cadence | 1.0 | Cycles per second |
| Canvas size | 680 × 420 | From design spec |

---

## 9. What this replaces

- `PROJECT_BLUEPRINT.md` §6.3 "Gait Cycle Model" — use this spec instead.
- The scroll-driven storytelling structure in `design-spec.md` is unchanged. Only the animation engine is covered here.
- The "walking animation loops continuously while idle" requirement is satisfied by running the walker update every frame; scroll only gates stone launching.

---

## 10. Instruction for Claude Code

> Build a walking animation driven by a single `phase` variable (0–1). Two legs at phase offset 0.5. Each leg's joint angles (hip, knee, ankle) are interpolated from 11-sample lookup tables. Compute joint positions via forward kinematics or direct interpolation — whichever produces correct results faster. The shoe is drawn in the foot's local coordinate frame using ctx.translate/rotate. Stones launch from the toe at the toe-off phase window, inheriting the toe's measured velocity. See `gait-model-spec.md` for sample data and build order. **Build and verify one step at a time per the build order in section 7.**

---

*Last updated: 2026-04-10*
