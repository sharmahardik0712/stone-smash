// Fixed-size object pools. Slots are allocated once; step() only flips `active` flags,
// so the sim does not allocate while running. The render layer mirrors slots by index.

export interface Poolable {
  active: boolean;
}

export class Pool<T extends Poolable> {
  readonly items: T[];

  constructor(size: number, make: () => T) {
    this.items = [];
    for (let i = 0; i < size; i++) this.items.push(make());
  }

  /** Returns a free slot, or null if the pool is exhausted. The caller must initialise every field. */
  acquire(): T | null {
    const items = this.items;
    for (let i = 0; i < items.length; i++) {
      if (!items[i].active) {
        items[i].active = true;
        return items[i];
      }
    }
    return null;
  }

  countActive(): number {
    let n = 0;
    for (let i = 0; i < this.items.length; i++) if (this.items[i].active) n++;
    return n;
  }

  clear(): void {
    for (let i = 0; i < this.items.length; i++) this.items[i].active = false;
  }
}
