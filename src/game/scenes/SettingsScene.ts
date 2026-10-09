import Phaser from 'phaser';
import { CONFIG } from '../../config/gameConfig';
import { app } from '../app';
import { applyLayout } from '../layout';
import { UI } from '../palette';
import { Button, drawSky, label, panel, title } from '../ui';

export class SettingsScene extends Phaser.Scene {
  private from = 'Menu';

  constructor() {
    super('Settings');
  }

  create(data: { from?: string }): void {
    applyLayout(this, 'center');
    this.from = data.from ?? 'Menu';
    drawSky(this);
    const cx = CONFIG.width / 2;
    const s = app.settings;
    title(this, cx, 130, 'Settings', 72);
    panel(this, cx, 610, 640, 840);

    const toggle = (y: number, name: string, get: () => string, flip: () => void) => {
      label(this, cx - 280, y, name, 34).setOrigin(0, 0.5);
      const b: Button = new Button(
        this,
        cx + 180,
        y,
        get(),
        () => {
          flip();
          app.saveSettings();
          b.setText(get());
        },
        { width: 220, height: 92, fontSize: 30 },
      );
    };

    toggle(
      270,
      'Sound',
      () => (s.sound ? 'On' : 'Off'),
      () => (s.sound = !s.sound),
    );
    toggle(
      390,
      'Music',
      () => (s.music ? 'On' : 'Off'),
      () => (s.music = !s.music),
    );
    toggle(
      510,
      'Fire',
      () => (s.fireMode === 'auto' ? 'Auto' : 'Hold'),
      () => {
        s.fireMode = s.fireMode === 'auto' ? 'manual' : 'auto';
      },
    );
    toggle(
      630,
      'Colorblind',
      () => (s.colorblind ? 'On' : 'Off'),
      () => (s.colorblind = !s.colorblind),
    );

    // Screen shake slider.
    label(this, cx - 280, 750, 'Screen shake', 34).setOrigin(0, 0.5);
    const trackX = cx - 260;
    const trackW = 520;
    const y = 840;
    this.add.rectangle(cx, y, trackW, 14, 0xffffff, 0.3).setOrigin(0.5);
    const fill = this.add.rectangle(trackX, y, trackW * s.shake, 14, UI.primary).setOrigin(0, 0.5);
    const knob = this.add.circle(trackX + trackW * s.shake, y, 30, 0xffffff).setStrokeStyle(6, UI.primary);
    const pct = label(this, cx + 280, 750, `${Math.round(s.shake * 100)}%`, 30).setOrigin(1, 0.5);
    const zone = this.add
      .zone(cx, y, trackW + 80, 100)
      .setInteractive({ draggable: true, useHandCursor: true });
    const setFrom = (px: number) => {
      const v = Phaser.Math.Clamp((px - trackX) / trackW, 0, 1);
      s.shake = Math.round(v * 20) / 20;
      knob.x = trackX + trackW * s.shake;
      fill.width = trackW * s.shake;
      pct.setText(`${Math.round(s.shake * 100)}%`);
    };
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => setFrom(p.worldX));
    zone.on('drag', (p: Phaser.Input.Pointer) => setFrom(p.worldX));
    zone.on('pointerup', () => app.saveSettings());
    zone.on('dragend', () => app.saveSettings());

    label(
      this,
      cx,
      950,
      'No accounts, no ads, no tracking.\nProgress is saved only on this device.',
      24,
      '#c9cdf0',
    );

    new Button(
      this,
      cx,
      1120,
      'Back',
      () => {
        app.saveSettings();
        this.scene.start(this.from);
      },
      { width: 420, color: UI.muted, shade: 0x6b6f94 },
    );
  }
}
