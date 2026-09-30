// A*-Wegsuche auf dem Kachelraster, 8 Richtungen, ohne Ecken abzuschneiden.
// Damit läuft die Figur beim Tippen um Hindernisse herum, statt hängenzubleiben.

export type Walkable = (x: number, y: number) => boolean;

export interface Cell {
  x: number;
  y: number;
}

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

export function findPath(walkable: Walkable, start: Cell, goal: Cell, maxNodes = 4000): Cell[] | null {
  if (!walkable(goal.x, goal.y)) return null;
  const key = (x: number, y: number) => `${x},${y}`;
  const open: { x: number; y: number; f: number; g: number }[] = [{ ...start, g: 0, f: 0 }];
  const came = new Map<string, string>();
  const gScore = new Map<string, number>([[key(start.x, start.y), 0]]);
  const h = (x: number, y: number) => {
    const dx = Math.abs(x - goal.x);
    const dy = Math.abs(y - goal.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  let visited = 0;

  while (open.length && visited < maxNodes) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift()!;
    visited++;
    if (cur.x === goal.x && cur.y === goal.y) {
      const path: Cell[] = [];
      let k: string | undefined = key(cur.x, cur.y);
      while (k) {
        const [x, y] = k.split(',').map(Number);
        path.unshift({ x, y });
        k = came.get(k);
      }
      return path;
    }
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (!walkable(nx, ny)) continue;
      if (dx && dy && (!walkable(cur.x + dx, cur.y) || !walkable(cur.x, cur.y + dy))) continue;
      const g = cur.g + (dx && dy ? Math.SQRT2 : 1);
      const k = key(nx, ny);
      if (g < (gScore.get(k) ?? Infinity)) {
        gScore.set(k, g);
        came.set(k, key(cur.x, cur.y));
        const existing = open.find((o) => o.x === nx && o.y === ny);
        if (existing) {
          existing.g = g;
          existing.f = g + h(nx, ny);
        } else open.push({ x: nx, y: ny, g, f: g + h(nx, ny) });
      }
    }
  }
  return null;
}

/** Nächste begehbare Zelle um ein Ziel (für Tipps auf Hindernisse oder Figuren). */
export function nearestWalkable(walkable: Walkable, goal: Cell, from: Cell, radius = 3): Cell | null {
  let best: Cell | null = null;
  let bestD = Infinity;
  for (let r = 0; r <= radius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = goal.x + dx;
        const y = goal.y + dy;
        if (!walkable(x, y)) continue;
        const d = Math.hypot(dx, dy) * 10 + Math.hypot(x - from.x, y - from.y);
        if (d < bestD) {
          bestD = d;
          best = { x, y };
        }
      }
    }
    if (best) return best;
  }
  return best;
}
