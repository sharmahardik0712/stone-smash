// World state + step(). Pure TypeScript: no Phaser, no clock, no Math.random, no DOM.
// step(world, input, dt) advances one fixed tick and leaves this tick's events in world.events.

import { cannonDef, CONFIG, type CannonId } from '../config/gameConfig';
import { makeBullet, updateBullets, type Bullet } from './bullets';
import { createCannon, loseLevel, updateCannon, type Cannon } from './cannon';
import { circlesOverlap, touchesGround } from './collision';
import { createDirector, updateCurve, updateDirector, type DirectorState } from './director';
import { EventQueue } from './events';
import { Pool } from './pool';
import {
  createPowerState,
  makePickup,
  tickPowerUps,
  updatePickups,
  type Pickup,
  type PowerState,
} from './powerups';
import { createRng, type Rng } from './rng';
import { createScoreState, resetCombo, type ScoreState } from './scoring';
import { damageStone, makeStone, resolveBlasts, updateStones, type Stone } from './stones';

export interface Input {
  /** Where the player wants the cannon (logical px). */
  targetX: number;
  /** Fire button, used only in manual fire mode. */
  fire: boolean;
}

export interface Upgrades {
  fireRate: number;
  cannonSpeed: number;
  powerDuration: number;
}

export interface WorldOptions {
  seed: number;
  upgrades?: Upgrades;
  /** Pin difficulty to a fixed d (tests / debug). */
  fixedD?: number | null;
  manualFire?: boolean;
  /** Which unlocked cannon to play with (default: classic). */
  cannon?: CannonId;
}

export interface Stats {
  fireInterval: number;
  maxSpeed: number;
  powerDurationMult: number;
}

interface Blast {
  x: number;
  y: number;
  depth: number;
}

export interface World {
  seed: number;
  t: number;
  tick: number;
  rng: Rng;
  stats: Stats;
  manualFire: boolean;
  cannon: Cannon;
  bullets: Pool<Bullet>;
  stones: Pool<Stone>;
  pickups: Pool<Pickup>;
  blasts: { items: Blast[]; count: number };
  director: DirectorState;
  score: ScoreState;
  power: PowerState;
  lives: number;
  invulnerable: number;
  coins: number;
  bigKills: number;
  gameOver: boolean;
  nextStoneId: number;
  nextPickupId: number;
  events: EventQueue;
}

export function statsFor(upgrades: Upgrades): Stats {
  const u = CONFIG.upgrades;
  return {
    fireInterval: CONFIG.cannon.fireInterval * (1 - u.fireRatePerLevel * upgrades.fireRate),
    maxSpeed: CONFIG.cannon.maxSpeed * (1 + u.cannonSpeedPerLevel * upgrades.cannonSpeed),
    powerDurationMult: 1 + u.powerDurationPerLevel * upgrades.powerDuration,
  };
}

export function createWorld(opts: WorldOptions): World {
  const upgrades = opts.upgrades ?? { fireRate: 0, cannonSpeed: 0, powerDuration: 0 };
  const blasts: Blast[] = [];
  for (let i = 0; i < 64; i++) blasts.push({ x: 0, y: 0, depth: 0 });
  const world: World = {
    seed: opts.seed,
    t: 0,
    tick: 0,
    rng: createRng(opts.seed),
    stats: statsFor(upgrades),
    manualFire: opts.manualFire ?? false,
    cannon: createCannon(cannonDef(opts.cannon ?? 'classic')),
    bullets: new Pool(CONFIG.pools.bullets, makeBullet),
    stones: new Pool(CONFIG.pools.stones, makeStone),
    pickups: new Pool(CONFIG.pools.pickups, makePickup),
    blasts: { items: blasts, count: 0 },
    director: createDirector(opts.fixedD ?? null),
    score: createScoreState(),
    power: createPowerState(),
    lives: CONFIG.lives,
    invulnerable: 0,
    coins: 0,
    bigKills: 0,
    gameOver: false,
    nextStoneId: 0,
    nextPickupId: 0,
    events: new EventQueue(CONFIG.pools.events),
  };
  updateCurve(world.director, 0);
  return world;
}

function savePrevious(world: World): void {
  world.cannon.px = world.cannon.x;
  const b = world.bullets.items;
  for (let i = 0; i < b.length; i++) {
    b[i].px = b[i].x;
    b[i].py = b[i].y;
  }
  const s = world.stones.items;
  for (let i = 0; i < s.length; i++) {
    s[i].px = s[i].x;
    s[i].py = s[i].y;
  }
  const p = world.pickups.items;
  for (let i = 0; i < p.length; i++) {
    p[i].px = p[i].x;
    p[i].py = p[i].y;
  }
}

function bulletsVsStones(world: World): void {
  const bullets = world.bullets.items;
  const stones = world.stones.items;
  const br = CONFIG.cannon.bulletRadius;
  for (let i = 0; i < bullets.length; i++) {
    const b = bullets[i];
    if (!b.active) continue;
    for (let j = 0; j < stones.length; j++) {
      const s = stones[j];
      if (!s.active || j === b.lastHit) continue;
      if (!circlesOverlap(b.x, b.y, br, s.x, s.y, s.radius)) continue;
      damageStone(world, s, CONFIG.cannon.bulletDamage, 0);
      if (b.pierce > 0) {
        b.pierce--;
        b.lastHit = j;
      } else {
        b.active = false;
      }
      break;
    }
  }
}

function stonesVsGround(world: World): void {
  const stones = world.stones.items;
  for (let i = 0; i < stones.length; i++) {
    const s = stones[i];
    if (!s.active || !touchesGround(s.y, s.radius, CONFIG.groundY)) continue;
    s.active = false;
    const e = world.events.push('groundHit', s.x, CONFIG.groundY);
    e.tier = s.tier;
    e.stoneType = s.type;
    if (world.invulnerable > 0) continue;
    if (world.power.shield) {
      world.power.shield = false;
      world.invulnerable = CONFIG.invulnerabilitySec;
      world.events.push('shieldUsed', s.x, CONFIG.groundY);
      continue;
    }
    loseLife(world, s.x);
  }
}

function loseLife(world: World, x: number): void {
  world.lives--;
  world.invulnerable = CONFIG.invulnerabilitySec;
  world.director.lastLifeLostT = world.t;
  resetCombo(world);
  loseLevel(world);
  const e = world.events.push('lifeLost', x, CONFIG.groundY);
  e.value = world.lives;
  if (world.lives <= 0) {
    world.gameOver = true;
    world.events.push('gameOver', x, CONFIG.groundY);
  }
}

export function step(world: World, input: Input, dt: number): void {
  world.events.clear();
  if (world.gameOver) return;
  savePrevious(world);

  world.t += dt;
  world.tick++;
  if (world.invulnerable > 0) world.invulnerable = Math.max(0, world.invulnerable - dt);
  tickPowerUps(world, dt);

  updateCannon(world, input, dt); // 1. move, fire
  updateBullets(world, dt); // 2.
  updateStones(world, dt); // 3.
  updatePickups(world, dt); // 4. fall, magnet, pickup
  bulletsVsStones(world); // 5-6. collisions, damage, split, score, drops
  resolveBlasts(world);
  stonesVsGround(world);
  if (!world.gameOver) updateDirector(world, dt); // 7.
}

/** FNV-1a hash of the gameplay state; equal seeds + equal inputs must give equal hashes. */
export function hashWorld(world: World): string {
  let h = 0x811c9dc5;
  const mix = (n: number): void => {
    const v = Math.round(n * 1000) | 0;
    h ^= v & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 8) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 16) & 0xff;
    h = Math.imul(h, 0x01000193);
    h ^= (v >>> 24) & 0xff;
    h = Math.imul(h, 0x01000193);
  };
  mix(world.tick);
  mix(world.score.score);
  mix(world.lives);
  mix(world.coins);
  mix(world.cannon.x);
  mix(world.rng.state);
  for (const s of world.stones.items)
    if (s.active) [s.x, s.y, s.vx, s.vy, s.hp, s.armor, s.tier].forEach(mix);
  for (const b of world.bullets.items) if (b.active) [b.x, b.y].forEach(mix);
  for (const p of world.pickups.items) if (p.active) [p.x, p.y].forEach(mix);
  return (h >>> 0).toString(16);
}
