import { describe, expect, it } from 'vitest';
import { MAP_H, MAP_W } from '../src/game/constants';
import { STARTER_DECK } from '../src/game/lodge';
import { cell } from '../src/game/map';
import { Run, SPAWNS, WAVE, type RunEvent } from '../src/game/run';

const SEEDS = ['alpine', 'powder', 'mogul', 'whiteout', 'yeti', 'QX7P2M', 'B4R0N'];

/** Rides to the lodge, keeping the skier alive, and returns the events on the way. */
function rideLap(run: Run): RunEvent[] {
  const out: RunEvent[] = [];
  for (let t = 0; t < 30 * 600 && run.state.status === 'riding'; t++) {
    run.state.hero.hp = 9999;
    run.step();
    out.push(...run.drainEvents());
  }
  return out;
}

describe('laps', () => {
  it('the first lap already has enemies on the trail, away from the lodge', () => {
    for (const seed of SEEDS) {
      const run = Run.create({ seed, deck: STARTER_DECK });
      const lodge = run.map.nodes[0];
      expect(run.state.enemies.length).toBeGreaterThanOrEqual(WAVE.base);
      for (const e of run.state.enemies) {
        expect(Math.max(Math.abs(Math.floor(e.x) - lodge.x), Math.abs(Math.floor(e.y) - lodge.y))).toBeGreaterThan(2);
      }
    }
  });

  it('waves differ from seed to seed in size and place, but replay exactly', () => {
    const where = (seed: string) => Run.create({ seed, deck: STARTER_DECK }).state.enemies.map((e) => `${Math.floor(e.x)},${Math.floor(e.y)}`).join(' ');
    const layouts = new Set(SEEDS.map(where));
    expect(layouts.size).toBe(SEEDS.length);
    expect(where('alpine')).toBe(where('alpine'));
    const sizes = new Set(SEEDS.map((seed) => Run.create({ seed, deck: STARTER_DECK }).state.enemies.length));
    expect(sizes.size).toBeGreaterThan(1);
  });

  it('every new lap sends a wave, and later laps send more', () => {
    const run = Run.create({ seed: 'alpine', deck: STARTER_DECK });
    const sizes: number[] = [];
    for (let lap = 1; lap <= 7; lap++) {
      rideLap(run);
      run.state.enemies = [];
      run.step([{ type: 'rideAgain' }]);
      const wave = run.drainEvents().find((e) => e.type === 'wave');
      expect(wave).toMatchObject({ type: 'wave', lap: lap + 1, chained: false });
      sizes.push(run.state.enemies.length);
    }
    expect(sizes[6]).toBeGreaterThan(sizes[0]);
  });

  it('enemy cards roll their spawns at the start of each descent', () => {
    const run = Run.create({ seed: 'powder', deck: STARTER_DECK });
    // A patrol post on the trail: one guard on the spot, then 1-2 more each descent, at most 3.
    const spot = run.map.nodes.find((n, i) => i < run.map.loopLength && n.kind === 'trail' && n.y >= 5 && !run.state.enemies.some((e) => Math.floor(e.x) === n.x && Math.floor(e.y) === n.y))!;
    run.state.hand.unshift('patrol');
    run.step([{ type: 'place', hand: 0, x: spot.x, y: spot.y }]);
    const post = cell(spot.x, spot.y);
    const guards = () => run.state.enemies.filter((e) => e.home === post).length;
    expect(guards()).toBe(1);
    const counts: number[] = [];
    for (let lap = 0; lap < 6; lap++) {
      rideLap(run);
      run.state.enemies = run.state.enemies.filter((e) => e.home !== post);
      run.step([{ type: 'rideAgain' }]);
      counts.push(guards());
    }
    for (const n of counts) expect(n).toBeGreaterThanOrEqual(SPAWNS.patrol[0]);
    for (const n of counts) expect(n).toBeLessThanOrEqual(SPAWNS.patrol[1]);
    expect(new Set(counts).size).toBe(2);
  });

  it('there is no clock: nothing spawns mid-descent without a card or a boss', () => {
    const run = Run.create({ seed: 'mogul', deck: STARTER_DECK });
    const before = run.state.nextId;
    run.state.enemies = [];
    for (let t = 0; t < 30 * 8; t++) {
      run.state.hero.hp = 9999;
      run.step();
    }
    expect(run.state.nextId).toBe(before);
  });

  it('powder heals once a lap', () => {
    const run = Run.create({ seed: 'alpine', deck: STARTER_DECK });
    let spot = -1;
    for (let c = 0; c < MAP_W * MAP_H && spot < 0; c++) if (run.canPlace('powder', c % MAP_W, Math.floor(c / MAP_W))) spot = c;
    run.state.hand.unshift('powder');
    run.step([{ type: 'place', hand: 0, x: spot % MAP_W, y: Math.floor(spot / MAP_W) }]);
    rideLap(run);
    run.state.hero.hp = 10;
    run.step([{ type: 'rideAgain' }]);
    expect(run.state.hero.hp).toBeGreaterThanOrEqual(18);
  });
});

describe('the shop', () => {
  it('offers three cards from your deck, priced in points that rise each lap', () => {
    const run = Run.create({ seed: 'alpine', deck: STARTER_DECK });
    expect(run.state.shop).toHaveLength(3);
    expect(new Set(run.state.shop.map((o) => o.card)).size).toBe(3);
    for (const o of run.state.shop) {
      expect(STARTER_DECK).toContain(o.card);
      expect(o.price).toBe(run.price(o.card));
    }
    const lap1 = run.price('patrol');
    run.state.lap = 5;
    expect(run.price('patrol')).toBeGreaterThan(lap1);
  });

  it('buying puts the card in your hand, costs its price, and rerolls the offers', () => {
    const run = Run.create({ seed: 'powder', deck: STARTER_DECK });
    run.state.points = 1000;
    const offer = run.state.shop[1];
    const hand = run.state.hand.length;
    const before = JSON.stringify(run.state.shop);
    run.applyCommands([{ type: 'buy', offer: 1 }]);
    expect(run.state.hand).toHaveLength(hand + 1);
    expect(run.state.hand.at(-1)).toBe(offer.card);
    expect(run.state.points).toBe(1000 - offer.price);
    expect(JSON.stringify(run.state.shop)).not.toBe(before);
    expect(run.drainEvents().some((e) => e.type === 'bought')).toBe(true);
  });

  it("can't buy what you can't afford; rerolling costs more each time in a lap", () => {
    const run = Run.create({ seed: 'mogul', deck: STARTER_DECK });
    run.state.points = 5;
    const shop = JSON.stringify(run.state.shop);
    run.applyCommands([{ type: 'buy', offer: 0 }, { type: 'reroll' }]);
    expect(JSON.stringify(run.state.shop)).toBe(shop);
    expect(run.state.points).toBe(5);
    run.state.points = 100;
    const first = run.rerollPrice();
    run.applyCommands([{ type: 'reroll' }]);
    expect(run.state.points).toBe(100 - first);
    expect(run.rerollPrice()).toBeGreaterThan(first);
  });

  it('points are chips at your mult at the moment you earn them', () => {
    const run = Run.create({ seed: 'alpine', deck: STARTER_DECK });
    run.state.enemies = [];
    run.state.lapHand.mult = 3;
    const before = run.state.points;
    const chips = run.state.lapHand.chips;
    for (let t = 0; t < 30 * 16; t++) run.step([{ type: 'stance', stance: 'cruise' }]);
    const earned = run.state.lapHand.chips - chips;
    expect(earned).toBeGreaterThan(0);
    expect(run.state.points - before).toBeCloseTo(earned * 3, 5);
  });

  it('kills pay a bounty that banks at the lodge; chairlifts are rare and capped at two', () => {
    const run = Run.create({ seed: 'alpine', deck: ['patrol', 'chairlift', 'pines', 'boulder', 'moguls'] });
    run.applyCommands([{ type: 'stance', stance: 'plow' }]);
    const lap = rideLap(run).find((e) => e.type === 'lap');
    expect(lap?.type === 'lap' ? lap.kills : 0).toBeGreaterThan(0);
    expect(run.state.cash).toBe(lap?.type === 'lap' ? lap.bounty : -1);
    let lifts = 0;
    for (let k = 0; k < 4; k++) {
      run.state.hand.unshift('chairlift');
      let placed = false;
      for (let c = 0; c < MAP_W * MAP_H && !placed; c++) {
        const x = c % MAP_W;
        const y = Math.floor(c / MAP_W);
        if (run.canPlace('chairlift', x, y)) {
          run.applyCommands([{ type: 'place', hand: 0, x, y }]);
          placed = true;
          lifts++;
        }
      }
      if (!placed) run.state.hand.shift();
    }
    expect(lifts).toBe(2);
  });
});
