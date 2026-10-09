// Client for the world scoreboard API (worker/index.ts). Every call fails soft: on any network
// or server problem it returns null and the game carries on without the scoreboard.

import type { ScoreEntry, Submission } from '../utils/scoreboard';

const TIMEOUT_MS = 6000;

function apiUrl(): string {
  return new URL('api/scores', document.baseURI).toString();
}

async function request<T>(init?: RequestInit): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(apiUrl(), { ...init, signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function fetchScores(): Promise<ScoreEntry[] | null> {
  const data = await request<{ scores: ScoreEntry[] }>();
  return data?.scores ?? null;
}

export interface SubmitResult {
  id: number | null;
  rank: number | null;
  scores: ScoreEntry[];
}

export function submitScore(sub: Submission): Promise<SubmitResult | null> {
  return request<SubmitResult>({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(sub),
  });
}
