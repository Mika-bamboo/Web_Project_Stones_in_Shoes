# UI & Narrative Design Spec

## Overview

This project uses a **scroll-driven storytelling** structure instead of a traditional "open a simulator" approach. The user scrolls through six acts, each revealing one concept with progressively more interactivity. The full sandbox simulator only appears at the end, after the story has built enough understanding for every control to feel meaningful.

Visual wireframe: [docs/wireframe.html](./wireframe.html) — open in a browser to see the layout.

---

## Narrative Structure

### Act 1 — The hook

**Goal**: Spark curiosity. No explanation yet.

- **Scene**: freshly constructed asphalt road with abundant loose gravel (highest stone density scenario — maximizes visual impact for the hook)
- Walking animation plays **continuously on loop** while the user is idle
- Stone entry animation is **not triggered** until the user scrolls within the viewport
- As the user scrolls, stones begin entering the shoe; a counter badge accumulates: "3 stones entered your shoe"
- When the user stops scrolling, the walking animation continues but no new stones enter — this creates a sense of agency ("I made that happen")
- Scrolling to the end of Act 1's progress reveals a "next" button to advance to Act 2

**Design intent**: The scroll-to-trigger mechanic turns passive watching into active participation. The user feels like they are "causing" the stones to enter, which makes the phenomenon personal rather than abstract. The continuous idle animation keeps the page alive even when the user pauses to read.

---

### Act 2 — Zoom in: the kick-up

**Goal**: Reveal the first mechanism (toe-off kick-up).

- Camera zooms to the outsole lifting off the ground
- Dotted parabolic arcs show stone trajectories in real time
- **First interactive controls**: walking speed slider + stone size slider
- When user adjusts a slider, the shoe profile updates immediately in the viewport
- Walking animation loops continuously while idle; **stone kick-up trajectories only animate when user scrolls**
- Accompanying text explains the kick-up effect
- Scrolling to the end reveals "next" button

**Design intent**: The user's first interaction. Dragging the speed slider and watching arcs change height creates a cause-effect discovery moment. The slider changes are reflected in real time on the shoe/ground, but the actual stone-launching only happens on scroll — maintaining the "user drives the action" feel.

**Key insight delivered**: Faster walking = higher kick-up arcs = more stones launched toward the collar opening.

---

### Act 3 — Zoom in: the entry point

**Goal**: Reveal the entry zone (collar gap).

- Camera shifts to the ankle area, showing a cross-section
- The collar gap visibly opens and closes with the gait cycle
- Stone particles hover near the topline edge
- **New controls**: collar height slider + heel notch width slider
- Adjusting sliders updates the shoe cross-section shape **immediately** — user sees collar height and heel notch change in real time
- Walking animation loops continuously while idle; **stone entry only animates when user scrolls**
- Labels use correct shoe anatomy terms: collar, topline, heel notch
- Scrolling to the end reveals "next" button

**Design intent**: The "aha" moment. User sees the breathing gap and can directly control it. Shrinking the collar height immediately shows a wider gap on the shoe profile, and when the user scrolls to trigger stones, visibly more stones pass through.

**Key insight delivered**: Stones don't magically teleport inside — they enter through the collar gap, which rhythmically opens and closes with every step.

---

### Act 4 — The question

**Goal**: Gamification — make the user commit to a prediction.

- Four shoe profiles displayed: sandal, sneaker, oxford, boot
- User **taps one shoe** to select their prediction for "which lets in the most stones" (no ranking — single selection only, lowest friction)
- "Run 100 steps" button triggers a batch simulation
- Results are hidden until the simulation completes

**Design intent**: Prediction before reveal is a core engagement technique. Most people will guess sandals are worst — setting up the counter-intuitive reveal in Act 5. Single-tap selection keeps the interaction instant, especially on mobile.

---

### Act 5 — The reveal

**Goal**: Deliver the counter-intuitive insight.

- Bar chart showing stones **retained** per 100 steps by shoe type
- Stat cards with color coding (red = worst, green = best)
- Narrative text explains the distinction between **entry rate** and **retention rate**

**Key insight delivered**: Sandals let stones in easily, but they also fall back out. Low-cut sneakers are the real victim — stones enter through the collar gap and get trapped. Boots block entry entirely. The "worst" shoe is not the most open one — it is the one that traps stones most effectively.

**Design intent**: This counter-intuitive result is the most memorable moment. If the user guessed wrong in Act 4, they will remember this.

---

### Act 6 — The sandbox

**Goal**: Reward exploration with full control.

- Complete simulation view with all shoe types available
- All parameter sliders consolidated: walking speed, stone density, stone size
- **Surface type selector**: presented as **scene cards** (not a slider), each representing a real-world scenario:
  - "Fresh construction" — abundant loose gravel, 2-8mm (highest density)
  - "Park gravel path" — moderate loose gravel
  - "City sidewalk" — occasional debris at pavement cracks (low density)
  - "Marble / brick pavement" — near-zero loose stones
- Selecting a scene card changes ground texture and stone density automatically
- Real-time stat cards: steps taken, stones entered, entry rate
- Shoe type tabs for instant switching

**Design intent**: By this point, the user understands every parameter from the story. The full control panel doesn't feel overwhelming because each slider was introduced individually in earlier acts. The scene cards (instead of an abstract "density slider") connect the simulation to real-world experience — the user thinks "that's my street!" Surface types are intentionally excluded from Acts 1-5 to keep the story focused on a single variable (shoe type). Introducing a second dimension here gives the sandbox its own layer of discovery.

**Why scene cards instead of a slider**: A "stone density" slider is abstract and meaningless to most users. Scene cards with names and tiny ground illustrations trigger spatial memory — the user immediately knows what "fresh construction" looks and feels like. This makes the parameter tangible rather than numerical.

---

## Interaction Design Principles

### Progressive disclosure

Controls are introduced one act at a time, never all at once.

| Act | Controls added | Cumulative |
|-----|---------------|-----------|
| 1 | None (scroll triggers stones) | Scroll only |
| 2 | Speed slider, stone size slider | 2 sliders + scroll |
| 3 | Collar height slider, heel notch slider | 4 sliders + scroll |
| 4 | Shoe type tap-to-select + "Run" button | Selection + action |
| 5 | None (results display) | Read-only |
| 6 | All sliders + shoe tabs + surface scene cards | Full sandbox |

### Scroll-driven interaction model (confirmed)

Each act occupies roughly one viewport height. The core interaction pattern is:

**Idle state**: Walking animation loops continuously inside the viewport. The shoe moves, the foot flexes, but no stones enter or interact. This keeps the page feeling alive.

**Scroll state**: When the user scrolls within the act's viewport, stone physics activate — stones get kicked up, trajectories play out, stones enter (or miss) the collar. Scroll distance maps to simulation progress (more scroll = more steps simulated).

**Slider interaction**: When sliders exist (Acts 2, 3, 6), adjusting a slider immediately updates the visual appearance of the shoe/ground in the viewport (e.g. collar height changes, stone size changes). But the stone entry simulation only runs on scroll — the slider sets up the conditions, the scroll triggers the action.

**Act transitions**: Scrolling to the end of an act's progress range reveals a "next" button. Clicking it snaps the viewport to the next act. This hybrid approach (scroll within acts, button between acts) gives users editorial flow within each act while providing clear navigation between sections.

Implementation approach:
- Intersection Observer API for detecting which act is in view
- Scroll event listener (throttled) within each act's container for simulation progress
- requestAnimationFrame for continuous idle walking animation
- GSAP ScrollTrigger as an optional enhancement for smoother scroll-linked transitions

### Visual style (confirmed)

**Primary style: black & white line art with accent color.**

The simulation uses clean, monochrome line drawings — similar to technical illustrations or engineering cross-sections. No photorealism, no pixel art, no gradients.

**Why line art over pixel/Minecraft style**:
- The project is a scientific explanation, not a game. Line art signals "interactive article with depth" rather than "toy to play with for 30 seconds"
- Matches the visual language of Bartosz Ciechanowski and Explorable Explanations — the target aesthetic
- Technically simpler to execute well in Canvas. Pixel art requires sprite work and looks cheap in 2D without 3D lighting. Line art only needs consistent stroke weight and clean spacing.
- Shoe anatomy labels (collar, topline, heel notch) integrate naturally — they look like engineering diagram callouts

**Accent color for stones**: Stones are the only colored element — warm orange or red. This creates an automatic visual hierarchy: the user's eye tracks the colored stones against the monochrome shoe and ground without needing arrows or highlights. Approximately 95% black/white, 5% accent color.

**Rendering details**:
- Shoe profiles: 1-2px black strokes on white/transparent background
- Ground surface: stippled or hatched texture (varies by surface type in Act 6)
- Stone particles: filled irregular polygons in accent color (e.g. `#D85A30` coral or `#E24B4A` red)
- Stone trajectories: dotted lines in accent color at 50% opacity
- Collar gap: subtle animated opening visualized with a thin gap in the shoe outline
- Background: white (light mode) or near-black (dark mode) — the line art inverts naturally

### Sound design (confirmed)

- **Default: muted**
- Speaker toggle icon in top-right corner of the page
- When enabled: subtle footstep sounds on each gait cycle, light click/tap when a stone enters the shoe
- No background music
- Sounds are supplementary, never required for understanding

### Wireframe notation (for wireframe.html only — not in production)

- **Dashed borders**: wireframe containers
- **Blue blocks**: animation / simulation viewport placeholders
- **Green blocks**: chart / data visualization placeholders
- **Yellow annotations**: design intent notes
- **Gray bars**: placeholder text paragraphs

### Shoe anatomy labeling

When the collar area is visible (Acts 3, 6), hovering over shoe parts should display tooltips with correct terminology: collar, topline, throat, tongue, heel notch, vamp, quarter. See `PROJECT_BLUEPRINT.md` Section 2 for full definitions.

---

## Responsive Considerations

- **Desktop (>768px)**: Full-width simulation viewport, side-by-side shoe comparisons in Act 4
- **Mobile (<768px)**: Stacked layout, shoe comparisons as swipeable cards, sliders full-width
- All text and controls must be usable without horizontal scrolling
- Touch-friendly slider thumbs (minimum 44px hit area)

---

## Resolved Design Decisions

All five original open questions have been resolved:

| # | Question | Decision | Rationale |
|---|----------|----------|-----------|
| 1 | Act 1 loop duration | Walking animation loops **continuously**; stone entry is scroll-triggered, not time-triggered | Gives user agency. They control when stones enter, not a timer. |
| 2 | Act 4 prediction UX | **Tap one shoe** to predict (no ranking) | Lowest friction interaction, especially on mobile. |
| 3 | Navigation model | **Scroll within acts** to drive simulation; **"next" button at end** of each act to advance | Hybrid approach: editorial scroll flow within acts + clear navigation between them. |
| 4 | Sound design | **Muted by default**, speaker toggle in top-right | Respects public browsing contexts. Sound is supplementary, never required. |
| 5 | Entry vs retention modeling | **Yes, model it** — worth the complexity for the narrative payoff | The "sneakers trap more than sandals" insight is the single most memorable moment. Can use simplified approximation in MVP. |

Additional decisions made:

| Decision | Detail |
|----------|--------|
| Act 1 scene setting | Freshly constructed asphalt road (highest stone density = strongest hook) |
| Surface types in story? | **No** — surface types are only in Act 6 sandbox. Story stays focused on shoe type as the single variable. |
| Surface type UI | Scene cards with real-world names + ground illustration, not an abstract slider |
| Visual style | Black & white line art with accent color (coral/red) for stones only |
| Why not pixel art | Pixel art reads as "game/toy"; line art reads as "interactive article" — matches Bartosz Ciechanowski aesthetic |

---

## Open Design Questions (remaining)

1. **Act 1 scroll sensitivity**: How many pixels of scroll = 1 simulated step? Needs playtesting. Too sensitive and the user blows through Act 1 instantly; too sluggish and it feels broken.
2. **Mobile scroll behavior**: On mobile, scroll-within-viewport conflicts with page scroll. May need to use touch-drag on the viewport instead of scroll, or lock page scroll when viewport is focused.
3. **Act 4 → Act 5 transition timing**: After hitting "Run 100 steps", should results appear instantly or animate in over 2-3 seconds? Animation builds suspense but delays gratification.
4. **Scene card illustrations**: What level of detail for the ground illustrations in Act 6 scene cards? Simple hatching patterns vs. more detailed textures?

---

*Last updated: 2026-04-06*
