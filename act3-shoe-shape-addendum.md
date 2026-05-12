# Act 3 — Shoe Shape Reference (addendum to act3-3d-spec.md)

The procedural shoe is currently rendering as a tapered wedge with no recognizable shoe features. This addendum gives the structural recipe for what a shoe actually *is*, expressed as parametric profiles so the existing approach (no loaded models, no Blender) can still produce a correct silhouette.

**The root cause of the current failure is topological, not numerical.** A shoe is a hollow form with an opening on top — not a solid convex blob. No amount of tuning the existing geometry will fix this. The construction has to change.

---

## 1. The structural recipe

A low-cut sneaker (the default shoe type for Act 3) is built from three independent profile curves and a sweep operation. Think of it the way a boat hull is designed: a top-down footprint, a side-view silhouette, and a cross-section. The 3D form falls out of combining them.

```
Footprint outline (top view)     → defines the sole shape
   +
Side silhouette (side view)      → defines the upper height along the length
   +
Cross-section template            → defines the shape from front
   ↓
Sweep / loft                      → produces the upper as a hollow shell
   +
Topline curve (the opening edge)  → carved out of the top of the shell
   ↓
Sole slab below the footprint
```

The shoe is **the shell minus the opening**, sitting on the sole. The opening is the collar — already covered by `collarHeightAt(angle, ...)` in the main spec. The new work is the **shell**, which is what's currently missing.

---

## 2. The footprint (top view)

The sole is not a rectangle. It's an asymmetric oval, wider at the ball of the foot and narrower at the heel.

```
                    forward (+X)
                       ↑
        ←lateral side       medial side→
         (outside)            (inside)
                       
        ╭──────╮
       ╱        ╲                    ← toe (rounded, wide)
      │          │
      │          │                   ← ball of foot (widest)
       ╲        ╱
        ╲      ╱                     ← arch (narrows)
         ╲    ╱   
          │  │                       ← heel (narrow, rounded)
          ╰──╯
```

**Footprint construction (parametric):**

Sample a closed curve around the foot's outline. 32 points is plenty. Suggested radius function in polar coordinates around the foot's center:

```js
// angle in radians: 0 = toe direction, π = heel direction
// returns half-width at that angle (in cm)
function footprintRadius(angle, footLength = 25) {
  const t = (Math.cos(angle) + 1) / 2;   // 1 at toe, 0 at heel
  
  // Width profile: narrow at toe, wide at ball, narrow at arch, medium at heel
  // Three Gaussian-ish bumps blended along the length
  const ballOfFoot = Math.exp(-Math.pow((t - 0.75) * 5, 2)) * 5.0;   // peak ~ball
  const heelCup    = Math.exp(-Math.pow((t - 0.10) * 6, 2)) * 4.0;   // peak ~heel
  const archDip    = -Math.exp(-Math.pow((t - 0.45) * 8, 2)) * 1.5;  // narrows
  const baseline   = 3.5;
  
  let halfWidth = baseline + ballOfFoot + heelCup + archDip;
  
  // Slight medial/lateral asymmetry (inside of foot is straighter)
  const lateralBias = Math.sin(angle);  // +1 on outside, -1 on inside
  halfWidth *= (1 + 0.05 * lateralBias);
  
  return halfWidth;
}
```

These coefficients are starting points. Tune `ballOfFoot` peak position and amplitude until the silhouette looks foot-shaped from above. The signature feature is the **bulge at the ball of the foot** — without it, the shoe reads as a slipper or a wedge (which is exactly the current failure mode).

---

## 3. The side silhouette (height profile along the length)

The upper rises differently at different points along the foot. This is what's currently missing — the build has no height variation, so the form has no shoe-ness.

```
       collar height
            ↓                            
        ___╱─╲___       
       ╱         ╲___              ← topline (collar edge curve)
      │              ╲___
      │                  ╲___      ← gradual rise from toe to collar
      │ heel cup             ╲     
      │__________________________  ← sole
      
      heel    arch     ball    toe
```

The **top edge of the upper** along the side view is what makes a shoe a shoe. Roughly:
- Toe (front): top is just above the sole. Low and rounded.
- Toe to mid-foot: gradual rise.
- Throat (where laces start): rises steeply.
- Collar at the ankle: peak height (this is `collarHeight` from the main spec).
- Heel cup (behind ankle): drops slightly into the heel notch.

**Side silhouette construction:**

For each position `t` along the foot's length (0 = heel, 1 = toe), compute the height of the upper's top edge:

```js
// t in [0, 1]: 0 = heel, 1 = toe
// returns height above sole (in cm)
function upperHeightAlongLength(t, collarHeight = 6, heelNotch = 0.4) {
  // Key positions along the foot
  const heelTop   = collarHeight * (1 - heelNotch * 0.5);  // heel area, dipped by notch
  const ankleTop  = collarHeight;                          // peak at the ankle (~t=0.25)
  const throatTop = collarHeight * 0.65;                   // throat dips down (~t=0.5)
  const toeTop    = 2.0;                                   // toe box height
  
  // Piecewise interpolation between these anchor points
  if (t < 0.15) {
    // heel cup to ankle peak
    return lerp(heelTop, ankleTop, t / 0.15);
  } else if (t < 0.4) {
    // ankle peak to throat
    return lerp(ankleTop, throatTop, (t - 0.15) / 0.25);
  } else if (t < 0.85) {
    // throat to toe
    return lerp(throatTop, toeTop, (t - 0.4) / 0.45);
  } else {
    // toe roundoff
    return lerp(toeTop, 0.5, (t - 0.85) / 0.15);
  }
}
```

The two key anchor points are **ankle peak (~t=0.25)** and **throat dip (~t=0.5)**. The shoe must rise to the ankle, dip down at the laces, then taper to the toe. Without this curve, you get the current slab.

---

## 4. The cross-section (front view at any slice)

At any position along the foot, the cross-section of the shoe upper is roughly a **half-ellipse** — wider at the bottom (where it meets the sole) and narrower at the top (where it wraps the foot).

```
        ___
       ╱   ╲                   ← top: narrower, wraps foot
      │     │
      │     │
      │     │
      └─────┘                  ← sole: wider, flat
```

The cross-section width matches the footprint at that position. The height matches the side silhouette at that position. The shape between them is the half-ellipse (or rounded rectangle, or whatever curve reads cleanly with toon shading).

**This is what turns the 2D profiles into 3D geometry.** At each sample point along the length:
1. Get the half-width from `footprintRadius()`
2. Get the height from `upperHeightAlongLength()`
3. Sweep a cross-section ellipse of that width × height at that position
4. Connect adjacent cross-sections into a triangulated shell

This is the "loft" operation. Three.js doesn't have a built-in `LoftGeometry`, but it's straightforward to build by hand: ~20 cross-sections along the length, each with ~16 points, connected as quads.

---

## 5. Carving the opening (the collar)

The shell from section 4 is *closed* — it has a top surface. The opening is carved by **stopping the cross-sections at the collar curve** instead of closing them at the top.

For each cross-section at position `t`:
- If `t` is in the region covered by the collar opening (roughly `0.15 < t < 0.6`), the cross-section is open at the top — only the lower portion of the ellipse is generated.
- The top edge of the cross-section is the topline curve, which the main spec already defines via `collarHeightAt()`.

This is where the existing `collarHeightAt()` function from the main spec attaches to the new structure. The collar curve isn't separate geometry — it's the **upper boundary of the shell**.

---

## 6. The sole slab

Below the upper, a flat slab in the shape of the footprint, extruded downward by `soleThickness` (~1.5 cm). The bottom of the sole is at `y = 0` (ground level). The top of the sole is where the upper attaches.

Two cosmetic touches that read as "shoe" rather than "blob":
- A thin coloured midsole strip between sole and upper (the orange sole strip in your reference frames). One band of slightly different color, ~3mm tall.
- A toe spring: the front of the sole tilts up slightly off the ground (~5–10° over the front 20% of the foot length). This is what makes a shoe rock forward naturally.

---

## 7. What success looks like

After implementing this addendum, the shoe should:

1. **Have a recognizable heel cup** when viewed from the back (concave, wraps around)
2. **Have a clear topline opening** when viewed from above (you can see "into" the shoe)
3. **Bulge at the ball of the foot** when viewed from the top
4. **Rise to a peak at the ankle** when viewed from the side, then dip down at the throat
5. **Still respond to the sliders** — collar height and heel notch should change the silhouette in real time, same as before

The current image (tapered wedge, no opening, no heel cup, no ankle rise) fails on all five.

---

## 8. Reference imagery to look at

A few searches that surface the right reference style (technical drawings, not photos):

- "sneaker technical drawing side view"
- "shoe last top view" (the wooden form shoes are built around — shows the footprint shape cleanly)
- "running shoe anatomy diagram"
- "low-top sneaker side silhouette"

The reference target is *technical illustration* — orthographic side and top views with labeled anatomy. Photos of shoes have too much detail and the wrong perspective for parametric reconstruction.

---

## 9. Implementation order (extends section 8 of the main spec)

The original section 8 had: empty scene → static shoe → sliders → leg → animate → stones → collision.

Replace "static shoe" with this expanded sequence:

1. **Footprint outline only.** Render just `footprintRadius()` as a closed curve at ground level. It should look like a foot-shaped oval from above. Get this right before doing anything else. If the footprint is wrong, every later step inherits the wrongness.
2. **Sole slab.** Extrude the footprint down by `soleThickness`. You now have a foot-shaped puck. Recognizable as "this is where a foot would go."
3. **Side silhouette curve.** Render `upperHeightAlongLength()` as a 2D line above the sole's lateral edge. Confirm it has the ankle peak and throat dip.
4. **First lofted shell, closed top.** Loft the cross-sections all the way up to the side silhouette curve, with closed tops. This will look like a shoe-shaped blob with no opening — a closed-top moccasin. That's expected.
5. **Open the top via the collar curve.** Apply `collarHeightAt()` to stop the cross-sections at the topline. Now it's a shoe.
6. **Then proceed to the original section 8 step 3** (hook up sliders), step 4 (leg), etc.

The point of breaking step 2 into 5 sub-steps is that "build the static shoe" was too big a step. Each of the 5 above is verifiable on its own.

---

## 10. What I'm explicitly NOT providing

- **A vertex list or mesh data file.** Loading mesh data would bypass the parametric construction and break the sliders. The whole point of the procedural approach is that geometry is *generated*, not loaded.
- **An OBJ or glTF reference model.** Same reason. Also: pulling in a real shoe model would invite "let's just use this directly" which is the wrong direction.
- **Exact Three.js API choices.** The loft can be done with custom `BufferGeometry`, with `LatheGeometry` (for a starting approximation), with `ExtrudeGeometry` + path morphing, or by hand-building triangle strips. Whichever produces correct geometry first is fine.

---

## 11. Quick sanity check Claude Code can run

Before declaring step 1 done, the footprint should pass this test:

- Maximum half-width occurs at roughly t=0.75 (ball of foot)
- Minimum half-width (between heel and toe) occurs at roughly t=0.45 (arch)
- The toe end is rounded, not pointed (radius at t=1 is ~2cm, not 0)
- The heel end is rounded, narrower than the ball

If `footprintRadius()` returns values that don't match this, the shape is wrong before the loft even starts. Fix the function, don't fix the loft.

---

*Last updated: 2026-05-12*
