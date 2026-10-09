// Small UI kit: big rounded buttons (touch targets well above 44 px), toggles, sky background.

import Phaser from 'phaser';
import { CONFIG } from '../config/gameConfig';
import { app } from './app';
import { FONT, UI } from './palette';

export interface ButtonOptions {
  width?: number;
  height?: number;
  color?: number;
  shade?: number;
  fontSize?: number;
  textColor?: string;
}

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  readonly label: Phaser.GameObjects.Text;
  private opts: Required<ButtonOptions>;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    onClick: () => void,
    o: ButtonOptions = {},
  ) {
    super(scene, x, y);
    this.opts = {
      width: o.width ?? 420,
      height: o.height ?? 104,
      color: o.color ?? UI.secondary,
      shade: o.shade ?? UI.secondaryDark,
      fontSize: o.fontSize ?? 40,
      textColor: o.textColor ?? '#ffffff',
    };
    this.bg = scene.add.graphics();
    this.label = scene.add
      .text(0, -4, text, {
        fontFamily: FONT,
        fontSize: `${this.opts.fontSize}px`,
        fontStyle: 'bold',
        color: this.opts.textColor,
      })
      .setOrigin(0.5);
    this.add([this.bg, this.label]);
    this.draw(false);
    const { width: w, height: h } = this.opts;
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', () => {
      this.draw(true);
      this.label.y = 2;
    });
    this.on('pointerout', () => {
      this.draw(false);
      this.label.y = -4;
    });
    this.on('pointerup', () => {
      this.draw(false);
      this.label.y = -4;
      app.unlockAudio();
      app.audio.click();
      onClick();
    });
    scene.add.existing(this);
  }

  private draw(pressed: boolean): void {
    const { width: w, height: h, color, shade } = this.opts;
    const g = this.bg;
    g.clear();
    g.fillStyle(shade, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + 8, w, h - 8, 28);
    g.fillStyle(color, 1);
    g.fillRoundedRect(-w / 2, -h / 2 + (pressed ? 8 : 0), w, h - 8, 28);
    g.fillStyle(0xffffff, 0.18);
    g.fillRoundedRect(-w / 2 + 14, -h / 2 + (pressed ? 14 : 6), w - 28, 16, 8);
  }

  setText(text: string): this {
    this.label.setText(text);
    return this;
  }
}

export function drawSky(scene: Phaser.Scene): void {
  const g = scene.add.graphics();
  // Extends past the playfield on both sides so tall screens (see layout.ts) are filled.
  g.fillStyle(UI.skyTop, 1);
  g.fillRect(0, -1000, CONFIG.width, 1000);
  g.fillGradientStyle(UI.skyTop, UI.skyTop, UI.skyBottom, UI.skyBottom, 1);
  g.fillRect(0, 0, CONFIG.width, CONFIG.groundY);
  // Soft clouds.
  g.fillStyle(0xffffff, 0.35);
  for (const [x, y, s] of [
    [120, 220, 1],
    [560, 380, 0.8],
    [300, 620, 0.6],
  ]) {
    g.fillEllipse(x, y, 180 * s, 50 * s);
    g.fillEllipse(x + 50 * s, y - 20 * s, 120 * s, 50 * s);
  }
  // Ground.
  g.fillStyle(UI.groundTop, 1);
  g.fillRect(0, CONFIG.groundY, CONFIG.width, 12);
  g.fillStyle(UI.ground, 1);
  g.fillRect(0, CONFIG.groundY + 12, CONFIG.width, 1000);
  g.setDepth(-10);
}

export function title(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 72,
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: UI.inkCss,
      strokeThickness: size / 6,
    })
    .setOrigin(0.5);
}

export function label(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size = 32,
  color = '#ffffff',
): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: FONT,
      fontSize: `${size}px`,
      fontStyle: 'bold',
      color,
      stroke: UI.inkCss,
      strokeThickness: Math.max(3, size / 7),
      align: 'center',
    })
    .setOrigin(0.5);
}

export function panel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  alpha = 0.82,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(UI.panel, alpha);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 32);
  return g;
}

export function formatTime(sec: number): string {
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
