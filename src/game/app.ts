// Shared services for all scenes: storage, settings, audio.

import { Storage, type Settings } from '../utils/storage';
import { Audio } from './audio';

class App {
  readonly storage = new Storage();
  readonly audio = new Audio();
  settings: Settings;
  /** Seconds played this session, for the gentle break reminder. */
  sessionPlaySec = 0;
  breakReminderShown = false;
  readonly debug: boolean;

  constructor() {
    this.settings = this.storage.getSettings();
    this.applyAudioSettings();
    let debug = false;
    try {
      debug = new URLSearchParams(window.location.search).has('debug');
    } catch {
      debug = false;
    }
    this.debug = debug;
  }

  saveSettings(): void {
    this.storage.setSettings(this.settings);
    this.applyAudioSettings();
  }

  private applyAudioSettings(): void {
    this.audio.soundOn = this.settings.sound;
    this.audio.musicOn = this.settings.music;
  }

  /** Call on any user gesture. */
  unlockAudio(): void {
    this.audio.unlock();
    this.audio.startMusic();
  }
}

export const app = new App();
