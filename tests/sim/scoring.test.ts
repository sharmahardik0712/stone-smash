import { describe, expect, it } from 'vitest';
import { BIG, TIER } from '../../src/config/gameConfig';
import { comboMultiplier, pointsForKill, registerKill, timeMultiplier } from '../../src/sim/scoring';
import { createWorld } from '../../src/sim/world';

describe('scoring', () => {
  it('combo multiplier is 1 + 0.1 x combo, capped at x3', () => {
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(3)).toBeCloseTo(1.3);
    expect(comboMultiplier(50)).toBe(3);
  });

  it('time multiplier grows 0.1 per minute, uncapped', () => {
    expect(timeMultiplier(0)).toBe(1);
    expect(timeMultiplier(120)).toBeCloseTo(1.2);
    expect(timeMultiplier(3600)).toBeCloseTo(7);
  });

  it('points = base x combo x time', () => {
    expect(pointsForKill(BIG, 0, 0)).toBe(30);
    expect(pointsForKill(TIER.titanRock, 0, 0)).toBe(100);
    expect(pointsForKill(TIER.medium, 5, 60)).toBe(Math.round(20 * 1.5 * 1.1));
  });

  it('kills within 1.5 s chain the combo; a gap resets it', () => {
    const w = createWorld({ seed: 1 });
    registerKill(w, 2, 'normal', 0, 0);
    expect(w.score.combo).toBe(0);
    w.t = 1;
    registerKill(w, 2, 'normal', 0, 0);
    w.t = 2.4;
    registerKill(w, 2, 'normal', 0, 0);
    expect(w.score.combo).toBe(2);
    w.t = 4;
    registerKill(w, 2, 'normal', 0, 0);
    expect(w.score.combo).toBe(0);
    expect(w.score.bestCombo).toBe(2);
  });
});
