// A simple auto-player: chases the lowest stone, with a reaction delay.
// It is deliberately worse than a focused human: if it survives, a person can too.

import { CONFIG } from '../../src/config/gameConfig';
import { createWorld, step, type Input, type World, type WorldOptions } from '../../src/sim/world';

export interface BotResult {
  seed: number;
  survivedSec: number;
  livesLost: number;
  score: number;
  coins: number;
}

/** Bot memory: the stone id it is chasing, so twin children from a split do not make it dither. */
export interface BotMemory {
  targetId: number;
}

const STICKY_PX = 60;

export function botTarget(world: World, mem: BotMemory = { targetId: -1 }): number {
  let best = -1;
  let bestY = -Infinity;
  let current = -1;
  const stones = world.stones.items;
  for (let i = 0; i < stones.length; i++) {
    const s = stones[i];
    if (!s.active || s.y < 0) continue;
    if (s.id === mem.targetId) current = i;
    const bottom = s.y + s.radius;
    if (bottom > bestY) {
      bestY = bottom;
      best = i;
    }
  }
  if (best < 0) return world.cannon.x;
  // Keep chasing the current target unless another stone is clearly lower.
  if (current >= 0 && stones[current].y + stones[current].radius >= bestY - STICKY_PX) best = current;
  const s = stones[best];
  mem.targetId = s.id;
  // Lead the target by the bullet's travel time.
  const travel = (CONFIG.cannon.y - s.y) / CONFIG.cannon.bulletSpeed;
  return s.x + s.vx * travel;
}

export function runBot(opts: WorldOptions, maxSec: number, reactionSec = 0.15): BotResult {
  const world = createWorld(opts);
  const dt = CONFIG.sim.step;
  const delaySteps = Math.round(reactionSec / dt);
  const buffer: number[] = new Array(delaySteps + 1).fill(world.cannon.x);
  const input: Input = { targetX: world.cannon.x, fire: true };
  const maxTicks = Math.round(maxSec / dt);
  const mem: BotMemory = { targetId: -1 };
  let head = 0;
  while (!world.gameOver && world.tick < maxTicks) {
    buffer[head] = botTarget(world, mem);
    head = (head + 1) % buffer.length;
    input.targetX = buffer[head]; // the decision made `delaySteps` ticks ago
    step(world, input, dt);
  }
  return {
    seed: opts.seed,
    survivedSec: world.t,
    livesLost: CONFIG.lives - world.lives,
    score: world.score.score,
    coins: world.coins,
  };
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
