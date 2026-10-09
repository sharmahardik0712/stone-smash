import { CONFIG } from '../config/gameConfig';
import { currentBulletSpeed } from './cannon';
import type { World } from './world';

export interface Bullet {
  active: boolean;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  /** Extra stones this bullet may still pass through. */
  pierce: number;
  /** Stone slot hit last, so a piercing bullet never hits the same stone twice. */
  lastHit: number;
  /** Cannon level when fired (render colour only). */
  level: number;
}

export function makeBullet(): Bullet {
  return { active: false, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, pierce: 0, lastHit: -1, level: 1 };
}

function spawnBullet(world: World, x: number, angleRad: number, speed: number, pierce: number): void {
  const b = world.bullets.acquire();
  if (!b) return;
  b.x = b.px = x;
  b.y = b.py = CONFIG.cannon.y - CONFIG.cannon.muzzleOffset;
  b.vx = Math.sin(angleRad) * speed;
  b.vy = -Math.cos(angleRad) * speed;
  b.pierce = pierce;
  b.lastHit = -1;
  b.level = world.cannon.level;
}

function fireBarrel(world: World, x: number, speed: number, pierce: number): void {
  if (world.power.timers.spread > 0) {
    const a = (CONFIG.cannon.spreadAngleDeg * Math.PI) / 180;
    spawnBullet(world, x, -a, speed, pierce);
    spawnBullet(world, x, 0, speed, pierce);
    spawnBullet(world, x, a, speed, pierce);
  } else {
    spawnBullet(world, x, 0, speed, pierce);
  }
}

export function fireVolley(world: World): void {
  const c = world.cannon;
  const speed = currentBulletSpeed(world);
  const pierce = c.def.pierce + (world.power.timers.pierce > 0 ? 1 : 0);
  if (c.def.barrels === 2) {
    fireBarrel(world, c.x - CONFIG.cannon.barrelGap, speed, pierce);
    fireBarrel(world, c.x + CONFIG.cannon.barrelGap, speed, pierce);
  } else {
    fireBarrel(world, c.x, speed, pierce);
  }
  const e = world.events.push('shot', c.x, CONFIG.cannon.y - CONFIG.cannon.muzzleOffset);
  e.value = c.level;
}

export function updateBullets(world: World, dt: number): void {
  const items = world.bullets.items;
  const r = CONFIG.cannon.bulletRadius;
  for (let i = 0; i < items.length; i++) {
    const b = items[i];
    if (!b.active) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y < -r || b.x < -r || b.x > CONFIG.width + r) b.active = false;
  }
}
