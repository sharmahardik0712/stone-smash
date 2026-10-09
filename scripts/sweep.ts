// Parameter sweep for the difficulty ceiling (Classic cannon). Usage: npm run tune
import { CONFIG } from '../src/config/gameConfig';
import { median, runBot } from '../tests/bot/bot';

// Mutate the config in place to try each combination (sweep only; the game never does this).
const C = CONFIG as unknown as {
  difficulty: { budgetHpPerSec: { max: number }; fallSpeed: { max: number }; hpScale: { max: number } };
  stone: { splitSideSpeed: number };
};
const seeds = Array.from({ length: 12 }, (_, i) => 1000 + i * 7919);
for (const budget of [3.0, 3.4, 3.8]) {
  for (const fall of [260, 300, 340]) {
    for (const side of [100, 140]) {
      C.difficulty.budgetHpPerSec.max = budget;
      C.difficulty.fallSpeed.max = fall;
      C.stone.splitSideSpeed = side;
      const t = seeds.map((seed) => runBot({ seed, fixedD: 1 }, 600).survivedSec);
      console.log(
        `budget=${budget} fall=${fall} side=${side}  median=${median(t).toFixed(0)}s min=${Math.min(...t).toFixed(0)}s full=${t.filter((x) => x >= 599).length}/12`,
      );
    }
  }
}
