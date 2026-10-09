import { describe, expect, it } from 'vitest';
import { BIG, CONFIG, SMALLEST, TIER } from '../../src/config/gameConfig';
import { damageStone, resolveBlasts, spawnStone, stoneCost, stoneHp, treeHp } from '../../src/sim/stones';
import { createWorld, type World } from '../../src/sim/world';

function activeStones(world: World) {
  return world.stones.items.filter((s) => s.active);
}

describe('stone splitting', () => {
  it('base HP is 4 / 2 / 1 and a big stone is 12 HP of total work', () => {
    expect([BIG, TIER.medium, SMALLEST].map((t) => stoneHp(t, 1))).toEqual([4, 2, 1]);
    expect(treeHp(BIG, 1)).toBe(12);
    expect(treeHp(TIER.medium, 1)).toBe(4);
    expect(treeHp(SMALLEST, 1)).toBe(1);
  });

  it('hpScale multiplies HP, never below 1', () => {
    expect(stoneHp(BIG, 1.5)).toBe(6);
    expect(stoneHp(SMALLEST, 0.1)).toBe(1);
  });

  it('type modifies budget cost', () => {
    expect(stoneCost(BIG, 'bouncy', 1)).toBeCloseTo(14.4);
    expect(stoneCost(BIG, 'armored', 1)).toBe(14);
    expect(stoneCost(BIG, 'bomb', 1)).toBeCloseTo(9.6);
  });

  it('big splits into two mediums that pop up and apart', () => {
    const w = createWorld({ seed: 1 });
    const s = spawnStone(w, BIG, 'normal', 300, 500, 0, 90)!;
    damageStone(w, s, 4, 0);
    const kids = activeStones(w);
    expect(kids).toHaveLength(2);
    for (const k of kids) {
      expect(k.tier).toBe(TIER.medium);
      expect(k.hp).toBe(2);
      expect(k.radius).toBe(CONFIG.stone.radii[TIER.medium]);
      expect(k.vy).toBe(-CONFIG.stone.splitPopSpeed);
      expect(Math.abs(k.vx)).toBe(CONFIG.stone.splitSideSpeed);
    }
    expect(kids[0].vx).toBe(-kids[1].vx);
    expect(w.events.items.slice(0, w.events.count).some((e) => e.type === 'stoneSplit')).toBe(true);
  });

  it('smallest tier just pops', () => {
    const w = createWorld({ seed: 1 });
    const s = spawnStone(w, SMALLEST, 'normal', 300, 500, 0, 90)!;
    damageStone(w, s, 1, 0);
    expect(activeStones(w)).toHaveLength(0);
  });

  it('armor must break before HP drops', () => {
    const w = createWorld({ seed: 1 });
    const s = spawnStone(w, BIG, 'armored', 300, 500, 0, 90)!;
    damageStone(w, s, 1, 0);
    expect(s.armor).toBe(1);
    expect(s.hp).toBe(4);
    damageStone(w, s, 2, 0);
    expect(s.armor).toBe(0);
    expect(s.hp).toBe(3);
  });

  it('bouncy children stay bouncy; other special types split into normal', () => {
    const w = createWorld({ seed: 1 });
    damageStone(w, spawnStone(w, BIG, 'bouncy', 300, 500, 0, 90)!, 4, 0);
    expect(activeStones(w).every((k) => k.type === 'bouncy')).toBe(true);
    w.stones.clear();
    damageStone(w, spawnStone(w, BIG, 'golden', 300, 500, 0, 90)!, 4, 0);
    expect(activeStones(w).every((k) => k.type === 'normal')).toBe(true);
  });

  it('giant families grow in powers of 2: a Titan Rock breaks into 63 stones', () => {
    const w = createWorld({ seed: 1 });
    w.director.lastLifeLostT = 1e9;
    spawnStone(w, TIER.titanRock, 'normal', 360, 400, 0, 0);
    let broken = 0;
    // Smash every stone until none are left, counting each one.
    for (let guard = 0; guard < 500; guard++) {
      const s = w.stones.items.find((x) => x.active);
      if (!s) break;
      damageStone(w, s, s.hp, 0);
      broken++;
    }
    expect(broken).toBe(63);
  });

  it('a bomb blast damages nearby stones and can chain', () => {
    const w = createWorld({ seed: 1 });
    const bomb = spawnStone(w, SMALLEST, 'bomb', 300, 500, 0, 0)!;
    const near = spawnStone(w, SMALLEST, 'normal', 360, 500, 0, 0)!;
    const far = spawnStone(w, SMALLEST, 'normal', 700, 1000, 0, 0)!;
    damageStone(w, bomb, 1, 0);
    resolveBlasts(w); // normally runs inside step()
    expect(near.active).toBe(false);
    expect(far.active).toBe(true);
  });
});
