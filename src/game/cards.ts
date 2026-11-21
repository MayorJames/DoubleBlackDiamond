// Cards build the mountain. Like Loop Hero's road, roadside and landscape tiles, each card
// goes on a particular kind of cell, and neighbours combine.

import { MAP_H, MAP_W } from './constants';
import { cell, isPath, isRoadside, neighbours, pathIndexAt, type LoopMap } from './map';

export type CardId =
  | 'patrol'
  | 'moguls'
  | 'kicker'
  | 'ice'
  | 'cabin'
  | 'sniper'
  | 'garage'
  | 'cache'
  | 'safehouse'
  | 'pines'
  | 'boulder'
  | 'peak'
  | 'powder'
  | 'avalanche';

/** Where a card can go: on the trail, beside the path, any open snow, or on a placed tile. */
export type CardKind = 'trail' | 'roadside' | 'landscape' | 'special';

export interface CardDef {
  id: CardId;
  name: string;
  kind: CardKind;
  text: string;
  flavor: string;
  /** How likely it is to be drawn. */
  weight: number;
  /** How much it fills the boss meter. */
  boss: number;
}

const def = (id: CardId, name: string, kind: CardKind, weight: number, boss: number, text: string, flavor: string): CardDef => ({
  id,
  name,
  kind,
  weight,
  boss,
  text,
  flavor,
});

export const CARDS: Record<CardId, CardDef> = {
  patrol: def('patrol', 'Patrol Post', 'trail', 3, 1, 'A guard now, and another every 2 days (up to 3).', 'Papers, please. Also, skis.'),
  moguls: def('moguls', 'Mogul Field', 'trail', 2, 1, 'Slows you to 70%. +12 chips each pass, +0.3 mult if you tuck through.', 'Knees optional.'),
  kicker: def('kicker', 'Kicker', 'trail', 2, 1, "Airborne here: you can't be hit, or shoot. +25 chips, +0.5 mult.", 'Send it.'),
  ice: def('ice', 'Ice Sheet', 'trail', 2, 1, 'Speed x1.6 here, but your aim is x0.6.', 'Groomed by a zamboni with a grudge.'),
  cabin: def('cabin', 'Guard Cabin', 'roadside', 2, 1, 'Every 3 days a guard walks out onto the trail next door.', 'Smoke from the chimney. Bullets from the window.'),
  sniper: def('sniper', 'Sniper Nest', 'roadside', 2, 2, 'A sniper fires from 2.5 tiles away. He comes back 3 days after you drop him.', 'Watch for the red glint.'),
  garage: def('garage', 'Snowmobile Garage', 'roadside', 1, 2, 'Every 3 days a snowmobile chases you round the loop.', 'Two-stroke, two goons.'),
  cache: def('cache', 'Supply Cache', 'roadside', 2, 1, 'Ski past to heal 20%, once a lap. +10 chips.', 'Hot cocoa and bandages.'),
  safehouse: def('safehouse', 'Safehouse', 'roadside', 1, 1, 'Ski past to draw a card and pick up 1 intel, once a lap.', 'The doormat says GO AWAY.'),
  pines: def('pines', 'Pine Grove', 'landscape', 3, 1, '+3% dodge. Every trail tile beside it pays 4 chips for the graze.', 'Close shaves pay.'),
  boulder: def('boulder', 'Boulder', 'landscape', 3, 1, '+4 max HP.', "It's a rock."),
  peak: def('peak', 'Peak', 'landscape', 2, 1, '+8 max HP. Fill a 3x3 with peaks and boulders for a Double Black Diamond.', 'Experts only.'),
  powder: def('powder', 'Powder Field', 'landscape', 2, 1, 'Heals 3 HP a day, +1 for each pine grove beside it.', 'Face shots for days.'),
  avalanche: def('avalanche', 'Avalanche', 'special', 1, 0, 'Wipes out a placed tile and everything on and around it.', 'Not the snow you ordered.'),
};

export const CARD_IDS = Object.keys(CARDS) as CardId[];

/** What a placed card has become: part of a Double Black Diamond, or its centre. */
export type TileVariant = 'dbd' | 'dbdPart' | null;

export interface TileState {
  card: CardId;
  /** Days until the tile next does its thing (spawns, respawns). */
  timer: number;
  /** Lap this tile last paid out (caches, safehouses). */
  lastLap: number;
  variant: TileVariant;
}

export type Tiles = (TileState | null)[];

export const newTiles = (): Tiles => new Array(MAP_W * MAP_H).fill(null);

/** Whether `card` can go on cell (x, y) right now. */
export function canPlace(map: LoopMap, tiles: Tiles, card: CardId, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  const placed = tiles[cell(x, y)];
  const kind = CARDS[card].kind;
  if (kind === 'special') return !!placed;
  if (placed) return false;
  if (kind === 'trail') {
    const i = pathIndexAt(map, x, y);
    return i >= 0 && map.path[i].kind === 'trail';
  }
  if (kind === 'roadside') return isRoadside(map, x, y);
  return !isPath(map, x, y);
}

const isMountain = (t: TileState | null) => !!t && (t.card === 'boulder' || t.card === 'peak');

/** Re-marks every Double Black Diamond: a 3x3 of peaks and boulders with at least one peak. */
export function markDoubleBlacks(tiles: Tiles): void {
  for (const t of tiles) if (t) t.variant = null;
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      const block: TileState[] = [];
      let ok = true;
      for (let dy = -1; dy <= 1 && ok; dy++)
        for (let dx = -1; dx <= 1 && ok; dx++) {
          const t = tiles[cell(x + dx, y + dy)];
          if (!isMountain(t) || t!.variant) ok = false;
          else block.push(t!);
        }
      if (!ok || !block.some((t) => t.card === 'peak')) continue;
      for (const t of block) t.variant = 'dbdPart';
      tiles[cell(x, y)]!.variant = 'dbd';
    }
  }
}

/** Number of neighbouring cells holding `card`. */
export function countAround(tiles: Tiles, x: number, y: number, card: CardId): number {
  let n = 0;
  for (const [nx, ny] of neighbours(x, y)) if (tiles[cell(nx, ny)]?.card === card) n++;
  return n;
}
