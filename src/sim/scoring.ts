import { BIG, CONFIG, type StoneType } from '../config/gameConfig';
import { gainXp } from './cannon';
import type { World } from './world';

export interface ScoreState {
  score: number;
  /** Kills chained within the combo window; 0 = no combo. */
  combo: number;
  bestCombo: number;
  lastKillT: number;
  kills: number;
}

export function createScoreState(): ScoreState {
  return { score: 0, combo: 0, bestCombo: 0, lastKillT: -Infinity, kills: 0 };
}

export function comboMultiplier(combo: number): number {
  return Math.min(1 + CONFIG.score.comboStep * combo, CONFIG.score.comboMax);
}

/** Uncapped: long runs keep pulling ahead even after difficulty plateaus. */
export function timeMultiplier(tSeconds: number): number {
  return 1 + CONFIG.score.timeMultPerMin * (tSeconds / 60);
}

export function pointsForKill(tier: number, combo: number, tSeconds: number): number {
  return Math.round(CONFIG.score.points[tier] * comboMultiplier(combo) * timeMultiplier(tSeconds));
}

export function registerKill(world: World, tier: number, _type: StoneType, x: number, y: number): void {
  const s = world.score;
  if (s.kills > 0 && world.t - s.lastKillT <= CONFIG.score.comboWindowSec) s.combo++;
  else s.combo = 0;
  s.lastKillT = world.t;
  s.kills++;
  if (s.combo > s.bestCombo) s.bestCombo = s.combo;
  if (tier <= BIG) world.bigKills++;
  const pts = pointsForKill(tier, s.combo, world.t);
  s.score += pts;
  const e = world.events.push('score', x, y);
  e.value = pts;
  e.tier = tier;
  e.combo = s.combo;
  gainXp(world);
}

export function resetCombo(world: World): void {
  world.score.combo = 0;
  world.score.lastKillT = -Infinity;
}
