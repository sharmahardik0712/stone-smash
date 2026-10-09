import Phaser from 'phaser';
import { CONFIG } from './config/gameConfig';
import { app } from './game/app';
import { LAYOUT, watchResize } from './game/layout';
import { UI } from './game/palette';
import { BootScene } from './game/scenes/BootScene';
import { CannonsScene } from './game/scenes/CannonsScene';
import { GameOverScene } from './game/scenes/GameOverScene';
import { GameScene } from './game/scenes/GameScene';
import { MenuScene } from './game/scenes/MenuScene';
import { PauseScene } from './game/scenes/PauseScene';
import { SettingsScene } from './game/scenes/SettingsScene';
import { ShopScene } from './game/scenes/ShopScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.width,
  height: LAYOUT.height,
  backgroundColor: UI.skyTop,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 3 },
  render: { antialias: true, powerPreference: 'high-performance' },
  disableContextMenu: true,
  banner: false,
  scene: [BootScene, MenuScene, GameScene, PauseScene, GameOverScene, ShopScene, SettingsScene, CannonsScene],
});

// Silence audio while the tab is hidden; the Game scene also pauses itself.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) app.audio.suspend();
  else app.audio.resume();
});

watchResize(game);

// iOS Safari ignores user-scalable=no: block pinch zoom and long-press menus during play.
for (const type of ['gesturestart', 'gesturechange', 'contextmenu']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false });
}

// ?debug=1: expose the game so tooling can drive frames (e.g. game.step) while testing.
if (app.debug) (window as unknown as { __game: Phaser.Game }).__game = game;
