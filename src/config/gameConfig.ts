// Every tunable number lives here. Tune by playing at a fixed d (open the game with ?debug=1)
// and by re-running the bot test (`npm run test:bot`) after each change.

export const POWER_UP_KINDS = ['spread', 'rapid', 'pierce', 'shield', 'freeze', 'magnet'] as const;
export type PowerUpKind = (typeof POWER_UP_KINDS)[number];

export const STONE_TYPES = ['normal', 'golden', 'bouncy', 'armored', 'bomb'] as const;
export type StoneType = (typeof STONE_TYPES)[number];

// Stone sizes, biggest first. Each tier splits into two of the next one; Small just pops.
// Big, Medium and Small are there from the start; the giants unlock over time (see `giants`).
export const TIER = { titanRock: 0, mountain: 1, boulder: 2, big: 3, medium: 4, small: 5 } as const;
export const TIER_COUNT = 6;
export const BIG = TIER.big;
export const SMALLEST = TIER.small;
export const TIER_NAMES = ['Titan Rock', 'Mountain', 'Boulder', 'Big', 'Medium', 'Small'] as const;

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
    // Indexed by tier (Titan Rock .. Small). Sizes grow gently so giants still fit a phone screen.
    radii: [80, 70, 58, 46, 33, 23],
    baseHp: [14, 10, 7, 4, 2, 1],
    // Giants fall slower: they are heavy, menacing, and need many hits before they split.
    fallMult: [0.55, 0.65, 0.8, 1, 1, 1],
    settleAccel: 500, // px/s^2, how fast vy returns to fallSpeed after a pop
    splitPopSpeed: 260, // px/s upward on split
    giantPopMult: 1.9, // pieces of a giant pop this much higher, so they are not born near the ground
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
    // Weights for [big, medium, small], blended by d. Unlocked giants are added on top (see `giants`).
    tierWeights: { start: [0.6, 0.25, 0.15], max: [0.45, 0.3, 0.25] },
    // Chance that an unlocked special type (bouncy/armored/bomb) is picked, blended by d.
    specialChance: { start: 0.15, max: 0.35 },
  },

  // Giant tiers: a new, bigger stone every 2 minutes. Each splits into two of the previous biggest,
  // so a family grows in powers of 2 (Big = 7 stones, Boulder = 15, Mountain = 31, Titan Rock = 63).
  giants: {
    /** Unlock time per giant tier, indexed by tier (0 = Titan Rock, 1 = Mountain, 2 = Boulder). */
    unlockAt: [360, 240, 120],
    /** Pick weight once unlocked (the base weights add up to 1). */
    weight: [0.03, 0.05, 0.07],
    /** A giant may be bought on credit once the wallet holds this many seconds of budget,
     *  so an expensive family never causes a long empty pause before it arrives. */
    creditSec: 4,
  },

  // Overtime: after the curve flattens, difficulty keeps creeping up with no cap,
  // so even the strongest cannon's run eventually ends. The first minutes are unchanged.
  overtime: {
    startSec: 360,
    budgetPerMin: 0.3, // +30% HP budget per minute past the start
    fallPerMin: 10, // +10 px/s fall speed per minute...
    fallCap: 380, // ...up to this hard cap, so stones stay readable
    hpPerMin: 0.3, // +0.3 HP scale per minute: the on-screen stone cap limits how many stones
    // can be sent, so tougher stones are what keep raising the load for very strong cannons
  },

  waves: { pressureSec: 20, pressureFactor: 1.1, breatherSec: 8, breatherFactor: 0.4 },

  safety: { maxStonesOnScreen: 30, reachWindowSec: 0.8, reachMaxPx: 360, graceAfterLifeLostSec: 1 },

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

  score: {
    points: [100, 70, 50, 30, 20, 10],
    comboWindowSec: 1.5,
    comboStep: 0.1,
    comboMax: 3,
    timeMultPerMin: 0.1,
  },

  coins: { perBig: 1, perGolden: 10 },
  upgrades: {
    maxLevel: 5,
    costs: [25, 50, 100, 175, 275],
    fireRatePerLevel: 0.06,
    cannonSpeedPerLevel: 0.08,
    powerDurationPerLevel: 0.1,
  },

  pools: { bullets: 160, stones: 128, pickups: 48, events: 384 },

  health: { breakReminderSec: 30 * 60 },
} as const;

export type GameConfig = typeof CONFIG;
