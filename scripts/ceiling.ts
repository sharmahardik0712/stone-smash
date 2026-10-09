// Survival at a pinned difficulty (d = 1) with overtime and/or giants switched off, to see what ends runs.
// Usage: npx tsx scripts/ceiling.ts
import { CONFIG } from '../src/config/gameConfig';
import { median, runBot } from '../tests/bot/bot';

const C = CONFIG as unknown as { overtime: { startSec: number }; giants: { unlockAt: number[] } };
const seeds = Array.from({ length: 30 }, (_, i) => 1000 + i * 7919);
const base = { start: C.overtime.startSec, unlock: [...C.giants.unlockAt] };
const variants: [string, boolean, boolean][] = [
  ['current', true, true],
  ['no overtime', false, true],
  ['no giants', true, false],
  ['neither', false, false],
];
for (const [name, overtime, giants] of variants) {
  C.overtime.startSec = overtime ? base.start : 1e9;
  C.giants.unlockAt = giants ? base.unlock : [1e9, 1e9, 1e9];
  const t = seeds.map((seed) => runBot({ seed, fixedD: 1 }, 600).survivedSec);
  const full = t.filter((x) => x >= 599).length;
  console.log(`${name.padEnd(12)} d=1 median ${median(t).toFixed(0)}s, full 10 min ${full}/30`);
}
