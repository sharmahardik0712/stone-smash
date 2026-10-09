// Normal-run length (rising curve + giants + overtime) for the weakest and strongest setups.
// Usage: npx tsx scripts/runlength.ts [budgetPerMin hpPerMin giantWeightScale]
import { CANNONS, CONFIG } from '../src/config/gameConfig';
import type { Upgrades } from '../src/sim/world';
import { median, runBot } from '../tests/bot/bot';

const C = CONFIG as unknown as {
  overtime: { budgetPerMin: number; hpPerMin: number };
  giants: { weight: number[] };
};
const MAX: Upgrades = { fireRate: 5, cannonSpeed: 5, powerDuration: 5 };
const NONE: Upgrades = { fireRate: 0, cannonSpeed: 0, powerDuration: 0 };
const seeds = Array.from({ length: 20 }, (_, i) => 1000 + i * 7919);
const rates = process.argv.slice(2).map(Number);
const fmt = (s: number) => {
  const r = Math.round(s);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
};

// Args: budgetPerMin hpPerMin giantWeightScale (one combination per run).
const [rate = C.overtime.budgetPerMin, hp = C.overtime.hpPerMin, gScale = 1] = rates;
{
  C.overtime.budgetPerMin = rate;
  C.overtime.hpPerMin = hp;
  C.giants.weight = C.giants.weight.map((w) => w * gScale);
  const rows: string[] = [];
  for (const c of CANNONS) {
    const upgrades = c.id === 'classic' ? NONE : MAX;
    const t = seeds.map((seed) => runBot({ seed, cannon: c.id, upgrades }, 1800).survivedSec);
    rows.push(
      `${c.name}${upgrades === MAX ? '+max' : ''} median ${fmt(median(t))} (min ${fmt(Math.min(...t))}, max ${fmt(Math.max(...t))})`,
    );
  }
  console.log(`budgetPerMin=${rate}\n  ${rows.join('\n  ')}`);
}
