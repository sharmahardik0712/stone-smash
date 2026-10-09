// Generates every texture at boot with Phaser Graphics: no image downloads, tiny bundle.

import Phaser from 'phaser';
import {
  CANNONS,
  CONFIG,
  POWER_UP_KINDS,
  STONE_TYPES,
  TIER_COUNT,
  type CannonId,
  type PowerUpKind,
  type StoneType,
} from '../../config/gameConfig';
import { armorColor, bombGlow, CANNON_COLORS, LEVEL_COLORS, POWER_COLORS, stoneColors, UI } from '../palette';

export function stoneKey(type: StoneType, tier: number, colorblind: boolean): string {
  return `stone-${type}-${tier}-${colorblind ? 1 : 0}`;
}

export function bulletKey(level: number): string {
  return `bullet-${level}`;
}

export function cannonBaseKey(id: CannonId): string {
  return `cannon-base-${id}`;
}

export function cannonBarrelKey(id: CannonId): string {
  return `cannon-barrel-${id}`;
}

export const BARREL_W = 72;

/** Draws one cannon's base and barrel textures. Each cannon on the ladder looks bigger and bolder. */
function drawCannon(g: Phaser.GameObjects.Graphics, id: CannonId, barrels: number): void {
  const c = CANNON_COLORS[id];
  const rank = CANNONS.findIndex((d) => d.id === id);

  // Base.
  g.clear();
  g.fillStyle(0x000000, 0.2);
  g.fillEllipse(55, 70, 104, 18);
  if (id === 'storm' || id === 'titan') {
    // Side fins.
    g.fillStyle(c.trim, 1);
    g.fillTriangle(2, 62, 20, 34, 24, 62);
    g.fillTriangle(108, 62, 90, 34, 86, 62);
  }
  g.fillStyle(c.body, 1);
  g.fillRoundedRect(8, 28, 94, 40, 18);
  g.fillStyle(c.light, 1);
  g.fillRoundedRect(12, 28, 86, 30, 15);
  g.fillStyle(0xffffff, 0.25);
  g.fillRoundedRect(20, 32, 50, 8, 4);
  g.fillStyle(c.trim, 1);
  g.fillCircle(55, 34, 22 + rank);
  g.fillStyle(0xffffff, 0.45);
  g.fillCircle(49, 28, 7);
  // Rank pips on the base: one per step up the ladder.
  g.fillStyle(c.trim, 1);
  for (let i = 0; i < rank; i++) g.fillCircle(55 - (rank - 1) * 8 + i * 16, 62, 4);
  g.generateTexture(cannonBaseKey(id), 110, 76);
  g.clear();

  // Barrel(s), origin at bottom centre when used.
  const xs =
    barrels === 2
      ? [BARREL_W / 2 - CONFIG.cannon.barrelGap, BARREL_W / 2 + CONFIG.cannon.barrelGap]
      : [BARREL_W / 2];
  const w = barrels === 2 ? 22 : 28 + rank * 2;
  for (const x of xs) {
    g.fillStyle(c.body, 1);
    g.fillRoundedRect(x - w / 2, 0, w, 64, 9);
    g.fillStyle(c.light, 1);
    g.fillRoundedRect(x - w / 2 + 4, 4, w - 8, 56, 7);
    g.fillStyle(0xffffff, 0.35);
    g.fillRect(x - w / 2 + 6, 8, 4, 40);
    // Muzzle: wider on stronger cannons.
    g.fillStyle(c.trim, 1);
    g.fillRoundedRect(x - w / 2 - 2 - (rank > 0 ? 2 : 0), 0, w + 4 + (rank > 0 ? 4 : 0), 12, 5);
    if (id === 'titan') g.fillRect(x - w / 2, 30, w, 6);
  }
  g.generateTexture(cannonBarrelKey(id), BARREL_W, 64);
}

export function powerKey(kind: PowerUpKind): string {
  return `power-${kind}`;
}

/** Tiny deterministic hash-noise so every launch draws the same rocks. */
function noise(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function lumpyPoints(cx: number, cy: number, r: number, salt: number, wobble = 0.08): Phaser.Math.Vector2[] {
  const n = 12;
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const rr = r * (1 - wobble + noise(i, salt) * wobble * 2);
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
  }
  return pts;
}

function drawStone(scene: Phaser.Scene, type: StoneType, tier: number, cb: boolean): void {
  const r = CONFIG.stone.radii[tier];
  const pad = 6;
  const size = (r + pad) * 2;
  const c = r + pad;
  const col = stoneColors(type, tier, cb);
  const g = scene.make.graphics({}, false);
  const salt = tier * 7 + STONE_TYPES.indexOf(type) * 3;

  // Soft drop shadow.
  g.fillStyle(0x000000, 0.18);
  g.fillPoints(lumpyPoints(c + 3, c + 5, r, salt), true);
  // Shaded body, then the lit face offset up-left.
  g.fillStyle(col.shade, 1);
  g.fillPoints(lumpyPoints(c, c, r, salt), true);
  g.fillStyle(col.base, 1);
  g.fillPoints(lumpyPoints(c - r * 0.08, c - r * 0.1, r * 0.86, salt), true);
  // Highlight.
  g.fillStyle(col.light, 0.9);
  g.fillEllipse(c - r * 0.35, c - r * 0.42, r * 0.5, r * 0.28);
  // Speckles.
  g.fillStyle(col.shade, 0.6);
  for (let i = 0; i < 3 + Math.round(r / 20); i++) {
    const a = noise(i, salt + 11) * Math.PI * 2;
    const d = r * (0.25 + noise(i, salt + 5) * 0.45);
    g.fillCircle(c + Math.cos(a) * d, c + Math.sin(a) * d, Math.max(1.5, r * 0.06));
  }

  if (type === 'bouncy') {
    // Spring stripes: readable without colour.
    g.lineStyle(Math.max(2, r * 0.09), 0xffffff, 0.75);
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.arc(c, c + k * r * 0.32, r * 0.7, Math.PI * 0.15, Math.PI * 0.85, false);
      g.strokePath();
    }
  } else if (type === 'golden') {
    g.fillStyle(0xffffff, 0.95);
    const star = (x: number, y: number, s: number) => {
      g.fillTriangle(x - s, y, x + s, y, x, y - s * 2.2);
      g.fillTriangle(x - s, y, x + s, y, x, y + s * 2.2);
      g.fillTriangle(x, y - s, x, y + s, x - s * 2.2, y);
      g.fillTriangle(x, y - s, x, y + s, x + s * 2.2, y);
    };
    star(c + r * 0.42, c - r * 0.38, r * 0.09);
    star(c - r * 0.45, c + r * 0.4, r * 0.06);
  } else if (type === 'bomb') {
    g.fillStyle(bombGlow(cb), 0.9);
    g.fillCircle(c, c + r * 0.1, r * 0.42);
    g.fillStyle(0xffe08a, 0.9);
    g.fillCircle(c, c + r * 0.1, r * 0.2);
    // Fuse.
    g.lineStyle(Math.max(2, r * 0.1), 0x2e2938, 1);
    g.beginPath();
    g.moveTo(c + r * 0.3, c - r * 0.75);
    g.lineTo(c + r * 0.55, c - r * 1.0);
    g.strokePath();
  }

  g.generateTexture(stoneKey(type, tier, cb), size, size);
  g.destroy();
}

function drawRing(scene: Phaser.Scene, key: string, r: number, color: number, width: number): void {
  const size = (r + width) * 2 + 4;
  const g = scene.make.graphics({}, false);
  g.lineStyle(width, color, 1);
  g.strokeCircle(size / 2, size / 2, r);
  g.lineStyle(width * 0.35, 0xffffff, 0.55);
  g.beginPath();
  g.arc(size / 2, size / 2, r, Math.PI * 1.1, Math.PI * 1.5, false);
  g.strokePath();
  g.generateTexture(key, size, size);
  g.destroy();
}

function drawPowerIcon(g: Phaser.GameObjects.Graphics, kind: PowerUpKind, c: number, s: number): void {
  g.fillStyle(0xffffff, 1);
  g.lineStyle(s * 0.16, 0xffffff, 1);
  switch (kind) {
    case 'spread':
      for (const a of [-0.45, 0, 0.45]) {
        g.beginPath();
        g.moveTo(c, c + s * 0.6);
        g.lineTo(c + Math.sin(a) * s, c + s * 0.6 - Math.cos(a) * s * 1.2);
        g.strokePath();
      }
      break;
    case 'rapid':
      g.fillTriangle(c - s * 0.7, c - s * 0.6, c - s * 0.7, c + s * 0.6, c, c);
      g.fillTriangle(c, c - s * 0.6, c, c + s * 0.6, c + s * 0.7, c);
      break;
    case 'pierce':
      g.fillTriangle(c, c - s * 0.85, c - s * 0.45, c - s * 0.1, c + s * 0.45, c - s * 0.1);
      g.fillRect(c - s * 0.14, c - s * 0.15, s * 0.28, s * 0.95);
      break;
    case 'shield':
      g.fillPoints(
        [
          new Phaser.Math.Vector2(c - s * 0.6, c - s * 0.6),
          new Phaser.Math.Vector2(c + s * 0.6, c - s * 0.6),
          new Phaser.Math.Vector2(c + s * 0.55, c + s * 0.1),
          new Phaser.Math.Vector2(c, c + s * 0.75),
          new Phaser.Math.Vector2(c - s * 0.55, c + s * 0.1),
        ],
        true,
      );
      break;
    case 'freeze':
      for (let k = 0; k < 3; k++) {
        const a = (k / 3) * Math.PI;
        g.beginPath();
        g.moveTo(c - Math.cos(a) * s * 0.8, c - Math.sin(a) * s * 0.8);
        g.lineTo(c + Math.cos(a) * s * 0.8, c + Math.sin(a) * s * 0.8);
        g.strokePath();
      }
      break;
    case 'magnet':
      g.lineStyle(s * 0.3, 0xffffff, 1);
      g.beginPath();
      g.arc(c, c, s * 0.5, Math.PI, 0, true);
      g.strokePath();
      g.fillRect(c - s * 0.65, c - s * 0.55, s * 0.3, s * 0.55);
      g.fillRect(c + s * 0.35, c - s * 0.55, s * 0.3, s * 0.55);
      break;
  }
}

export function generateTextures(scene: Phaser.Scene): void {
  for (const cb of [false, true]) {
    for (const type of STONE_TYPES) {
      for (let tier = 0; tier < TIER_COUNT; tier++) drawStone(scene, type, tier, cb);
    }
  }
  for (let tier = 0; tier < TIER_COUNT; tier++) {
    const r = CONFIG.stone.radii[tier];
    drawRing(scene, `armor-${tier}-0`, r + 4, armorColor(false), Math.max(5, r * 0.18));
    drawRing(scene, `armor-${tier}-1`, r + 4, armorColor(true), Math.max(5, r * 0.18));
  }

  const g = scene.make.graphics({}, false);
  // Bullets: one glowing capsule per in-run level (colour shows the cannon's power).
  LEVEL_COLORS.forEach((color, i) => {
    g.fillStyle(color, 0.35);
    g.fillCircle(10, 14, 10);
    g.fillStyle(color, 1);
    g.fillRoundedRect(5, 2, 10, 24, 5);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(7, 4, 6, 12, 3);
    g.generateTexture(bulletKey(i + 1), 20, 28);
    g.clear();
  });

  // Soft glow behind a levelled-up cannon.
  for (let k = 8; k >= 1; k--) {
    g.fillStyle(0xffffff, 0.06);
    g.fillCircle(80, 80, k * 10);
  }
  g.generateTexture('glow', 160, 160);
  g.clear();

  for (const def of CANNONS) drawCannon(g, def.id, def.barrels);
  g.clear();

  // Shield bubble.
  g.lineStyle(5, 0x3d8bff, 0.9);
  g.strokeCircle(70, 70, 64);
  g.fillStyle(0x3d8bff, 0.15);
  g.fillCircle(70, 70, 64);
  g.generateTexture('shield-bubble', 140, 140);
  g.clear();

  // Coin.
  const cr = CONFIG.coin.radius;
  g.fillStyle(0xc98f12, 1);
  g.fillCircle(cr + 2, cr + 2, cr);
  g.fillStyle(UI.coin, 1);
  g.fillCircle(cr + 2, cr + 1, cr - 2);
  g.fillStyle(0xffffff, 0.8);
  g.fillRect(cr - 1, cr - 6, 4, 13);
  g.generateTexture('coin', cr * 2 + 4, cr * 2 + 4);
  g.clear();

  // Power-up capsules.
  for (const kind of POWER_UP_KINDS) {
    const r = CONFIG.powerUps.radius;
    const s = (r + 4) * 2;
    g.fillStyle(0x000000, 0.2);
    g.fillCircle(s / 2 + 2, s / 2 + 3, r);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(s / 2, s / 2, r);
    g.fillStyle(POWER_COLORS[kind], 1);
    g.fillCircle(s / 2, s / 2, r - 4);
    drawPowerIcon(g, kind, s / 2, r * 0.55);
    g.generateTexture(powerKey(kind), s, s);
    g.clear();
  }

  // Particles.
  g.fillStyle(0xffffff, 1);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(0, 3),
      new Phaser.Math.Vector2(7, 0),
      new Phaser.Math.Vector2(10, 6),
      new Phaser.Math.Vector2(3, 10),
    ],
    true,
  );
  g.generateTexture('chip', 10, 10);
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(8, 8, 8);
  g.generateTexture('dust', 16, 16);
  g.clear();
  g.fillStyle(0xffffff, 1);
  g.fillCircle(3, 3, 3);
  g.generateTexture('spark', 6, 6);
  g.clear();

  // Heart.
  g.fillStyle(UI.heart, 1);
  g.fillCircle(12, 12, 10);
  g.fillCircle(28, 12, 10);
  g.fillTriangle(3, 16, 37, 16, 20, 36);
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(9, 9, 3.5);
  g.generateTexture('heart', 40, 38);
  g.clear();
  g.fillStyle(0xffffff, 0.25);
  g.fillCircle(12, 12, 10);
  g.fillCircle(28, 12, 10);
  g.fillTriangle(3, 16, 37, 16, 20, 36);
  g.generateTexture('heart-empty', 40, 38);
  g.destroy();
}
