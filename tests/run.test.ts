import { describe, expect, it } from 'vitest';
import { CARDS, type CardId } from '../src/game/cards';
import { DT, MAP_H, MAP_W } from '../src/game/constants';
import { bankRun, build, deckFor, newProfile, STARTER_DECK } from '../src/game/lodge';
import { cell, generateMap, isPath, isRoadside, LODGE, neighbours, type MountainMap } from '../src/game/map';
import { Run, type Command } from '../src/game/run';

const besideTrail = (map: MountainMap, x: number, y: number) =>
  !isPath(map, x, y) && neighbours(x, y).some(([nx, ny]) => map.nodes[map.index[cell(nx, ny)]]?.kind === 'trail');

const SEEDS = ['alpine', 'powder', 'mogul', 'whiteout', 'yeti', 'QX7P2M', 'B4R0N'];
const ALL: CardId[] = Object.keys(CARDS) as CardId[];

function newRun(seed = 'alpine', deck: CardId[] = STARTER_DECK) {
  return Run.create({ seed, deck });
}

/** Steps until the run stops at the lodge (or ends), returning ticks taken. */
function rideLap(run: Run, commands: () => Command[] = () => []): number {
  let ticks = 0;
  while (run.state.status === 'riding' && ticks < 30 * 600) {
    run.step(commands());
    ticks++;
  }
  return ticks;
}

/** Puts a card in the hand and places it on the first cell that accepts it. */
function placeAnywhere(run: Run, card: CardId, filter: (x: number, y: number) => boolean = () => true): boolean {
  run.state.hand.unshift(card);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      if (filter(x, y) && run.canPlace(card, x, y)) {
        run.step([{ type: 'place', hand: 0, x, y }]);
        return true;
      }
  run.state.hand.shift();
  return false;
}

describe('the loop', () => {
  it('is a closed circuit from the lodge, up the lift and down the trail', () => {
    for (const seed of SEEDS) {
      const map = generateMap(seed);
      const { nodes } = map;
      expect(nodes[LODGE].kind).toBe('lodge');
      expect(nodes[map.summit].kind).toBe('summit');
      expect(nodes.length).toBe(map.loopLength);
      const seen = new Set<number>();
      nodes.forEach((p, i) => {
        expect(p.next).toEqual([(i + 1) % nodes.length]);
        const next = nodes[p.next[0]];
        expect(Math.abs(p.x - next.x) + Math.abs(p.y - next.y)).toBe(1);
        expect(p.x >= 0 && p.y >= 0 && p.x < MAP_W && p.y < MAP_H).toBe(true);
        seen.add(cell(p.x, p.y));
        if (i > 0 && i < map.summit) expect(p.kind).toBe('lift');
      });
      expect(seen.size).toBe(nodes.length);
      expect(nodes.length).toBeGreaterThan(28);
    }
  });

  it('is the same loop for the same seed', () => {
    expect(generateMap('alpine').nodes).toEqual(generateMap('alpine').nodes);
    expect(generateMap('alpine').nodes).not.toEqual(generateMap('powder').nodes);
  });
});

describe('cards', () => {
  it('go where their kind allows', () => {
    const run = newRun();
    const map = run.map;
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        const i = map.index[cell(x, y)];
        expect(run.canPlace('patrol', x, y)).toBe(i >= 0 && map.nodes[i].kind === 'trail');
        expect(run.canPlace('cabin', x, y)).toBe(isRoadside(map, x, y));
        expect(run.canPlace('boulder', x, y)).toBe(!isPath(map, x, y));
        expect(run.canPlace('avalanche', x, y)).toBe(false);
      }
    }
  });

  it('a 3x3 of peaks and boulders makes a Double Black Diamond worth 40 max HP', () => {
    const run = newRun('alpine', ALL);
    const map = run.map;
    let spot: [number, number] | null = null;
    for (let y = 1; y < MAP_H - 1 && !spot; y++)
      for (let x = 1; x < MAP_W - 1 && !spot; x++) {
        let clear = true;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (isPath(map, x + dx, y + dy)) clear = false;
        if (clear) spot = [x, y];
      }
    expect(spot).not.toBeNull();
    const [cx, cy] = spot!;
    const hpBefore = run.stats.maxHp;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        run.state.hand.unshift(dx === 0 && dy === 0 ? 'peak' : 'boulder');
        run.step([{ type: 'place', hand: 0, x: cx + dx, y: cy + dy }]);
      }
    expect(run.state.tiles[cell(cx, cy)]?.variant).toBe('dbd');
    expect(run.stats.maxHp).toBe(hpBefore + 8 * 4 + 8 + 40);
    expect(run.drainEvents().some((e) => e.type === 'doubleBlack')).toBe(true);
  });

  it('a patrol post fields a guard straight away', () => {
    const run = newRun();
    placeAnywhere(run, 'patrol', (_x, y) => y > 4);
    const post = run.state.tiles.findIndex((t) => t?.card === 'patrol');
    expect(run.state.enemies.filter((e) => e.kind === 'guard' && e.home === post)).toHaveLength(1);
  });
});

describe('a run', () => {
  it('replays identically from seed and commands, and resumes from a snapshot', () => {
    const script = (run: Run, t: number): Command[] => {
      const cmds: Command[] = [];
      if (t % 90 === 0) cmds.push({ type: 'stance', stance: (['tuck', 'cruise', 'plow'] as const)[(t / 90) % 3] });
      if (t % 200 === 5 && run.state.hand.length) {
        const card = run.state.hand[0];
        outer: for (let y = 0; y < MAP_H; y++)
          for (let x = 0; x < MAP_W; x++)
            if (run.canPlace(card, x, y)) {
              cmds.push({ type: 'place', hand: 0, x, y });
              break outer;
            }
      }
      if (run.state.status === 'lodge') cmds.push({ type: 'rideAgain' });
      return cmds;
    };
    const play = (run: Run, from: number, to: number) => {
      for (let t = from; t < to && !run.done; t++) run.step(script(run, t));
    };
    const a = newRun('replay', ALL);
    const b = newRun('replay', ALL);
    play(a, 0, 3000);
    play(b, 0, 1500);
    const saved = JSON.stringify(b.snapshot());
    play(b, 1500, 3000);
    const c = Run.restore(saved);
    play(c, 1500, 3000);
    expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state));
    expect(JSON.stringify(c.state)).toBe(JSON.stringify(a.state));
  });

  it('stops at the lodge after a lap, cashes chips x mult, and rides again a level harder', () => {
    const run = newRun();
    placeAnywhere(run, 'pines', (x, y) => besideTrail(run.map, x, y));
    rideLap(run);
    expect(run.state.status).toBe('lodge');
    const lap = run.drainEvents().find((e) => e.type === 'lap');
    expect(lap).toBeDefined();
    if (lap?.type === 'lap') expect(lap.points).toBe(Math.round(lap.chips * lap.mult));
    expect(run.state.cash).toBeGreaterThan(0);
    run.step([{ type: 'rideAgain' }]);
    expect(run.state.status).toBe('riding');
    expect(run.state.lap).toBe(2);
    placeAnywhere(run, 'patrol', (_x, y) => y > 4);
    expect(run.state.enemies.at(-1)!.level).toBe(2);
  });

  it('tucking laps faster and builds more mult; snowplowing drops more guards', () => {
    const lap = (stance: 'tuck' | 'plow') => {
      const run = newRun('gauntlet');
      for (let i = 0; i < 6; i++) placeAnywhere(run, 'patrol', (x, y) => y >= 3 && (x + y) % 2 === 0);
      run.step([{ type: 'stance', stance }]);
      const ticks = rideLap(run, () => {
        run.state.hero.hp = Math.max(run.state.hero.hp, 500);
        return [];
      });
      const result = run.drainEvents().find((e) => e.type === 'lap');
      return { seconds: ticks * DT, kills: run.state.record.kills, mult: result?.type === 'lap' ? result.mult : 0 };
    };
    const tuck = lap('tuck');
    const plow = lap('plow');
    expect(tuck.seconds).toBeLessThan(plow.seconds * 0.75);
    expect(tuck.mult).toBeGreaterThan(plow.mult + 1);
    expect(plow.kills).toBeGreaterThan(tuck.kills);
  });

  it('pays 100% for calling it a day, 60% for bailing out and 30% for a wipeout', () => {
    const fresh = () => {
      const run = newRun();
      run.state.cash = 1000;
      run.state.intel = 10;
      run.state.scrap = 10;
      return run;
    };
    const home = fresh();
    home.state.status = 'lodge';
    home.step([{ type: 'retreat' }]);
    const bail = fresh();
    bail.step([{ type: 'bail' }]);
    const wipe = fresh();
    wipe.state.hero.hp = 0.01;
    const at = wipe.heroPos();
    wipe.state.enemies.push({ id: 99, kind: 'guard', level: 1, hp: 50, maxHp: 50, x: at.x, y: at.y, ride: null, home: -1, cooldown: 0 });
    wipe.state.hero.stance = 'plow';
    for (let i = 0; i < 600 && !wipe.done; i++) {
      wipe.state.enemies[0].x = wipe.heroPos().x;
      wipe.state.enemies[0].y = wipe.heroPos().y;
      wipe.step();
    }
    const rating = 0.75; // Bunny Hill pays three quarters
    expect(home.state.payout).toMatchObject({ fraction: 1, cash: 1000 * rating, intel: 10 });
    expect(bail.state.payout).toMatchObject({ fraction: 0.6, cash: Math.floor(600 * rating), intel: 6 });
    expect(wipe.state.status).toBe('wiped');
    expect(wipe.state.payout).toMatchObject({ fraction: 0.3, intel: 3 });
  });

  it('filling the boss meter brings the Baron; beating him wins the expedition', () => {
    const run = newRun('alpine', ALL);
    let placed = 0;
    while (!run.state.boss.spawned && placed < 40) {
      const card = (['boulder', 'pines', 'powder'] as const)[placed % 3];
      if (!placeAnywhere(run, card)) break;
      placed++;
    }
    expect(run.state.boss.spawned).toBe(true);
    const baron = run.state.enemies.find((e) => e.kind === 'baron')!;
    expect(baron).toBeDefined();
    baron.hp = 1;
    baron.ride = { ...run.state.hero.ride };
    run.state.hero.hp = 9999;
    for (let i = 0; i < 600 && !run.done; i++) run.step([{ type: 'stance', stance: 'plow' }]);
    expect(run.state.status).toBe('won');
    expect(run.state.payout!.fraction).toBe(1);
  });
});

describe('the lodge', () => {
  it('buildings cost resources, unlock cards, and bosses unlock harder trails', () => {
    const p = newProfile();
    expect(deckFor(p)).toEqual(STARTER_DECK);
    expect(build(p, 'patrolHut')).toBe(false);
    bankRun(p, 'retreated', { cash: 1000, intel: 10, scrap: 0, fraction: 1 }, 0);
    expect(build(p, 'patrolHut')).toBe(true);
    expect(deckFor(p)).toContain('cache');
    expect(p.cash).toBe(700);
    bankRun(p, 'won', { cash: 0, intel: 0, scrap: 0, fraction: 1 }, 0);
    expect(p.rating).toBe(1);
  });
});
