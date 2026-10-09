# Stone Smash: Final Plan

An endless arcade game. Stones fall from the sky; you slide a cannon along the bottom and break them before they reach the ground. Big stones split into smaller ones. It gets harder over time, up to a ceiling, but never becomes impossible.

- **Audience:** ages 14 to 24. Tone: clean, bright arcade, not childish.
- **Platform:** browser, desktop and mobile, one code base.
- **Main mode:** Endless. Runs end because of player mistakes, not because the math makes survival impossible.

---

## 1. Design pillars

1. **Playing within 3 seconds.** No sign-up, no tutorial. The cannon fires automatically; the only control is moving left and right.
2. **Splitting is the hook.** Breaking a big stone should feel great, never like a punishment.
3. **Hard but always survivable.** Difficulty rises toward a fixed ceiling that a skilled player can survive forever.
4. **Fair.** Every lost life should feel like "my fault", never "that was impossible".
5. **Safe by design.** No accounts, chat, ads, tracking, or purchases.

---

## 2. Key decisions (and why)

| Decision | Choice | Reason |
|---|---|---|
| Ground rule | A stone touching the ground costs 1 life | Simple to read; matches "stones fall from the sky" |
| Fall model | Each stone falls at a capped speed, set by difficulty (no free-fall acceleration) | Free fall made stones land in about 2.6 s, which was unplayable |
| Splitting | Children pop **upward** and apart, then settle back to fall speed | A split buys time instead of costing it |
| Tiers | 3 sizes (big, medium, small) | 4 tiers created 8 tiny stones per big one, too much HP |
| Difficulty | Curve that flattens toward a ceiling | Endless without becoming unplayable |
| Spawning | Spends an **HP budget** per second (not "one stone every N seconds") | Splitting multiplies work; a budget accounts for that |
| Simulation | Fixed 60 Hz timestep, pure TypeScript, separate from Phaser | Deterministic, testable, enables a daily challenge later |
| Upgrades | Small, capped, and the difficulty ceiling is based on the **un-upgraded** cannon | Upgrades make the game easier, never required |
| Level mode | Moved to after v1 | Endless is the core; levels can reuse the same systems |

---

## 3. Player journey

| Time | What happens | What the player learns |
|---|---|---|
| 0:00 | Tap Play. The tap also unlocks audio. The cannon starts auto-firing | "I only need to move" |
| 0:03 | First big stone, HP 4, falls slowly down the middle | Numbers count down as I hit it |
| 0:05 | It **splits** into two that pop up and apart | "I have to break the whole family" (the hook) |
| 0:15 | Fast kills raise the pitch of the hit sound and show "x1.3" | Combos, taught by sound with no text |
| 0:30 | First power-up drops | Short bursts of power |
| ~1:00 | Bouncy stones appear | New stone types change how I play |
| ~1:30 | First life lost: soft "oops", combo resets | Mistakes cost something, but gently |
| 2:00 to 3:00 | Armored, then bomb stones; pressure and breather waves | Choosing which stone to shoot first |
| 3:00 to 6:00 | Difficulty climbs steeply, then flattens | Mastery |
| Game over | Score, best, coins, big **Play again** button | "One more go" |
| Between runs | Spend coins; the first upgrade is affordable after run 1 | A reason to come back |

---

## 4. Tech stack

- **Language:** TypeScript
- **Engine:** Phaser 3 for rendering, input, audio, and scenes. The simulation does **not** import Phaser.
- **Build:** Vite
- **Physics:** custom circle physics inside the simulation
- **Hosting:** static (GitHub Pages, Netlify, or Cloudflare Pages)
- **Testing:** Vitest (simulation and bot), Playwright (mobile smoke test)
- **Lint/format:** ESLint + Prettier

---

## 5. Project structure

```
stone-smash/
├── index.html
├── vite.config.ts
├── public/assets/              # atlas, sounds, fonts
├── src/
│   ├── main.ts                 # Phaser boot
│   ├── config/
│   │   └── gameConfig.ts       # ALL tunable numbers
│   ├── sim/                    # pure TS, no Phaser, deterministic
│   │   ├── world.ts            # World state + step(dt, input)
│   │   ├── cannon.ts
│   │   ├── bullets.ts
│   │   ├── stones.ts           # movement, splitting, types
│   │   ├── powerups.ts
│   │   ├── collision.ts        # circle vs circle, walls, ground
│   │   ├── director.ts         # difficulty curve, budget, waves, fairness
│   │   ├── scoring.ts          # points, combo, time multiplier, coins
│   │   ├── events.ts           # "stoneSplit", "lifeLost" ... for render/audio
│   │   ├── pool.ts             # object pools
│   │   └── rng.ts              # seeded RNG
│   ├── game/                   # Phaser side: reads sim state, draws it
│   │   ├── scenes/             # Boot, Menu, Game, Pause, GameOver, Shop, Settings
│   │   ├── render/             # sprites, interpolation
│   │   ├── effects.ts          # particles, shake, hit-stop, floating text
│   │   ├── input.ts            # keyboard/mouse/touch -> targetX
│   │   ├── hud.ts
│   │   └── audio.ts
│   └── utils/
│       └── storage.ts          # safe localStorage wrapper
└── tests/
    ├── sim/                    # unit tests
    └── bot/                    # auto-player survival tests
```

**Rule:** `sim/` never reads the clock, `Math.random`, or the DOM. It takes `(state, input, dt)` and returns events. The Phaser layer turns events into particles and sounds.

---

## 6. Game loop

```
render frame (real time):
  accumulator += min(frameTime, 0.1)
  while accumulator >= STEP (1/60) and steps < 5:
      sim.step(STEP, input)        # deterministic
      accumulator -= STEP
  render(state, alpha = accumulator / STEP)   # interpolate positions
  play effects/sounds for events emitted this frame

sim.step:
  1. cannon: move toward targetX, tick fire timer, spawn bullets
  2. bullets: move up, despawn off-screen
  3. stones: vy eases toward fallSpeed, x += vx, bounce off side walls
  4. power-ups and coins: fall, magnet pull, pickup at cannon
  5. collisions: bullet vs stone, stone vs ground
  6. resolve: damage, split, score, combo, drops
  7. director: update difficulty, spend budget, spawn
```

---

## 7. Game objects and rules

### 7.1 Cannon
- Slides along the bottom: `x += clamp(targetX - x, -maxSpeed*dt, maxSpeed*dt)`.
- Auto-fire every `fireInterval`. Optional "hold to fire" setting.
- Takes 0.8 s to cross the full width (720 px at 900 px/s). The spawner's fairness rules rely on this.

### 7.2 Bullets
- Straight up at constant speed. Removed on hit (unless piercing) or off-screen. Pooled.

### 7.3 Stones

```ts
interface Stone {
  x: number; y: number; vx: number; vy: number;
  tier: 0 | 1 | 2;          // 0 = big
  radius: number;           // 40 / 28 / 18
  hp: number; armor: number;
  type: 'normal' | 'bouncy' | 'armored' | 'bomb' | 'golden';
}
```

- **Falling:** `vy = min(vy + settleAccel*dt, fallSpeed)`. Stones accelerate briefly after a pop, then never fall faster than the current `fallSpeed`.
- **Walls:** reflect `vx` and nudge the stone back inside.
- **Ground:** costs 1 life (none during invulnerability); the stone pops harmlessly.
- **Splitting:** at HP 0, tiers 0 and 1 split into 2 stones of the next tier, each with `vx = ±splitSideSpeed` and `vy = -splitPopSpeed`. Tier 2 just pops.
- **Base HP:** 4 / 2 / 1, so one big stone is **12 HP of total work** (4 + 2×2 + 4×1), multiplied by `hpScale`.
- **Stones pass through each other** (no stone-vs-stone collision).

### 7.4 Stone types (unlocked by time survived)

| Type | Behavior | Appears from | Budget cost |
|---|---|---|---|
| normal | Plain | 0:00 | tree HP |
| golden | Drops 10 coins and a power-up | 0:30, rare (3%) | tree HP |
| bouncy | Larger sideways speed, lively wall bounces | 1:00 | tree HP × 1.2 |
| armored | Blue ring armor (+2 HP) that must break first | 2:00 | tree HP + 2 |
| bomb | Blast on death damages nearby stones (never the cannon) | 3:00 | tree HP × 0.8 (it helps the player) |

### 7.5 Power-ups
Dropped by 8% of big and medium kills, and always by golden stones. They fall slowly; collect them by touching them with the cannon.

| Power-up | Effect | Duration |
|---|---|---|
| Spread | 3-bullet fan | 8 s |
| Rapid | Fire rate x2 | 6 s |
| Pierce | Bullets pass through 1 extra stone | 8 s |
| Shield | Absorbs one ground hit | Until used |
| Freeze | Stones fall at 30% speed | 4 s |
| Magnet | Pulls coins and power-ups to the cannon | 8 s |

Picking up one that's already active refreshes its timer. Each active power-up shows a timer ring in the HUD.

### 7.6 Lives
- 3 lives, 1.5 s invulnerability after a loss, combo resets.

---

## 8. Endless difficulty (the director)

### 8.1 Difficulty curve

```ts
d = 1 - Math.exp(-t / tau)    // tau = 150 s; d rises from 0 toward 1, never above
value = lerp(start, max, d)   // for every difficulty setting
```

| Time | d | Feel |
|---|---|---|
| 0:00 | 0.00 | Calm |
| 1:00 | 0.33 | Busy |
| 3:00 | 0.70 | Hard |
| 6:00 | 0.91 | Very hard |
| 10:00+ | ~1.0 | Plateau (the ceiling) |

### 8.2 HP budget (the core rule)

The director measures load in **HP per second**, not stones per second:

```
budget per second (at the ceiling)  ≤  0.85 × the base cannon's effective damage per second
```

- Base cannon: 1 damage every 180 ms = 5.5 damage/s. At about 65% useful hits, that's **about 3.6 effective damage/s**.
- Ceiling budget: **3.0 HP/s**. Starting budget: **1.2 HP/s**.
- Each tick the director adds `budget * waveFactor * dt` to a wallet. When the wallet can pay for a stone (its tree HP × `hpScale` × type cost), it buys one. The size and type are chosen with the seeded RNG, weighted by `d`.

### 8.3 Waves (variation on the plateau)

| Phase | Length | Budget factor |
|---|---|---|
| Pressure | 20 s | × 1.1 (slightly over the average, still under capacity) |
| Breather | 8 s | × 0.4 |

The average stays around 0.9 of the ceiling budget. The rhythm of tension and relief is what keeps the plateau from getting boring.

### 8.4 Safety valves (guarantees against an unplayable game)

1. **Fall-speed cap:** 350 px/s, so a stone always takes about 3.5 s or more to cross the screen.
2. **On-screen cap:** at 25 or more stones, the director stops spending until the count drops.
3. **Reachability:** two spawns within 0.8 s of each other must be at most 360 px apart.
4. **No spawn within 1 s** of the player losing a life.

### 8.5 What keeps growing after the plateau
- **Time multiplier** on score: `1 + 0.1 × minutes survived`, uncapped. Long runs pull ahead on the leaderboard even though the difficulty stays flat.
- **Mix variety:** combinations of armored, bomb, and bouncy stones.

---

## 9. Scoring and progression

- **Points per stone:** big 30, medium 20, small 10.
- **Combo:** each kill within 1.5 s of the previous one adds +1. The combo multiplier is `1 + 0.1 × combo`, capped at x3. It resets on life loss.
- **Score per kill:** `points × combo multiplier × time multiplier`.
- **Coins:** 1 per big stone, 10 per golden stone. A typical 3-minute run earns about 25 to 35 coins.
- **Upgrades** (5 levels each; costs 25 / 50 / 100 / 175 / 275):
  - Fire rate: −6% interval per level
  - Cannon speed: +8% per level
  - Power-up duration: +10% per level
- No damage upgrade. It would trivialize the HP budget.
- **Saved stats:** high score, best combo, longest run, total stones smashed, coins.

---

## 10. Input

| Device | Move | Fire |
|---|---|---|
| Keyboard | Left/Right or A/D | Auto (Space in manual mode) |
| Mouse | Cannon follows pointer x | Auto (click in manual mode) |
| Touch | Drag anywhere in the bottom 40% of the screen | Auto |

- Every input method is normalized to a single `targetX`, using pointer events so mouse and touch share one code path.
- Add `touch-action: none` and prevent scrolling and zooming.
- The cannon sits slightly above the finger so it stays visible.

---

## 11. Safety, privacy, and accessibility

| Area | Rule |
|---|---|
| Content | Rocks and meteors only; no blood; positive copy ("Nice!", "Try again") |
| Data | No accounts, analytics, or ad SDKs. Only `localStorage` is used, which covers GDPR-K, COPPA, and DPDP concerns |
| Monetization | None in v1. Never loot boxes |
| Health | Gentle break reminder after 30 minutes; flashes stay under 3 per second |
| Accessibility | HP shown as numbers; colorblind-safe palette; screen shake slider; mute; touch targets ≥ 44 px |

---

## 12. Juice (in order of payoff)

1. Hit-sound pitch rises with each combo step
2. Rock-chip particles on every hit
3. Split pop: a short squash and a burst of dust
4. Screen shake on big breaks (adjustable)
5. Hit-stop of about 40 ms on big breaks
6. Floating score text
7. Cannon recoil and tilt
8. Short slow-motion on bomb chain reactions

---

## 13. Screens

| Screen | Contents |
|---|---|
| Menu | Play (big), Upgrades, Settings, best score |
| HUD | Score, combo meter, hearts, power-up rings, time, pause |
| Pause | Resume, Restart, Sound, Quit |
| Game over | Score, best, time survived, coins earned, **Play again** (largest), Upgrades |
| Settings | Sound, music, shake, fire mode, colorblind mode |

Keep the important buttons in the lower half of the screen for one-thumb play. Restart takes one tap.

---

## 14. Audio

- Sound effects: shoot, hit (pitched), split, break, bomb, power-up, coin, life lost, game over.
- Looping music; the mute setting is remembered.
- Unlock audio on the first tap or key press.
- Use only original, CC0, or licensed assets, recorded in `CREDITS.md`.

---

## 15. Persistence

A safe `localStorage` wrapper with try/catch and fallbacks. Keys: `ss.version`, `ss.stats`, `ss.settings`, `ss.coins`, `ss.upgrades`. Migrate old saves based on `ss.version`.

---

## 16. Performance

- Pools for bullets, stones, particles, and coins; no allocations in `step`.
- At most 150 particles (fewer on low-end devices); one texture atlas.
- Logical resolution 720×1280 portrait with `Scale.FIT`.
- Pause on `visibilitychange` and `blur`.
- Targets: 60 FPS on a mid-range phone, under 2 MB download, interactive in under 3 s on 4G.

---

## 17. Testing

**Unit tests (Vitest, `sim/` only):**
- Split math: tier, HP, pop velocity
- Score, combo, and time multiplier
- Director: the budget never exceeds `max × 1.1`, the on-screen cap holds, the reachability rule holds
- Determinism: same seed + same input log gives the same final state hash
- Storage fallback when `localStorage` throws

**Bot tests (the "never unplayable" proof):**
- A simple auto-player chases the lowest stone and has a 150 ms reaction delay.
- Run it headless with a fixed `d = 1` for 10 simulated minutes, across 50 seeds.
- **Pass:** the median survival time is 5 minutes or more. The bot is worse than a focused human, so if the bot can survive, a person can too.
- **Also check:** with `d = 0.33`, the bot should almost never lose a life (the first minute should be easy).

**Smoke test (Playwright, mobile viewport):** start a run, drag, see the score increase, reach game over, restart.

**Playtests:** at least 5 people aged 14 to 24. Watch the first 30 seconds (do they understand?), the first life lost (does it feel fair?), and whether they choose to play again.

**Devices:** a low-end Android phone, a recent iPhone, and a laptop with Chrome, Safari, and Firefox.

---

## 18. Milestones

| # | Milestone | Scope | Done when |
|---|---|---|---|
| M1 | Core and split | Fixed-step sim, cannon, auto-fire, falling stones, HP numbers, **splitting**, lives, score, game over | A full run is playable on keyboard and touch, and splitting feels good |
| M2 | Director | Curve, HP budget, waves, safety valves, bot test | The bot passes; a new player's run lasts 2 to 4 minutes |
| M3 | Stone types | Golden, bouncy, armored, bomb, unlocked by time | Each type shows up at its time and changes how you play |
| M4 | Power-ups | Drops, pickups, HUD rings | All 6 work |
| M5 | Juice and audio | Effects list, sounds, music | Playtesters say it "feels good" |
| M6 | Screens and settings | Menu, pause, settings, accessibility, persistence | Settings persist, no blocking bugs |
| M7 | Meta | Coins, upgrades shop, stats | The first upgrade is affordable after run 1 |
| M8 | Launch | Performance pass, cross-device testing, credits, deploy | Public URL that runs well on target devices |

---

## 19. After v1

- **Daily challenge:** same seed for everyone, best score kept locally. This works because the sim is deterministic.
- Level mode with boss stones, reusing the director with scripted budgets.
- Themes: space, cave, castle.
- Local two-player mode.
- Online leaderboard, only after a privacy review for under-18 players.

---

## 20. Config (starting values)

```ts
export const CONFIG = {
  width: 720, height: 1280,
  sim: { step: 1 / 60, maxStepsPerFrame: 5 },

  cannon: { maxSpeed: 900, fireInterval: 0.18, bulletSpeed: 1100, bulletDamage: 1 },

  stone: {
    radii: [40, 28, 18],
    baseHp: [4, 2, 1],
    settleAccel: 500,        // px/s^2, how fast vy returns to fallSpeed after a pop
    splitPopSpeed: 260,      // px/s upward on split
    splitSideSpeed: 140,     // px/s sideways on split
    bouncySideSpeed: 220,
    armorHp: 2,
  },

  difficulty: {
    tau: 150,                                  // seconds
    budgetHpPerSec: { start: 1.2, max: 3.0 },
    fallSpeed:      { start: 90,  max: 350 },  // px/s
    hpScale:        { start: 1.0, max: 1.5 },
  },

  waves: { pressureSec: 20, pressureFactor: 1.1, breatherSec: 8, breatherFactor: 0.4 },

  safety: { maxStonesOnScreen: 25, reachWindowSec: 0.8, reachMaxPx: 360, graceAfterLifeLostSec: 1 },

  unlocks: { goldenAt: 30, bouncyAt: 60, armoredAt: 120, bombAt: 180, goldenChance: 0.03 },

  powerUps: { dropChance: 0.08, fallSpeed: 120 },

  lives: 3,
  invulnerabilitySec: 1.5,

  score: { points: [30, 20, 10], comboWindowSec: 1.5, comboStep: 0.1, comboMax: 3, timeMultPerMin: 0.1 },

  coins: { perBig: 1, perGolden: 10 },
  upgrades: { maxLevel: 5, costs: [25, 50, 100, 175, 275] },
};
```

Every number lives here. Tune by playing at a fixed `d` (add a debug slider) and by re-running the bot test after each change.
