# Act 3 — 3D Shoe & Collar Gap Build Spec

This document is the authoritative spec for Act 3 of the Stone-In-Shoe Simulator. Act 3 is the only act that renders in 3D; Acts 1, 2, 4, 5, 6 remain 2D Canvas as defined in `design-spec.md`. The transition into Act 3 is an editorial cut — the camera "zooms in" on the ankle area, and the user lands in a 3D scene.

This spec supersedes earlier Act 3 guidance in `design-spec.md` only with respect to **rendering**. The pedagogical goals (showing the collar gap mechanism, the collar-height and heel-notch sliders, scroll-triggered stone entry) are unchanged.

---

## 1. Why 3D, and why only Act 3

The collar gap is the "aha" moment of the whole article — stones enter through the rhythmic gap between the topline edge and the ankle. Communicating this requires the user to *see the gap as a real opening in space*, not as a thin line in a side-view diagram. A 2D cross-section can show the gap, but it cannot convey "this is a hole that wraps around the back of the foot." 3D can.

The rest of the article doesn't need 3D. The walking animation, the kick-up parabolas, the shoe comparisons, the bar chart — all of these read perfectly well in 2D line art. Introducing 3D only here is deliberate: it signals "look closer, this is the important part."

---

## 2. Core idea

Act 3 is a single Three.js scene. The scene contains a **leg**, a **shoe**, **stones**, and an **orbit camera**. Everything in the scene is driven by parameters:

```
phase φ ∈ [0, 1)              ← gait phase (same as 2D walker)
collarHeight                  ← user slider
heelNotchWidth                ← user slider
+ a small number of fixed shape parameters
   ↓
parametric shoe geometry       ← rebuilt when any parameter changes
   ↓
collar curve (closed 3D loop)  ← the topline edge in world space
   ↓
collar-gap collision           ← stones that cross the curve fall in
```

The shoe is **not** a loaded 3D model. It is built in code from a handful of numbers. This is the single most important architectural decision in this spec, and the rationale is the same as for the gait model: parameters that the user controls must drive geometry directly, with no asset-pipeline round-trip in between.

**Implementation is flexible.** Three.js gives you many ways to build parametric geometry — extruded shapes, lathed curves, custom `BufferGeometry`, `ExtrudeGeometry` with shape paths, even constructive solid geometry. Pick whatever produces a recognizable shoe with the right parameter hooks. Don't get stuck trying to make it photoreal.

---

## 3. The shoe, structurally

A shoe is built from these pieces:

| Part | Geometry | Driven by |
|------|----------|-----------|
| Sole | Flat extruded shape, ~1cm thick | Fixed footprint shape |
| Vamp | Curved surface covering the toe/forefoot | Fixed |
| Quarter | Side walls rising from the sole | `collarHeight` |
| Collar | Top edge curve of the quarter | `collarHeight`, `heelNotchWidth`, `gapOpening(phase)` |
| Tongue | Small flap at the throat | Fixed (or omit in V1) |

The **collar** is the star. Everything else can be relatively crude and still look like a shoe. The collar is what the user is here to see.

### The collar curve

Think of the collar as a closed loop traced around the top opening of the shoe. Sample it at, say, 32 points around the perimeter. Each point's height above the sole is a function of where it is on the loop:

- **Front of shoe (over the toe)**: low — the vamp covers the foot here.
- **Sides**: medium — rises up to the collar height.
- **Back (behind heel)**: dips down — this is the heel notch, controlled by `heelNotchWidth`.
- **Inside (medial side) and outside (lateral side)**: roughly symmetric for V1.

A starting parameterization (angles around the foot, 0° = forward over toe, 180° = behind heel):

```js
function collarHeightAt(angle, collarHeight, heelNotchWidth) {
  // angle in radians, 0 = forward
  // collarHeight in cm (slider, ~3–10)
  // heelNotchWidth: 0 = no notch, 1 = deep notch

  const back = Math.cos(angle);              // +1 at back, -1 at front
  const side = Math.abs(Math.sin(angle));    // 1 on sides, 0 front/back

  // Base collar height on sides
  let h = collarHeight * (0.3 + 0.7 * side);

  // Heel notch dips the back down
  if (back > 0) {
    h -= back * heelNotchWidth * collarHeight * 0.6;
  }

  return Math.max(h, 0.5);  // floor so it doesn't collapse
}
```

These numbers are starting points. Tune them until the silhouette reads correctly. The point is: the shape is *declared*, not animated. If the collar looks wrong, fix the function, don't add patches.

### The gap opening

This is the part that animates with phase. The collar doesn't change *height* with the gait cycle — it changes how far it sits from the ankle. When the foot flexes, the topline edge separates from the leg, creating the gap.

```js
// 11-sample table, same convention as gait curves.
// Values 0..1: 0 = collar touches ankle, 1 = collar is fully open.
// Peaks around toe-off and swing (foot lifted, calf muscles flexed differently);
// minima around heel-strike and foot-flat (foot seated firmly).
const GAP_OPENING = [0.2, 0.1, 0.1, 0.2, 0.4, 0.7, 0.9, 0.8, 0.6, 0.4, 0.2];

function gapOpeningAt(phase) {
  return sampleAt(GAP_OPENING, phase);  // same sampleAt() as gait spec
}
```

How this number is *applied* is up to the implementer. A straightforward approach: offset each collar vertex outward (away from the ankle's central axis) by `gapOpeningAt(phase) * MAX_GAP` cm. The collar visibly breathes.

These values are pedagogically tuned, not biomechanically exact. The real bellows effect is smaller than this — we exaggerate it so the user can *see* what they're being told about. That's a deliberate explorable-explanation choice, not a bug.

---

## 4. The leg

The leg in Act 3 doesn't need to walk across the screen — Act 3 is a close-up. It just needs to flex through one gait cycle in place so the user sees the collar gap breathing with it.

**Simplest viable leg**: two cylinders (thigh, shank) plus an ankle joint, animated with the existing `hipAngle / kneeAngle / ankleAngle` curves from `gait-model-spec.md`. Reuse the curves verbatim — don't re-derive them. The forward kinematics in 3D is the 2D math with a fixed Z coordinate.

The leg can be cut off at mid-thigh (Act 3 is a close-up, the full leg isn't needed) and rendered with the same toon material as the shoe.

---

## 5. Rendering style — staying consistent with the rest of the article

The other acts are **black-and-white line art with a coral accent for stones**. Act 3 needs to feel like the same article, not like a different product.

**Use toon shading + outlines, not realistic shading.**

- Materials: `MeshToonMaterial` or a simple shader with 2–3 hard-edged shading bands. White or very light grey for the shoe body. No gradients, no reflections, no PBR.
- Outlines: render each mesh twice — once with the toon material front-facing, once with a black "inverted hull" backface for the outline. This is the standard NPR-outline trick in Three.js. Alternatively use `OutlineEffect` from `postprocessing`.
- Lighting: a single directional light from upper-front and a soft ambient. No shadows in V1 — shadows pull the visual style toward realism, which is the wrong direction.
- Background: same as the article background (white in light mode, near-black in dark mode). The 3D scene should feel embedded in the page, not floating in a separate window.
- Stones: same coral `#D85A30` as elsewhere. Same flat-shaded look. They're the only colored thing in the scene, as in every other act.

If the toon outlines fight you, fall back to a single flat material with a wireframe overlay for edge definition. Less elegant, but still consistent.

**Camera and controls.**

- Default view: 3/4 angle showing the side of the foot, slightly above. Roughly what the Ciechanowski-style widgets do.
- `OrbitControls` enabled. The user can rotate, but with constraints: lock the camera so it can't go below the ground plane or invert. Zoom limited to a sensible range.
- Camera frames the shoe + ankle area; the rest of the leg fades out at the top of the viewport (either by being cut off or via a fog gradient).

---

## 6. Stones in Act 3

For Act 3, stones live in the 3D scene as small 3D objects (e.g. `IcosahedronGeometry` with low subdivision, looks pleasantly faceted). They're spawned and integrated separately from the 2D `stones.js` system used in the other acts. This is fine — Act 3 is a self-contained scene; trying to share state with the 2D physics doesn't pay off.

**Spawn rule (same logic as 2D, lifted to 3D):**

- When the user scrolls within the Act 3 viewport, spawn stones near the ground around the foot.
- Each stone gets an initial upward velocity component (faking the kick-up effect from earlier acts) plus a small horizontal component aimed roughly at the collar opening.
- Stones are simple ballistic projectiles: position += velocity * dt, velocity.y -= g * dt.

**Collar-gap collision (the real physics moment):**

Each frame, for each in-flight stone:
1. Test whether the stone's position is inside the closed curve traced by the current collar (in 3D). A point-in-polygon test on the collar's projected outline at the stone's current height works well enough.
2. If yes, and the stone is moving downward, mark it as "entered." It then drops into the shoe interior (you can fade it out or let it settle visibly inside).
3. If no, the stone bounces off the shoe upper or falls past.

The collar curve is already exposed as `shoe.collarCurve` (32 points in world space). Checking against it is straightforward.

**Counter UI**: the same coral-badge "N stones entered" pattern from Act 1, overlaid on top of the 3D canvas as a normal DOM element. Don't try to render text in Three.js for this — DOM overlay is simpler and matches the rest of the article's UI.

---

## 7. Sliders and live update

Act 3 introduces two sliders: **collar height** and **heel notch width**. When the user moves either, the shoe rebuilds immediately. This is the moment the user discovers cause-and-effect.

The cost of rebuilding the shoe is small (one parametric shape, ~hundreds of vertices). Don't try to mutate vertices in place — rebuild the geometry each time. Cleaner code, no measurable perf cost.

If the rebuild causes a visible flicker, you're regenerating textures or recompiling shaders. Cache the material; only the geometry should rebuild.

---

## 8. Build order

Verify each step before moving to the next. The same verification ladder that worked for the gait spec applies here.

1. **Empty Three.js scene** in the Act 3 viewport. Background matches the page. A single test cube renders correctly and orbits with the camera. If the scene doesn't appear or sizing is wrong, fix that first — don't proceed.
2. **Static shoe, fixed parameters.** Build the parametric shoe with hardcoded `collarHeight` and `heelNotchWidth`. It should look like a shoe from a 3/4 angle. Ugly is fine; recognizable is required.
3. **Hook up the sliders.** Moving them rebuilds the shoe in real time. Collar gets taller/shorter, heel notch gets deeper/shallower. This is the moment the procedural approach pays off.
4. **Add the leg, static phase.** Cylinders for thigh and shank, ankle joint. Fixed at phase 0 (heel-strike pose). Confirm the foot meets the shoe correctly.
5. **Animate phase.** Leg flexes through the gait cycle on a timer. Collar gap breathes via `gapOpeningAt(phase)`. **This is the visual centerpiece** — if it looks right here, the rest is mechanical.
6. **Add stones.** Scroll-triggered spawn. Ballistic motion. They bounce off the shoe and land around the foot.
7. **Add collar-gap collision.** Stones that cross the collar curve get marked as entered. Counter increments.

Steps 1–5 should produce something that already justifies the 3D investment, before stones are involved at all.

---

## 9. What you don't need (yet, or ever)

The temptation with 3D is to keep adding fidelity. Resist it. The following are **explicitly out of scope** for V1, and probably forever:

- **Realistic materials.** No PBR, no normal maps, no reflections. Toon shading only.
- **Shadows.** They look nice but break the line-art style.
- **A loaded 3D model.** No Blender, no glTF, no FBX. Pure procedural geometry.
- **A rigged mesh.** The shoe doesn't have bones; it has parameters that rebuild geometry.
- **Cloth simulation on the tongue.** The tongue can be a static flap or omitted entirely.
- **Sole tread.** A flat sole is fine.
- **Lacing detail.** Suggested with a few lines on the vamp; not actual interlaced geometry.
- **Foot inside the shoe.** The shoe is "worn" by the leg without an actual foot mesh. The collar gap shows the leg behind it, which is correct.
- **Anatomical accuracy of the leg.** Two cylinders is fine. A thigh that tapers slightly is a nice-to-have, not a requirement.

If something on this list starts feeling necessary mid-build, stop and ask first. Adding fidelity usually doesn't fix the real problem (which is almost always "the architecture is wrong" or "the parameter is wrong").

---

## 10. Integration with the rest of the article

Act 3 is its own Three.js renderer attached to its own canvas inside the Act 3 section. It does **not** share state with the 2D walker or stone system used in Acts 1, 2, 6.

- **When the user is not in the Act 3 viewport**, pause the Three.js render loop. Use `IntersectionObserver` to detect viewport entry/exit. Resume when it scrolls back in.
- **State that does cross acts** (e.g. the user's collar-height preference, if you want sliders to persist) lives in a small global store. Keep it tiny.
- **The transition into Act 3** is currently editorial — a scroll jump from 2D Act 2 to 3D Act 3. A nice-to-have is a brief fade or zoom transition, but it isn't required for the explanation to work.

---

## 11. Risks and what to do about them

| Risk | Mitigation |
|---|---|
| Toon shading + outlines look bad with the procedural geometry | Fall back to flat-shaded white surfaces + black wireframe overlay. Less polished, still consistent. |
| Three.js bundle size hurts page load | Tree-shake aggressively. Import only what you use. Lazy-load the Three.js module when the user scrolls near Act 3. |
| Mobile performance | Cap pixel ratio at 2. Use lower geometry resolution on mobile. Test on a real phone before declaring done. |
| The shoe doesn't look like a shoe | This is the most likely failure mode. The fix is iteration on `collarHeightAt()` and the sole/vamp shapes — not "add more detail." Get someone to sanity-check the silhouette early. |
| Collar gap breathing looks fake | Tune `GAP_OPENING` table. The opening amplitude is a free parameter; bigger reads more clearly even if it's biomechanically exaggerated. Explorable explanations exaggerate on purpose. |
| Orbit controls let the user break the scene (upside-down view, etc.) | Constrain polar angle range. Constrain zoom range. The user can rotate but not get lost. |

---

## 12. Configuration reference

Starting values. Tune freely.

| Parameter | Starting value | Notes |
|-----------|---------------|-------|
| Foot length | 25 cm | Sole footprint length |
| Foot width | 9 cm | Sole footprint width |
| Sole thickness | 1.5 cm | Flat slab |
| Collar height (default) | 6 cm | Default slider value, range 3–10 |
| Heel notch width (default) | 0.4 | Range 0–1 |
| Gap opening max | 1.2 cm | How far the collar moves away from the ankle at peak |
| Collar perimeter samples | 32 | Points around the topline curve |
| Leg radius | 4 cm | Cylinder radius for thigh/shank |
| Thigh length | 35 cm | Visible portion only (cut off at top) |
| Shank length | 40 cm | Knee to ankle |
| Stones per spawn burst | 3–5 | When user scrolls one tick |
| Stone radius | 0.3–0.6 cm | Random within range |
| Camera default angle | 30° elevation, -20° azimuth | 3/4 view from foot's outside |
| Camera distance | ~80 cm from foot | Tunable |

These are in centimeters in world space. Three.js doesn't care about units, but picking a consistent physical scale makes the lighting and motion feel right.

---

## 13. What this replaces

- `design-spec.md` Act 3 section: the **rendering approach** changes (3D instead of 2D cross-section). The **pedagogical content** (collar gap mechanism, sliders, scroll-triggered stones, anatomy terminology) is unchanged.
- `PROJECT_BLUEPRINT.md` Section 6: Three.js is added to the tech stack for Act 3 only. The rest of the stack (Canvas for other acts, Chart.js for Act 5) is unchanged.
- `wireframe.html` Act 3 mockup: the wireframe shows a 2D cross-section placeholder. In the actual build, that placeholder is replaced by a Three.js canvas. The slider layout and text remain.

---

## 14. Instruction for Claude Code

> Build Act 3 as a self-contained Three.js scene inside the Act 3 viewport of the existing 2D article. The shoe is built from procedural geometry parameterized by `collarHeight`, `heelNotchWidth`, and `phase` — no loaded 3D models, no Blender pipeline. The collar is a closed 3D curve whose vertices are a function of these parameters; the curve rebuilds every frame from a `collarHeightAt(angle, ...)` function and a `gapOpeningAt(phase)` table. Use toon shading + outlines to stay visually consistent with the 2D black-and-white line-art style of the rest of the article. The leg reuses the gait-curve data from `gait-model-spec.md`. Stones are 3D objects spawned on scroll; collision against the collar curve detects entry. Build incrementally per the verification ladder in section 8 — do not skip ahead. See this spec (`act3-3d-spec.md`) for the parametric structure, starting values, and explicit non-goals.

---

*Last updated: 2026-05-12*
