// The loop: a ski circuit on a grid, generated from the seed. It starts at the lodge, rides the
// lift straight up to the summit, then skis switchbacks back down to the lodge. The skier goes
// round and round it, Loop Hero style, while you build the mountain around it with cards.

import { MAP_H, MAP_W } from './constants';
import { Rng } from './rng';

export type PathKind = 'lodge' | 'lift' | 'summit' | 'trail';
export type Dir = 'up' | 'down' | 'left' | 'right';

export interface PathTile {
  x: number;
  y: number;
  kind: PathKind;
  /** Direction of travel out of this tile, and into it. */
  dir: Dir;
  from: Dir;
}

export interface LoopMap {
  seed: string;
  /** In travel order. Index 0 is the lodge; the lift follows. */
  path: PathTile[];
  /** Grid cell to path index, or -1. */
  index: Int16Array;
  liftX: number;
  summit: number;
}

export const cell = (x: number, y: number): number => y * MAP_W + x;
export const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

const dirBetween = (ax: number, ay: number, bx: number, by: number): Dir =>
  bx > ax ? 'right' : bx < ax ? 'left' : by > ay ? 'down' : 'up';

export function generateMap(seed: string): LoopMap {
  const rng = Rng.fromSeed(`map:${seed}`);
  const liftX = rng.int(1, 3);
  const top = 1;
  const bottom = MAP_H - 2;
  const pts: { x: number; y: number; kind: PathKind }[] = [{ x: liftX, y: bottom, kind: 'lodge' }];
  for (let y = bottom - 1; y > top; y--) pts.push({ x: liftX, y, kind: 'lift' });
  pts.push({ x: liftX, y: top, kind: 'summit' });

  // Switchbacks down the mountain: across, down, back across, down, then home along the bottom.
  let x = liftX + 1;
  let y = top;
  pts.push({ x, y, kind: 'trail' });
  const go = (tx: number, ty: number) => {
    while (x !== tx) {
      x += Math.sign(tx - x);
      pts.push({ x, y, kind: 'trail' });
    }
    while (y !== ty) {
      y += Math.sign(ty - y);
      pts.push({ x, y, kind: 'trail' });
    }
  };
  const rows = [top, ...rng.pick([[4], [5], [3, 6], [4, 6], [3, 5]]), bottom];
  for (let i = 0; i < rows.length - 1; i++) {
    const right = i % 2 === 0;
    const tx = right ? rng.int(MAP_W - 5, MAP_W - 1) : rng.int(liftX + 3, Math.floor(MAP_W / 2) + 1);
    go(tx, rows[i]);
    go(tx, rows[i + 1]);
  }
  go(liftX + 1, bottom);

  const index = new Int16Array(MAP_W * MAP_H).fill(-1);
  const n = pts.length;
  const path: PathTile[] = pts.map((p, i) => {
    const next = pts[(i + 1) % n];
    const prev = pts[(i - 1 + n) % n];
    index[cell(p.x, p.y)] = i;
    return { ...p, dir: dirBetween(p.x, p.y, next.x, next.y), from: dirBetween(prev.x, prev.y, p.x, p.y) };
  });
  return { seed, path, index, liftX, summit: pts.findIndex((p) => p.kind === 'summit') };
}

export const pathIndexAt = (map: LoopMap, x: number, y: number): number =>
  inBounds(x, y) ? map.index[cell(x, y)] : -1;

export const isPath = (map: LoopMap, x: number, y: number): boolean => pathIndexAt(map, x, y) >= 0;

/** The eight neighbours of a cell that are on the map. */
export function neighbours(x: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && inBounds(x + dx, y + dy)) out.push([x + dx, y + dy]);
  return out;
}

/** Off the path but touching it (diagonals count). */
export const isRoadside = (map: LoopMap, x: number, y: number): boolean =>
  inBounds(x, y) && !isPath(map, x, y) && neighbours(x, y).some(([nx, ny]) => isPath(map, nx, ny));

/** Position at distance `s` (in tiles) along the loop, at tile centres. */
export function pathPos(map: LoopMap, s: number): { x: number; y: number } {
  const n = map.path.length;
  const i = Math.floor(s);
  const f = s - i;
  const a = map.path[((i % n) + n) % n];
  const b = map.path[(((i + 1) % n) + n) % n];
  return { x: a.x + 0.5 + (b.x - a.x) * f, y: a.y + 0.5 + (b.y - a.y) * f };
}

/** The path tile the skier is on at distance `s`. */
export const tileAt = (map: LoopMap, s: number): number => {
  const n = map.path.length;
  return ((Math.round(s) % n) + n) % n;
};
