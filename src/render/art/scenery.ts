// Scenery pieces shared by the illustrations: skies, mountains, pines, snowfields, clouds, smoke.
// All take a Px and draw in place; sizes are in art pixels.

import { bayer, noise, type Col, type Px } from './pixel';

/** A sky: a dithered gradient from `top` down to `bottom` at the horizon. */
export function sky(px: Px, x: number, y: number, w: number, h: number, top: Col = 's', bottom: Col = 'w'): void {
  px.vgrad(x, y, w, h, top, bottom);
}

export interface MountainStyle {
  /** Lit snow, shaded snow, lit rock, shaded rock. */
  tones?: [Col, Col, Col, Col];
  /** How far down from the peak the snow reaches, in pixels. */
  snow?: number;
  seed?: number;
  /** Colour of the two slope edges, or null for none. */
  edge?: Col | null;
  /** How far the dividing ridge leans right per pixel down. */
  lean?: number;
  /** Dark gullies down the rock (off for distant, quieter ranges). */
  gullies?: boolean;
}

/** A mountain with a lit left face, a shaded right face, jagged snow and rocky gullies. */
export function mountain(px: Px, x0: number, x1: number, base: number, peakX: number, peakY: number, o: MountainStyle = {}): void {
  const [snowLit, snowShade, rockLit, rockShade] = o.tones ?? ['w', 's', 'm', 'd'];
  const snowDepth = o.snow ?? (base - peakY) * 0.45;
  const seed = o.seed ?? 1;
  const lean = o.lean ?? 0.22;
  px.poly(
    [
      [x0, base],
      [peakX, peakY],
      [x1, base],
    ],
    (x, y) => {
      const depth = y - peakY;
      const ridge = peakX + depth * lean + (noise(y, seed + 7) - 0.5) * 2;
      const lit = x < ridge - 1 || (x < ridge + 1 && bayer(x, y, 8));
      const jag = (noise(x, seed) - 0.5) * 4 + Math.sin(x * 0.6 + seed) * 1.5;
      const edge = snowDepth + jag - depth;
      const snowy = edge > 1 || (edge > -1 && bayer(x, y, 8));
      if (snowy) return lit ? snowLit : snowShade;
      const gully = o.gullies !== false && noise(x * 13 + Math.floor(y / 3), seed + 3) < 0.12;
      if (lit) return gully ? rockShade : rockLit;
      return gully ? 'k' : rockShade;
    },
  );
  if (o.edge !== null) {
    const e = o.edge ?? 'k';
    px.line(x0, base, peakX, peakY, e);
    px.line(peakX, peakY, x1, base, e);
  }
}

/** A distant range: a row of overlapping peaks along `base`. */
export function range(px: Px, x0: number, x1: number, base: number, height: number, seed: number, o: MountainStyle = {}): void {
  let x = x0 - 6;
  let k = 0;
  while (x < x1 + 6) {
    const w = 10 + Math.floor(noise(k, seed) * 14);
    const h = height * (0.55 + noise(k, seed + 1) * 0.45);
    mountain(px, x - w * 0.2, x + w * 1.2, base, x + w / 2, base - h, { snow: h * 0.5, seed: seed + k, edge: null, gullies: false, tones: ['w', 's', 's', 'l'], ...o });
    x += w;
    k++;
  }
}

export interface PineStyle {
  snow?: boolean;
  fill?: Col;
  shade?: Col;
  edge?: Col;
}

/**
 * A pine tree standing on (cx, baseY): stacked tiers that widen downwards, each with an ink
 * outline, a lit left half, a shaded right half and snow along its top.
 */
export function pine(px: Px, cx: number, baseY: number, h: number, o: PineStyle = {}): void {
  const fill = o.fill ?? 'd';
  const shade = o.shade ?? 'k';
  const edge = o.edge ?? 'k';
  const snow = o.snow ?? true;
  const tiers = h >= 18 ? 4 : h >= 10 ? 3 : 2;
  const trunk = h >= 14 ? 2 : 1;
  const body = h - trunk;
  const W = Math.max(2, Math.round(h * 0.34));
  const step = body / (tiers + 0.6);
  px.rect(cx - (h >= 16 ? 1 : 0), baseY - trunk, h >= 16 ? 2 : 1, trunk, 'k');
  for (let t = 0; t < tiers; t++) {
    const top = Math.round(baseY - trunk - body + t * step);
    const th = Math.round(step * 1.6);
    const minHw = Math.round((t * W) / (tiers + 1));
    const maxHw = Math.round(((t + 1.6) * W) / (tiers + 0.6));
    for (let r = 0; r < th && top + r < baseY - trunk; r++) {
      const hw = Math.round(minHw + ((maxHw - minHw) * r) / Math.max(1, th - 1));
      for (let x = cx - hw; x <= cx + hw; x++) {
        let c: Col = x <= cx ? fill : shade;
        if (snow && r === 0 && x < cx + hw) c = 'w';
        if (snow && r === 1 && x < cx && x > cx - hw) c = 'w';
        if (snow && r === 1 && x >= cx && x < cx + hw) c = 's';
        if (x === cx - hw || x === cx + hw || (r === th - 1 && t === tiers - 1)) c = edge;
        px.set(x, top + r, c);
      }
    }
  }
  px.set(cx, baseY - trunk - body - 1, edge);
}

/** Open snow with faint speckle and a dithered shadow band at the bottom. */
export function snowField(px: Px, x: number, y: number, w: number, h: number, seed = 0): void {
  px.rect(x, y, w, h, (i, j) => (noise(i * 31 + j * 17, seed) < 0.05 ? 's' : 'w'));
  const band = Math.min(4, Math.floor(h / 3));
  for (let j = 0; j < band; j++) for (let i = x; i < x + w; i++) if (bayer(i, y + h - band + j, 3 + j * 3)) px.set(i, y + h - band + j, 's');
}

/** A soft cloud: overlapping discs, lit on top and dithered underneath. */
export function cloud(px: Px, cx: number, cy: number, w: number, seed = 0): void {
  const n = Math.max(2, Math.round(w / 5));
  for (let k = 0; k < n; k++) {
    const r = 2 + noise(k, seed) * (w / 5);
    const x = cx - w / 2 + (k + 0.5) * (w / n);
    px.disc(x, cy - r * 0.3, r, (i, j) => (j > cy && bayer(i, j, 6) ? 's' : 'w'));
  }
}

/** A curl of smoke rising from (x, y): shrinking puffs, drifting right. */
export function smoke(px: Px, x: number, y: number, puffs = 3, seed = 0): void {
  for (let k = 0; k < puffs; k++) {
    const r = 1.2 + k * 0.7;
    px.disc(x + k * 1.6 + noise(k, seed) * 1.5, y - k * 3 - 1, r, (i, j) => (bayer(i, j, 5 + k * 3) ? 'l' : 's'));
  }
}

/** Scattered snowflakes over a region. */
export function flakes(px: Px, x: number, y: number, w: number, h: number, count: number, seed = 0, c: Col = 'w'): void {
  for (let k = 0; k < count; k++) px.set(x + noise(k, seed) * w, y + noise(k, seed + 9) * h, c);
}

/** A little red flag on a pole, planted at (x, y). */
export function flag(px: Px, x: number, y: number, h = 6): void {
  px.line(x, y, x, y - h, 'k');
  px.rect(x + 1, y - h, 3, 1, 'r');
  px.rect(x + 1, y - h + 1, 2, 1, 'r');
  px.set(x + 1, y - h + 2, 'r');
}

/** A small black diamond (the expert sign), centred on cx with its top at y. */
export function blackDiamond(px: Px, cx: number, y: number, r = 3): void {
  for (let k = 0; k <= r; k++) px.rect(cx - k, y + k, k * 2 + 1, 1, 'k');
  for (let k = r - 1; k >= 0; k--) px.rect(cx - k, y + r * 2 - k, k * 2 + 1, 1, 'k');
}
