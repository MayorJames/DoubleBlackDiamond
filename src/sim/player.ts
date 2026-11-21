// One skier. Everything here is deterministic: the only outside influence is the InputFrame.

import { DEG, DT } from './constants';
import type { Course } from './course';
import {
  approach,
  approachAngle,
  clamp,
  cross,
  dot,
  forwardFromYaw,
  length,
  lerp,
  normalize,
  smoothstep,
  type Vec3,
  vec3,
  wrapAngle,
} from './math';
import type { WeaponState } from './combat';
import type { GuardKind, GuardState } from './guards';
import type { Rng } from './rng';
import { award, finishBonus, loseHand, newScore, type ScoreState } from './scoring';
import type { Tuning } from './tuning';

/** Everything a player can tell the simulation, sampled once per tick. */
export interface InputFrame {
  /** World yaw the skier wants the skis to point (radians, 0 = straight downhill, + = left). */
  steerYaw: number;
  /** Where the player is looking, which is where they will shoot. */
  aimYaw: number;
  aimPitch: number;
  tuck: boolean;
  plow: boolean;
  jump: boolean;
  /** Trigger held. */
  fire: boolean;
  /** Aim held: the skis keep their line, the view moves, and the aim assist widens. */
  aim: boolean;
}

export const NEUTRAL_INPUT: Readonly<InputFrame> = Object.freeze({
  steerYaw: 0,
  aimYaw: 0,
  aimPitch: 0,
  tuck: false,
  plow: false,
  jump: false,
  fire: false,
  aim: false,
});

export type PlayerStatus = 'skiing' | 'crashed' | 'finished';
export type CrashCause = 'tree' | 'impact' | 'edge' | 'shot' | 'tower';

export interface PlayerState {
  id: number;
  pos: Vec3;
  vel: Vec3;
  /** Yaw the skis point. */
  heading: number;
  /** Snow normal at the last contact. */
  normal: Vec3;
  /** Skis on, or within a hair of, the snow. */
  onSnow: boolean;
  /** Seconds since the skis last pressed into the snow. */
  airTime: number;
  /** Stance blends, 0..1. */
  tuck: number;
  plow: number;
  status: PlayerStatus;
  statusTick: number;
  crashCause: CrashCause | null;
  jumpHeld: boolean;
  aimYaw: number;
  aimPitch: number;
  /** Aim wobble, radians, added to the aim direction. Grows with speed and tuck, shrinks with plow. */
  wobbleYaw: number;
  wobblePitch: number;
  wobblePhase: number[];
  /** 0..1, how sideways the skis are sliding. */
  skid: number;
  /** Sideways acceleration from the edges, in g. Positive while turning right. */
  lean: number;
  topSpeed: number;
  /** Furthest distance downhill reached. */
  distance: number;
  maxAir: number;

  /** Hits left. */
  hp: number;
  /** Seconds of grace after being hit. */
  invuln: number;
  /** Seconds until one hit is won back. */
  regen: number;
  /** 0..1 blend of holding aim. */
  aiming: number;
  weapon: WeaponState;
  score: ScoreState;
  /** Tree last grazed, so one tree pays once. */
  lastGraze: number;
}

export type SimEvent =
  | { type: 'jump'; player: number }
  | { type: 'land'; player: number; impact: number; airTime: number }
  | { type: 'impact'; player: number; impact: number }
  | { type: 'treeBump'; player: number; speed: number }
  | { type: 'crash'; player: number; cause: CrashCause; speed: number }
  | { type: 'finish'; player: number; tick: number }
  | { type: 'graze'; player: number; tree: number }
  | { type: 'shot'; player: number; from: Vec3; to: Vec3; hit: 'none' | 'terrain' | 'tree' | 'guard'; guard: number; head: boolean }
  | { type: 'reload'; player: number }
  | { type: 'reloaded'; player: number }
  | { type: 'playerHit'; player: number; hp: number }
  | { type: 'guardAim'; guard: number; target: number }
  | { type: 'guardShot'; guard: number; target: number; hit: boolean; from: Vec3; to: Vec3 }
  | { type: 'guardHit'; guard: number; player: number; head: boolean }
  | { type: 'guardDown'; guard: number; player: number; head: boolean; cause: 'shot' | 'bowled'; dirX: number; dirZ: number }
  | { type: 'chips'; player: number; label: string; chips: number; mult: number }
  | { type: 'handCashed'; player: number; chips: number; mult: number; points: number }
  | { type: 'handLost'; player: number; points: number };

export type { GuardKind };

export interface StepContext {
  course: Course;
  tuning: Tuning;
  tick: number;
  rng: Rng;
  guards: GuardState[];
  emit: (event: SimEvent) => void;
}

/**
 * How far the legs can reach down to keep the skis on the snow while the body floats over a dip.
 * Within this gap the edges and friction keep working, which is what absorbing bumps feels like.
 */
export const LEG_REACH = 0.3;
/** You can still jump this long after leaving the snow. */
const COYOTE_TIME = 0.12;
/** Air time that counts as a real landing rather than a skipped bump. */
const LANDING_AIR = 0.25;
const PLAYER_RADIUS = 0.35;
/** Furthest the skis can turn away from the flight path while airborne. */
const AIR_ALIGN = 30 * DEG;

/** Passing this close to a tree's trunk at speed is a graze. */
const GRAZE_GAP = 1.5;
const GRAZE_SPEED = 14;

const blend = (cruise: number, tuck: number, plow: number, p: PlayerState) =>
  lerp(lerp(cruise, tuck, p.tuck), plow, p.plow);

/** Eye height above the feet for the current stance. */
export const eyeHeight = (p: PlayerState): number => lerp(lerp(1.62, 1.05, p.tuck), 1.45, p.plow);
/** How far the head leans forward over the skis in a tuck. */
export const eyeLean = (p: PlayerState): number => p.tuck * 0.3;

/** Where the player's eyes (and gun) are. Shots start here. */
export function eyePosition(p: PlayerState, out: Vec3 = vec3()): Vec3 {
  const lean = eyeLean(p);
  out.x = p.pos.x - Math.sin(p.heading) * lean;
  out.y = p.pos.y + eyeHeight(p);
  out.z = p.pos.z - Math.cos(p.heading) * lean;
  return out;
}

export function crashPlayer(p: PlayerState, cause: CrashCause, tick: number, emit: (e: SimEvent) => void): void {
  if (p.status !== 'skiing') return;
  p.status = 'crashed';
  p.statusTick = tick;
  p.crashCause = cause;
  emit({ type: 'crash', player: p.id, cause, speed: length(p.vel) });
}

/** A guard's bullet found you: lose a hit, a little speed, and your open hand. */
export function hurtPlayer(p: PlayerState, damage: number, tuning: Tuning, tick: number, emit: (e: SimEvent) => void): void {
  if (p.status !== 'skiing' || p.invuln > 0) return;
  p.hp = Math.max(0, p.hp - damage);
  p.invuln = 0.6;
  p.regen = tuning.hpRegenTime;
  p.vel.x *= 0.92;
  p.vel.y *= 0.92;
  p.vel.z *= 0.92;
  emit({ type: 'playerHit', player: p.id, hp: p.hp });
  loseHand(p, { tuning, emit });
  if (p.hp <= 0) crashPlayer(p, 'shot', tick, emit);
}

export function createPlayer(id: number, count: number, course: Course, tuning: Tuning, rng: Rng): PlayerState {
  const d = course.startD;
  const lane = (id - (count - 1) / 2) * 4;
  const x = course.centerX(d) + lane;
  const z = -d;
  const heading = course.trackYaw(d);
  const normal = course.normalAt(x, z);
  const vel = forwardFromYaw(heading);
  const vn = dot(vel, normal);
  vel.x -= normal.x * vn;
  vel.y -= normal.y * vn;
  vel.z -= normal.z * vn;
  normalize(vel);
  vel.x *= tuning.startSpeed;
  vel.y *= tuning.startSpeed;
  vel.z *= tuning.startSpeed;

  const wobblePhase: number[] = [];
  for (let i = 0; i < 6; i++) wobblePhase.push(rng.range(0, Math.PI * 2));

  return {
    id,
    pos: vec3(x, course.heightAt(x, z), z),
    vel,
    heading,
    normal,
    onSnow: true,
    airTime: 0,
    tuck: 0,
    plow: 0,
    status: 'skiing',
    statusTick: 0,
    crashCause: null,
    jumpHeld: false,
    aimYaw: heading,
    aimPitch: 0,
    wobbleYaw: 0,
    wobblePitch: 0,
    wobblePhase,
    skid: 0,
    lean: 0,
    topSpeed: tuning.startSpeed,
    distance: d,
    maxAir: 0,
    hp: tuning.playerHp,
    invuln: 0,
    regen: 0,
    aiming: 0,
    weapon: { ammo: tuning.magSize, cooldown: 0, reload: 0 },
    score: newScore(),
    lastGraze: -1,
  };
}

// Scratch vectors (the simulation is single-threaded and these never escape a step).
const fwd = vec3();
const side = vec3();

export function stepPlayer(p: PlayerState, input: InputFrame, ctx: StepContext): void {
  const { course, tuning: T, tick, emit } = ctx;
  const g = T.gravity;
  const v = p.vel;
  const crashed = p.status === 'crashed';
  const finished = p.status === 'finished';
  const active = p.status === 'skiing';

  const crash = (cause: CrashCause) => crashPlayer(p, cause, tick, emit);

  // Grace after a hit, and winning hits back while nobody lands one.
  if (p.invuln > 0) p.invuln -= DT;
  if (active && p.hp < T.playerHp) {
    p.regen -= DT;
    if (p.regen <= 0) {
      p.hp++;
      p.regen = T.hpRegenTime;
    }
  }

  // --- Stance -------------------------------------------------------------------------------
  const wantPlow = (active && input.plow) || finished;
  const wantTuck = active && input.tuck && !input.plow;
  p.tuck = approach(p.tuck, wantTuck ? 1 : 0, T.stanceRate * DT);
  p.plow = approach(p.plow, wantPlow ? 1 : 0, T.stanceRate * DT);

  p.aimYaw = input.aimYaw;
  p.aimPitch = clamp(input.aimPitch, -1.45, 1.45);

  // --- Steering: pivot the skis toward the wanted yaw, never further than a traverse ---------
  const track = course.trackYaw(-p.pos.z);
  if (!crashed) {
    const maxTraverse = T.maxTraverseDeg * DEG;
    const want = finished ? track : input.steerYaw;
    const desired = track + clamp(wrapAngle(want - track), -maxTraverse, maxTraverse);
    if (p.onSnow) {
      const rate = blend(T.turnRate, T.turnRateTuck, T.turnRatePlow, p);
      p.heading = wrapAngle(approachAngle(p.heading, desired, rate * DT));
    } else if (v.x * v.x + v.z * v.z > 4) {
      // In the air the skis stay roughly lined up with the flight path, so steering mid-air
      // tweaks the landing instead of setting you down sideways.
      const flightYaw = Math.atan2(-v.x, -v.z);
      const target = flightYaw + clamp(wrapAngle(desired - flightYaw), -AIR_ALIGN, AIR_ALIGN);
      p.heading = wrapAngle(approachAngle(p.heading, target, T.turnRateAir * DT));
    }
  }

  // --- Forces -------------------------------------------------------------------------------
  // Gravity always acts; the snow only pushes back where the skis press into it.
  v.y -= g * DT;

  if (p.onSnow) {
    const n = p.normal;
    forwardFromYaw(p.heading, fwd);
    const fn = dot(fwd, n);
    fwd.x -= n.x * fn;
    fwd.y -= n.y * fn;
    fwd.z -= n.z * fn;
    normalize(fwd);
    normalize(cross(fwd, n, side)); // points to the skier's right

    const vn = dot(v, n);
    let vf = dot(v, fwd);
    let vs = dot(v, side);
    const load = g * Math.max(n.y, 0.2);

    if (!crashed) {
      // Edges cancel sideways sliding up to the grip limit. A clean carve keeps your speed;
      // pivoting faster than the edges can hold turns into a skid that scrubs it off.
      const tangential = Math.sqrt(vf * vf + vs * vs);
      const slip = Math.atan2(Math.abs(vs), Math.abs(vf));
      const grip = blend(T.grip, T.gripTuck, T.gripPlow, p) * load * (1 - (1 - T.skidGrip) * smoothstep(0.35, 1.3, slip));
      const cancel = Math.min(Math.abs(vs), grip * DT);
      const dvs = -Math.sign(vs) * cancel;
      p.skid = clamp(Math.abs(vs) / Math.max(tangential, 2), 0, 1);
      p.lean = dvs / DT / g;
      vs += dvs;
    } else {
      p.skid = 1;
      p.lean = 0;
    }

    const speed = Math.sqrt(vf * vf + vs * vs);
    if (speed > 1e-6) {
      let decel: number;
      if (crashed) {
        decel = 0.55 * load + 0.01 * speed * speed;
      } else {
        const drag = blend(T.dragCruise, T.dragTuck, T.dragPlow, p);
        // The plow brakes toward a floor speed, never to a standstill: you can't stop.
        const brake = Math.min(T.plowBrake * Math.max(0, speed - T.plowFloor), T.plowMaxDecel) * p.plow * p.plow;
        decel = T.snowFriction * load + drag * speed * speed + brake;
      }
      const k = Math.max(0, speed - decel * DT) / speed;
      vf *= k;
      vs *= k;
    }

    v.x = fwd.x * vf + side.x * vs + n.x * vn;
    v.y = fwd.y * vf + side.y * vs + n.y * vn;
    v.z = fwd.z * vf + side.z * vs + n.z * vn;
  } else {
    const speed = length(v);
    if (speed > 1e-6) {
      const drag = crashed ? T.dragCruise : blend(T.dragCruise, T.dragTuck, T.dragCruise, p);
      const k = Math.max(0, speed - drag * speed * speed * DT) / speed;
      v.x *= k;
      v.y *= k;
      v.z *= k;
    }
    p.skid = 0;
    p.lean = 0;
  }

  // --- Jump ---------------------------------------------------------------------------------
  if (active && input.jump && !p.jumpHeld && p.airTime < COYOTE_TIME) {
    v.x += p.normal.x * T.jumpSpeed;
    v.y += p.normal.y * T.jumpSpeed;
    v.z += p.normal.z * T.jumpSpeed;
    p.airTime = COYOTE_TIME;
    p.onSnow = false;
    emit({ type: 'jump', player: p.id });
  }
  p.jumpHeld = input.jump;

  // --- Move ---------------------------------------------------------------------------------
  p.pos.x += v.x * DT;
  p.pos.y += v.y * DT;
  p.pos.z += v.z * DT;

  // Invisible walls at the edge of the forest and the ends of the world.
  let d = -p.pos.z;
  if (d < course.topD + 2) {
    p.pos.z = -(course.topD + 2);
    if (v.z > 0) v.z = 0;
  } else if (d > course.endD - 8) {
    p.pos.z = -(course.endD - 8);
    if (v.z < 0) v.z = 0;
  }
  d = -p.pos.z;
  const u = course.lateral(p.pos.x, p.pos.z);
  const wall = course.wallU(d);
  if (Math.abs(u) > wall) {
    p.pos.x = course.centerX(d) + Math.sign(u) * wall;
    if (Math.sign(v.x) === Math.sign(u)) v.x = 0;
  }

  // Trees: straight in is a wipeout, a glancing blow just shoves you aside.
  course.forTreesNear(p.pos.x, p.pos.z, 3, (tree) => {
    if (p.pos.y > tree.y + tree.height * 0.85) return; // sailed over it
    const dx = p.pos.x - tree.x;
    const dz = p.pos.z - tree.z;
    const r = tree.hitRadius + PLAYER_RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 >= r * r) {
      const g = r + GRAZE_GAP;
      if (d2 < g * g && p.status === 'skiing' && tree.id !== p.lastGraze && length(v) > GRAZE_SPEED) {
        p.lastGraze = tree.id;
        p.score.grazes++;
        emit({ type: 'graze', player: p.id, tree: tree.id });
        award(p, 'Graze', 10, 0.1, ctx);
      }
      return;
    }
    const dist = Math.sqrt(d2) || 1e-4;
    const nx = dx / dist;
    const nz = dz / dist;
    p.pos.x = tree.x + nx * r;
    p.pos.z = tree.z + nz * r;
    const into = -(v.x * nx + v.z * nz);
    if (into <= 0) return;
    if (p.status === 'skiing' && into > T.crashTreeSpeed) {
      crash('tree');
      v.x += nx * into * 1.3;
      v.z += nz * into * 1.3;
    } else {
      v.x += nx * into;
      v.z += nz * into;
      if (p.status === 'skiing') emit({ type: 'treeBump', player: p.id, speed: into });
    }
  });

  // --- Snow contact -------------------------------------------------------------------------
  const h = course.heightAt(p.pos.x, p.pos.z);
  if (p.pos.y <= h) {
    p.pos.y = h;
    const n = course.normalAt(p.pos.x, p.pos.z, p.normal);
    const vn = dot(v, n);
    if (vn < 0) {
      const impact = -vn;
      v.x -= n.x * vn;
      v.y -= n.y * vn;
      v.z -= n.z * vn;
      if (p.status === 'skiing') {
        if (impact > T.crashImpact) {
          crash('impact');
        } else if (p.airTime >= LANDING_AIR) {
          emit({ type: 'land', player: p.id, impact, airTime: p.airTime });
          if (p.airTime >= 0.5) {
            award(p, p.airTime >= 1.5 ? 'Big air' : 'Air', Math.round(p.airTime * 40), 0.3 * p.airTime, ctx);
          }
          const speed = length(v);
          if (speed > 10) {
            forwardFromYaw(p.heading, fwd);
            normalize(cross(fwd, n, side));
            const slip = Math.atan2(Math.abs(dot(v, side)), dot(v, fwd));
            if (slip > T.crashLandingSlipDeg * DEG) crash('edge');
          }
        } else if (impact > 3) {
          emit({ type: 'impact', player: p.id, impact });
        }
      }
    }
    if (p.status === 'skiing') p.maxAir = Math.max(p.maxAir, p.airTime);
    p.airTime = 0;
    p.onSnow = true;
  } else {
    p.airTime += DT;
    if (p.pos.y - h > LEG_REACH) p.onSnow = false;
  }

  // --- Bookkeeping --------------------------------------------------------------------------
  if (p.status === 'skiing' && -p.pos.z >= course.finishD) {
    p.status = 'finished';
    p.statusTick = tick;
    emit({ type: 'finish', player: p.id, tick });
    finishBonus(p, course.finishD, tick * DT, ctx);
  }
  if (p.status === 'crashed' && p.score.hand) loseHand(p, ctx);

  const speed = length(v);
  if (p.status === 'skiing') {
    p.topSpeed = Math.max(p.topSpeed, speed);
    p.distance = Math.max(p.distance, -p.pos.z);
  }

  // Aim wobble: smooth sway plus speed chatter. Deterministic in the tick count.
  const airborne = p.airTime > COYOTE_TIME ? 1 : 0;
  const amp =
    p.status === 'crashed'
      ? 0
      : (T.wobbleBase + T.wobblePerSpeed * speed * (1 + T.wobbleTuckBoost * p.tuck)) * (1 - T.wobblePlowSteady * p.plow) +
        T.wobbleAir * airborne;
  const t = tick * DT;
  const ph = p.wobblePhase;
  p.wobbleYaw = amp * (0.6 * Math.sin(1.7 * t + ph[0]) + 0.3 * Math.sin(4.3 * t + ph[1]) + 0.25 * Math.sin(11.3 * t + ph[2]));
  p.wobblePitch = amp * (0.6 * Math.sin(1.3 * t + ph[3]) + 0.3 * Math.sin(3.9 * t + ph[4]) + 0.25 * Math.sin(9.7 * t + ph[5]));
}

export const speedOf = (p: PlayerState): number => length(p.vel);
