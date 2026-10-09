// Seeded RNG (mulberry32). The sim never touches Math.random, so a seed + input log replays exactly.

export interface Rng {
  state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 || 0x9e3779b9 };
}

/** Uniform float in [0, 1). */
export function next(rng: Rng): number {
  rng.state = (rng.state + 0x6d2b79f5) >>> 0;
  let t = rng.state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function range(rng: Rng, min: number, max: number): number {
  return min + (max - min) * next(rng);
}

export function int(rng: Rng, maxExclusive: number): number {
  return Math.floor(next(rng) * maxExclusive);
}

/** Index picked from non-negative weights. */
export function weighted(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) total += weights[i];
  let r = next(rng) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
