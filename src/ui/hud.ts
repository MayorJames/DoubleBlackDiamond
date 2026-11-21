// The on-screen HUD and overlays. Plain DOM, written only when a value changes.

import type { Course } from '../sim/course';
import { length, type Vec3 } from '../sim/math';
import type { PlayerState } from '../sim/player';
import type { Tuning } from '../sim/tuning';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export const formatPoints = (n: number): string => Math.round(n).toLocaleString('en-US');
export const formatCash = (n: number): string => `$${formatPoints(n)}`;

/** Projects a world point to CSS pixels, or null when it is behind the camera. */
export type Projector = (p: Vec3) => { x: number; y: number } | null;

export interface HudFrame {
  player: PlayerState;
  course: Course;
  tuning: Tuning;
  runTime: number;
  /** Vertical field of view in degrees and viewport height in CSS pixels, to place the crosshair. */
  fov: number;
  viewHeight: number;
  dt: number;
  time: number;
  project: Projector;
  /** Where the aim assist would pull a shot right now, if anywhere. */
  lock: Vec3 | null;
  aiming: boolean;
}

export type OverlayName = 'title' | 'paused' | 'result' | null;

export interface ResultInfo {
  title: string;
  subtitle: string;
  payout: number;
  payoutNote: string;
  bank: number;
  stats: [label: string, value: string][];
}

interface Burst {
  el: HTMLElement;
  at: Vec3;
  until: number;
}

export class Hud {
  private readonly root = $('hud');
  private readonly timeEl = $('time');
  private readonly scoreEl = $('score');
  private readonly scoreCard = $('score-card');
  private readonly speedEl = $('speed');
  private readonly speedCard = $('speed-card');
  private readonly stanceEl = $('stance');
  private readonly fillEl = $('progress-fill');
  private readonly skierEl = $('progress-skier');
  private readonly togoEl = $('togo');
  private readonly seedEl = $('seed');
  private readonly titleSeedEl = $('title-seed');
  private readonly airEl = $('air');
  private readonly airTimeEl = $('air-time');
  private readonly handEl = $('hand');
  private readonly handChipsEl = $('hand-chips');
  private readonly handMultEl = $('hand-mult');
  private readonly handTimerEl = $('hand-timer');
  private readonly feedEl = $('chip-feed');
  private readonly hpEl = $('hp');
  private readonly ammoEl = $('ammo');
  private readonly lockEl = $('lock');
  private readonly crosshair = $('crosshair');
  private readonly hitmarkerEl = $('hitmarker');
  private readonly burstsEl = $('bursts');
  private readonly popups = $('popups');
  private readonly flashEl = $('flash');
  private readonly hurtEl = $('hurt');
  private readonly overlays = { title: $('title'), paused: $('paused'), result: $('result') };
  private readonly last = new Map<HTMLElement, string>();
  private bursts: Burst[] = [];
  private cardWobble = 0;
  private feedCount = 0;

  setSeed(seed: string): void {
    this.seedEl.textContent = seed;
    this.titleSeedEl.textContent = seed;
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  reset(): void {
    for (const b of this.bursts) b.el.remove();
    this.bursts = [];
    this.feedEl.replaceChildren();
    this.handEl.classList.add('hidden');
  }

  showOverlay(name: OverlayName, result?: ResultInfo): void {
    for (const [key, el] of Object.entries(this.overlays)) el.classList.toggle('hidden', key !== name);
    if (name === 'result' && result) {
      $('result-title').textContent = result.title;
      $('result-sub').textContent = result.subtitle;
      $('payout').textContent = formatCash(result.payout);
      $('payout-note').textContent = result.payoutNote;
      $('bank').textContent = formatCash(result.bank);
      const dl = $('result-stats');
      dl.replaceChildren();
      for (const [label, value] of result.stats) {
        const dt = document.createElement('dt');
        dt.textContent = label;
        const dd = document.createElement('dd');
        dd.textContent = value;
        dl.append(dt, dd);
      }
    }
  }

  popup(text: string, style: '' | 'red' | 'big' | 'big red' = ''): void {
    const el = document.createElement('div');
    el.className = `popup ${style}`;
    el.textContent = text;
    el.style.top = `${(this.popups.childElementCount % 4) * 40}px`;
    this.popups.append(el);
    setTimeout(() => el.remove(), 1000);
  }

  /** "+40 Sentry  +1.2×" rising from the hand panel. */
  chips(label: string, chips: number, mult: number): void {
    const el = document.createElement('div');
    el.className = 'feed';
    el.append(`+${chips} ${label} `);
    if (mult >= 0.05) {
      const em = document.createElement('em');
      em.textContent = `+${mult.toFixed(1)}×`;
      el.append(em);
    }
    el.style.bottom = `${(this.feedCount++ % 3) * 26}px`;
    this.feedEl.append(el);
    setTimeout(() => el.remove(), 1100);
    this.retrigger(this.handEl, 'pulse');
  }

  cashed(points: number): void {
    this.popup(`+${formatPoints(points)}`, 'big');
    this.retrigger(this.scoreCard, 'bump');
  }

  lost(points: number): void {
    this.popup(`Lost ${formatPoints(points)}`, 'red');
    this.retrigger(this.handEl, 'lost');
  }

  /** A comic word that pops at a point in the world. */
  burst(text: string, at: Vec3, time: number, white = false): void {
    const el = document.createElement('div');
    el.className = white ? 'burst white' : 'burst';
    el.textContent = text;
    el.style.rotate = `${(Math.random() - 0.5) * 24}deg`;
    this.burstsEl.append(el);
    this.bursts.push({ el, at: { ...at }, until: time + 0.9 });
  }

  hitmarker(head: boolean): void {
    this.hitmarkerEl.classList.toggle('head', head);
    this.retrigger(this.hitmarkerEl, 'on');
  }

  flash(): void {
    this.retrigger(this.flashEl, 'on');
  }

  hurt(): void {
    this.retrigger(this.hurtEl, 'on');
  }

  update(f: HudFrame): void {
    const p = f.player;
    const speed = length(p.vel);
    this.text(this.speedEl, String(Math.round(speed * 3.6)));
    this.text(this.timeEl, formatTime(f.runTime));
    this.text(this.scoreEl, formatPoints(p.score.total));

    const stance =
      p.status === 'crashed' ? 'down' : p.airTime > 0.25 ? 'air' : p.plow > 0.5 ? 'plow' : p.tuck > 0.5 ? 'tuck' : 'cruise';
    const labels = { down: 'Wiped out', air: 'Airborne', plow: 'Snowplow', tuck: 'Tuck', cruise: 'Cruise' };
    if (this.text(this.stanceEl, labels[stance])) this.stanceEl.className = `stance ${stance}`;

    // The speed card leans and shivers harder the faster you go (Balatro-style juice).
    this.cardWobble += f.dt * (2 + speed * 0.4);
    const shiver = Math.min(speed / 45, 1);
    const rot = Math.sin(this.cardWobble) * (0.6 + shiver * 2.2);
    this.speedCard.style.transform = `rotate(${rot.toFixed(2)}deg) scale(${(1 + shiver * 0.08).toFixed(3)})`;
    this.speedCard.classList.toggle('hot', speed > 36);

    const progress = Math.min(1, Math.max(0, p.distance / f.course.finishD));
    const pct = `${(progress * 100).toFixed(1)}%`;
    if (this.text(this.fillEl, pct, false)) {
      this.fillEl.style.width = pct;
      this.skierEl.style.left = pct;
    }
    const togo = Math.max(0, Math.ceil(f.course.finishD - p.distance));
    this.text(this.togoEl, p.status === 'finished' ? 'Base camp!' : `${togo} m to base camp`);

    const airborne = p.airTime > 0.25 && p.status !== 'crashed';
    this.airEl.classList.toggle('hidden', !airborne);
    if (airborne) this.text(this.airTimeEl, `${p.airTime.toFixed(1)}s`);

    // The open hand.
    const hand = p.score.hand;
    this.handEl.classList.toggle('hidden', !hand);
    if (hand) {
      this.text(this.handChipsEl, formatPoints(hand.chips));
      this.text(this.handMultEl, hand.mult.toFixed(1));
      this.handTimerEl.style.transform = `scaleX(${Math.max(0, hand.timer / f.tuning.comboWindow).toFixed(3)})`;
    }

    // Hits and ammo.
    if (this.text(this.hpEl, `${p.hp}/${f.tuning.playerHp}`, false)) {
      this.hpEl.replaceChildren(
        ...Array.from({ length: f.tuning.playerHp }, (_, i) => {
          const pip = document.createElement('i');
          if (i >= p.hp) pip.className = 'gone';
          return pip;
        }),
      );
    }
    const w = p.weapon;
    if (this.text(this.ammoEl, w.reload > 0 ? 'reload' : `${w.ammo}/${f.tuning.magSize}`, false)) {
      if (w.reload > 0) {
        const b = document.createElement('b');
        b.textContent = 'Reloading';
        this.ammoEl.replaceChildren(b);
      } else {
        this.ammoEl.replaceChildren(
          ...Array.from({ length: f.tuning.magSize }, (_, i) => {
            const round = document.createElement('i');
            if (i >= w.ammo) round.className = 'spent';
            return round;
          }),
        );
      }
    }

    // Crosshair drifts with the aim wobble the simulation computes (tuck = wobbly, plow = steady).
    const pxPerRad = f.viewHeight / 2 / Math.tan(((f.fov / 2) * Math.PI) / 180);
    const dx = -p.wobbleYaw * pxPerRad;
    const dy = -p.wobblePitch * pxPerRad;
    this.crosshair.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    this.crosshair.classList.toggle('hidden', p.status === 'crashed');
    this.crosshair.classList.toggle('aim', f.aiming);

    // Lock brackets around the guard the assist would pull toward.
    const lockAt = f.lock && p.status === 'skiing' ? f.project(f.lock) : null;
    this.lockEl.classList.toggle('hidden', !lockAt);
    if (lockAt) {
      this.lockEl.classList.toggle('aim', f.aiming);
      this.lockEl.style.transform = `translate(${(lockAt.x - 22).toFixed(0)}px, ${(lockAt.y - 32).toFixed(0)}px)`;
    }

    this.bursts = this.bursts.filter((b) => {
      if (f.time > b.until) {
        b.el.remove();
        return false;
      }
      const at = f.project(b.at);
      b.el.style.display = at ? '' : 'none';
      if (at) b.el.style.transform = `translate(${at.x.toFixed(0)}px, ${at.y.toFixed(0)}px) translate(-50%, -100%)`;
      return true;
    });
  }

  private retrigger(el: HTMLElement, cls: string): void {
    el.classList.remove(cls);
    void el.offsetWidth; // restart the animation
    el.classList.add(cls);
  }

  /** Returns true when the value changed. */
  private text(el: HTMLElement, value: string, write = true): boolean {
    if (this.last.get(el) === value) return false;
    this.last.set(el, value);
    if (write) el.textContent = value;
    return true;
  }
}
