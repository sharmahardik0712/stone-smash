import Phaser from 'phaser';
import { CONFIG, type CannonDef } from '../../config/gameConfig';
import { liveStats, newlyEarned, withUnlocked } from '../../utils/progress';
import { createWorld, step, type World } from '../../sim/world';
import { app } from '../app';
import { applyLayout, isPhoneLandscape } from '../layout';
import { Effects } from '../effects';
import { Hud } from '../hud';
import { InputController } from '../input';
import { LEVEL_COLORS, POWER_COLORS, POWER_LABELS } from '../palette';
import { WorldRenderer } from '../render/worldRenderer';
import { drawSky, label } from '../ui';

export interface RunResult {
  score: number;
  timeSec: number;
  coins: number;
  kills: number;
  bestCombo: number;
  newBest: boolean;
  /** Cannons unlocked during this run (by reaching their goal). */
  unlocked: CannonDef[];
}

const STEP = CONFIG.sim.step;
const COMBO_CHEERS: Record<number, string> = { 5: 'Nice!', 10: 'Great!', 15: 'Awesome!', 20: 'Unstoppable!' };

export class GameScene extends Phaser.Scene {
  private world!: World;
  private view!: WorldRenderer;
  private effects!: Effects;
  private hud!: Hud;
  private controls!: InputController;
  private acc = 0;
  private ending = false;
  private hint: Phaser.GameObjects.Text | null = null;
  private debugSlider: HTMLInputElement | null = null;
  private lastCoinSound = 0;
  private onVisibility = () => {
    if (document.hidden) this.pauseGame();
  };
  private onBlur = () => this.pauseGame();
  /** Turning a phone sideways pauses the run (a rotate message covers the screen). */
  private onResize = () => {
    if (isPhoneLandscape()) this.pauseGame();
  };

  constructor() {
    super('Game');
  }

  create(data: { seed?: number; fixedD?: number | null }): void {
    applyLayout(this, 'game');
    drawSky(this);

    const seed = data.seed ?? (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0;
    this.world = createWorld({
      seed,
      upgrades: app.storage.getUpgrades(),
      manualFire: app.settings.fireMode === 'manual',
      cannon: app.storage.getCannons().selected,
      fixedD: data.fixedD ?? null,
    });
    this.acc = 0;
    this.ending = false;
    this.unlockedThisRun = [];
    this.view = new WorldRenderer(this, this.world);
    this.effects = new Effects(this);
    this.controls = new InputController(this, () => this.world.cannon.x);
    this.hud = new Hud(this, () => this.pauseGame(), app.debug);

    app.unlockAudio();

    if (app.storage.getStats().runs < 3) {
      const isTouch = this.sys.game.device.input.touch;
      this.hint = label(
        this,
        CONFIG.width / 2,
        CONFIG.height - 220,
        isTouch ? 'Drag anywhere to move' : 'Move with mouse or ← →',
        34,
      ).setDepth(60);
      this.tweens.add({ targets: this.hint, alpha: 0.4, yoyo: true, repeat: -1, duration: 600 });
    }

    this.input.keyboard?.on('keydown-ESC', () => this.pauseGame());
    this.input.keyboard?.on('keydown-P', () => this.pauseGame());
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('resize', this.onResize);
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.acc = 0;
      this.controls.reset(this.world.cannon.x);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    if (app.debug) this.setupDebug();
  }

  private cleanup(): void {
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('resize', this.onResize);
    this.debugSlider?.parentElement?.remove();
    this.debugSlider = null;
  }

  private pauseGame(): void {
    if (this.ending || !this.scene.isActive()) return;
    this.scene.pause();
    this.scene.launch('Pause');
  }

  update(_time: number, delta: number): void {
    const realDt = Math.min(delta / 1000, 0.1);
    this.effects.update(realDt);
    const w = this.world;

    if (!w.gameOver) {
      app.sessionPlaySec += realDt;
      this.checkBreakReminder();
      if (w.tick % 30 === 0) this.checkUnlocks();
      if (this.effects.hitStop <= 0) this.acc += realDt * this.effects.timeScale;
      let steps = 0;
      while (this.acc >= STEP && steps < CONFIG.sim.maxStepsPerFrame) {
        step(w, this.controls.update(), STEP);
        this.handleEvents();
        this.acc -= STEP;
        steps++;
        if (w.gameOver) break;
      }
      if (steps === CONFIG.sim.maxStepsPerFrame) this.acc = 0; // never spiral after a long frame
    }

    if (this.hint && this.controls.moved) {
      const h = this.hint;
      this.hint = null;
      this.tweens.killTweensOf(h);
      this.tweens.add({ targets: h, alpha: 0, duration: 400, onComplete: () => h.destroy() });
    }

    this.view.draw(w, Math.min(1, this.acc / STEP), realDt);
    this.hud.update(w);

    if (w.gameOver && !this.ending) this.endRun();
  }

  private handleEvents(): void {
    const q = this.world.events;
    const audio = app.audio;
    const fx = this.effects;
    for (let i = 0; i < q.count; i++) {
      const e = q.items[i];
      switch (e.type) {
        case 'shot':
          this.view.shot();
          audio.shoot();
          break;
        case 'stoneHit':
          this.view.hitStone(e.id);
          fx.hitChips(e.x, e.y, e.tier, e.stoneType);
          audio.hit(this.world.score.combo);
          break;
        case 'armorBreak':
          this.view.hitStone(e.id);
          fx.armorBreak(e.x, e.y);
          audio.armor();
          break;
        case 'stoneSplit':
          fx.splitBurst(e.x, e.y, e.tier, e.stoneType);
          audio.split(e.tier, e.combo);
          break;
        case 'stonePop':
          fx.popBurst(e.x, e.y, e.stoneType);
          audio.pop(e.combo);
          break;
        case 'bombBlast':
          fx.bomb(e.x, e.y, e.value);
          audio.bomb();
          break;
        case 'score': {
          const big = e.tier === 0;
          fx.floatText(e.x, e.y - 30, `+${e.value}`, e.combo > 0 ? '#ffe08a' : '#ffffff', big ? 36 : 28);
          const cheer = COMBO_CHEERS[e.combo];
          if (cheer) fx.floatText(CONFIG.width / 2, 300, cheer, '#ffd166', 56);
          break;
        }
        case 'groundHit':
          fx.groundHit(e.x);
          break;
        case 'lifeLost':
          fx.lifeLost(e.x);
          if (e.value > 0) fx.floatText(e.x, CONFIG.groundY - 80, 'Oops!', '#ffb3b3', 40);
          audio.lifeLost();
          break;
        case 'shieldUsed':
          fx.floatText(e.x, CONFIG.groundY - 80, 'Blocked!', '#9cc7ff', 40);
          fx.sparkle(e.x, CONFIG.groundY - 10, POWER_COLORS.shield);
          audio.shield();
          break;
        case 'powerUpPicked':
          fx.floatText(e.x, e.y - 50, POWER_LABELS[e.powerUp], '#ffffff', 40);
          fx.sparkle(e.x, e.y, POWER_COLORS[e.powerUp]);
          audio.powerUp();
          break;
        case 'coinPicked':
          fx.sparkle(e.x, e.y, 0xffcf3f);
          if (this.time.now - this.lastCoinSound > 60) {
            this.lastCoinSound = this.time.now;
            audio.coin();
          }
          break;
        case 'levelUp':
          fx.floatText(
            e.x,
            CONFIG.cannon.y - 130,
            e.value >= 3 ? 'MAX POWER!' : 'LEVEL UP!',
            '#' + LEVEL_COLORS[e.value - 1].toString(16).padStart(6, '0'),
            52,
          );
          fx.sparkle(e.x, CONFIG.cannon.y - 30, LEVEL_COLORS[e.value - 1]);
          audio.levelUp(e.value);
          break;
        case 'levelDown':
          fx.floatText(e.x, CONFIG.cannon.y - 130, `Lv${e.value}`, '#c9cdf0', 34);
          break;
        case 'gameOver':
          audio.gameOver();
          break;
      }
    }
  }

  private endRun(): void {
    this.ending = true;
    const w = this.world;
    const storage = app.storage;
    const stats = storage.getStats();
    const newBest = w.score.score > stats.highScore;
    storage.setStats({
      highScore: Math.max(stats.highScore, w.score.score),
      bestCombo: Math.max(stats.bestCombo, w.score.bestCombo),
      longestRunSec: Math.max(stats.longestRunSec, w.t),
      totalStones: stats.totalStones + w.score.kills,
      runs: stats.runs + 1,
    });
    storage.setCoins(storage.getCoins() + w.coins);
    this.checkUnlocks(); // stats are saved now, so this also catches goals met on the last frame
    const result: RunResult = {
      score: w.score.score,
      timeSec: w.t,
      coins: w.coins,
      kills: w.score.kills,
      bestCombo: w.score.bestCombo,
      newBest,
      unlocked: this.unlockedThisRun,
    };
    this.time.delayedCall(1100, () => this.scene.start('GameOver', result));
  }

  private unlockedThisRun: CannonDef[] = [];

  /** Unlocks any cannon whose goal the player just reached, saves it at once, and celebrates. */
  private checkUnlocks(): void {
    const w = this.world;
    const save = app.storage.getCannons();
    const saved = app.storage.getStats();
    // After endRun the run is already folded into the saved stats.
    const stats = this.ending
      ? liveStats(saved, 0, 0, 0)
      : liveStats(saved, w.t, w.score.kills, w.score.score);
    const earned = newlyEarned(save, stats);
    if (earned.length === 0) return;
    app.storage.setCannons(
      withUnlocked(
        save,
        earned.map((c) => c.id),
      ),
    );
    for (const c of earned) {
      this.unlockedThisRun.push(c);
      if (!this.ending) {
        const t = label(
          this,
          CONFIG.width / 2,
          330,
          `New cannon unlocked!
${c.name}`,
          44,
          '#ffd166',
        ).setDepth(70);
        this.tweens.add({ targets: t, scale: { from: 0.5, to: 1 }, duration: 300, ease: 'Back.Out' });
        this.tweens.add({ targets: t, alpha: 0, delay: 2200, duration: 500, onComplete: () => t.destroy() });
        app.audio.powerUp();
      }
    }
  }

  private checkBreakReminder(): void {
    if (app.breakReminderShown || app.sessionPlaySec < CONFIG.health.breakReminderSec) return;
    app.breakReminderShown = true;
    const t = label(
      this,
      CONFIG.width / 2,
      260,
      "You've played for 30 minutes.\nMaybe time for a quick stretch?",
      30,
      '#ffffff',
    )
      .setDepth(70)
      .setAlpha(0);
    this.tweens.add({
      targets: t,
      alpha: 1,
      duration: 400,
      hold: 5000,
      yoyo: true,
      onComplete: () => t.destroy(),
    });
  }

  /** ?debug=1: pin difficulty with a slider and expose hooks for the smoke test. */
  private setupDebug(): void {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;left:8px;bottom:8px;z-index:20;background:#1f2340cc;color:#fff;padding:6px 10px;border-radius:10px;font:12px system-ui';
    wrap.innerHTML = '<label>d <input type="range" min="-1" max="100" value="-1"> <span>auto</span></label>';
    const input = wrap.querySelector('input') as HTMLInputElement;
    const span = wrap.querySelector('span') as HTMLSpanElement;
    input.addEventListener('input', () => {
      const v = Number(input.value);
      this.world.director.fixedD = v < 0 ? null : v / 100;
      span.textContent = v < 0 ? 'auto' : (v / 100).toFixed(2);
    });
    document.body.appendChild(wrap);
    this.debugSlider = input;
    (window as unknown as { __stoneSmash: unknown }).__stoneSmash = {
      world: () => this.world,
      forceGameOver: () => {
        this.world.lives = 1;
        this.world.invulnerable = 0;
        this.world.power.shield = false;
        const s = this.world.stones.acquire();
        if (s) {
          Object.assign(s, {
            id: 999999,
            x: 360,
            y: CONFIG.groundY,
            px: 360,
            py: CONFIG.groundY,
            vx: 0,
            vy: 0,
          });
          Object.assign(s, { tier: 2, radius: 18, hp: 1, maxHp: 1, armor: 0, type: 'normal' });
        }
      },
    };
  }
}
