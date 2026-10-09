import { CONFIG, type CannonDef } from '../config/gameConfig';
import { fireVolley } from './bullets';
import type { Input, World } from './world';

export interface Cannon {
  x: number;
  px: number;
  targetX: number;
  fireTimer: number;
  def: CannonDef;
  /** In-run level, 1..3. */
  level: number;
  /** Stones smashed toward the next level (reduced when a level is lost). */
  xp: number;
}

export function createCannon(def: CannonDef): Cannon {
  const x = CONFIG.width / 2;
  return { x, px: x, targetX: x, fireTimer: 0.4, def, level: 1, xp: 0 };
}

/** Swaps the cannon type mid-run (keeps position, in-run level and progress). */
export function switchCannon(world: World, def: CannonDef): void {
  world.cannon.def = def;
}

export function clampCannonX(x: number): number {
  const m = CONFIG.cannon.halfWidth;
  return x < m ? m : x > CONFIG.width - m ? CONFIG.width - m : x;
}

export const MAX_RUN_LEVEL = CONFIG.runLevels.thresholds.length;

export function currentFireInterval(world: World): number {
  const c = world.cannon;
  const base = world.stats.fireInterval * c.def.fireInterval * CONFIG.runLevels.fireInterval[c.level - 1];
  return world.power.timers.rapid > 0 ? base * CONFIG.powerUps.rapidFactor : base;
}

export function currentBulletSpeed(world: World): number {
  const c = world.cannon;
  return CONFIG.cannon.bulletSpeed * c.def.bulletSpeed * CONFIG.runLevels.bulletSpeed[c.level - 1];
}

/** 0..1 progress toward the next level (1 at max level). */
export function levelProgress(c: Cannon): number {
  if (c.level >= MAX_RUN_LEVEL) return 1;
  const t = CONFIG.runLevels.thresholds;
  return (c.xp - t[c.level - 1]) / (t[c.level] - t[c.level - 1]);
}

/** Called for every stone smashed. */
export function gainXp(world: World): void {
  const c = world.cannon;
  c.xp++;
  const t = CONFIG.runLevels.thresholds;
  if (c.level < MAX_RUN_LEVEL && c.xp >= t[c.level]) {
    c.level++;
    const e = world.events.push('levelUp', c.x, CONFIG.cannon.y);
    e.value = c.level;
  }
}

/** Called when a life is lost: drop one level and restart that level's progress. */
export function loseLevel(world: World): void {
  const c = world.cannon;
  if (c.level > 1) {
    c.level--;
    const e = world.events.push('levelDown', c.x, CONFIG.cannon.y);
    e.value = c.level;
  }
  c.xp = CONFIG.runLevels.thresholds[c.level - 1];
}

export function updateCannon(world: World, input: Input, dt: number): void {
  const c = world.cannon;
  c.targetX = clampCannonX(input.targetX);
  const maxMove = world.stats.maxSpeed * dt;
  let dx = c.targetX - c.x;
  if (dx > maxMove) dx = maxMove;
  else if (dx < -maxMove) dx = -maxMove;
  c.x += dx;

  const wantFire = world.manualFire ? input.fire : true;
  if (c.fireTimer > 0) c.fireTimer -= dt;
  if (c.fireTimer <= 0) {
    if (wantFire) {
      fireVolley(world);
      c.fireTimer += currentFireInterval(world);
    } else {
      c.fireTimer = 0;
    }
  }
}
