# Stone Smash

An endless browser arcade game. Stones fall from the sky. Slide the cannon along the bottom and break them before they reach the ground. Big stones split into smaller ones. Built from [`docs/PLAN.md`](docs/PLAN.md).

```bash
npm install
npm run dev        # http://localhost:5173 (add ?debug=1 for the difficulty slider and HUD readout)
npm test           # sim unit tests + bot survival tests
npm run build      # typecheck + production build into dist/ (static, deploy anywhere)
```

Other scripts: `npm run test:bot` (bot tests only), `npm run tune` (difficulty-ceiling parameter sweep), `npm run test:e2e` (Playwright mobile smoke test; run `npx playwright install chromium` once first), `npm run lint`, `npm run format`.

## Deploy

`npm run build` writes a static site to `dist/` (about 360 KB gzipped). It uses relative paths, so it works at a domain root or in a subfolder (for example GitHub Pages project sites). No server code, environment variables or API keys are needed.

| Host                                | Build command                                                                    | Output folder |
| ----------------------------------- | -------------------------------------------------------------------------------- | ------------- |
| Netlify / Cloudflare Pages / Vercel | `npm run build`                                                                  | `dist`        |
| GitHub Pages                        | `npm run build`, then publish `dist` (e.g. with `actions/upload-pages-artifact`) | `dist`        |

**Cloudflare Workers (Workers Builds):** `wrangler.jsonc` serves `dist/` as static assets. In the project's build settings, set **Build command** to `npm run build` and keep **Deploy command** as `npx wrangler deploy`. If the build command is left empty, `dist/` is never created and the deploy fails.

Serve over HTTPS (all of these hosts do). Before going live, check `npm run preview` on a real phone on the same network (it prints a LAN URL).

## Architecture

- `src/sim/`: pure, deterministic TypeScript. It never imports Phaser, reads the clock, calls `Math.random`, or touches the DOM (ESLint enforces this). `step(world, input, dt)` advances one fixed 60 Hz tick and leaves events in `world.events`. All entities live in fixed-size pools, so `step` does not allocate.
- `src/game/`: Phaser scenes, rendering (pool-mirrored sprites with interpolation), effects, input, HUD, and synthesised audio. It reads the sim state and turns events into particles and sounds.
- `src/config/gameConfig.ts`: every tunable number.
- `src/utils/storage.ts`: safe `localStorage` wrapper (`ss.*` keys, versioned, with an in-memory fallback).

## Cannons and progression

- **Cannon ladder** (`CANNONS` in `gameConfig.ts`): Classic, Blaster, Twin, Storm, Titan. Each is visibly stronger (faster bullets, twin barrels, piercing). A cannon unlocks when you reach its goal (survive, total stones, score) **or** buy it early with coins. Unlocks and the selected cannon are saved on the device (`ss.cannons`, save version 2; older saves migrate automatically).
- **In-run levels:** smashing stones powers the cannon up during a run (Lv1, Lv2 at 25 stones, MAX at 70), with faster bullets and fire, a coloured glow and bullet colour. Losing a life drops one level. Every run starts at Lv1.
- The difficulty ceiling is tuned for **Classic**, so stronger cannons only make the game easier and are never required (plan rule).

## Mobile layout

The playfield is always 720x1280, so the sim is identical and fair on every device. On taller phones the canvas grows (`src/game/layout.ts`). Extra height goes first to a HUD band above the playfield, so the HUD never covers stones, then to thumb room below the ground. Drags start anywhere below the HUD and move the cannon relative to the finger. Turning a phone sideways shows a rotate message and pauses the run.

## Where it differs from the plan, and why

The plan says to tune the starting values against the bot test (`npm run tune` sweeps the ceiling; `npx tsx scripts/cannons.ts` checks every cannon). The bot chases the lowest stone with a 150 ms reaction delay. The current ceiling, tuned for Classic with in-run levels and phone-sized stones:

| Setting                         | Plan         | Now          |
| ------------------------------- | ------------ | ------------ |
| `difficulty.budgetHpPerSec.max` | 3.0          | 3.0          |
| `difficulty.fallSpeed.max`      | 350          | 300          |
| `difficulty.hpScale.max`        | 1.5          | 1.25         |
| `stone.splitSideSpeed`          | 140          | 100          |
| `stone.radii`                   | 40 / 28 / 18 | 46 / 33 / 23 |

With the plan's original numbers, the bot survived a median of 21 s at `d = 1`. Split children spread out and landed before one cannon could clear the family. Now, over 50 seeds with Classic, the median at `d = 1` is the full 10 minutes. At `d = 0.33`, the bot loses 0 lives. A 3-minute run earns about 28 coins (target 25 to 35). Twin, Storm and Titan never lose at `d = 1` in 10 minutes.

Other decisions the plan left open:

- **Stone colours** follow size: big purple, medium teal, small orange. Special types keep their own colour and markings. Colourblind mode uses an Okabe-Ito set.
- **Coins** pop out of broken big stones (and golden ones). Catching them is optional: any coin that lands is banked automatically. Without this, the economy fell short of the 25 to 35 coins per run target.
- **Power-ups** rest on the ground for 3 s before fading, so the player has time to grab them.
- **Special types** (bouncy, armored, bomb) apply to the spawned stone. Bouncy children stay bouncy; children of the other types are normal stones. A bomb blast does 2 damage within 170 px and can chain.
- The bot keeps its current target unless another stone is more than 60 px lower. Without this, it dithered between twin split children.
- Art and audio are generated in code, so there are no asset files and nothing to license (see `CREDITS.md`).
