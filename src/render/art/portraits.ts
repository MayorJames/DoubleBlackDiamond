// Detailed 40x40 portraits, like photos clipped into a dossier: the bosses for their arrival,
// and you for the side panel. Drawn with the pixel toolkit, shaded with ordered dithering.

import type { EnemyKind } from '../../game/enemies';
import { bayer, noise, Px } from './pixel';

export const PORTRAIT_SIZE = 40;
export type PortraitId = 'hero' | 'baron' | 'widow' | 'yetiKing' | 'kickback';

const N = PORTRAIT_SIZE;

/** A lit face: paper on the left, shade on the right, a dithered jaw shadow. */
function face(px: Px, cx: number, cy: number, rx: number, ry: number): void {
  px.ellipse(cx, cy, rx, ry, (x, y) => {
    if (x > cx + rx * 0.35) return bayer(x, y, 10) ? 'l' : 's';
    if (y > cy + ry * 0.55) return bayer(x, y, 6) ? 's' : 'w';
    return 'w';
  });
}

function shoulders(px: Px, fill: (x: number, y: number) => string | null): void {
  px.poly(
    [
      [1, N],
      [6, 32],
      [34, 32],
      [39, N],
    ],
    fill,
  );
}

const DRAW: Record<PortraitId, (px: Px) => void> = {
  hero(px) {
    px.vgrad(0, 0, N, N, 's', 'w');
    shoulders(px, (x, y) => (x > 26 && bayer(x, y, 8) ? 'q' : 'r'));
    px.rect(18, 32, 4, 8, 'k');
    px.rect(19, 33, 2, 7, 'm');
    px.rect(14, 30, 12, 3, 'k');
    face(px, 20, 22, 8, 9);
    // The red beanie, its folded band and pompom, with goggles pushed up on it.
    px.ellipse(20, 13, 10, 7, (x, y) => (x > 24 && bayer(x, y, 8) ? 'q' : 'r'));
    px.rect(10, 13, 20, 4, (x) => (x % 2 ? 'q' : 'r'));
    px.disc(20, 5, 3, (x, y) => (bayer(x, y, 5) ? 'q' : 'r'));
    px.rect(10, 15, 20, 1, 'k');
    px.disc(15, 15, 2.6, 'k');
    px.disc(25, 15, 2.6, 'k');
    px.disc(15, 15, 1.6, 'm');
    px.disc(25, 15, 1.6, 'm');
    px.set(14, 14, 'w');
    px.set(24, 14, 'w');
    // A determined look and a small smirk.
    px.rect(15, 20, 3, 1, 'k');
    px.rect(22, 20, 3, 1, 'k');
    px.rect(16, 22, 2, 2, 'k');
    px.rect(22, 22, 2, 2, 'k');
    px.line(20, 23, 19, 26, 'l');
    px.line(17, 28, 22, 27, 'd');
  },
  baron(px) {
    px.vgrad(0, 0, N, N, 'l', 's');
    // A greatcoat with a fur collar and a red medal.
    shoulders(px, (x, y) => (bayer(x, y, x > 26 ? 12 : 3) ? 'd' : 'k'));
    px.ellipse(20, 33, 13, 4, (x, y) => (noise(x * 7 + y, 3) < 0.3 ? 'l' : 'm'));
    px.rect(27, 35, 3, 2, 'q');
    px.disc(28.5, 38, 1.6, 'r');
    face(px, 20, 23, 8, 9);
    // A towering fur hat with ear flaps and a red star.
    const fur = (x: number, y: number) => (noise(x * 13 + y * 5, 1) < 0.25 ? 'l' : noise(x + y * 31, 2) < 0.2 ? 'd' : 'm');
    px.ellipse(20, 10, 13, 8, fur);
    px.rect(8, 12, 5, 13, fur);
    px.rect(27, 12, 5, 13, fur);
    px.rect(9, 14, 22, 2, 'd');
    px.poly(
      [
        [20, 4],
        [21.5, 8],
        [18.5, 8],
      ],
      'r',
    );
    px.rect(18, 7, 5, 2, 'r');
    // Heavy brows, one eye, and a monocle on a chain.
    px.rect(14, 19, 5, 2, 'k');
    px.rect(21, 19, 6, 1, 'k');
    px.rect(15, 22, 2, 1, 'k');
    px.disc(24, 22, 3.2, 'k');
    px.disc(24, 22, 2.2, 's');
    px.rect(23, 22, 2, 1, 'k');
    px.set(23, 21, 'w');
    px.line(26, 25, 28, 30, 'm');
    px.line(28, 30, 27, 33, 'm');
    px.line(20, 23, 19, 27, 'l');
    // A grand curled moustache.
    px.rect(14, 28, 13, 2, 'k');
    px.rect(16, 27, 9, 1, 'k');
    px.set(13, 27, 'k');
    px.set(12, 26, 'k');
    px.set(27, 27, 'k');
    px.set(28, 26, 'k');
    px.rect(17, 31, 6, 1, 'l');
  },
  widow(px) {
    px.vgrad(0, 0, N, N, 's', 'l');
    // The red glint of a scope, far off.
    px.rect(33, 6, 1, 5, 'r');
    px.rect(31, 8, 5, 1, 'r');
    px.set(33, 8, 'w');
    // A black dress under a white fur stole.
    shoulders(px, (x, y) => (bayer(x, y, 2) ? 'd' : 'k'));
    for (let k = 0; k < 7; k++) px.disc(8 + k * 4, 33 + (k % 2), 3.2, (x, y) => (y > 34 && bayer(x, y, 7) ? 's' : 'w'));
    // A sleek black bob.
    px.ellipse(20, 18, 12, 13, (x, y) => (x > 13 && x < 17 && y < 16 && bayer(x, y, 8) ? 'd' : 'k'));
    face(px, 20, 22, 7, 8);
    px.rect(8, 16, 5, 15, 'k');
    px.rect(27, 16, 5, 15, 'k');
    px.rect(12, 13, 16, 4, 'k');
    // Arched brows, half-lidded eyes, red lips, icicle earrings.
    px.line(14, 18, 17, 17, 'k');
    px.line(23, 17, 26, 18, 'k');
    px.rect(15, 20, 3, 1, 'k');
    px.rect(22, 20, 3, 1, 'k');
    px.set(16, 21, 'm');
    px.set(23, 21, 'm');
    px.line(20, 22, 20, 24, 'l');
    px.rect(18, 26, 5, 1, 'r');
    px.rect(19, 27, 3, 1, 'q');
    for (const x of [12, 28]) {
      px.rect(x, 27, 1, 3, 'w');
      px.set(x, 30, 's');
    }
  },
  yetiKing(px) {
    px.vgrad(0, 0, N, N, 'm', 'l');
    // A great shaggy head and shoulders of white fur.
    const fur = (x: number, y: number) => (noise(x * 17 + y * 3, 4) < 0.18 ? 'l' : noise(x * 5 + y * 23, 5) < 0.3 ? 's' : 'w');
    px.ellipse(20, 34, 19, 9, fur);
    px.ellipse(20, 21, 14, 14, fur);
    for (let k = 0; k < 9; k++) px.set(7 + k * 3, 34 + (k % 2), 'l');
    // A dark face with a heavy brow, glowing red eyes and fangs.
    px.ellipse(20, 23, 8, 7, (x, y) => (x > 23 && bayer(x, y, 8) ? 'd' : 'm'));
    px.rect(13, 19, 14, 2, 'd');
    px.rect(15, 21, 3, 2, 'r');
    px.rect(22, 21, 3, 2, 'r');
    px.set(16, 21, 'w');
    px.set(23, 21, 'w');
    px.rect(18, 24, 4, 1, 'd');
    px.rect(15, 26, 10, 3, 'k');
    px.rect(16, 26, 1, 3, 'w');
    px.rect(23, 26, 1, 3, 'w');
    px.rect(18, 28, 4, 1, 'q');
    // A red crown set with gems.
    px.rect(11, 7, 18, 4, 'r');
    for (let k = 0; k < 5; k++) px.poly([[11 + k * 4, 7], [13 + k * 4, 2], [15 + k * 4, 7]], 'r');
    px.rect(11, 10, 18, 1, 'q');
    for (const x of [14, 20, 26]) px.rect(x - 1, 8, 2, 2, x === 20 ? 'w' : 'q');
  },
  kickback(px) {
    px.vgrad(0, 0, N, N, 's', 'l');
    // A flight jacket, and a long red scarf streaming out behind.
    shoulders(px, (x, y) => (bayer(x, y, x > 26 ? 10 : 4) ? 'm' : 'd'));
    px.poly(
      [
        [12, 30],
        [28, 30],
        [39, 24],
        [39, 29],
        [28, 35],
        [12, 35],
      ],
      (x, y) => (bayer(x, y, 5) ? 'q' : 'r'),
    );
    face(px, 20, 22, 8, 9);
    px.rect(13, 25, 14, 6, (x, y) => (x > 13 && x < 27 && bayer(x, y, 3) ? 'l' : null));
    // A white helmet with a red stripe, and goggles pushed up on it.
    px.ellipse(20, 13, 11, 8, (x, y) => (x > 25 && bayer(x, y, 9) ? 's' : 'w'));
    px.rect(18, 5, 4, 10, 'r');
    px.rect(9, 15, 22, 2, 'k');
    px.disc(15, 13, 3.4, 'k');
    px.disc(25, 13, 3.4, 'k');
    px.disc(15, 13, 2.3, 'm');
    px.disc(25, 13, 2.3, 'm');
    px.set(14, 12, 'w');
    px.set(24, 12, 'w');
    // Cocky brows, and a grin full of teeth.
    px.line(14, 19, 18, 18, 'k');
    px.line(22, 18, 26, 19, 'k');
    px.rect(16, 21, 2, 2, 'k');
    px.rect(23, 21, 2, 2, 'k');
    px.line(20, 22, 19, 25, 'l');
    px.rect(15, 27, 10, 3, 'k');
    px.rect(16, 27, 8, 2, 'w');
    for (const x of [18, 20, 22]) px.set(x, 28, 'l');
  },
};

const cache = new Map<string, string>();

/** A portrait as a crisp image URL at the given scale. */
export function portraitUrl(id: PortraitId, scale: number): string {
  const key = `${id}@${scale}`;
  let url = cache.get(key);
  if (!url) {
    url = portraitPx(id).url(scale);
    cache.set(key, url);
  }
  return url;
}

export function portraitPx(id: PortraitId): Px {
  const px = new Px(N, N);
  DRAW[id](px);
  return px;
}

/** The portrait for an enemy kind, if it has one. */
export const portraitFor = (kind: EnemyKind): PortraitId | null =>
  kind === 'baron' || kind === 'widow' || kind === 'yetiKing' || kind === 'kickback' ? kind : null;
