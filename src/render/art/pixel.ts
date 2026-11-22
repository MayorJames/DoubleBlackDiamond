// A small pixel-art toolkit for the detailed illustrations (cards, the lodge, portraits). The
// map stays chunky 16px tiles; these pieces get the care. Everything draws into a buffer at art
// resolution in ink, greys and red, with ordered dithering for gradients and shading, and is
// turned into a canvas (or an image URL) once.
//
// Colours are palette letters (k ink, d dark, m mid, l light, s shade, w paper, r red, q deep
// red) or hex strings.

import { PIXELS, SPRITES, type SpriteName } from '../sprites';

export type Col = string;

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** True where an ordered-dither pattern at `level` (0 to 16) picks the second colour. */
export const bayer = (x: number, y: number, level: number): boolean => BAYER[y & 3][x & 3] < level;

const packed = new Map<string, number>();
function pack(c: Col): number {
  let v = packed.get(c);
  if (v === undefined) {
    const hex = PIXELS[c] ?? c;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    v = ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
    packed.set(c, v);
  }
  return v;
}

/** A cheap deterministic hash in [0, 1), for jagged ridges and scattered detail. */
export function noise(x: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(seed | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export type Fill = Col | ((x: number, y: number) => Col | null);

export class Px {
  private readonly buf: Uint32Array;

  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.buf = new Uint32Array(w * h);
  }

  set(x: number, y: number, c: Col | null): void {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.buf[y * this.w + x] = c === null ? 0 : pack(c);
  }

  opaque(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.buf[y * this.w + x] !== 0;
  }

  /** Whether the pixel at (x, y) is exactly colour c. */
  is(x: number, y: number, c: Col): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h && this.buf[y * this.w + x] === pack(c);
  }

  private paint(x: number, y: number, f: Fill): void {
    const c = typeof f === 'string' ? f : f(x, y);
    if (c !== null) this.set(x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, f: Fill): void {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.paint(i, j, f);
  }

  /** A rectangle mixing a and b in an ordered dither: level 0 is all a, 16 all b. */
  dither(x: number, y: number, w: number, h: number, a: Col, b: Col, level: number): void {
    this.rect(x, y, w, h, (i, j) => (bayer(i, j, level) ? b : a));
  }

  /** A vertical dithered gradient from `top` to `bottom`. */
  vgrad(x: number, y: number, w: number, h: number, top: Col, bottom: Col): void {
    for (let j = 0; j < h; j++) {
      const level = Math.round((16 * j) / Math.max(1, h - 1));
      for (let i = x; i < x + w; i++) this.set(i, y + j, bayer(i, y + j, level) ? bottom : top);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Col): void {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const tx = Math.round(x1);
    const ty = Math.round(y1);
    const dx = Math.abs(tx - x);
    const dy = -Math.abs(ty - y);
    const sx = x < tx ? 1 : -1;
    const sy = y < ty ? 1 : -1;
    let err = dx + dy;
    for (let n = 0; n < 2000; n++) {
      this.set(x, y, c);
      if (x === tx && y === ty) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
  }

  /** Fills a polygon (pixel centres inside, even-odd rule). */
  poly(pts: readonly (readonly [number, number])[], f: Fill): void {
    const ys = pts.map((p) => p[1]);
    const y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const y1 = Math.min(this.h - 1, Math.ceil(Math.max(...ys)));
    for (let y = y0; y <= y1; y++) {
      const cy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i];
        const [bx, by] = pts[(i + 1) % pts.length];
        if (ay <= cy !== by <= cy) xs.push(ax + ((cy - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.paint(x, y, f);
      }
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, f: Fill): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x + 0.5 - cx) / rx;
        const dy = (y + 0.5 - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.paint(x, y, f);
      }
  }

  disc(cx: number, cy: number, r: number, f: Fill): void {
    this.ellipse(cx, cy, r, r, f);
  }

  /** Stamps a hand-authored sprite. */
  sprite(name: SpriteName, x: number, y: number, opts: { flip?: boolean; recolor?: Record<string, string> } = {}): void {
    const rows = SPRITES[name];
    const w = rows[0].length;
    rows.forEach((row, j) => {
      for (let i = 0; i < w; i++) {
        let ch = row[opts.flip ? w - 1 - i : i];
        if (ch === '.') continue;
        if (opts.recolor?.[ch]) ch = opts.recolor[ch];
        this.set(x + i, y + j, ch);
      }
    });
  }

  /** Stamps a grid of palette letters ('.' transparent), like a sprite defined inline. */
  grid(rows: readonly string[], x: number, y: number): void {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) if (row[i] !== '.') this.set(x + i, y + j, row[i]);
    });
  }

  /** Draws a one-pixel outline in `c` around everything opaque. */
  outline(c: Col): void {
    const mark: number[] = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.opaque(x, y)) continue;
        if (this.opaque(x - 1, y) || this.opaque(x + 1, y) || this.opaque(x, y - 1) || this.opaque(x, y + 1)) mark.push(y * this.w + x);
      }
    const v = pack(c);
    for (const i of mark) this.buf[i] = v;
  }

  /** Copies another drawing on top of this one. */
  blit(src: Px, x: number, y: number): void {
    for (let j = 0; j < src.h; j++)
      for (let i = 0; i < src.w; i++) {
        const v = src.buf[j * src.w + i];
        const tx = x + i;
        const ty = y + j;
        if (v && tx >= 0 && ty >= 0 && tx < this.w && ty < this.h) this.buf[ty * this.w + tx] = v;
      }
  }

  canvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.buf);
    ctx.putImageData(img, 0, 0);
    return c;
  }

  /** A crisp image URL scaled up by a whole number. */
  url(scale: number): string {
    return scaled(this.canvas(), scale).toDataURL();
  }
}

/** A canvas scaled up by a whole number with no smoothing. */
export function scaled(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width * scale;
  c.height = src.height * scale;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c;
}
