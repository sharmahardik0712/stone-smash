import Phaser from 'phaser';
import { CONFIG } from '../../config/gameConfig';
import type { Upgrades } from '../../sim/world';
import { app } from '../app';
import { applyLayout } from '../layout';
import { UI } from '../palette';
import { Button, drawSky, label, panel, title } from '../ui';

interface UpgradeDef {
  key: keyof Upgrades;
  name: string;
  describe: (level: number) => string;
}

const DEFS: UpgradeDef[] = [
  {
    key: 'fireRate',
    name: 'Fire rate',
    describe: (l) => `-${Math.round(l * CONFIG.upgrades.fireRatePerLevel * 100)}% time between shots`,
  },
  {
    key: 'cannonSpeed',
    name: 'Cannon speed',
    describe: (l) => `+${Math.round(l * CONFIG.upgrades.cannonSpeedPerLevel * 100)}% movement speed`,
  },
  {
    key: 'powerDuration',
    name: 'Power-up time',
    describe: (l) => `+${Math.round(l * CONFIG.upgrades.powerDurationPerLevel * 100)}% power-up duration`,
  },
];

export function upgradeCost(level: number): number | null {
  return level >= CONFIG.upgrades.maxLevel ? null : CONFIG.upgrades.costs[level];
}

export class ShopScene extends Phaser.Scene {
  private from = 'Menu';
  private fromData: unknown;

  constructor() {
    super('Shop');
  }

  create(data: { from?: string; result?: unknown }): void {
    applyLayout(this, 'center');
    this.from = data.from ?? 'Menu';
    this.fromData = data.result;
    this.build();
  }

  private build(): void {
    this.children.removeAll(true);
    drawSky(this);
    const cx = CONFIG.width / 2;
    const coins = app.storage.getCoins();
    const upgrades = app.storage.getUpgrades();

    title(this, cx, 130, 'Upgrades', 72);
    label(this, cx, 220, `${coins} coins`, 40, '#ffe08a');
    label(this, cx, 270, 'Small boosts. The game is fair without them.', 24, '#e8f1ff');

    DEFS.forEach((def, i) => {
      const y = 420 + i * 210;
      const level = upgrades[def.key];
      const cost = upgradeCost(level);
      panel(this, cx, y, 640, 180);
      label(this, cx - 290, y - 50, def.name, 36).setOrigin(0, 0.5);
      label(this, cx - 290, y + 2, def.describe(Math.max(level, 1)), 22, '#c9cdf0').setOrigin(0, 0.5);
      // Level pips.
      for (let p = 0; p < CONFIG.upgrades.maxLevel; p++) {
        this.add.circle(
          cx - 280 + p * 34,
          y + 52,
          11,
          p < level ? UI.primary : 0xffffff,
          p < level ? 1 : 0.25,
        );
      }
      const canBuy = cost !== null && coins >= cost;
      new Button(
        this,
        cx + 200,
        y + 20,
        cost === null ? 'MAX' : `${cost}`,
        () => {
          if (cost === null || app.storage.getCoins() < cost) return;
          app.storage.setCoins(app.storage.getCoins() - cost);
          app.storage.setUpgrades({ ...upgrades, [def.key]: level + 1 });
          app.audio.powerUp();
          this.build();
        },
        {
          width: 190,
          height: 96,
          fontSize: 34,
          color: canBuy ? UI.primary : UI.muted,
          shade: canBuy ? UI.primaryDark : 0x6b6f94,
        },
      );
    });

    new Button(this, cx, 1120, 'Back', () => this.scene.start(this.from, this.fromData as object), {
      width: 420,
      color: UI.muted,
      shade: 0x6b6f94,
    });
  }
}
