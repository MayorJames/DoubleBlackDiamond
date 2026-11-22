// Icons for the course tiles in the mountain builder and the town's tile yard. Special tiles
// borrow their card's illustration; trail tiles and the remove tool get their own.

import type { CourseTile } from '../../game/mountain';
import { cardArtUrl } from './cardArt';
import { bayer, Px } from './pixel';
import { snowField } from './scenery';

export type BuilderTool = CourseTile | 'remove';

const CARD_FOR: Partial<Record<BuilderTool, Parameters<typeof cardArtUrl>[0]>> = {
  lift: 'chairlift',
  chute: 'chute',
  jump: 'kicker',
  gates: 'gates',
  tunnel: 'tunnel',
  checkpoint: 'checkpoint',
  blackRun: 'blackRun',
};

const cache = new Map<string, string>();

/** A fork of groomed trail: the main run, and a new path peeling off it. */
function trailIcon(px: Px): void {
  snowField(px, 0, 0, 32, 32, 71);
  const band = (x: number, y: number, w: number, h: number, across: boolean) => {
    px.rect(x, y, w, h, (i, j) => ((across ? j % 3 === 0 : i % 3 === 0) ? 's' : 'w'));
  };
  band(2, 4, 10, 26, false);
  px.rect(1, 4, 1, 26, 'l');
  px.rect(12, 4, 1, 26, 'l');
  band(12, 12, 16, 8, true);
  band(20, 20, 8, 10, false);
  px.rect(12, 11, 17, 1, 'l');
  px.rect(28, 12, 1, 18, 'l');
  px.rect(13, 20, 7, 1, 'l');
  px.rect(19, 20, 1, 10, 'l');
  // A red trail marker at the fork.
  px.rect(14, 6, 1, 6, 'k');
  px.rect(15, 6, 4, 3, 'r');
  px.rect(15, 6, 4, 1, 'q');
}

/** The remove tool: a shovel over a red X. */
function removeIcon(px: Px): void {
  px.rect(0, 0, 32, 32, (x, y) => (bayer(x, y, 2) ? 's' : 'w'));
  for (let k = 4; k < 28; k++) {
    px.rect(k, k, 2, 2, 'r');
    px.rect(31 - k, k, 2, 2, 'r');
  }
  px.line(9, 24, 22, 7, 'k');
  px.line(10, 24, 23, 7, 'd');
  px.rect(20, 4, 6, 2, 'k');
  px.poly([[5, 23], [11, 29], [7, 31], [2, 27]], 'm');
  px.line(5, 23, 11, 29, 'k');
  px.line(2, 27, 7, 31, 'k');
}

/** The icon for a builder tool or course tile, as a crisp image URL. */
export function courseIconUrl(tool: BuilderTool, scale: number): string {
  const card = CARD_FOR[tool];
  if (card) return cardArtUrl(card, scale);
  const key = `${tool}@${scale}`;
  let url = cache.get(key);
  if (!url) {
    const px = new Px(32, 32);
    if (tool === 'trail') trailIcon(px);
    else removeIcon(px);
    url = px.url(scale);
    cache.set(key, url);
  }
  return url;
}
