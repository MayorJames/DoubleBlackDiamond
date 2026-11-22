// A 32x32 illustration for every card: a little scene in ink, greys and red, drawn once and
// cached. Cards show it at 2x, the card tooltip at 3x, the lodge deck at 1x.

import type { CardId } from '../../game/cards';
import { bayer, Px } from './pixel';
import { blackDiamond, cloud, flag, flakes, mountain, pine, range, sky, smoke, snowField } from './scenery';


const S = 32;

/** Sky, a far range and snow: the backdrop most cards share. */
function backdrop(px: Px, horizon: number, seed: number): void {
  sky(px, 0, 0, S, horizon, 's', 'w');
  range(px, 0, S, horizon, horizon * 0.55, seed, { tones: ['w', 's', 'l', 'm'] });
  snowField(px, 0, horizon, S, S - horizon, seed);
}

/** A groomed trail band across the snow, with corduroy lines. */
function trailBand(px: Px, y: number, h: number): void {
  px.rect(0, y, S, h, (x, j) => ((j - y) % 2 === 0 && x % 5 !== 0 ? 's' : 'w'));
  px.rect(0, y - 1, S, 1, 'l');
  px.rect(0, y + h, S, 1, 'l');
}

/** A tiny skier in the red jacket, 7x8, facing right. */
const SKIER = ['..rr...', '.kkkk..', '.kwwk..', '..rrr..', '.rrqrk.', '..qq...', '..k.k..', 'kkkkkkk'];

/** A dossier: a manila folder with a clipped photo of the boss and a red stamp. */
function dossier(px: Px, photo: (px: Px, x: number, y: number) => void): void {
  px.rect(0, 0, S, S, (x, y) => (bayer(x, y, 4) ? 'd' : 'k'));
  px.rect(3, 5, 12, 3, 'm');
  px.rect(3, 7, 27, 22, (x, y) => (bayer(x, y, 2) ? 'm' : 'l'));
  px.rect(3, 7, 27, 1, 'w');
  px.rect(3, 28, 27, 1, 'd');
  // The photo, with a paper clip.
  px.rect(6, 9, 14, 16, 's');
  px.rect(6, 9, 14, 1, 'k');
  px.rect(6, 24, 14, 1, 'k');
  px.rect(6, 9, 1, 16, 'k');
  px.rect(19, 9, 1, 16, 'k');
  photo(px, 7, 10);
  px.rect(9, 7, 2, 5, 'm');
  px.rect(9, 7, 2, 1, 'k');
  // Typed lines and the stamp.
  for (const y of [12, 15, 18]) px.rect(22, y, 6, 1, 'd');
  px.rect(21, 21, 8, 5, 'r');
  px.rect(22, 22, 6, 3, 'l');
  px.rect(23, 23, 4, 1, 'r');
}

const ART: Record<CardId, (px: Px) => void> = {
  whiteout(px) {
    // Pines fading into a wall of blowing snow.
    px.rect(0, 0, S, S, 'w');
    pine(px, 6, 26, 16, { fill: 'l', shade: 'm', edge: 'm' });
    pine(px, 22, 24, 12, { fill: 's', shade: 'l', edge: 'l' });
    pine(px, 15, 30, 10, { fill: 'm', shade: 'd', edge: 'd' });
    px.rect(0, 0, S, S, (x, y) => (bayer(x + Math.floor(y / 3), y, 5) ? 'w' : null));
    for (let k = 0; k < 7; k++) px.line(k * 6 - 4, 4 + k * 4, k * 6 + 3, 2 + k * 4, 's');
    flakes(px, 0, 0, S, S, 14, 7, 'l');
  },
  night(px) {
    // A dark sky with a moon and stars over black peaks and a lit chalet window.
    px.vgrad(0, 0, S, 22, 'k', 'd');
    px.disc(24, 7, 4, (x, y) => (x > 25 && y > 6 ? 's' : 'w'));
    px.disc(23, 6, 1, 's');
    flakes(px, 0, 0, S, 16, 9, 4, 'w');
    mountain(px, -6, 26, 26, 9, 10, { tones: ['l', 'm', 'd', 'k'], snow: 5, seed: 2 });
    mountain(px, 12, 40, 26, 27, 13, { tones: ['l', 'm', 'd', 'k'], snow: 4, seed: 5 });
    px.rect(0, 25, S, 7, (x, y) => (bayer(x, y, 6) ? 'm' : 'd'));
    px.rect(5, 19, 12, 8, 'd');
    px.poly([[3, 20], [11, 14], [19, 20]], 'm');
    px.line(3, 20, 11, 14, 'k');
    px.line(11, 14, 19, 20, 'k');
    px.rect(8, 21, 4, 3, 'r');
    px.rect(9, 27, 3, 2, 'q');
  },
  dossierWidow(px) {
    dossier(px, (p, x, y) => {
      p.ellipse(x + 6, y + 6, 6, 6, 'k');
      p.ellipse(x + 6, y + 7, 3.5, 4.5, 'w');
      p.rect(x + 4, y + 6, 1, 1, 'k');
      p.rect(x + 8, y + 6, 1, 1, 'k');
      p.rect(x + 5, y + 9, 3, 1, 'r');
      p.rect(x, y + 12, 12, 2, 'w');
    });
  },
  dossierYetiKing(px) {
    dossier(px, (p, x, y) => {
      p.ellipse(x + 6, y + 8, 6, 6, (i, j) => (bayer(i, j, 4) ? 's' : 'w'));
      p.ellipse(x + 6, y + 9, 3.5, 3, 'm');
      p.rect(x + 4, y + 8, 1, 1, 'r');
      p.rect(x + 8, y + 8, 1, 1, 'r');
      p.rect(x + 5, y + 10, 3, 1, 'k');
      p.rect(x + 2, y + 1, 9, 2, 'r');
      for (const k of [2, 5, 8]) p.set(x + k + 0.5, y, 'r');
    });
  },
  dossierKickback(px) {
    dossier(px, (p, x, y) => {
      p.ellipse(x + 6, y + 4, 5.5, 4, 'w');
      p.rect(x + 5, y, 2, 5, 'r');
      p.rect(x + 1, y + 5, 10, 1, 'k');
      p.ellipse(x + 6, y + 8, 4, 4, 'w');
      p.rect(x + 4, y + 8, 1, 1, 'k');
      p.rect(x + 8, y + 8, 1, 1, 'k');
      p.rect(x + 4, y + 10, 5, 1, 'k');
      p.rect(x, y + 12, 12, 2, 'r');
    });
  },
  patrol(px) {
    backdrop(px, 15, 3);
    trailBand(px, 23, 6);
    // The booth: white walls, a dark roof, a red band and a window.
    px.rect(2, 9, 10, 15, 'w');
    px.rect(2, 16, 10, 2, 'r');
    px.rect(4, 11, 6, 4, 'm');
    px.rect(5, 12, 2, 2, 's');
    px.poly([[0, 10], [7, 5], [14, 10]], 'd');
    px.line(0, 10, 7, 5, 'k');
    px.line(7, 5, 14, 10, 'k');
    px.rect(1, 9, 12, 1, 'w');
    px.rect(2, 9, 1, 15, 'k');
    px.rect(11, 9, 1, 15, 'k');
    // The guard behind the barrier.
    px.sprite('guard', 15, 8);
    // The barrier arm, striped red and white.
    px.rect(12, 14, 2, 10, 'k');
    for (let x = 14; x < 31; x++) {
      px.set(x, 16, 'k');
      px.set(x, 19, 'k');
      px.rect(x, 17, 1, 2, Math.floor(x / 3) % 2 ? 'r' : 'w');
    }
    px.rect(30, 16, 1, 4, 'k');
  },
  moguls(px) {
    sky(px, 0, 0, S, 7);
    range(px, 0, S, 7, 5, 11);
    snowField(px, 0, 7, S, 25, 2);
    // Rows of bumps: lit tops, shaded undersides, a mid-grey crescent of shadow.
    for (let row = 0; row < 4; row++)
      for (let k = -1; k < 5; k++) {
        const x = 2 + k * 8 + (row % 2) * 4;
        const y = 11 + row * 6;
        const r = 2.4 + row * 0.5;
        px.ellipse(x + 1, y + 1.2, r * 1.3, r * 0.75, 'm');
        px.ellipse(x, y, r * 1.3, r * 0.75, (i, j) => (j > y + 0.5 || i > x + r * 0.6 ? 's' : 'w'));
      }
    // A weaving line of ski tracks.
    for (let y = 8; y < 32; y++) {
      const x = 14 + Math.round(Math.sin(y * 0.5) * 6);
      px.set(x, y, 'd');
      px.set(x + 2, y, 'd');
    }
    px.grid(SKIER, 12, 2);
  },
  kicker(px) {
    sky(px, 0, 0, S, 24);
    cloud(px, 8, 6, 12, 2);
    range(px, 0, S, 24, 9, 4, { tones: ['w', 's', 'l', 'm'] });
    snowField(px, 0, 24, S, 8, 4);
    // The ramp: a wedge with a lit face and a shaded side.
    px.poly([[2, 27], [15, 27], [15, 19]], (_x, y) => (y > 25 ? 's' : 'w'));
    px.rect(15, 19, 2, 8, 'l');
    px.line(2, 27, 15, 19, 'k');
    px.line(15, 19, 16, 19, 'k');
    px.rect(16, 19, 1, 9, 'k');
    px.rect(2, 27, 15, 1, 'k');
    // The skier, mid-air, with speed lines and a shadow below.
    px.grid(SKIER, 20, 7);
    for (const [y, l] of [[9, 4], [11, 6], [13, 3]] as const) px.rect(19 - l - 1, y, l, 1, 'l');
    px.ellipse(24, 28, 4, 1, 'l');
  },
  ice(px) {
    backdrop(px, 10, 6);
    // A sheet of glare ice with diagonal shine and cracks.
    px.poly([[0, 14], [32, 11], [32, 32], [0, 32]], (x, y) => ((x + y) % 9 === 0 || (x + y) % 9 === 1 ? 'w' : (x - y) % 13 === 0 ? 's' : 'l'));
    px.line(0, 14, 32, 11, 'm');
    px.line(4, 22, 9, 20, 'm');
    px.line(9, 20, 12, 24, 'm');
    px.line(9, 20, 14, 19, 'd');
    px.line(20, 27, 26, 25, 'm');
    // A warning sign: a red triangle with an exclamation mark.
    px.rect(26, 9, 1, 12, 'k');
    px.poly([[21, 11], [26.5, 2], [32, 11]], 'r');
    px.line(21, 11, 26, 2, 'k');
    px.line(27, 2, 32, 11, 'k');
    px.rect(21, 11, 11, 1, 'k');
    px.rect(26, 5, 1, 3, 'w');
    px.set(26, 9, 'w');
  },
  cabin(px) {
    backdrop(px, 16, 8);
    pine(px, 4, 24, 13);
    pine(px, 29, 25, 11);
    // Log walls: alternating rows of dark and mid with ink gaps.
    px.rect(7, 13, 18, 12, (_x, y) => (y % 3 === 0 ? 'k' : y % 3 === 1 ? 'm' : 'd'));
    px.rect(7, 13, 1, 12, 'k');
    px.rect(24, 13, 1, 12, 'k');
    // Roof heavy with snow, and a chimney.
    px.rect(20, 5, 3, 6, 'd');
    px.rect(20, 5, 3, 1, 'w');
    px.poly([[5, 14], [16, 6], [27, 14]], (x, y) => (y < 9 || (y < 11 && x < 16) ? 'w' : 's'));
    px.line(5, 14, 16, 6, 'k');
    px.line(16, 6, 27, 14, 'k');
    smoke(px, 21, 4, 3, 1);
    // A lit window with a gun barrel and a muzzle flash.
    px.rect(10, 17, 5, 4, 'r');
    px.rect(10, 17, 5, 1, 'k');
    px.rect(12, 17, 1, 4, 'k');
    px.rect(14, 19, 6, 1, 'k');
    px.set(20, 18, 'r');
    px.set(21, 19, 'r');
    px.set(20, 20, 'r');
    px.rect(18, 20, 3, 5, 'k');
  },
  sniper(px) {
    sky(px, 0, 0, S, 20);
    range(px, 0, S, 22, 10, 9);
    // A dark crag, sandbags along its top, and the sniper lying behind them.
    mountain(px, 2, 36, 34, 18, 16, { snow: 2, seed: 2, lean: 0.35, tones: ['s', 'l', 'd', 'k'] });
    px.rect(9, 12, 6, 3, 'k');
    px.rect(9, 11, 4, 1, 'k');
    px.rect(15, 13, 6, 1, 'd');
    px.line(14, 12, 1, 10, 'k');
    for (const [x, y] of [[8, 16], [13, 15], [18, 15], [23, 16], [28, 17]] as const) {
      px.ellipse(x, y, 3, 1.7, (_i, j) => (j > y ? 'l' : 'w'));
      px.set(x - 3, y, 'k');
      px.set(x + 3, y, 'k');
    }
    // The red glint of the scope, a little star.
    px.set(15, 11, 'r');
    px.set(15, 9, 'r');
    px.set(15, 10, 'r');
    px.set(14, 10, 'r');
    px.set(16, 10, 'r');
    px.set(15, 8, 'q');
    px.set(13, 10, 'q');
    px.set(17, 10, 'q');
  },
  garage(px) {
    backdrop(px, 14, 12);
    // The garage: block walls, a roller door half up, darkness inside.
    px.rect(3, 10, 26, 16, (x, y) => ((x + (Math.floor(y / 2) % 2) * 2) % 4 === 0 || y % 2 === 0 ? 'm' : 'l'));
    px.poly([[1, 11], [16, 5], [31, 11]], (_x, y) => (y < 8 ? 'w' : 's'));
    px.line(1, 11, 16, 5, 'k');
    px.line(16, 5, 31, 11, 'k');
    px.rect(6, 13, 20, 13, 'k');
    px.rect(6, 13, 20, 5, (_x, y) => (y % 2 ? 'm' : 'l'));
    px.rect(6, 18, 20, 1, 'd');
    // A snowmobile nosing out: windshield, red cowl, headlight.
    px.poly([[9, 26], [11, 21], [22, 21], [25, 26]], 'r');
    px.rect(13, 19, 6, 2, 's');
    px.rect(22, 22, 2, 2, 'w');
    px.rect(8, 26, 18, 1, 'k');
    px.rect(6, 27, 22, 1, 'd');
    // Tracks in the snow.
    for (let x = 0; x < 6; x++) px.set(x * 2 + 1, 29 + (x % 2), 'l');
  },
  cache(px) {
    backdrop(px, 15, 13);
    pine(px, 27, 24, 12);
    // A wooden crate with a red cross on a white plate.
    px.rect(6, 13, 16, 13, (x, y) => (y % 4 === 0 ? 'd' : x % 7 === 0 ? 'd' : 'm'));
    px.rect(6, 12, 16, 2, 'w');
    px.rect(6, 13, 16, 1, 'k');
    px.rect(6, 25, 16, 1, 'k');
    px.rect(6, 13, 1, 13, 'k');
    px.rect(21, 13, 1, 13, 'k');
    px.rect(10, 16, 8, 7, 'w');
    px.rect(13, 17, 2, 5, 'r');
    px.rect(11, 18, 6, 3, 'r');
    // A thermos of cocoa leaning on it.
    px.rect(23, 18, 3, 8, 'r');
    px.rect(23, 17, 3, 1, 'k');
    px.rect(24, 19, 1, 5, 'q');
    smoke(px, 24, 16, 2, 4);
  },
  safehouse(px) {
    backdrop(px, 16, 15);
    // A cheerful chalet: white walls, ink timbers, a snowy roof.
    px.rect(6, 13, 20, 13, 'w');
    for (const x of [6, 15, 25]) px.rect(x, 13, 1, 13, 'k');
    px.line(6, 19, 15, 13, 'k');
    px.line(16, 13, 25, 19, 'k');
    px.poly([[3, 14], [16, 4], [29, 14]], (x, y) => (y < 8 || x < 10 ? 'w' : 's'));
    px.line(3, 14, 16, 4, 'k');
    px.line(16, 4, 29, 14, 'k');
    // The door and its GO AWAY doormat.
    px.rect(14, 19, 4, 7, 'd');
    px.rect(12, 26, 8, 2, 'r');
    // Shuttered windows, and a periscope poking up through the roof.
    px.rect(8, 16, 4, 3, 'm');
    px.rect(20, 16, 4, 3, 'm');
    px.rect(20, 1, 1, 7, 'k');
    px.rect(20, 1, 3, 1, 'k');
    px.set(23, 1, 'r');
  },
  pines(px) {
    sky(px, 0, 0, S, 20);
    range(px, 0, S, 20, 9, 21, { tones: ['w', 's', 'l', 'm'] });
    snowField(px, 0, 20, S, 12, 21);
    pine(px, 6, 27, 14);
    pine(px, 26, 28, 15);
    pine(px, 16, 30, 24);
    px.ellipse(16, 30, 6, 1, 's');
    flakes(px, 0, 0, S, 20, 8, 3, 'w');
  },
  boulder(px) {
    backdrop(px, 13, 25);
    // A faceted boulder: lit top-left, shaded right, ink outline, snow cap.
    const outline: [number, number][] = [[4, 26], [3, 19], [7, 12], [14, 9], [22, 10], [28, 16], [29, 24], [26, 27]];
    px.poly(outline, (x, y) => {
      if (y < 13 + (x - 14) * 0.15 && x < 24) return 'w';
      if (x > 20 + (y - 10) * 0.2) return 'd';
      return (x * 3 + y * 5) % 11 === 0 ? 'd' : 'm';
    });
    for (let k = 0; k < outline.length; k++) px.line(...outline[k], ...outline[(k + 1) % outline.length], 'k');
    px.line(12, 14, 16, 22, 'd');
    px.line(16, 22, 15, 26, 'd');
    px.ellipse(16, 28, 13, 1.5, 'l');
    px.ellipse(5, 28, 2, 1, 'm');
  },
  peak(px) {
    sky(px, 0, 0, S, S);
    cloud(px, 25, 8, 10, 6);
    mountain(px, -4, 36, 32, 15, 4, { snow: 12, seed: 4, lean: 0.25 });
    mountain(px, 18, 40, 32, 28, 16, { snow: 6, seed: 9 });
    flag(px, 15, 4, 5);
  },
  powder(px) {
    sky(px, 0, 0, S, 10);
    range(px, 0, S, 10, 6, 31);
    pine(px, 4, 16, 9);
    pine(px, 29, 15, 8);
    snowField(px, 0, 14, S, 18, 31);
    // A plume of spray with shaded billows, and a skier half buried in it.
    for (let k = 0; k < 8; k++) {
      const x = 4 + k * 3;
      const y = 18 - Math.sin(k * 0.45) * 6;
      const r = 3 + (k % 3);
      px.disc(x + 1, y + 1, r, 'l');
      px.disc(x, y, r, (i, j) => (j > y + r * 0.3 && (i + j) % 2 === 0 ? 's' : 'w'));
    }
    px.grid(SKIER.slice(0, 6), 19, 16);
    for (let x = 0; x < S; x++) px.set(x, 23 + Math.round(Math.sin(x * 0.4)), 'm');
    px.dither(0, 26, S, 6, 'w', 's', 4);
  },
  avalanche(px) {
    sky(px, 0, 0, S, S, 'l', 's');
    // A dark slope, and a wall of snow billowing down it with grey shadows.
    px.poly([[0, 6], [32, 28], [32, 32], [0, 32]], (x, y) => ((x + y * 2) % 7 === 0 ? 'd' : 'm'));
    px.line(0, 6, 32, 28, 'k');
    for (let k = 0; k < 11; k++) {
      const x = k * 2;
      const y = 10 + k * 1.5;
      const r = 4 + (k % 3);
      px.disc(x + 1, y + 1.5, r, 'l');
      px.disc(x, y, r, (i, j) => ((i + j) % 4 === 0 && j > y ? 's' : 'w'));
    }
    // A tiny skier fleeing, and the red warning sign.
    px.grid(SKIER, 21, 16);
    px.rect(28, 18, 1, 9, 'k');
    px.poly([[23, 19], [28.5, 10], [34, 19]], 'r');
    px.line(23, 19, 28, 10, 'k');
    px.rect(23, 19, 10, 1, 'k');
    px.rect(28, 12, 1, 4, 'w');
    px.set(28, 17, 'w');
  },
  yetiCave(px) {
    sky(px, 0, 0, S, 14);
    range(px, 0, S, 14, 7, 51, { tones: ['w', 's', 'l', 'm'] });
    mountain(px, -10, 42, 31, 16, 3, { snow: 8, seed: 13, lean: 0.2 });
    // The cave: a dark arch with a rim of rock, icicles hanging from it, and two red eyes.
    px.ellipse(16, 24, 9.5, 9.5, 'd');
    px.rect(6, 24, 21, 7, 'd');
    px.ellipse(16, 24, 8, 8, 'k');
    px.rect(8, 24, 17, 7, 'k');
    for (const x of [10, 13, 16, 19, 22]) {
      const top = 16 + Math.round(Math.abs(16 - x) * 0.45);
      px.line(x, top, x, top + 2 + (x % 2), 'w');
    }
    px.rect(12, 23, 2, 1, 'r');
    px.rect(18, 23, 2, 1, 'r');
    px.set(12, 22, 'q');
    px.set(19, 22, 'q');
    snowField(px, 0, 29, S, 3, 51);
    for (let k = 0; k < 5; k++) px.rect(3 + k * 6, 30 + (k % 2), 2, 1, 'm');
  },
  demoShack(px) {
    backdrop(px, 15, 17);
    // A corrugated shed with its door ajar and a warning sign.
    px.rect(3, 12, 18, 14, (x) => (x % 2 === 0 ? 'm' : 'l'));
    px.rect(2, 10, 20, 2, 'd');
    px.rect(2, 9, 20, 1, 'w');
    px.rect(2, 12, 20, 1, 'k');
    px.rect(3, 12, 1, 14, 'k');
    px.rect(20, 12, 1, 14, 'k');
    px.rect(6, 17, 6, 9, 'k');
    px.rect(7, 18, 1, 8, 'd');
    px.poly([[13, 19], [16.5, 13], [20, 19]], 'r');
    px.line(13, 19, 16, 13, 'k');
    px.line(17, 13, 20, 19, 'k');
    px.rect(13, 19, 7, 1, 'k');
    px.rect(16, 15, 1, 2, 'w');
    px.set(16, 18, 'w');
    // A bundle of dynamite on a crate, its fuse fizzing.
    px.rect(21, 21, 9, 6, (x, y) => (y === 21 ? 'l' : x % 4 === 0 ? 'd' : 'm'));
    px.rect(21, 21, 9, 1, 'k');
    px.rect(21, 26, 9, 1, 'k');
    for (const [x, c] of [[22, 'r'], [24, 'q'], [26, 'r'], [28, 'q']] as const) px.rect(x, 16, 2, 5, c);
    px.rect(22, 18, 8, 1, 'k');
    px.line(25, 15, 27, 12, 'k');
    px.set(28, 11, 'r');
    px.set(29, 11, 'w');
    px.set(28, 10, 'w');
    px.set(27, 10, 'q');
    // A mine in the snow out front.
    px.ellipse(9, 29, 3.5, 1.6, 'd');
    px.rect(8, 27, 2, 2, 'k');
    px.set(9, 26, 'r');
  },
  fieldHospital(px) {
    backdrop(px, 14, 19);
    pine(px, 28, 22, 10);
    // A ridge tent, lit on the left, with its flap open and a red cross.
    px.poly([[1, 27], [12, 9], [25, 27]], (x, y) => (x < 12 - (y - 9) * 0.05 ? 'w' : 's'));
    px.line(1, 27, 12, 9, 'k');
    px.line(12, 9, 25, 27, 'k');
    px.rect(1, 27, 25, 1, 'k');
    px.poly([[10, 27], [13, 17], [16, 27]], 'd');
    px.line(10, 27, 13, 17, 'k');
    px.line(13, 17, 16, 27, 'k');
    px.rect(6, 19, 2, 6, 'r');
    px.rect(4, 21, 6, 2, 'r');
    // The flag, and a stretcher by the door.
    px.rect(12, 2, 1, 8, 'k');
    px.rect(13, 2, 7, 5, 'w');
    px.rect(15, 2, 2, 5, 'r');
    px.rect(13, 3, 7, 2, 'r');
    px.rect(13, 2, 7, 1, 'k');
    px.rect(19, 2, 1, 5, 'k');
    px.rect(13, 6, 7, 1, 'k');
    px.rect(20, 25, 10, 2, 'l');
    px.rect(20, 25, 10, 1, 'k');
    px.rect(21, 27, 1, 2, 'k');
    px.rect(28, 27, 1, 2, 'k');
  },
  kennel(px) {
    backdrop(px, 14, 23);
    // A doghouse under a red roof with a cap of snow, eyes in the dark doorway.
    px.rect(4, 16, 14, 10, (_x, y) => (y % 3 === 0 ? 'd' : 'm'));
    px.rect(4, 16, 1, 10, 'k');
    px.rect(17, 16, 1, 10, 'k');
    px.poly([[2, 17], [11, 9], [20, 17]], (_x, y) => (y < 12 ? 'w' : 'r'));
    px.line(2, 17, 11, 9, 'k');
    px.line(11, 9, 20, 17, 'k');
    px.ellipse(11, 22, 3, 3.5, 'k');
    px.rect(8, 22, 7, 4, 'k');
    px.set(10, 22, 'r');
    px.set(12, 22, 'r');
    px.rect(3, 26, 16, 1, 'k');
    // A hound bounding out, and a bowl.
    px.sprite('hound', 16, 13);
    px.rect(2, 27, 4, 2, 'r');
    px.rect(2, 27, 4, 1, 'k');
    for (let k = 0; k < 4; k++) px.set(20 + k * 3, 30 - (k % 2), 'm');
  },
  mine(px) {
    backdrop(px, 12, 29);
    trailBand(px, 19, 8);
    // A mine half buried in the groomed snow, its light blinking red.
    px.ellipse(16, 24, 8, 3.5, 'k');
    px.ellipse(16, 23, 7, 3, (_x, y) => (y < 23 ? 'm' : 'd'));
    for (const x of [11, 14, 18, 21]) px.set(x, 23, 'k');
    px.rect(15, 18, 2, 4, 'k');
    px.rect(15, 17, 2, 1, 'r');
    px.set(14, 16, 'q');
    px.set(17, 16, 'q');
  },
  gates(px) {
    sky(px, 0, 0, S, 10);
    range(px, 0, S, 10, 6, 61, { tones: ['w', 's', 'l', 'm'] });
    snowField(px, 0, 10, S, 22, 61);
    // A slalom course falling away: red and dark gates, nearer ones bigger, and a carved line.
    const gate = (x: number, y: number, h: number, c: string) => {
      px.rect(x, y, 1, h, 'k');
      px.rect(x + 1, y, Math.max(2, Math.round(h / 3)), Math.max(2, Math.round(h / 4)), c);
      px.set(x, y + h, 'l');
    };
    gate(6, 12, 5, 'r');
    gate(20, 15, 7, 'd');
    gate(9, 19, 9, 'r');
    gate(24, 21, 10, 'd');
    for (let y = 11; y < 32; y++) px.set(15 + Math.round(Math.sin(y * 0.38) * 7), y, 'm');
    px.grid(SKIER, 14, 22);
  },
  tunnel(px) {
    backdrop(px, 12, 63);
    // A snow tunnel's mouth: a white arch over darkness, icicles, and the trail running in.
    px.ellipse(16, 22, 14, 13, (_x, y) => (y < 12 ? 'w' : 's'));
    px.rect(2, 22, 29, 10, 's');
    px.ellipse(16, 23, 9, 9, 'k');
    px.rect(7, 23, 19, 9, 'k');
    px.ellipse(16, 22, 14, 13, (x, y) => (px.is(x, y, 'k') ? null : bayer(x, y, 3) ? 'l' : null));
    for (const x of [9, 12, 16, 20, 23]) px.line(x, 15 + Math.abs(16 - x) * 0.4, x, 17 + Math.abs(16 - x) * 0.4 + (x % 2), 'w');
    px.poly([[11, 32], [14, 24], [18, 24], [22, 32]], (x, y) => ((x + y) % 3 === 0 ? 's' : 'w'));
    px.rect(15, 28, 2, 1, 'r');
  },
  checkpoint(px) {
    backdrop(px, 15, 65);
    trailBand(px, 23, 6);
    // A sentry box with a red-striped barrier down across the trail, and a spotlight.
    px.rect(2, 9, 9, 15, 'd');
    px.rect(3, 11, 7, 5, 'r');
    px.rect(4, 12, 5, 3, 'w');
    px.rect(1, 7, 11, 2, 'k');
    px.rect(1, 6, 11, 1, 'w');
    px.sprite('guard', 10, 8);
    px.rect(11, 15, 2, 9, 'k');
    for (let x = 13; x < 32; x++) {
      px.set(x, 15, 'k');
      px.set(x, 18, 'k');
      px.rect(x, 16, 1, 2, Math.floor(x / 3) % 2 ? 'r' : 'w');
    }
    px.poly([[6, 6], [0, 0], [12, 0]], (x, y) => (bayer(x, y, 6) ? 'w' : null));
    px.rect(5, 5, 3, 2, 'k');
  },
  blackRun(px) {
    sky(px, 0, 0, S, 12);
    // A steep dark slope with a sign: a black diamond on white, and EXPERTS ONLY below.
    px.poly([[0, 8], [32, 30], [32, 32], [0, 32]], (x, y) => ((x * 3 + y) % 9 === 0 ? 'l' : 's'));
    px.line(0, 8, 32, 30, 'm');
    px.rect(15, 18, 2, 14, 'k');
    px.rect(6, 4, 20, 15, 'w');
    px.rect(6, 4, 20, 1, 'k');
    px.rect(6, 18, 20, 1, 'k');
    px.rect(6, 4, 1, 15, 'k');
    px.rect(25, 4, 1, 15, 'k');
    blackDiamond(px, 16, 6, 5);
    px.rect(9, 16, 14, 1, 'r');
  },
  chairlift(px) {
    sky(px, 0, 0, S, S);
    range(px, 0, S, 32, 14, 41, { tones: ['w', 's', 'l', 'm'] });
    cloud(px, 7, 7, 10, 3);
    // A tower and the cable climbing past it.
    px.rect(26, 6, 2, 26, 'd');
    px.rect(27, 6, 1, 26, 'k');
    px.rect(22, 6, 10, 1, 'k');
    for (let y = 9; y < 32; y += 4) px.line(26, y, 27, y + 3, 'm');
    px.line(-1, 15, 31, 4, 'k');
    // The chair: hanger, seat, safety bar, rider and dangling skis.
    px.rect(12, 9, 1, 8, 'k');
    px.rect(7, 17, 12, 1, 'k');
    px.rect(7, 22, 12, 1, 'k');
    px.rect(7, 17, 1, 6, 'k');
    px.rect(18, 17, 1, 6, 'k');
    px.rect(8, 21, 10, 1, 'd');
    px.grid(['..rr..', '.kkkk.', '.kwwk.', 'rrrrrr', 'rqqqqr'], 10, 16);
    px.line(9, 24, 15, 27, 'k');
    px.line(12, 24, 18, 27, 'k');
  },
  chute(px) {
    sky(px, 0, 0, S, 10);
    // Rock walls closing in on a ribbon of snow.
    px.rect(0, 4, S, 28, (x, y) => {
      const mid = 16 + Math.sin(y * 0.3) * 2;
      const half = 2 + (32 - y) * 0.18;
      const d = Math.abs(x - mid);
      if (d < half) return x < mid ? 'w' : 's';
      if (d < half + 1) return 'k';
      return (x * 5 + y * 3) % 7 === 0 ? 'k' : x < mid ? 'm' : 'd';
    });
    px.dither(0, 4, S, 3, 's', 'm', 6);
    // The sign at the lip: a black diamond on a white plate.
    px.rect(22, 2, 9, 9, 'w');
    px.rect(22, 2, 9, 1, 'k');
    px.rect(22, 10, 9, 1, 'k');
    px.rect(22, 2, 1, 9, 'k');
    px.rect(30, 2, 1, 9, 'k');
    blackDiamond(px, 26, 3, 3);
    px.rect(26, 11, 1, 5, 'k');
  },
};

const cache = new Map<string, string>();

/** The illustration for a card, as a crisp image URL at the given scale. */
export function cardArtUrl(card: CardId, scale: number): string {
  const key = `${card}@${scale}`;
  let url = cache.get(key);
  if (!url) {
    const px = new Px(S, S);
    ART[card](px);
    url = px.url(scale);
    cache.set(key, url);
  }
  return url;
}

export const CARD_ART_SIZE = S;
