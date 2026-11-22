import { describe, expect, it } from 'vitest';
import { DROPPABLE, ITEM_BY_ID, ITEM_DEFS, makeItem, MODS, rollItem } from '../src/game/items';
import { Rng } from '../src/game/rng';
import { Run, type RunEvent } from '../src/game/run';
import type { Enemy } from '../src/game/enemies';

const guard = (id: number, x: number, y: number, hp = 30): Enemy => ({ id, kind: 'guard', level: 1, hp, maxHp: hp, x, y, ride: null, home: -1, cooldown: 99 });

/** A run with the skier out on the trail, no enemies, and the given item worn. */
function wearing(def: string, seed = 'alpine'): Run {
  const run = Run.create({ seed, deck: ['pines'] });
  run.state.enemies = [];
  const item = makeItem(ITEM_BY_ID[def], 900, 1);
  const slot = item.slot === 'gadget' ? 'gadget1' : item.slot;
  run.state.equipment[slot] = item;
  const trail = run.map.nodes.findIndex((n, i) => i > run.map.summit + 2 && n.kind === 'trail');
  run.state.hero.ride = { at: trail, to: run.map.nodes[trail].next[0], f: 0 };
  return run;
}

describe('the gear catalogue', () => {
  it('holds fifty to a hundred named items, every mod described', () => {
    expect(ITEM_DEFS.length).toBeGreaterThanOrEqual(50);
    expect(ITEM_DEFS.length).toBeLessThanOrEqual(100);
    expect(new Set(ITEM_DEFS.map((d) => d.id)).size).toBe(ITEM_DEFS.length);
    for (const d of ITEM_DEFS) if (d.mod) expect(MODS[d.mod], d.id).toBeTruthy();
    const withMods = ITEM_DEFS.filter((d) => d.mod).length;
    expect(withMods).toBeGreaterThan(ITEM_DEFS.length / 2);
  });

  it('items grow with the level they drop at', () => {
    const lv1 = makeItem(ITEM_BY_ID.kevlarOnesie, 1, 1);
    const lv5 = makeItem(ITEM_BY_ID.kevlarOnesie, 2, 5);
    expect(lv5.stats.maxHp!).toBeGreaterThan(lv1.stats.maxHp!);
    // Drawbacks don't grow.
    expect(makeItem(ITEM_BY_ID.rocketSkis, 3, 9).stats.accuracy).toBe(ITEM_BY_ID.rocketSkis.stats.accuracy);
  });

  it('the best gear only turns up once the town has its building', () => {
    const rng = new Rng(Rng.fromSeed('locks').s);
    const armoryOnly = new Set(DROPPABLE.filter((d) => d.unlock === 'armory').map((d) => d.id));
    for (let i = 0; i < 400; i++) expect(armoryOnly.has(rollItem(rng, i, 3, 0.5, true).def)).toBe(false);
    let seen = false;
    for (let i = 0; i < 2000 && !seen; i++) seen = armoryOnly.has(rollItem(rng, i, 3, 0.6, false, { armory: true }).def);
    expect(seen).toBe(true);
  });
});

describe('gear that bends the rules', () => {
  it('a shotgun splashes everything near the target', () => {
    const run = wearing('fondueShotgun');
    const me = run.heroPos();
    run.state.enemies = [guard(1, me.x + 0.6, me.y), guard(2, me.x + 0.9, me.y + 0.3)];
    run.stats.accuracy = 9;
    (run as unknown as { shoot: (e: Enemy, d: number, a: number) => void }).shoot(run.state.enemies[0], 0.6, 1);
    expect(run.state.enemies[1].hp).toBeLessThan(30);
  });

  it('a railgun shot carries on into the next enemy', () => {
    const run = wearing('railgun');
    const me = run.heroPos();
    run.state.enemies = [guard(1, me.x + 0.4, me.y), guard(2, me.x - 1, me.y)];
    run.state.hero.cooldown = 0;
    run.step();
    const shots = run.drainEvents().filter((e: RunEvent) => e.type === 'shot');
    expect(shots).toHaveLength(2);
  });

  it('a harpoon pins its target: no moving, no shooting', () => {
    const run = wearing('harpoonGun');
    const me = run.heroPos();
    const target = guard(1, me.x + 0.5, me.y, 999);
    run.state.enemies = [target];
    run.stats.accuracy = 9;
    (run as unknown as { shoot: (e: Enemy, d: number, a: number) => void }).shoot(target, 0.5, 1);
    expect(target.stun).toBeGreaterThan(1);
  });

  it('an avalanche airbag survives one killing blow', () => {
    const run = wearing('avalancheAirbag');
    run.state.hero.hp = -5;
    run.step();
    expect(run.state.status).toBe('riding');
    expect(run.state.hero.hp).toBeGreaterThan(0);
    expect(run.drainEvents().some((e) => e.type === 'saved')).toBe(true);
    run.state.hero.hp = -5;
    run.step();
    expect(run.state.status).toBe('wiped');
  });

  it('a coupon book cuts shop prices; a rabbit foot makes the first reroll free', () => {
    const plain = Run.create({ seed: 'alpine', deck: ['pines'] });
    const run = wearing('coupon');
    expect(run.price('pines')).toBeLessThan(plain.price('pines'));
    const lucky = wearing('rabbitFoot');
    expect(lucky.rerollPrice()).toBe(0);
    lucky.applyCommands([{ type: 'reroll' }]);
    expect(lucky.rerollPrice()).toBeGreaterThan(0);
  });

  it('steady carvers let you tuck without losing aim', () => {
    const hitRate = (def: string) => {
      const run = wearing(def, 'powder');
      run.state.hero.stance = 'tuck';
      let shots = 0;
      let hits = 0;
      for (let t = 0; t < 30 * 40; t++) {
        const me = run.heroPos();
        run.state.enemies = [{ ...guard(1, me.x + 0.5, me.y, 99999), cooldown: 99 }];
        run.state.hero.hp = 9999;
        run.state.hero.ride.f = 0.1;
        run.step();
        for (const e of run.drainEvents()) if (e.type === 'shot') (shots++, e.hit && hits++);
      }
      return hits / shots;
    };
    expect(hitRate('steadyCarvers')).toBeGreaterThan(hitRate('racingCarvers') + 0.1);
  });
});
