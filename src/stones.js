// Stone launch + projectile integration, per gait-model-spec.md §6.
//
// Stones are recorded in WORLD coordinates so they stay put as the ground
// scrolls past. The toe position (coming from the leg IK) is in *screen*
// coordinates because the walker's pelvis lives at a fixed screen x, so we
// convert at launch time by adding (worldX − pelvisX).

const GRAVITY = 600;          // px/s²
const TOE_OFF_MIN = 0.55;
const TOE_OFF_MAX = 0.65;

export class StoneSystem {
  constructor() {
    this.stones = [];
    this.prevToeWorld = { right: null, left: null };
  }

  update(walker, dt) {
    for (const side of ['right', 'left']) {
      const leg = side === 'right' ? walker.rightLeg : walker.leftLeg;
      if (!leg) continue;

      // Convert toe from screen coords (where the walker lives) to world
      // coords (where stones live).
      const toeWorld = {
        x: leg.toe.x - walker.pelvisX + walker.worldX,
        y: leg.toe.y,
      };

      const offset = side === 'right' ? 0 : 0.5;
      const legPhase = (walker.phase + offset) % 1;

      const prev = this.prevToeWorld[side];
      if (prev && dt > 0) {
        const vx = (toeWorld.x - prev.x) / dt;
        const vy = (toeWorld.y - prev.y) / dt;

        if (legPhase > TOE_OFF_MIN && legPhase < TOE_OFF_MAX) {
          this.stones.push({
            x: toeWorld.x,
            y: toeWorld.y,
            vx: vx * 0.4,                    // tangential component
            vy: -Math.abs(vy) * 0.6 - 80,    // upward kick
            r: 3 + Math.random() * 3,
          });
        }
      }
      this.prevToeWorld[side] = toeWorld;
    }

    // Integrate under gravity.
    for (const s of this.stones) {
      s.vy += GRAVITY * dt;
      s.x  += s.vx * dt;
      s.y  += s.vy * dt;
    }

    // Retire stones that have fallen past the ground or drifted far behind.
    this.stones = this.stones.filter(s =>
      s.y < walker.groundY + 50 &&
      s.x > walker.worldX - 1000
    );
  }
}
