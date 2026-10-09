import { describe, expect, it } from 'vitest';
import { median, runBot } from './bot';

const SEEDS = Array.from({ length: 50 }, (_, i) => 1000 + i * 7919);

describe('bot survival ("never unplayable" proof)', () => {
  it('survives a median of 5+ minutes at the difficulty ceiling (d = 1)', () => {
    const results = SEEDS.map((seed) => runBot({ seed, fixedD: 1 }, 600));
    const times = results.map((r) => r.survivedSec);
    const med = median(times);
    console.log(
      `d=1 median survival ${med.toFixed(0)}s; min ${Math.min(...times).toFixed(0)}s; ` +
        `full 10 min: ${times.filter((t) => t >= 599).length}/${results.length}`,
    );
    expect(med).toBeGreaterThanOrEqual(300);
  });

  it('almost never loses a life at first-minute difficulty (d = 0.33)', () => {
    const results = SEEDS.map((seed) => runBot({ seed, fixedD: 0.33 }, 60));
    const lost = results.reduce((n, r) => n + r.livesLost, 0);
    console.log(`d=0.33 lives lost over ${results.length} one-minute runs: ${lost}`);
    expect(lost / results.length).toBeLessThanOrEqual(0.1);
  });

  it('a normal run (rising curve) earns a sensible number of coins in 3 minutes', () => {
    const results = SEEDS.slice(0, 20).map((seed) => runBot({ seed }, 180));
    const coins = median(results.map((r) => r.coins));
    console.log(`median coins in a 3-minute bot run: ${coins}`);
    expect(coins).toBeGreaterThanOrEqual(15);
  });
});
