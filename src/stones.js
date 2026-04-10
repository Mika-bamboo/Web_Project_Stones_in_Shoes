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

export class StoneSystem {
  constructor() {
    this.stones = [];
    this.prevToeWorld = { right: null, left: null };
    // World x up to which we've generated static stones. Lazy-initialized
    // on the first update() call once we know the walker's starting worldX.
    this.generatedUpTo = null;
  }

  update(walker, dt) {
    this._ensureScatter(walker);
    this._despawnBehind(walker);
    this._detectKicks(walker, dt);
    this._integrateFlying(walker, dt);
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

  // ── Flying stone integration ─────────────────────────────────────────

  _integrateFlying(walker, dt) {
    for (const stone of this.stones) {
      if (stone.state !== 'flying') continue;

      stone.vy += GRAVITY * dt;
      stone.x  += stone.vx * dt;
      stone.y  += stone.vy * dt;

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
}
