import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../src/config/gameConfig';
import { damageStone, resolveBlasts, spawnStone, stoneCost, stoneHp, treeHp } from '../../src/sim/stones';
import { createWorld, type World } from '../../src/sim/world';

function activeStones(world: World) {
  return world.stones.items.filter((s) => s.active);
}

describe('stone splitting', () => {
  it('base HP is 4 / 2 / 1 and a big stone is 12 HP of total work', () => {
    expect([0, 1, 2].map((t) => stoneHp(t as 0 | 1 | 2, 1))).toEqual([4, 2, 1]);
    expect(treeHp(0, 1)).toBe(12);
    expect(treeHp(1, 1)).toBe(4);
    expect(treeHp(2, 1)).toBe(1);
  });

  it('hpScale multiplies HP, never below 1', () => {
    expect(stoneHp(0, 1.5)).toBe(6);
    expect(stoneHp(2, 0.1)).toBe(1);
  });

  it('type modifies budget cost', () => {
    expect(stoneCost(0, 'bouncy', 1)).toBeCloseTo(14.4);
    expect(stoneCost(0, 'armored', 1)).toBe(14);
    expect(stoneCost(0, 'bomb', 1)).toBeCloseTo(9.6);
  });

  it('big splits into two mediums that pop up and apart', () => {
    const w = createWorld({ seed: 1 });
    const s = spawnStone(w, 0, 'normal', 300, 500, 0, 90)!;
    damageStone(w, s, 4, 0);
    const kids = activeStones(w);
    expect(kids).toHaveLength(2);
    for (const k of kids) {
      expect(k.tier).toBe(1);
      expect(k.hp).toBe(2);
      expect(k.radius).toBe(CONFIG.stone.radii[1]);
      expect(k.vy).toBe(-CONFIG.stone.splitPopSpeed);
      expect(Math.abs(k.vx)).toBe(CONFIG.stone.splitSideSpeed);
    }
    expect(kids[0].vx).toBe(-kids[1].vx);
    expect(w.events.items.slice(0, w.events.count).some((e) => e.type === 'stoneSplit')).toBe(true);
  });

  it('smallest tier just pops', () => {
    const w = createWorld({ seed: 1 });
    const s = spawnStone(w, 2, 'normal', 300, 500, 0, 90)!;
    damageStone(w, s, 1, 0);
    expect(activeStones(w)).toHaveLength(0);
  });

  it('armor must break before HP drops', () => {
    const w = createWorld({ seed: 1 });
    const s = spawnStone(w, 0, 'armored', 300, 500, 0, 90)!;
    damageStone(w, s, 1, 0);
    expect(s.armor).toBe(1);
    expect(s.hp).toBe(4);
    damageStone(w, s, 2, 0);
    expect(s.armor).toBe(0);
    expect(s.hp).toBe(3);
  });

  it('bouncy children stay bouncy; other special types split into normal', () => {
    const w = createWorld({ seed: 1 });
    damageStone(w, spawnStone(w, 0, 'bouncy', 300, 500, 0, 90)!, 4, 0);
    expect(activeStones(w).every((k) => k.type === 'bouncy')).toBe(true);
    w.stones.clear();
    damageStone(w, spawnStone(w, 0, 'golden', 300, 500, 0, 90)!, 4, 0);
    expect(activeStones(w).every((k) => k.type === 'normal')).toBe(true);
  });

  it('a bomb blast damages nearby stones and can chain', () => {
    const w = createWorld({ seed: 1 });
    const bomb = spawnStone(w, 2, 'bomb', 300, 500, 0, 0)!;
    const near = spawnStone(w, 2, 'normal', 360, 500, 0, 0)!;
    const far = spawnStone(w, 2, 'normal', 700, 1000, 0, 0)!;
    damageStone(w, bomb, 1, 0);
    resolveBlasts(w); // normally runs inside step()
    expect(near.active).toBe(false);
    expect(far.active).toBe(true);
  });
});
