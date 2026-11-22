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
    blackDiamond(px, 16, 6, 4);
    px.rect(9, 16, 14, 1, 'r');
  },
  // --- Trail ---------------------------------------------------------------------------------
  rail(px) {
    sky(px, 0, 0, S, 16);
    range(px, 0, S, 16, 8, 81, { tones: ['w', 's', 'l', 'm'] });
    snowField(px, 0, 16, S, 16, 81);
    // A long rail with a red top, and the skier grinding it, sparks flying.
    px.rect(2, 22, 28, 2, 'r');
    px.rect(2, 21, 28, 1, 'k');
    px.rect(2, 24, 28, 1, 'k');
    for (const x of [5, 15, 26]) px.rect(x, 25, 1, 5, 'k');
    px.rect(1, 29, 30, 1, 'l');
    px.grid(SKIER, 12, 13);
    for (const [x, y] of [[10, 20], [9, 18], [21, 20], [23, 19]] as const) px.set(x, y, 'r');
  },
  corduroy(px) {
    sky(px, 0, 0, S, 8);
    range(px, 0, S, 8, 5, 83);
    // Fresh lines raked to the horizon, and the groomer's tracks.
    px.rect(0, 8, S, 24, 'w');
    for (let k = -8; k < 40; k += 3) px.line(16 + (k - 16) * 0.2, 8, k, 32, 's');
    px.rect(0, 8, S, 1, 'l');
    // The snowcat, small on the horizon.
    px.rect(20, 9, 8, 3, 'r');
    px.rect(19, 12, 10, 1, 'k');
    px.rect(25, 7, 3, 2, 'k');
  },
  crevasse(px) {
    sky(px, 0, 0, S, 12);
    range(px, 0, S, 12, 7, 85, { tones: ['w', 's', 'l', 'm'] });
    snowField(px, 0, 12, S, 20, 85);
    // A jagged blue-black gash across the snow, and a skier leaping it.
    px.poly([[0, 22], [8, 20], [14, 23], [22, 19], [32, 21], [32, 25], [22, 23], [14, 27], [7, 24], [0, 26]], (x, y) => (y < 22 && bayer(x, y, 8) ? 'd' : 'k'));
    for (let x = 0; x < S; x++) if (px.is(x, 20, 'k') || px.is(x, 21, 'k')) px.set(x, 19, 'l');
    px.grid(SKIER, 16, 8);
    for (const [y, l] of [[10, 4], [12, 6]] as const) px.rect(15 - l, y, l, 1, 'l');
  },
  powderStash(px) {
    sky(px, 0, 0, S, 10);
    pine(px, 5, 18, 10);
    pine(px, 27, 17, 9);
    snowField(px, 0, 14, S, 18, 87);
    // Deep pillows of powder with a skier buried to the waist.
    for (const [x, y, r] of [[7, 22, 6], [18, 20, 7], [28, 24, 6], [12, 28, 6], [25, 30, 5]] as const) {
      px.disc(x + 1, y + 1, r, 'l');
      px.disc(x, y, r, (i, j) => (j > y + 1 && (i + j) % 3 === 0 ? 's' : 'w'));
    }
    px.grid(SKIER.slice(0, 5), 15, 13);
  },
  waxStation(px) {
    backdrop(px, 14, 89);
    trailBand(px, 24, 5);
    // A bench with skis on it, an iron, and a pot of red wax.
    px.rect(3, 17, 22, 2, 'd');
    px.rect(3, 16, 22, 1, 'k');
    for (const x of [4, 23]) px.rect(x, 19, 1, 5, 'k');
    px.rect(5, 14, 18, 1, 'k');
    px.rect(5, 15, 18, 1, 'r');
    px.rect(14, 10, 5, 3, 'm');
    px.rect(13, 13, 7, 1, 'k');
    px.rect(16, 8, 1, 2, 'k');
    smoke(px, 16, 7, 2, 1);
    px.rect(25, 13, 5, 4, 'r');
    px.rect(25, 12, 5, 1, 'k');
    px.rect(26, 14, 3, 1, 'q');
  },
  // --- Roadside ------------------------------------------------------------------------------
  ammoDump(px) {
    backdrop(px, 14, 91);
    // Crates stencilled with red, a pile of shells, and a tarp.
    for (const [x, y, w] of [[3, 18, 12], [15, 20, 10], [8, 11, 10]] as const) {
      px.rect(x, y, w, 8, (i, j) => (i === x || i === x + w - 1 || j === y ? 'k' : (i + j) % 5 === 0 ? 'd' : 'm'));
      px.rect(x + 2, y + 3, w - 4, 2, 'r');
    }
    for (let k = 0; k < 5; k++) {
      px.rect(26 + (k % 3) * 2, 24 - Math.floor(k / 3) * 3, 1, 3, 'r');
      px.set(26 + (k % 3) * 2, 23 - Math.floor(k / 3) * 3, 'k');
    }
    px.rect(1, 28, 30, 1, 'l');
  },
  watchtower(px) {
    sky(px, 0, 0, S, 22);
    range(px, 0, S, 22, 10, 93, { tones: ['w', 's', 'l', 'm'] });
    snowField(px, 0, 22, S, 10, 93);
    pine(px, 4, 28, 12);
    // A tall wooden tower with a hut on top and a searchlight beam.
    px.line(12, 30, 15, 10, 'k');
    px.line(22, 30, 19, 10, 'k');
    for (let y = 14; y < 30; y += 5) px.line(13, y + 3, 21, y, 'd');
    px.rect(12, 6, 10, 5, 'd');
    px.rect(11, 4, 12, 2, 'k');
    px.rect(14, 7, 6, 2, 'r');
    px.poly([[22, 7], [32, 2], [32, 12]], (x, y) => (bayer(x, y, 7) ? 'w' : null));
  },
  firstAid(px) {
    backdrop(px, 15, 95);
    // A first aid post: a box on a pole, a red cross, a rolled stretcher, a sledge.
    px.rect(15, 14, 2, 14, 'k');
    px.rect(8, 6, 16, 10, 'w');
    px.rect(8, 6, 16, 1, 'k');
    px.rect(8, 15, 16, 1, 'k');
    px.rect(8, 6, 1, 10, 'k');
    px.rect(23, 6, 1, 10, 'k');
    px.rect(15, 8, 2, 6, 'r');
    px.rect(12, 10, 8, 2, 'r');
    px.rect(3, 25, 12, 2, 'r');
    px.rect(2, 27, 14, 1, 'k');
    px.rect(20, 24, 10, 3, 'l');
    px.rect(20, 24, 10, 1, 'k');
  },
  jammer(px) {
    sky(px, 0, 0, S, 18, 'l', 's');
    snowField(px, 0, 18, S, 14, 97);
    // A box with dials and an aerial, spitting red zigzags of noise.
    px.rect(8, 16, 16, 11, 'd');
    px.rect(8, 16, 16, 1, 'k');
    px.rect(8, 26, 16, 1, 'k');
    px.disc(13, 21, 2.5, 'k');
    px.set(13, 21, 'r');
    px.rect(17, 19, 5, 1, 'l');
    px.rect(17, 22, 5, 1, 'l');
    px.rect(15, 4, 1, 12, 'k');
    for (const side of [-1, 1])
      for (let k = 0; k < 3; k++) {
        const x0 = 16 + side * (4 + k * 4);
        px.line(x0, 4 + k * 2, x0 + side * 2, 7 + k * 2, 'r');
        px.line(x0 + side * 2, 7 + k * 2, x0, 10 + k * 2, 'r');
      }
  },
  deadDrop(px) {
    backdrop(px, 12, 99);
    pine(px, 26, 22, 14);
    // A rock with a loose stone pried up, and an envelope stamped red.
    px.poly([[3, 27], [5, 19], [12, 15], [20, 17], [23, 27]], (x, y) => (y < 19 ? 'w' : x > 16 ? 'd' : 'm'));
    px.line(3, 27, 5, 19, 'k');
    px.line(5, 19, 12, 15, 'k');
    px.line(12, 15, 20, 17, 'k');
    px.line(20, 17, 23, 27, 'k');
    px.rect(12, 22, 12, 7, 'w');
    px.rect(12, 22, 12, 1, 'k');
    px.rect(12, 28, 12, 1, 'k');
    px.rect(12, 22, 1, 7, 'k');
    px.rect(23, 22, 1, 7, 'k');
    px.line(12, 22, 17, 26, 'k');
    px.line(23, 22, 18, 26, 'k');
    px.rect(19, 24, 3, 3, 'r');
  },
  scrapYard(px) {
    backdrop(px, 14, 101);
    // Heaps of junk: a wrecked snowmobile, skis, a wheel, scrap metal.
    px.poly([[1, 28], [8, 16], [16, 20], [22, 14], [31, 28]], (x, y) => ((x * 3 + y * 7) % 5 === 0 ? 'd' : (x + y) % 3 === 0 ? 'l' : 'm'));
    px.line(1, 28, 8, 16, 'k');
    px.line(8, 16, 16, 20, 'k');
    px.line(16, 20, 22, 14, 'k');
    px.line(22, 14, 31, 28, 'k');
    px.rect(8, 21, 8, 3, 'r');
    px.disc(23, 23, 3, 'k');
    px.disc(23, 23, 1.5, 'm');
    px.line(4, 12, 10, 26, 'k');
    px.line(6, 12, 12, 26, 'd');
    px.rect(0, 28, S, 1, 'k');
  },
  ticketBooth(px) {
    backdrop(px, 15, 103);
    trailBand(px, 25, 4);
    // A little booth with a striped awning, a window and a roll of tickets.
    px.rect(8, 12, 16, 13, 'w');
    px.rect(8, 12, 1, 13, 'k');
    px.rect(23, 12, 1, 13, 'k');
    px.rect(6, 8, 20, 4, (x) => (Math.floor(x / 2) % 2 ? 'r' : 'w'));
    px.rect(6, 7, 20, 1, 'k');
    px.rect(6, 12, 20, 1, 'k');
    px.rect(11, 15, 10, 5, 'm');
    px.rect(11, 15, 10, 1, 'k');
    px.rect(13, 17, 2, 2, 'k');
    px.rect(24, 17, 6, 3, 'r');
    px.rect(24, 17, 6, 1, 'q');
    for (const x of [25, 27, 29]) px.set(x, 18, 'w');
  },
  fuelDrums(px) {
    backdrop(px, 14, 105);
    // Red drums with hazard plates, one tipped over and leaking, and a match.
    for (const [x, y] of [[4, 14], [13, 14]] as const) {
      px.rect(x, y, 8, 13, 'r');
      px.rect(x, y, 8, 1, 'k');
      px.rect(x, y + 4, 8, 1, 'q');
      px.rect(x, y + 9, 8, 1, 'q');
      px.rect(x, y + 12, 8, 1, 'k');
      px.rect(x + 2, y + 5, 4, 3, 'w');
      px.set(x + 3, y + 6, 'k');
    }
    px.ellipse(26, 25, 5, 3, 'r');
    px.ellipse(26, 25, 3, 1.5, 'q');
    px.rect(21, 28, 10, 1, 'd');
    px.line(26, 12, 29, 18, 'k');
    px.set(26, 11, 'r');
    px.set(25, 10, 'q');
  },
  apresBar(px) {
    backdrop(px, 16, 107);
    // A chalet bar: a window glowing red, a sign with a mug, a bench and a fondue pot.
    px.rect(4, 12, 22, 14, (_x, y) => (y % 3 === 0 ? 'k' : y % 3 === 1 ? 'm' : 'd'));
    px.poly([[2, 13], [15, 5], [28, 13]], (x, y) => (y < 9 || x < 10 ? 'w' : 's'));
    px.line(2, 13, 15, 5, 'k');
    px.line(15, 5, 28, 13, 'k');
    px.rect(7, 16, 8, 5, 'r');
    px.rect(7, 16, 8, 1, 'k');
    px.rect(10, 16, 1, 5, 'k');
    px.rect(18, 15, 6, 6, 'w');
    px.rect(19, 16, 3, 4, 'r');
    px.rect(22, 17, 1, 2, 'k');
    px.rect(2, 27, 26, 1, 'k');
    px.ellipse(28, 26, 3, 2, 'k');
    smoke(px, 28, 23, 2, 2);
  },
  // --- Landscape -----------------------------------------------------------------------------
  glacier(px) {
    sky(px, 0, 0, S, 14);
    mountain(px, -6, 38, 22, 14, 3, { snow: 18, seed: 11, tones: ['w', 's', 'l', 'm'] });
    // A tongue of blue-white ice with crevasse lines, spilling into the valley.
    px.poly([[6, 14], [26, 14], [32, 32], [0, 32]], (x, y) => ((x * 2 + y) % 11 === 0 ? 'l' : y > 26 ? 's' : 'w'));
    for (const [x, y, l] of [[8, 20, 6], [15, 24, 8], [20, 18, 5], [5, 28, 7]] as const) px.line(x, y, x + l, y + 1, 'm');
    px.line(6, 14, 0, 32, 'd');
    px.line(26, 14, 32, 32, 'd');
  },
  cliff(px) {
    sky(px, 0, 0, S, S, 's', 'w');
    cloud(px, 8, 6, 10, 9);
    // A sheer dark face dropping away, a skier tucked right along its edge.
    px.poly([[14, 0], [32, 0], [32, 32], [20, 32], [17, 14]], (x, y) => ((x + y * 3) % 7 === 0 ? 'k' : x < 22 ? 'm' : 'd'));
    px.line(14, 0, 17, 14, 'k');
    px.line(17, 14, 20, 32, 'k');
    px.rect(0, 22, 18, 10, 'w');
    px.rect(0, 22, 18, 1, 'l');
    px.grid(SKIER, 8, 14);
  },
  aspens(px) {
    sky(px, 0, 0, S, 22);
    snowField(px, 0, 22, S, 10, 109);
    // White trunks with black eyes, and round pale crowns.
    for (const [x, h] of [[6, 18], [14, 22], [23, 17], [28, 20]] as const) {
      px.ellipse(x + 1, 31 - h, 4, 5, 'd');
      px.ellipse(x, 30 - h, 4, 5, (i, j) => (bayer(i, j, 6) ? 'm' : 'l'));
      px.rect(x, 30 - h + 3, 2, h - 3, 'w');
      px.rect(x - 1, 30 - h + 3, 1, h - 3, 'l');
      for (let y = 30 - h + 6; y < 29; y += 4) px.set(x + (y % 2), y, 'k');
    }
    px.rect(0, 30, S, 1, 'l');
  },
  hotSpring(px) {
    backdrop(px, 12, 111);
    pine(px, 4, 20, 10);
    pine(px, 28, 21, 11);
    // A steaming pool ringed with dark rocks.
    px.ellipse(16, 24, 13, 6, 'd');
    px.ellipse(16, 24, 11, 4.5, (x, y) => ((x + y) % 5 === 0 ? 'w' : 's'));
    for (const [x, y] of [[4, 22], [8, 27], [16, 29], [24, 27], [28, 22]] as const) px.ellipse(x, y, 2, 1.3, 'k');
    smoke(px, 12, 18, 3, 3);
    smoke(px, 20, 17, 3, 7);
  },
  frozenLake(px) {
    sky(px, 0, 0, S, 12);
    range(px, 0, S, 12, 8, 113);
    pine(px, 3, 16, 7);
    pine(px, 29, 17, 8);
    // A wide sheet of ice catching the light, and a skater's figure-eights.
    px.ellipse(16, 23, 17, 8, 'm');
    px.ellipse(16, 23, 15.5, 7, (x, y) => ((x - y) % 9 === 0 || (x - y) % 9 === 1 ? 'w' : 's'));
    px.ellipse(11, 23, 4, 2, (x, y) => (px.is(x, y, 'w') ? 'w' : null));
    for (let a = 0; a < 6.3; a += 0.2) {
      px.set(12 + Math.cos(a) * 4, 23 + Math.sin(a) * 1.6, 'l');
      px.set(20 + Math.cos(a) * 4, 23 + Math.sin(a) * 1.6, 'l');
    }
  },
  windRidge(px) {
    sky(px, 0, 0, S, S, 's', 'w');
    // A knife-edge ridge with snow blowing off it in streamers.
    mountain(px, -4, 40, 32, 18, 8, { snow: 14, seed: 17, lean: 0.4 });
    for (let k = 0; k < 6; k++) px.line(18 + k, 8 + k * 2, 32, 4 + k * 3, k % 2 ? 'w' : 'l');
    for (let k = 0; k < 8; k++) px.rect((k * 7) % 30, 2 + (k * 5) % 10, 3, 1, 'l');
  },
  hamlet(px) {
    backdrop(px, 13, 115);
    // A cluster of chalets with red shutters, smoke from two chimneys.
    const chalet = (x: number, y: number, w: number) => {
      px.rect(x, y, w, 9, 'w');
      px.rect(x, y, 1, 9, 'k');
      px.rect(x + w - 1, y, 1, 9, 'k');
      px.poly([[x - 2, y + 1], [x + w / 2, y - 6], [x + w + 1, y + 1]], (i, j) => (j < y - 2 || i < x + w / 2 ? 'w' : 's'));
      px.line(x - 2, y + 1, x + w / 2, y - 6, 'k');
      px.line(x + w / 2, y - 6, x + w + 1, y + 1, 'k');
      px.rect(x + 2, y + 3, 2, 3, 'r');
      px.rect(x + w - 4, y + 3, 2, 3, 'r');
    };
    chalet(3, 19, 10);
    chalet(18, 21, 11);
    chalet(10, 14, 9);
    smoke(px, 14, 6, 2, 3);
    smoke(px, 24, 12, 2, 5);
    px.rect(0, 30, S, 1, 'l');
  },
  // --- Weather and actions --------------------------------------------------------------------
  bluebird(px) {
    px.vgrad(0, 0, S, 20, 'l', 'w');
    px.disc(24, 7, 5, (x, y) => (bayer(x, y, 4) ? 's' : 'w'));
    px.disc(24, 7, 3, 'w');
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      px.set(24 + Math.cos(a) * 7, 7 + Math.sin(a) * 7, 'm');
    }
    mountain(px, -6, 40, 32, 12, 12, { snow: 10, seed: 19 });
    px.grid(SKIER, 4, 22);
    px.set(10, 21, 'r');
  },
  blizzard(px) {
    px.rect(0, 0, S, S, 'l');
    pine(px, 8, 30, 16, { fill: 'm', shade: 'd', edge: 'd' });
    pine(px, 24, 28, 12, { fill: 's', shade: 'l', edge: 'l' });
    for (let k = 0; k < 26; k++) px.line((k * 11) % 36 - 4, (k * 7) % 32, (k * 11) % 36 + 3, (k * 7) % 32 + 1, k % 3 ? 'w' : 's');
    px.rect(0, 0, S, S, (x, y) => (bayer(x + y, y, 3) ? 'w' : null));
  },
  supplyDrop(px) {
    sky(px, 0, 0, S, 22);
    snowField(px, 0, 22, S, 10, 117);
    // A crate swinging down under a red-and-white parachute.
    px.ellipse(16, 8, 11, 6, (x, y) => (y > 8 ? null : Math.floor(x / 3) % 2 ? 'r' : 'w'));
    px.line(5, 8, 27, 8, 'k');
    for (const x of [6, 11, 16, 21, 26]) px.line(x, 8, 16, 16, 'k');
    px.rect(12, 16, 9, 7, 'm');
    px.rect(12, 16, 9, 1, 'k');
    px.rect(12, 22, 9, 1, 'k');
    px.rect(15, 18, 3, 3, 'r');
    px.ellipse(16, 28, 5, 1, 'l');
  },
  pepTalk(px) {
    px.rect(0, 0, S, S, (x, y) => (bayer(x, y, 3) ? 's' : 'w'));
    // A coach with a megaphone and a speech burst.
    px.sprite('guard', 2, 12, { recolor: { w: 'r' } });
    px.poly([[14, 18], [20, 14], [20, 22]], 'k');
    px.rect(12, 17, 3, 2, 'k');
    px.poly([[20, 4], [31, 2], [30, 12], [24, 13]], 'w');
    px.line(20, 4, 31, 2, 'k');
    px.line(31, 2, 30, 12, 'k');
    px.line(30, 12, 24, 13, 'k');
    px.line(24, 13, 20, 4, 'k');
    px.rect(24, 5, 2, 4, 'r');
    px.rect(24, 10, 2, 1, 'r');
  },
  airstrike(px) {
    sky(px, 0, 0, S, 18, 'l', 's');
    snowField(px, 0, 18, S, 14, 119);
    // A plane overhead, a falling bomb, and a burst on the snow.
    px.rect(4, 4, 12, 2, 'k');
    px.rect(8, 2, 3, 6, 'k');
    px.rect(2, 3, 2, 2, 'k');
    px.rect(13, 9, 2, 3, 'k');
    px.set(13, 12, 'r');
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      px.line(20, 25, 20 + Math.cos(a) * (6 + (k % 2) * 3), 25 + Math.sin(a) * (4 + (k % 2) * 2), k % 2 ? 'r' : 'q');
    }
    px.disc(20, 25, 3, 'w');
  },
  intelBrief(px) {
    px.rect(0, 0, S, S, (x, y) => (bayer(x, y, 4) ? 'd' : 'k'));
    // An open folder: a map with a red X, a photo, and a TOP SECRET band.
    px.rect(3, 6, 26, 20, 'l');
    px.rect(3, 6, 26, 1, 'w');
    px.rect(16, 6, 1, 20, 'm');
    for (let k = 0; k < 4; k++) px.line(5, 10 + k * 4, 14, 9 + k * 4, 'm');
    px.line(7, 18, 11, 22, 'r');
    px.line(11, 18, 7, 22, 'r');
    px.rect(19, 9, 8, 9, 's');
    px.rect(21, 11, 4, 4, 'd');
    px.rect(18, 21, 10, 3, 'r');
    px.rect(19, 22, 8, 1, 'w');
  },
  catTrack(px) {
    backdrop(px, 10, 121);
    // A level track cut across the slope, and a snowcat crawling along it.
    px.rect(0, 18, S, 6, (x, y) => (x % 3 === 0 && y > 18 ? 's' : 'w'));
    px.rect(0, 17, S, 1, 'l');
    px.rect(0, 24, S, 1, 'm');
    px.rect(12, 12, 12, 5, 'r');
    px.rect(18, 9, 5, 3, 'k');
    px.rect(19, 10, 3, 1, 's');
    px.rect(10, 17, 16, 2, 'k');
    for (let x = 11; x < 26; x += 2) px.set(x, 18, 'm');
    px.rect(6, 14, 4, 3, 'l');
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
