// Every tunable number lives here. Tune by playing at a fixed d (open the game with ?debug=1)
// and by re-running the bot test (`npm run test:bot`) after each change.

export const POWER_UP_KINDS = ['spread', 'rapid', 'pierce', 'shield', 'freeze', 'magnet'] as const;
export type PowerUpKind = (typeof POWER_UP_KINDS)[number];

export const STONE_TYPES = ['normal', 'golden', 'bouncy', 'armored', 'bomb'] as const;
export type StoneType = (typeof STONE_TYPES)[number];

export const CANNON_IDS = ['classic', 'blaster', 'twin', 'storm', 'titan'] as const;
export type CannonId = (typeof CANNON_IDS)[number];

export type UnlockGoal =
  | { kind: 'start' }
  | { kind: 'surviveSec'; value: number }
  | { kind: 'totalStones'; value: number }
  | { kind: 'score'; value: number };

export interface CannonDef {
  id: CannonId;
  name: string;
  /** Multiplies bullet speed. */
  bulletSpeed: number;
  /** Multiplies the time between shots (lower = faster). */
  fireInterval: number;
  barrels: 1 | 2;
  /** Extra stones every bullet passes through. */
  pierce: number;
  /** Unlocks when the goal is reached OR when bought for this many coins. */
  goal: UnlockGoal;
  coins: number;
}

// The permanent cannon ladder. Each step is visibly stronger. The difficulty ceiling is tuned
// for Classic, so every cannon only makes the game easier, never required.
export const CANNONS: readonly CannonDef[] = [
  {
    id: 'classic',
    name: 'Classic',
    bulletSpeed: 1,
    fireInterval: 1,
    barrels: 1,
    pierce: 0,
    goal: { kind: 'start' },
    coins: 0,
  },
  {
    id: 'blaster',
    name: 'Blaster',
    bulletSpeed: 1.25,
    fireInterval: 0.95,
    barrels: 1,
    pierce: 0,
    goal: { kind: 'surviveSec', value: 90 },
    coins: 60,
  },
  {
    id: 'twin',
    name: 'Twin',
    bulletSpeed: 1.25,
    fireInterval: 1.25,
    barrels: 2,
    pierce: 0,
    goal: { kind: 'totalStones', value: 400 },
    coins: 150,
  },
  {
    id: 'storm',
    name: 'Storm',
    bulletSpeed: 1.4,
    fireInterval: 1.1,
    barrels: 2,
    pierce: 0,
    goal: { kind: 'score', value: 8000 },
    coins: 300,
  },
  {
    id: 'titan',
    name: 'Titan',
    bulletSpeed: 1.5,
    fireInterval: 1.15,
    barrels: 2,
    pierce: 1,
    goal: { kind: 'surviveSec', value: 300 },
    coins: 600,
  },
];

export function cannonDef(id: CannonId): CannonDef {
  return CANNONS.find((c) => c.id === id) ?? CANNONS[0];
}

export const CONFIG = {
  width: 720,
  height: 1280,
  groundY: 1200, // stones whose bottom reaches this line hit the ground
  sim: { step: 1 / 60, maxStepsPerFrame: 5 },

  cannon: {
    maxSpeed: 900,
    fireInterval: 0.18,
    bulletSpeed: 1100,
    bulletDamage: 1,
    bulletRadius: 7,
    y: 1150, // cannon centre
    muzzleOffset: 46,
    halfWidth: 42,
    spreadAngleDeg: 12,
    barrelGap: 14, // px between the centre and each barrel of a twin cannon
  },

  // In-run level-ups: smashing stones powers the cannon up during a run.
  // Losing a life drops one level; every run starts at level 1.
  runLevels: {
    /** Stones smashed (total this run, adjusted on level loss) needed to reach level 2 and level 3. */
    thresholds: [0, 25, 70],
    bulletSpeed: [1, 1.15, 1.3],
    fireInterval: [1, 0.92, 0.85],
  },

  stone: {
    radii: [46, 33, 23], // big enough to read on a phone
    baseHp: [4, 2, 1],
    settleAccel: 500, // px/s^2, how fast vy returns to fallSpeed after a pop
    splitPopSpeed: 260, // px/s upward on split
    splitSideSpeed: 100, // px/s sideways on split (plan: 140; tuned by the bot test, see README)
    driftSpeed: 30, // max random sideways speed for a plain stone
    bouncySideSpeed: 220,
    armorHp: 2,
    bombRadius: 170,
    bombDamage: 2,
  },

  difficulty: {
    tau: 150, // seconds
    budgetHpPerSec: { start: 1.2, max: 3.0 },
    fallSpeed: { start: 90, max: 300 }, // px/s; plan: max 350
    hpScale: { start: 1.0, max: 1.25 }, // plan: max 1.5
    // Tier weights [big, medium, small], blended by d.
    tierWeights: { start: [0.6, 0.25, 0.15], max: [0.45, 0.3, 0.25] },
    // Chance that an unlocked special type (bouncy/armored/bomb) is picked, blended by d.
    specialChance: { start: 0.15, max: 0.35 },
  },

  waves: { pressureSec: 20, pressureFactor: 1.1, breatherSec: 8, breatherFactor: 0.4 },

  safety: { maxStonesOnScreen: 25, reachWindowSec: 0.8, reachMaxPx: 360, graceAfterLifeLostSec: 1 },

  unlocks: { goldenAt: 30, bouncyAt: 60, armoredAt: 120, bombAt: 180, goldenChance: 0.03 },

  typeCost: { bouncyMult: 1.2, bombMult: 0.8 },

  powerUps: {
    dropChance: 0.08,
    fallSpeed: 120,
    radius: 26,
    restSec: 3, // pickups rest on the ground this long before fading
    durations: { spread: 8, rapid: 6, pierce: 8, shield: 0, freeze: 4, magnet: 8 } as Record<
      PowerUpKind,
      number
    >,
    freezeFactor: 0.3,
    magnetAccel: 2600,
    rapidFactor: 0.5,
  },

  coin: { radius: 14, fallSpeed: 160, popSpeed: 220 },

  lives: 3,
  invulnerabilitySec: 1.5,

  score: { points: [30, 20, 10], comboWindowSec: 1.5, comboStep: 0.1, comboMax: 3, timeMultPerMin: 0.1 },

  coins: { perBig: 1, perGolden: 10 },
  upgrades: {
    maxLevel: 5,
    costs: [25, 50, 100, 175, 275],
    fireRatePerLevel: 0.06,
    cannonSpeedPerLevel: 0.08,
    powerDurationPerLevel: 0.1,
  },

  pools: { bullets: 160, stones: 96, pickups: 48, events: 256 },

  health: { breakReminderSec: 30 * 60 },
} as const;

export type GameConfig = typeof CONFIG;
