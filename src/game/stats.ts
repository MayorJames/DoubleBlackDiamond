// The skier's numbers: a base, plus gear, plus the mountain you built, plus lodge upgrades.
// Stance multiplies on top, and it is the one thing you steer in real time.

import { MAP_H, MAP_W } from './constants';
import { countAround, type Tiles } from './cards';
import { cell } from './map';
import type { Item, ModId, Slot, StatKey } from './items';

export type Stats = Record<StatKey, number>;
export type Stance = 'tuck' | 'cruise' | 'plow';

export const BASE_STATS: Stats = {
  maxHp: 60,
  damage: 5,
  fireRate: 1.4,
  range: 1.8,
  accuracy: 0.75,
  defense: 0,
  evasion: 0.05,
  speed: 1,
  crit: 0.05,
  regen: 0,
};

/**
 * Gravity is the throttle. Tucking is fast and hard to hit but your aim goes; snowplowing is slow
 * and steady but you are a sitting duck. Tucking on the trail also builds mult.
 */
export const STANCES: Record<Stance, { speed: number; accuracy: number; evasion: number; defense: number; mult: number }> = {
  tuck: { speed: 1.6, accuracy: 0.65, evasion: 0.2, defense: 0, mult: 0.12 },
  cruise: { speed: 1, accuracy: 1, evasion: 0, defense: 0, mult: 0 },
  plow: { speed: 0.55, accuracy: 1.35, evasion: -0.05, defense: 2, mult: 0 },
};

/** Bonuses from buildings at the lodge, fixed for a run. */
export interface LodgeBonuses {
  maxHpPct: number;
  speedPct: number;
  rarityBoost: number;
  gadgetSlots: number;
  gadgetDrops: boolean;
  /** The Armory: a better starting pistol, and the best guns can drop. */
  armory: boolean;
  /** The Rental Shop: its premium skis, goggles and jackets can drop. */
  rental: boolean;
}

export const NO_BONUSES: LodgeBonuses = { maxHpPct: 0, speedPct: 0, rarityBoost: 0, gadgetSlots: 1, gadgetDrops: false, armory: false, rental: false };

export type Equipment = Record<Slot, Item | null>;

export function computeStats(equipment: Equipment, tiles: Tiles, bonuses: LodgeBonuses): Stats {
  const s: Stats = { ...BASE_STATS };
  for (const item of Object.values(equipment)) {
    if (!item) continue;
    for (const [k, v] of Object.entries(item.stats) as [StatKey, number][]) s[k] += v;
  }
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      const t = tiles[cell(x, y)];
      if (!t) continue;
      if (t.card === 'boulder') s.maxHp += 4;
      else if (t.card === 'peak') s.maxHp += 8;
      else if (t.card === 'pines') s.evasion += 0.03;
      else if (t.card === 'glacier') {
        s.maxHp += 5;
        s.defense += 1;
      } else if (t.card === 'cliff') s.maxHp += 6;
      else if (t.card === 'aspens') s.crit += 0.02;
      else if (t.card === 'frozenLake') s.speed += 0.04;
      else if (t.card === 'windRidge') s.evasion += 0.02;
      if (t.variant === 'dbd') s.maxHp += 40;
    }
  }
  s.maxHp = Math.round(s.maxHp * (1 + bonuses.maxHpPct));
  s.speed *= 1 + bonuses.speedPct;
  s.evasion = Math.min(s.evasion, 0.6);
  return s;
}

/** Whether anything you're wearing (or carrying in a gadget slot) does `mod`. */
export const hasMod = (equipment: Equipment, mod: ModId): boolean => Object.values(equipment).some((i) => i?.mod === mod);

/** Old name for hasMod. */
export const hasGadget = hasMod;

/** Healing a Powder Field gives at the start of each lap. */
export const powderHeal = (tiles: Tiles, x: number, y: number): number => 8 + 2 * countAround(tiles, x, y, 'pines');
