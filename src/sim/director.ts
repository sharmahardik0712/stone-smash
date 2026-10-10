// The director: difficulty curve, HP budget, waves and safety valves.
// Load is measured in HP per second, not stones per second, because splitting multiplies work.

import { BIG, CONFIG, type StoneType } from '../config/gameConfig';
import { next, range, weighted } from './rng';
import { spawnStone, spawnVx, stoneCost, type Tier } from './stones';
import type { World } from './world';

export interface DirectorState {
  /** Difficulty 0..1. */
  d: number;
  /** When set, d is pinned to this value (bot tests, debug slider). */
  fixedD: number | null;
  budget: number;
  fallSpeed: number;
  hpScale: number;
  waveFactor: number;
  waveTime: number;
  inPressure: boolean;
  wallet: number;
  nextTier: Tier;
  nextType: StoneType;
  nextCost: number;
  hasNext: boolean;
  spawned: number;
  lastSpawnT: number;
  lastSpawnX: number;
  lastLifeLostT: number;
  /** Smallest giant tier unlocked so far (BIG = none yet). */
  biggestTier: Tier;
  /** Tier the next stone must be (the giant that just unlocked), or -1. */
  forceTier: number;
  /** Seconds the screen has had no stones in play. */
  emptyFor: number;
}

export function createDirector(fixedD: number | null): DirectorState {
  return {
    d: 0,
    fixedD,
    budget: CONFIG.difficulty.budgetHpPerSec.start,
    fallSpeed: CONFIG.difficulty.fallSpeed.start,
    hpScale: CONFIG.difficulty.hpScale.start,
    waveFactor: CONFIG.waves.pressureFactor,
    waveTime: 0,
    inPressure: true,
    wallet: 0,
    nextTier: BIG,
    nextType: 'normal',
    nextCost: 0,
    hasNext: false,
    spawned: 0,
    lastSpawnT: -Infinity,
    lastSpawnX: CONFIG.width / 2,
    lastLifeLostT: -Infinity,
    biggestTier: BIG,
    forceTier: -1,
    emptyFor: 0,
  };
}

export function difficultyAt(tSeconds: number): number {
  return 1 - Math.exp(-tSeconds / CONFIG.difficulty.tau);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Overtime multiplier on the HP budget (1 before overtime starts). */
export function overtimeBudgetMult(tSeconds: number): number {
  const o = CONFIG.overtime;
  return 1 + (o.budgetPerMin * Math.max(0, tSeconds - o.startSec)) / 60;
}

export function updateCurve(dir: DirectorState, tSeconds: number): void {
  const d = dir.fixedD ?? difficultyAt(tSeconds);
  const c = CONFIG.difficulty;
  const o = CONFIG.overtime;
  const overMin = Math.max(0, tSeconds - o.startSec) / 60;
  dir.d = d;
  dir.budget = lerp(c.budgetHpPerSec.start, c.budgetHpPerSec.max, d) * overtimeBudgetMult(tSeconds);
  const fall = Math.min(lerp(c.fallSpeed.start, c.fallSpeed.max, d), c.fallSpeed.max);
  dir.fallSpeed = Math.min(fall + o.fallPerMin * overMin, Math.max(fall, o.fallCap));
  dir.hpScale = lerp(c.hpScale.start, c.hpScale.max, d) + o.hpPerMin * overMin;
}

/** Unlocks giant tiers on schedule; the next stone after an unlock is that giant. */
function updateGiants(world: World): void {
  const dir = world.director;
  while (dir.biggestTier > 0) {
    const candidate = (dir.biggestTier - 1) as Tier;
    const unlockAt: readonly number[] = CONFIG.giants.unlockAt;
    if (world.t < unlockAt[candidate]) break;
    dir.biggestTier = candidate;
    dir.forceTier = candidate;
    dir.hasNext = false;
    const e = world.events.push('newTier', CONFIG.width / 2, 0);
    e.tier = candidate;
  }
}

function updateWaves(dir: DirectorState, dt: number): void {
  const w = CONFIG.waves;
  dir.waveTime += dt;
  const len = dir.inPressure ? w.pressureSec : w.breatherSec;
  if (dir.waveTime >= len) {
    dir.waveTime -= len;
    dir.inPressure = !dir.inPressure;
  }
  dir.waveFactor = dir.inPressure ? w.pressureFactor : w.breatherFactor;
}

const tierWeights = [0, 0, 0, 0, 0, 0];
const specials: StoneType[] = [];

function chooseNext(world: World): void {
  const dir = world.director;
  const rng = world.rng;
  let tier: Tier;
  let type: StoneType = 'normal';

  if (dir.spawned === 0) {
    tier = BIG; // the very first stone is a slow, plain big one down the middle
  } else if (dir.forceTier >= 0) {
    tier = dir.forceTier as Tier; // a giant just unlocked: show it straight away
    dir.forceTier = -1;
  } else {
    const tw = CONFIG.difficulty.tierWeights;
    for (let i = 0; i < BIG; i++) tierWeights[i] = i >= dir.biggestTier ? CONFIG.giants.weight[i] : 0;
    for (let i = 0; i < 3; i++) tierWeights[BIG + i] = lerp(tw.start[i], tw.max[i], dir.d);
    tier = weighted(rng, tierWeights) as Tier;
  }

  if (dir.spawned > 0 && tier >= BIG) {
    const u = CONFIG.unlocks;
    const t = world.t;
    if (t >= u.goldenAt && next(rng) < u.goldenChance) {
      type = 'golden';
    } else {
      specials.length = 0;
      if (t >= u.bouncyAt) specials.push('bouncy');
      if (t >= u.armoredAt) specials.push('armored');
      if (t >= u.bombAt) specials.push('bomb');
      const sc = CONFIG.difficulty.specialChance;
      if (specials.length > 0 && next(rng) < lerp(sc.start, sc.max, dir.d)) {
        type = specials[Math.floor(next(rng) * specials.length)];
      }
    }
  }

  // Giants are always plain stones, so they read clearly.
  dir.nextTier = tier;
  dir.nextType = type;
  dir.nextCost = stoneCost(tier, type, dir.hpScale);
  dir.hasNext = true;
}

function chooseSpawnX(world: World, radius: number): number {
  const dir = world.director;
  if (dir.spawned === 0) return CONFIG.width / 2;
  let lo = radius;
  let hi = CONFIG.width - radius;
  // Reachability: two spawns close in time must be close in space (the cannon crosses 720 px in 0.8 s).
  if (world.t - dir.lastSpawnT < CONFIG.safety.reachWindowSec) {
    lo = Math.max(lo, dir.lastSpawnX - CONFIG.safety.reachMaxPx);
    hi = Math.min(hi, dir.lastSpawnX + CONFIG.safety.reachMaxPx);
  }
  return range(world.rng, lo, hi);
}

export function canSpawn(world: World): boolean {
  const dir = world.director;
  if (world.stones.countActive() >= CONFIG.safety.maxStonesOnScreen) return false;
  if (world.t - dir.lastLifeLostT < CONFIG.safety.graceAfterLifeLostSec) return false;
  return true;
}

/** Wallet amount at which the next stone can be bought. Giants are bought on credit. */
function affordAt(dir: DirectorState): number {
  if (dir.nextTier >= BIG) return dir.nextCost;
  return Math.min(dir.nextCost, CONFIG.giants.creditSec * dir.budget);
}

export function updateDirector(world: World, dt: number): void {
  const dir = world.director;
  updateCurve(dir, world.t);
  updateWaves(dir, dt);
  updateGiants(world);

  if (!dir.hasNext) chooseNext(world);
  if (dir.spawned === 0) dir.wallet = dir.nextCost; // first stone arrives immediately

  dir.wallet += dir.budget * dir.waveFactor * dt;
  // While spending is blocked the wallet does not pile up, so there is never a catch-up burst.
  const target = affordAt(dir);
  if (dir.wallet > target) dir.wallet = target;

  // An empty screen has nothing left to pace: send the next stone now and forgive any debt.
  dir.emptyFor = world.stones.countActive() === 0 ? dir.emptyFor + dt : 0;
  if (dir.emptyFor >= CONFIG.safety.maxEmptySec && dir.spawned > 0) dir.wallet = target;

  if (dir.wallet >= target && canSpawn(world)) {
    const tier = dir.nextTier;
    const type = dir.nextType;
    const radius = CONFIG.stone.radii[tier];
    const x = chooseSpawnX(world, radius);
    const vx = dir.spawned === 0 ? 0 : spawnVx(world, type);
    const s = spawnStone(world, tier, type, x, -radius, vx, dir.fallSpeed * CONFIG.stone.fallMult[tier]);
    if (s) {
      dir.wallet -= dir.nextCost; // may go negative for a giant: the family itself is the pressure
      dir.spawned++;
      dir.lastSpawnT = world.t;
      dir.lastSpawnX = x;
      dir.hasNext = false;
    }
  }
}
