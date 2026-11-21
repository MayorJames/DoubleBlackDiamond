// The lodge: the hub you return to between expeditions, like Loop Hero's camp (and the
// vision's Hades-style lodge). What you bring back builds it up; buildings unlock cards and
// bonuses. Pure data and rules here; saving it is the client's job.

import type { CardId } from './cards';
import type { Payout, RunStatus } from './run';
import { NO_BONUSES, type LodgeBonuses } from './stats';

export type BuildingId = 'patrolHut' | 'gondola' | 'radio' | 'spyHq' | 'rental' | 'sauna' | 'avalancheControl';

export interface Building {
  id: BuildingId;
  name: string;
  cost: { cash: number; intel: number; scrap: number };
  text: string;
  unlocks: CardId[];
  /** Sprite to show for it. */
  icon: string;
}

export const BUILDINGS: Building[] = [
  { id: 'patrolHut', name: 'Ski Patrol Hut', cost: { cash: 300, intel: 4, scrap: 0 }, text: 'Unlocks Supply Cache and Powder Field cards.', unlocks: ['cache', 'powder'], icon: 'cache' },
  { id: 'radio', name: 'Radio Tower', cost: { cash: 400, intel: 6, scrap: 0 }, text: 'Unlocks Sniper Nest and Snowmobile Garage. More danger, more loot.', unlocks: ['sniper', 'garage'], icon: 'sniper' },
  { id: 'gondola', name: 'Gondola Works', cost: { cash: 500, intel: 0, scrap: 6 }, text: 'Unlocks Kicker and Ice Sheet cards.', unlocks: ['kicker', 'ice'], icon: 'kicker' },
  { id: 'avalancheControl', name: 'Avalanche Control', cost: { cash: 500, intel: 3, scrap: 4 }, text: 'Unlocks Peak and Avalanche cards.', unlocks: ['peak', 'avalanche'], icon: 'peak' },
  { id: 'spyHq', name: 'Spy HQ', cost: { cash: 900, intel: 12, scrap: 4 }, text: 'Unlocks the Safehouse card, gadget drops and a second gadget slot.', unlocks: ['safehouse'], icon: 'safehouse' },
  { id: 'rental', name: 'Rental Shop', cost: { cash: 700, intel: 0, scrap: 10 }, text: '+10% speed, and better gear drops.', unlocks: [], icon: 'garage' },
  { id: 'sauna', name: 'Sauna', cost: { cash: 800, intel: 6, scrap: 6 }, text: '+25% max HP.', unlocks: [], icon: 'cabin' },
];

/** Cards every expedition starts with. */
export const STARTER_DECK: CardId[] = ['patrol', 'cabin', 'moguls', 'pines', 'boulder'];

export interface Profile {
  version: number;
  cash: number;
  intel: number;
  scrap: number;
  built: BuildingId[];
  /** Highest trail rating unlocked (0 = Bunny Hill). */
  rating: number;
  runs: number;
  bossesBeaten: number;
  bestRun: number;
}

export const newProfile = (): Profile => ({
  version: 1,
  cash: 0,
  intel: 0,
  scrap: 0,
  built: [],
  rating: 0,
  runs: 0,
  bossesBeaten: 0,
  bestRun: 0,
});

export function deckFor(p: Profile): CardId[] {
  const deck = [...STARTER_DECK];
  for (const b of BUILDINGS) if (p.built.includes(b.id)) deck.push(...b.unlocks);
  return deck;
}

export function bonusesFor(p: Profile): LodgeBonuses {
  const has = (id: BuildingId) => p.built.includes(id);
  return {
    ...NO_BONUSES,
    maxHpPct: has('sauna') ? 0.25 : 0,
    speedPct: has('rental') ? 0.1 : 0,
    rarityBoost: has('rental') ? 0.1 : 0,
    gadgetSlots: has('spyHq') ? 2 : 1,
    gadgetDrops: has('spyHq'),
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
  p.built.push(id);
  return true;
}

/** Bank an expedition's payout. Beating the boss on your top rating unlocks the next one. */
export function bankRun(p: Profile, status: RunStatus, payout: Payout, rating: number): void {
  p.cash += payout.cash;
  p.intel += payout.intel;
  p.scrap += payout.scrap;
  p.runs++;
  p.bestRun = Math.max(p.bestRun, payout.cash);
  if (status === 'won') {
    p.bossesBeaten++;
    if (rating === p.rating && p.rating < 3) p.rating++;
  }
}
