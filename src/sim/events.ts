// Events emitted by the sim for the render/audio layer. Pre-allocated and reused every step.

import type { PowerUpKind, StoneType } from '../config/gameConfig';

export type SimEventType =
  | 'shot'
  | 'stoneHit' // bullet or blast damaged a stone that survived
  | 'armorBreak'
  | 'stoneSplit' // stone reached 0 HP and split into children
  | 'stonePop' // smallest tier reached 0 HP
  | 'bombBlast'
  | 'groundHit' // stone touched the ground (life lost or shield used)
  | 'lifeLost'
  | 'shieldUsed'
  | 'powerUpPicked'
  | 'coinPicked'
  | 'score'
  | 'levelUp' // in-run cannon level gained (value = new level)
  | 'levelDown' // level lost with a life (value = new level)
  | 'gameOver';

export interface SimEvent {
  type: SimEventType;
  x: number;
  y: number;
  tier: number;
  stoneType: StoneType;
  powerUp: PowerUpKind;
  /** Generic value: points scored, combo count, chain depth... */
  value: number;
  combo: number;
  /** Stone id for stone events (matches Stone.id), else 0. */
  id: number;
}

function blank(): SimEvent {
  return {
    type: 'shot',
    x: 0,
    y: 0,
    tier: 0,
    stoneType: 'normal',
    powerUp: 'spread',
    value: 0,
    combo: 0,
    id: 0,
  };
}

export class EventQueue {
  readonly items: SimEvent[] = [];
  count = 0;

  constructor(capacity: number) {
    for (let i = 0; i < capacity; i++) this.items.push(blank());
  }

  /** Returns a reset event slot to fill in, or a scratch slot if the queue is full (event dropped). */
  push(type: SimEventType, x: number, y: number): SimEvent {
    const e = this.count < this.items.length ? this.items[this.count++] : this.items[this.items.length - 1];
    e.type = type;
    e.x = x;
    e.y = y;
    e.tier = 0;
    e.stoneType = 'normal';
    e.value = 0;
    e.combo = 0;
    e.id = 0;
    return e;
  }

  clear(): void {
    this.count = 0;
  }
}
