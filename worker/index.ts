// Cloudflare Worker: serves the static game from dist/ and a tiny scoreboard API backed by D1.
//   GET  /api/scores  -> { scores: ScoreEntry[] }                 (top 51, best first)
//   POST /api/scores  -> { id, rank: number | null, scores }       (body: Submission JSON)
// Only the top 51 rows are kept; lower scores are deleted after each insert.

import { MAX_ENTRIES, parseSubmission, type ScoreEntry } from '../src/utils/scoreboard';

// Minimal D1 / assets types (avoids a separate types package for two bindings).
interface D1Result<T> {
  results: T[];
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  all<T>(): Promise<D1Result<T>>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
}
interface Env {
  /** Missing until the D1 database is created and bound in wrangler.jsonc. */
  DB?: D1Database;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS scores (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     score INTEGER NOT NULL,
     time_sec INTEGER NOT NULL,
     cannon TEXT NOT NULL,
     created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
   )`,
  `CREATE INDEX IF NOT EXISTS scores_by_score ON scores (score DESC, id ASC)`,
];

const TOP_SQL = `SELECT id, name, score, time_sec AS timeSec, cannon, created_at AS createdAt
                 FROM scores ORDER BY score DESC, id ASC LIMIT ?`;

// The table is created on first use, so a new database needs no manual setup step.
let schemaReady: Promise<unknown> | null = null;
function ensureSchema(db: D1Database): Promise<unknown> {
  schemaReady ??= db.batch(SCHEMA.map((sql) => db.prepare(sql))).catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

async function topScores(db: D1Database): Promise<ScoreEntry[]> {
  const { results } = await db.prepare(TOP_SQL).bind(MAX_ENTRIES).all<ScoreEntry>();
  return results;
}

async function handleScores(request: Request, db: D1Database): Promise<Response> {
  await ensureSchema(db);

  if (request.method === 'GET') return json({ scores: await topScores(db) });

  if (request.method === 'POST') {
    const text = await request.text();
    if (text.length > 1000) return json({ error: 'Body too large.' }, 413);
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      return json({ error: 'Body must be JSON.' }, 400);
    }
    const sub = parseSubmission(body);
    if (typeof sub === 'string') return json({ error: sub }, 400);

    const row = await db
      .prepare('INSERT INTO scores (name, score, time_sec, cannon) VALUES (?, ?, ?, ?) RETURNING id')
      .bind(sub.name, sub.score, sub.timeSec, sub.cannon)
      .first<{ id: number }>();
    // Keep only the top 51 (ties: the earlier entry stays).
    await db
      .prepare(
        'DELETE FROM scores WHERE id NOT IN (SELECT id FROM scores ORDER BY score DESC, id ASC LIMIT ?)',
      )
      .bind(MAX_ENTRIES)
      .run();

    const scores = await topScores(db);
    const index = row ? scores.findIndex((s) => s.id === row.id) : -1;
    return json({ id: row?.id ?? null, rank: index >= 0 ? index + 1 : null, scores });
  }

  return json({ error: 'Method not allowed.' }, 405);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/api/scores') {
      // No database bound yet: the game treats this like being offline and skips the scoreboard.
      if (!env.DB) return json({ error: 'Scoreboard not set up yet.' }, 503);
      try {
        return await handleScores(request, env.DB);
      } catch (err) {
        console.error('scoreboard error', err);
        return json({ error: 'Scoreboard unavailable.' }, 503);
      }
    }
    return env.ASSETS.fetch(request);
  },
};
