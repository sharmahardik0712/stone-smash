import Phaser from 'phaser';
import { CANNONS, CONFIG } from '../../config/gameConfig';
import { goalProgress, goalText, liveStats } from '../../utils/progress';
import { comboMultiplier } from '../../sim/scoring';
import { app } from '../app';
import { applyLayout } from '../layout';
import { UI } from '../palette';
import { Button, drawSky, formatTime, label, panel, title } from '../ui';
import type { RunResult } from './GameScene';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver');
  }

  create(r: RunResult): void {
    applyLayout(this, 'center');
    drawSky(this);
    const cx = CONFIG.width / 2;
    const stats = app.storage.getStats();

    panel(this, cx, 400, 600, 560);
    title(this, cx, 190, r.newBest ? 'New best!' : 'Nice run!', 64).setColor(
      r.newBest ? '#ffd166' : '#ffffff',
    );
    const score = label(this, cx, 300, '0', 96);
    this.tweens.addCounter({
      from: 0,
      to: r.score,
      duration: Math.min(1200, 300 + r.score / 20),
      ease: 'Cubic.Out',
      onUpdate: (t) => score.setText(Math.round(t.getValue() ?? 0).toLocaleString('en-US')),
    });
    label(this, cx, 390, `Best  ${stats.highScore.toLocaleString('en-US')}`, 34, '#ffe08a');

    const rows: [string, string][] = [
      ['Time survived', formatTime(r.timeSec)],
      ['Stones smashed', String(r.kills)],
      ['Best combo', r.bestCombo > 0 ? `x${comboMultiplier(r.bestCombo).toFixed(1)}` : '-'],
      ['Coins earned', `+${r.coins}`],
    ];
    rows.forEach(([k, v], i) => {
      const y = 460 + i * 52;
      label(this, cx - 230, y, k, 28, '#c9cdf0').setOrigin(0, 0.5);
      label(this, cx + 230, y, v, 30).setOrigin(1, 0.5);
    });

    // Cannon progress: celebrate unlocks, otherwise show the next goal (a reason to come back).
    if (r.unlocked.length > 0) {
      const t = label(this, cx, 720, `Unlocked: ${r.unlocked.map((c) => c.name).join(', ')}!`, 38, '#ffd166');
      this.tweens.add({ targets: t, scale: { from: 0.6, to: 1 }, duration: 400, ease: 'Back.Out' });
    } else {
      const save = app.storage.getCannons();
      const next = CANNONS.find((c) => !save.unlocked.includes(c.id));
      if (next) {
        const p = goalProgress(next.goal, liveStats(stats, 0, 0, 0));
        label(this, cx, 705, `Next cannon: ${next.name}`, 30, '#ffffff');
        label(this, cx, 745, goalText(next.goal), 22, '#c9cdf0');
        this.add.rectangle(cx - 150, 776, 300, 10, 0xffffff, 0.25).setOrigin(0, 0.5);
        this.add
          .rectangle(cx - 150, 776, Math.max(6, (300 * p.current) / p.target), 10, UI.secondary)
          .setOrigin(0, 0.5);
      }
    }

    // "Play again" is the largest, easiest target, in the lower half.
    new Button(this, cx, 880, 'Play again', () => this.scene.start('Game'), {
      width: 520,
      height: 150,
      fontSize: 56,
      color: UI.primary,
      shade: UI.primaryDark,
    });
    const small = { width: 210, height: 100, fontSize: 30 };
    new Button(
      this,
      cx - 220,
      1030,
      'Cannons',
      () => this.scene.start('Cannons', { from: 'GameOver', result: r }),
      {
        ...small,
        color: 0x8b5cf6,
        shade: 0x5b34c4,
      },
    );
    new Button(
      this,
      cx,
      1030,
      'Upgrades',
      () => this.scene.start('Shop', { from: 'GameOver', result: r }),
      small,
    );
    new Button(this, cx + 220, 1030, 'Menu', () => this.scene.start('Menu'), {
      ...small,
      color: UI.muted,
      shade: 0x6b6f94,
    });

    this.input.keyboard?.on('keydown-ENTER', () => this.scene.start('Game'));
    this.input.keyboard?.on('keydown-SPACE', () => this.scene.start('Game'));
  }
}
