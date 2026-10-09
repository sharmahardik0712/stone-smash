import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config/gameConfig';
import { MAX_RUN_LEVEL } from '../../src/sim/cannon';
import { registerKill } from '../../src/sim/scoring';
import { spawnStone } from '../../src/sim/stones';
import { createWorld, step } from '../../src/sim/world';
import { goalMet, liveStats, newlyEarned, withUnlocked } from '../../src/utils/progress';
import { DEFAULT_CANNONS, DEFAULT_STATS, MemoryStore, Storage } from '../../src/utils/storage';

const dt = CONFIG.sim.step;
const idle = { targetX: 360, fire: false };

describe('in-run cannon levels', () => {
  it('levels up from smashing stones and caps at the max level', () => {
    const w = createWorld({ seed: 1 });
    const [, lv2, lv3] = CONFIG.runLevels.thresholds;
    for (let i = 0; i < lv2; i++) registerKill(w, 2, 'normal', 0, 0);
    expect(w.cannon.level).toBe(2);
    for (let i = lv2; i < lv3 + 50; i++) registerKill(w, 2, 'normal', 0, 0);
    expect(w.cannon.level).toBe(MAX_RUN_LEVEL);
  });

  it('losing a life drops one level and restarts its progress', () => {
    const w = createWorld({ seed: 1, manualFire: true });
    w.director.lastLifeLostT = 1e9;
    for (let i = 0; i < CONFIG.runLevels.thresholds[2]; i++) registerKill(w, 2, 'normal', 0, 0);
    expect(w.cannon.level).toBe(3);
    spawnStone(w, 2, 'normal', 100, CONFIG.groundY - 10, 0, 300);
    step(w, idle, dt);
    expect(w.cannon.level).toBe(2);
    expect(w.cannon.xp).toBe(CONFIG.runLevels.thresholds[1]);
  });

  it('twin cannons fire two bullets per shot', () => {
    const w = createWorld({ seed: 1, cannon: 'twin' });
    w.cannon.fireTimer = 0;
    step(w, { targetX: 360, fire: true }, dt);
    expect(w.bullets.countActive()).toBe(2);
  });

  it('higher levels and better cannons shoot faster bullets', () => {
    const speed = (cannon: 'classic' | 'blaster', level: number) => {
      const w = createWorld({ seed: 1, cannon });
      w.cannon.level = level;
      w.cannon.fireTimer = 0;
      step(w, { targetX: 360, fire: true }, dt);
      return -w.bullets.items.find((b) => b.active)!.vy;
    };
    expect(speed('classic', 2)).toBeGreaterThan(speed('classic', 1));
    expect(speed('blaster', 1)).toBeGreaterThan(speed('classic', 1));
  });
});

describe('cannon unlocks', () => {
  it('goals unlock from saved stats or the run in progress', () => {
    const stats = liveStats({ ...DEFAULT_STATS, longestRunSec: 30 }, 95, 10, 500);
    expect(newlyEarned(DEFAULT_CANNONS, stats).map((c) => c.id)).toEqual(['blaster']);
    expect(goalMet({ kind: 'totalStones', value: 400 }, stats)).toBe(false);
  });

  it('unlocks persist across reloads, and a v1 save migrates', () => {
    const backend = new MemoryStore();
    backend.setItem('ss.version', '1');
    backend.setItem('ss.coins', '77');
    const s = new Storage(backend);
    expect(s.getCannons()).toEqual(DEFAULT_CANNONS);
    expect(s.getCoins()).toBe(77);
    s.setCannons({ ...withUnlocked(s.getCannons(), ['twin']), selected: 'twin' });
    expect(new Storage(backend).getCannons()).toEqual({ unlocked: ['classic', 'twin'], selected: 'twin' });
  });

  it('ignores corrupt cannon saves', () => {
    const backend = new MemoryStore();
    backend.setItem('ss.cannons', '{"unlocked":["laser"],"selected":"laser"}');
    expect(new Storage(backend).getCannons()).toEqual(DEFAULT_CANNONS);
  });
});
