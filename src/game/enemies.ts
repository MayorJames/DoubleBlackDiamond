// The opposition. Guards hold their tiles, snipers sit in nests, snowmobiles and the boss
// chase you round the loop. Everything levels up with each lap.

export type EnemyKind = 'guard' | 'sniper' | 'snowmobile' | 'yeti' | 'baron';

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
  /** Tiles per second along the loop, for chasers; 0 for enemies that hold a tile. */
  speed: number;
  /** Resources dropped on a kill. Below 1 it is the chance of dropping one. */
  intel: number;
  scrap: number;
  cardChance: number;
  itemChance: number;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  guard: { name: 'Guard', hp: 14, damage: 4, interval: 1.4, range: 1.4, accuracy: 0.6, evasion: 0.05, chips: 20, speed: 0, intel: 1, scrap: 0.35, cardChance: 0.45, itemChance: 0.28 },
  sniper: { name: 'Sniper', hp: 10, damage: 10, interval: 3, range: 2.6, accuracy: 0.7, evasion: 0.1, chips: 40, speed: 0, intel: 2, scrap: 0.3, cardChance: 0.5, itemChance: 0.35 },
  snowmobile: { name: 'Snowmobile Goon', hp: 22, damage: 5, interval: 1.2, range: 1.3, accuracy: 0.55, evasion: 0.1, chips: 35, speed: 2.3, intel: 0, scrap: 2, cardChance: 0.4, itemChance: 0.4 },
  yeti: { name: 'Yeti', hp: 60, damage: 9, interval: 1.8, range: 1.2, accuracy: 0.65, evasion: 0, chips: 90, speed: 0, intel: 3, scrap: 1, cardChance: 0.8, itemChance: 0.7 },
  baron: { name: 'The Avalanche Baron', hp: 300, damage: 7, interval: 0.8, range: 2, accuracy: 0.6, evasion: 0.1, chips: 600, speed: 2.2, intel: 20, scrap: 20, cardChance: 0, itemChance: 1 },
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
  /** Distance along the loop for chasers, -1 for enemies that hold a tile. */
  s: number;
  /** Grid cell of the tile that spawned it (for respawns), or -1. */
  home: number;
  cooldown: number;
}

/** Stat multiplier for an enemy's level (the lap it was spawned on) and the trail rating. */
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
