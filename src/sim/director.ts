// The director: difficulty curve, HP budget, waves and safety valves.
// Load is measured in HP per second, not stones per second, because splitting multiplies work.

import { CONFIG, type StoneType } from '../config/gameConfig';
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
    nextTier: 0,
    nextType: 'normal',
    nextCost: 0,
    hasNext: false,
    spawned: 0,
    lastSpawnT: -Infinity,
    lastSpawnX: CONFIG.width / 2,
    lastLifeLostT: -Infinity,
  };
}

export function difficultyAt(tSeconds: number): number {
  return 1 - Math.exp(-tSeconds / CONFIG.difficulty.tau);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function updateCurve(dir: DirectorState, tSeconds: number): void {
  const d = dir.fixedD ?? difficultyAt(tSeconds);
  const c = CONFIG.difficulty;
  dir.d = d;
  dir.budget = lerp(c.budgetHpPerSec.start, c.budgetHpPerSec.max, d);
  dir.fallSpeed = Math.min(lerp(c.fallSpeed.start, c.fallSpeed.max, d), c.fallSpeed.max);
  dir.hpScale = lerp(c.hpScale.start, c.hpScale.max, d);
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

const tierWeights = [0, 0, 0];
const specials: StoneType[] = [];

function chooseNext(world: World): void {
  const dir = world.director;
  const rng = world.rng;
  let tier: Tier;
  let type: StoneType = 'normal';

  if (dir.spawned === 0) {
    tier = 0; // the very first stone is a slow, plain big one down the middle
  } else {
    const tw = CONFIG.difficulty.tierWeights;
    for (let i = 0; i < 3; i++) tierWeights[i] = lerp(tw.start[i], tw.max[i], dir.d);
    tier = weighted(rng, tierWeights) as Tier;

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

export function updateDirector(world: World, dt: number): void {
  const dir = world.director;
  updateCurve(dir, world.t);
  updateWaves(dir, dt);

  if (!dir.hasNext) chooseNext(world);
  if (dir.spawned === 0) dir.wallet = dir.nextCost; // first stone arrives immediately

  dir.wallet += dir.budget * dir.waveFactor * dt;
  // While spending is blocked the wallet does not pile up, so there is never a catch-up burst.
  if (dir.wallet > dir.nextCost) dir.wallet = dir.nextCost;

  if (dir.wallet >= dir.nextCost && canSpawn(world)) {
    const tier = dir.nextTier;
    const type = dir.nextType;
    const radius = CONFIG.stone.radii[tier];
    const x = chooseSpawnX(world, radius);
    const vx = dir.spawned === 0 ? 0 : spawnVx(world, type);
    const s = spawnStone(world, tier, type, x, -radius, vx, dir.fallSpeed);
    if (s) {
      dir.wallet -= dir.nextCost;
      dir.spawned++;
      dir.lastSpawnT = world.t;
      dir.lastSpawnX = x;
      dir.hasNext = false;
    }
  }
}
