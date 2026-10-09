// Cannon unlock rules. Pure functions (no Phaser) so they are unit-tested.

import { CANNONS, type CannonDef, type CannonId, type UnlockGoal } from '../config/gameConfig';
import type { CannonSave, SavedStats } from './storage';

/** Stats that goals are checked against: saved bests, optionally merged with the run in progress. */
export interface GoalStats {
  longestRunSec: number;
  totalStones: number;
  highScore: number;
}

export function goalProgress(goal: UnlockGoal, s: GoalStats): { current: number; target: number } {
  switch (goal.kind) {
    case 'start':
      return { current: 1, target: 1 };
    case 'surviveSec':
      return { current: Math.min(s.longestRunSec, goal.value), target: goal.value };
    case 'totalStones':
      return { current: Math.min(s.totalStones, goal.value), target: goal.value };
    case 'score':
      return { current: Math.min(s.highScore, goal.value), target: goal.value };
  }
}

export function goalMet(goal: UnlockGoal, s: GoalStats): boolean {
  const p = goalProgress(goal, s);
  return p.current >= p.target;
}

export function goalText(goal: UnlockGoal): string {
  switch (goal.kind) {
    case 'start':
      return 'Starter cannon';
    case 'surviveSec': {
      const m = Math.floor(goal.value / 60);
      const sec = goal.value % 60;
      return `Survive ${m}:${String(sec).padStart(2, '0')} in one run`;
    }
    case 'totalStones':
      return `Smash ${goal.value} stones (all runs)`;
    case 'score':
      return `Score ${goal.value.toLocaleString('en-US')} in one run`;
  }
}

/** Merges saved stats with a run in progress. */
export function liveStats(saved: SavedStats, runSec: number, runStones: number, runScore: number): GoalStats {
  return {
    longestRunSec: Math.max(saved.longestRunSec, runSec),
    totalStones: saved.totalStones + runStones,
    highScore: Math.max(saved.highScore, runScore),
  };
}

/** Cannons whose goal is met but that are not unlocked yet. */
export function newlyEarned(save: CannonSave, s: GoalStats): CannonDef[] {
  return CANNONS.filter((c) => !save.unlocked.includes(c.id) && goalMet(c.goal, s));
}

export function withUnlocked(save: CannonSave, ids: CannonId[]): CannonSave {
  const unlocked = [...save.unlocked];
  for (const id of ids) if (!unlocked.includes(id)) unlocked.push(id);
  return { ...save, unlocked };
}
