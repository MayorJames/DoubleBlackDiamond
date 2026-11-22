import { describe, expect, it } from 'vitest';
import { CARDS, type CardId } from '../src/game/cards';
import { MAP_H, MAP_W } from '../src/game/constants';
import { cell } from '../src/game/map';
import { Run, SPAWNS, SPECIALISTS, type RunEvent } from '../src/game/run';

/** Places `card` on the first cell (scanning from the bottom) that accepts it and returns that cell. */
function place(run: Run, card: CardId, ok: (x: number, y: number) => boolean = () => true): number {
  run.state.hand.unshift(card);
  for (let y = MAP_H - 1; y >= 0; y--)
    for (let x = 0; x < MAP_W; x++)
      if (ok(x, y) && run.canPlace(card, x, y)) {
        run.applyCommands([{ type: 'place', hand: 0, x, y }]);
        return cell(x, y);
      }
  throw new Error(`nowhere to put ${card}`);
}

function steps(run: Run, n: number): RunEvent[] {
  const out: RunEvent[] = [];
  for (let t = 0; t < n && !run.done; t++) {
    run.state.hero.hp = 9999;
    run.step();
    out.push(...run.drainEvents());
  }
  return out;
}

function nextDescent(run: Run): void {
  for (let t = 0; t < 30 * 600 && run.state.status === 'riding'; t++) {
    run.state.hero.hp = 9999;
    run.step();
  }
  run.applyCommands([{ type: 'rideAgain' }]);
}

describe('enemy cards', () => {
  it('at least six enemy types each come from a card of their own', () => {
    const run = Run.create({ seed: 'alpine', deck: ['patrol'] });
    const kinds = new Set<string>();
    const cards: CardId[] = ['patrol', 'sniper', 'garage', 'yetiCave', 'demoShack', 'fieldHospital', 'kennel'];
    for (const card of cards) {
      run.state.enemies = [];
      const at = place(run, card);
      for (let k = 0; k < 6 && !run.state.enemies.some((e) => e.home === at); k++) nextDescent(run);
      const mine = run.state.enemies.filter((e) => e.home === at);
      expect(mine.length, card).toBeGreaterThan(0);
      for (const e of mine) kinds.add(e.kind);
    }
    expect(kinds.size).toBeGreaterThanOrEqual(6);
    expect([...kinds].sort()).toEqual(['guard', 'hound', 'medic', 'sapper', 'sniper', 'snowmobile', 'yeti']);
  });

  it('a kennel lets out 2-3 fast hounds that chase you', () => {
    const run = Run.create({ seed: 'powder', deck: ['patrol'] });
    run.state.enemies = [];
    const at = place(run, 'kennel');
    nextDescent(run);
    const hounds = run.state.enemies.filter((e) => e.home === at);
    expect(hounds.length).toBeGreaterThanOrEqual(SPAWNS.kennel[0]);
    expect(hounds.length).toBeLessThanOrEqual(SPAWNS.kennel[1]);
    for (const h of hounds) expect(h.ride).not.toBeNull();
  });

  it('a medic patches up the enemies around him', () => {
    const run = Run.create({ seed: 'mogul', deck: ['patrol'] });
    run.state.enemies = [];
    const at = place(run, 'fieldHospital');
    const medic = run.state.enemies.find((e) => e.home === at)!;
    expect(medic.kind).toBe('medic');
    run.state.enemies.push({ id: 900, kind: 'guard', level: 1, hp: 2, maxHp: 40, x: medic.x + 1, y: medic.y, ride: null, home: -1, cooldown: 99 });
    // Keep the skier far away so nobody shoots.
    run.state.hero.ride = { at: 0, to: 1, f: 0 };
    const events: RunEvent[] = [];
    for (let t = 0; t < 30 * (SPECIALISTS.healEvery + 0.5); t++) {
      run.applyCommands([]);
      (run as unknown as { abilities: () => void }).abilities();
      events.push(...run.drainEvents());
    }
    expect(events.some((e) => e.type === 'enemyHeal')).toBe(true);
    expect(run.state.enemies.find((e) => e.id === 900)!.hp).toBeGreaterThan(2);
  });

  it('a sapper plants mines that hurt when you ski over them, unless you jump them', () => {
    const run = Run.create({ seed: 'whiteout', deck: ['patrol'] });
    run.state.enemies = [];
    const at = place(run, 'demoShack');
    const sapper = run.state.enemies.find((e) => e.home === at)!;
    expect(sapper.kind).toBe('sapper');
    sapper.ability = 0.01;
    run.state.hero.ride = { at: 0, to: 1, f: 0 };
    (run as unknown as { abilities: () => void }).abilities();
    const planted = run.drainEvents().find((e) => e.type === 'planted');
    expect(planted).toBeDefined();
    expect(run.state.tiles.filter((t) => t?.card === 'mine')).toHaveLength(1);
    expect(CARDS.mine.weight).toBe(0);

    // Ski straight onto a mine: it goes off.
    const hit = Run.create({ seed: 'whiteout', deck: ['patrol'] });
    hit.state.enemies = [];
    const trail = hit.map.nodes.findIndex((n) => n.kind === 'trail');
    const next = hit.map.nodes[trail].next[0];
    const n = hit.map.nodes[next];
    hit.state.tiles[cell(n.x, n.y)] = { card: 'mine', timer: 0, lastLap: -1, variant: null };
    hit.state.hero.ride = { at: trail, to: next, f: 0 };
    hit.state.hero.hp = 100;
    let boom: RunEvent | undefined;
    for (let t = 0; t < 60 && !boom; t++) {
      hit.step();
      boom = hit.drainEvents().find((e) => e.type === 'mine');
    }
    expect(boom).toMatchObject({ type: 'mine', hit: true });
    expect(hit.state.hero.hp).toBeLessThan(100);
    expect(hit.state.tiles[cell(n.x, n.y)]).toBeNull();

    // Off a kicker on the tile before, you sail over it for chips.
    const jump = Run.create({ seed: 'whiteout', deck: ['patrol'] });
    jump.state.enemies = [];
    const a = jump.map.nodes[trail];
    jump.state.tiles[cell(a.x, a.y)] = { card: 'kicker', timer: 0, lastLap: -1, variant: null };
    jump.state.tiles[cell(n.x, n.y)] = { card: 'mine', timer: 0, lastLap: -1, variant: null };
    const before = jump.map.nodes[trail].prev[0];
    jump.state.hero.ride = { at: before, to: trail, f: 0.2 };
    jump.state.hero.hp = 100;
    const events = steps(jump, 90);
    expect(events.find((e) => e.type === 'mine')).toMatchObject({ hit: false });
    expect(jump.state.lapHand.lines.some((l) => l.label === 'Mine jumped')).toBe(true);
  });
});
