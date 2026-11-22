// The opposition. Guards hold their tiles, snipers sit in nests, sappers mine the trail, medics
// patch up everyone near them, and snowmobiles, hounds and the boss chase you round the
// mountain. Everything levels up with each descent.

import type { Ride } from './map';

export type BossKind = 'widow' | 'yetiKing' | 'kickback';
export type EnemyKind = 'guard' | 'sniper' | 'snowmobile' | 'yeti' | 'sapper' | 'medic' | 'hound' | 'baron' | BossKind;

/** The bosses: the Baron (from the alert meter) and the three you summon with dossiers. */
export const isBoss = (k: EnemyKind): boolean => k === 'baron' || k === 'widow' || k === 'yetiKing' || k === 'kickback';

export interface EnemyDef {
  name: string;
  hp: number;
  damage: number;
  /** Seconds between shots. */
  interval: number;
  /** Reach in tiles. */
  range: number;
  accuracy: number;
  evasion: number;
  chips: number;
  /** Cash for the kill, banked at the lodge; scaled by level and the trail's difficulty. */
  bounty: number;
  /** Tiles per second along the path, for chasers; 0 for enemies that hold a tile. */
  speed: number;
  /** Resources dropped on a kill. Below 1 it is the chance of dropping one. */
  intel: number;
  scrap: number;
  cardChance: number;
  itemChance: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  guard: { name: 'Guard', hp: 14, damage: 4, interval: 1.4, range: 1.4, accuracy: 0.6, evasion: 0.05, chips: 20, bounty: 40, speed: 0, intel: 1, scrap: 0.35, cardChance: 0.45, itemChance: 0.28 },
  sniper: { name: 'Sniper', hp: 10, damage: 10, interval: 3, range: 2.6, accuracy: 0.7, evasion: 0.1, chips: 40, bounty: 70, speed: 0, intel: 2, scrap: 0.3, cardChance: 0.5, itemChance: 0.35 },
  snowmobile: { name: 'Snowmobile Goon', hp: 22, damage: 5, interval: 1.2, range: 1.3, accuracy: 0.55, evasion: 0.1, chips: 35, bounty: 60, speed: 2.3, intel: 0, scrap: 2, cardChance: 0.4, itemChance: 0.4 },
  yeti: { name: 'Yeti', hp: 60, damage: 9, interval: 1.8, range: 1.2, accuracy: 0.65, evasion: 0, chips: 90, bounty: 180, speed: 0, intel: 3, scrap: 1, cardChance: 0.8, itemChance: 0.7 },
  sapper: { name: 'Sapper', hp: 16, damage: 7, interval: 2.6, range: 2, accuracy: 0.5, evasion: 0.05, chips: 35, bounty: 60, speed: 0, intel: 1, scrap: 1, cardChance: 0.5, itemChance: 0.35 },
  medic: { name: 'Turncoat Medic', hp: 18, damage: 2, interval: 1.6, range: 1.4, accuracy: 0.5, evasion: 0.05, chips: 30, bounty: 55, speed: 0, intel: 2, scrap: 0.5, cardChance: 0.5, itemChance: 0.3 },
  hound: { name: 'Hound', hp: 8, damage: 3, interval: 0.7, range: 0.9, accuracy: 0.7, evasion: 0.2, chips: 12, bounty: 15, speed: 3.1, intel: 0, scrap: 0.2, cardChance: 0.15, itemChance: 0.08 },
  baron: { name: 'The Avalanche Baron', hp: 300, damage: 7, interval: 0.8, range: 2, accuracy: 0.6, evasion: 0.1, chips: 600, bounty: 0, speed: 2.2, intel: 20, scrap: 20, cardChance: 0, itemChance: 1 },
  widow: { name: 'The Ice Widow', hp: 200, damage: 13, interval: 2.2, range: 3.4, accuracy: 0.75, evasion: 0.15, chips: 400, bounty: 0, speed: 0, intel: 10, scrap: 6, cardChance: 1, itemChance: 0 },
  yetiKing: { name: 'The Yeti King', hp: 340, damage: 15, interval: 2, range: 1.6, accuracy: 0.7, evasion: 0, chips: 500, bounty: 0, speed: 0, intel: 10, scrap: 10, cardChance: 1, itemChance: 0 },
  kickback: { name: 'Captain Kickback', hp: 170, damage: 6, interval: 0.6, range: 1.8, accuracy: 0.55, evasion: 0.25, chips: 450, bounty: 0, speed: 2.9, intel: 10, scrap: 8, cardChance: 1, itemChance: 0 },
};

/** Who the bosses are, for their arrival. */
export const BOSS_INFO: Record<'baron' | BossKind, { epithet: string; text: string; reward: string }> = {
  baron: {
    epithet: 'Master of the mountain',
    text: 'Comes down from the summit in his snowcat and chases you round the mountain, following your switches.',
    reward: 'Beat him to win the expedition, keep everything, and unlock the next trail rating.',
  },
  widow: {
    epithet: 'Cold hands, colder aim',
    text: 'Holds her tile and fires from over three tiles away. The trail around her has frozen to ice: fast, but it ruins your aim.',
    reward: "Drops The Widow's Monocle: +15% crit chance, and crits hit for triple. Plus a $1,000 bounty.",
  },
  yetiKing: {
    epithet: 'Long may he roar',
    text: 'Holds his tile and hits like an avalanche up close. Every ten seconds he lives, another yeti comes down to the trail.',
    reward: 'Drops the Yeti Pelt: +45 max HP, +1 regen, +3 defense. Plus a $1,000 bounty.',
  },
  kickback: {
    epithet: 'Has never once used the brakes',
    text: 'Laps the mountain on a rocket sled faster than you can tuck, spraying bullets, and follows your switches.',
    reward: 'Drops the Getaway Sled: chained descents give +2 mult, and bailing out keeps 80%. Plus a $1,000 bounty.',
  },
};

export interface Enemy {
  id: number;
  kind: EnemyKind;
  level: number;
  hp: number;
  maxHp: number;
  /** Position in tiles (centre of the tile plus a small offset). */
  x: number;
  y: number;
  /** Where a chaser is on the mountain; null for enemies that hold a tile. */
  ride: Ride | null;
  /** Grid cell of the tile that spawned it (for respawns), or -1. */
  home: number;
  cooldown: number;
  /** Seconds until its special move (a boss's call, a medic's heal), for those that have one. */
  ability?: number;
}

/** Stat multiplier for an enemy's level (the descent it arrived on) and the trail rating. */
export const levelScale = (level: number, rating: number) => ({
  hp: (1 + 0.3 * (level - 1)) * RATINGS[rating].enemy,
  damage: (1 + 0.2 * (level - 1)) * RATINGS[rating].enemy,
  chips: 1 + 0.25 * (level - 1),
});

/** Trail ratings, the difficulty ladder. Clearing one (beating the boss) unlocks the next. */
export const RATINGS = [
  { name: 'Bunny Hill', enemy: 0.8, payout: 0.75, boss: 18 },
  { name: 'Blue Square', enemy: 1, payout: 1, boss: 22 },
  { name: 'Black Diamond', enemy: 1.3, payout: 1.4, boss: 26 },
  { name: 'Double Black Diamond', enemy: 1.7, payout: 2, boss: 30 },
];
