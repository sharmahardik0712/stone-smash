import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config/gameConfig';
import { difficultyAt } from '../../src/sim/director';
import { spawnStone } from '../../src/sim/stones';
import { createWorld, step } from '../../src/sim/world';

const dt = CONFIG.sim.step;

describe('director', () => {
  it('difficulty curve rises toward 1 and never above', () => {
    expect(difficultyAt(0)).toBe(0);
    expect(difficultyAt(60)).toBeCloseTo(0.33, 2);
    expect(difficultyAt(180)).toBeCloseTo(0.7, 1);
    expect(difficultyAt(100000)).toBeLessThanOrEqual(1);
  });

  it('budget never exceeds max x 1.1 and fall speed never exceeds its cap', () => {
    const w = createWorld({ seed: 7 });
    const input = { targetX: 360, fire: true };
    for (let i = 0; i < 60 * 60 * 15; i++) {
      step(w, input, dt);
      w.lives = 3; // keep the run alive
      w.gameOver = false;
      const d = w.director;
      expect(d.budget * d.waveFactor).toBeLessThanOrEqual(CONFIG.difficulty.budgetHpPerSec.max * 1.1 + 1e-9);
      expect(d.fallSpeed).toBeLessThanOrEqual(CONFIG.difficulty.fallSpeed.max);
    }
  });

  it('the first stone is a plain big one down the middle', () => {
    const w = createWorld({ seed: 3 });
    step(w, { targetX: 360, fire: false }, dt);
    const s = w.stones.items.find((x) => x.active)!;
    expect(s.tier).toBe(0);
    expect(s.type).toBe('normal');
    expect(s.x).toBe(CONFIG.width / 2);
    expect(s.hp).toBe(4);
  });

  it('stops spending at the on-screen cap', () => {
    const w = createWorld({ seed: 5, fixedD: 1 });
    for (let i = 0; i < CONFIG.safety.maxStonesOnScreen; i++) spawnStone(w, 2, 'normal', 100, -2000, 0, 0);
    const before = w.director.spawned;
    for (let i = 0; i < 600; i++) {
      // Pin the decoys far above the screen so they never land.
      for (const s of w.stones.items) if (s.active) s.y = -2000;
      step(w, { targetX: 360, fire: false }, dt);
    }
    expect(w.director.spawned).toBe(before);
  });

  it('spawns in the reach window are at most 360 px apart, and none follow a lost life', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const w = createWorld({ seed, fixedD: 1 });
      const input = { targetX: 360, fire: false }; // never fires: plenty of ground hits
      let lastT = -Infinity;
      let lastX = 0;
      let spawned = 0;
      for (let i = 0; i < 60 * 120; i++) {
        step(w, input, dt);
        w.lives = 3;
        w.gameOver = false;
        if (w.director.spawned !== spawned) {
          spawned = w.director.spawned;
          if (w.t - lastT < CONFIG.safety.reachWindowSec) {
            expect(Math.abs(w.director.lastSpawnX - lastX)).toBeLessThanOrEqual(
              CONFIG.safety.reachMaxPx + 1e-9,
            );
          }
          expect(w.t - w.director.lastLifeLostT).toBeGreaterThanOrEqual(
            CONFIG.safety.graceAfterLifeLostSec - 1e-9,
          );
          lastT = w.t;
          lastX = w.director.lastSpawnX;
        }
      }
    }
  });
});
