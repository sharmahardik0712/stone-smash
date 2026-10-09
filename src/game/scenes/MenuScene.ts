import Phaser from 'phaser';
import { BIG, cannonDef, CONFIG, STONE_TYPES } from '../../config/gameConfig';
import { app } from '../app';
import { applyLayout } from '../layout';
import { UI } from '../palette';
import { cannonBarrelKey, cannonBaseKey, stoneKey } from '../render/textures';
import { Button, drawSky, label, title } from '../ui';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  create(): void {
    applyLayout(this, 'center');
    drawSky(this);
    this.decorStones();
    const cx = CONFIG.width / 2;
    const stats = app.storage.getStats();

    title(this, cx, 300, 'STONE', 120);
    title(this, cx, 420, 'SMASH', 120).setColor('#ffd166');
    label(this, cx, 520, 'Slide. Smash. Survive.', 34, '#e8f1ff');

    if (stats.highScore > 0)
      label(this, cx, 112, `Best  ${stats.highScore.toLocaleString('en-US')}`, 30, '#ffe08a');
    label(this, cx, 72, `${app.storage.getCoins()} coins`, 30, '#ffe08a');

    // Primary actions in the lower half for one-thumb play.
    new Button(this, cx, 800, 'PLAY', () => this.scene.start('Game'), {
      width: 480,
      height: 150,
      fontSize: 64,
      color: UI.primary,
      shade: UI.primaryDark,
    });
    // Current cannon, so progress is visible from the first screen.
    const current = cannonDef(app.storage.getCannons().selected);
    this.add.image(cx, 668, cannonBarrelKey(current.id)).setOrigin(0.5, 0.92);
    this.add.image(cx, 684, cannonBaseKey(current.id));
    label(this, cx, 572, current.name, 30, '#ffffff');

    const small = { width: 210, height: 100, fontSize: 30 };
    new Button(this, cx - 220, 960, 'Cannons', () => this.scene.start('Cannons', { from: 'Menu' }), {
      ...small,
      color: 0x8b5cf6,
      shade: 0x5b34c4,
    });
    new Button(this, cx, 960, 'Upgrades', () => this.scene.start('Shop', { from: 'Menu' }), small);
    new Button(this, cx + 220, 960, 'Settings', () => this.scene.start('Settings', { from: 'Menu' }), {
      ...small,
      color: UI.muted,
      shade: 0x6b6f94,
    });

    new Button(this, cx, 1085, 'World Scoreboard', () => this.scene.start('Scoreboard', { from: 'Menu' }), {
      width: 440,
      height: 90,
      fontSize: 32,
      color: 0x14b8a6,
      shade: 0x0b7f74,
    });

    // The first tap or key press also unlocks audio.
    this.input.once('pointerdown', () => app.unlockAudio());
    this.input.keyboard?.once('keydown', () => app.unlockAudio());
    this.input.keyboard?.on('keydown-ENTER', () => this.scene.start('Game'));
    this.input.keyboard?.on('keydown-SPACE', () => this.scene.start('Game'));
  }

  private decorStones(): void {
    for (let i = 0; i < 6; i++) {
      const type = STONE_TYPES[i % STONE_TYPES.length];
      const tier = BIG + (i % 3);
      const img = this.add
        .image(80 + ((i * 131) % 560), -80, stoneKey(type, tier, app.settings.colorblind))
        .setAlpha(0.55)
        .setDepth(-5);
      this.tweens.add({
        targets: img,
        y: CONFIG.groundY + 80,
        rotation: (i % 2 ? 1 : -1) * 3,
        duration: 7000 + i * 900,
        delay: i * 1300,
        repeat: -1,
      });
    }
  }
}
