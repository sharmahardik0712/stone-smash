import Phaser from 'phaser';
import { CANNONS, CONFIG, type CannonDef } from '../../config/gameConfig';
import { goalProgress, goalText, liveStats, newlyEarned, withUnlocked } from '../../utils/progress';
import { app } from '../app';
import { applyLayout } from '../layout';
import { UI } from '../palette';
import { cannonBarrelKey, cannonBaseKey } from '../render/textures';
import { Button, drawSky, label, panel, title } from '../ui';

export function cannonPerks(c: CannonDef): string {
  const parts: string[] = [];
  if (c.bulletSpeed > 1) parts.push(`Bullets +${Math.round((c.bulletSpeed - 1) * 100)}%`);
  if (c.barrels === 2) parts.push('Twin');
  if (c.pierce > 0) parts.push('Pierce');
  if (c.fireInterval < 1) parts.push(`Fire +${Math.round((1 / c.fireInterval - 1) * 100)}%`);
  return parts.length ? parts.join(' · ') : 'Balanced all-rounder';
}

export class CannonsScene extends Phaser.Scene {
  private from = 'Menu';
  private fromData: object | undefined;

  constructor() {
    super('Cannons');
  }

  create(data: { from?: string; result?: object }): void {
    applyLayout(this, 'center');
    this.from = data.from ?? 'Menu';
    this.fromData = data.result;
    // Goals reached before this screen existed (or in old saves) unlock now.
    const save = app.storage.getCannons();
    const earned = newlyEarned(save, liveStats(app.storage.getStats(), 0, 0, 0));
    if (earned.length)
      app.storage.setCannons(
        withUnlocked(
          save,
          earned.map((c) => c.id),
        ),
      );
    this.build();
  }

  private build(): void {
    this.children.removeAll(true);
    drawSky(this);
    const cx = CONFIG.width / 2;
    const coins = app.storage.getCoins();
    const save = app.storage.getCannons();
    const stats = liveStats(app.storage.getStats(), 0, 0, 0);

    title(this, cx, 110, 'Cannons', 72);
    label(this, cx, 190, `${coins} coins`, 36, '#ffe08a');
    label(this, cx, 236, 'Reach the goal, or unlock early with coins.', 24, '#e8f1ff');

    CANNONS.forEach((c, i) => {
      const y = 340 + i * 166;
      const unlocked = save.unlocked.includes(c.id);
      const selected = save.selected === c.id;
      const g = panel(this, cx, y, 680, 150, selected ? 0.92 : 0.78);
      if (selected) {
        g.lineStyle(5, UI.primary, 1);
        g.strokeRoundedRect(cx - 340, y - 75, 680, 150, 32);
      }

      // Preview.
      const px = 100;
      const barrel = this.add.image(px, y + 18, cannonBarrelKey(c.id)).setOrigin(0.5, 0.92);
      const base = this.add.image(px, y + 30, cannonBaseKey(c.id));
      if (!unlocked) {
        barrel.setTint(0x555577).setAlpha(0.7);
        base.setTint(0x555577).setAlpha(0.7);
      }

      label(this, 175, y - 42, c.name, 36).setOrigin(0, 0.5);
      label(this, 175, y - 2, cannonPerks(c), 21, '#c9cdf0').setOrigin(0, 0.5);

      if (unlocked) {
        label(this, 175, y + 40, i === 0 ? 'Starter cannon' : 'Unlocked', 22, '#8ef0c8').setOrigin(0, 0.5);
      } else {
        const p = goalProgress(c.goal, stats);
        label(this, 175, y + 32, goalText(c.goal), 21, '#ffffff').setOrigin(0, 0.5);
        const bw = 250;
        this.add.rectangle(175, y + 58, bw, 10, 0xffffff, 0.25).setOrigin(0, 0.5);
        this.add
          .rectangle(175, y + 58, Math.max(6, (bw * p.current) / p.target), 10, UI.secondary)
          .setOrigin(0, 0.5);
      }

      const bx = cx + 225;
      if (selected) {
        label(this, bx, y, 'Using', 30, '#ffd166');
      } else if (unlocked) {
        new Button(this, bx, y, 'Use', () => this.select(c), { width: 170, height: 92, fontSize: 32 });
      } else {
        const afford = coins >= c.coins;
        new Button(this, bx, y, `${c.coins}`, () => this.buy(c), {
          width: 170,
          height: 92,
          fontSize: 32,
          color: afford ? UI.primary : UI.muted,
          shade: afford ? UI.primaryDark : 0x6b6f94,
        });
        label(this, bx, y + 58, 'coins', 18, '#ffe08a');
      }
    });

    new Button(this, cx, 1190, 'Back', () => this.scene.start(this.from, this.fromData), {
      width: 420,
      height: 100,
      color: UI.muted,
      shade: 0x6b6f94,
    });
  }

  private select(c: CannonDef): void {
    app.storage.setCannons({ ...app.storage.getCannons(), selected: c.id });
    this.build();
  }

  private buy(c: CannonDef): void {
    const coins = app.storage.getCoins();
    const save = app.storage.getCannons();
    if (save.unlocked.includes(c.id)) return;
    if (coins < c.coins) {
      this.cameras.main.shake(120, 0.004);
      return;
    }
    app.storage.setCoins(coins - c.coins);
    app.storage.setCannons({ ...withUnlocked(save, [c.id]), selected: c.id });
    app.audio.powerUp();
    this.build();
  }
}
