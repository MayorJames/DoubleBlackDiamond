// The on-screen HUD and overlays. Plain DOM, written only when a value changes.

import type { Course } from '../sim/course';
import { length } from '../sim/math';
import type { PlayerState } from '../sim/player';

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

export interface HudFrame {
  player: PlayerState;
  course: Course;
  runTime: number;
  /** Vertical field of view in degrees and viewport height in CSS pixels, to place the crosshair. */
  fov: number;
  viewHeight: number;
  dt: number;
  time: number;
}

export type OverlayName = 'title' | 'paused' | 'result' | null;

export interface ResultInfo {
  title: string;
  subtitle: string;
  stats: [label: string, value: string][];
}

export class Hud {
  private readonly root = $('hud');
  private readonly timeEl = $('time');
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
  private readonly crosshair = $('crosshair');
  private readonly popups = $('popups');
  private readonly flashEl = $('flash');
  private readonly overlays = { title: $('title'), paused: $('paused'), result: $('result') };
  private readonly last = new Map<HTMLElement, string>();
  private cardWobble = 0;

  setSeed(seed: string): void {
    this.seedEl.textContent = seed;
    this.titleSeedEl.textContent = seed;
  }

  setVisible(visible: boolean): void {
    this.root.classList.toggle('hidden', !visible);
  }

  showOverlay(name: OverlayName, result?: ResultInfo): void {
    for (const [key, el] of Object.entries(this.overlays)) el.classList.toggle('hidden', key !== name);
    if (name === 'result' && result) {
      $('result-title').textContent = result.title;
      $('result-sub').textContent = result.subtitle;
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

  popup(text: string, color = '#fff4dc'): void {
    const el = document.createElement('div');
    el.className = 'popup';
    el.textContent = text;
    el.style.color = color;
    el.style.top = `${this.popups.childElementCount * 34}px`;
    this.popups.append(el);
    setTimeout(() => el.remove(), 1000);
  }

  flash(): void {
    this.flashEl.classList.remove('on');
    void this.flashEl.offsetWidth; // restart the animation
    this.flashEl.classList.add('on');
  }

  update(f: HudFrame): void {
    const p = f.player;
    const speed = length(p.vel);
    const kmh = Math.round(speed * 3.6);
    this.text(this.speedEl, String(kmh));
    this.text(this.timeEl, formatTime(f.runTime));

    const stance =
      p.status === 'crashed'
        ? 'down'
        : p.airTime > 0.25
          ? 'air'
          : p.plow > 0.5
            ? 'plow'
            : p.tuck > 0.5
              ? 'tuck'
              : 'cruise';
    const labels = { down: 'Wiped out', air: 'Airborne', plow: 'Snowplow', tuck: 'Tuck', cruise: 'Cruise' };
    if (this.text(this.stanceEl, labels[stance])) this.stanceEl.className = `stance ${stance}`;

    // The speed card leans and shivers harder the faster you go (Balatro-style juice).
    this.cardWobble += f.dt * (2 + speed * 0.4);
    const shiver = Math.min(speed / 45, 1);
    const rot = Math.sin(this.cardWobble) * (0.6 + shiver * 2.2);
    const scale = 1 + shiver * 0.08;
    this.speedCard.style.transform = `rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
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

    // Crosshair drifts with the aim wobble the simulation computes (tuck = wobbly, plow = steady).
    const pxPerRad = f.viewHeight / 2 / Math.tan(((f.fov / 2) * Math.PI) / 180);
    const dx = -p.wobbleYaw * pxPerRad;
    const dy = -p.wobblePitch * pxPerRad;
    this.crosshair.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    this.crosshair.classList.toggle('hidden', p.status === 'crashed');
  }

  /** Returns true when the text changed. */
  private text(el: HTMLElement, value: string, write = true): boolean {
    if (this.last.get(el) === value) return false;
    this.last.set(el, value);
    if (write) el.textContent = value;
    return true;
  }
}
