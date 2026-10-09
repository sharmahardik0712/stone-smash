import { describe, expect, it } from 'vitest';
import {
  MAX_ENTRIES,
  cleanName,
  parseSubmission,
  qualifies,
  type ScoreEntry,
} from '../../src/utils/scoreboard';

const entry = (score: number, id = score): ScoreEntry => ({
  id,
  name: 'x',
  score,
  timeSec: 60,
  cannon: 'classic',
  createdAt: '',
});

describe('scoreboard rules', () => {
  it('cleans names: trims, collapses spaces, 1-12 letters/numbers/spaces only', () => {
    expect(cleanName('  Rock   Star  ')).toBe('Rock Star');
    expect(cleanName('abcdefghijkl')).toBe('abcdefghijkl');
    expect(cleanName('abcdefghijklm')).toBeNull();
    expect(cleanName('   ')).toBeNull();
    expect(cleanName('<b>hi</b>')).toBeNull();
    expect(cleanName('emoji😀')).toBeNull();
    expect(cleanName(42)).toBeNull();
  });

  it('validates submissions', () => {
    const ok = { name: 'Ana', score: 1200, timeSec: 300, cannon: 'twin' };
    expect(parseSubmission(ok)).toEqual(ok);
    expect(typeof parseSubmission({ ...ok, score: 0 })).toBe('string');
    expect(typeof parseSubmission({ ...ok, score: 1.5 })).toBe('string');
    expect(typeof parseSubmission({ ...ok, score: -5 })).toBe('string');
    expect(typeof parseSubmission({ ...ok, cannon: 'laser' })).toBe('string');
    expect(typeof parseSubmission({ ...ok, name: '' })).toBe('string');
    expect(typeof parseSubmission(null)).toBe('string');
  });

  it('a score qualifies if the board has room or it beats #51', () => {
    expect(qualifies(10, [])).toBe(true);
    expect(qualifies(0, [])).toBe(false);
    const full = Array.from({ length: MAX_ENTRIES }, (_, i) => entry(1000 - i * 10));
    const lowest = full[MAX_ENTRIES - 1].score;
    expect(qualifies(lowest + 1, full)).toBe(true);
    expect(qualifies(lowest, full)).toBe(false); // a tie goes to the earlier entry
  });
});
