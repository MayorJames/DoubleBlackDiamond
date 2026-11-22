// The mountain: a directed graph of path tiles on a grid, generated from the seed. It starts as
// one loop (the lodge, the lift straight up to the summit, switchbacks back down) and grows as
// you add routes. A lift climbs from a trail tile straight back up to the trail above it; a
// chute drops straight down to the trail below; a trail path wanders over open snow in any
// shape you lay it, and can head back uphill to trail you've already skied. Where a route
// branches off there is a junction, and its switch decides which way the skier (and anything
// chasing them) goes. A route that leads back to trail before its own junction is a loop-back:
// taking it means another descent. The map is rebuilt from the seed and the routes, so it never
// needs saving.

import { MAP_H, MAP_W } from './constants';
import { Rng } from './rng';

export type PathKind = 'lodge' | 'lift' | 'summit' | 'trail' | 'chute';
export type Dir = 'up' | 'down' | 'left' | 'right';
export type RouteKind = 'lift' | 'chute' | 'trail';
/** The routes that run in a straight line: lifts up, chutes down. */
export type StraightRoute = 'lift' | 'chute';

/** A route on the mountain. The switch (`take`) lives in the run state; the shape here. */
export interface RouteSpec {
  kind: RouteKind;
  /** The trail tile it branches from: a lift's bottom station, a chute's lip, a path's fork. */
  x: number;
  y: number;
  /** A trail path's open cells in order, then the cell of the path tile it joins. */
  cells?: number[];
}

export interface Route extends RouteSpec {
  /** Whether its junction sends you onto it (true) or on along the trail. */
  take: boolean;
}

export interface PathNode {
  x: number;
  y: number;
  kind: PathKind;
  /** Where you can go next. next[0] carries on along the trail; next[1] is a route branching off here. */
  next: number[];
  prev: number[];
  /** Index of the route that branches off here, or -1. */
  junction: number;
}

/** A lift line or a chute: where it leaves from, where it arrives, and the nodes in between. */
export interface Segment {
  /** Index into the routes, or -1 for the main lift. */
  route: number;
  from: number;
  to: number;
  nodes: number[];
  /** Whether it leads back to trail before its own junction: taking it is another descent. */
  back: boolean;
}

export interface MountainMap {
  seed: string;
  nodes: PathNode[];
  /** Grid cell to node index, or -1. */
  index: Int16Array;
  liftX: number;
  summit: number;
  /** Nodes in the original loop. Route nodes are appended after, so indices stay stable. */
  loopLength: number;
  lifts: Segment[];
  chutes: Segment[];
  /** Trail paths you laid out. */
  paths: Segment[];
  /** Each route's segment by route index (null if it didn't fit and wasn't built). */
  segments: (Segment | null)[];
}

/** Position on the mountain: travelling from node `at` to node `to`, fraction `f` of the way. */
export interface Ride {
  at: number;
  to: number;
  f: number;
}

/** The lodge is always node 0: laps start and end there. */
export const LODGE = 0;

export const cell = (x: number, y: number): number => y * MAP_W + x;
export const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;

const dirBetween = (ax: number, ay: number, bx: number, by: number): Dir =>
  bx > ax ? 'right' : bx < ax ? 'left' : by > ay ? 'down' : 'up';

export function generateMap(seed: string, routes: readonly RouteSpec[] = []): MountainMap {
  const rng = Rng.fromSeed(`map:${seed}`);
  const liftX = rng.int(1, 3);
  const top = 1;
  const bottom = MAP_H - 2;
  const pts: { x: number; y: number; kind: PathKind }[] = [{ x: liftX, y: bottom, kind: 'lodge' }];
  for (let y = bottom - 1; y > top; y--) pts.push({ x: liftX, y, kind: 'lift' });
  pts.push({ x: liftX, y: top, kind: 'summit' });

  // Switchbacks down the mountain: across, down, back across, down, then home along the bottom.
  // Rows only ever go down, so trail higher up the mountain always comes earlier in the loop.
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
  const nodes: PathNode[] = pts.map((p, i) => {
    index[cell(p.x, p.y)] = i;
    return { ...p, next: [(i + 1) % n], prev: [(i - 1 + n) % n], junction: -1 };
  });
  const map: MountainMap = {
    seed,
    nodes,
    index,
    liftX,
    summit: pts.findIndex((p) => p.kind === 'summit'),
    loopLength: n,
    lifts: [{ route: -1, from: LODGE, to: 0, nodes: [], back: false }],
    chutes: [],
    paths: [],
    segments: [],
  };
  map.lifts[0].to = map.summit;
  map.lifts[0].nodes = nodes.map((_, i) => i).filter((i) => nodes[i].kind === 'lift');

  routes.forEach((r, i) => {
    const course = r.kind === 'trail' ? trailCourse(map, r.x, r.y, r.cells ?? []) : routeCourse(map, r.kind, r.x, r.y);
    map.segments[i] = course ? addRoute(map, i, r.kind, nodeAt(map, r.x, r.y), course) : null;
  });
  for (const seg of [...map.lifts.slice(1), ...map.chutes, ...map.paths]) seg.back = leadsBack(map, seg.to, seg.from);
  return map;
}

/** Whether following the main way on from `from` reaches `target` before the lodge. */
function leadsBack(map: MountainMap, from: number, target: number): boolean {
  let at = from;
  for (let k = 0; k <= map.nodes.length; k++) {
    if (at === target) return true;
    if (at === LODGE) return false;
    at = map.nodes[at].next[0];
  }
  return false;
}

/**
 * Checks a trail path laid from the trail tile at (x, y): its open cells must run edge to edge
 * over snow nobody has built on, and its last cell must be trail (or a chute) to join. Returns
 * the cells it crosses and the node it joins, or null.
 */
export function trailCourse(
  map: MountainMap,
  x: number,
  y: number,
  cells: readonly number[],
  blocked: (c: number) => boolean = () => false,
): { cells: number[]; end: number } | null {
  const start = nodeAt(map, x, y);
  if (start < 0 || map.nodes[start].kind !== 'trail' || map.nodes[start].next.length > 1 || cells.length < 2) return null;
  const open = cells.slice(0, -1);
  let px = x;
  let py = y;
  const seen = new Set<number>();
  for (const c of open) {
    const cx = c % MAP_W;
    const cy = Math.floor(c / MAP_W);
    if (c < 0 || c >= MAP_W * MAP_H || Math.abs(cx - px) + Math.abs(cy - py) !== 1) return null;
    if (map.index[c] >= 0 || seen.has(c) || blocked(c)) return null;
    seen.add(c);
    px = cx;
    py = cy;
  }
  const last = cells[cells.length - 1];
  if (Math.abs((last % MAP_W) - px) + Math.abs(Math.floor(last / MAP_W) - py) !== 1) return null;
  const end = last >= 0 && last < MAP_W * MAP_H ? map.index[last] : -1;
  if (end < 0 || end === start || !isPiste(map, end)) return null;
  return { cells: open, end };
}

/**
 * The open cells a route from (x, y) would cross, and the trail node it lands on, or null if it
 * can't go there. Routes leave from a trail tile that isn't already a junction and run straight
 * up (a lift) or down (a chute) over at least two open cells to the first trail tile they meet.
 * Because trail higher up always comes earlier in the loop, a lift always lands on trail that
 * leads back down to where it started, and a chute always skips trail.
 */
export function routeCourse(
  map: MountainMap,
  kind: StraightRoute,
  x: number,
  y: number,
  blocked: (c: number) => boolean = () => false,
): { cells: number[]; end: number } | null {
  const start = nodeAt(map, x, y);
  if (start < 0 || map.nodes[start].kind !== 'trail' || map.nodes[start].next.length > 1) return null;
  const step = kind === 'lift' ? -1 : 1;
  const cells: number[] = [];
  for (let yy = y + step; inBounds(x, yy); yy += step) {
    const j = nodeAt(map, x, yy);
    if (j >= 0) return cells.length >= 2 && map.nodes[j].kind === 'trail' ? { cells, end: j } : null;
    if (blocked(cell(x, yy))) return null;
    cells.push(cell(x, yy));
  }
  return null;
}

function addRoute(map: MountainMap, route: number, kind: RouteKind, start: number, course: { cells: number[]; end: number }): Segment {
  const ids = course.cells.map((c) => {
    const id = map.nodes.length;
    map.nodes.push({ x: c % MAP_W, y: Math.floor(c / MAP_W), kind, next: [], prev: [], junction: -1 });
    map.index[c] = id;
    return id;
  });
  const chain = [start, ...ids, course.end];
  for (let k = 0; k < chain.length - 1; k++) {
    map.nodes[chain[k]].next.push(chain[k + 1]);
    map.nodes[chain[k + 1]].prev.push(chain[k]);
  }
  map.nodes[start].junction = route;
  const seg: Segment = { route, from: start, to: course.end, nodes: ids, back: false };
  (kind === 'lift' ? map.lifts : kind === 'chute' ? map.chutes : map.paths).push(seg);
  return seg;
}

export const nodeAt = (map: MountainMap, x: number, y: number): number => (inBounds(x, y) ? map.index[cell(x, y)] : -1);

export const isPath = (map: MountainMap, x: number, y: number): boolean => nodeAt(map, x, y) >= 0;

/** Trail you can put trail cards on: the groomed run and any chutes. */
export const isPiste = (map: MountainMap, i: number): boolean => i >= 0 && (map.nodes[i].kind === 'trail' || map.nodes[i].kind === 'chute');

/** The eight neighbours of a cell that are on the map. */
export function neighbours(x: number, y: number): [number, number][] {
  const out: [number, number][] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && inBounds(x + dx, y + dy)) out.push([x + dx, y + dy]);
  return out;
}

/** Off the path but touching it (diagonals count). */
export const isRoadside = (map: MountainMap, x: number, y: number): boolean =>
  inBounds(x, y) && !isPath(map, x, y) && neighbours(x, y).some(([nx, ny]) => isPath(map, nx, ny));

/** Direction of travel from node a to node b. */
export const dirOf = (map: MountainMap, a: number, b: number): Dir => {
  const p = map.nodes[a];
  const q = map.nodes[b];
  return dirBetween(p.x, p.y, q.x, q.y);
};

/** Position of a ride in tiles, at tile centres. */
export function ridePos(map: MountainMap, r: Ride): { x: number; y: number } {
  const a = map.nodes[r.at];
  const b = map.nodes[r.to];
  return { x: a.x + 0.5 + (b.x - a.x) * r.f, y: a.y + 0.5 + (b.y - a.y) * r.f };
}

/** The node a ride counts as being on: the one it is nearer. */
export const rideNode = (r: Ride): number => (r.f < 0.5 ? r.at : r.to);
