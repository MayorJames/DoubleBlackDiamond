// The lodge as a pixel panorama: the mountain and its pistes, a working chairlift, the forest,
// the lodge itself, and a plot for every building you can put up, which appears when you build
// it. The static picture is drawn once per change; snow, smoke, chairs and blinking lights are
// drawn over it each frame.

import type { BuildingId } from '../../game/lodge';
import { PIXELS } from '../sprites';
import { bayer, noise, Px } from './pixel';
import { cloud, flag, mountain, pine, range, sky, snowField } from './scenery';

export const SCENE_W = 360;
export const SCENE_H = 120;
const B = 111; // ground line for the buildings

/** Where each building stands: left edge, and its box for hovering. */
export const PLOTS: Record<BuildingId, { x: number; top: number }> = {
  trailCrew: { x: 2, top: B - 22 },
  patrolHut: { x: 34, top: B - 26 },
  radio: { x: 66, top: B - 50 },
  sauna: { x: 98, top: B - 22 },
  gondola: { x: 202, top: B - 26 },
  avalancheControl: { x: 242, top: B - 22 },
  spyHq: { x: 282, top: B - 28 },
  rental: { x: 322, top: B - 22 },
};
const PLOT_W = 30;

// The chairlift cable, from the lodge up to the shoulder of the mountain.
const CABLE = { x0: 198, y0: 82, x1: 262, y1: 26 };
// A piste the little skier follows down the mountain.
const PISTE: [number, number][] = [
  [262, 26],
  [232, 34],
  [252, 46],
  [214, 58],
  [238, 72],
  [218, 86],
];

const FONT: Record<string, string[]> = {
  L: ['k..', 'k..', 'k..', 'k..', 'kkk'],
  O: ['kkk', 'k.k', 'k.k', 'k.k', 'kkk'],
  D: ['kk.', 'k.k', 'k.k', 'k.k', 'kk.'],
  G: ['kkk', 'k..', 'k.k', 'k.k', 'kkk'],
  E: ['kkk', 'k..', 'kk.', 'k..', 'kkk'],
};

function text(px: Px, s: string, x: number, y: number): void {
  for (const ch of s) {
    px.grid(FONT[ch], x, y);
    x += 4;
  }
}

// --- The buildings ---------------------------------------------------------------------------

function roof(px: Px, x0: number, x1: number, eave: number, peak: number): void {
  const mid = (x0 + x1) / 2;
  px.poly(
    [
      [x0, eave],
      [mid, peak],
      [x1, eave],
    ],
    (x, y) => (x < mid - 1 || (x < mid + 1 && bayer(x, y, 8)) ? 'w' : 's'),
  );
  px.line(x0, eave, mid, peak, 'k');
  px.line(mid, peak, x1, eave, 'k');
  px.rect(x0, eave, x1 - x0 + 1, 1, 'k');
}

const BUILDINGS: Record<BuildingId, (px: Px, x: number) => void> = {
  trailCrew(px, x) {
    // A plank shed, shovels against it, and a bundle of red-and-white trail poles.
    px.rect(x + 2, B - 14, 20, 14, (i) => (i % 4 === 0 ? 'd' : 'm'));
    px.rect(x + 2, B - 14, 1, 14, 'k');
    px.rect(x + 21, B - 14, 1, 14, 'k');
    px.rect(x, B - 17, 24, 3, 'd');
    px.rect(x, B - 18, 24, 1, 'w');
    px.rect(x, B - 15, 24, 1, 'k');
    px.rect(x + 8, B - 10, 6, 10, 'k');
    px.line(x + 16, B - 1, x + 18, B - 12, 'k');
    px.rect(x + 15, B - 3, 3, 3, 'l');
    px.line(x + 19, B - 1, x + 20, B - 11, 'k');
    for (let k = 0; k < 4; k++) px.rect(x + 24 + k, B - 18 + (k % 2), 1, 18 - (k % 2), (_i, j) => (Math.floor(j / 2) % 2 ? 'r' : 'w'));
    px.rect(x + 23, B - 9, 6, 1, 'k');
  },
  patrolHut(px, x) {
    // A white hut with a red cross, and a flag on a pole.
    px.rect(x + 3, B - 13, 18, 13, 'w');
    px.rect(x + 3, B - 13, 1, 13, 'k');
    px.rect(x + 20, B - 13, 1, 13, 'k');
    roof(px, x + 1, x + 23, B - 13, B - 20);
    px.rect(x + 9, B - 11, 2, 6, 'r');
    px.rect(x + 7, B - 9, 6, 2, 'r');
    px.rect(x + 15, B - 8, 4, 8, 'd');
    px.line(x + 26, B - 1, x + 26, B - 26, 'k');
    px.rect(x + 27, B - 26, 5, 4, 'w');
    px.rect(x + 29, B - 26, 1, 4, 'r');
    px.rect(x + 27, B - 25, 5, 1, 'r');
    px.rect(x + 22, B - 3, 6, 2, 'r');
    px.rect(x + 22, B - 1, 7, 1, 'k');
  },
  radio(px, x) {
    // A hut, and a lattice mast with dishes; its light blinks (drawn each frame).
    px.rect(x + 1, B - 8, 12, 8, 'm');
    px.rect(x + 1, B - 9, 12, 1, 'w');
    px.rect(x + 1, B - 8, 12, 1, 'k');
    px.rect(x + 5, B - 5, 3, 5, 'k');
    const top = B - 46;
    const lx = (y: number) => x + 16 + ((B - y) * 4) / 46;
    const rx = (y: number) => x + 27 - ((B - y) * 4) / 46;
    for (let y = B - 2, k = 0; y > top + 2; y -= 6, k++) {
      const y2 = y - 6;
      if (k % 2) px.line(lx(y), y, rx(y2), y2, 'k');
      else px.line(rx(y), y, lx(y2), y2, 'k');
      px.line(lx(y), y, rx(y), y, 'k');
    }
    // Red-and-white striped legs, so the mast stands out against the forest.
    for (let y = top; y <= B; y++) {
      const c = Math.floor((B - y) / 4) % 2 ? 'w' : 'r';
      px.set(lx(y) - 1, y, 'k');
      px.set(lx(y), y, c);
      px.set(rx(y), y, c);
      px.set(rx(y) + 1, y, 'k');
    }
    px.line(x + 21, top, x + 21, top - 4, 'k');
    px.ellipse(x + 18, B - 30, 2, 3, 'w');
    px.set(x + 16, B - 30, 'k');
    px.ellipse(x + 25, B - 20, 2, 3, 'w');
    px.set(x + 27, B - 20, 'k');
    px.set(x + 21, top - 5, 'q');
  },
  sauna(px, x) {
    // A little log sauna with a chimney (steam drawn each frame) and a bucket.
    px.rect(x + 3, B - 12, 20, 12, (_i, j) => (j % 3 === 0 ? 'k' : j % 3 === 1 ? 'm' : 'd'));
    px.rect(x + 3, B - 12, 1, 12, 'k');
    px.rect(x + 22, B - 12, 1, 12, 'k');
    px.rect(x + 18, B - 21, 3, 6, 'd');
    px.rect(x + 18, B - 22, 3, 1, 'w');
    roof(px, x + 1, x + 25, B - 12, B - 19);
    px.rect(x + 6, B - 8, 4, 8, 'k');
    px.rect(x + 13, B - 9, 5, 3, 'r');
    px.rect(x + 24, B - 4, 4, 4, 'm');
    px.rect(x + 24, B - 4, 4, 1, 'k');
  },
  gondola(px, x) {
    // A station with a great bull wheel; its cable climbs to the mountain (car drawn each frame).
    px.rect(x + 2, B - 14, 22, 14, (i) => (i % 5 === 0 ? 'm' : 'l'));
    px.rect(x + 2, B - 14, 1, 14, 'k');
    px.rect(x + 23, B - 14, 1, 14, 'k');
    px.rect(x + 1, B - 16, 24, 2, 'd');
    px.rect(x + 1, B - 17, 24, 1, 'w');
    px.rect(x + 9, B - 9, 8, 9, 'k');
    px.disc(x + 13, B - 21, 5, 'k');
    px.disc(x + 13, B - 21, 3.5, 'd');
    px.line(x + 10, B - 21, x + 16, B - 21, 'm');
    px.line(x + 13, B - 24, x + 13, B - 18, 'm');
    px.set(x + 13, B - 21, 'w');
    px.line(x + 13, B - 26, x + 52, B - 66, 'k');
  },
  avalancheControl(px, x) {
    // A concrete bunker with a slit, a cannon aimed up the slope, and a warning sign.
    px.poly(
      [
        [x + 2, B],
        [x + 5, B - 10],
        [x + 22, B - 10],
        [x + 25, B],
      ],
      (i, j) => (i > x + 18 && bayer(i, j, 9) ? 'm' : 'l'),
    );
    px.line(x + 2, B, x + 5, B - 10, 'k');
    px.line(x + 5, B - 10, x + 22, B - 10, 'k');
    px.line(x + 22, B - 10, x + 25, B, 'k');
    px.rect(x + 5, B - 11, 17, 1, 'w');
    px.rect(x + 9, B - 7, 10, 1, 'k');
    px.line(x + 13, B - 11, x + 21, B - 21, 'k');
    px.line(x + 14, B - 11, x + 22, B - 21, 'k');
    px.disc(x + 13, B - 11, 2, 'd');
    px.rect(x + 27, B - 9, 1, 9, 'k');
    px.poly(
      [
        [x + 24, B - 9],
        [x + 27.5, B - 15],
        [x + 31, B - 9],
      ],
      'r',
    );
    px.rect(x + 27, B - 13, 1, 2, 'w');
  },
  spyHq(px, x) {
    // An innocent chalet with a red door, a satellite dish and an antenna.
    px.rect(x + 3, B - 14, 22, 14, 'w');
    for (const k of [3, 13, 24]) px.rect(x + k, B - 14, 1, 14, 'k');
    px.line(x + 3, B - 8, x + 13, B - 14, 'k');
    px.line(x + 14, B - 14, x + 24, B - 8, 'k');
    roof(px, x + 1, x + 27, B - 14, B - 22);
    px.rect(x + 15, B - 7, 4, 7, 'r');
    px.rect(x + 6, B - 6, 4, 3, 'm');
    px.ellipse(x + 20, B - 22, 3, 2, 'w');
    px.line(x + 17, B - 23, x + 22, B - 20, 'k');
    px.line(x + 20, B - 22, x + 22, B - 25, 'k');
    px.line(x + 8, B - 18, x + 8, B - 28, 'k');
    px.set(x + 8, B - 29, 'r');
  },
  rental(px, x) {
    // A shop with a striped awning, a window full of skis, and a rack outside.
    px.rect(x + 2, B - 13, 22, 13, 'w');
    px.rect(x + 2, B - 13, 1, 13, 'k');
    px.rect(x + 23, B - 13, 1, 13, 'k');
    px.rect(x + 1, B - 18, 24, 2, 'd');
    px.rect(x + 1, B - 19, 24, 1, 'w');
    px.rect(x + 1, B - 16, 24, 3, (i) => ((i - x) % 4 < 2 ? 'r' : 'w'));
    px.rect(x + 1, B - 13, 24, 1, 'k');
    px.rect(x + 4, B - 11, 10, 7, 'm');
    for (const k of [6, 9, 12]) px.line(x + k, B - 5, x + k + 1, B - 10, k === 9 ? 'r' : 'k');
    px.rect(x + 16, B - 9, 5, 9, 'k');
    for (let k = 0; k < 3; k++) {
      px.line(x + 26 + k * 2, B - 1, x + 26 + k * 2, B - 12, k === 1 ? 'r' : 'k');
    }
    px.rect(x + 25, B - 6, 6, 1, 'd');
  },
};

/** An empty plot: a stake and sign on the snow, with a dotted footprint. */
function plot(px: Px, x: number): void {
  for (let i = 1; i < PLOT_W - 2; i += 2) px.set(x + i, B - 1, 'l');
  px.rect(x + 13, B - 11, 1, 11, 'd');
  px.rect(x + 9, B - 16, 9, 6, 'w');
  px.rect(x + 9, B - 16, 9, 1, 'k');
  px.rect(x + 9, B - 11, 9, 1, 'k');
  px.rect(x + 9, B - 16, 1, 6, 'k');
  px.rect(x + 17, B - 16, 1, 6, 'k');
  px.rect(x + 13, B - 15, 1, 3, 'r');
  px.rect(x + 12, B - 14, 3, 1, 'r');
}

// --- The static picture ----------------------------------------------------------------------

function drawStatic(built: readonly BuildingId[]): HTMLCanvasElement {
  const px = new Px(SCENE_W, SCENE_H);
  sky(px, 0, 0, SCENE_W, 74, 's', 'w');
  cloud(px, 40, 14, 26, 1);
  cloud(px, 310, 10, 30, 2);
  cloud(px, 120, 24, 18, 3);
  range(px, 0, SCENE_W, 76, 34, 17);
  mountain(px, 60, 345, 98, 200, 6, { snow: 42, seed: 3, lean: 0.18 });
  mountain(px, -20, 150, 98, 70, 34, { snow: 18, seed: 8, lean: 0.25 });
  flag(px, 200, 6, 6);

  // A groomed piste down the mountain.
  for (let k = 0; k < PISTE.length - 1; k++) {
    const [ax, ay] = PISTE[k];
    const [bx, by] = PISTE[k + 1];
    px.line(ax, ay - 1, bx, by - 1, 'l');
    px.line(ax, ay, bx, by, 'w');
    px.line(ax, ay + 1, bx, by + 1, 'w');
    px.line(ax, ay + 2, bx, by + 2, 'l');
  }

  // The chairlift: towers, the cable and the top station.
  const along = (t: number) => [CABLE.x0 + (CABLE.x1 - CABLE.x0) * t, CABLE.y0 + (CABLE.y1 - CABLE.y0) * t];
  for (const t of [0.22, 0.48, 0.74]) {
    const [cx, cy] = along(t);
    px.rect(Math.round(cx), Math.round(cy), 1, 10, 'd');
    px.rect(Math.round(cx) - 2, Math.round(cy), 5, 1, 'k');
  }
  px.line(CABLE.x0, CABLE.y0, CABLE.x1, CABLE.y1, 'k');
  px.line(CABLE.x0, CABLE.y0 + 2, CABLE.x1, CABLE.y1 + 2, 'k');
  px.rect(CABLE.x1 - 2, CABLE.y1 - 3, 8, 6, 'd');
  px.rect(CABLE.x1 - 2, CABLE.y1 - 4, 8, 1, 'w');

  // Two rows of forest: a paler one behind, a darker one in front.
  for (let x = -4, k = 0; x < SCENE_W + 4; k++) {
    pine(px, x, 92 + Math.floor(noise(k, 4) * 3), 7 + Math.floor(noise(k, 5) * 5), { fill: 'm', shade: 'd', edge: 'd' });
    x += 5 + Math.floor(noise(k, 6) * 5);
  }
  for (let x = -2, k = 0; x < SCENE_W + 4; k++) {
    pine(px, x, 99 + Math.floor(noise(k, 7) * 3), 10 + Math.floor(noise(k, 8) * 8));
    x += 7 + Math.floor(noise(k, 9) * 8);
  }
  snowField(px, 0, 98, SCENE_W, SCENE_H - 98, 5);
  for (let x = 0; x < SCENE_W; x += 3) px.set(x, B + 4 + Math.round(Math.sin(x * 0.07) * 1.5), 's');

  drawLodge(px);
  for (const id of Object.keys(PLOTS) as BuildingId[]) {
    if (built.includes(id)) BUILDINGS[id](px, PLOTS[id].x);
    else plot(px, PLOTS[id].x);
  }
  return px.canvas();
}

function drawLodge(px: Px): void {
  // Walls of dark timber over a porch, under a great snowy A-frame roof.
  px.rect(136, B - 24, 56, 22, (i, j) => (j % 3 === 0 || i % 7 === 0 ? 'd' : 'm'));
  px.rect(136, B - 24, 1, 22, 'k');
  px.rect(191, B - 24, 1, 22, 'k');
  px.rect(130, B - 3, 68, 3, 'd');
  px.rect(130, B - 3, 68, 1, 'k');
  for (let x = 131; x < 198; x += 6) px.rect(x, B - 6, 1, 4, 'k');
  px.rect(130, B - 6, 68, 1, 'k');
  for (const wx of [140, 180]) {
    px.rect(wx, B - 19, 8, 8, 'r');
    px.rect(wx, B - 13, 8, 2, 'q');
    px.rect(wx - 1, B - 20, 10, 1, 'k');
    px.rect(wx - 1, B - 11, 10, 1, 'k');
    px.rect(wx + 3, B - 19, 2, 8, 'k');
  }
  px.rect(160, B - 14, 8, 11, 'k');
  px.set(166, B - 9, 'm');
  // The chimney sits on the right slope; the roof covers its foot.
  px.rect(181, B - 46, 6, 14, 'm');
  px.rect(181, B - 46, 1, 14, 'k');
  px.rect(186, B - 46, 1, 14, 'k');
  px.rect(180, B - 47, 8, 1, 'w');
  roof(px, 126, 202, B - 23, B - 56);
  px.poly(
    [
      [154, B - 31],
      [164, B - 44],
      [174, B - 31],
    ],
    'r',
  );
  px.rect(163, B - 42, 2, 11, 'k');
  px.rect(154, B - 31, 21, 1, 'k');
  // The sign over the door.
  px.rect(153, B - 22, 23, 8, 'w');
  px.rect(153, B - 22, 23, 1, 'k');
  px.rect(153, B - 15, 23, 1, 'k');
  px.rect(153, B - 22, 1, 8, 'k');
  px.rect(175, B - 22, 1, 8, 'k');
  text(px, 'LODGE', 155, B - 20);
  // Skis racked on the porch.
  for (let k = 0; k < 3; k++) px.line(131 + k * 2, B - 3, 131 + k * 2, B - 15, k === 1 ? 'r' : 'k');
}

// --- The live scene --------------------------------------------------------------------------

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
}

export class LodgeScene {
  private built: BuildingId[] = [];
  private base: HTMLCanvasElement | null = null;
  private readonly art: HTMLCanvasElement;
  private readonly actx: CanvasRenderingContext2D;
  private readonly ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private time = 0;
  private puffs: Puff[] = [];
  /** The building under the mouse, highlighted in the scene. */
  hover: BuildingId | null = null;
  scale = 1;
  private dpr = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.art = document.createElement('canvas');
    this.art.width = SCENE_W;
    this.art.height = SCENE_H;
    this.actx = this.art.getContext('2d')!;
  }

  setBuilt(built: readonly BuildingId[]): void {
    const key = [...built].sort().join(',');
    if (this.base && key === [...this.built].sort().join(',')) return;
    this.built = [...built];
    this.base = drawStatic(built);
  }

  /** A burst of snow over a building that just went up. */
  celebrate(id: BuildingId): void {
    const p = PLOTS[id];
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      this.puffs.push({ x: p.x + 14, y: B - 10, vx: Math.cos(a) * (10 + (k % 5) * 6), vy: Math.sin(a) * 14 - 18, life: 1 });
    }
  }

  /** Fits the canvas to its container at a whole-number scale. */
  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const avail = (this.canvas.parentElement?.clientWidth ?? SCENE_W) * this.dpr;
    this.scale = Math.max(1, Math.floor(avail / SCENE_W));
    this.canvas.width = SCENE_W * this.scale;
    this.canvas.height = SCENE_H * this.scale;
    this.canvas.style.width = `${(SCENE_W * this.scale) / this.dpr}px`;
    this.canvas.style.height = `${(SCENE_H * this.scale) / this.dpr}px`;
  }

  /** The building (or empty plot) under a point in CSS pixels. */
  plotAt(cssX: number, cssY: number): BuildingId | null {
    const x = (cssX * this.dpr) / this.scale;
    const y = (cssY * this.dpr) / this.scale;
    for (const [id, p] of Object.entries(PLOTS) as [BuildingId, (typeof PLOTS)[BuildingId]][]) {
      if (x >= p.x && x < p.x + PLOT_W + 2 && y >= p.top && y <= B + 1) return id;
    }
    return null;
  }

  start(): void {
    if (this.raf) return;
    this.resize();
    this.last = performance.now();
    const tick = (now: number) => {
      // rAF timestamps can trail performance.now() on the first frame; never step backwards.
      this.time += Math.min(0.1, Math.max(0, (now - this.last) / 1000));
      this.last = now;
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private draw(): void {
    if (!this.base) return;
    const g = this.actx;
    const t = this.time;
    g.drawImage(this.base, 0, 0);
    const dot = (x: number, y: number, c: string, w = 1, h = 1) => {
      g.fillStyle = PIXELS[c] ?? c;
      g.fillRect(Math.round(x), Math.round(y), w, h);
    };
    const disc = (cx: number, cy: number, r: number, c: string) => {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        const half = Math.sqrt(Math.max(0, r * r - (y + 0.5 - cy) ** 2));
        if (half >= 0.5) dot(cx - half, y, c, Math.round(half * 2), 1);
      }
    };

    // Smoke from the lodge chimney, steam from the sauna.
    const plume = (x: number, y: number, n: number, rise: number, c1: string, c2: string) => {
      for (let k = 0; k < n; k++) {
        const ph = (t * 0.35 + k / n) % 1;
        disc(x + ph * 14 + Math.sin(t * 2 + k) * 1.5, y - ph * rise, 1 + ph * 3, k % 2 ? c1 : c2);
      }
    };
    plume(184, B - 48, 6, 30, 's', 'l');
    if (this.built.includes('sauna')) plume(PLOTS.sauna.x + 19, B - 23, 4, 18, 'w', 's');

    // Chairs going up one cable and down the other.
    for (let k = 0; k < 6; k++) {
      const up = (t * 0.05 + k / 6) % 1;
      const down = 1 - ((t * 0.05 + k / 6 + 0.08) % 1);
      for (const [f, off] of [
        [up, 0],
        [down, 2],
      ] as const) {
        const x = CABLE.x0 + (CABLE.x1 - CABLE.x0) * f;
        const y = CABLE.y0 + (CABLE.y1 - CABLE.y0) * f + off;
        dot(x, y + 1, 'k', 1, 2);
        dot(x - 1, y + 3, 'k', 3, 1);
        if (off === 0 && k % 2 === 0) dot(x, y + 2, 'r');
      }
    }

    // The gondola car, shuttling along its cable.
    if (this.built.includes('gondola')) {
      const gx = PLOTS.gondola.x;
      const f = (Math.sin(t * 0.4) + 1) / 2;
      const x = gx + 13 + 39 * f;
      const y = B - 26 - 40 * f;
      dot(x, y, 'k', 1, 2);
      dot(x - 2, y + 2, 'r', 5, 4);
      dot(x - 1, y + 3, 'w', 3, 1);
    }

    // The radio mast's light.
    if (this.built.includes('radio') && Math.floor(t * 1.5) % 2 === 0) {
      const x = PLOTS.radio.x + 21;
      dot(x, B - 51, 'r');
      dot(x - 1, B - 51, 'q');
      dot(x + 1, B - 51, 'q');
      dot(x, B - 52, 'q');
    }

    // A skier coming down the piste now and then.
    const lap = (t / 14) % 1;
    if (lap < 0.6) {
      const f = (lap / 0.6) * (PISTE.length - 1);
      const k = Math.min(PISTE.length - 2, Math.floor(f));
      const u = f - k;
      const x = PISTE[k][0] + (PISTE[k + 1][0] - PISTE[k][0]) * u;
      const y = PISTE[k][1] + (PISTE[k + 1][1] - PISTE[k][1]) * u;
      dot(x, y - 2, 'r', 1, 2);
      dot(x - 1, y, 'k', 3, 1);
    }

    // Snow building celebrations.
    this.puffs = this.puffs.filter((p) => (p.life -= 0.016) > 0);
    for (const p of this.puffs) {
      p.x += p.vx * 0.016;
      p.y += p.vy * 0.016;
      p.vy += 40 * 0.016;
      dot(p.x, p.y, p.life > 0.5 ? 'w' : 's', 2, 2);
    }

    // The building under the mouse gets a dotted red frame.
    if (this.hover) {
      const p = PLOTS[this.hover];
      for (let x = p.x; x < p.x + PLOT_W + 2; x += 2) {
        dot(x, p.top - 2, 'r');
        dot(x, B + 2, 'r');
      }
      for (let y = p.top - 2; y <= B + 2; y += 2) {
        dot(p.x, y, 'r');
        dot(p.x + PLOT_W + 1, y, 'r');
      }
    }

    // Falling snow over everything.
    for (let k = 0; k < 90; k++) {
      const speed = 6 + (k % 5) * 3;
      const y = (k * 37 + t * speed) % (SCENE_H + 4);
      const x = (k * 53 + Math.sin(t * 0.8 + k) * 3 + t * 2) % SCENE_W;
      dot(x, y, k % 7 === 0 ? 's' : 'w', k % 11 === 0 ? 2 : 1, k % 11 === 0 ? 2 : 1);
    }

    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.art, 0, 0, this.canvas.width, this.canvas.height);
  }
}

/** A still of the scene, for the gallery. */
export function sceneStill(built: readonly BuildingId[]): HTMLCanvasElement {
  return drawStatic(built);
}

const ICON_W = 34;
const ICON_H = 40;

/** A building on its own patch of snow (or its empty plot), for the building cards. */
export function buildingIcon(id: BuildingId, built: boolean, scale: number): string {
  const px = new Px(SCENE_W, SCENE_H);
  const p = PLOTS[id];
  snowField(px, p.x - 2, B - 2, ICON_W + 2, 6, 3);
  if (built) BUILDINGS[id](px, p.x);
  else plot(px, p.x);
  const c = document.createElement('canvas');
  c.width = ICON_W * scale;
  c.height = ICON_H * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(px.canvas(), p.x - 2, B + 3 - ICON_H, ICON_W, ICON_H, 0, 0, c.width, c.height);
  return c.toDataURL();
}
