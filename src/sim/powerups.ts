import { BIG, CONFIG, TIER, POWER_UP_KINDS, type PowerUpKind, type StoneType } from '../config/gameConfig';
import { int, next, range } from './rng';
import type { World } from './world';

export type PickupKind = 'coin' | 'powerUp';

export interface Pickup {
  active: boolean;
  id: number;
  kind: PickupKind;
  powerUp: PowerUpKind;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  radius: number;
  /** Seconds spent resting on the ground. */
  rest: number;
}

export function makePickup(): Pickup {
  return {
    active: false,
    id: 0,
    kind: 'coin',
    powerUp: 'spread',
    x: 0,
    y: 0,
    px: 0,
    py: 0,
    vx: 0,
    vy: 0,
    radius: 0,
    rest: 0,
  };
}

export interface PowerState {
  timers: Record<PowerUpKind, number>;
  /** Full duration of the current activation, for HUD rings. */
  durations: Record<PowerUpKind, number>;
  shield: boolean;
}

export function createPowerState(): PowerState {
  const zero = (): Record<PowerUpKind, number> => ({
    spread: 0,
    rapid: 0,
    pierce: 0,
    shield: 0,
    freeze: 0,
    magnet: 0,
  });
  return { timers: zero(), durations: zero(), shield: false };
}

function spawnPickup(
  world: World,
  kind: PickupKind,
  powerUp: PowerUpKind,
  x: number,
  y: number,
  vx: number,
  vy: number,
): void {
  const p = world.pickups.acquire();
  if (!p) return;
  p.id = ++world.nextPickupId;
  p.kind = kind;
  p.powerUp = powerUp;
  p.x = p.px = x;
  p.y = p.py = y;
  p.vx = vx;
  p.vy = vy;
  p.radius = kind === 'coin' ? CONFIG.coin.radius : CONFIG.powerUps.radius;
  p.rest = 0;
}

/** Coins and power-ups dropped when a stone reaches 0 HP. */
export function dropFromKill(world: World, tier: number, type: StoneType, x: number, y: number): void {
  if (type === 'golden') {
    for (let i = 0; i < CONFIG.coins.perGolden; i++) {
      const a = range(world.rng, -Math.PI * 0.8, -Math.PI * 0.2);
      const sp = range(world.rng, 0.5, 1) * CONFIG.coin.popSpeed;
      spawnPickup(world, 'coin', 'spread', x, y, Math.cos(a) * sp, Math.sin(a) * sp);
    }
    spawnPickup(world, 'powerUp', POWER_UP_KINDS[int(world.rng, POWER_UP_KINDS.length)], x, y, 0, -120);
    return;
  }
  if (tier <= BIG) {
    // Big drops 1 coin; each giant size up drops one more (Boulder 2 .. Titan Rock 4).
    const count = CONFIG.coins.perBig * (BIG - tier + 1);
    for (let i = 0; i < count; i++) {
      spawnPickup(world, 'coin', 'spread', x, y, range(world.rng, -60, 60), -CONFIG.coin.popSpeed);
    }
  }
  if (tier <= TIER.medium && next(world.rng) < CONFIG.powerUps.dropChance) {
    spawnPickup(world, 'powerUp', POWER_UP_KINDS[int(world.rng, POWER_UP_KINDS.length)], x, y, 0, -120);
  }
}

export function activatePowerUp(world: World, kind: PowerUpKind): void {
  if (kind === 'shield') {
    world.power.shield = true;
    return;
  }
  const d = CONFIG.powerUps.durations[kind] * world.stats.powerDurationMult;
  world.power.timers[kind] = d; // picking up an active power-up refreshes it
  world.power.durations[kind] = d;
}

export function tickPowerUps(world: World, dt: number): void {
  const t = world.power.timers;
  for (let i = 0; i < POWER_UP_KINDS.length; i++) {
    const k = POWER_UP_KINDS[i];
    if (t[k] > 0) t[k] = Math.max(0, t[k] - dt);
  }
}

export function updatePickups(world: World, dt: number): void {
  const items = world.pickups.items;
  const groundY = CONFIG.groundY;
  const cx = world.cannon.x;
  const cy = CONFIG.cannon.y;
  const magnet = world.power.timers.magnet > 0;
  for (let i = 0; i < items.length; i++) {
    const p = items[i];
    if (!p.active) continue;
    const fall = p.kind === 'coin' ? CONFIG.coin.fallSpeed : CONFIG.powerUps.fallSpeed;

    if (magnet) {
      const dx = cx - p.x;
      const dy = cy - p.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      p.vx += (dx / len) * CONFIG.powerUps.magnetAccel * dt;
      p.vy += (dy / len) * CONFIG.powerUps.magnetAccel * dt;
      const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      const maxSp = 900;
      if (sp > maxSp) {
        p.vx *= maxSp / sp;
        p.vy *= maxSp / sp;
      }
    } else {
      p.vy = Math.min(p.vy + CONFIG.stone.settleAccel * dt, fall);
      p.vx *= 1 - Math.min(1, 2 * dt);
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.x < p.radius) {
      p.x = p.radius;
      p.vx = Math.abs(p.vx);
    } else if (p.x > CONFIG.width - p.radius) {
      p.x = CONFIG.width - p.radius;
      p.vx = -Math.abs(p.vx);
    }
    if (p.y + p.radius >= groundY) {
      p.y = groundY - p.radius;
      if (p.kind === 'coin') {
        // Coins that land are banked automatically; catching them early (or Magnet) is just faster.
        collect(world, p);
        continue;
      }
      p.vy = 0;
      p.rest += dt;
      if (p.rest >= CONFIG.powerUps.restSec) {
        p.active = false;
        continue;
      }
    }

    // Collect by touching the cannon.
    if (Math.abs(p.x - cx) <= CONFIG.cannon.halfWidth + p.radius && p.y + p.radius >= cy - 44)
      collect(world, p);
  }
}

function collect(world: World, p: Pickup): void {
  p.active = false;
  if (p.kind === 'coin') {
    world.coins += 1;
    world.events.push('coinPicked', p.x, p.y);
  } else {
    activatePowerUp(world, p.powerUp);
    const e = world.events.push('powerUpPicked', p.x, p.y);
    e.powerUp = p.powerUp;
  }
}
