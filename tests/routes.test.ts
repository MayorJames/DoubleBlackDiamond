import { describe, expect, it } from 'vitest';
import { CARDS, type CardId } from '../src/game/cards';
import { MAP_H, MAP_W } from '../src/game/constants';
import { build, bankRun, DECK_MAX, DECK_MIN, deckFor, newProfile, STARTER_DECK, toggleCard, unlockedCards } from '../src/game/lodge';
import { cell, generateMap, LODGE, routeCourse, type RouteKind } from '../src/game/map';
import { Run, type Command, type RunEvent } from '../src/game/run';

const SEEDS = ['alpine', 'powder', 'mogul', 'whiteout', 'yeti', 'QX7P2M', 'B4R0N'];
const ALL = Object.keys(CARDS) as CardId[];

/** Every cell a route of this kind could leave from on a fresh run. */
function routeSpots(run: Run, kind: RouteKind): { x: number; y: number; cells: number[]; end: number }[] {
  const out = [];
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const course = routeCourse(run.map, kind, x, y, (c) => !!run.state.tiles[c]);
      if (course) out.push({ x, y, ...course });
    }
  return out;
}

/** Places a route card on the spot whose route is longest (the most dramatic one). */
function placeRoute(run: Run, card: 'chairlift' | 'chute'): { x: number; y: number } {
  const spots = routeSpots(run, card === 'chairlift' ? 'lift' : 'chute');
  const best = spots.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
  run.state.hand.unshift(card);
  run.step([{ type: 'place', hand: 0, x: best.x, y: best.y }]);
  return best;
}

/** Steps with the skier made unkillable, collecting events, until `until` holds or time runs out. */
function ride(run: Run, until: (events: RunEvent[]) => boolean, commands: (t: number) => Command[] = () => []): RunEvent[] {
  const all: RunEvent[] = [];
  for (let t = 0; t < 30 * 300 && !run.done; t++) {
    run.state.hero.hp = Math.max(run.state.hero.hp, 500);
    run.step(commands(t));
    const events = run.drainEvents();
    all.push(...events);
    if (until(events)) break;
  }
  return all;
}

const lapEnds = (events: RunEvent[]) => events.some((e) => e.type === 'lap');

describe('routes', () => {
  it('lifts climb from trail back up to earlier trail; chutes drop to later trail', () => {
    for (const seed of SEEDS) {
      const map = generateMap(seed);
      for (const kind of ['lift', 'chute'] as const) {
        let count = 0;
        for (let y = 0; y < MAP_H; y++)
          for (let x = 0; x < MAP_W; x++) {
            const course = routeCourse(map, kind, x, y);
            if (!course) continue;
            count++;
            const start = map.index[cell(x, y)];
            expect(map.nodes[start].kind).toBe('trail');
            expect(map.nodes[course.end].kind).toBe('trail');
            expect(course.cells.length).toBeGreaterThanOrEqual(2);
            for (const c of course.cells) expect(map.index[c]).toBe(-1);
            // Base-loop order: a lift lands earlier, a chute later.
            if (kind === 'lift') expect(course.end).toBeLessThan(start);
            else expect(course.end).toBeGreaterThan(start);
          }
        expect(count, `${seed} has somewhere to put a ${kind}`).toBeGreaterThan(0);
      }
    }
  });

  it("can't cross anything you've placed, and a junction holds one route", () => {
    const run = Run.create({ seed: 'alpine', deck: ALL });
    const spot = routeSpots(run, 'lift')[0];
    const blocker = spot.cells[0];
    run.state.tiles[blocker] = { card: 'boulder', timer: 4, lastLap: -1, variant: null };
    expect(run.canPlace('chairlift', spot.x, spot.y)).toBe(false);
    run.state.tiles[blocker] = null;
    expect(run.canPlace('chairlift', spot.x, spot.y)).toBe(true);
    placeRoute(run, 'chairlift');
    const placed = run.state.routes[0];
    expect(run.canPlace('chairlift', placed.x, placed.y)).toBe(false);
    expect(run.canPlace('chute', placed.x, placed.y)).toBe(false);
    // The new lift is path now, so roadside cards can go beside it.
    const liftNode = run.map.lifts[1].nodes[0];
    const { x, y } = run.map.nodes[liftNode];
    expect(run.canPlace('cabin', x - 1, y) || run.canPlace('cabin', x + 1, y)).toBe(true);
  });

  it('a chairlift chains another descent: +1 mult, and enemies after it arrive a level up', () => {
    const run = Run.create({ seed: 'alpine', deck: STARTER_DECK });
    placeRoute(run, 'chairlift');
    expect(run.map.lifts).toHaveLength(2);
    expect(run.nextJunction()).toBe(0);
    const before = ride(run, (e) => e.some((x) => x.type === 'chain'));
    expect(before.some((e) => e.type === 'lap')).toBe(false);
    expect(run.state.descent).toBe(2);
    expect(run.state.lap).toBe(1);
    expect(run.map.nodes[run.state.hero.ride.to].kind).toBe('lift');

    // Ski on next time and the lap ends at the lodge with two descents in it.
    run.step([{ type: 'switch', route: 0 }]);
    expect(run.state.routes[0].take).toBe(false);
    const events = ride(run, lapEnds);
    const lap = events.find((e) => e.type === 'lap');
    expect(lap?.type === 'lap' && lap.descents).toBe(2);
    const chained = lap?.type === 'lap' ? lap.lines.find((l) => l.label === 'Chained descents') : undefined;
    expect(chained?.mult).toBe(1);

    run.step([{ type: 'rideAgain' }]);
    expect(run.state.descent).toBe(3);
    run.state.hand.unshift('patrol');
    const trail = run.map.nodes.find((n, i) => n.kind === 'trail' && n.next.length === 1 && run.canPlace('patrol', n.x, n.y) && i > 0)!;
    run.step([{ type: 'place', hand: 0, x: trail.x, y: trail.y }]);
    expect(run.state.enemies.at(-1)!.level).toBe(3);
  });

  it('a junction switched off is skied straight past', () => {
    const run = Run.create({ seed: 'alpine', deck: STARTER_DECK });
    placeRoute(run, 'chairlift');
    run.step([{ type: 'switch', route: 0 }]);
    const events = ride(run, lapEnds);
    expect(events.some((e) => e.type === 'chain')).toBe(false);
    const lap = events.find((e) => e.type === 'lap');
    expect(lap?.type === 'lap' && lap.descents).toBe(1);
  });

  it('a chute is a faster lap that pays steep mult', () => {
    const lapTicks = (take: boolean) => {
      const run = Run.create({ seed: 'powder', deck: STARTER_DECK });
      placeRoute(run, 'chute');
      if (!take) run.step([{ type: 'switch', route: 0 }]);
      let ticks = 0;
      const events = ride(run, (e) => {
        ticks++;
        return lapEnds(e);
      });
      const lap = events.find((e) => e.type === 'lap');
      return { ticks, steep: lap?.type === 'lap' ? lap.lines.find((l) => l.label === 'Steep') : undefined };
    };
    const chute = lapTicks(true);
    const trail = lapTicks(false);
    expect(chute.ticks).toBeLessThan(trail.ticks);
    expect(chute.steep?.mult).toBeGreaterThan(0.3);
    expect(trail.steep).toBeUndefined();
  });

  it('chasers follow the same switches', () => {
    const run = Run.create({ seed: 'powder', deck: STARTER_DECK });
    const spot = placeRoute(run, 'chute');
    const junction = run.map.index[cell(spot.x, spot.y)];
    const chute = run.map.chutes[0];
    // Drop a snowmobile just before the junction and watch where it goes.
    const prev = run.map.nodes[junction].prev[0];
    run.state.enemies.push({ id: 900, kind: 'snowmobile', level: 1, hp: 999, maxHp: 999, x: 0, y: 0, ride: { at: prev, to: junction, f: 0 }, home: -1, cooldown: 99 });
    let entered = false;
    for (let t = 0; t < 60 && !entered; t++) {
      run.state.hero.hp = 500;
      run.step();
      const sled = run.state.enemies.find((e) => e.id === 900)!;
      if (chute.nodes.includes(sled.ride!.at) || chute.nodes.includes(sled.ride!.to)) entered = true;
    }
    expect(entered).toBe(true);
  });

  it('replays identically with routes and switches, and resumes from a snapshot', () => {
    const script = (run: Run, t: number): Command[] => {
      const cmds: Command[] = [];
      if (t % 90 === 0) cmds.push({ type: 'stance', stance: (['tuck', 'cruise', 'plow'] as const)[(t / 90) % 3] });
      if (t === 10 || t === 700) {
        const card = t === 10 ? 'chairlift' : 'chute';
        const spot = routeSpots(run, card === 'chairlift' ? 'lift' : 'chute')[0];
        run.state.hand.unshift(card);
        if (spot) cmds.push({ type: 'place', hand: 0, x: spot.x, y: spot.y });
      }
      if (t % 450 === 300 && run.state.routes.length) cmds.push({ type: 'switch', route: (t / 450) % run.state.routes.length | 0 });
      if (t % 200 === 5 && run.state.hand.length) {
        const card = run.state.hand[run.state.hand.length - 1];
        outer: for (let y = 0; y < MAP_H; y++)
          for (let x = 0; x < MAP_W; x++)
            if (run.canPlace(card, x, y)) {
              cmds.push({ type: 'place', hand: run.state.hand.length - 1, x, y });
              break outer;
            }
      }
      if (run.state.status === 'lodge') cmds.push({ type: 'rideAgain' });
      return cmds;
    };
    const play = (run: Run, from: number, to: number) => {
      for (let t = from; t < to && !run.done; t++) {
        run.state.hero.hp = Math.max(run.state.hero.hp, 1);
        run.step(script(run, t));
      }
    };
    const a = Run.create({ seed: 'replay', deck: ALL });
    const b = Run.create({ seed: 'replay', deck: ALL });
    play(a, 0, 3000);
    play(b, 0, 1500);
    const saved = JSON.stringify(b.snapshot());
    play(b, 1500, 3000);
    const c = Run.restore(saved);
    play(c, 1500, 3000);
    expect(a.state.routes.length).toBeGreaterThan(0);
    expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state));
    expect(JSON.stringify(c.state)).toBe(JSON.stringify(a.state));
    expect(c.map.nodes.length).toBe(a.map.nodes.length);
  });

  it('the skier starts at the lodge heading up the main lift', () => {
    const run = Run.create({ seed: 'alpine', deck: STARTER_DECK });
    expect(run.state.hero.ride.at).toBe(LODGE);
    expect(run.map.nodes[run.state.hero.ride.to].kind).toBe('lift');
    expect(run.nextJunction()).toBe(-1);
  });
});

describe('the deck', () => {
  it('starts with the starter cards, takes new unlocks while there is room, and stays within limits', () => {
    const p = newProfile();
    expect(deckFor(p)).toEqual(STARTER_DECK);
    expect(deckFor(p)).toContain('chairlift');
    bankRun(p, 'retreated', { cash: 100000, intel: 100, scrap: 100, fraction: 1 }, 0);
    expect(build(p, 'trailCrew')).toBe(true);
    expect(deckFor(p)).toContain('chute');
    for (const id of ['patrolHut', 'radio', 'gondola', 'avalancheControl', 'spyHq'] as const) build(p, id);
    expect(unlockedCards(p).length).toBeGreaterThan(DECK_MAX);
    expect(deckFor(p)).toHaveLength(DECK_MAX);

    // Full: nothing more goes in until something comes out.
    const outside = unlockedCards(p).find((c) => !deckFor(p).includes(c))!;
    expect(toggleCard(p, outside)).toBe(false);
    expect(toggleCard(p, 'moguls')).toBe(true);
    expect(toggleCard(p, outside)).toBe(true);
    expect(deckFor(p)).toContain(outside);
    expect(deckFor(p)).not.toContain('moguls');

    // Never below the minimum.
    while (deckFor(p).length > DECK_MIN) toggleCard(p, deckFor(p)[0]);
    expect(toggleCard(p, deckFor(p)[0])).toBe(false);
    expect(deckFor(p)).toHaveLength(DECK_MIN);
  });

  it("an expedition only draws from the deck you chose", () => {
    const deck: CardId[] = ['chairlift', 'pines', 'boulder', 'moguls'];
    const run = Run.create({ seed: 'alpine', deck });
    for (let i = 0; i < 40; i++) run.drawCard();
    for (const card of run.state.hand) expect(deck).toContain(card);
  });
});

describe('dossier bosses', () => {
  /** A run with a chairlift built, so fragments can drop. */
  function withLift(seed = 'alpine'): Run {
    const run = Run.create({ seed, deck: STARTER_DECK });
    placeRoute(run, 'chairlift');
    run.drainEvents();
    return run;
  }
  /** Kills an enemy of `kind` right next to the skier by dropping its HP to 1. */
  function killNear(run: Run, kind: 'yeti' | 'guard'): RunEvent[] {
    const me = run.heroPos();
    run.state.enemies.push({ id: 5000 + run.state.tick, kind, level: 1, hp: 1, maxHp: 1, x: me.x, y: me.y, ride: null, home: -1, cooldown: 99 });
    run.state.hero.cooldown = 0;
    run.state.hero.stance = 'plow';
    const out: RunEvent[] = [];
    for (let t = 0; t < 120 && run.state.enemies.some((e) => e.id >= 5000); t++) {
      run.state.hero.hp = 500;
      run.state.hero.cooldown = Math.min(run.state.hero.cooldown, 0);
      run.step();
      out.push(...run.drainEvents());
      for (const e of run.state.enemies) if (e.id >= 5000) Object.assign(e, run.heroPos());
    }
    return out;
  }

  it('fragments only drop once the mountain has a lift you built, and three make a dossier', () => {
    const bare = Run.create({ seed: 'alpine', deck: STARTER_DECK });
    killNear(bare, 'yeti');
    expect(bare.state.fragments).toBe(0);

    const run = withLift();
    const events = [...killNear(run, 'yeti'), ...killNear(run, 'yeti'), ...killNear(run, 'yeti')];
    expect(events.filter((e) => e.type === 'fragment')).toHaveLength(3);
    const dossier = events.find((e) => e.type === 'dossier');
    expect(dossier).toBeDefined();
    expect(run.state.fragments).toBe(0);
    expect(run.state.hand.some((c) => c.startsWith('dossier'))).toBe(true);
  });

  it('the Ice Widow freezes the trail around her; the Yeti King calls yetis; Kickback chases', () => {
    const summon = (card: CardId) => {
      const run = withLift('powder');
      const node = run.map.nodes.find((n, i) => i < run.map.loopLength && n.kind === 'trail' && n.y >= 4 && run.canPlace(card, n.x, n.y))!;
      run.state.hand.unshift(card);
      run.step([{ type: 'place', hand: 0, x: node.x, y: node.y }]);
      return { run, node, events: run.drainEvents() };
    };
    const widow = summon('dossierWidow');
    expect(widow.events.some((e) => e.type === 'bossArrives' && e.kind === 'widow')).toBe(true);
    expect(widow.run.state.tiles.filter((t) => t?.card === 'ice').length).toBeGreaterThan(0);

    const king = summon('dossierYetiKing');
    const yetis = () => king.run.state.enemies.filter((e) => e.kind === 'yeti').length;
    const before = yetis();
    for (let t = 0; t < 30 * 10 + 5; t++) {
      king.run.state.hero.hp = 999;
      king.run.step();
    }
    expect(yetis()).toBeGreaterThan(before);

    const kick = summon('dossierKickback');
    const captain = kick.run.state.enemies.find((e) => e.kind === 'kickback')!;
    expect(captain.ride).not.toBeNull();
  });

  it('beating a dossier boss pays a bounty and drops its one-of-a-kind reward', () => {
    const run = withLift('powder');
    const me = run.heroPos();
    run.state.enemies.push({ id: 7000, kind: 'widow', level: 1, hp: 1, maxHp: 200, x: me.x, y: me.y, ride: null, home: -1, cooldown: 99 });
    const cash = run.state.cash;
    const events: RunEvent[] = [];
    for (let t = 0; t < 200 && run.state.enemies.some((e) => e.id === 7000); t++) {
      run.state.hero.hp = 999;
      run.step([{ type: 'stance', stance: 'plow' }]);
      events.push(...run.drainEvents());
      const w = run.state.enemies.find((e) => e.id === 7000);
      if (w) Object.assign(w, run.heroPos());
    }
    expect(events.some((e) => e.type === 'bossDown' && e.kind === 'widow')).toBe(true);
    expect(run.state.cash).toBeGreaterThanOrEqual(cash + 1000);
    const monocle = run.state.inventory.find((i) => i.gadget === 'monocle');
    expect(monocle?.unique).toBe(true);
    expect(run.state.record.bosses).toEqual(['widow']);
  });

  it("bosses' one-of-a-kind gadgets never turn up as ordinary loot", async () => {
    const { rollItem } = await import('../src/game/items');
    const { Rng } = await import('../src/game/rng');
    const rng = Rng.fromSeed('loot');
    for (let i = 0; i < 3000; i++) {
      const item = rollItem(rng, i, 5, 0.3, true);
      expect(item.unique).toBeUndefined();
      expect(['monocle', 'sled']).not.toContain(item.gadget);
    }
  });
});

describe('weather', () => {
  it('lasts three days, then clears', () => {
    const run = Run.create({ seed: 'alpine', deck: STARTER_DECK });
    run.state.hand.unshift('night');
    run.step([{ type: 'place', hand: 0, x: 0, y: 0 }]);
    expect(run.state.weather).toEqual({ kind: 'night', days: 3 });
    const events = ride(
      run,
      () => run.state.weather === null,
      () => (run.state.status === 'lodge' ? [{ type: 'rideAgain' }] : []),
    );
    expect(events.some((e) => e.type === 'weather' && e.kind === null)).toBe(true);
    expect(run.state.day).toBe(4);
  });

  it('a whiteout keeps a guard just out of sight from shooting, and doubles kill chips', () => {
    const shotsAt = (weather: boolean) => {
      const run = Run.create({ seed: 'alpine', deck: STARTER_DECK });
      if (weather) {
        run.state.hand.unshift('whiteout');
        run.step([{ type: 'place', hand: 0, x: 0, y: 0 }]);
      }
      run.drainEvents();
      let shots = 0;
      for (let t = 0; t < 90; t++) {
        const me = run.heroPos();
        // A guard 1.2 tiles away: in reach normally (1.4), out of it in a whiteout (0.84).
        run.state.enemies = [{ id: 1, kind: 'guard', level: 1, hp: 999, maxHp: 999, x: me.x + 1.2, y: me.y, ride: null, home: -1, cooldown: 0 }];
        run.state.hero.hp = 999;
        run.step();
        shots += run.drainEvents().filter((e) => e.type === 'enemyShot').length;
      }
      return shots;
    };
    expect(shotsAt(false)).toBeGreaterThan(0);
    expect(shotsAt(true)).toBe(0);
  });
});
