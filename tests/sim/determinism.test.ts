import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config/gameConfig';
import { createWorld, hashWorld, step } from '../../src/sim/world';
import { botTarget } from '../bot/bot';

function play(seed: number, ticks: number): string {
  const w = createWorld({ seed });
  const input = { targetX: 360, fire: true };
  for (let i = 0; i < ticks && !w.gameOver; i++) {
    // Scripted input log: a deterministic function of tick + state.
    input.targetX = i % 300 < 150 ? botTarget(w) : 120 + (i % 480);
    step(w, input, CONFIG.sim.step);
  }
  return hashWorld(w);
}

describe('determinism', () => {
  it('same seed + same input log gives the same final state hash', () => {
    expect(play(42, 60 * 90)).toBe(play(42, 60 * 90));
  });

  it('different seeds diverge', () => {
    expect(play(42, 60 * 90)).not.toBe(play(43, 60 * 90));
  });
});
