// Juice: particles, screen shake, hit-stop, slow motion, floating text.
// Flashes stay under 3 per second (photosensitivity), and shake follows the settings slider.

import Phaser from 'phaser';
import { CONFIG } from '../config/gameConfig';
import { app } from './app';
import { FONT, UI, stoneColors } from './palette';
import { BIG, type StoneType } from '../config/gameConfig';

interface FloatText {
  text: Phaser.GameObjects.Text;
  life: number;
  vy: number;
}

const FLOAT_POOL = 24;
const FLOAT_LIFE = 0.8;

export class Effects {
  private chips: Phaser.GameObjects.Particles.ParticleEmitter;
  private dust: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private floats: FloatText[] = [];
  private lastFlash = -1;
  /** Real seconds of frozen simulation remaining (hit-stop). */
  hitStop = 0;
  /** Real seconds of slow motion remaining. */
  slowMo = 0;

  constructor(private scene: Phaser.Scene) {
    // Budget: at most 150 particles alive in total, half that on low-end devices.
    const lowEnd = (navigator.hardwareConcurrency ?? 8) <= 4;
    const k = lowEnd ? 0.5 : 1;
    this.chips = scene.add.particles(0, 0, 'chip', {
      lifespan: { min: 350, max: 700 },
      speed: { min: 120, max: 420 },
      angle: { min: 200, max: 340 },
      gravityY: 1400,
      rotate: { min: 0, max: 360 },
      scale: { start: 1.3, end: 0.4 },
      emitting: false,
      maxAliveParticles: Math.round(90 * k),
    });
    this.dust = scene.add.particles(0, 0, 'dust', {
      lifespan: { min: 300, max: 550 },
      speed: { min: 40, max: 160 },
      scale: { start: 1.4, end: 0 },
      alpha: { start: 0.6, end: 0 },
      emitting: false,
      maxAliveParticles: Math.round(40 * k),
    });
    this.sparks = scene.add.particles(0, 0, 'spark', {
      lifespan: { min: 250, max: 500 },
      speed: { min: 150, max: 380 },
      scale: { start: 1.5, end: 0 },
      emitting: false,
      maxAliveParticles: Math.round(20 * k),
    });
    this.chips.setDepth(15);
    this.dust.setDepth(14);
    this.sparks.setDepth(16);

    for (let i = 0; i < FLOAT_POOL; i++) {
      const text = scene.add
        .text(0, 0, '', {
          fontFamily: FONT,
          fontSize: '30px',
          fontStyle: 'bold',
          color: '#ffffff',
          stroke: UI.inkCss,
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setDepth(40)
        .setVisible(false);
      this.floats.push({ text, life: 0, vy: 0 });
    }
  }

  hitChips(x: number, y: number, tier: number, type: StoneType): void {
    this.chips.particleTint = stoneColors(type, tier, app.settings.colorblind).light;
    this.chips.explode(4, x, y);
  }

  splitBurst(x: number, y: number, tier: number, type: StoneType): void {
    const c = stoneColors(type, tier, app.settings.colorblind);
    this.chips.particleTint = c.base;
    // Bigger stones break with more debris and a heavier shake.
    const weight = Math.max(0, BIG - tier + 1); // Big = 1 .. Titan Rock = 4; medium/small = 0
    this.chips.explode(weight > 0 ? 10 + weight * 4 : 9, x, y);
    this.dust.particleTint = c.light;
    this.dust.explode(weight > 0 ? 8 + weight * 3 : 6, x, y);
    if (weight > 0) {
      this.shake(0.006 + weight * 0.002, 120 + weight * 30);
      this.hitStop = Math.max(this.hitStop, 0.03 + weight * 0.01);
    }
  }

  popBurst(x: number, y: number, type: StoneType): void {
    const c = stoneColors(type, 2, app.settings.colorblind);
    this.dust.particleTint = c.light;
    this.dust.explode(5, x, y);
    this.chips.particleTint = c.base;
    this.chips.explode(5, x, y);
  }

  armorBreak(x: number, y: number): void {
    this.sparks.particleTint = 0x9cc7ff;
    this.sparks.explode(10, x, y);
  }

  bomb(x: number, y: number, depth: number): void {
    this.sparks.particleTint = 0xffb36b;
    this.sparks.explode(16, x, y);
    this.dust.particleTint = 0xffd9a8;
    this.dust.explode(12, x, y);
    this.shake(0.012, 220);
    const ring = this.scene.add
      .circle(x, y, 20, 0xffb36b, 0.0)
      .setStrokeStyle(10, 0xffb36b, 0.9)
      .setDepth(30);
    this.scene.tweens.add({
      targets: ring,
      radius: CONFIG.stone.bombRadius,
      alpha: 0,
      duration: 320,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    });
    // Short slow motion on chain reactions.
    if (depth >= 2) this.slowMo = Math.max(this.slowMo, 0.5);
  }

  sparkle(x: number, y: number, color: number): void {
    this.sparks.particleTint = color;
    this.sparks.explode(8, x, y);
  }

  groundHit(x: number): void {
    this.dust.particleTint = 0xcfc4ff;
    this.dust.explode(8, x, CONFIG.groundY);
  }

  lifeLost(x: number): void {
    this.shake(0.01, 200);
    const now = this.scene.time.now;
    // Never more than one flash per 400 ms (< 3 flashes per second).
    if (now - this.lastFlash > 400) {
      this.lastFlash = now;
      const bar = this.scene.add.rectangle(x, CONFIG.groundY + 6, 260, 16, UI.danger, 0.9).setDepth(30);
      this.scene.tweens.add({
        targets: bar,
        alpha: 0,
        scaleX: 1.6,
        duration: 450,
        onComplete: () => bar.destroy(),
      });
    }
  }

  floatText(x: number, y: number, text: string, color = '#ffffff', size = 30): void {
    let slot = this.floats.find((f) => f.life <= 0);
    if (!slot) slot = this.floats.reduce((a, b) => (a.life < b.life ? a : b));
    slot.life = FLOAT_LIFE;
    slot.vy = -90;
    slot.text
      .setText(text)
      .setColor(color)
      .setFontSize(size)
      .setPosition(x, y)
      .setAlpha(1)
      .setScale(0.6)
      .setVisible(true);
  }

  shake(intensity: number, durationMs: number): void {
    const s = app.settings.shake;
    if (s <= 0) return;
    this.scene.cameras.main.shake(durationMs, intensity * s);
  }

  update(realDt: number): void {
    if (this.hitStop > 0) this.hitStop = Math.max(0, this.hitStop - realDt);
    if (this.slowMo > 0) this.slowMo = Math.max(0, this.slowMo - realDt);
    for (const f of this.floats) {
      if (f.life <= 0) continue;
      f.life -= realDt;
      f.text.y += f.vy * realDt;
      const t = 1 - f.life / FLOAT_LIFE;
      f.text.setScale(Math.min(1, 0.6 + t * 4));
      f.text.setAlpha(f.life < 0.3 ? f.life / 0.3 : 1);
      if (f.life <= 0) f.text.setVisible(false);
    }
  }

  /** Sim time multiplier for slow motion. */
  get timeScale(): number {
    return this.slowMo > 0 ? 0.35 : 1;
  }
}
