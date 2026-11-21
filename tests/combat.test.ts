import { describe, expect, it } from 'vitest';
import { assistCone } from '../src/sim/combat';
import { GUARD_SPECS, hitChance, type GuardState } from '../src/sim/guards';
import { eyePosition, NEUTRAL_INPUT, type InputFrame, type SimEvent } from '../src/sim/player';
import { GUARD_BODY, GUARD_HEAD } from '../src/sim/ray';
import { DT } from '../src/sim/constants';
import { award, payout, stepScore } from '../src/sim/scoring';
import { Sim } from '../src/sim/sim';
import { DEFAULT_TUNING } from '../src/sim/tuning';
import { gunnerInput, run } from './bot';

/** A sim with a single sentry standing on the trail `ahead` metres in front of the player. */
function range(ahead = 30, kind: GuardState['kind'] = 'sentry') {
  const sim = Sim.create({ seed: 'range', tuning: { guardAccuracy: 0 } });
  const p = sim.players[0];
  const g = sim.state.guards[0];
  for (const other of sim.state.guards) other.mode = 'gone';
  const d = -p.pos.z + ahead;
  const x = sim.course.centerX(d);
  Object.assign(g, { kind, mode: 'idle', hp: GUARD_SPECS[kind].hp, perch: 0, started: false });
  g.pos = { x, y: sim.course.heightAt(x, -d), z: -d };
  return { sim, p, g };
}

function aimAt(sim: Sim, height: number): InputFrame {
  const p = sim.players[0];
  const g = sim.state.guards[0];
  const eye = eyePosition(p);
  const vx = g.pos.x - eye.x;
  const vy = g.pos.y + height - eye.y;
  const vz = g.pos.z - eye.z;
  const yaw = Math.atan2(-vx, -vz);
  return { ...NEUTRAL_INPUT, steerYaw: p.heading, aimYaw: yaw, aimPitch: Math.atan2(vy, Math.hypot(vx, vz)), aim: true, fire: true };
}

function fireOnce(sim: Sim, input: InputFrame): SimEvent[] {
  sim.step([input]);
  const events = sim.drainEvents();
  run(sim, 0.3, () => ({ ...input, fire: false }));
  return events.concat(sim.drainEvents());
}

describe('gunfights', () => {
  it('aim assist shrinks as you tuck and grows as you snowplow', () => {
    const { p } = range();
    const cruise = assistCone(p, true, DEFAULT_TUNING);
    p.tuck = 1;
    const tucked = assistCone(p, true, DEFAULT_TUNING);
    p.tuck = 0;
    p.plow = 1;
    const plowed = assistCone(p, true, DEFAULT_TUNING);
    expect(tucked).toBeLessThan(cruise * 0.5);
    expect(plowed).toBeGreaterThan(cruise);
    p.plow = 0;
    expect(assistCone(p, false, DEFAULT_TUNING)).toBeLessThan(cruise);
  });

  it('speed is armour: guards hit a fast skier far less often', () => {
    const { p } = range();
    p.vel = { x: 0, y: 0, z: -8 };
    const slow = hitChance(GUARD_SPECS.sentry, p, 40, DEFAULT_TUNING);
    p.vel = { x: 0, y: 0, z: -32 };
    const fast = hitChance(GUARD_SPECS.sentry, p, 40, DEFAULT_TUNING);
    expect(fast).toBeLessThan(slow * 0.5);
  });

  it('a headshot drops a sentry in one and pays double chips', () => {
    const { sim, g } = range();
    const events = fireOnce(sim, aimAt(sim, GUARD_HEAD.y));
    expect(g.mode).toBe('down');
    const down = events.find((e) => e.type === 'guardDown');
    expect(down).toMatchObject({ head: true, cause: 'shot' });
    const chips = events.find((e) => e.type === 'chips');
    expect(chips).toMatchObject({ chips: GUARD_SPECS.sentry.chips * 2 });
    expect(sim.players[0].score.headshots).toBe(1);
  });

  it('a sentry takes two body shots', () => {
    const { sim, g } = range();
    fireOnce(sim, aimAt(sim, GUARD_BODY[0].y));
    expect(g.mode).not.toBe('down');
    expect(g.hp).toBe(1);
    fireOnce(sim, aimAt(sim, GUARD_BODY[0].y));
    expect(g.mode).toBe('down');
  });

  it('skiing straight into a guard bowls them over', () => {
    const { sim, p, g } = range(12);
    const events: SimEvent[] = [];
    run(sim, 3, () => {
      const steer = Math.atan2(-(g.pos.x - p.pos.x), -(g.pos.z - p.pos.z));
      return { ...NEUTRAL_INPUT, steerYaw: steer, aimYaw: steer };
    });
    events.push(...sim.drainEvents());
    expect(g.mode).toBe('down');
    expect(events.find((e) => e.type === 'guardDown')).toMatchObject({ cause: 'bowled' });
  });
});

describe('chips × mult', () => {
  it('a hand cashes after the combo window and pays chips × mult', () => {
    const { sim, p } = range(200);
    const events: SimEvent[] = [];
    const ctx = { tuning: sim.state.tuning, emit: (e: SimEvent) => events.push(e) };
    p.vel = { x: 0, y: 0, z: -20 };
    award(p, 'Test', 100, 1, ctx);
    award(p, 'Test', 50, 0, ctx);
    const hand = p.score.hand!;
    expect(hand.chips).toBe(150);
    expect(hand.mult).toBeCloseTo(1 + 1 + 2 * (20 - 10) * DEFAULT_TUNING.multPerSpeed);
    const expected = Math.round(hand.chips * hand.mult);
    p.vel = { x: 0, y: 0, z: 0 };
    for (let t = 0; t < (DEFAULT_TUNING.comboWindow - 0.1) / DT; t++) stepScore(p, ctx);
    expect(p.score.hand).not.toBeNull();
    for (let t = 0; t < 0.2 / DT; t++) stepScore(p, ctx);
    expect(p.score.hand).toBeNull();
    expect(p.score.total).toBe(expected);
    expect(events.at(-1)).toMatchObject({ type: 'handCashed', points: expected });
  });

  it('getting shot loses the open hand', () => {
    const { sim, p } = range(200);
    const ctx = { tuning: sim.state.tuning, emit: () => undefined };
    award(p, 'Test', 100, 2, ctx);
    sim.state.tuning.guardAccuracy = 5; // a sure hit
    const g = sim.state.guards[0];
    Object.assign(g, { mode: 'aim', timer: 0, target: 0 });
    g.pos = { ...p.pos, z: p.pos.z - 10, x: p.pos.x };
    p.vel = { x: 0, y: 0, z: 0 };
    // Roll until the sentry lands a shot (deterministic for this seed).
    for (let i = 0; i < 2000 && p.hp === DEFAULT_TUNING.playerHp; i++) sim.step([{ ...NEUTRAL_INPUT, steerYaw: p.heading }]);
    expect(p.hp).toBeLessThan(DEFAULT_TUNING.playerHp);
    expect(p.score.hand).toBeNull();
    expect(p.score.total).toBe(0);
    expect(p.score.lost).toBeGreaterThan(0);
  });

  it('wiping out halves the payout', () => {
    const { p } = range();
    p.score.total = 1001;
    p.status = 'crashed';
    expect(payout(p)).toBe(500);
    p.status = 'finished';
    expect(payout(p)).toBe(1001);
  });

  it('a fast, risky run clearly pays more than a safe one', () => {
    for (const seed of ['alpine', 'powder', 'whiteout', 'yeti']) {
      const result = (stance: Partial<InputFrame>) => {
        const sim = Sim.create({ seed });
        run(sim, 200, (s, p) => gunnerInput(s, p, stance));
        return payout(sim.players[0]);
      };
      const fast = result({});
      const safe = result({ plow: true });
      expect(fast).toBeGreaterThan(safe * 3);
    }
  });
});
