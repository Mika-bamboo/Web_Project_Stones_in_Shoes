# 🪨 Stone-In-Shoe Simulator

## Why Do Stones Always End Up Inside Your Shoes? — An Interactive Physics Simulation

---

## 1. Problem Statement

No matter what type of footwear you wear — sandals, sneakers, loafers, slip-ons — small stones inevitably find their way inside when walking on gravel or loose surfaces. The only exception is tall boots with a snug shaft that seals tightly around the calf.

This phenomenon involves multiple interacting physical mechanisms. This project aims to build an interactive web simulation that lets users **see exactly how** stones enter different types of shoes.

---

## 2. Shoe Anatomy — Key Terminology

Before diving into the physics, it's essential to define the shoe parts involved in stone entry. In footwear design, the relevant areas are:

### Entry Zone — Where Stones Get In

| Term | Definition | Role in Stone Entry |
|------|-----------|-------------------|
| **Collar** | The padded edge surrounding the top of the shoe opening, wrapping around the ankle area. Provides ankle support and comfort. | Primary entry zone — the gap between the collar and the ankle/Achilles tendon fluctuates with each step, creating openings for stones. |
| **Topline** | The uppermost edge of the shoe opening, where the collar, lining, and upper are stitched together. | Defines the boundary of the opening; a lower topline means a wider entry angle for debris. |
| **Throat** | The front opening of the shoe, extending from the vamp toward the ankle. On laced shoes, this is the area covered by the tongue. | Secondary entry zone — stones can slip past the tongue or through gaps beside the lace area. |
| **Tongue** | A strip of material sewn into the vamp, extending upward under the laces. Protects the top of the foot from lace pressure. | Acts as a partial barrier, but side gaps between the tongue and the quarter allow stone entry. |
| **Heel Notch** | A V or U-shaped cut in the rear collar that provides clearance for the Achilles tendon during movement. | Creates a wider opening at the back, making it easier for stones to enter from behind. |

### Shoe Surfaces — Where Stones Interact

| Term | Definition | Role in Stone Entry |
|------|-----------|-------------------|
| **Vamp** | The front section of the upper covering the toes and forefoot. | On open-vamp shoes (sandals, flip-flops), stones land directly on the foot. |
| **Quarter** | The rear section of the upper covering the sides and back of the foot, from the vamp to the heel. | Provides the side walls that stones must bypass to enter. |
| **Upper** | The entire top portion of the shoe above the sole, including vamp, quarter, tongue, and collar. | Collectively determines how enclosed or exposed the foot is. |
| **Outsole** | The bottom layer of the shoe contacting the ground. | The tread pattern can trap and release small stones; the toe area kicks up debris during toe-off. |

### Why Boots Block Stones

| Term | Definition | Role in Stone Prevention |
|------|-----------|------------------------|
| **Shaft** | The tall portion of a boot extending above the ankle, sometimes up to the knee. | Eliminates the collar gap entirely by enclosing the lower leg. |
| **Scree Collar** | A lightly padded cuff at the top of hiking boots designed specifically to keep out debris (named after loose rock debris called "scree"). | Purpose-built stone barrier — confirms that this is a recognized problem in footwear design. |
| **Gusseted Tongue** | A tongue that is sewn to the upper along its edges rather than only at the base, sealing the throat opening. | Prevents debris from entering through tongue-side gaps. |

---

## 3. Core Physics Mechanisms

### 3.1 Kick-Up Effect

When the foot lifts off the ground during the **toe-off phase** of the gait cycle, the outsole's front edge launches small stones upward. These stones follow a parabolic trajectory, and some land inside the collar opening of the same foot or the opposite foot.

- Primary kick-up angle: 30°–70° from ground
- Stones launched by toe-off can travel 10–30 cm vertically
- The opposite foot (in mid-stance) presents a stationary, open target

### 3.2 Bellows Effect (Suction)

As the foot flexes inside the shoe, the collar gap alternately opens and closes — functioning like a bellows or air pump. This creates micro-pressure changes at the collar opening:

- **Collar opens** (during toe-off): air rushes in, potentially carrying nearby particles
- **Collar closes** (during heel strike / foot flat): air is expelled
- Effect is subtle but cumulative over hundreds of steps

### 3.3 Vibration Migration

Each heel strike sends a shockwave through the shoe structure. Stones resting on the topline or collar edge are vibrated incrementally inward — similar to how objects migrate on a vibrating surface (related to the **Brazil Nut Effect** in granular mechanics).

- Vibration frequency: ~1–2 Hz (walking cadence)
- Each micro-displacement is small, but over many steps, a stone on the edge will "walk" inward and drop inside

### 3.4 Collar Gap Geometry Across Shoe Types

| Shoe Type | Collar Gap Behavior | Stone Entry Rate |
|-----------|-------------------|-----------------|
| **Flip-flops / Sandals** | No collar — foot is fully exposed | Very High (direct landing) |
| **Low-cut sneakers** | Wide collar opening, significant heel notch, moderate gap fluctuation | High |
| **Laced shoes / Oxfords** | Throat partially sealed by tongue, but tongue-quarter side gaps remain | Medium |
| **High-top sneakers** | Taller collar reduces opening angle, but still has heel notch gap | Low–Medium |
| **Hiking boots (with scree collar)** | Tall shaft + scree collar + gusseted tongue | Very Low |
| **Tall boots (knee-high)** | Shaft fully encloses the lower leg | Near Zero |

### 3.5 Stone & Surface Conditions

- **Critical stone diameter**: 2mm–8mm (smaller stones pass unnoticed; larger stones can't fit through the collar gap)
- **Loose gravel vs embedded surface**: loose stones are easily displaced by toe-off forces
- **Dry vs wet surface**: wet stones adhere to the ground and are less likely to be kicked up
- **Walking speed**: faster walking increases kick-up force but reduces the time the collar gap is open per cycle

---

## 4. Project Goals

Build a **single-page interactive web app** that allows users to:

1. **Watch** a 2D side-view gait animation showing stones being kicked up and entering shoes
2. **Switch shoe types** to compare stone entry rates across different footwear
3. **Adjust parameters** to explore how physical conditions affect stone entry
4. **Understand the physics** through annotated labels and mechanism highlights

---

## 5. Feature Roadmap

### 5.1 MVP (Minimum Viable Product)

| Feature | Description |
|---------|-------------|
| Gait animation | 2D side-view of a single foot cycling through stance and swing phases |
| Stone particle system | Ground-level stones rendered as irregular polygons, affected by kick-up forces |
| Collision detection | Determines whether a stone passes through the collar opening into the shoe interior |
| Shoe type switcher | At least 4 types: sandal, low-cut sneaker, laced shoe, tall boot |
| Entry counter | Displays "stones entered" count and entry rate per 100 steps |

### 5.2 Enhanced Version (V2)

| Feature | Description |
|---------|-------------|
| Parameter panel | Adjustable: walking speed, stone density, stone diameter range, surface wetness |
| Mechanism color-coding | Different colors for stones entering via kick-up (red), bellows/suction (blue), vibration migration (yellow) |
| Dual-foot simulation | Full two-leg gait where one foot kicks up stones into the other foot's collar |
| Statistics dashboard | Charts comparing entry rates across shoe types and parameter settings |
| Slow motion / frame-by-frame | Lets users observe the critical moments in detail |

### 5.3 Extended Features (V3)

| Feature | Description |
|---------|-------------|
| 3D mode | Three.js perspective/top-down view of the full simulation |
| Custom shoe editor | Users draw their own shoe profile (collar height, heel notch depth, tongue coverage) to test |
| Batch experiment mode | Simulate N steps automatically and output a statistical report |
| Share functionality | Export simulation results as screenshot/GIF for social sharing |

---

## 6. Technical Architecture

### 6.1 Tech Stack

```
Framework:       React (or single-file HTML/JS for simplicity)
2D Rendering:    HTML Canvas API or PixiJS
Physics Engine:  Matter.js (2D rigid body physics)
Charts:          Chart.js or Recharts
Animation:       requestAnimationFrame + custom gait easing curves
Deployment:      GitHub Pages
```

### 6.2 Project Structure

```
stone-in-shoe/
├── README.md
├── PROJECT_BLUEPRINT.md
├── docs/
│   ├── physics-analysis.md        # Detailed physics mechanism writeup
│   ├── shoe-anatomy.md            # Shoe part definitions and diagrams
│   ├── gait-cycle.md              # Gait cycle research notes
│   └── references.md              # Papers, articles, resources
├── src/
│   ├── index.html
│   ├── main.js
│   ├── physics/
│   │   ├── engine.js              # Physics engine wrapper
│   │   ├── gait.js                # Gait cycle model
│   │   ├── particles.js           # Stone particle system
│   │   └── collision.js           # Collar-gap collision detection
│   ├── renderer/
│   │   ├── canvas.js              # Canvas renderer
│   │   ├── shoe-models.js         # Shoe profile data (collar, topline, throat geometry)
│   │   └── animations.js          # Animation controller
│   └── ui/
│       ├── controls.js            # Parameter panel
│       └── stats.js               # Statistics display
├── assets/
│   └── shoe-profiles/             # SVG outlines for each shoe type
└── tests/
    └── physics.test.js
```

### 6.3 Core Algorithm Overview

#### Gait Cycle Model
```
One gait cycle = Stance phase (60%) + Swing phase (40%)

Key events:
  t0: Heel Strike      → Impact vibration propagates through shoe structure
  t1: Foot Flat         → Collar gap at minimum (foot fully seated in shoe)
  t2: Heel Off          → Collar begins to open at rear (heel notch widens)
  t3: Toe Off           → Maximum kick-up force; collar gap at maximum
  t4: Swing Phase       → Foot airborne; open collar is a target for falling stones
```

#### Kick-Up Model
```
Kick-up velocity V = f(walking_speed, stone_mass, contact_angle)
Kick-up angle θ  = random distribution (concentrated at 30°–70°)
Trajectory        = parabolic (gravity only; air resistance negligible at this scale)
```

#### Stone Entry Detection
```
if stone_position is within collar_opening_bounds:
    if stone_velocity_vector points toward shoe_interior:
        if stone_diameter < collar_gap_width at current gait phase:
            → Stone enters shoe ✓
            → Tag entry mechanism (kick-up / bellows / vibration)
```

---

## 7. Development Roadmap

### Phase 1: Research & Prototype (Week 1–2)
- [ ] Gather gait cycle parameters (joint angles, timing, ground reaction forces)
- [ ] Build basic Canvas animation of a single-foot gait cycle
- [ ] Implement ground-level stone particle system
- [ ] Validate kick-up force model with simple test cases

### Phase 2: MVP Development (Week 3–4)
- [ ] Integrate Matter.js physics engine
- [ ] Define collar/topline/throat collision boundaries for 4 shoe types
- [ ] Implement stone entry detection logic
- [ ] Build basic UI: shoe type switcher + entry counter
- [ ] Deploy to GitHub Pages

### Phase 3: Polish & V2 Features (Week 5–6)
- [ ] Add parameter adjustment panel
- [ ] Implement mechanism color-coding
- [ ] Add statistics charts
- [ ] Add slow motion / frame-by-frame mode
- [ ] Responsive design for mobile

### Phase 4: Extended Exploration (Later)
- [ ] 3D mode with Three.js
- [ ] Custom shoe profile editor
- [ ] Batch experiment mode
- [ ] Social sharing features

---

## 8. Design Direction

### Visual Style
- **Clean, scientific aesthetic**: light background, crisp linework
- Shoes rendered as simplified 2D cross-section profiles — not photorealistic
- Each shoe part (collar, topline, throat, tongue, heel notch) clearly labeled on hover
- Stone particles as irregular polygons with physics-driven motion
- Trajectory paths shown as dotted/gradient lines
- Active mechanism annotations with animated arrows

### Inspiration
- [Explorable Explanations](https://explorabl.es/) style interactive articles
- Bartosz Ciechanowski's interactive physics essays (mechanical watch, GPS, etc.)
- Neal.fun's playful interactive web experiences

---

## 9. Anticipated Challenges

| Challenge | Mitigation Strategy |
|-----------|-------------------|
| Natural-looking gait animation | Use Bézier curve interpolation based on real gait cycle data |
| Physics realism vs performance | Simplified model for MVP; refine forces in V2 |
| Dynamic collar gap modeling | Model the collar opening as a deformable line segment that changes width with gait phase |
| Mobile performance | Cap particle count; offer a "lite mode" option |
| Accurate shoe profiles | Reference actual shoe anatomy diagrams; define collar height, heel notch depth, throat angle as numeric parameters |

---

## 10. Why Build This?

1. **Answers a universal everyday question** — everyone has experienced this, but no one has seriously analyzed it
2. **Physics simulation practice** — covers rigid body mechanics, collision detection, particle systems, granular dynamics
3. **Portfolio piece** — demonstrates frontend skills combined with scientific thinking
4. **Explorable Explanation** — makes a complex multi-mechanism phenomenon intuitive and visual
5. **Unique — no existing projects** — web searches reveal zero similar simulations or interactive explanations

---

## 11. References & Resources (To Collect)

- [ ] Human gait cycle biomechanics data (joint angles, phase timing, ground reaction forces)
- [ ] Matter.js documentation and examples
- [ ] Granular mechanics / Brazil Nut Effect literature
- [ ] Bartosz Ciechanowski's interactive article techniques
- [ ] Canvas / PixiJS animation best practices
- [ ] Footwear anatomy references (collar, topline, throat, scree collar definitions)

---

*Last updated: 2026-04-04*
*Status: Blueprint — development not yet started*
