// Fills tall phone screens without changing the game. The playfield is always 720x1280
// (so the sim is identical and fair on every device). Any extra screen height becomes a HUD band
// above the playfield (so the HUD never covers stones) and more thumb room below the ground.

import Phaser from 'phaser';
import { CONFIG } from '../config/gameConfig';

/** Height of the HUD (score row, combo, power-up rings) in screen pixels. */
export const HUD_HEIGHT = 200;
const MAX_HEIGHT = 1720;

export interface Layout {
  /** Canvas height in logical pixels (>= 1280). */
  height: number;
  /** Extra space above the playfield. */
  top: number;
  /** Extra space below the playfield. */
  bottom: number;
}

export function computeLayout(viewW: number, viewH: number): Layout {
  const ideal = viewW > 0 ? Math.round((CONFIG.width * viewH) / viewW) : CONFIG.height;
  const height = Phaser.Math.Clamp(ideal, CONFIG.height, MAX_HEIGHT);
  const extra = height - CONFIG.height;
  const top = Math.min(extra, HUD_HEIGHT);
  return { height, top, bottom: extra - top };
}

function viewport(): { w: number; h: number } {
  const el = document.getElementById('game');
  const r = el?.getBoundingClientRect();
  return { w: r?.width || window.innerWidth, h: r?.height || window.innerHeight };
}

export const LAYOUT: Layout = (() => {
  const v = viewport();
  return computeLayout(v.w, v.h);
})();

/** Positions the camera so the 720x1280 playfield sits in the canvas. */
export function applyLayout(scene: Phaser.Scene, mode: 'game' | 'center'): void {
  const offset = mode === 'game' ? LAYOUT.top : Math.round((LAYOUT.height - CONFIG.height) / 2);
  scene.cameras.main.setScroll(0, -offset);
}

/** True on a touch phone held sideways. */
export function isPhoneLandscape(): boolean {
  return window.matchMedia('(pointer: coarse)').matches && window.innerWidth > window.innerHeight;
}

/**
 * Re-fits the canvas after rotation or a browser-bar resize. Menus restart with the new size;
 * a run in progress keeps its size (letterboxed) until it ends, so nothing jumps mid-game.
 */
export function watchResize(game: Phaser.Game): void {
  let timer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      if (isPhoneLandscape()) return;
      const v = viewport();
      const next = computeLayout(v.w, v.h);
      if (Math.abs(next.height - LAYOUT.height) < 24) return;
      const busy = game.scene.isActive('Game') || game.scene.isPaused('Game');
      if (busy) return;
      Object.assign(LAYOUT, next);
      game.scale.setGameSize(CONFIG.width, LAYOUT.height);
      for (const s of game.scene.getScenes(true)) s.scene.restart(s.sys.settings.data);
    }, 250);
  });
}
