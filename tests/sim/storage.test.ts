import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, MemoryStore, Storage, type KeyValueStore } from '../../src/utils/storage';

const throwing: KeyValueStore = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
  removeItem() {
    throw new Error('SecurityError');
  },
};

describe('storage', () => {
  it('falls back to memory when localStorage throws', () => {
    const s = new Storage(throwing);
    expect(s.getCoins()).toBe(0);
    s.setCoins(42);
    expect(s.getCoins()).toBe(42);
    expect(s.getSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('round-trips data and survives corrupt JSON', () => {
    const backend = new MemoryStore();
    const s = new Storage(backend);
    s.setUpgrades({ fireRate: 2, cannonSpeed: 1, powerDuration: 0 });
    expect(new Storage(backend).getUpgrades()).toEqual({ fireRate: 2, cannonSpeed: 1, powerDuration: 0 });
    backend.setItem('ss.stats', '{not json');
    expect(new Storage(backend).getStats().highScore).toBe(0);
    expect(backend.getItem('ss.version')).toBe('2');
  });
});
