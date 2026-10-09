// Bot survival per cannon at the ceiling and in a normal rising run. Usage: npx tsx scripts/cannons.ts
import { CANNONS } from '../src/config/gameConfig';
import { median, runBot } from '../tests/bot/bot';

const seeds = Array.from({ length: 30 }, (_, i) => 1000 + i * 7919);
for (const c of CANNONS) {
  const ceil = seeds.map((seed) => runBot({ seed, fixedD: 1, cannon: c.id }, 600).survivedSec);
  const normal = seeds.slice(0, 15).map((seed) => runBot({ seed, cannon: c.id }, 1200).survivedSec);
  console.log(
    `${c.name.padEnd(8)} d=1 median ${median(ceil).toFixed(0)}s min ${Math.min(...ceil).toFixed(0)}s | normal run median ${median(normal).toFixed(0)}s`,
  );
}
