// Cards build the mountain. Like Loop Hero's road, roadside and landscape tiles, each card
// goes on a particular kind of cell, and neighbours combine. Route cards change the shape of
// the mountain itself: lifts and chutes that branch off the trail.

import { MAP_H, MAP_W } from './constants';
import { cell, isPath, isPiste, isRoadside, neighbours, nodeAt, routeCourse, type MountainMap, type StraightRoute } from './map';

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
  | 'avalanche'
  | 'yetiCave'
  | 'demoShack'
  | 'fieldHospital'
  | 'kennel'
  | 'mine'
  | 'gates'
  | 'tunnel'
  | 'checkpoint'
  | 'blackRun'
  | 'rail'
  | 'corduroy'
  | 'crevasse'
  | 'powderStash'
  | 'waxStation'
  | 'ammoDump'
  | 'watchtower'
  | 'firstAid'
  | 'jammer'
  | 'deadDrop'
  | 'scrapYard'
  | 'ticketBooth'
  | 'fuelDrums'
  | 'apresBar'
  | 'glacier'
  | 'cliff'
  | 'aspens'
  | 'hotSpring'
  | 'frozenLake'
  | 'windRidge'
  | 'hamlet'
  | 'bluebird'
  | 'blizzard'
  | 'supplyDrop'
  | 'pepTalk'
  | 'airstrike'
  | 'intelBrief'
  | 'catTrack'
  | 'chairlift'
  | 'chute'
  | 'whiteout'
  | 'night'
  | 'dossierWidow'
  | 'dossierYetiKing'
  | 'dossierKickback';

/**
 * Where a card can go: on the trail, beside the path, any open snow, on a placed tile, or (for
 * routes) on a trail tile with a clear line straight up or down to more trail.
 */
export type CardKind = 'trail' | 'roadside' | 'landscape' | 'special' | 'route' | 'boss' | 'weather' | 'action';

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
  /** Base price in the shop, in card points (it rises a little each lap). */
  cost: number;
}

const def = (id: CardId, name: string, kind: CardKind, weight: number, boss: number, cost: number, text: string, flavor: string): CardDef => ({
  id,
  name,
  kind,
  weight,
  boss,
  cost,
  text,
  flavor,
});

/** Dossier cards: assembled from intel fragments, never drawn from a deck or sold. */
const dossier = (id: CardId, name: string, text: string, flavor: string): CardDef => def(id, name, 'boss', 0, 3, 0, text, flavor);
export const CARDS: Record<CardId, CardDef> = {
  patrol: def('patrol', 'Patrol Post', 'trail', 3, 1, 30, 'A guard now, and 1-2 more at the start of every descent (up to 3 here).', 'Papers, please. Also, skis.'),
  moguls: def('moguls', 'Mogul Field', 'trail', 2, 1, 35, 'Slows you to 70%. +12 chips each pass, +0.3 mult if you tuck through.', 'Knees optional.'),
  kicker: def('kicker', 'Kicker', 'trail', 2, 1, 50, "Airborne here: you can't be hit, or shoot. +25 chips, +0.5 mult.", 'Send it.'),
  ice: def('ice', 'Ice Sheet', 'trail', 2, 1, 35, 'Speed x1.6 here, but your aim is x0.6.', 'Groomed by a zamboni with a grudge.'),
  cabin: def('cabin', 'Guard Cabin', 'roadside', 2, 1, 35, 'Every descent, up to 2 guards walk out onto the trail within 2 tiles.', 'Smoke from the chimney. Bullets from the window.'),
  sniper: def('sniper', 'Sniper Nest', 'roadside', 2, 2, 45, 'A sniper fires from 2.5 tiles away. Drop him and another takes his place next descent.', 'Watch for the red glint.'),
  garage: def('garage', 'Snowmobile Garage', 'roadside', 1, 2, 50, 'Every descent, a snowmobile (sometimes two) chases you round the mountain.', 'Two-stroke, two goons.'),
  cache: def('cache', 'Supply Cache', 'roadside', 2, 1, 55, 'Ski past to heal 20%, once a lap. +10 chips.', 'Hot cocoa and bandages.'),
  safehouse: def('safehouse', 'Safehouse', 'roadside', 1, 1, 70, 'Ski past to draw a card and pick up 1 intel, once a lap.', 'The doormat says GO AWAY.'),
  pines: def('pines', 'Pine Grove', 'landscape', 3, 1, 40, '+3% dodge. Every trail tile beside it pays 4 chips for the graze.', 'Close shaves pay.'),
  boulder: def('boulder', 'Boulder', 'landscape', 3, 1, 35, '+4 max HP.', "It's a rock."),
  peak: def('peak', 'Peak', 'landscape', 2, 1, 55, '+8 max HP. Fill a 3x3 with peaks and boulders for a Double Black Diamond.', 'Experts only.'),
  powder: def('powder', 'Powder Field', 'landscape', 2, 1, 55, 'Heals 8 HP at the start of every lap, +2 for each pine grove beside it.', 'Face shots for days.'),
  yetiCave: def(
    'yetiCave',
    'Yeti Cave',
    'landscape',
    1,
    2,
    60,
    'Most descents a yeti lumbers down to the nearest trail, two at a time at most. Huge, slow and worth a fortune.',
    'Something in there is humming.',
  ),
  demoShack: def(
    'demoShack',
    'Demo Shack',
    'roadside',
    1,
    2,
    55,
    "A sapper lobs grenades from 2 tiles and plants a mine on the trail nearby every 7 seconds. Mines hurt unless you're airborne. Drop him and another comes next descent.",
    'Do not knock.',
  ),
  fieldHospital: def(
    'fieldHospital',
    'Field Hospital',
    'roadside',
    1,
    2,
    50,
    'A turncoat medic patches up every enemy within 2 tiles every 3 seconds. Shoot him first. Drop him and another comes next descent.',
    'Ski patrol, but for the other side.',
  ),
  kennel: def('kennel', 'Kennel', 'roadside', 2, 1, 40, 'Every descent, 2-3 hounds chase you down the mountain. Fast, fragile, and they bite.', 'Who let them out?'),
  mine: def('mine', 'Mine', 'trail', 0, 0, 0, "Planted by a sapper. Hits hard when you ski over it, unless you're airborne.", 'Tick. Tick.'),
  gates: def('gates', 'Slalom Gates', 'trail', 2, 1, 45, 'Tuck through for +0.5 mult and 10 chips; any other way, just the chips.', 'Red, blue, red, blue, tree.'),
  tunnel: def('tunnel', 'Snow Tunnel', 'trail', 1, 1, 60, "Inside, nobody can see anybody: you can't be shot and you can't shoot. +6 chips.", 'Dark, quiet, and full of icicles.'),
  checkpoint: def(
    'checkpoint',
    'Checkpoint',
    'trail',
    2,
    2,
    35,
    'A guard now, and 1-3 more every descent (up to 3 here). Built on your mountain, it makes the mountain harder and its bounties richer.',
    'Show your lift pass.',
  ),
  blackRun: def(
    'blackRun',
    'Black Run Sign',
    'trail',
    0,
    0,
    0,
    'Experts only: each sign on your mountain makes it a step harder, with tougher enemies and richer bounties. Tuck past for 15 chips and +0.3 mult.',
    'You were warned.',
  ),
  // --- Trail -------------------------------------------------------------------------------------
  rail: def('rail', 'Grind Rail', 'trail', 2, 1, 45, "Grind it: you're airborne on this tile (no shots either way), your combo goes up by 1, and +15 chips.", 'Boardslide, but make it espionage.'),
  corduroy: def('corduroy', 'Fresh Corduroy', 'trail', 3, 1, 25, 'Freshly groomed: speed x1.3 here with no hit to your aim. +3 chips.', 'The snowcat came through at dawn.'),
  crevasse: def(
    'crevasse',
    'Crevasse',
    'trail',
    1,
    1,
    40,
    "Ski into it and it hurts (10, more on later descents). Fly over it off a kicker on the tile before for +40 chips and +0.5 mult. It's still there next lap.",
    'Mind the gap.',
  ),
  powderStash: def('powderStash', 'Powder Stash', 'trail', 2, 1, 40, 'Slows you to 80%, but heals 5 HP every pass.', 'Bottomless. Probably.'),
  waxStation: def('waxStation', 'Wax Station', 'trail', 2, 1, 50, 'Every pass waxes your skis: +6% speed for the rest of the lap. It stacks.', 'Hot wax, cold war.'),
  // --- Roadside ----------------------------------------------------------------------------------
  ammoDump: def('ammoDump', 'Ammo Dump', 'roadside', 2, 1, 50, 'Within a tile of it you fire 30% faster.', 'Help yourself.'),
  watchtower: def('watchtower', 'Watchtower', 'roadside', 2, 1, 45, 'Within a tile of it your range is 0.6 tiles longer.', 'You can see the lodge from here.'),
  firstAid: def('firstAid', 'First Aid Post', 'roadside', 2, 1, 45, 'Within a tile of it you heal 2 HP a second.', 'Plasters, splints, sympathy.'),
  jammer: def('jammer', 'Radio Jammer', 'roadside', 1, 1, 55, 'Enemies within 1.5 tiles of it lose a quarter of their aim.', 'All they hear is polka.'),
  deadDrop: def('deadDrop', 'Dead Drop', 'roadside', 1, 1, 60, 'Ski past once a lap for +1 intel, and from lap 2 a half chance of an intel fragment.', 'Under the third rock from the left.'),
  scrapYard: def('scrapYard', 'Scrap Yard', 'roadside', 2, 1, 40, 'Ski past once a lap for +2 scrap.', 'One spy’s junk.'),
  ticketBooth: def('ticketBooth', 'Ticket Booth', 'roadside', 2, 1, 35, 'Ski past once a lap for +25 points (more on later laps).', 'Lift passes, cash only.'),
  fuelDrums: def('fuelDrums', 'Fuel Drums', 'roadside', 1, 1, 50, 'Anything killed within a tile of it explodes, hitting everything within a tile for 12.', 'Highly flammable. Highly useful.'),
  apresBar: def('apresBar', 'Après Bar', 'roadside', 1, 1, 55, 'Ski past once a lap for +0.5 mult this lap.', 'Fondue, then fisticuffs.'),
  // --- Landscape ---------------------------------------------------------------------------------
  glacier: def('glacier', 'Glacier', 'landscape', 2, 1, 45, '+5 max HP and +1 defense.', 'It moves. Slowly. Like the plot.'),
  cliff: def('cliff', 'Cliff Face', 'landscape', 2, 1, 45, '+6 max HP. Tuck past it on the trail beside for +5 chips a tile.', 'Exposure: the good kind.'),
  aspens: def('aspens', 'Aspen Stand', 'landscape', 2, 1, 35, '+2% crit. Trail beside it pays 2 chips a tile for the graze.', 'Quaking, as one does.'),
  hotSpring: def('hotSpring', 'Hot Spring', 'landscape', 2, 1, 50, 'Ski the trail beside it to heal 4 HP a tile.', 'Steam, and suspicious bubbles.'),
  frozenLake: def('frozenLake', 'Frozen Lake', 'landscape', 2, 1, 40, '+4% speed.', 'Smooth as a cover story.'),
  windRidge: def('windRidge', 'Wind Ridge', 'landscape', 1, 1, 45, '+2% dodge. Kickers and rails beside it pay double chips.', 'The wind does the work.'),
  hamlet: def('hamlet', 'Alpine Hamlet', 'landscape', 1, 1, 70, 'Everything in the shop costs 8% less (up to 32% with four).', 'The locals know a guy.'),
  // --- Weather and actions -----------------------------------------------------------------------
  bluebird: def(
    'bluebird',
    'Bluebird Day',
    'weather',
    1,
    1,
    60,
    'For this lap and the next: you aim 20% better and ski 10% faster, but enemies can see you 20% further.',
    'Not a cloud in the sky. Not a place to hide.',
  ),
  blizzard: def(
    'blizzard',
    'Blizzard',
    'weather',
    1,
    1,
    60,
    'For this lap and the next: everyone skis 25% slower and enemies fire 25% slower. Chips pay half as much again.',
    'Sideways snow. Sideways everything.',
  ),
  supplyDrop: def('supplyDrop', 'Supply Drop', 'action', 2, 0, 45, 'Click anywhere: heal 35% of your max HP right now.', 'Parachute not included.'),
  pepTalk: def('pepTalk', 'Pep Talk', 'action', 2, 0, 50, 'Click anywhere: +1 mult for the rest of this lap.', '"You are the best spy on this mountain."'),
  airstrike: def('airstrike', 'Airstrike', 'action', 1, 1, 70, 'Click a tile: 30 damage to every enemy within a tile of it.', 'Danger close.'),
  intelBrief: def('intelBrief', 'Intel Briefing', 'action', 1, 0, 55, 'Click anywhere: +2 intel and an intel fragment.', 'Burn after reading.'),
  catTrack: def(
    'catTrack',
    'Cat Track',
    'route',
    1,
    1,
    70,
    'Lays a path from this trail tile in a straight line over open snow to the next trail: a shortcut, or a slow skate back uphill for another descent.',
    'Built for snowcats. Used by spies.',
  ),
  avalanche: def('avalanche', 'Avalanche', 'special', 1, 0, 40, 'Wipes out a placed tile and everything on and around it.', 'Not the snow you ordered.'),
  chairlift: def(
    'chairlift',
    'Chairlift',
    'route',
    1,
    2, 120,
    'Builds a lift from this trail tile up to the trail above. Ride it to chain another descent before the lodge: +1 mult each time. Two lifts at most.',
    'Lower the safety bar. Raise the stakes.',
  ),
  chute: def(
    'chute',
    'Chute',
    'route',
    2,
    1, 80,
    'Cuts a steep chute from this trail tile down to the trail below. Very fast, +0.2 mult a tile, and it skips everything in between.',
    'Scraped clean by the brave and the stupid.',
  ),
  whiteout: def(
    'whiteout',
    'Whiteout',
    'weather',
    1,
    1, 65,
    'For this lap and the next, everyone can only see 60% as far: you and them. Kills and grazes pay double chips.',
    'You can hear them. You just cannot see them.',
  ),
  night: def(
    'night',
    'Night',
    'weather',
    1,
    1, 65,
    'For this lap and the next, enemies hit 40% less often and your aim drops 15%. Cards and gear drop half as often again.',
    'Black jacket optional.',
  ),
  dossierWidow: dossier(
    'dossierWidow',
    'Dossier: Ice Widow',
    'Summons The Ice Widow on this trail tile. She freezes the trail around her and shoots from far off. Beat her for her Monocle.',
    'Cold hands. Colder aim.',
  ),
  dossierYetiKing: dossier(
    'dossierYetiKing',
    'Dossier: Yeti King',
    'Summons The Yeti King on this trail tile. He calls a yeti down every ten seconds he lives. Beat him for the Yeti Pelt.',
    'Long may he roar.',
  ),
  dossierKickback: dossier(
    'dossierKickback',
    'Dossier: Kickback',
    'Summons Captain Kickback here, on a rocket sled that laps the mountain fast. Beat him for the Getaway Sled.',
    'He has never once used the brakes.',
  ),
};

/** The boss each dossier summons. */
export const BOSS_OF: Partial<Record<CardId, 'widow' | 'yetiKing' | 'kickback'>> = {
  dossierWidow: 'widow',
  dossierYetiKing: 'yetiKing',
  dossierKickback: 'kickback',
};

/** Lifts you can build on one mountain. */
export const MAX_LIFTS = 2;

/** The kind of route a route card builds. */
export const ROUTE_OF: Partial<Record<CardId, StraightRoute>> = { chairlift: 'lift', chute: 'chute' };

export const CARD_IDS = Object.keys(CARDS) as CardId[];

/** What a placed card has become: part of a Double Black Diamond, or its centre. */
export type TileVariant = 'dbd' | 'dbdPart' | null;

export interface TileState {
  card: CardId;
  /** Spare counter for tiles that keep time (unused by most). */
  timer: number;
  /** Lap this tile last paid out (caches, safehouses). */
  lastLap: number;
  variant: TileVariant;
}

export type Tiles = (TileState | null)[];

export const newTiles = (): Tiles => new Array(MAP_W * MAP_H).fill(null);

/** Whether `card` can go on cell (x, y) right now. */
export function canPlace(map: MountainMap, tiles: Tiles, card: CardId, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
  const kind = CARDS[card].kind;
  // Weather covers the whole mountain: click anywhere.
  if (kind === 'weather' || kind === 'action') return true;
  if (card === 'catTrack') return !!crossCourse(map, x, y, (c) => !!tiles[c]);
  // A route can share its junction with a trail card, but can't cross anything you've placed.
  if (kind === 'route') {
    if (ROUTE_OF[card] === 'lift' && map.lifts.filter((l) => l.route >= 0).length >= MAX_LIFTS) return false;
    return !!routeCourse(map, ROUTE_OF[card]!, x, y, (c) => !!tiles[c]);
  }
  const placed = tiles[cell(x, y)];
  if (kind === 'special') return !!placed;
  if (placed) return false;
  if (kind === 'trail' || kind === 'boss') return isPiste(map, nodeAt(map, x, y));
  if (kind === 'roadside') return isRoadside(map, x, y);
  return !isPath(map, x, y);
}

/**
 * A Cat Track from the trail tile at (x, y): straight out in the first direction (right, left,
 * down, then up) that crosses at least two open cells to trail. Returns the route's cells: the
 * open ones, then the trail cell it joins.
 */
export function crossCourse(map: MountainMap, x: number, y: number, blocked: (c: number) => boolean = () => false): number[] | null {
  const start = nodeAt(map, x, y);
  if (start < 0 || map.nodes[start].kind !== 'trail' || map.nodes[start].next.length > 1) return null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const cells: number[] = [];
    for (let xx = x + dx, yy = y + dy; xx >= 0 && yy >= 0 && xx < MAP_W && yy < MAP_H; xx += dx, yy += dy) {
      const j = nodeAt(map, xx, yy);
      if (j >= 0) {
        if (cells.length >= 2 && isPiste(map, j)) return [...cells, cell(xx, yy)];
        break;
      }
      if (blocked(cell(xx, yy))) break;
      cells.push(cell(xx, yy));
    }
  }
  return null;
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
