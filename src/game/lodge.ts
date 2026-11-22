// The lodge: the hub you return to between expeditions, like Loop Hero's camp (and the
// vision's Hades-style lodge). What you bring back builds it up; buildings unlock cards and
// bonuses, and you choose which unlocked cards make up your deck. Pure data and rules here;
// saving it is the client's job.

import type { CardId } from './cards';
import type { BossKind } from './enemies';
import { COURSE_TILES, newPlan, STARTING_TILES, type CourseTile, type MountainPlan, type TileStock } from './mountain';
import type { Payout, RunStatus } from './run';
import { NO_BONUSES, type LodgeBonuses } from './stats';

export type BuildingId =
  | 'weatherStation'
  | 'trailCrew'
  | 'patrolHut'
  | 'gondola'
  | 'radio'
  | 'spyHq'
  | 'rental'
  | 'sauna'
  | 'avalancheControl'
  | 'huntingLodge'
  | 'terrainPark'
  | 'armory';

export interface Building {
  id: BuildingId;
  name: string;
  cost: { cash: number; intel: number; scrap: number };
  text: string;
  unlocks: CardId[];
}

export const BUILDINGS: Building[] = [
  { id: 'trailCrew', name: 'Trail Crew', cost: { cash: 250, intel: 0, scrap: 3 }, text: 'Unlocks the Chute card, and sells chute and tunnel tiles for your mountain.', unlocks: ['chute'] },
  { id: 'patrolHut', name: 'Ski Patrol Hut', cost: { cash: 300, intel: 4, scrap: 0 }, text: 'Unlocks Supply Cache and Powder Field cards, and the Field Hospital: a turncoat medic for the other side.', unlocks: ['cache', 'powder', 'fieldHospital'] },
  { id: 'radio', name: 'Radio Tower', cost: { cash: 400, intel: 6, scrap: 0 }, text: 'Unlocks Sniper Nest and Snowmobile Garage. More danger, more loot.', unlocks: ['sniper', 'garage'] },
  { id: 'gondola', name: 'Gondola Works', cost: { cash: 500, intel: 0, scrap: 6 }, text: 'Unlocks the Chairlift, Kicker and Ice Sheet cards, and sells lift tiles for your mountain.', unlocks: ['chairlift', 'kicker', 'ice'] },
  { id: 'avalancheControl', name: 'Avalanche Control', cost: { cash: 500, intel: 3, scrap: 4 }, text: 'Unlocks Peak, Avalanche and Demo Shack cards.', unlocks: ['peak', 'avalanche', 'demoShack'] },
  { id: 'weatherStation', name: 'Weather Station', cost: { cash: 600, intel: 5, scrap: 4 }, text: 'Unlocks the Whiteout and Night weather cards.', unlocks: ['whiteout', 'night'] },
  { id: 'spyHq', name: 'Spy HQ', cost: { cash: 900, intel: 12, scrap: 4 }, text: 'Unlocks the Safehouse card, gadget drops and a second gadget slot.', unlocks: ['safehouse'] },
  { id: 'rental', name: 'Rental Shop', cost: { cash: 700, intel: 0, scrap: 10 }, text: '+10% speed, and better gear drops.', unlocks: [] },
  { id: 'sauna', name: 'Sauna', cost: { cash: 800, intel: 6, scrap: 6 }, text: '+25% max HP.', unlocks: [] },
  { id: 'terrainPark', name: 'Terrain Park', cost: { cash: 450, intel: 0, scrap: 5 }, text: 'Unlocks the Slalom Gates, Snow Tunnel and Checkpoint cards.', unlocks: ['gates', 'tunnel', 'checkpoint'] },
  { id: 'huntingLodge', name: 'Hunting Lodge', cost: { cash: 650, intel: 4, scrap: 4 }, text: 'Unlocks the Kennel and Yeti Cave cards: fast hounds and big, rich yetis.', unlocks: ['kennel', 'yetiCave'] },
  { id: 'armory', name: 'Armory', cost: { cash: 850, intel: 6, scrap: 8 }, text: 'You head out with a better pistol, and gear drops a grade better.', unlocks: [] },
];

/** Cards you own from the start. */
export const STARTER_DECK: CardId[] = ['patrol', 'cabin', 'moguls', 'pines', 'boulder'];

/** How many different cards a deck can hold, at most and at least. */
export const DECK_MAX = 8;
export const DECK_MIN = 4;

export interface Profile {
  version: number;
  cash: number;
  intel: number;
  scrap: number;
  built: BuildingId[];
  /** Old saves: the highest trail rating unlocked. Now unused (difficulty comes from the mountain). */
  rating: number;
  runs: number;
  bossesBeaten: number;
  bestRun: number;
  /** The cards you take on an expedition, chosen from those you've unlocked. */
  deck: CardId[];
  /** Dossier bosses you have beaten, at least once each. */
  trophies: BossKind[];
  /** Your home mountain, and the course tiles you have to build it with. */
  mountain: MountainPlan;
  tiles: TileStock;
  /** The last expedition's weather and how it ended, for the town to echo. */
  lastRun: { weather: 'clear' | 'whiteout' | 'night'; status: RunStatus } | null;
}

export const newProfile = (seed = 'FIRSTRUN'): Profile => ({
  version: 1,
  cash: 0,
  intel: 0,
  scrap: 0,
  built: [],
  rating: 0,
  runs: 0,
  bossesBeaten: 0,
  bestRun: 0,
  deck: [...STARTER_DECK],
  trophies: [],
  mountain: newPlan(seed),
  tiles: { ...STARTING_TILES },
  lastRun: null,
});

/** Every card your buildings have unlocked, starter cards first. */
export function unlockedCards(p: Profile): CardId[] {
  const cards = [...STARTER_DECK];
  for (const b of BUILDINGS) if (p.built.includes(b.id)) cards.push(...b.unlocks);
  return cards;
}

/** The deck an expedition uses: your chosen cards that are still unlocked, or a default. */
export function deckFor(p: Profile): CardId[] {
  const unlocked = unlockedCards(p);
  const deck = (p.deck ?? []).filter((c, i, all) => unlocked.includes(c) && all.indexOf(c) === i).slice(0, DECK_MAX);
  return deck.length >= Math.min(DECK_MIN, unlocked.length) ? deck : unlocked.slice(0, DECK_MAX);
}

/** Takes a card out of the deck, or puts it in. Returns whether anything changed. */
export function toggleCard(p: Profile, card: CardId): boolean {
  const deck = deckFor(p);
  if (deck.includes(card)) {
    if (deck.length <= DECK_MIN) return false;
    p.deck = deck.filter((c) => c !== card);
    return true;
  }
  if (deck.length >= DECK_MAX || !unlockedCards(p).includes(card)) return false;
  p.deck = [...deck, card];
  return true;
}

export function bonusesFor(p: Profile): LodgeBonuses {
  const has = (id: BuildingId) => p.built.includes(id);
  return {
    ...NO_BONUSES,
    maxHpPct: has('sauna') ? 0.25 : 0,
    speedPct: has('rental') ? 0.1 : 0,
    rarityBoost: (has('rental') ? 0.1 : 0) + (has('armory') ? 0.1 : 0),
    gadgetSlots: has('spyHq') ? 2 : 1,
    gadgetDrops: has('spyHq'),
    armory: has('armory'),
  };
}

export const canAfford = (p: Profile, b: Building): boolean =>
  !p.built.includes(b.id) && p.cash >= b.cost.cash && p.intel >= b.cost.intel && p.scrap >= b.cost.scrap;

export function build(p: Profile, id: BuildingId): boolean {
  const b = BUILDINGS.find((x) => x.id === id);
  if (!b || !canAfford(p, b)) return false;
  p.cash -= b.cost.cash;
  p.intel -= b.cost.intel;
  p.scrap -= b.cost.scrap;
  // New cards go straight into the deck while there's room.
  const deck = deckFor(p);
  p.built.push(id);
  for (const card of b.unlocks) if (deck.length < DECK_MAX && !deck.includes(card)) deck.push(card);
  p.deck = deck;
  return true;
}

/** The special tile each dossier boss leaves behind. */
const BOSS_TILE: Record<BossKind, CourseTile> = { widow: 'gates', yetiKing: 'tunnel', kickback: 'jump' };

/**
 * Bank an expedition's payout, and the course tiles it earned: a trail tile for every two laps
 * (four at most), a special tile for each dossier boss, and for beating the Baron two more trail
 * tiles and a Black Run sign. Returns the tiles earned.
 */
export function bankRun(p: Profile, status: RunStatus, payout: Payout, bosses: readonly BossKind[] = [], laps = 0): CourseTile[] {
  for (const b of bosses) if (!p.trophies.includes(b)) p.trophies.push(b);
  p.cash += payout.cash;
  p.intel += payout.intel;
  p.scrap += payout.scrap;
  p.runs++;
  p.bestRun = Math.max(p.bestRun, payout.cash);
  const earned: CourseTile[] = [];
  for (let k = 0; k < Math.min(4, Math.floor(laps / 2)); k++) earned.push('trail');
  for (const b of bosses) earned.push(BOSS_TILE[b]);
  if (status === 'won') {
    p.bossesBeaten++;
    earned.push('trail', 'trail', 'blackRun');
  }
  for (const t of earned) p.tiles[t]++;
  return earned;
}

/** Whether town will sell you a course tile right now. */
export function canBuyTile(p: Profile, tile: CourseTile): boolean {
  const info = COURSE_TILES[tile];
  if (!info.price || (info.needs && !p.built.includes(info.needs))) return false;
  return p.cash >= info.price.cash && p.intel >= info.price.intel && p.scrap >= info.price.scrap;
}

export function buyTile(p: Profile, tile: CourseTile): boolean {
  if (!canBuyTile(p, tile)) return false;
  const price = COURSE_TILES[tile].price!;
  p.cash -= price.cash;
  p.intel -= price.intel;
  p.scrap -= price.scrap;
  p.tiles[tile]++;
  return true;
}
