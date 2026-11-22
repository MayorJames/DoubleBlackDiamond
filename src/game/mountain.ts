// Your home mountain: the course you build between expeditions, kept in the save. The seed lays
// down the first loop (the lodge, the main lift, switchbacks); you add to it with course tiles
// you earn on expeditions and buy in town. Trail tiles lay paths over open snow in any shape,
// forking off the trail and joining it again further on, or doubling back uphill for another
// descent. Lifts and chutes are straight routes. Special tiles go on the trail: jumps, slalom
// gates, tunnels, checkpoints, and black run signs that make the whole mountain harder. How hard
// the mountain is comes from what's on it, not from a menu. Pure rules here; the view is the UI's.

import { MAX_LIFTS, type CardId } from './cards';
import { MAP_W } from './constants';
import { MAX_DIFFICULTY, ratingOf } from './enemies';
import type { BuildingId } from './lodge';
import { cell, generateMap, isPiste, nodeAt, routeCourse, trailCourse, type MountainMap, type Route, type StraightRoute } from './map';
import type { Feature, RunOptions } from './run';

export type FeatureTile = 'jump' | 'gates' | 'tunnel' | 'checkpoint' | 'blackRun';
export type CourseTile = 'trail' | StraightRoute | FeatureTile;

export interface MountainPlan {
  seed: string;
  /** Routes in the order you built them, with the way you've set each junction to start. */
  routes: Route[];
  features: { x: number; y: number; tile: FeatureTile }[];
}

export type TileStock = Record<CourseTile, number>;

interface TileInfo {
  name: string;
  text: string;
  /** The card a special tile becomes on the run. */
  card?: CardId;
  /** Price in town, or null if it can only be earned. */
  price: { cash: number; intel: number; scrap: number } | null;
  /** A building that has to be up before town sells it. */
  needs?: BuildingId;
}

export const COURSE_TILES: Record<CourseTile, TileInfo> = {
  trail: {
    name: 'Trail',
    text: 'One tile of groomed trail. Lay a path from the trail over open snow and join the trail again, further down for a detour or back up for another descent.',
    price: { cash: 40, intel: 0, scrap: 0 },
  },
  lift: {
    name: 'Lift',
    text: 'A chairlift from a trail tile straight up to the trail above: every ride is another descent. Two per mountain.',
    price: { cash: 350, intel: 0, scrap: 4 },
    needs: 'gondola',
  },
  chute: {
    name: 'Chute',
    text: 'A steep chute from a trail tile straight down to the trail below: fast, and +0.2 mult a tile.',
    price: { cash: 220, intel: 0, scrap: 2 },
    needs: 'trailCrew',
  },
  jump: { name: 'Jump', text: 'A kicker on the trail: you fly over it (and anything on the tile after) for chips and mult.', card: 'kicker', price: { cash: 100, intel: 0, scrap: 0 } },
  gates: { name: 'Slalom Gates', text: 'Tuck through for +0.5 mult.', card: 'gates', price: { cash: 100, intel: 0, scrap: 0 } },
  tunnel: {
    name: 'Snow Tunnel',
    text: 'Nobody can shoot in here, you or them.',
    card: 'tunnel',
    price: { cash: 180, intel: 0, scrap: 2 },
    needs: 'trailCrew',
  },
  checkpoint: {
    name: 'Checkpoint',
    text: 'Guards every descent. Makes the mountain harder and its bounties richer.',
    card: 'checkpoint',
    price: { cash: 80, intel: 1, scrap: 0 },
  },
  blackRun: {
    name: 'Black Run Sign',
    text: 'A whole step harder: tougher enemies, richer bounties. Earned by beating the Baron.',
    card: 'blackRun',
    price: null,
  },
};

export const COURSE_TILE_IDS = Object.keys(COURSE_TILES) as CourseTile[];
export const FEATURE_TILES: FeatureTile[] = ['jump', 'gates', 'tunnel', 'checkpoint', 'blackRun'];

export const STARTING_TILES: TileStock = { trail: 6, lift: 0, chute: 0, jump: 1, gates: 1, tunnel: 0, checkpoint: 1, blackRun: 0 };

export const newPlan = (seed: string): MountainPlan => ({ seed, routes: [], features: [] });

export const planMap = (plan: MountainPlan): MountainMap => generateMap(plan.seed, plan.routes);

/** How much difficulty each thing on the mountain adds. */
export const DIFFICULTY = { blackRun: 1, checkpoint: 0.35, chute: 0.25, lift: 0.15, trailCell: 0.02 };

/** How hard the mountain is, and why. */
export function difficultyOf(plan: MountainPlan): { value: number; rating: number; parts: [string, number][] } {
  const count = (t: FeatureTile) => plan.features.filter((f) => f.tile === t).length;
  const routes = (k: Route['kind']) => plan.routes.filter((r) => r.kind === k);
  const trailCells = routes('trail').reduce((n, r) => n + Math.max(0, (r.cells?.length ?? 1) - 1), 0);
  const parts: [string, number][] = [
    ['Black run signs', count('blackRun') * DIFFICULTY.blackRun],
    ['Checkpoints', count('checkpoint') * DIFFICULTY.checkpoint],
    ['Chutes', routes('chute').length * DIFFICULTY.chute],
    ['Lifts', routes('lift').length * DIFFICULTY.lift],
    ['Extra trail', trailCells * DIFFICULTY.trailCell],
  ];
  const value = Math.min(MAX_DIFFICULTY, Math.round(parts.reduce((n, [, v]) => n + v, 0) * 100) / 100);
  return { value, rating: ratingOf(value), parts: parts.filter(([, v]) => v > 0) };
}

/** What an expedition on this mountain starts with. */
export function runSetup(plan: MountainPlan): Pick<RunOptions, 'seed' | 'routes' | 'features' | 'difficulty'> {
  const map = planMap(plan);
  return {
    seed: plan.seed,
    // Only routes that fit go along, so the run's routes match the map.
    routes: plan.routes.filter((_, i) => map.segments[i]),
    features: plan.features.map((f): Feature => ({ x: f.x, y: f.y, card: COURSE_TILES[f.tile].card! })),
    difficulty: difficultyOf(plan).value,
  };
}

// --- Building ---------------------------------------------------------------------------------

const featureAt = (plan: MountainPlan, x: number, y: number) => plan.features.findIndex((f) => f.x === x && f.y === y);

/** Where a new trail path can start: a trail tile that isn't a junction already. */
export function canFork(map: MountainMap, x: number, y: number): boolean {
  const i = nodeAt(map, x, y);
  return i >= 0 && map.nodes[i].kind === 'trail' && map.nodes[i].next.length === 1;
}

/** Whether a half-laid path from (x, y) through `cells` could take one more open cell at c. */
export function canExtend(map: MountainMap, x: number, y: number, cells: readonly number[], c: number): boolean {
  if (c < 0 || map.index[c] >= 0 || cells.includes(c)) return false;
  const last = cells.length ? cells[cells.length - 1] : cell(x, y);
  const lx = last % MAP_W;
  const ly = Math.floor(last / MAP_W);
  const cx = c % MAP_W;
  const cy = Math.floor(c / MAP_W);
  return Math.abs(cx - lx) + Math.abs(cy - ly) === 1;
}

/** Lays a trail path (its open cells, then the trail cell it joins). Costs a trail tile a cell. */
export function layTrail(plan: MountainPlan, stock: TileStock, x: number, y: number, cells: number[]): boolean {
  const map = planMap(plan);
  const course = trailCourse(map, x, y, cells);
  if (!course || stock.trail < course.cells.length || featureAt(plan, x, y) >= 0) return false;
  stock.trail -= course.cells.length;
  plan.routes.push({ kind: 'trail', x, y, cells: [...cells], take: true });
  // A path that leads back up starts switched off, so a lap still ends at the lodge until you
  // choose otherwise.
  const seg = planMap(plan).segments[plan.routes.length - 1];
  plan.routes[plan.routes.length - 1].take = !seg?.back;
  return true;
}

/** Builds a lift or a chute from the trail tile at (x, y). */
export function buildStraight(plan: MountainPlan, stock: TileStock, kind: StraightRoute, x: number, y: number): boolean {
  const map = planMap(plan);
  if (stock[kind] < 1 || featureAt(plan, x, y) >= 0 || !routeCourse(map, kind, x, y)) return false;
  if (kind === 'lift' && map.lifts.filter((l) => l.route >= 0).length >= MAX_LIFTS) return false;
  stock[kind]--;
  plan.routes.push({ kind, x, y, take: kind !== 'lift' });
  return true;
}

/** Whether a special tile can go at (x, y): trail with nothing on it that isn't a junction. */
export function canFeature(plan: MountainPlan, map: MountainMap, x: number, y: number): boolean {
  const i = nodeAt(map, x, y);
  return isPiste(map, i) && map.nodes[i].junction < 0 && featureAt(plan, x, y) < 0;
}

export function placeFeature(plan: MountainPlan, stock: TileStock, tile: FeatureTile, x: number, y: number): boolean {
  if (stock[tile] < 1 || !canFeature(plan, planMap(plan), x, y)) return false;
  stock[tile]--;
  plan.features.push({ x, y, tile });
  return true;
}

/** What taking a route off the mountain gives back. */
function refund(stock: TileStock, r: Route): void {
  if (r.kind === 'trail') stock.trail += Math.max(0, (r.cells?.length ?? 1) - 1);
  else stock[r.kind]++;
}

/**
 * Takes up whatever you built at (x, y): a special tile, or the route whose tiles (or junction)
 * are there. Anything that only fitted because of it comes up too. Every tile goes back in stock.
 */
export function removeAt(plan: MountainPlan, stock: TileStock, x: number, y: number): boolean {
  const f = featureAt(plan, x, y);
  if (f >= 0) {
    stock[plan.features[f].tile]++;
    plan.features.splice(f, 1);
    return true;
  }
  const map = planMap(plan);
  const i = nodeAt(map, x, y);
  if (i < 0) return false;
  let route = map.nodes[i].junction;
  if (i >= map.loopLength) route = map.segments.findIndex((s) => s?.nodes.includes(i));
  if (route < 0) return false;
  refund(stock, plan.routes[route]);
  plan.routes.splice(route, 1);
  settle(plan, stock);
  return true;
}

/** Drops (and refunds) any route or special tile that no longer fits. */
function settle(plan: MountainPlan, stock: TileStock): void {
  for (;;) {
    const map = planMap(plan);
    const bad = plan.routes.findIndex((_, k) => !map.segments[k]);
    if (bad < 0) break;
    refund(stock, plan.routes[bad]);
    plan.routes.splice(bad, 1);
  }
  const map = planMap(plan);
  plan.features = plan.features.filter((f) => {
    const i = nodeAt(map, f.x, f.y);
    const ok = isPiste(map, i) && map.nodes[i].junction < 0;
    if (!ok) stock[f.tile]++;
    return ok;
  });
}

/** Flips the way a junction starts each expedition. */
export function toggleStart(plan: MountainPlan, route: number): boolean {
  const r = plan.routes[route];
  if (!r) return false;
  r.take = !r.take;
  return true;
}

/** A fresh mountain from a new seed; everything built on the old one goes back in stock. */
export function clearPlan(plan: MountainPlan, stock: TileStock, seed: string): void {
  for (const r of plan.routes) refund(stock, r);
  for (const f of plan.features) stock[f.tile]++;
  plan.seed = seed;
  plan.routes = [];
  plan.features = [];
}

/** How many of each tile are on the mountain right now. */
export function tilesInUse(plan: MountainPlan): TileStock {
  const used: TileStock = { trail: 0, lift: 0, chute: 0, jump: 0, gates: 0, tunnel: 0, checkpoint: 0, blackRun: 0 };
  for (const r of plan.routes) {
    if (r.kind === 'trail') used.trail += Math.max(0, (r.cells?.length ?? 1) - 1);
    else used[r.kind]++;
  }
  for (const f of plan.features) used[f.tile]++;
  return used;
}
