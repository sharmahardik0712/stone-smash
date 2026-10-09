// HUD: score, combo meter, hearts, power-up timer rings, time, pause button.

import Phaser from 'phaser';
import { CONFIG, POWER_UP_KINDS, type PowerUpKind } from '../config/gameConfig';
import { comboMultiplier, timeMultiplier } from '../sim/scoring';
import type { World } from '../sim/world';
import { LAYOUT } from './layout';
import { FONT, POWER_COLORS, UI } from './palette';
import { powerKey } from './render/textures';
import { formatTime } from './ui';

const DEPTH = 50;

function hudText(scene: Phaser.Scene, x: number, y: number, size: number): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, '', {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: UI.inkCss,
      strokeThickness: Math.max(4, size / 6),
    })
    .setDepth(DEPTH)
    .setScrollFactor(0);
}

export class Hud {
  private score: Phaser.GameObjects.Text;
  private time: Phaser.GameObjects.Text;
  private mult: Phaser.GameObjects.Text;
  private combo: Phaser.GameObjects.Text;
  private comboBar: Phaser.GameObjects.Graphics;
  private hearts: Phaser.GameObjects.Image[] = [];
  private rings: Phaser.GameObjects.Graphics;
  private icons: Partial<Record<PowerUpKind, Phaser.GameObjects.Image>> = {};
  private debug: Phaser.GameObjects.Text | null = null;
  private shownScore = -1;
  private shownCombo = -1;
  private lastLives: number = CONFIG.lives;

  constructor(
    private scene: Phaser.Scene,
    onPause: () => void,
    debug: boolean,
  ) {
    if (LAYOUT.top > 0) {
      // Tall screens: the HUD gets its own band, and stones slide out from under it.
      const band = scene.add
        .graphics()
        .setDepth(DEPTH - 1)
        .setScrollFactor(0);
      band.fillGradientStyle(0x234a8f, 0x234a8f, UI.skyTop, UI.skyTop, 1);
      band.fillRect(0, 0, CONFIG.width, LAYOUT.top);
      band.fillStyle(0xffffff, 0.25);
      band.fillRect(0, LAYOUT.top - 3, CONFIG.width, 3);
    }
    this.score = hudText(scene, 28, 22, 52);
    this.mult = hudText(scene, 30, 86, 22).setColor('#ffe08a');
    this.time = hudText(scene, CONFIG.width / 2, 34, 34).setOrigin(0.5, 0);
    this.combo = hudText(scene, CONFIG.width / 2, 92, 40)
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.comboBar = scene.add.graphics().setDepth(DEPTH).setScrollFactor(0);
    for (let i = 0; i < CONFIG.lives; i++) {
      this.hearts.push(
        scene.add
          .image(CONFIG.width - 140 - i * 46, 56, 'heart')
          .setDepth(DEPTH)
          .setScrollFactor(0),
      );
    }
    this.rings = scene.add.graphics().setDepth(DEPTH).setScrollFactor(0);
    for (const k of POWER_UP_KINDS) {
      this.icons[k] = scene.add
        .image(0, 0, powerKey(k))
        .setScale(0.85)
        .setDepth(DEPTH + 1)
        .setScrollFactor(0)
        .setVisible(false);
    }

    // Pause button: 88x88 touch target.
    const pause = scene.add
      .container(CONFIG.width - 60, 58)
      .setDepth(DEPTH + 2)
      .setScrollFactor(0);
    const bg = scene.add.circle(0, 0, 38, UI.panel, 0.55);
    const bars = scene.add.graphics();
    bars.fillStyle(0xffffff, 1);
    bars.fillRoundedRect(-13, -15, 9, 30, 3);
    bars.fillRoundedRect(4, -15, 9, 30, 3);
    pause.add([bg, bars]);
    pause.setSize(88, 88).setInteractive({ useHandCursor: true });
    pause.on('pointerup', onPause);

    if (debug) this.debug = hudText(scene, 20, LAYOUT.height - 40, 20).setColor('#c8ffc8');
  }

  update(world: World): void {
    const s = world.score;
    if (s.score !== this.shownScore) {
      this.shownScore = s.score;
      this.score.setText(s.score.toLocaleString('en-US'));
    }
    const tm = timeMultiplier(world.t);
    this.mult.setText(tm >= 1.1 ? `time x${tm.toFixed(1)}` : '');
    this.time.setText(formatTime(world.t));

    // Combo meter: multiplier text plus a bar showing the window left to keep it going.
    if (s.combo !== this.shownCombo) {
      if (s.combo > this.shownCombo && s.combo > 0) {
        this.scene.tweens.add({ targets: this.combo, scale: { from: 1.35, to: 1 }, duration: 160 });
      }
      this.shownCombo = s.combo;
      this.combo.setText(`x${comboMultiplier(s.combo).toFixed(1)}`).setVisible(s.combo > 0);
    }
    this.comboBar.clear();
    if (s.combo > 0) {
      const left = 1 - (world.t - s.lastKillT) / CONFIG.score.comboWindowSec;
      if (left > 0) {
        const w = 150;
        this.comboBar.fillStyle(UI.panel, 0.5);
        this.comboBar.fillRoundedRect(CONFIG.width / 2 - w / 2, 142, w, 10, 5);
        this.comboBar.fillStyle(UI.primary, 1);
        this.comboBar.fillRoundedRect(CONFIG.width / 2 - w / 2, 142, w * left, 10, 5);
      }
    }

    // Hearts.
    if (world.lives !== this.lastLives) {
      for (let i = 0; i < this.hearts.length; i++) {
        this.hearts[i].setTexture(i < world.lives ? 'heart' : 'heart-empty');
      }
      const lost = this.hearts[world.lives];
      if (world.lives < this.lastLives && lost) {
        this.scene.tweens.add({
          targets: lost,
          scale: { from: 1.6, to: 1 },
          duration: 300,
          ease: 'Back.Out',
        });
      }
      this.lastLives = world.lives;
    }

    // Power-up rings, left column under the score.
    this.rings.clear();
    let slot = 0;
    for (const k of POWER_UP_KINDS) {
      const icon = this.icons[k]!;
      const active = k === 'shield' ? world.power.shield : world.power.timers[k] > 0;
      icon.setVisible(active);
      if (!active) continue;
      const x = 52 + slot * 70;
      const y = 160;
      icon.setPosition(x, y);
      const frac = k === 'shield' ? 1 : world.power.timers[k] / (world.power.durations[k] || 1);
      this.rings.lineStyle(6, UI.panel, 0.5);
      this.rings.strokeCircle(x, y, 31);
      this.rings.lineStyle(6, POWER_COLORS[k], 1);
      this.rings.beginPath();
      this.rings.arc(x, y, 31, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
      this.rings.strokePath();
      // Blink in the last second as a warning (2 blinks/s).
      icon.setAlpha(
        k !== 'shield' && world.power.timers[k] < 1 && Math.floor(world.t * 4) % 2 === 0 ? 0.4 : 1,
      );
      slot++;
    }

    if (this.debug) {
      const d = world.director;
      this.debug.setText(
        `d ${d.d.toFixed(2)}${d.fixedD !== null ? ' (fixed)' : ''}  budget ${(d.budget * d.waveFactor).toFixed(2)}/s  ` +
          `fall ${d.fallSpeed.toFixed(0)}  stones ${world.stones.countActive()}  ${d.inPressure ? 'pressure' : 'breather'}`,
      );
    }
  }
}
