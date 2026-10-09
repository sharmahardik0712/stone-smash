// World scoreboard rules, shared by the game (client) and the Worker API (server).
// Pure functions only, so they run in both places and are unit-tested.

import { CANNON_IDS, type CannonId } from '../config/gameConfig';

/** Only the best this many scores are kept. */
export const MAX_ENTRIES = 51;
export const NAME_MAX = 12;
const NAME_RE = /^[A-Za-z0-9 ]+$/;

export interface ScoreEntry {
  id: number;
  name: string;
  score: number;
  timeSec: number;
  cannon: string;
  createdAt: string;
}

export interface Submission {
  name: string;
  score: number;
  timeSec: number;
  cannon: CannonId;
}

/** Trims and collapses spaces; returns null unless the name is 1-12 letters, numbers or spaces. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1 || name.length > NAME_MAX || !NAME_RE.test(name)) return null;
  return name;
}

function isCount(n: unknown, max: number): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= max;
}

/** Validates a POSTed body. Returns the submission, or an error message. */
export function parseSubmission(body: unknown): Submission | string {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object.';
  const b = body as Record<string, unknown>;
  const name = cleanName(b.name);
  if (!name) return `Name must be 1-${NAME_MAX} letters, numbers or spaces.`;
  if (!isCount(b.score, 1_000_000_000) || b.score === 0) return 'Invalid score.';
  if (!isCount(b.timeSec, 24 * 3600)) return 'Invalid time.';
  if (typeof b.cannon !== 'string' || !(CANNON_IDS as readonly string[]).includes(b.cannon)) {
    return 'Invalid cannon.';
  }
  return { name, score: b.score, timeSec: b.timeSec, cannon: b.cannon as CannonId };
}

/** True when a score would make the board (ties go to the earlier entry, so it must beat #51). */
export function qualifies(score: number, top: readonly ScoreEntry[]): boolean {
  if (score <= 0) return false;
  if (top.length < MAX_ENTRIES) return true;
  return score > top[MAX_ENTRIES - 1].score;
}
