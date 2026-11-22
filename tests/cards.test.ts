import { describe, expect, it } from 'vitest';
import { CARD_IDS, CARDS, type CardId } from '../src/game/cards';
import { MAP_H, MAP_W } from '../src/game/constants';
import { BUILDINGS, STARTER_DECK } from '../src/game/lodge';
import { cell } from '../src/game/map';
import { Run, TERRAIN, type RunEvent } from '../src/game/run';

const deckCards = CARD_IDS.filter((id) => CARDS[id].weight > 0);

function placeFirst(run: Run, card: CardId, ok: (x: number, y: number) => boolean = () => true): { x: number; y: number } | null {
  run.state.hand.unshift(card);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++)
      if (ok(x, y) && run.canPlace(card, x, y)) {
        run.applyCommands([{ type: 'place', hand: 0, x, y }]);
        return { x, y };
      }
  run.state.hand.shift();
  return null;
}

describe('the card pool', () => {
  it('has about fifty cards to draw and buy, every one of them unlockable', () => {
    expect(deckCards.length).toBeGreaterThanOrEqual(48);
    const unlockable = new Set<CardId>([...STARTER_DECK, ...BUILDINGS.flatMap((b) => b.unlocks)]);
    for (const id of deckCards) expect(unlockable.has(id), id).toBe(true);
    for (const id of deckCards) expect(CARDS[id].cost).toBeGreaterThan(0);
  });

  it('every card can go somewhere on a fresh mountain (special cards aside)', () => {
    for (const id of deckCards) {
      if (CARDS[id].kind === 'special') continue;
      const run = Run.create({ seed: 'powder', deck: ['pines'] });
      run.state.enemies = [];
      expect(placeFirst(run, id), id).not.toBeNull();
    }
  });
});

describe('new cards', () => {
  it('a supply drop heals, a pep talk adds mult, an intel briefing brings a fragment', () => {
    const run = Run.create({ seed: 'alpine', deck: ['pines'] });
    run.state.hero.hp = 10;
    placeFirst(run, 'supplyDrop');
    expect(run.state.hero.hp).toBe(10 + Math.round(run.stats.maxHp * TERRAIN.supplyHeal));
    const mult = run.state.lapHand.mult;
    placeFirst(run, 'pepTalk');
    expect(run.state.lapHand.mult).toBe(mult + 1);
    placeFirst(run, 'intelBrief');
    expect(run.state.fragments).toBe(1);
    expect(run.state.intel).toBeGreaterThanOrEqual(2);
  });

  it('an airstrike hits everything within a tile of where you click', () => {
    const run = Run.create({ seed: 'alpine', deck: ['pines'] });
    run.state.enemies = [
      { id: 1, kind: 'guard', level: 1, hp: 25, maxHp: 25, x: 10.5, y: 5.5, ride: null, home: -1, cooldown: 9 },
      { id: 2, kind: 'guard', level: 1, hp: 25, maxHp: 25, x: 14.5, y: 5.5, ride: null, home: -1, cooldown: 9 },
    ];
    run.state.hand.unshift('airstrike');
    run.applyCommands([{ type: 'place', hand: 0, x: 10, y: 5 }]);
    expect(run.state.enemies.map((e) => e.id)).toEqual([2]);
  });

  it('a cat track lays a path in a straight line to the next trail', () => {
    let built = 0;
    for (const seed of ['alpine', 'powder', 'mogul', 'yeti', 'whiteout']) {
      const run = Run.create({ seed, deck: ['pines'] });
      if (!placeFirst(run, 'catTrack')) continue;
      built++;
      expect(run.state.routes.at(-1)?.kind).toBe('trail');
      expect(run.map.paths).toHaveLength(1);
    }
    expect(built).toBeGreaterThan(2);
  });

  it('wax stations stack speed for the lap; hamlets cut shop prices', () => {
    const run = Run.create({ seed: 'mogul', deck: ['pines'] });
    run.state.enemies = [];
    const trail = run.map.nodes.findIndex((n, i) => i > run.map.summit && n.kind === 'trail');
    const n = run.map.nodes[run.map.nodes[trail].next[0]];
    run.state.tiles[cell(n.x, n.y)] = { card: 'waxStation', timer: 0, lastLap: -1, variant: null };
    run.state.hero.ride = { at: trail, to: run.map.nodes[trail].next[0], f: 0 };
    for (let t = 0; t < 30; t++) run.step();
    expect(run.state.wax).toBeCloseTo(TERRAIN.wax, 5);
    const price = run.price('patrol');
    placeFirst(run, 'hamlet');
    expect(run.price('patrol')).toBeLessThan(price);
  });

  it('fuel drums go up when something dies beside them', () => {
    const run = Run.create({ seed: 'alpine', deck: ['pines'] });
    const spot = placeFirst(run, 'fuelDrums')!;
    run.state.enemies = [
      { id: 1, kind: 'guard', level: 1, hp: 1, maxHp: 25, x: spot.x + 0.5, y: spot.y + 1.5, ride: null, home: -1, cooldown: 9 },
      { id: 2, kind: 'guard', level: 1, hp: 10, maxHp: 25, x: spot.x + 1.2, y: spot.y + 1.5, ride: null, home: -1, cooldown: 9 },
    ];
    (run as unknown as { damage: (e: unknown, n: number) => void }).damage(run.state.enemies[0], 5);
    expect(run.state.enemies[1].hp).toBeLessThanOrEqual(0);
    expect(run.drainEvents().some((e: RunEvent) => e.type === 'avalanche')).toBe(true);
  });
});
