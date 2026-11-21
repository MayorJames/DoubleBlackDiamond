// Guards: sentries on the snow, snipers in watchtowers, and ski goons who race you down the
// line shooting over their shoulder. Every shot is telegraphed (an aim phase) and rolled
// against your speed: going fast is your armour, which is the other half of the trade.

import { DT } from './constants';
import type { Course } from './course';
import { approach, approachAngle, clamp, length, type Vec3, vec3 } from './math';
import { eyePosition, hurtPlayer, type PlayerState, type SimEvent } from './player';
import { GUARD_EYE, lineOfSight } from './ray';
import { Rng } from './rng';
import { award } from './scoring';
import type { Tuning } from './tuning';

export type GuardKind = 'sentry' | 'sniper' | 'skier';
export type GuardMode = 'idle' | 'aim' | 'cooldown' | 'down' | 'gone';

export interface GuardSpec {
  label: string;
  hp: number;
  range: number;
  /** Seconds of visible aiming before each shot. */
  aimTime: number;
  cooldown: number;
  /** Hit chance against a standing target at point-blank range. */
  accuracy: number;
  damage: number;
  chips: number;
  turnRate: number;
}

export const GUARD_SPECS: Record<GuardKind, GuardSpec> = {
  sentry: { label: 'Sentry', hp: 2, range: 85, aimTime: 0.8, cooldown: 1.6, accuracy: 0.45, damage: 1, chips: 40, turnRate: 3 },
  sniper: { label: 'Sniper', hp: 1, range: 170, aimTime: 1.7, cooldown: 3.2, accuracy: 0.9, damage: 1, chips: 80, turnRate: 1.5 },
  skier: { label: 'Ski goon', hp: 1, range: 60, aimTime: 0.6, cooldown: 1.8, accuracy: 0.35, damage: 1, chips: 60, turnRate: 6 },
};

const GOON_SPEED = 21;
/** Sentries and snipers stop shooting once you are this far past them. */
const PAST_LIMIT = 15;
export const TOWER_HEIGHT = 4.5;

export interface GuardState {
  id: number;
  kind: GuardKind;
  pos: Vec3;
  yaw: number;
  hp: number;
  mode: GuardMode;
  /** Seconds left in the current mode. */
  timer: number;
  /** Player index being engaged, or -1. */
  target: number;
  /** Platform height under a sniper. */
  perch: number;
  /** Ski goons: distance down the trail, offset from the clean line, speed and weave. */
  d: number;
  lane: number;
  speed: number;
  phase: number;
  started: boolean;
  downTick: number;
}

export interface GuardContext {
  course: Course;
  tuning: Tuning;
  tick: number;
  rng: Rng;
  emit: (event: SimEvent) => void;
}

export const guardAlive = (g: GuardState): boolean => g.mode !== 'down' && g.mode !== 'gone';

export function guardEye(g: GuardState, out: Vec3 = vec3()): Vec3 {
  out.x = g.pos.x;
  out.y = g.pos.y + GUARD_EYE;
  out.z = g.pos.z;
  return out;
}

/** Places guards from the seed. Uses its own random stream so the trail itself never changes. */
export function spawnGuards(course: Course): GuardState[] {
  const rng = Rng.fromSeed(`guards:${course.seed}`);
  const guards: GuardState[] = [];
  const add = (kind: GuardKind, d: number, u: number, perch = 0, lane = 0) => {
    const x = course.centerX(d) + u;
    const z = -d;
    const facing = kind === 'skier' ? course.trackYaw(d) : course.trackYaw(d) + Math.PI;
    guards.push({
      id: guards.length,
      kind,
      pos: vec3(x, course.heightAt(x, z) + perch, z),
      yaw: facing,
      hp: GUARD_SPECS[kind].hp,
      mode: 'idle',
      timer: rng.range(0, 0.6),
      target: -1,
      perch,
      d,
      lane,
      speed: 0,
      phase: rng.range(0, Math.PI * 2),
      started: false,
      downTick: -1,
    });
  };
  const clearOf = (d: number, u: number, r: number) => {
    const x = course.centerX(d) + u;
    let clear = true;
    course.forTreesNear(x, -d, r, (t) => {
      if ((t.x - x) ** 2 + (t.z + d) ** 2 < r * r) clear = false;
    });
    return clear;
  };
  const nearKicker = (d: number) => course.kickers.some((k) => d > k.d - 15 && d < k.d + k.length + 45);

  // Sentries, alone or in pairs, every 55-90 m.
  for (let d = 150; d < course.finishD - 80; d += rng.range(55, 90)) {
    if (nearKicker(d)) continue;
    const side = rng.sign();
    const u = side * rng.range(0.3, 0.85) * course.halfWidth(d);
    const count = rng.chance(0.35) ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const dd = d + i * 2;
      const uu = u - side * i * 3.5;
      if (clearOf(dd, uu, 2.5)) add('sentry', dd, uu);
    }
  }

  // One sniper tower in each third of the trail, at its edge.
  const span = (course.finishD - 300) / 3;
  for (let i = 0; i < 3; i++) {
    for (let attempt = 0; attempt < 10; attempt++) {
      const d = 200 + rng.range(i * span, (i + 1) * span);
      const u = rng.sign() * (course.halfWidth(d) - 2.5);
      if (!nearKicker(d) && clearOf(d, u, 3.5)) {
        add('sniper', d, u, TOWER_HEIGHT);
        break;
      }
    }
  }

  // Ski goons waiting by the clean line for you to come past.
  for (let i = 0; i < 4; i++) {
    const d = rng.range(180, course.finishD - 260);
    const lane = rng.range(-1.5, 1.5);
    add('skier', d, course.lineX(d) - course.centerX(d) + lane, 0, lane);
  }
  return guards;
}

function moveGoon(g: GuardState, players: readonly PlayerState[], course: Course): void {
  if (!g.started) {
    for (const p of players) {
      const pd = -p.pos.z;
      if (p.status === 'skiing' && pd > g.d - 70 && pd < g.d + 5) g.started = true;
    }
    if (!g.started) return;
  }
  g.speed = approach(g.speed, GOON_SPEED + (g.id % 3) * 1.5, 5 * DT);
  g.d += g.speed * DT;
  g.phase += DT;
  const u = course.lineX(g.d) - course.centerX(g.d) + g.lane + 1.6 * Math.sin(g.phase * 1.1);
  g.pos.x = course.centerX(g.d) + u;
  g.pos.z = -g.d;
  g.pos.y = course.heightAt(g.pos.x, g.pos.z);
  g.yaw = course.trackYaw(g.d);
  if (g.d > course.finishD - 15) g.mode = 'gone';
}

/** Whether a guard is willing to shoot at this player right now. */
function engages(g: GuardState, p: PlayerState): boolean {
  if (p.status !== 'skiing') return false;
  const ahead = -p.pos.z - -g.pos.z; // positive once the player is further downhill
  if (g.kind === 'skier') return g.started && ahead < 2;
  return ahead < PAST_LIMIT;
}

/**
 * Chance a guard's shot lands. Speed is armour (halved at dodgeSpeed), carving hard and being
 * airborne help, and distance hurts their aim.
 */
export function hitChance(spec: GuardSpec, p: PlayerState, dist: number, t: Tuning): number {
  const speed = length(p.vel);
  let chance = (spec.accuracy * t.guardAccuracy) / (1 + (speed / t.dodgeSpeed) ** 2);
  chance *= 1 - 0.5 * clamp(dist / spec.range, 0, 1);
  chance *= 1 - 0.35 * clamp(Math.abs(p.lean), 0, 1);
  if (p.airTime > 0.25) chance *= 0.6;
  return chance;
}

const eyeA = vec3();
const eyeB = vec3();

export function stepGuards(guards: GuardState[], players: readonly PlayerState[], ctx: GuardContext): void {
  const { course, tuning: T, rng, emit } = ctx;
  for (const g of guards) {
    if (!guardAlive(g)) continue;
    const spec = GUARD_SPECS[g.kind];
    if (g.kind === 'skier') {
      moveGoon(g, players, course);
      if (!guardAlive(g)) continue;
    }

    let target = -1;
    let best = spec.range;
    for (const p of players) {
      const dist = Math.hypot(p.pos.x - g.pos.x, p.pos.y - g.pos.y, p.pos.z - g.pos.z);
      if (dist < best && engages(g, p)) {
        best = dist;
        target = p.id;
      }
    }
    g.target = target;
    if (g.timer > 0) g.timer -= DT;
    if (target < 0) {
      if (g.mode === 'aim') {
        g.mode = 'cooldown';
        g.timer = 0.6;
      }
      continue;
    }

    const p = players[target];
    if (g.kind !== 'skier') {
      const yaw = Math.atan2(-(p.pos.x - g.pos.x), -(p.pos.z - g.pos.z));
      g.yaw = approachAngle(g.yaw, yaw, spec.turnRate * DT);
    }

    if (g.mode === 'idle' || g.mode === 'cooldown') {
      if (g.timer <= 0) {
        if (lineOfSight(course, guardEye(g, eyeA), eyePosition(p, eyeB))) {
          g.mode = 'aim';
          g.timer = spec.aimTime;
          emit({ type: 'guardAim', guard: g.id, target: p.id });
        } else {
          g.timer = 0.3;
        }
      }
    } else if (g.mode === 'aim' && g.timer <= 0) {
      fireAt(g, p, spec, ctx);
      g.mode = 'cooldown';
      g.timer = spec.cooldown * rng.range(0.85, 1.25);
    }
  }

  function fireAt(g: GuardState, p: PlayerState, spec: GuardSpec, c: GuardContext) {
    const from = guardEye(g, vec3());
    const to = eyePosition(p, vec3());
    const dist = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
    const clear = lineOfSight(course, from, to);
    const hit = clear && rng.next() < hitChance(spec, p, dist, T);
    if (!hit) {
      // Misses kick up snow somewhere near you.
      to.x += rng.range(-1.8, 1.8);
      to.y += rng.range(-1.2, 0.4);
      to.z += rng.range(-1.8, 1.8);
    }
    emit({ type: 'guardShot', guard: g.id, target: p.id, hit, from, to });
    if (hit) hurtPlayer(p, spec.damage, c.tuning, c.tick, c.emit);
    else if (clear && dist < 50) {
      p.score.whiffs++;
      award(p, 'Whiff!', 10, 0.1, c);
    }
  }
}
