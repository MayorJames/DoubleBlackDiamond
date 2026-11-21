// Loot. Gear drops from what you shoot, Loop Hero style, in three rarities that map onto the
// palette: common is white, rare is black, legendary is red. Gadgets are the rule-benders
// (Balatro's jokers) and fill their own slots.

import type { Rng } from './rng';

export type GearSlot = 'gun' | 'skis' | 'goggles' | 'jacket';
export type Slot = GearSlot | 'gadget1' | 'gadget2';
export type Rarity = 0 | 1 | 2;
export type StatKey = 'maxHp' | 'damage' | 'fireRate' | 'range' | 'accuracy' | 'defense' | 'evasion' | 'speed' | 'crit' | 'regen';

export type GadgetId = 'treeHugger' | 'airhead' | 'plowReload' | 'insurance' | 'speedDemon' | 'liftPass' | 'snowballs';

export interface Item {
  id: number;
  /** Gear slot, or 'gadget' for anything that goes in a gadget slot. */
  slot: GearSlot | 'gadget';
  name: string;
  rarity: Rarity;
  level: number;
  stats: Partial<Record<StatKey, number>>;
  gadget?: GadgetId;
}

export const RARITY_NAMES = ['Common', 'Rare', 'Legendary'] as const;

export const GADGETS: Record<GadgetId, { name: string; text: string }> = {
  treeHugger: { name: 'Tree Hugger', text: 'Every graze adds +0.05 mult for the rest of the run.' },
  airhead: { name: 'Airhead', text: 'You keep shooting in the air, and airborne shots hit for triple.' },
  plowReload: { name: 'Plow Reload', text: 'Snowplowing makes you fire 60% faster.' },
  insurance: { name: 'Yard Sale Insurance', text: "Getting shot doesn't break your combo." },
  speedDemon: { name: 'Speed Demon', text: 'Tucking builds mult twice as fast.' },
  liftPass: { name: 'Season Pass', text: 'Lift rides heal three times faster, and your aim on the lift is steadier.' },
  snowballs: { name: 'Exploding Snowballs', text: 'Kills splash 8 damage onto everything within a tile.' },
};
export const GADGET_IDS = Object.keys(GADGETS) as GadgetId[];

const NAMES: Record<GearSlot, string[][]> = {
  gun: [
    ['Pocket Pistol', 'Starter Pistol', 'Cap Gun'],
    ['Silenced .22', 'Umbrella Gun', 'Pen Pistol'],
    ['Fondue Blaster', 'Golden Ski Pole'],
  ],
  skis: [['Rental Planks', 'Hand-me-downs'], ['Racing Carvers', 'Waxed Twin Tips'], ['Rocket Skis']],
  goggles: [['Fogged Goggles', 'Ski Shades'], ['Polarized Lenses', 'Night Goggles'], ['X-Ray Specs']],
  jacket: [['Puffer Jacket', 'Thrift Anorak'], ['Tuxedo Parka', 'Insulated Trench'], ['Kevlar Onesie']],
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A random piece of gear (or, rarely, a gadget) scaled to the lap. */
export function rollItem(rng: Rng, id: number, level: number, rarityBoost: number, gadgets: boolean): Item {
  const roll = rng.next() + rarityBoost;
  const rarity: Rarity = roll > 1.08 ? 2 : roll > 0.8 ? 1 : 0;
  if (gadgets && rng.chance(0.08 + rarity * 0.08)) return rollGadget(rng, id, level, rarity);
  const slot = rng.pick(['gun', 'skis', 'goggles', 'jacket'] as const);
  const power = (1 + 0.35 * (level - 1)) * [1, 1.6, 2.4][rarity];
  const stats: Item['stats'] = {};
  switch (slot) {
    case 'gun':
      stats.damage = Math.round(1.5 * power + rng.range(0, 1.5));
      if (rng.chance(0.6)) stats.fireRate = r2(rng.range(0.05, 0.18) * [1, 1.4, 2][rarity]);
      if (rarity > 0) stats.crit = r2(rng.range(0.03, 0.07) * rarity);
      break;
    case 'skis':
      stats.speed = r2(rng.range(0.04, 0.1) * [1, 1.5, 2.2][rarity]);
      stats.evasion = r2(rng.range(0.02, 0.04) * power);
      break;
    case 'goggles':
      stats.accuracy = r2(rng.range(0.04, 0.08) * [1, 1.5, 2.2][rarity]);
      if (rng.chance(0.5)) stats.crit = r2(rng.range(0.02, 0.05) * (1 + rarity));
      if (rarity === 2) stats.range = 0.3;
      break;
    case 'jacket':
      stats.maxHp = Math.round(5 * power + rng.range(0, 4));
      stats.defense = Math.round(0.6 * power);
      if (rarity > 0) stats.regen = r2(0.2 * rarity);
      break;
  }
  return { id, slot, name: rng.pick(NAMES[slot][rarity]), rarity, level, stats };
}

export function rollGadget(rng: Rng, id: number, level: number, rarity: Rarity = 2): Item {
  const gadget = rng.pick(GADGET_IDS);
  return { id, slot: 'gadget', name: GADGETS[gadget].name, rarity: Math.max(1, rarity) as Rarity, level, stats: {}, gadget };
}

export const STARTER_GUN = (id: number): Item => ({
  id,
  slot: 'gun',
  name: 'Pocket Pistol',
  rarity: 0,
  level: 1,
  stats: {},
});
