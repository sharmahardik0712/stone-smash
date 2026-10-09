import { CONFIG, type StoneType } from '../config/gameConfig';
import { bounceWalls } from './collision';
import { dropFromKill } from './powerups';
import { range, next } from './rng';
import { registerKill } from './scoring';
import type { World } from './world';

export type Tier = 0 | 1 | 2;

export interface Stone {
  active: boolean;
  /** Unique per spawn, so the render layer can tell a reused slot holds a new stone. */
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  tier: Tier;
  radius: number;
  hp: number;
  maxHp: number;
  armor: number;
  type: StoneType;
}

export function makeStone(): Stone {
  return {
    active: false,
    id: 0,
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    tier: 0,
    radius: 0,
    hp: 0,
    maxHp: 0,
    armor: 0,
    type: 'normal',
  };
}

export function stoneHp(tier: Tier, hpScale: number): number {
  return Math.max(1, Math.round(CONFIG.stone.baseHp[tier] * hpScale));
}

/** Total damage needed to clear a stone and every descendant. Big stone at scale 1 = 4 + 2*2 + 4*1 = 12. */
export function treeHp(tier: Tier, hpScale: number): number {
  let total = 0;
  let count = 1;
  for (let t = tier; t <= 2; t++) {
    total += count * stoneHp(t as Tier, hpScale);
    count *= 2;
  }
  return total;
}

/** Budget cost of a stone, including the type modifier. */
export function stoneCost(tier: Tier, type: StoneType, hpScale: number): number {
  const base = treeHp(tier, hpScale);
  switch (type) {
    case 'bouncy':
      return base * CONFIG.typeCost.bouncyMult;
    case 'armored':
      return base + CONFIG.stone.armorHp;
    case 'bomb':
      return base * CONFIG.typeCost.bombMult;
    default:
      return base;
  }
}

export function spawnStone(
  world: World,
  tier: Tier,
  type: StoneType,
  x: number,
  y: number,
  vx: number,
  vy: number,
): Stone | null {
  const s = world.stones.acquire();
  if (!s) return null;
  s.id = ++world.nextStoneId;
  s.x = s.px = x;
  s.y = s.py = y;
  s.vx = vx;
  s.vy = vy;
  s.tier = tier;
  s.radius = CONFIG.stone.radii[tier];
  s.hp = s.maxHp = stoneHp(tier, world.director.hpScale);
  s.armor = type === 'armored' ? CONFIG.stone.armorHp : 0;
  s.type = type;
  return s;
}

/** Initial sideways speed for a newly spawned stone. */
export function spawnVx(world: World, type: StoneType): number {
  if (type === 'bouncy') {
    const sign = next(world.rng) < 0.5 ? -1 : 1;
    return sign * CONFIG.stone.bouncySideSpeed;
  }
  return range(world.rng, -CONFIG.stone.driftSpeed, CONFIG.stone.driftSpeed);
}

export function currentFallSpeed(world: World): number {
  const f = world.director.fallSpeed;
  return world.power.timers.freeze > 0 ? f * CONFIG.powerUps.freezeFactor : f;
}

export function updateStones(world: World, dt: number): void {
  const fall = currentFallSpeed(world);
  const accel = CONFIG.stone.settleAccel;
  const items = world.stones.items;
  for (let i = 0; i < items.length; i++) {
    const s = items[i];
    if (!s.active) continue;
    s.vy = Math.min(s.vy + accel * dt, fall);
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    bounceWalls(s, CONFIG.width);
  }
}

/** Applies damage (armor first). Kills the stone at 0 HP. `chain` > 0 means the damage came from a bomb blast. */
export function damageStone(world: World, s: Stone, dmg: number, chain: number): void {
  if (s.armor > 0) {
    const absorbed = Math.min(s.armor, dmg);
    s.armor -= absorbed;
    dmg -= absorbed;
    if (s.armor === 0) {
      const e = world.events.push('armorBreak', s.x, s.y);
      e.tier = s.tier;
      e.id = s.id;
    }
    if (dmg <= 0) {
      if (s.armor > 0) {
        const e = world.events.push('stoneHit', s.x, s.y);
        e.tier = s.tier;
        e.stoneType = s.type;
        e.value = s.hp;
        e.id = s.id;
      }
      return;
    }
  }
  s.hp -= dmg;
  if (s.hp <= 0) {
    killStone(world, s, chain);
  } else {
    const e = world.events.push('stoneHit', s.x, s.y);
    e.tier = s.tier;
    e.stoneType = s.type;
    e.value = s.hp;
    e.combo = world.score.combo;
    e.id = s.id;
  }
}

export function killStone(world: World, s: Stone, chain: number): void {
  s.active = false;
  s.hp = 0;
  const { x, y, tier, type } = s;

  registerKill(world, tier, type, x, y);
  dropFromKill(world, tier, type, x, y);

  if (type === 'bomb') queueBlast(world, x, y, chain + 1);

  if (tier < 2) {
    const childTier = (tier + 1) as Tier;
    const childType: StoneType = type === 'bouncy' ? 'bouncy' : 'normal';
    const side = type === 'bouncy' ? CONFIG.stone.bouncySideSpeed : CONFIG.stone.splitSideSpeed;
    const off = s.radius * 0.4;
    spawnStone(world, childTier, childType, x - off, y, -side, -CONFIG.stone.splitPopSpeed);
    spawnStone(world, childTier, childType, x + off, y, side, -CONFIG.stone.splitPopSpeed);
    const e = world.events.push('stoneSplit', x, y);
    e.tier = tier;
    e.stoneType = type;
    e.combo = world.score.combo;
  } else {
    const e = world.events.push('stonePop', x, y);
    e.tier = tier;
    e.stoneType = type;
    e.combo = world.score.combo;
  }
}

function queueBlast(world: World, x: number, y: number, depth: number): void {
  const q = world.blasts;
  if (q.count >= q.items.length) return;
  const b = q.items[q.count++];
  b.x = x;
  b.y = y;
  b.depth = depth;
}

/** Resolves queued bomb blasts, including chain reactions. Blasts damage stones, never the cannon. */
export function resolveBlasts(world: World): void {
  const q = world.blasts;
  const r = CONFIG.stone.bombRadius;
  const items = world.stones.items;
  // Blasts queued while resolving are appended and processed in the same loop.
  for (let k = 0; k < q.count; k++) {
    const { x, y, depth } = q.items[k];
    const e = world.events.push('bombBlast', x, y);
    e.value = depth;
    for (let i = 0; i < items.length; i++) {
      const s = items[i];
      if (!s.active) continue;
      const dx = s.x - x;
      const dy = s.y - y;
      const rr = r + s.radius;
      if (dx * dx + dy * dy <= rr * rr) damageStone(world, s, CONFIG.stone.bombDamage, depth);
    }
  }
  q.count = 0;
}
