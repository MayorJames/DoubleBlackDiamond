// The rules page: one panel per mechanic, each with a little pixel scene (128x64) built from the
// game's own sprites and scenery, so the guide looks like the game.

import { bayer, Px } from './pixel';
import { blackDiamond, flakes, mountain, pine, range, sky, snowField } from './scenery';

export const VIG_W = 128;
export const VIG_H = 64;

export interface Rule {
  title: string;
  text: string;
  draw: (px: Px) => void;
}

/** A groomed trail band across the scene, with corduroy. */
function trail(px: Px, y: number, h: number, x0 = 0, x1 = VIG_W): void {
  px.rect(x0, y, x1 - x0, h, (x, j) => ((j - y) % 3 === 0 && x % 5 !== 0 ? 's' : 'w'));
  px.rect(x0, y - 1, x1 - x0, 1, 'l');
  px.rect(x0, y + h, x1 - x0, 1, 'l');
}

function ground(px: Px, horizon: number, seed: number): void {
  sky(px, 0, 0, VIG_W, horizon);
  range(px, 0, VIG_W, horizon, horizon * 0.6, seed, { tones: ['w', 's', 'l', 'm'] });
  snowField(px, 0, horizon, VIG_W, VIG_H - horizon, seed);
}

/** A dotted placement frame around a 16px tile. */
function dotted(px: Px, x: number, y: number, c = 'd'): void {
  for (let k = 0; k < 16; k += 2) {
    px.set(x + k, y, c);
    px.set(x + k, y + 15, c);
    px.set(x, y + k, c);
    px.set(x + 15, y + k, c);
  }
}

/** A tiny card: a frame, a kind band, and a price tag. */
function miniCard(px: Px, x: number, y: number, band: string, price: boolean): void {
  px.rect(x, y, 18, 24, 'w');
  px.rect(x, y, 18, 1, 'k');
  px.rect(x, y + 23, 18, 1, 'k');
  px.rect(x, y, 1, 24, 'k');
  px.rect(x + 17, y, 1, 24, 'k');
  px.rect(x + 1, y + 1, 16, 3, band);
  if (price) px.rect(x + 1, y + 19, 16, 4, 'r');
}

export const RULES: Rule[] = [
  {
    title: 'Ski the loop',
    text: 'Your spy skis the mountain on their own: up the lift, down the trail, home to the lodge. You steer the speed with W and S. Tuck is fast, hard to hit and builds mult, but your aim is poor. Snowplow is slow and steady, but you are a sitting duck.',
    draw(px) {
      ground(px, 22, 3);
      trail(px, 34, 22);
      px.sprite('heroDownPlow', 14, 36);
      px.sprite('heroDown', 56, 36);
      px.sprite('heroDownTuck', 98, 36);
      for (let k = 0; k < 3; k++) px.rect(100 + k * 5, 30 - k, 1, 4, 'l');
      px.rect(13, 54, 3, 1, 'w');
      px.rect(27, 54, 3, 1, 'w');
    },
  },
  {
    title: 'Build it with cards',
    text: 'Place cards from your hand: trail cards on the run, roadside cards beside it, landscape cards on open snow. Neighbours combine. Pines beside the trail pay for every graze; a 3x3 of peaks and boulders becomes a Double Black Diamond. Picking up a card pauses the slope.',
    draw(px) {
      ground(px, 14, 8);
      trail(px, 26, 14);
      px.sprite('patrol', 40, 25);
      px.sprite('pines', 60, 8);
      px.sprite('pines', 76, 8);
      px.sprite('boulder', 20, 44);
      px.sprite('peak', 92, 44);
      dotted(px, 56, 44, 'r');
      dotted(px, 72, 44);
      px.sprite('heroSide', 6, 22);
    },
  },
  {
    title: 'Enemies every descent',
    text: 'Each lap brings its own wave, and every enemy card you have placed rolls how many to send and where at the start of every descent. Guards hold the trail, snipers sit in nests, sappers mine it, medics patch up their friends, and snowmobiles and hounds chase you down.',
    draw(px) {
      ground(px, 16, 12);
      trail(px, 30, 20);
      px.sprite('guard', 18, 30);
      px.sprite('sapper', 44, 28);
      px.sprite('medic', 62, 30);
      px.sprite('hound', 82, 34);
      px.sprite('snowmobile', 100, 32);
      px.sprite('sniperNest', 4, 8);
      px.sprite('sniper', 4, 6);
    },
  },
  {
    title: 'Points and the shop',
    text: 'Kills, grazes, jumps and supplies earn chips, and every chip pays chips times your current mult in points. Build mult first (tuck, combos, chained descents), then cash in. Spend points in the shop beside your hand: buying a card rerolls all three.',
    draw(px) {
      px.rect(0, 0, VIG_W, VIG_H, (x, y) => (bayer(x, y, 2) ? 's' : 'w'));
      // Chips x mult = points.
      px.rect(6, 10, 24, 16, 'k');
      px.rect(9, 15, 18, 2, 'w');
      px.rect(9, 19, 12, 2, 'w');
      px.rect(34, 16, 4, 4, 'k');
      px.rect(42, 10, 24, 16, 'r');
      px.rect(45, 15, 18, 2, 'w');
      px.rect(45, 19, 10, 2, 'w');
      px.rect(70, 15, 5, 2, 'k');
      px.rect(70, 19, 5, 2, 'k');
      px.rect(80, 10, 40, 16, 'w');
      px.rect(80, 10, 40, 1, 'k');
      px.rect(80, 25, 40, 1, 'k');
      px.rect(80, 10, 1, 16, 'k');
      px.rect(119, 10, 1, 16, 'k');
      px.rect(84, 15, 26, 2, 'r');
      px.rect(84, 19, 18, 2, 'r');
      // The shop: three cards, one being bought.
      miniCard(px, 28, 34, 'k', true);
      miniCard(px, 52, 32, 'm', true);
      miniCard(px, 76, 34, 'r', false);
      px.rect(52, 30, 18, 1, 'r');
      px.rect(56, 40, 10, 8, 'l');
    },
  },
  {
    title: 'Routes and junctions',
    text: 'Lifts, chutes and paths branch off the trail. At each junction a red rope closes the way you will not go: click the junction (or press R) to switch. A route that leads back up the mountain is another descent: +1 mult, and every enemy card sends again, a level tougher.',
    draw(px) {
      ground(px, 10, 15);
      trail(px, 14, 10, 0, 96);
      trail(px, 46, 10, 30, VIG_W);
      px.rect(86, 14, 10, 42, (x, y) => ((y - 14) % 3 === 0 && x % 5 !== 0 ? 's' : 'w'));
      // A lift climbing from the lower trail to the upper one.
      px.rect(44, 18, 1, 28, 'k');
      px.rect(49, 18, 1, 28, 'k');
      for (const y of [24, 34]) {
        px.rect(46, y, 2, 8, 'd');
        px.rect(42, y, 10, 1, 'k');
      }
      px.sprite('chair', 42, 28);
      // The junction rope across the lift's foot.
      for (let k = 0; k < 12; k++) px.set(40 + k, 44, k % 4 < 2 ? 'r' : 'w');
      px.rect(40, 43, 1, 3, 'k');
      px.rect(51, 43, 1, 3, 'k');
      px.sprite('heroSide', 56, 40, { flip: true });
    },
  },
  {
    title: 'Your mountain',
    text: 'Between expeditions, build your home mountain with course tiles in The Mountain tab. Lay trail paths in any shape, even back uphill, and add lifts, chutes, jumps, gates, tunnels and checkpoints. How hard it is comes from what is on it, and harder mountains pay richer bounties.',
    draw(px) {
      px.rect(0, 0, VIG_W, VIG_H, 'w');
      for (let x = 0; x < VIG_W; x += 8) for (let y = 0; y < VIG_H; y += 8) px.set(x, y, 'l');
      trail(px, 6, 10, 8, 120);
      px.rect(110, 6, 10, 52, (x) => ((x - 110) % 3 === 0 ? 's' : 'w'));
      trail(px, 48, 10, 8, 120);
      // A new path being laid in red dots, doubling back up.
      const pts: [number, number][] = [[24, 53], [24, 32], [60, 32], [60, 16]];
      for (let k = 0; k + 1 < pts.length; k++) {
        const [ax, ay] = pts[k];
        const [bx, by] = pts[k + 1];
        const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
        for (let s = 0; s <= n; s += 3) px.rect(Math.round(ax + ((bx - ax) * s) / n), Math.round(ay + ((by - ay) * s) / n), 2, 2, 'r');
      }
      px.sprite('gates', 72, 3);
      px.sprite('blackRun', 88, 42);
      px.sprite('kicker', 40, 44);
    },
  },
  {
    title: 'Home with the haul',
    text: 'Every lap ends at the lodge, where its bounties bank. Ride again, or call it a day and keep everything. Bail out mid-lap and keep 60%; wipe out and the ski patrol saves 30%. Spend it all in town: buildings unlock cards and course tiles for every expedition after.',
    draw(px) {
      ground(px, 24, 21);
      pine(px, 10, 50, 18);
      pine(px, 116, 52, 20);
      px.sprite('lodge', 48, 34);
      px.sprite('heroDown', 70, 38);
      // Cash bundles stacked by the door.
      for (const [x, y] of [[88, 46], [96, 46], [92, 41]] as const) {
        px.rect(x, y, 8, 5, 'r');
        px.rect(x, y, 8, 1, 'k');
        px.rect(x + 3, y + 1, 2, 3, 'w');
      }
    },
  },
  {
    title: 'Bosses and dossiers',
    text: 'Every card you place fills the Baron meter. Fill it and the Avalanche Baron comes down from the summit for you: beat him to win the expedition and earn a black run sign. From lap 2, intel fragments drop; three make a dossier that summons a boss with a one-of-a-kind reward.',
    draw(px) {
      sky(px, 0, 0, VIG_W, VIG_H, 'l', 's');
      mountain(px, 20, 120, 60, 70, 4, { snow: 16, seed: 9 });
      // The Baron, big, and a dossier folder stamped red.
      px.blit(scaledSprite('baron'), 54, 22);
      px.rect(6, 22, 30, 36, 'd');
      px.rect(8, 26, 26, 30, 'l');
      px.rect(8, 26, 26, 1, 'w');
      px.rect(11, 30, 12, 14, 's');
      px.sprite('widow', 9, 29);
      px.rect(22, 47, 10, 6, 'r');
      blackDiamond(px, 118, 6, 3);
    },
  },
  {
    title: 'Weather',
    text: 'Weather cards cover the whole mountain for this lap and the next. A whiteout cuts how far everyone can see but pays double for kills and grazes. Night spoils everyone\'s aim, yours a little and theirs a lot, and loot drops half as often again.',
    draw(px) {
      // Left half night, right half whiteout.
      px.vgrad(0, 0, 64, 40, 'k', 'd');
      px.disc(48, 10, 5, 'w');
      flakes(px, 0, 0, 64, 30, 10, 5, 'w');
      mountain(px, -10, 70, 44, 30, 18, { tones: ['l', 'm', 'd', 'k'], snow: 6, seed: 3 });
      px.rect(0, 44, 64, 20, (x, y) => (bayer(x, y, 6) ? 'm' : 'd'));
      px.rect(64, 0, 64, 64, 'w');
      pine(px, 80, 52, 18, { fill: 'l', shade: 'm', edge: 'm' });
      pine(px, 108, 56, 22, { fill: 's', shade: 'l', edge: 'l' });
      px.rect(64, 0, 64, 64, (x, y) => (bayer(x + Math.floor(y / 3), y, 5) ? 'w' : null));
      flakes(px, 64, 0, 64, 64, 18, 9, 'l');
      px.sprite('heroDown', 24, 46);
      px.rect(64, 0, 1, 64, 'k');
    },
  },
];

/** A sprite at double size, for a boss looming in a vignette. */
function scaledSprite(name: 'baron'): Px {
  const small = new Px(16, 16);
  small.sprite(name, 0, 0);
  const big = new Px(32, 32);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if (!small.opaque(x, y)) continue;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) big.blit(pixelAt(small, x, y), x * 2 + dx, y * 2 + dy);
    }
  return big;
}

/** One pixel of a drawing, as a 1x1 drawing (for scaling up by blitting). */
function pixelAt(src: Px, x: number, y: number): Px {
  const one = new Px(1, 1);
  one.blit(src, -x, -y);
  return one;
}

const cache = new Map<string, string>();

export function vignetteUrl(index: number, scale: number): string {
  const key = `${index}@${scale}`;
  let url = cache.get(key);
  if (!url) {
    const px = new Px(VIG_W, VIG_H);
    RULES[index].draw(px);
    url = px.url(scale);
    cache.set(key, url);
  }
  return url;
}
