// Test bots. They drive the simulation exactly as a player would: through InputFrames only.

import { TICK_RATE } from '../src/sim/constants';
import { guardAlive } from '../src/sim/guards';
import { eyePosition, NEUTRAL_INPUT, type InputFrame, type PlayerState } from '../src/sim/player';
import { GUARD_BODY } from '../src/sim/ray';
import type { Sim } from '../src/sim/sim';

/** Follows the course's tree-free line, holding a stance. */
export function botInput(sim: Sim, p: PlayerState, stance: Partial<InputFrame> = {}): InputFrame {
  const c = sim.course;
  const d = -p.pos.z;
  const ahead = 4;
  const lineYaw = -Math.atan((c.lineX(d + ahead + 1) - c.lineX(d + ahead - 1)) / 2);
  const error = p.pos.x - c.lineX(d);
  const yaw = lineYaw + Math.max(-0.5, Math.min(0.5, error * 0.12));
  return { ...NEUTRAL_INPUT, steerYaw: yaw, aimYaw: yaw, ...stance };
}

/** Follows the line and, holding aim, shoots at the nearest guard in front of it. */
export function gunnerInput(sim: Sim, p: PlayerState, stance: Partial<InputFrame> = {}, range = 90): InputFrame {
  const base = botInput(sim, p, stance);
  const eye = eyePosition(p);
  const fx = -Math.sin(base.steerYaw);
  const fz = -Math.cos(base.steerYaw);
  let best: { yaw: number; pitch: number } | null = null;
  let bestDist = range;
  for (const g of sim.guards) {
    if (!guardAlive(g)) continue;
    const vx = g.pos.x - eye.x;
    const vy = g.pos.y + GUARD_BODY[0].y - eye.y;
    const vz = g.pos.z - eye.z;
    const flat = Math.hypot(vx, vz);
    const dist = Math.hypot(flat, vy);
    if (dist > bestDist || (vx * fx + vz * fz) / flat < 0.5) continue;
    bestDist = dist;
    best = { yaw: Math.atan2(-vx, -vz), pitch: Math.atan2(vy, flat) };
  }
  if (!best) return base;
  return { ...base, aimYaw: best.yaw, aimPitch: best.pitch, aim: true, fire: true };
}

export function run(sim: Sim, seconds: number, input: (sim: Sim, p: PlayerState, tick: number) => InputFrame): void {
  const ticks = Math.round(seconds * TICK_RATE);
  for (let t = 0; t < ticks; t++) sim.step(sim.players.map((p) => input(sim, p, sim.tick)));
}
