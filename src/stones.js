// Stone system — rewritten from scratch.
//
// Model: stones exist as STATIC particles sitting on the ground. When the
// walker's toe sweeps within kick-reach of a static stone during toe-off,
// that stone is launched into the air with a forward + upward velocity
// derived from the toe's motion. Flying stones integrate under gravity
// until they hit the ground, at which point they come to rest and become
// static again (eligible to be kicked a second time).
//
// Stones live in WORLD coordinates, not screen. The walker's pelvis is
// pinned at `walker.pelvisX` in screen space, and the ground scrolls
// backward as `walker.worldX` grows, so stones stored in world space
// naturally fall behind the walker. The frame loop applies a
// `translate(pelvisX − worldX, 0)` when drawing them.

const GRAVITY           = 800;   // px/s² (downward = +y)
const KICK_WINDOW_MIN   = 0.50;  // toe-off phase start (slightly widened)
const KICK_WINDOW_MAX   = 0.72;  // toe-off phase end
const KICK_REACH        = 32;    // px — toe→stone distance at which a kick fires
const STONE_MIN_R       = 3;
const STONE_MAX_R       = 6;

// ── Physically-accurate kick model ───────────────────────────────────
// When the toe contacts a stone during toe-off, it delivers a fixed
// "impulse" plus a contribution from the toe's own velocity. The
// resulting velocity is that impulse divided by the stone's mass:
// larger stones get proportionally less launch velocity from the same
// kick. This is the standard momentum-transfer story — it's what makes
// a pebble fly dramatically while a heavier stone barely hops.
//
// The constants below are calibrated against the REFERENCE stone at
// r = STONE_MIN_R = 3 (mass = 9 via the r² disk-mass model). At that
// reference, a kick with toeVx = 200 and toeVy = -100 produces roughly
// vx = 250, vy = -505 → peak arc ~ 159 px above launch, comfortably
// clearing collar height (~140 px above the toe) so the stone can
// enter the shoe. Stones at r = 6 (mass = 36, massRatio = 0.25) only
// receive ¼ of that kick → peak ~10 px. Big stones stay on the ground.
const KICK_BASE_MASS    = 9;     // r² for the reference stone (r = 3)
const KICK_BASE_VX      = 180;   // horizontal impulse for the reference
const KICK_BASE_VY      = -480;  // vertical impulse for the reference
const KICK_TOE_VX_COEFF = 0.35;  // contribution of toe vx to horizontal kick
const KICK_TOE_VY_COEFF = 0.25;  // contribution of toe vy to vertical kick

// Procedural stone scatter settings.
const SPAWN_HORIZON     = 700;   // spawn stones this far ahead of the walker
const DESPAWN_DISTANCE  = 600;   // remove stones this far behind the walker
const SPAWN_MIN_GAP     = 35;    // minimum world-x spacing between stones
const SPAWN_MAX_GAP     = 130;   // maximum world-x spacing between stones

// Collar-opening edges in foot-local coordinates. These are the three
// segments of the V-shaped notch at the top of the SNEAKER profile
// (renderer.js points 2 → 3 → 4 → 5):
//   back diagonal:   (-4, -11) → ( 0, -7.5)
//   bottom of V:     ( 0, -7.5) → ( 5, -7.5)
//   front diagonal:  ( 5, -7.5) → ( 9, -11)
// A flying stone whose per-frame trajectory crosses ANY of these three
// segments has entered the shoe through the collar opening. Checking
// all three segments (instead of just the bottom of the V, as in step
// 1) roughly triples the entry surface and matches the actual visible
// cutout in the shoe outline.
const COLLAR_SEGMENTS_LOCAL = [
  [{ x: -4, y: -11   }, { x:  0, y:  -7.5 }],
  [{ x:  0, y:  -7.5 }, { x:  5, y:  -7.5 }],
  [{ x:  5, y:  -7.5 }, { x:  9, y: -11   }],
];

// Settling parameters for in-shoe stones. Each trapped stone gets a
// random target inside the shoe (somewhere above the sole, between the
// heel and the toe-box) and drifts toward it with exponential decay.
const SETTLE_RATE       = 4.0;   // 1/s — exponential decay rate
const SETTLE_X_MIN      = 0;     // foot-local x range for the target
const SETTLE_X_MAX      = 12;
const SETTLE_Y_MIN      = 4;     // foot-local y range (above the sole)
const SETTLE_Y_MAX      = 7;

// Transform a foot-local point to world coordinates using the same
// rotation convention as renderer.js drawShoe (canvas θ = π/2 − footAngle).
// Adds an optional xOffset to move the result from screen space (where
// the legs live) to stone-world space (where the stones live).
function footLocalToWorld(leg, local, xOffset) {
  const theta = Math.PI / 2 - leg.footAngle;
  const c = Math.cos(theta), s = Math.sin(theta);
  return {
    x: leg.ankle.x + local.x * c - local.y * s + xOffset,
    y: leg.ankle.y + local.x * s + local.y * c,
  };
}

// Standard 2D line-segment intersection test. Returns true iff the
// closed segments (p1,p2) and (p3,p4) share at least one point.
// Uses the signed-area parameterization: parametric values t, u in
// [0, 1] ↔ intersection exists.
function segmentsIntersect(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-9) return false;          // parallel/collinear
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export class StoneSystem {
  constructor() {
    this.stones = [];
    this.prevToeWorld = { right: null, left: null };
    // World x up to which we've generated static stones. Lazy-initialized
    // on the first update() call once we know the walker's starting worldX.
    this.generatedUpTo = null;
    // Running count of stones that have entered a shoe via the collar
    // opening. Surfaced in main.js's debug overlay and wired to
    // index.html's #stoneCount element.
    this.trappedCount = 0;
  }

  update(walker, dt) {
    this._ensureScatter(walker);
    this._despawnBehind(walker);
    this._detectKicks(walker, dt);
    // Split motion from landing so the shoe-entry check can run *between*
    // them. Entry must take precedence over landing: if a stone's
    // trajectory crosses both the collar opening and the ground line in
    // a single frame, it physically enters the shoe first (up in the
    // air) well before reaching ground level.
    this._integratePositions(walker, dt);
    this._detectShoeEntry(walker);
    this._landStones(walker);
    // Trapped stones get re-positioned each frame to track their host
    // foot through the gait cycle.
    this._updateInShoe(walker, dt);
  }

  // ── Static stone scatter ─────────────────────────────────────────────

  _ensureScatter(walker) {
    if (this.generatedUpTo === null) {
      this.generatedUpTo = walker.worldX - 200;  // a few stones behind initially
    }
    while (this.generatedUpTo < walker.worldX + SPAWN_HORIZON) {
      this.generatedUpTo += SPAWN_MIN_GAP + Math.random() * (SPAWN_MAX_GAP - SPAWN_MIN_GAP);
      const r = STONE_MIN_R + Math.random() * (STONE_MAX_R - STONE_MIN_R);
      this.stones.push({
        x: this.generatedUpTo,
        y: walker.groundY - r,   // resting on the ground line
        vx: 0,
        vy: 0,
        r,
        // Mass scales with cross-sectional area (2D-disk model), r².
        // See KICK_BASE_MASS below — the kick divides impulse by this,
        // so larger stones get proportionally less launch velocity from
        // the same toe kick. That's the whole "physically accurate"
        // momentum-transfer story: heavy things are harder to kick.
        mass: r * r,
        state: 'static',
      });
    }
  }

  _despawnBehind(walker) {
    // In-shoe stones are pinned to the foot and can briefly drift behind
    // the cutoff between the despawn pass and the in-shoe re-projection
    // pass (which runs later in update()), so they're explicitly kept.
    const cutoff = walker.worldX - DESPAWN_DISTANCE;
    this.stones = this.stones.filter(s => s.state === 'inshoe' || s.x > cutoff);
  }

  // ── Kick detection ───────────────────────────────────────────────────

  _detectKicks(walker, dt) {
    for (const side of ['right', 'left']) {
      const leg = side === 'right' ? walker.rightLeg : walker.leftLeg;
      if (!leg) continue;

      // Convert the toe from screen coords to world coords. The walker's
      // pelvis lives at screen x = pelvisX, but it's conceptually at
      // world x = worldX; the offset between the two is constant.
      const toeWorld = {
        x: leg.toe.x - walker.pelvisX + walker.worldX,
        y: leg.toe.y,
      };

      const offset = side === 'right' ? 0 : 0.5;
      const legPhase = (walker.phase + offset) % 1;
      const inKickWindow = legPhase > KICK_WINDOW_MIN && legPhase < KICK_WINDOW_MAX;

      const prev = this.prevToeWorld[side];
      if (prev && dt > 0 && inKickWindow) {
        const toeVx = (toeWorld.x - prev.x) / dt;
        const toeVy = (toeWorld.y - prev.y) / dt;

        for (const stone of this.stones) {
          if (stone.state !== 'static') continue;
          const dx = stone.x - toeWorld.x;
          const dy = stone.y - toeWorld.y;
          if (dx * dx + dy * dy < KICK_REACH * KICK_REACH) {
            // Impulse/mass launch. The impulse vector — a fixed base
            // plus a portion of the toe's current velocity — is
            // divided by the stone's mass (∝ r²), so a r=3 stone gets
            // the full kick and a r=6 stone (4× the mass) gets ¼ of
            // it. No floor is applied: heavy stones are *supposed* to
            // barely move, and clamping the kick to a minimum would
            // wipe out the physics. See constants at top of file.
            const massRatio = KICK_BASE_MASS / stone.mass;
            stone.state = 'flying';
            stone.vx = (KICK_BASE_VX + toeVx * KICK_TOE_VX_COEFF) * massRatio;
            stone.vy = (KICK_BASE_VY - Math.abs(toeVy) * KICK_TOE_VY_COEFF) * massRatio;
          }
        }
      }

      this.prevToeWorld[side] = toeWorld;
    }
  }

  // ── Flying stone integration (split into motion + landing) ──────────

  _integratePositions(walker, dt) {
    for (const stone of this.stones) {
      if (stone.state !== 'flying') continue;

      // Snapshot the stone's position before the motion update so the
      // shoe-entry check has a segment (prev → current) to test against.
      stone.prevX = stone.x;
      stone.prevY = stone.y;

      stone.vy += GRAVITY * dt;
      stone.x  += stone.vx * dt;
      stone.y  += stone.vy * dt;
    }
  }

  _landStones(walker) {
    for (const stone of this.stones) {
      if (stone.state !== 'flying') continue;

      // Landing: when the stone's bottom (y + r) reaches the ground line,
      // clamp to rest and flip back to static. Require downward velocity
      // so we don't immediately re-trap a freshly-kicked stone.
      const restingY = walker.groundY - stone.r;
      if (stone.vy > 0 && stone.y >= restingY) {
        stone.y = restingY;
        stone.vx = 0;
        stone.vy = 0;
        stone.state = 'static';
      }
    }
  }

  // ── Shoe-entry detection ─────────────────────────────────────────────

  _detectShoeEntry(walker) {
    // Legs are in screen-space x (walker.pelvisX = 300 is a screen x),
    // stones are in world-space x. Convert leg data into stone-world
    // coords by adding (worldX − pelvisX).
    const xOffset = walker.worldX - walker.pelvisX;

    for (const stone of this.stones) {
      if (stone.state !== 'flying') continue;

      const from = { x: stone.prevX, y: stone.prevY };
      const to   = { x: stone.x,     y: stone.y     };

      let trapped = false;
      for (const side of ['right', 'left']) {
        if (trapped) break;
        const leg = side === 'right' ? walker.rightLeg : walker.leftLeg;
        if (!leg) continue;

        for (const [segA, segB] of COLLAR_SEGMENTS_LOCAL) {
          const a = footLocalToWorld(leg, segA, xOffset);
          const b = footLocalToWorld(leg, segB, xOffset);
          if (segmentsIntersect(from, to, a, b)) {
            this._trapStone(stone, leg, side, xOffset, walker);
            trapped = true;
            break;
          }
        }
      }
    }
  }

  // Transition a flying stone into the 'inshoe' state. Captures the
  // stone's current world position relative to the leg's foot frame so
  // that `_updateInShoe` can re-project it each subsequent frame, and
  // tells the walker to flash the matching shoe red briefly.
  _trapStone(stone, leg, side, xOffset, walker) {
    // Stone's screen-space position (legs live in screen space, so the
    // foot-local frame is anchored to leg.ankle, also in screen space).
    const stoneScreenX = stone.x - xOffset;
    const stoneScreenY = stone.y;
    const dx = stoneScreenX - leg.ankle.x;
    const dy = stoneScreenY - leg.ankle.y;

    // Inverse of footLocalToWorld's rotation:
    //   forward:  world = ankle + R(θ) * local   where θ = π/2 − footAngle
    //   inverse:  local = R(−θ) * (world − ankle) = Rᵀ(θ) * (...)
    // Rᵀ has cos on the diagonal and the off-diagonals swapped/negated.
    const theta = Math.PI / 2 - leg.footAngle;
    const c = Math.cos(theta), s = Math.sin(theta);
    const fx =  c * dx + s * dy;
    const fy = -s * dx + c * dy;

    stone.state = 'inshoe';
    stone.legSide = side;
    stone.footLocal = { x: fx, y: fy };
    // Each stone settles toward a slightly different target so they
    // don't all stack on the same point inside the shoe.
    stone.settleTarget = {
      x: SETTLE_X_MIN + Math.random() * (SETTLE_X_MAX - SETTLE_X_MIN),
      y: SETTLE_Y_MIN + Math.random() * (SETTLE_Y_MAX - SETTLE_Y_MIN),
    };
    // No more projectile motion.
    stone.vx = 0;
    stone.vy = 0;

    this.trappedCount++;

    // Tell the walker to flash this shoe red — visual signal that a
    // stone just damaged the shoe.
    walker.triggerShoeFlash(side);
  }

  // ── In-shoe stone tracking ───────────────────────────────────────────

  _updateInShoe(walker, dt) {
    const xOffset = walker.worldX - walker.pelvisX;
    // Exponential drift toward the settling target. The 1 − e^(-r·dt)
    // form is frame-rate independent: at large dt the stone snaps most
    // of the way; at small dt it moves a small fraction.
    const k = 1 - Math.exp(-SETTLE_RATE * dt);

    for (const stone of this.stones) {
      if (stone.state !== 'inshoe') continue;
      const leg = stone.legSide === 'right' ? walker.rightLeg : walker.leftLeg;
      if (!leg) continue;

      // 1. Settle the foot-local position toward the per-stone target.
      stone.footLocal.x += (stone.settleTarget.x - stone.footLocal.x) * k;
      stone.footLocal.y += (stone.settleTarget.y - stone.footLocal.y) * k;

      // 2. Re-project to world coords using the current leg state.
      //    Pass xOffset = 0 to get screen coords, then add xOffset to
      //    convert to stone-world coords (where stone.x lives).
      const screen = footLocalToWorld(leg, stone.footLocal, 0);
      stone.x = screen.x + xOffset;
      stone.y = screen.y;
    }
  }
}
