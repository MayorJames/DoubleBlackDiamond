// The player's gun. Hitscan from the eyes along the aim, plus the aim wobble the skiing
// computes. Holding aim tightens the shot and widens the aim assist; tucking shrinks the
// assist and snowplowing grows it, so every gunfight is a choice between speed and accuracy.

import { DEG, DT } from './constants';
import type { Course } from './course';
import { GUARD_SPECS, guardAlive, type GuardState } from './guards';
import { approach, dot, length, normalize, type Vec3, vec3 } from './math';
import { crashPlayer, eyePosition, type InputFrame, type PlayerState, type SimEvent } from './player';
import { aimDirection, GUARD_BODY, GUARD_HEAD, lineOfSight, raySphere, terrainHit, treeHit } from './ray';
import type { Rng } from './rng';
import { award } from './scoring';
import type { Tuning } from './tuning';

export interface WeaponState {
  ammo: number;
  cooldown: number;
  /** Seconds left reloading, 0 when ready. */
  reload: number;
}

export interface CombatContext {
  course: Course;
  tuning: Tuning;
  tick: number;
  rng: Rng;
  guards: GuardState[];
  emit: (event: SimEvent) => void;
}

export type ShotHit = 'none' | 'terrain' | 'tree' | 'guard';

export interface ShotResult {
  t: number;
  kind: ShotHit;
  guard: number;
  head: boolean;
}

export interface AssistTarget {
  guard: number;
  point: Vec3;
  head: boolean;
}

export const newWeapon = (t: Tuning): WeaponState => ({ ammo: t.magSize, cooldown: 0, reload: 0 });

/** Half-angle of the aim-assist cone, radians. */
export function assistCone(p: PlayerState, aiming: boolean, t: Tuning): number {
  const base = (aiming ? t.assistAimDeg : t.assistHipDeg) * DEG;
  return base * (1 - t.assistTuckLoss * p.tuck) * (1 + t.assistPlowBonus * p.plow);
}

const toTarget = vec3();

/** The guard the shot would bend toward, if any is inside the cone and in plain sight. */
export function findAssistTarget(
  course: Course,
  guards: readonly GuardState[],
  origin: Vec3,
  dir: Vec3,
  cone: number,
  range: number,
): AssistTarget | null {
  const candidates: { angle: number; g: GuardState; head: boolean }[] = [];
  for (const g of guards) {
    if (!guardAlive(g)) continue;
    toTarget.x = g.pos.x - origin.x;
    toTarget.y = g.pos.y + GUARD_BODY[0].y - origin.y;
    toTarget.z = g.pos.z - origin.z;
    const dist = length(toTarget);
    if (dist > range || dist < 1) continue;
    normalize(toTarget);
    const angle = Math.acos(Math.min(1, dot(toTarget, dir)));
    if (angle > cone + Math.atan(GUARD_BODY[0].r / dist)) continue;
    toTarget.x = g.pos.x - origin.x;
    toTarget.y = g.pos.y + GUARD_HEAD.y - origin.y;
    toTarget.z = g.pos.z - origin.z;
    normalize(toTarget);
    const headAngle = Math.acos(Math.min(1, dot(toTarget, dir)));
    // The assist bends toward whichever of head or chest you are actually aiming nearer.
    candidates.push({ angle, g, head: headAngle < angle });
  }
  candidates.sort((a, b) => a.angle - b.angle);
  for (const c of candidates) {
    const point = vec3(c.g.pos.x, c.g.pos.y + (c.head ? GUARD_HEAD.y : GUARD_BODY[0].y), c.g.pos.z);
    if (lineOfSight(course, origin, point)) return { guard: c.g.id, point, head: c.head };
  }
  return null;
}

/** What a bullet along this ray hits first. */
export function castShot(course: Course, guards: readonly GuardState[], o: Vec3, d: Vec3, range: number): ShotResult {
  const best: ShotResult = { t: range, kind: 'none', guard: -1, head: false };
  for (const g of guards) {
    if (!guardAlive(g)) continue;
    if (Math.hypot(g.pos.x - o.x, g.pos.z - o.z) > range + 3) continue;
    const th = raySphere(o, d, g.pos.x, g.pos.y + GUARD_HEAD.y, g.pos.z, GUARD_HEAD.r);
    if (th >= 0 && th < best.t) Object.assign(best, { t: th, kind: 'guard', guard: g.id, head: true });
    for (const s of GUARD_BODY) {
      const tb = raySphere(o, d, g.pos.x, g.pos.y + s.y, g.pos.z, s.r);
      if (tb >= 0 && tb < best.t) Object.assign(best, { t: tb, kind: 'guard', guard: g.id, head: false });
    }
  }
  const tt = terrainHit(course, o, d, best.t);
  if (tt < best.t) Object.assign(best, { t: tt, kind: 'terrain', guard: -1, head: false });
  const tr = treeHit(course, o, d, best.t);
  if (tr < best.t) Object.assign(best, { t: tr, kind: 'tree', guard: -1, head: false });
  return best;
}

export function damageGuard(
  g: GuardState,
  p: PlayerState,
  damage: number,
  head: boolean,
  cause: 'shot' | 'bowled',
  dir: Vec3,
  ctx: CombatContext,
): void {
  if (!guardAlive(g)) return;
  g.hp -= damage;
  ctx.emit({ type: 'guardHit', guard: g.id, player: p.id, head });
  if (g.hp > 0) return;
  g.mode = 'down';
  g.downTick = ctx.tick;
  ctx.emit({ type: 'guardDown', guard: g.id, player: p.id, head, cause, dirX: dir.x, dirZ: dir.z });

  const spec = GUARD_SPECS[g.kind];
  const dist = Math.hypot(g.pos.x - p.pos.x, g.pos.z - p.pos.z);
  let chips = spec.chips;
  let mult = 0;
  let label = spec.label;
  if (cause === 'bowled') {
    chips += 30;
    mult += 0.5;
    label = 'Bowled over!';
  } else if (head) {
    chips *= 2;
    mult += 0.5;
    label = `Headshot ${spec.label.toLowerCase()}`;
  }
  if (p.airTime > 0.25) mult += 0.5;
  if (cause === 'shot' && dist > 60) chips += 20;
  p.score.kills++;
  if (head) p.score.headshots++;
  award(p, label, chips, mult, ctx);
}

const origin = vec3();
const shotDir = vec3();

export function stepWeapon(p: PlayerState, input: InputFrame, ctx: CombatContext): void {
  const { tuning: T, emit } = ctx;
  const w = p.weapon;
  const able = p.status === 'skiing';
  p.aiming = approach(p.aiming, input.aim && able ? 1 : 0, 8 * DT);
  if (w.cooldown > 0) w.cooldown -= DT;
  if (w.reload > 0) {
    w.reload -= DT;
    if (w.reload <= 0) {
      w.reload = 0;
      w.ammo = T.magSize;
      emit({ type: 'reloaded', player: p.id });
    }
  }
  if (!able || !input.fire || w.cooldown > 0 || w.reload > 0) return;
  if (w.ammo <= 0) {
    w.reload = T.reloadTime;
    emit({ type: 'reload', player: p.id });
    return;
  }
  w.ammo--;
  w.cooldown = T.fireInterval;

  eyePosition(p, origin);
  let yaw = input.aimYaw + p.wobbleYaw;
  let pitch = input.aimPitch + p.wobblePitch;
  if (!input.aim) {
    const spread = T.hipSpreadDeg * DEG;
    yaw += ctx.rng.range(-spread, spread);
    pitch += ctx.rng.range(-spread, spread);
  }
  aimDirection(yaw, pitch, shotDir);
  const target = findAssistTarget(ctx.course, ctx.guards, origin, shotDir, assistCone(p, input.aim, T), T.weaponRange);
  if (target) {
    shotDir.x = target.point.x - origin.x;
    shotDir.y = target.point.y - origin.y;
    shotDir.z = target.point.z - origin.z;
    normalize(shotDir);
  }
  const hit = castShot(ctx.course, ctx.guards, origin, shotDir, T.weaponRange);
  const to = vec3(origin.x + shotDir.x * hit.t, origin.y + shotDir.y * hit.t, origin.z + shotDir.z * hit.t);
  emit({ type: 'shot', player: p.id, from: vec3(origin.x, origin.y, origin.z), to, hit: hit.kind, guard: hit.guard, head: hit.head });
  if (hit.kind === 'guard') damageGuard(ctx.guards[hit.guard], p, hit.head ? 99 : 1, hit.head, 'shot', shotDir, ctx);
  if (w.ammo === 0) {
    w.reload = T.reloadTime;
    emit({ type: 'reload', player: p.id });
  }
}

/** Skiing into a guard bowls them over. Watchtower legs are as solid as trees. */
export function bowlGuards(p: PlayerState, ctx: CombatContext): void {
  if (p.status !== 'skiing') return;
  const v = p.vel;
  const speed = length(v);
  for (const g of ctx.guards) {
    if (g.perch > 0) {
      const dx = p.pos.x - g.pos.x;
      const dz = p.pos.z - g.pos.z;
      const dist = Math.hypot(dx, dz);
      const r = 1.6;
      if (dist >= r) continue;
      const nx = dx / (dist || 1e-4);
      const nz = dz / (dist || 1e-4);
      p.pos.x = g.pos.x + nx * r;
      p.pos.z = g.pos.z + nz * r;
      const into = -(v.x * nx + v.z * nz);
      if (into <= 0) continue;
      v.x += nx * into;
      v.z += nz * into;
      if (into > ctx.tuning.crashTreeSpeed) crashPlayer(p, 'tower', ctx.tick, ctx.emit);
      continue;
    }
    if (!guardAlive(g) || speed < 6) continue;
    if (Math.hypot(p.pos.x - g.pos.x, p.pos.z - g.pos.z) > 1.2 || Math.abs(p.pos.y - g.pos.y) > 1.8) continue;
    const dir = vec3(v.x / speed, 0, v.z / speed);
    damageGuard(g, p, 99, false, 'bowled', dir, ctx);
    v.x *= 0.85;
    v.y *= 0.85;
    v.z *= 0.85;
  }
}
