// Mirrors sim pools slot-for-slot with sprites and interpolates between the last two sim states.
// Reads the sim; never writes to it.

import Phaser from 'phaser';
import { CONFIG } from '../../config/gameConfig';
import type { World } from '../../sim/world';
import { app } from '../app';
import { MAX_RUN_LEVEL, levelProgress } from '../../sim/cannon';
import { FONT, LEVEL_COLORS, UI } from '../palette';
import { bulletKey, cannonBarrelKey, cannonBaseKey, powerKey, stoneKey } from './textures';

interface StoneView {
  id: number;
  sprite: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Image;
  text: Phaser.GameObjects.Text;
  hp: number;
  /** 0..1 squash amount after a hit, decays quickly. */
  squash: number;
  flash: number;
  /** Seconds since spawn (pop-in animation). */
  age: number;
  spin: number;
}

interface PickupView {
  id: number;
  sprite: Phaser.GameObjects.Image;
}

const HP_FONT_SIZE = [44, 36, 30];

export class WorldRenderer {
  private stones: StoneView[] = [];
  private bullets: Phaser.GameObjects.Image[] = [];
  private pickups: PickupView[] = [];
  private cannonBase: Phaser.GameObjects.Image;
  private barrel: Phaser.GameObjects.Image;
  private shield: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private levelBar: Phaser.GameObjects.Graphics;
  private levelText: Phaser.GameObjects.Text;
  private recoil = 0;
  private tilt = 0;
  private time = 0;

  constructor(scene: Phaser.Scene, world: World) {
    for (let i = 0; i < world.bullets.items.length; i++) {
      this.bullets.push(scene.add.image(0, 0, bulletKey(1)).setVisible(false).setDepth(5));
    }
    for (let i = 0; i < world.stones.items.length; i++) {
      const sprite = scene.add
        .image(0, 0, stoneKey('normal', 0, false))
        .setVisible(false)
        .setDepth(10);
      const ring = scene.add.image(0, 0, 'armor-0-0').setVisible(false).setDepth(11);
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: FONT,
          fontSize: '32px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: UI.inkCss,
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setVisible(false)
        .setDepth(12);
      this.stones.push({ id: -1, sprite, ring, text, hp: -1, squash: 0, flash: 0, age: 0, spin: 0 });
    }
    for (let i = 0; i < world.pickups.items.length; i++) {
      this.pickups.push({ id: -1, sprite: scene.add.image(0, 0, 'coin').setVisible(false).setDepth(8) });
    }
    const id = world.cannon.def.id;
    this.glow = scene.add.image(world.cannon.x, CONFIG.cannon.y, 'glow').setVisible(false).setDepth(19);
    this.barrel = scene.add
      .image(world.cannon.x, CONFIG.cannon.y + 4, cannonBarrelKey(id))
      .setOrigin(0.5, 0.92)
      .setDepth(20);
    this.cannonBase = scene.add.image(world.cannon.x, CONFIG.cannon.y + 20, cannonBaseKey(id)).setDepth(21);
    this.levelBar = scene.add.graphics().setDepth(23);
    this.levelText = scene.add
      .text(0, 0, '', {
        fontFamily: FONT,
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffffff',
        stroke: UI.inkCss,
        strokeThickness: 5,
      })
      .setOrigin(1, 0.5)
      .setDepth(24);
    this.shield = scene.add
      .image(world.cannon.x, CONFIG.cannon.y, 'shield-bubble')
      .setVisible(false)
      .setDepth(22);
  }

  /** Visual reaction for a stone that was hit (looked up by sim stone id). */
  hitStone(id: number): void {
    for (const v of this.stones) {
      if (v.id === id) {
        v.squash = 1;
        v.flash = 0.06;
        return;
      }
    }
  }

  shot(): void {
    this.recoil = 1;
  }

  draw(world: World, alpha: number, realDt: number): void {
    this.time += realDt;
    const cb = app.settings.colorblind;
    const lerp = (a: number, b: number) => a + (b - a) * alpha;
    const frozen = world.power.timers.freeze > 0;

    // Stones.
    const stones = world.stones.items;
    for (let i = 0; i < stones.length; i++) {
      const s = stones[i];
      const v = this.stones[i];
      if (!s.active) {
        if (v.sprite.visible) {
          v.sprite.setVisible(false);
          v.ring.setVisible(false);
          v.text.setVisible(false);
          v.id = -1;
        }
        continue;
      }
      if (v.id !== s.id) {
        v.id = s.id;
        v.hp = -1;
        v.age = 0;
        v.squash = 0;
        v.flash = 0;
        v.spin = (s.id % 2 ? 1 : -1) * (0.4 + (s.id % 5) * 0.15);
        v.sprite
          .setTexture(stoneKey(s.type, s.tier, cb))
          .setVisible(true)
          .setRotation((s.id * 1.7) % 6.28);
        v.ring.setTexture(`armor-${s.tier}-${cb ? 1 : 0}`);
        v.text.setFontSize(HP_FONT_SIZE[s.tier]).setVisible(true);
      }
      v.age += realDt;
      const x = lerp(s.px, s.x);
      const y = lerp(s.py, s.y);
      const hpShown = s.hp + s.armor;
      if (v.hp !== hpShown) {
        v.hp = hpShown;
        v.text.setText(String(hpShown));
      }
      v.squash = Math.max(0, v.squash - realDt * 8);
      v.flash = Math.max(0, v.flash - realDt);
      const pop = Math.min(1, 0.55 + v.age * 4); // children pop in from 55% size
      const sq = v.squash * 0.14;
      v.sprite
        .setPosition(x, y)
        .setScale(pop * (1 + sq), pop * (1 - sq))
        .setRotation(v.sprite.rotation + v.spin * realDt * (s.vx / 100 + 0.3));
      if (v.flash > 0) v.sprite.setTintFill(0xffffff);
      else if (frozen) v.sprite.setTint(0xbfe9ff);
      else v.sprite.clearTint();
      v.ring
        .setVisible(s.armor > 0)
        .setPosition(x, y)
        .setScale(pop);
      v.text.setPosition(x, y).setScale(pop);
    }

    // Bullets.
    const bullets = world.bullets.items;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      const spr = this.bullets[i];
      if (!b.active) {
        if (spr.visible) spr.setVisible(false);
        continue;
      }
      spr
        .setVisible(true)
        .setPosition(lerp(b.px, b.x), lerp(b.py, b.y))
        .setTexture(bulletKey(b.level))
        .setRotation(Math.atan2(b.vx, -b.vy))
        .setScale(b.pierce > 0 ? 1.25 : 1);
    }

    // Pickups.
    const pickups = world.pickups.items;
    for (let i = 0; i < pickups.length; i++) {
      const p = pickups[i];
      const v = this.pickups[i];
      if (!p.active) {
        if (v.sprite.visible) v.sprite.setVisible(false);
        v.id = -1;
        continue;
      }
      if (v.id !== p.id) {
        v.id = p.id;
        v.sprite.setTexture(p.kind === 'coin' ? 'coin' : powerKey(p.powerUp)).setVisible(true);
      }
      const bob = p.kind === 'powerUp' ? Math.sin(this.time * 6 + p.id) * 0.06 : 0;
      // Fade out over the last second of resting on the ground.
      const fade = p.rest > CONFIG.powerUps.restSec - 1 ? 0.5 + 0.5 * Math.sin(this.time * 20) : 1;
      v.sprite
        .setPosition(lerp(p.px, p.x), lerp(p.py, p.y))
        .setScale(1 + bob, p.kind === 'coin' ? Math.abs(Math.cos(this.time * 5 + p.id)) * 0.8 + 0.2 : 1 + bob)
        .setAlpha(fade);
    }

    // Cannon: recoil and a small tilt in the direction of travel.
    const cx = lerp(world.cannon.px, world.cannon.x);
    const vel = (world.cannon.x - world.cannon.px) / CONFIG.sim.step;
    this.tilt += ((vel / world.stats.maxSpeed) * 0.18 - this.tilt) * Math.min(1, realDt * 12);
    this.recoil = Math.max(0, this.recoil - realDt * 14);
    this.barrel.setPosition(cx, CONFIG.cannon.y + 4 + this.recoil * 10).setRotation(this.tilt);
    this.cannonBase.setPosition(cx, CONFIG.cannon.y + 20).setRotation(this.tilt * 0.3);
    this.shield.setVisible(world.power.shield).setPosition(cx, CONFIG.cannon.y + 4);

    // In-run level: glow behind the cannon and a progress bar under it.
    const level = world.cannon.level;
    const pulse = 1 + Math.sin(this.time * 6) * 0.06;
    this.glow
      .setVisible(level > 1)
      .setPosition(cx, CONFIG.cannon.y + 6)
      .setTint(LEVEL_COLORS[level - 1])
      .setAlpha(level === MAX_RUN_LEVEL ? 0.9 : 0.6)
      .setScale((level === MAX_RUN_LEVEL ? 1.25 : 1) * pulse);
    const barW = 110;
    const barX = cx - barW / 2 + 22;
    const barY = CONFIG.groundY + 34;
    const g = this.levelBar;
    g.clear();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(barX, barY - 7, barW, 14, 7);
    g.fillStyle(LEVEL_COLORS[level - 1], 1);
    g.fillRoundedRect(barX, barY - 7, Math.max(14, barW * levelProgress(world.cannon)), 14, 7);
    this.levelText.setPosition(barX - 8, barY).setText(level === MAX_RUN_LEVEL ? 'MAX' : `Lv${level}`);
    const blink = world.invulnerable > 0 && Math.floor(this.time * 6) % 2 === 0; // 3 blinks/s max
    this.barrel.setAlpha(blink ? 0.45 : 1);
    this.cannonBase.setAlpha(blink ? 0.45 : 1);
  }
}
