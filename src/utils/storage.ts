// Safe localStorage wrapper: every access is guarded, and the game works (without saving)
// in private windows, with blocked storage, or when quota is full.

import { CANNON_IDS, type CannonId } from '../config/gameConfig';
import type { Upgrades } from '../sim/world';

export const SAVE_VERSION = 2;

export interface SavedStats {
  highScore: number;
  bestCombo: number;
  longestRunSec: number;
  totalStones: number;
  runs: number;
}

export interface Settings {
  sound: boolean;
  music: boolean;
  /** Screen shake strength 0..1. */
  shake: number;
  fireMode: 'auto' | 'manual';
  colorblind: boolean;
}

export const DEFAULT_STATS: SavedStats = {
  highScore: 0,
  bestCombo: 0,
  longestRunSec: 0,
  totalStones: 0,
  runs: 0,
};
export const DEFAULT_SETTINGS: Settings = {
  sound: true,
  music: true,
  shake: 1,
  fireMode: 'auto',
  colorblind: false,
};
export const DEFAULT_UPGRADES: Upgrades = { fireRate: 0, cannonSpeed: 0, powerDuration: 0 };

export interface CannonSave {
  unlocked: CannonId[];
  selected: CannonId;
}

export const DEFAULT_CANNONS: CannonSave = { unlocked: ['classic'], selected: 'classic' };

const KEYS = {
  version: 'ss.version',
  stats: 'ss.stats',
  settings: 'ss.settings',
  coins: 'ss.coins',
  upgrades: 'ss.upgrades',
  cannons: 'ss.cannons',
} as const;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory fallback used when localStorage is unavailable. */
export class MemoryStore implements KeyValueStore {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

function defaultBackend(): KeyValueStore {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return new MemoryStore();
    const probe = '__ss_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return new MemoryStore();
  }
}

export class Storage {
  private fallback = new MemoryStore();

  constructor(private backend: KeyValueStore = defaultBackend()) {
    this.migrate();
  }

  private read(key: string): string | null {
    try {
      return this.backend.getItem(key);
    } catch {
      return this.fallback.getItem(key);
    }
  }

  private write(key: string, value: string): void {
    this.fallback.setItem(key, value);
    try {
      this.backend.setItem(key, value);
    } catch {
      // Storage full or blocked: keep the in-memory copy for this session.
    }
  }

  private readJson<T extends object>(key: string, defaults: T): T {
    const raw = this.read(key);
    if (!raw) return { ...defaults };
    try {
      const parsed = JSON.parse(raw) as Partial<T>;
      if (!parsed || typeof parsed !== 'object') return { ...defaults };
      return { ...defaults, ...parsed };
    } catch {
      return { ...defaults };
    }
  }

  private migrate(): void {
    const v = Number(this.read(KEYS.version) ?? 0);
    if (v >= SAVE_VERSION) return;
    // Steps run oldest first. v0 -> v1: nothing to transform.
    if (v < 2 && !this.read(KEYS.cannons)) {
      // v1 -> v2: cannon ladder added. Existing players start with Classic; goals they already
      // reached unlock at the end of their next run (or on the Cannons screen).
      this.setCannons(DEFAULT_CANNONS);
    }
    this.write(KEYS.version, String(SAVE_VERSION));
  }

  getStats(): SavedStats {
    return this.readJson(KEYS.stats, DEFAULT_STATS);
  }
  setStats(stats: SavedStats): void {
    this.write(KEYS.stats, JSON.stringify(stats));
  }

  getSettings(): Settings {
    return this.readJson(KEYS.settings, DEFAULT_SETTINGS);
  }
  setSettings(settings: Settings): void {
    this.write(KEYS.settings, JSON.stringify(settings));
  }

  getCoins(): number {
    const n = Number(this.read(KEYS.coins) ?? 0);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }
  setCoins(coins: number): void {
    this.write(KEYS.coins, String(Math.max(0, Math.floor(coins))));
  }

  getUpgrades(): Upgrades {
    return this.readJson(KEYS.upgrades, DEFAULT_UPGRADES);
  }
  setUpgrades(u: Upgrades): void {
    this.write(KEYS.upgrades, JSON.stringify(u));
  }

  getCannons(): CannonSave {
    const raw = this.readJson(KEYS.cannons, DEFAULT_CANNONS);
    // Drop anything unknown (corrupt or edited saves); Classic is always unlocked.
    const saved = Array.isArray(raw.unlocked) ? raw.unlocked : [];
    const unlocked = CANNON_IDS.filter((id) => id === 'classic' || saved.includes(id));
    const selected = unlocked.includes(raw.selected) ? raw.selected : 'classic';
    return { unlocked, selected };
  }
  setCannons(c: CannonSave): void {
    this.write(KEYS.cannons, JSON.stringify(c));
  }
}
