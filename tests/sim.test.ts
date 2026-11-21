import { describe, expect, it } from 'vitest';
import { Course } from '../src/sim/course';
import { DT, TICK_RATE } from '../src/sim/constants';
import { NEUTRAL_INPUT, speedOf, type InputFrame, type PlayerState } from '../src/sim/player';
import { Sim } from '../src/sim/sim';

/** A simple bot that follows the course's tree-free line, holding a stance. */
function botInput(sim: Sim, p: PlayerState, stance: Partial<InputFrame> = {}): InputFrame {
  const c = sim.course;
  const d = -p.pos.z;
  const ahead = 4;
  const lineYaw = -Math.atan((c.lineX(d + ahead + 1) - c.lineX(d + ahead - 1)) / 2);
  const error = p.pos.x - c.lineX(d);
  const yaw = lineYaw + Math.max(-0.5, Math.min(0.5, error * 0.12));
  return { ...NEUTRAL_INPUT, steerYaw: yaw, aimYaw: yaw, ...stance };
}

function run(sim: Sim, seconds: number, input: (sim: Sim, p: PlayerState, tick: number) => InputFrame) {
  const ticks = Math.round(seconds * TICK_RATE);
  for (let t = 0; t < ticks; t++) sim.step(sim.players.map((p) => input(sim, p, sim.tick)));
}

/** A scripted mix of stances, jumps and steering, so determinism covers every code path. */
function scripted(sim: Sim, p: PlayerState, tick: number): InputFrame {
  const phase = Math.floor(tick / 240) % 4;
  return botInput(sim, p, {
    tuck: phase === 1,
    plow: phase === 3,
    jump: tick % 300 < 4,
    aimPitch: Math.sin(tick * 0.01) * 0.3,
  });
}

describe('seeded run', () => {
  it('builds the same mountain from the same seed', () => {
    const a = new Course('alpine');
    const b = new Course('alpine');
    expect(a.trees.length).toBe(b.trees.length);
    expect(a.kickers).toEqual(b.kickers);
    expect(a.heightAt(3.7, -512.3)).toBe(b.heightAt(3.7, -512.3));
  });

  it('builds a different mountain from a different seed', () => {
    const a = new Course('alpine');
    const b = new Course('powder');
    expect(a.heightAt(3.7, -512.3)).not.toBe(b.heightAt(3.7, -512.3));
  });

  it('replays identically from seed and inputs', () => {
    const a = Sim.create({ seed: 'replay' });
    const b = Sim.create({ seed: 'replay' });
    run(a, 30, scripted);
    run(b, 30, scripted);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it('resumes exactly from a saved snapshot', () => {
    const whole = Sim.create({ seed: 'snapshot' });
    run(whole, 10, scripted);
    const saved = JSON.stringify(whole.snapshot());
    run(whole, 15, scripted);

    const resumed = Sim.restore(saved);
    run(resumed, 15, scripted);
    expect(JSON.stringify(resumed.state)).toBe(JSON.stringify(whole.state));
  });

  it('treats the player as one entity in a list', () => {
    const sim = Sim.create({ seed: 'duo', players: 2 });
    expect(sim.players).toHaveLength(2);
    run(sim, 5, (s, p) => botInput(s, p, { tuck: p.id === 0, plow: p.id === 1 }));
    expect(speedOf(sim.players[0])).toBeGreaterThan(speedOf(sim.players[1]));
  });
});

describe('skiing feel', () => {
  const seeds = ['alpine', 'powder', 'mogul', 'whiteout', 'yeti'];

  function speedAfter(seed: string, stance: Partial<InputFrame>, seconds: number) {
    const sim = Sim.create({ seed });
    run(sim, seconds, (s, p) => botInput(s, p, stance));
    return { sim, p: sim.players[0], speed: speedOf(sim.players[0]) };
  }

  it('tucking is faster than cruising, which is faster than snowplowing', () => {
    for (const seed of seeds) {
      const tuck = speedAfter(seed, { tuck: true }, 8);
      const cruise = speedAfter(seed, {}, 8);
      const plow = speedAfter(seed, { plow: true }, 8);
      expect(tuck.speed).toBeGreaterThan(cruise.speed);
      expect(cruise.speed).toBeGreaterThan(plow.speed * 1.5);
    }
  });

  it('snowplowing brakes hard from speed but never brings you to a stop', () => {
    for (const seed of seeds) {
      const sim = Sim.create({ seed });
      run(sim, 6, (s, p) => botInput(s, p, { tuck: true }));
      const fast = speedOf(sim.players[0]);
      run(sim, 3, (s, p) => botInput(s, p, { plow: true }));
      const slowed = speedOf(sim.players[0]);
      expect(slowed).toBeLessThan(fast * 0.6);
      let minSpeed = Infinity;
      run(sim, 20, (s, p) => {
        if (p.status === 'skiing') minSpeed = Math.min(minSpeed, speedOf(p));
        return botInput(s, p, { plow: true });
      });
      expect(minSpeed).toBeGreaterThan(2);
    }
  });

  it('every seed can be skied to base camp', () => {
    for (const seed of seeds) {
      const sim = Sim.create({ seed });
      run(sim, 150, (s, p) => botInput(s, p, {}));
      const p = sim.players[0];
      expect({ seed, status: p.status, cause: p.crashCause }).toEqual({ seed, status: 'finished', cause: null });
      const seconds = p.statusTick * DT;
      expect(seconds).toBeGreaterThan(20);
      expect(seconds).toBeLessThan(120);
    }
  });

  it('a tucked run is quicker to base camp than a cruise', () => {
    for (const seed of seeds.slice(0, 3)) {
      const time = (stance: Partial<InputFrame>) => {
        const sim = Sim.create({ seed });
        run(sim, 150, (s, p) => botInput(s, p, stance));
        const p = sim.players[0];
        return p.status === 'finished' ? p.statusTick * DT : Infinity;
      };
      const cruise = time({});
      const tuck = time({ tuck: true });
      // A tucked bot may wipe out (that is the risk); when it survives it must be faster.
      if (Number.isFinite(tuck)) expect(tuck).toBeLessThan(cruise);
    }
  });

  it('flying straight into a tree is a yard sale', () => {
    const sim = Sim.create({ seed: 'alpine' });
    const p = sim.players[0];
    const tree = sim.course.trees.find((t) => -t.z > 200 && Math.abs(sim.course.lateral(t.x, t.z)) < 20)!;
    p.pos = { x: tree.x, y: tree.y + 0.5, z: tree.z + 6 };
    p.vel = { x: 0, y: 0, z: -25 };
    p.heading = 0;
    run(sim, 1, () => ({ ...NEUTRAL_INPUT }));
    expect(p.status).toBe('crashed');
    expect(p.crashCause).toBe('tree');
  });
});
