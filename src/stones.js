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
const KICK_WINDOW_MIN   = 0.55;  // toe-off phase start
const KICK_WINDOW_MAX   = 0.70;  // toe-off phase end
const KICK_REACH        = 26;    // px — toe→stone distance at which a kick fires
const STONE_MIN_R       = 3;
const STONE_MAX_R       = 6;

// Procedural stone scatter settings.
const SPAWN_HORIZON     = 700;   // spawn stones this far ahead of the walker
const DESPAWN_DISTANCE  = 600;   // remove stones this far behind the walker
const SPAWN_MIN_GAP     = 35;    // minimum world-x spacing between stones
const SPAWN_MAX_GAP     = 130;   // maximum world-x spacing between stones

// Collar-opening endpoints in foot-local coordinates. These are SNEAKER
// points 3 and 4 from renderer.js — the bottom of the V-shaped notch at
// the ankle where the shoe upper cuts inward. A flying stone whose
// trajectory segment crosses the world-space projection of this line
// has entered the shoe.
const COLLAR_A_LOCAL = { x: 0, y: -7.5 };
const COLLAR_B_LOCAL = { x: 5, y: -7.5 };

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
        state: 'static',
      });
    }
  }

  _despawnBehind(walker) {
    const cutoff = walker.worldX - DESPAWN_DISTANCE;
    this.stones = this.stones.filter(s => s.x > cutoff);
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
            // Launch. Use a fixed forward + upward base velocity with a
            // small contribution from the toe's own motion so each kick
            // varies a little. Clamp to guarantee the stone actually
            // flies forward and up.
            stone.state = 'flying';
            stone.vx = Math.max(120 + toeVx * 0.25,  90);
            stone.vy = Math.min(-320 - Math.abs(toeVy) * 0.2, -280);
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

    // Filter the stones array in place: stones that enter the shoe are
    // dropped (the trapped counter tracks the total). Future steps will
    // keep them around and attach them to the foot; for step 1 the goal
    // is just to confirm detection by watching `trapped:` tick up.
    this.stones = this.stones.filter((stone) => {
      if (stone.state !== 'flying') return true;

      const from = { x: stone.prevX, y: stone.prevY };
      const to   = { x: stone.x,     y: stone.y     };

      for (const side of ['right', 'left']) {
        const leg = side === 'right' ? walker.rightLeg : walker.leftLeg;
        if (!leg) continue;

        const a = footLocalToWorld(leg, COLLAR_A_LOCAL, xOffset);
        const b = footLocalToWorld(leg, COLLAR_B_LOCAL, xOffset);

        if (segmentsIntersect(from, to, a, b)) {
          this.trappedCount++;
          return false;   // consume the stone
        }
      }
      return true;
    });
  }
}
