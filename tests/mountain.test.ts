import { describe, expect, it } from 'vitest';
import { MAP_H, MAP_W } from '../src/game/constants';
import { difficultyMods, RATINGS } from '../src/game/enemies';
import { buyTile, newProfile } from '../src/game/lodge';
import { cell, generateMap, nodeAt, type MountainMap } from '../src/game/map';
import {
  buildStraight,
  canFork,
  clearPlan,
  difficultyOf,
  layTrail,
  newPlan,
  placeFeature,
  planMap,
  removeAt,
  runSetup,
  STARTING_TILES,
  tilesInUse,
  type TileStock,
} from '../src/game/mountain';
import { Run, type RunEvent } from '../src/game/run';

const SEEDS = ['alpine', 'powder', 'mogul', 'whiteout', 'yeti', 'QX7P2M', 'B4R0N'];

/**
 * Finds a trail path over open snow: from a fork on the trail, through open cells, to trail that
 * comes later (`back` false) or earlier (`back` true) in the loop. Breadth-first, shortest first.
 */
function findPath(map: MountainMap, back: boolean, minCells = 1): { x: number; y: number; cells: number[] } | null {
  for (let i = map.summit + 1; i < map.loopLength; i++) {
    const n = map.nodes[i];
    if (!canFork(map, n.x, n.y)) continue;
    const queue: number[][] = [[]];
    const seen = new Set<number>();
    while (queue.length) {
      const path = queue.shift()!;
      if (path.length > 6) continue;
      const last = path.length ? path[path.length - 1] : cell(n.x, n.y);
      const lx = last % MAP_W;
      const ly = Math.floor(last / MAP_W);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = lx + dx;
        const y = ly + dy;
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        const c = cell(x, y);
        const j = map.index[c];
        if (j >= 0) {
          const ok = path.length >= minCells && j !== i && map.nodes[j].kind === 'trail' && j < map.loopLength && (back ? j < i : j > i + path.length + 1);
          if (ok) return { x: n.x, y: n.y, cells: [...path, c] };
          continue;
        }
        if (seen.has(c) || path.includes(c)) continue;
        seen.add(c);
        queue.push([...path, c]);
      }
    }
  }
  return null;
}

describe('trail paths', () => {
  it('fork off the trail over open snow and join it again, as new trail', () => {
    for (const seed of SEEDS) {
      const plan = newPlan(seed);
      const stock: TileStock = { ...STARTING_TILES, trail: 20 };
      const path = findPath(planMap(plan), false)!;
      expect(path, seed).not.toBeNull();
      expect(layTrail(plan, stock, path.x, path.y, path.cells)).toBe(true);
      expect(stock.trail).toBe(20 - (path.cells.length - 1));
      const map = planMap(plan);
      expect(map.paths).toHaveLength(1);
      expect(map.paths[0].back).toBe(false);
      const fork = map.nodes[nodeAt(map, path.x, path.y)];
      expect(fork.next).toHaveLength(2);
      for (const c of path.cells.slice(0, -1)) expect(map.nodes[map.index[c]].kind).toBe('trail');
    }
  });

  it("won't cross built tiles, leave gaps, or start from a junction", () => {
    const plan = newPlan('alpine');
    const stock: TileStock = { ...STARTING_TILES, trail: 20 };
    const path = findPath(planMap(plan), false)!;
    const gap = [path.cells[0], ...path.cells.slice(2)];
    if (path.cells.length > 2) expect(layTrail(plan, stock, path.x, path.y, gap)).toBe(false);
    expect(layTrail(plan, stock, path.x, path.y, path.cells.slice(-1))).toBe(false);
    expect(layTrail(plan, stock, path.x, path.y, path.cells)).toBe(true);
    expect(layTrail(plan, stock, path.x, path.y, path.cells)).toBe(false);
    expect(layTrail(plan, { ...stock, trail: 0 }, path.x, path.y, path.cells)).toBe(false);
  });

  it('a path that doubles back uphill is a loop-back: it starts switched off, and taking it is another descent', () => {
    let tried = 0;
    for (const seed of SEEDS) {
      const plan = newPlan(seed);
      const stock: TileStock = { ...STARTING_TILES, trail: 30 };
      const path = findPath(planMap(plan), true, 2);
      if (!path) continue;
      tried++;
      expect(layTrail(plan, stock, path.x, path.y, path.cells)).toBe(true);
      const map = planMap(plan);
      expect(map.paths[0].back).toBe(true);
      expect(plan.routes[0].take).toBe(false);

      // Switched on, the skier climbs back up the path and chains a descent.
      plan.routes[0].take = true;
      const run = Run.create({ ...runSetup(plan), deck: ['pines'] });
      const events: RunEvent[] = [];
      for (let t = 0; t < 30 * 120 && !events.some((e) => e.type === 'chain'); t++) {
        run.state.hero.hp = 9999;
        run.step();
        events.push(...run.drainEvents());
      }
      expect(events.some((e) => e.type === 'chain'), seed).toBe(true);
      expect(run.state.descent).toBe(2);
    }
    expect(tried).toBeGreaterThan(2);
  });
});

describe('the mountain plan', () => {
  it('lifts, chutes and special tiles cost tiles from stock; taking them up gives them back', () => {
    const plan = newPlan('powder');
    const stock: TileStock = { ...STARTING_TILES, trail: 20, lift: 3, chute: 1 };
    const map = planMap(plan);
    let lifts = 0;
    for (let c = 0; c < MAP_W * MAP_H; c++) if (buildStraight(plan, stock, 'lift', c % MAP_W, Math.floor(c / MAP_W))) lifts++;
    expect(lifts).toBe(2);
    expect(stock.lift).toBe(1);
    const trail = map.nodes.find((n, i) => i > map.summit && n.kind === 'trail' && n.next.length === 1 && planMap(plan).nodes[planMap(plan).index[cell(n.x, n.y)]].next.length === 1)!;
    expect(placeFeature(plan, stock, 'jump', trail.x, trail.y)).toBe(true);
    expect(placeFeature(plan, stock, 'jump', trail.x, trail.y)).toBe(false);
    expect(stock.jump).toBe(0);
    const before = { ...stock };
    const used = tilesInUse(plan);
    expect(used.lift).toBe(2);
    expect(removeAt(plan, stock, trail.x, trail.y)).toBe(true);
    expect(stock.jump).toBe(before.jump + 1);
    const lift = plan.routes[0];
    expect(removeAt(plan, stock, lift.x, lift.y)).toBe(true);
    expect(stock.lift).toBe(before.lift + 1);
    clearPlan(plan, stock, 'NEWSEED');
    expect(plan.routes).toHaveLength(0);
    expect(stock.lift).toBe(3);
    expect(plan.seed).toBe('NEWSEED');
  });

  it('removing a path takes up anything that branched off it', () => {
    const plan = newPlan('alpine');
    const stock: TileStock = { ...STARTING_TILES, trail: 30 };
    const path = findPath(planMap(plan), false, 2)!;
    expect(layTrail(plan, stock, path.x, path.y, path.cells)).toBe(true);
    // A special tile on the new path, then pull the path up.
    const first = path.cells[0];
    expect(placeFeature(plan, stock, 'gates', first % MAP_W, Math.floor(first / MAP_W))).toBe(true);
    const full = { ...stock };
    expect(removeAt(plan, stock, first % MAP_W, Math.floor(first / MAP_W))).toBe(true); // the gates
    expect(removeAt(plan, stock, first % MAP_W, Math.floor(first / MAP_W))).toBe(true); // the path
    expect(plan.routes).toHaveLength(0);
    expect(stock.trail).toBe(full.trail + path.cells.length - 1);
    expect(stock.gates).toBe(full.gates + 1);
  });

  it('difficulty comes from the mountain: signs, checkpoints, chutes, lifts and extra trail', () => {
    const plan = newPlan('mogul');
    expect(difficultyOf(plan).value).toBe(0);
    const stock: TileStock = { ...STARTING_TILES, blackRun: 3, checkpoint: 2 };
    const map = generateMap('mogul');
    const spots = map.nodes.filter((n, i) => i > map.summit && n.kind === 'trail');
    placeFeature(plan, stock, 'blackRun', spots[2].x, spots[2].y);
    placeFeature(plan, stock, 'blackRun', spots[4].x, spots[4].y);
    placeFeature(plan, stock, 'checkpoint', spots[6].x, spots[6].y);
    const d = difficultyOf(plan);
    expect(d.value).toBeCloseTo(2.35, 5);
    expect(RATINGS[d.rating].name).toBe('Black Diamond');
    expect(difficultyMods(d.value).enemy).toBeGreaterThan(difficultyMods(0).enemy);
    expect(difficultyMods(d.value).payout).toBeGreaterThan(difficultyMods(0).payout);
    expect(difficultyMods(d.value).boss).toBeGreaterThan(difficultyMods(0).boss);
  });

  it('an expedition starts on your mountain: its routes, switches, special tiles and difficulty', () => {
    const plan = newPlan('yeti');
    const stock: TileStock = { ...STARTING_TILES, trail: 20, chute: 1 };
    const path = findPath(planMap(plan), false)!;
    layTrail(plan, stock, path.x, path.y, path.cells);
    const map = planMap(plan);
    const spot = map.nodes.find((n, i) => i < map.loopLength && n.kind === 'trail' && n.next.length === 1 && n.y > 3)!;
    placeFeature(plan, stock, 'checkpoint', spot.x, spot.y);
    const run = Run.create({ ...runSetup(plan), deck: ['pines'] });
    expect(run.state.routes).toHaveLength(1);
    expect(run.map.paths).toHaveLength(1);
    expect(run.state.tiles[cell(spot.x, spot.y)]?.card).toBe('checkpoint');
    expect(run.state.difficulty).toBeCloseTo(difficultyOf(plan).value, 5);
    expect(run.state.boss.max).toBe(difficultyMods(run.state.difficulty).boss);
  });

  it('town sells course tiles once you have the cash (and the building, for some)', () => {
    const p = newProfile('TOWN');
    expect(buyTile(p, 'trail')).toBe(false);
    p.cash = 1000;
    p.scrap = 10;
    const trail = p.tiles.trail;
    expect(buyTile(p, 'trail')).toBe(true);
    expect(p.tiles.trail).toBe(trail + 1);
    expect(buyTile(p, 'lift')).toBe(false);
    p.built.push('gondola');
    expect(buyTile(p, 'lift')).toBe(true);
    expect(buyTile(p, 'blackRun')).toBe(false);
  });
});
