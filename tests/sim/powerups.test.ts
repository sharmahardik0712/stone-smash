import { describe, expect, it } from 'vitest';
import { BIG, CONFIG, SMALLEST } from '../../src/config/gameConfig';
import { activatePowerUp } from '../../src/sim/powerups';
import { spawnStone } from '../../src/sim/stones';
import { createWorld, step } from '../../src/sim/world';

const dt = CONFIG.sim.step;
const idle = { targetX: 360, fire: false };

describe('power-ups and lives', () => {
  it('spread fires a 3-bullet fan', () => {
    const w = createWorld({ seed: 1 });
    activatePowerUp(w, 'spread');
    w.cannon.fireTimer = 0;
    step(w, { targetX: 360, fire: true }, dt);
    expect(w.bullets.countActive()).toBe(3);
  });

  it('re-picking refreshes the timer; upgrades lengthen it', () => {
    const w = createWorld({ seed: 1, upgrades: { fireRate: 0, cannonSpeed: 0, powerDuration: 2 } });
    activatePowerUp(w, 'rapid');
    w.power.timers.rapid = 1;
    activatePowerUp(w, 'rapid');
    expect(w.power.timers.rapid).toBeCloseTo(6 * 1.2);
  });

  it('shield absorbs one ground hit; later hits during invulnerability are free', () => {
    const w = createWorld({ seed: 1, manualFire: true });
    w.director.lastLifeLostT = 1e9; // block spawning
    activatePowerUp(w, 'shield');
    spawnStone(w, SMALLEST, 'normal', 100, CONFIG.groundY - 10, 0, 300);
    step(w, idle, dt);
    expect(w.lives).toBe(3);
    expect(w.power.shield).toBe(false);
    w.invulnerable = 0;
    spawnStone(w, SMALLEST, 'normal', 100, CONFIG.groundY - 10, 0, 300);
    step(w, idle, dt);
    expect(w.lives).toBe(2);
    spawnStone(w, SMALLEST, 'normal', 200, CONFIG.groundY - 10, 0, 300);
    step(w, idle, dt);
    expect(w.lives).toBe(2); // landed during invulnerability
  });

  it('freeze slows stones to 30%', () => {
    const w = createWorld({ seed: 1, fixedD: 1, manualFire: true });
    w.director.lastLifeLostT = 1e9;
    activatePowerUp(w, 'freeze');
    const s = spawnStone(w, BIG, 'normal', 100, 200, 0, 0)!;
    for (let i = 0; i < 120; i++) step(w, idle, dt);
    expect(s.vy).toBeCloseTo(CONFIG.difficulty.fallSpeed.max * CONFIG.powerUps.freezeFactor);
  });

  it('game over after the last life', () => {
    const w = createWorld({ seed: 1, manualFire: true });
    w.lives = 1;
    w.director.lastLifeLostT = 1e9;
    spawnStone(w, SMALLEST, 'normal', 100, CONFIG.groundY - 10, 0, 300);
    step(w, idle, dt);
    expect(w.gameOver).toBe(true);
  });

  it('touching a power-up with the cannon collects it', () => {
    const w = createWorld({ seed: 1, manualFire: true });
    w.director.lastLifeLostT = 1e9;
    const p = w.pickups.acquire()!;
    Object.assign(p, { kind: 'powerUp', powerUp: 'magnet', x: 360, y: CONFIG.cannon.y - 30, vx: 0, vy: 0 });
    p.radius = CONFIG.powerUps.radius;
    p.rest = 0;
    step(w, idle, dt);
    expect(w.power.timers.magnet).toBeGreaterThan(7);
  });
});
