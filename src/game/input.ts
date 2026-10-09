// Keyboard, mouse and touch all normalise to a single targetX (+ fire flag for manual mode).
// Pointer events give mouse and touch one code path.

import Phaser from 'phaser';
import { CONFIG } from '../config/gameConfig';
import type { Input } from '../sim/world';
import { HUD_HEIGHT } from './layout';

export class InputController {
  readonly state: Input = { targetX: CONFIG.width / 2, fire: false };
  private keys: {
    left: Phaser.Input.Keyboard.Key[];
    right: Phaser.Input.Keyboard.Key[];
    fire: Phaser.Input.Keyboard.Key;
  } | null = null;
  private keyboardActive = false;
  private dragPointerId = -1;
  private dragOffset = 0;
  private pointerFire = false;
  /** True once the player has moved at all (used to fade the first-run hint). */
  moved = false;

  constructor(
    scene: Phaser.Scene,
    private cannonX: () => number,
  ) {
    const kb = scene.input.keyboard;
    if (kb) {
      const K = Phaser.Input.Keyboard.KeyCodes;
      this.keys = {
        left: [kb.addKey(K.LEFT), kb.addKey(K.A)],
        right: [kb.addKey(K.RIGHT), kb.addKey(K.D)],
        fire: kb.addKey(K.SPACE),
      };
    }

    scene.input.on('pointerdown', (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return; // HUD buttons (pause) are not gameplay input
      if (p.wasTouch) {
        // Drag anywhere below the HUD. Relative drag: the cannon keeps its offset from the finger,
        // so the thumb can rest low on the screen and never covers the cannon.
        if (p.y >= HUD_HEIGHT && this.dragPointerId === -1) {
          this.dragPointerId = p.id;
          this.dragOffset = this.cannonX() - p.worldX;
          this.state.targetX = this.cannonX();
        }
      } else {
        this.state.targetX = p.worldX;
        this.keyboardActive = false;
      }
      this.pointerFire = true;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.wasTouch) {
        if (p.id !== this.dragPointerId) return;
        this.state.targetX = p.worldX + this.dragOffset;
      } else {
        this.state.targetX = p.worldX;
        this.keyboardActive = false;
      }
      this.moved = true;
    });
    const release = (p: Phaser.Input.Pointer) => {
      if (p.id === this.dragPointerId) this.dragPointerId = -1;
      this.pointerFire = false;
    };
    scene.input.on('pointerup', release);
    scene.input.on('pointerupoutside', release);
  }

  update(): Input {
    if (this.keys) {
      const left = this.keys.left.some((k) => k.isDown);
      const right = this.keys.right.some((k) => k.isDown);
      if (left !== right) {
        // Aim far past the cannon: the sim caps the speed.
        this.state.targetX = this.cannonX() + (left ? -CONFIG.width : CONFIG.width);
        this.keyboardActive = true;
        this.moved = true;
      } else if (this.keyboardActive) {
        this.state.targetX = this.cannonX();
      }
    }
    this.state.targetX = Phaser.Math.Clamp(this.state.targetX, 0, CONFIG.width);
    this.state.fire = this.pointerFire || (this.keys?.fire.isDown ?? false);
    return this.state;
  }

  reset(x: number): void {
    this.state.targetX = x;
    this.dragPointerId = -1;
    this.pointerFire = false;
  }
}
