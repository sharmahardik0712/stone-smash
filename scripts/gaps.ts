// Measures empty-screen waits: stretches with no stones in play, by game time and cannon.
// Usage: npx tsx scripts/gaps.ts
import { CANNONS, CONFIG } from '../src/config/gameConfig';
import type { Upgrades } from '../src/sim/world';
import { createWorld, step } from '../src/sim/world';
import { botTarget, type BotMemory } from '../tests/bot/bot';

const MAX: Upgrades = { fireRate: 5, cannonSpeed: 5, powerDuration: 5 };
const NONE: Upgrades = { fireRate: 0, cannonSpeed: 0, powerDuration: 0 };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

for (const c of [CANNONS[0], CANNONS[CANNONS.length - 1]]) {
  const upgrades = c.id === 'classic' ? NONE : MAX;
  const gaps: { at: number; len: number; afterGiant: boolean }[] = [];
  for (let seed = 1; seed <= 10; seed++) {
    const w = createWorld({ seed: 1000 + seed * 7919, cannon: c.id, upgrades });
    const buf: number[] = new Array(10).fill(360);
    const mem: BotMemory = { targetId: -1 };
    let h = 0;
    let emptySince = -1;
    let lastGiantT = -Infinity;
    const input = { targetX: 360, fire: true };
    while (!w.gameOver && w.t < 900) {
      buf[h] = botTarget(w, mem);
      h = (h + 1) % buf.length;
      input.targetX = buf[h];
      step(w, input, CONFIG.sim.step);
      if (w.stones.items.some((s) => s.active && s.tier < 3)) lastGiantT = w.t;
      const empty = w.stones.countActive() === 0;
      if (empty && emptySince < 0) emptySince = w.t;
      if (!empty && emptySince >= 0) {
        const len = w.t - emptySince;
        if (len >= 2) gaps.push({ at: emptySince, len, afterGiant: emptySince - lastGiantT < 5 });
        emptySince = -1;
      }
    }
  }
  gaps.sort((a, b) => b.len - a.len);
  const total = gaps.reduce((n, g) => n + g.len, 0);
  console.log(
    `${c.name}${upgrades === MAX ? '+max' : ''}: ${gaps.length} empty waits of 2s+ in 10 runs (${total.toFixed(0)}s total), ` +
      `${gaps.filter((g) => g.afterGiant).length} right after a giant`,
  );
  for (const g of gaps.slice(0, 8)) {
    console.log(`   ${g.len.toFixed(1)}s empty at ${fmt(g.at)}${g.afterGiant ? '  (just after a giant)' : ''}`);
  }
}
