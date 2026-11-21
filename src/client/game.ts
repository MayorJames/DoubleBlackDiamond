// Wires the simulation to input, rendering, HUD and sound. The flow each frame:
//   input events -> LocalControls -> (fixed ticks) InputFrame -> Sim.step -> events
//   -> PlayerView/HUD/Sfx read the state -> render.

import * as THREE from 'three';
import { Sfx } from '../audio/sfx';
import { Effects } from '../render/effects';
import { GuardViews } from '../render/guards';
import { INK, RED } from '../render/palette';
import { PlayerView } from '../render/playerView';
import { WorldRenderer } from '../render/world';
import { assistCone, findAssistTarget } from '../sim/combat';
import { DEG, DT } from '../sim/constants';
import { copyVec, lerp, lerpAngle, length, vec3, type Vec3 } from '../sim/math';
import { eyePosition, type CrashCause, type PlayerState, type SimEvent } from '../sim/player';
import { aimDirection } from '../sim/ray';
import { payout } from '../sim/scoring';
import { Sim } from '../sim/sim';
import { type Tuning } from '../sim/tuning';
import { formatPoints, formatTime, Hud, type Projector, type ResultInfo } from '../ui/hud';
import { TuningPanel } from '../ui/tuningPanel';
import { LocalControls } from './controls';
import { FixedLoop } from './loop';
import { loadBank, loadSettings, loadTuning, saveBank, saveSettings, saveTuning } from './settings';

type Mode = 'title' | 'playing' | 'paused' | 'ended';

/** A player on this machine: their input, their camera, and what we need to interpolate them. */
interface LocalPlayer {
  index: number;
  controls: LocalControls;
  view: PlayerView;
  prevPos: Vec3;
  prevHeading: number;
}

const SEED_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CRASH_LINES: Record<CrashCause, string> = {
  tree: 'You found a tree. It found you back.',
  impact: 'Landed like a dropped fridge.',
  edge: 'Caught an edge and cartwheeled.',
  shot: 'They finally hit something.',
  tower: 'You skied into a watchtower. The sniper is also confused.',
};
const BURST_WORDS = ['WHAM!', 'THWACK!', 'KAPOW!', 'SPLAT!', 'KLONK!', 'BOFF!', 'ZOK!'];
const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];

export function randomSeed(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => SEED_ALPHABET[b % SEED_ALPHABET.length]).join('');
}

/** Seeds that can live in the URL hash (`#QX7P2M`), which is what a shared link carries. */
const HASH_SEED = /^[A-Za-z0-9-]{1,32}$/;

function seedFromHash(): string | null {
  try {
    const seed = decodeURIComponent(location.hash.slice(1)).trim();
    return HASH_SEED.test(seed) ? seed : null;
  } catch {
    return null;
  }
}

/** `?seed=anything` wins, then `#SEED`. */
function seedFromUrl(): string | null {
  try {
    const seed = new URLSearchParams(location.search).get('seed')?.trim();
    if (seed) return seed.slice(0, 32);
  } catch {
    // Fall through to the hash.
  }
  return seedFromHash();
}

/** Put the seed in the hash so the address (and a copied link) opens this mountain. */
function writeSeedToUrl(seed: string): void {
  if (!HASH_SEED.test(seed)) return; // Leave an unusual ?seed= value where it is.
  try {
    const params = new URLSearchParams(location.search);
    params.delete('seed');
    const query = params.toString();
    history.replaceState(history.state, '', `${location.pathname}${query ? `?${query}` : ''}#${seed}`);
  } catch {
    // Some embeds forbid touching history; the seed is still shown on screen.
  }
}

export class Game {
  private sim!: Sim;
  private seed = '';
  private mode: Mode = 'title';
  private readonly world: WorldRenderer;
  private readonly hud = new Hud();
  private readonly sfx = new Sfx();
  private readonly panel: TuningPanel;
  private readonly settings = loadSettings();
  private readonly tuning: Tuning = loadTuning();
  private readonly controls: LocalControls;
  private locals: LocalPlayer[] = [];
  private readonly loop: FixedLoop;
  private elapsed = 0;
  private resultAt = -1;
  private resultShown = false;
  private fps = 60;
  private lastTicks = 0;
  private guardViews: GuardViews | null = null;
  private effects: Effects | null = null;
  private bank = loadBank();
  private banked = 0;
  private readonly projectTmp = new THREE.Vector3();
  private readonly fromTmp = new THREE.Vector3();
  private readonly toTmp = new THREE.Vector3();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.world = new WorldRenderer(canvas);
    this.world.setRenderScale(this.settings.renderScale);
    this.sfx.setVolume(this.settings.volume);
    this.controls = new LocalControls(canvas, this.settings);
    this.panel = new TuningPanel({
      getTuning: () => this.tuning,
      onTuningChange: (t) => {
        Object.assign(this.tuning, t);
        Object.assign(this.sim.state.tuning, t);
        saveTuning(this.tuning);
      },
      settings: this.settings,
      onSettingsChange: (s) => {
        saveSettings(s);
        this.world.setRenderScale(s.renderScale);
        this.sfx.setVolume(s.volume);
      },
    });
    this.loop = new FixedLoop(
      () => this.tick(),
      (alpha, dt, ticks) => this.frame(alpha, dt, ticks),
    );

    this.newRun(seedFromUrl() ?? randomSeed());
    this.bindUi();
    this.hud.showOverlay('title');
    this.loop.start();
  }

  // --- Run lifecycle ------------------------------------------------------------------------

  private newRun(seed: string): void {
    const sameSeed = this.sim && seed === this.seed;
    this.seed = seed;
    this.sim = Sim.create({ seed, players: 1, tuning: this.tuning, course: sameSeed ? this.sim.course : undefined });
    this.world.setCourse(this.sim.course);
    const views = this.world.setViewCount(this.sim.players.length);
    this.locals = this.sim.players.map((p, i) => ({
      index: i,
      controls: this.controls,
      view: views[i],
      prevPos: copyVec(vec3(), p.pos),
      prevHeading: p.heading,
    }));
    for (const l of this.locals) l.controls.reset(this.sim.players[l.index].heading);
    this.guardViews?.dispose();
    this.guardViews = new GuardViews(this.world.scene, this.sim.course, this.sim.guards);
    this.effects ??= new Effects(this.world.scene);
    this.banked = -1;
    this.hud.reset();
    this.hud.setSeed(seed);
    this.resultAt = -1;
    this.resultShown = false;
    writeSeedToUrl(seed);
  }

  /** Start or resume play. Must run inside a user gesture (pointer lock and audio need one). */
  private begin(): void {
    this.sfx.unlock();
    if (this.mode === 'ended' || this.resultShown) this.newRun(this.seed);
    this.panel.toggle(false);
    this.setMode('playing');
    if (document.pointerLockElement !== this.canvas) void this.lockPointer();
  }

  private async lockPointer(): Promise<void> {
    try {
      // Raw mouse input (no OS acceleration) where supported.
      await this.canvas.requestPointerLock({ unadjustedMovement: true });
    } catch {
      try {
        await this.canvas.requestPointerLock();
      } catch {
        // Sandboxed frames can refuse pointer lock; drag to look instead.
        this.controls.dragFallback = true;
        this.hud.popup('Drag to look');
      }
    }
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    this.loop.paused = mode === 'title' || mode === 'paused';
    for (const l of this.locals) l.controls.enabled = mode === 'playing' || mode === 'ended';
    this.hud.setVisible(mode !== 'title');
    if (mode === 'playing') this.hud.showOverlay(null);
    else if (mode === 'paused') this.hud.showOverlay('paused');
    else if (mode === 'title') this.hud.showOverlay('title');
  }

  private bindUi(): void {
    document.getElementById('start')!.addEventListener('click', () => this.begin());
    document.querySelector('#paused .resume')!.addEventListener('click', () => this.begin());
    document.getElementById('result')!.addEventListener('click', () => this.begin());
    document.getElementById('title')!.addEventListener('click', (e) => {
      if (e.target === e.currentTarget) this.begin();
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this.mode === 'title' || this.mode === 'paused' || this.resultShown) this.begin();
      else if (this.mode === 'playing' && document.pointerLockElement !== this.canvas && !this.controls.dragFallback)
        void this.lockPointer();
    });

    document.addEventListener('pointerlockchange', () => {
      const locked = document.pointerLockElement === this.canvas;
      if (!locked && this.mode === 'playing' && !this.controls.dragFallback) this.setMode('paused');
    });

    window.addEventListener('keydown', (e) => {
      if (e.repeat || e.target instanceof HTMLInputElement) return;
      switch (e.code) {
        case 'Backquote':
          if (this.panel.toggle()) {
            if (this.mode === 'playing') this.setMode('paused');
            document.exitPointerLock?.();
          }
          break;
        case 'KeyR':
          if (this.mode !== 'title') {
            this.newRun(this.seed);
            this.begin();
          }
          break;
        case 'KeyN':
          this.newRun(randomSeed());
          if (this.mode !== 'title') this.begin();
          break;
        case 'KeyM':
          this.hud.popup(this.sfx.toggleMute() ? 'Muted' : 'Sound on');
          break;
      }
    });

    // Someone pasted or edited a #SEED: switch to that mountain.
    window.addEventListener('hashchange', () => {
      const seed = seedFromHash();
      if (!seed || seed === this.seed) return;
      this.newRun(seed);
      if (this.mode === 'ended') this.setMode('playing');
    });

    window.addEventListener('resize', () => this.world.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'playing') this.setMode('paused');
    });
  }

  // --- Fixed tick ---------------------------------------------------------------------------

  private tick(): void {
    const players = this.sim.players;
    for (const l of this.locals) {
      copyVec(l.prevPos, players[l.index].pos);
      l.prevHeading = players[l.index].heading;
    }
    this.guardViews?.capture(this.sim.guards);
    this.sim.step(this.locals.map((l) => l.controls.sample()));
    for (const e of this.sim.drainEvents()) this.onEvent(e);
  }

  private localView(player: number): PlayerView | null {
    return this.locals.find((l) => l.index === player)?.view ?? null;
  }

  private onEvent(e: SimEvent): void {
    if ('player' in e) {
      const player = this.sim.players[e.player];
      for (const l of this.locals) l.view.onEvent(e, player);
    }
    this.guardViews?.onEvent(e, this.sim.guards);
    this.sfx.onEvent(e);
    this.onCombatEvent(e);
    switch (e.type) {
      case 'treeBump':
        if (e.speed > 3) this.hud.popup('Bark!');
        break;
      case 'crash':
        this.hud.flash();
        this.hud.popup(e.cause === 'shot' ? 'Shot down!' : 'Yard sale!', 'big red');
        this.endRun(1.7);
        break;
      case 'finish':
        this.hud.popup('Base camp!', 'big');
        this.endRun(1.4);
        break;
    }
  }

  /** Shots, guards and scoring: tracers, comic bursts, sounds and HUD pops. */
  private onCombatEvent(e: SimEvent): void {
    const fx = this.effects;
    const me = this.locals[0];
    const cam = me.view.camera.position;
    switch (e.type) {
      case 'shot': {
        if (!fx) break;
        const view = this.localView(e.player);
        const from = view ? view.muzzleWorld(this.fromTmp) : this.fromTmp.set(e.from.x, e.from.y, e.from.z);
        const to = this.toTmp.set(e.to.x, e.to.y, e.to.z);
        fx.tracer(from, to, INK, 0.035, 0.09);
        if (e.hit === 'terrain') fx.puff(to, '#9a9a9a', 1.1);
        else if (e.hit === 'tree') fx.puff(to, INK, 0.9);
        else if (e.hit === 'guard') fx.puff(to, RED, 0.7, 0.25);
        if (view) this.sfx.gunshot();
        break;
      }
      case 'guardShot': {
        const to = this.toTmp.set(e.to.x, e.to.y, e.to.z);
        const from = this.guardViews ? this.guardViews.muzzleOf(e.guard, this.fromTmp) : this.fromTmp.set(e.from.x, e.from.y, e.from.z);
        const atMe = this.localView(e.target) !== null;
        if (e.hit && atMe) to.lerp(from, Math.min(0.9, 2 / Math.max(2, from.distanceTo(to))));
        fx?.tracer(from, to, RED, 0.06, 0.14);
        if (!e.hit) fx?.puff(to, '#9a9a9a', 1);
        this.sfx.enemyShot(from.distanceTo(cam));
        if (!e.hit && atMe && to.distanceTo(cam) < 4) this.sfx.whizz();
        break;
      }
      case 'guardAim':
        if (this.sim.guards[e.guard].kind === 'sniper' && this.localView(e.target)) this.sfx.laserHum();
        break;
      case 'guardHit':
        if (this.localView(e.player) && this.sim.guards[e.guard].hp > 0) {
          this.hud.hitmarker(e.head);
          this.sfx.hitTick();
        }
        break;
      case 'guardDown': {
        const g = this.sim.guards[e.guard];
        const word = e.cause === 'bowled' ? 'STRIKE!' : e.head ? 'BONK!' : pick(BURST_WORDS);
        this.hud.burst(word, { x: g.pos.x, y: g.pos.y + 2.2, z: g.pos.z }, this.elapsed, e.cause === 'bowled');
        if (this.localView(e.player)) this.hud.hitmarker(e.head);
        this.sfx.slideWhistle();
        if (e.head) this.sfx.bonk();
        if (e.cause === 'bowled') this.sfx.boing();
        break;
      }
      case 'playerHit':
        if (this.localView(e.player)) {
          this.hud.hurt();
          this.hud.popup('Oof!', 'big red');
          this.sfx.oof();
        }
        break;
      case 'chips':
        if (this.localView(e.player)) {
          this.hud.chips(e.label, e.chips, e.mult);
          this.sfx.chipTick(this.sim.players[e.player].score.hand?.events ?? 0);
        }
        break;
      case 'handCashed':
        if (this.localView(e.player)) {
          this.hud.cashed(e.points);
          this.sfx.chaChing();
        }
        break;
      case 'handLost':
        if (this.localView(e.player) && e.points > 0) {
          this.hud.lost(e.points);
          this.sfx.sadTrombone();
        }
        break;
      case 'reload':
      case 'reloaded':
        if (this.localView(e.player)) this.sfx.reloadClick();
        break;
    }
  }

  private endRun(delay: number): void {
    if (this.sim.players.some((p) => p.status === 'skiing')) return;
    this.setMode('ended');
    this.resultAt = this.elapsed + delay;
    // Bank the payout once per run.
    if (this.banked < 0) {
      this.banked = payout(this.sim.players[this.locals[0].index]);
      this.bank += this.banked;
      saveBank(this.bank);
    }
  }

  private resultInfo(p: PlayerState): ResultInfo {
    const time = p.statusTick * DT;
    const s = p.score;
    const finished = p.status === 'finished';
    const stats: [string, string][] = [
      ['Score', formatPoints(s.total)],
      ['Hands cashed', `${s.hands}  (best ${formatPoints(s.best)})`],
      ['Guards down', `${s.kills} / ${this.sim.guards.length}  (${s.headshots} bonk)`],
      ['Grazes · whiffs', `${s.grazes} · ${s.whiffs}`],
      ['Top speed', `${Math.round(p.topSpeed * 3.6)} km/h`],
      [finished ? 'Time' : 'Made it', finished ? formatTime(time) : `${Math.round(p.distance)} / ${this.sim.course.finishD} m`],
    ];
    if (s.lost > 0) stats.push(['Lost in hands', formatPoints(s.lost)]);
    return {
      title: finished ? 'Base camp!' : p.crashCause === 'shot' ? 'Shot down!' : 'Yard sale!',
      subtitle: finished ? 'Down in one piece. Faster pays more.' : CRASH_LINES[p.crashCause ?? 'impact'],
      payout: Math.max(0, this.banked),
      payoutNote: finished ? 'Paid in full at base camp' : 'Halved: you wiped out',
      bank: this.bank,
      stats,
    };
  }

  // --- Render frame -------------------------------------------------------------------------

  private frame(alpha: number, dt: number, ticks: number): void {
    this.elapsed += dt;
    this.lastTicks = ticks;
    if (dt > 0) this.fps = lerp(this.fps, 1 / dt, 0.05);
    const course = this.sim.course;
    const maxTraverse = this.tuning.maxTraverseDeg * DEG;
    const pos = vec3();

    for (const l of this.locals) {
      const p = this.sim.players[l.index];
      l.controls.update(dt, course.trackYaw(-p.pos.z), maxTraverse);
      pos.x = lerp(l.prevPos.x, p.pos.x, alpha);
      pos.y = lerp(l.prevPos.y, p.pos.y, alpha);
      pos.z = lerp(l.prevPos.z, p.pos.z, alpha);
      l.view.update({
        player: p,
        pos,
        heading: lerpAngle(l.prevHeading, p.heading, alpha),
        lookYaw: l.controls.lookYaw,
        lookPitch: l.controls.pitch,
        dt,
        time: this.elapsed,
        settings: this.settings,
      });
    }
    this.guardViews?.update(this.sim.guards, alpha, dt, this.elapsed, (i) => {
      const view = this.localView(i);
      if (view) return view.camera.position.clone().add(new THREE.Vector3(0, -0.25, 0));
      const target = this.sim.players[i];
      return target ? new THREE.Vector3().copy(eyePosition(target)) : null;
    });
    this.effects?.update(dt);
    this.world.render(dt, this.elapsed);

    const me = this.locals[0];
    const p = this.sim.players[me.index];
    const runTime = p.status === 'skiing' ? this.sim.time : p.statusTick * DT;
    const aiming = me.controls.freelook && p.status === 'skiing';
    let lock: Vec3 | null = null;
    if (p.status === 'skiing') {
      const dir = aimDirection(me.controls.lookYaw + p.wobbleYaw, me.controls.pitch + p.wobblePitch);
      const target = findAssistTarget(course, this.sim.guards, eyePosition(p), dir, assistCone(p, aiming, this.tuning), this.tuning.weaponRange);
      lock = target?.point ?? null;
    }
    this.hud.update({
      player: p,
      course,
      tuning: this.tuning,
      runTime,
      fov: me.view.camera.fov,
      viewHeight: window.innerHeight * me.view.viewport.h,
      dt,
      time: this.elapsed,
      project: this.projector(me.view),
      lock,
      aiming,
    });
    this.sfx.update(p, this.mode === 'playing' || this.mode === 'ended');

    if (this.mode === 'ended' && !this.resultShown && this.elapsed >= this.resultAt) {
      this.resultShown = true;
      this.hud.showOverlay('result', this.resultInfo(p));
    }

    if (this.panel.isOpen) this.panel.setStats(this.statsText(p));
  }

  /** World point to CSS pixels for a view, or null when behind the camera. */
  private projector(view: PlayerView): Projector {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const vp = view.viewport;
    return (pt) => {
      const v = this.projectTmp.set(pt.x, pt.y, pt.z).project(view.camera);
      if (v.z > 1 || v.z < -1) return null;
      return { x: (vp.x + ((v.x + 1) / 2) * vp.w) * w, y: (1 - (vp.y + ((v.y + 1) / 2) * vp.h)) * h };
    };
  }

  private statsText(p: PlayerState): string {
    const info = this.world.renderer.info;
    const c = this.sim.course;
    const d = -p.pos.z;
    const speed = length(p.vel);
    return [
      `fps ${this.fps.toFixed(0).padStart(4)}   ticks/frame ${this.lastTicks}`,
      `draw calls ${info.render.calls}   tris ${(info.render.triangles / 1000).toFixed(1)}k`,
      `tick ${this.sim.tick}   seed ${this.seed}`,
      `speed ${speed.toFixed(1)} m/s  ${(speed * 3.6).toFixed(0)} km/h`,
      `tuck ${p.tuck.toFixed(2)}  plow ${p.plow.toFixed(2)}  skid ${p.skid.toFixed(2)}`,
      `lean ${p.lean.toFixed(2)} g   air ${p.airTime.toFixed(2)} s  snow ${p.onSnow}`,
      `heading-trail ${((p.heading - c.trackYaw(d)) / DEG).toFixed(0)}°  wobble ${(Math.hypot(p.wobbleYaw, p.wobblePitch) / DEG).toFixed(2)}°`,
      `d ${d.toFixed(0)} m   u ${c.lateral(p.pos.x, p.pos.z).toFixed(1)} m`,
    ].join('\n');
  }
}
