import Phaser from 'phaser';
import { CONFIG } from '../../config/gameConfig';
import { app } from '../app';
import { applyLayout, LAYOUT } from '../layout';
import { UI } from '../palette';
import { Button, panel, title } from '../ui';

export class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause');
  }

  create(): void {
    applyLayout(this, 'center');
    const cx = CONFIG.width / 2;
    this.add
      .rectangle(cx, LAYOUT.height / 2, CONFIG.width, LAYOUT.height, UI.ink, 0.55)
      .setScrollFactor(0)
      .setInteractive();
    panel(this, cx, 760, 560, 760);
    title(this, cx, 470, 'Paused', 72);

    const resume = () => {
      this.scene.stop();
      this.scene.resume('Game');
    };
    new Button(this, cx, 620, 'Resume', resume, {
      width: 440,
      height: 120,
      fontSize: 48,
      color: UI.primary,
      shade: UI.primaryDark,
    });
    new Button(
      this,
      cx,
      770,
      'Restart',
      () => {
        this.scene.stop();
        this.scene.stop('Game');
        this.scene.start('Game');
      },
      { width: 440 },
    );
    const sound = new Button(
      this,
      cx,
      900,
      this.soundLabel(),
      () => {
        const on = !(app.settings.sound || app.settings.music);
        app.settings.sound = on;
        app.settings.music = on;
        app.saveSettings();
        sound.setText(this.soundLabel());
      },
      { width: 440, color: UI.muted, shade: 0x6b6f94 },
    );
    new Button(
      this,
      cx,
      1030,
      'Quit',
      () => {
        this.scene.stop();
        this.scene.stop('Game');
        this.scene.start('Menu');
      },
      { width: 440, color: UI.muted, shade: 0x6b6f94 },
    );

    this.input.keyboard?.on('keydown-ESC', resume);
    this.input.keyboard?.on('keydown-P', resume);
  }

  private soundLabel(): string {
    return app.settings.sound || app.settings.music ? 'Sound: On' : 'Sound: Off';
  }
}
