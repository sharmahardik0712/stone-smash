import Phaser from 'phaser';
import { generateTextures } from '../render/textures';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    generateTextures(this);
    this.scene.start('Menu');
    // Fade out the HTML loading screen from index.html.
    const loading = document.getElementById('loading');
    if (loading) {
      loading.style.opacity = '0';
      window.setTimeout(() => loading.remove(), 350);
    }
  }
}
