// Circle helpers. Stones pass through each other, so the sim only needs circle vs circle,
// circle vs side walls, and circle vs ground.

export function circlesOverlap(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number,
): boolean {
  const dx = ax - bx;
  const dy = ay - by;
  const r = ar + br;
  return dx * dx + dy * dy <= r * r;
}

export interface Body {
  x: number;
  vx: number;
  radius: number;
}

/** Reflects vx off the side walls and nudges the body back inside. */
export function bounceWalls(b: Body, width: number): void {
  if (b.x - b.radius < 0) {
    b.x = b.radius;
    if (b.vx < 0) b.vx = -b.vx;
  } else if (b.x + b.radius > width) {
    b.x = width - b.radius;
    if (b.vx > 0) b.vx = -b.vx;
  }
}

export function touchesGround(y: number, radius: number, groundY: number): boolean {
  return y + radius >= groundY;
}
