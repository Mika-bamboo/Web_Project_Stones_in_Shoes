# Gait Animation — Build Spec & Reference Implementation

This document is the authoritative spec for how the walking figure in the Stone-In-Shoe Simulator must be built. It supersedes any earlier animation guidance in `PROJECT_BLUEPRINT.md` Section 6 and `design-spec.md`.

**Hard rule:** No keyframed sprite transforms. No hand-tweened rotation values. Every joint position on screen must be the output of forward kinematics from a phase variable. If you find yourself writing `shoe.rotation = lerp(a, b, t)`, stop — you are doing it wrong.

---

## 1. Architectural overview

The figure is built bottom-up from a single scalar:

```
phase φ ∈ [0, 1)        ← the only state variable that "drives" walking
   ↓
joint angle curves       ← hipAngle(φ), kneeAngle(φ), ankleAngle(φ)
   ↓
forward kinematics       ← hip → knee → ankle → toe (per leg)
   ↓
ground constraint        ← solve pelvis x so the stance foot stays planted
   ↓
two-leg coupling         ← right leg at φ, left leg at φ + 0.5
   ↓
rendering                ← draw shoe & leg tubes in joint-local frames
   ↓
stone launch             ← stones inherit toe velocity at toe-off
```

Each layer is a pure function of the layer above it. Nothing is animated independently.

---

## 2. Gait cycle data

Joint angles come from Winter, *Biomechanics and Motor Control of Human Movement* (the standard reference for clinical gait data). The values below are a hand-simplified version — 11 samples per joint across one cycle, in degrees, sign convention "positive = flexion".

```js
// Phase 0.0 = right heel strike. Phase ~0.6 = right toe-off. Phase 1.0 = next right heel strike.
// Angles in degrees. Linearly interpolate between samples.

const GAIT_SAMPLES = {
  // Hip: flexed forward at heel strike, extends through stance, flexes again in swing
  hip:   [25,  20,  10,   0,  -5, -10,  -5,  10,  25,  30,  25],
  // Knee: small flex during loading, extends mid-stance, large flex in swing
  knee:  [ 5,  15,  10,   5,   5,  10,  35,  60,  55,  25,   5],
  // Ankle: dorsiflexes through stance, big plantarflexion at toe-off, recovers in swing
  ankle: [ 0,  -5, -10,  -5,   5,  15, -20, -10,  -5,   0,   0],
};

function sampleCurve(curve, phase) {
  const n = curve.length - 1;          // 10 intervals for 11 samples
  const x = phase * n;
  const i = Math.floor(x);
  const f = x - i;
  const a = curve[i % curve.length];
  const b = curve[(i + 1) % curve.length];
  return (a * (1 - f) + b * f) * Math.PI / 180;  // return radians
}

const hipAngle   = (φ) => sampleCurve(GAIT_SAMPLES.hip,   φ);
const kneeAngle  = (φ) => sampleCurve(GAIT_SAMPLES.knee,  φ);
const ankleAngle = (φ) => sampleCurve(GAIT_SAMPLES.ankle, φ);
```

These curves are *good enough* — not biomechanically perfect, but they produce visibly correct walking. Once the rest of the system is working you can refine them.

**Stance/swing split:** the right foot is in stance for `φ ∈ [0, 0.6)` and in swing for `φ ∈ [0.6, 1)`. Toe-off happens at `φ = 0.6`. Heel-strike is at `φ = 0`.

---

## 3. The `Leg` class — forward kinematics

A leg is two rigid segments (thigh, shank) plus a foot. Given the hip position and the current phase, it computes every joint location.

```js
class Leg {
  constructor({ thighLength, shankLength, footLength, phaseOffset = 0 }) {
    this.thighLength = thighLength;
    this.shankLength = shankLength;
    this.footLength  = footLength;
    this.phaseOffset = phaseOffset;     // 0 for right leg, 0.5 for left
  }

  // Returns world-space joint positions for the given hip and global phase.
  // Angle convention: 0 = straight down. Positive = leg swings forward (+x).
  solve(hipPos, globalPhase) {
    const φ = (globalPhase + this.phaseOffset) % 1;

    const θhip   = hipAngle(φ);
    const θknee  = kneeAngle(φ);     // knee flex bends shank backward relative to thigh
    const θankle = ankleAngle(φ);    // ankle flex tilts foot relative to shank

    // Thigh vector: from hip, angled θhip from straight-down
    const thighDir   = { x: Math.sin(θhip), y: Math.cos(θhip) };
    const knee = {
      x: hipPos.x + this.thighLength * thighDir.x,
      y: hipPos.y + this.thighLength * thighDir.y,
    };

    // Shank vector: thigh angle MINUS knee flex (knee bends the shank backward)
    const θshank = θhip - θknee;
    const shankDir = { x: Math.sin(θshank), y: Math.cos(θshank) };
    const ankle = {
      x: knee.x + this.shankLength * shankDir.x,
      y: knee.y + this.shankLength * shankDir.y,
    };

    // Foot vector: perpendicular-ish to shank, modulated by ankle angle
    // At neutral ankle, foot points forward (+x). Plantarflexion rotates toe down.
    const θfoot = θshank + Math.PI / 2 - θankle;
    const footDir = { x: Math.sin(θfoot), y: Math.cos(θfoot) };
    const toe = {
      x: ankle.x + this.footLength * footDir.x,
      y: ankle.y + this.footLength * footDir.y,
    };

    return { hip: { ...hipPos }, knee, ankle, toe, footAngle: θfoot, phase: φ };
  }

  isInStance(globalPhase) {
    const φ = (globalPhase + this.phaseOffset) % 1;
    return φ < 0.6;
  }
}
```

Three things to notice:

1. **No drawing happens here.** The leg returns coordinates. Rendering is a separate concern.
2. **Y points down** (Canvas convention). That's why `cos(θ)` is the y-component of a "down-ish" vector.
3. **`footAngle` is exposed** because the shoe sprite will be drawn rotated by it.

---

## 4. The ground constraint — the trick that makes it look right

If you just run `Leg.solve()` with a pelvis that moves at constant velocity, the stance foot will slide along the ground because the joint-angle curves don't produce a *perfectly* stationary foot — they produce *approximately* stationary foot, and approximately is not good enough. Your eye catches it instantly.

The fix: after every frame, *correct the pelvis position* so that the stance foot is exactly where it was at heel-strike.

```js
class Walker {
  constructor() {
    this.right = new Leg({ thighLength: 90, shankLength: 90, footLength: 35, phaseOffset: 0 });
    this.left  = new Leg({ thighLength: 90, shankLength: 90, footLength: 35, phaseOffset: 0.5 });

    this.phase = 0;
    this.cadence = 1.0;                  // gait cycles per second
    this.pelvis = { x: 200, y: 200 };    // will be corrected each frame
    this.groundY = 350;

    // Where each foot was planted at its most recent heel-strike
    this.plantedHeel = { right: null, left: null };

    // Track which leg was in stance last frame, to detect heel-strike events
    this.wasInStance = { right: true, left: false };
  }

  step(dt) {
    this.phase = (this.phase + dt * this.cadence) % 1;

    // ── 1. Detect heel-strike events and record the planted position ──
    for (const side of ['right', 'left']) {
      const leg = this[side];
      const inStance = leg.isInStance(this.phase);
      if (inStance && !this.wasInStance[side]) {
        // Heel just struck the ground. Solve once with current pelvis to find where.
        const joints = leg.solve(this.pelvis, this.phase);
        this.plantedHeel[side] = { x: joints.ankle.x, y: this.groundY };
      }
      this.wasInStance[side] = inStance;
    }

    // ── 2. Find the stance leg and correct the pelvis so its foot stays planted ──
    const stanceSide = this.right.isInStance(this.phase) ? 'right' : 'left';
    const stanceLeg  = this[stanceSide];
    const planted    = this.plantedHeel[stanceSide];

    if (planted) {
      // Solve forward kinematics with current pelvis, see where the ankle ends up,
      // then translate the pelvis by the difference so the ankle lands on `planted`.
      const trial = stanceLeg.solve(this.pelvis, this.phase);
      this.pelvis.x += planted.x - trial.ankle.x;
      this.pelvis.y += planted.y - trial.ankle.y;
    }

    // ── 3. Add a small vertical bob (twice per stride) for liveliness ──
    // This is purely cosmetic on top of the ground-constrained pelvis.
    // Comment it out if it fights the constraint visibly.
    // this.pelvis.y += Math.sin(this.phase * 4 * Math.PI) * 2;

    // ── 4. Solve both legs once more for rendering ──
    this.rightJoints = this.right.solve(this.pelvis, this.phase);
    this.leftJoints  = this.left .solve(this.pelvis, this.phase);
  }
}
```

**Why this works:** the pelvis is no longer an input to the simulation — it's an *output*. You ask "where must the hip be so that the foot I planted is still there?" and you put it there. The hip therefore slides forward over the planted foot exactly the way a real hip does over a real foot. Walking *is* this constraint.

When the swing leg eventually heel-strikes, `plantedHeel.left` (or right) gets recorded, the stance side flips, and the pelvis starts sliding over the new foot. Continuous, lock-free, no sliding.

---

## 5. Rendering — drawing the shoe in the foot's frame

The shoe is **not** a separate sprite that you position. It's a path drawn in a coordinate system where the ankle is at the origin and +x points along the foot. You then `ctx.translate` and `ctx.rotate` into that frame.

```js
function drawShoe(ctx, joints, shoeProfile) {
  ctx.save();
  ctx.translate(joints.ankle.x, joints.ankle.y);
  ctx.rotate(joints.footAngle - Math.PI / 2);  // align +x with foot direction

  // shoeProfile is an array of points in foot-local coordinates,
  // where (0, 0) is the ankle and (footLength, 0) is the toe tip.
  ctx.beginPath();
  ctx.moveTo(shoeProfile[0].x, shoeProfile[0].y);
  for (let i = 1; i < shoeProfile.length; i++) {
    ctx.lineTo(shoeProfile[i].x, shoeProfile[i].y);
  }
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.fillStyle = 'transparent';
  ctx.stroke();

  ctx.restore();
}

function drawLegTube(ctx, a, b, width = 16) {
  // Draw a rounded rectangle from a to b, perpendicular to ab
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len, ny = dx / len;     // perpendicular unit vector
  const w = width / 2;
  ctx.beginPath();
  ctx.moveTo(a.x + nx * w, a.y + ny * w);
  ctx.lineTo(b.x + nx * w, b.y + ny * w);
  ctx.lineTo(b.x - nx * w, b.y - ny * w);
  ctx.lineTo(a.x - nx * w, a.y - ny * w);
  ctx.closePath();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000';
  ctx.stroke();
}

function drawWalker(ctx, walker) {
  for (const joints of [walker.leftJoints, walker.rightJoints]) {
    drawLegTube(ctx, joints.hip,  joints.knee);
    drawLegTube(ctx, joints.knee, joints.ankle);
    drawShoe(ctx, joints, SNEAKER_PROFILE);
  }
}
```

Draw the **back leg first, front leg second** so the front leg occludes correctly. You can determine which is which by comparing `joints.ankle.x`.

---

## 6. Stone launch — toe velocity at toe-off

This is the part that connects the gait model to the actual phenomenon you're explaining.

```js
class StoneSystem {
  constructor() { this.stones = []; this.prevToe = { right: null, left: null }; }

  update(walker, dt) {
    // For each leg, check if we're at the toe-off moment
    for (const side of ['right', 'left']) {
      const leg = walker[side];
      const φ = (walker.phase + leg.phaseOffset) % 1;
      const joints = side === 'right' ? walker.rightJoints : walker.leftJoints;

      // Estimate toe velocity from finite difference
      if (this.prevToe[side]) {
        const vx = (joints.toe.x - this.prevToe[side].x) / dt;
        const vy = (joints.toe.y - this.prevToe[side].y) / dt;

        // Toe-off window: φ between 0.55 and 0.65
        if (φ > 0.55 && φ < 0.65 && joints.toe.y > walker.groundY - 5) {
          // Launch a stone from the toe with velocity proportional to toe velocity
          this.stones.push({
            x: joints.toe.x, y: joints.toe.y,
            vx: vx * 0.4,                    // tangential component
            vy: -Math.abs(vy) * 0.6 - 80,    // upward kick
            r: 3 + Math.random() * 3,
          });
        }
      }
      this.prevToe[side] = { ...joints.toe };
    }

    // Integrate stones under gravity
    const g = 600;  // px/s²
    for (const s of this.stones) {
      s.vy += g * dt;
      s.x  += s.vx * dt;
      s.y  += s.vy * dt;
    }

    // Remove stones that have left the world
    this.stones = this.stones.filter(s => s.y < walker.groundY + 50 && s.x > -100 && s.x < 2000);
  }
}
```

The key line is `vx = (joints.toe.x - this.prevToe[side].x) / dt`. The stone gets its initial velocity from the *actual measured motion of the toe*, not from a hand-picked launch vector. Because the toe motion came from the gait model, which came from the joint curves, the stone trajectory is causally connected to the walking motion. That's what makes it feel real.

---

## 7. The frame loop

```js
const walker = new Walker();
const stones = new StoneSystem();
let lastTime = performance.now();

function frame(now) {
  const dt = Math.min((now - lastTime) / 1000, 1 / 30);  // clamp to avoid huge jumps
  lastTime = now;

  walker.step(dt);
  stones.update(walker, dt);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGround(ctx, walker.groundY);
  drawWalker(ctx, walker);
  drawStones(ctx, stones.stones);

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

That's the entire animation loop. ~10 lines. All complexity lives in `Walker.step` and `Leg.solve`, which are themselves short, because the *model* is doing the work that keyframing would otherwise have to fake.

---

## 8. How to verify it's working

Build it incrementally and check each layer before moving to the next. If you skip steps, you'll spend hours debugging mystery jitter.

1. **Render only the right leg, no ground constraint.** Pelvis fixed in space. You should see the leg flex through a recognizable gait cycle in place — knee bending, foot lifting, foot planting. If this doesn't look right, the joint curves or forward kinematics are wrong. Don't proceed.
2. **Add the ground constraint, still one leg.** The pelvis should now slide forward over the planted foot, then "skip" forward when the foot lifts (because there's no other leg to take over). Ugly but correct.
3. **Add the second leg.** The skip disappears. The pelvis flows forward continuously. *This is the moment it starts looking like walking.* If it doesn't, the second leg's `phaseOffset` or stance detection is wrong.
4. **Add the shoe.** Should rotate correctly around the ankle through heel-off and toe-off. If the shoe slides relative to the foot, you're drawing it in world space instead of foot-local space.
5. **Add the stones.** Toe-off should kick stones forward and up.

At step 3 you should already feel the difference from the keyframed version. The walking will look mechanically plausible in a way that hand-tweening cannot achieve, because the geometric constraints that *make* walking walking are now baked into the math.

---

## 9. What this replaces in the existing docs

- `PROJECT_BLUEPRINT.md` §6.3 "Gait Cycle Model" — the t0–t4 keyframe list is descriptive only. The actual implementation is the code above.
- `PROJECT_BLUEPRINT.md` §9 "Natural-looking gait animation / Bézier curve interpolation" — replace with: forward kinematics from joint-angle curves with ground constraint. Bézier interpolation between hand-keyframed poses is exactly the wrong approach.
- `design-spec.md` — the scroll-driven storytelling structure is unchanged. Only the underlying animation engine changes. The "walking animation loops continuously while idle" requirement is now satisfied by running `Walker.step(dt)` every frame regardless of scroll state; scroll only gates the *stone-launching* logic in `StoneSystem.update`.

---

## 10. Instruction to hand to Claude Code

When you start the build session, paste this paragraph at the top:

> Build the walking figure as a 2-link IK chain per leg driven by gait-cycle joint-angle curves (hip, knee, ankle as functions of phase φ ∈ [0,1)), with a stance-foot ground constraint that derives the pelvis x-position from the planted foot rather than the other way around. Two legs share one pelvis at phase offset 0.5. The shoe is drawn in the foot's local coordinate frame, not as an independently transformed sprite. No keyframed sprite transforms anywhere. No `lerp(rotation_a, rotation_b, t)`. Stones inherit their initial velocity from the finite-difference velocity of the toe joint at the toe-off phase window. See `gait-model-spec.md` for the reference implementation — match its structure.

That paragraph forces the right architecture. The architecture is what makes the result look like Ciechanowski.
