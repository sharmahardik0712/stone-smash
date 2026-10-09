import { describe, expect, it } from 'vitest';
import { BIG, CONFIG, SMALLEST, TIER } from '../../src/config/gameConfig';
import { difficultyAt, overtimeBudgetMult } from '../../src/sim/director';
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
      // Before overtime the budget stays within max x 1.1; overtime only scales that by its multiplier.
      const cap = CONFIG.difficulty.budgetHpPerSec.max * 1.1 * overtimeBudgetMult(w.t);
      expect(d.budget * d.waveFactor).toBeLessThanOrEqual(cap + 1e-9);
      expect(d.fallSpeed).toBeLessThanOrEqual(CONFIG.overtime.fallCap);
      if (w.t < CONFIG.overtime.startSec)
        expect(d.fallSpeed).toBeLessThanOrEqual(CONFIG.difficulty.fallSpeed.max);
    }
  });

  it('overtime keeps raising the budget after the plateau', () => {
    expect(overtimeBudgetMult(CONFIG.overtime.startSec)).toBe(1);
    expect(overtimeBudgetMult(CONFIG.overtime.startSec + 300)).toBeCloseTo(
      1 + CONFIG.overtime.budgetPerMin * 5,
    );
  });

  it('giants unlock on schedule, each announced and sent straight away', () => {
    const w = createWorld({ seed: 9 });
    const input = { targetX: 360, fire: true };
    const announced: number[] = [];
    const firstSpawn: Record<number, number> = {};
    while (w.t < 400) {
      step(w, input, dt);
      w.lives = 3;
      w.gameOver = false;
      for (let i = 0; i < w.events.count; i++) {
        if (w.events.items[i].type === 'newTier') announced.push(w.events.items[i].tier);
      }
      for (const s of w.stones.items) {
        if (s.active && s.tier < BIG && firstSpawn[s.tier] === undefined) firstSpawn[s.tier] = w.t;
      }
    }
    expect(announced).toEqual([TIER.boulder, TIER.mountain, TIER.titanRock]);
    for (const tier of [TIER.boulder, TIER.mountain, TIER.titanRock]) {
      expect(firstSpawn[tier]).toBeGreaterThanOrEqual(CONFIG.giants.unlockAt[tier]);
      expect(firstSpawn[tier]).toBeLessThan(CONFIG.giants.unlockAt[tier] + 15);
    }
  });

  it('the first stone is a plain big one down the middle', () => {
    const w = createWorld({ seed: 3 });
    step(w, { targetX: 360, fire: false }, dt);
    const s = w.stones.items.find((x) => x.active)!;
    expect(s.tier).toBe(BIG);
    expect(s.type).toBe('normal');
    expect(s.x).toBe(CONFIG.width / 2);
    expect(s.hp).toBe(4);
  });

  it('stops spending at the on-screen cap', () => {
    const w = createWorld({ seed: 5, fixedD: 1 });
    for (let i = 0; i < CONFIG.safety.maxStonesOnScreen; i++)
      spawnStone(w, SMALLEST, 'normal', 100, -2000, 0, 0);
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
