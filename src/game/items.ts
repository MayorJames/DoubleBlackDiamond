// Gear. Every item is a named, hand-made piece with a part to play: most bend a rule (a shotgun
// that splashes, skis that tuck without costing your aim, an airbag that saves you once), and
// their numbers grow with the level they drop at. Three rarities map onto the palette: common
// is white, rare is black, legendary is red. Gadgets are the rule-benders (Balatro's jokers) and
// fill their own slots. Some of the best gear only turns up once the town has the building for it.

import type { Rng } from './rng';

export type GearSlot = 'gun' | 'skis' | 'goggles' | 'jacket';
export type Slot = GearSlot | 'gadget1' | 'gadget2';
export type Rarity = 0 | 1 | 2;
export type StatKey = 'maxHp' | 'damage' | 'fireRate' | 'range' | 'accuracy' | 'defense' | 'evasion' | 'speed' | 'crit' | 'regen';

/** What an item does beyond its numbers. */
export type ModId =
  // Gadgets
  | 'treeHugger'
  | 'airhead'
  | 'plowReload'
  | 'insurance'
  | 'speedDemon'
  | 'liftPass'
  | 'snowballs'
  | 'monocle'
  | 'sled'
  | 'grapple'
  | 'magnet'
  | 'flask'
  | 'coupon'
  | 'rabbitFoot'
  | 'briefcase'
  | 'piggyBank'
  // Guns
  | 'spread'
  | 'pierce'
  | 'stun'
  | 'harpoon'
  | 'tranq'
  | 'leech'
  | 'bounty'
  | 'goldenGun'
  | 'longShot'
  | 'thermal'
  // Skis
  | 'skate'
  | 'twinTips'
  | 'mogulMaster'
  | 'iceEdge'
  | 'powderSkis'
  | 'steady'
  | 'plowSpeed'
  // Goggles
  | 'nightVision'
  | 'whiteoutLens'
  | 'lucky'
  // Jackets
  | 'camo'
  | 'style'
  | 'spiked'
  | 'beacon';

/** Old name, kept for the gadgets: a gadget is a mod in a gadget slot. */
export type GadgetId = ModId;

export const MODS: Record<ModId, string> = {
  treeHugger: 'Every graze adds +0.05 mult for the rest of the run.',
  airhead: 'You keep shooting in the air, and airborne shots hit for triple.',
  plowReload: 'Snowplowing makes you fire 60% faster.',
  insurance: "Getting hurt doesn't break your combo.",
  speedDemon: 'Tucking builds mult twice as fast.',
  liftPass: 'Lift rides heal three times faster, and your aim on the lift is steadier.',
  snowballs: 'Kills splash 8 damage onto everything within a tile.',
  monocle: '+15% crit chance, and crits hit for triple.',
  sled: 'Chained descents give +2 mult, and bailing out keeps 80%.',
  grapple: 'Chaining a descent heals 15% of your max HP.',
  magnet: 'Gear drops 30% more often.',
  flask: 'Every lap starts with a swig: heal 20% of your max HP.',
  coupon: 'Everything in the shop costs 20% less.',
  rabbitFoot: 'Your first reroll each lap is free.',
  briefcase: 'Intel fragments drop half as often again.',
  piggyBank: 'Bounties pay 15% more.',
  spread: 'Hits splash 60% damage onto everything near the target.',
  pierce: 'Every shot also fires at the next nearest enemy.',
  stun: 'Hits freeze the target for half a second: no moving, no shooting.',
  harpoon: 'Hits pin the target for over a second: no moving, no shooting.',
  tranq: 'Hits make the target fire half as fast for 3 seconds.',
  leech: 'Every hit heals you 2 HP.',
  bounty: 'Kills pay half as much bounty again.',
  goldenGun: 'Every fourth shot is a guaranteed crit.',
  longShot: 'Shots at targets over 1.8 tiles away hit 50% harder.',
  thermal: 'The first hit on an unhurt enemy hits 25% harder.',
  skate: 'You skate back uphill at full traverse speed.',
  twinTips: 'Kickers and rails pay double chips.',
  mogulMaster: "Moguls and powder don't slow you down.",
  iceEdge: "Ice doesn't spoil your aim.",
  powderSkis: 'Every trail tile pays a chip more.',
  steady: "Tucking doesn't cost you any aim.",
  plowSpeed: 'You snowplow at 75% speed instead of 55%.',
  nightVision: "Night doesn't spoil your aim.",
  whiteoutLens: 'You see as far as ever in a whiteout.',
  lucky: 'Cards and gear drop 15% more often.',
  camo: 'Enemies more than 1.5 tiles away lose a quarter of their aim.',
  style: 'Points pay 15% more.',
  spiked: 'Anything that hits you from within a tile takes 3 damage back.',
  beacon: 'Once an expedition, a killing blow leaves you on 1 HP instead.',
};

export type ItemIcon = 'iconGun' | 'iconShotgun' | 'iconRifle' | 'iconSkis' | 'iconGoggles' | 'iconJacket' | 'iconGadget';

/** A building that has to be up before an item can drop. */
export type ItemUnlock = 'armory' | 'rental' | 'spyHq';

export interface ItemDef {
  id: string;
  name: string;
  slot: GearSlot | 'gadget';
  rarity: Rarity;
  /** Numbers at level 1; they grow with the level an item drops at. */
  stats: Partial<Record<StatKey, number>>;
  mod?: ModId;
  flavor: string;
  icon?: ItemIcon;
  unlock?: ItemUnlock;
  /** One of a kind: a boss's reward, never found any other way. */
  unique?: boolean;
  /** The pistol you start with: never drops. */
  starter?: boolean;
}

export interface Item {
  id: number;
  /** The ItemDef it was made from. */
  def: string;
  /** Gear slot, or 'gadget' for anything that goes in a gadget slot. */
  slot: GearSlot | 'gadget';
  name: string;
  rarity: Rarity;
  level: number;
  stats: Partial<Record<StatKey, number>>;
  mod?: ModId;
  unique?: boolean;
}

export const RARITY_NAMES = ['Common', 'Rare', 'Legendary'] as const;

const gun = (id: string, name: string, rarity: Rarity, stats: ItemDef['stats'], flavor: string, more: Partial<ItemDef> = {}): ItemDef => ({
  id,
  name,
  slot: 'gun',
  rarity,
  stats,
  flavor,
  icon: 'iconGun',
  ...more,
});
const gear = (slot: GearSlot, id: string, name: string, rarity: Rarity, stats: ItemDef['stats'], flavor: string, more: Partial<ItemDef> = {}): ItemDef => ({
  id,
  name,
  slot,
  rarity,
  stats,
  flavor,
  ...more,
});
const gadget = (id: ModId, name: string, rarity: Rarity, flavor: string, more: Partial<ItemDef> = {}): ItemDef => ({
  id,
  name,
  slot: 'gadget',
  rarity,
  stats: {},
  mod: id,
  flavor,
  ...more,
});

export const ITEM_DEFS: ItemDef[] = [
  // --- Guns ------------------------------------------------------------------------------------
  gun('pocketPistol', 'Pocket Pistol', 0, {}, 'Fits in a ski glove.', { starter: true }),
  gun('capGun', 'Cap Gun', 0, { damage: 1, fireRate: 0.12 }, 'Mostly noise. Mostly.'),
  gun('starterPistol', 'Starter Pistol', 0, { damage: 2 }, 'On your marks.'),
  gun('skiPolePistol', 'Ski Pole Pistol', 0, { damage: 2, crit: 0.03 }, 'Pointy end towards the enemy.'),
  gun('snowballLauncher', 'Snowball Launcher', 0, { damage: 1 }, 'Cold, wet, effective.', { mod: 'stun', icon: 'iconShotgun' }),
  gun('flarePistol', 'Flare Pistol', 0, { damage: 1, range: 0.3 }, 'Lights up the night, and the guard.', { mod: 'thermal' }),
  gun('silenced22', 'Silenced .22', 1, { damage: 2, fireRate: 0.15 }, 'Pfft. Pfft.'),
  gun('umbrellaGun', 'Umbrella Gun', 1, { damage: 2, defense: 1 }, 'For snow, rain and assassination.'),
  gun('penPistol', 'Pen Pistol', 1, { damage: 3, crit: 0.05 }, 'Mightier than the sword. Louder too.'),
  gun('fondueShotgun', 'Fondue Shotgun', 1, { damage: 2, fireRate: -0.2 }, 'Melted cheese at sixty paces.', { mod: 'spread', icon: 'iconShotgun' }),
  gun('harpoonGun', 'Harpoon Gun', 1, { damage: 4, fireRate: -0.3 }, 'Whaling, but on skis.', { mod: 'harpoon', icon: 'iconRifle' }),
  gun('biathlonRifle', 'Biathlon Rifle', 1, { damage: 4, range: 0.6, fireRate: -0.4 }, 'Ski, stop, breathe, shoot.', { mod: 'longShot', icon: 'iconRifle' }),
  gun('tranqPistol', 'Tranquilizer', 1, { damage: 2 }, 'Sweet dreams, goon.', { mod: 'tranq' }),
  gun('bountyRevolver', "Bounty Hunter's Revolver", 1, { damage: 3 }, 'Wanted: everyone.', { mod: 'bounty' }),
  gun('goldenSkiPole', 'Golden Ski Pole', 2, { damage: 5 }, 'One in four is a masterpiece.', { mod: 'goldenGun' }),
  gun('fondueBlaster', 'Fondue Blaster', 2, { damage: 6, fireRate: 0.3 }, 'Gruyère-grade firepower.'),
  gun('railgun', 'Railgun', 2, { damage: 6, fireRate: -0.3 }, 'Goes through one goon and into the next.', { mod: 'pierce', icon: 'iconRifle', unlock: 'armory' }),
  gun('avalancheMortar', 'Avalanche Mortar', 2, { damage: 8, fireRate: -0.5 }, 'Bring the mountain down on them.', { mod: 'spread', icon: 'iconShotgun', unlock: 'armory' }),
  gun('vampireDerringer', 'Vampire Derringer', 2, { damage: 4 }, 'Drinks deep.', { mod: 'leech', unlock: 'armory' }),
  gun('gatlingPole', 'Gatling Pole', 2, { damage: 1, fireRate: 0.9 }, 'Brrrrrrt.', { icon: 'iconRifle', unlock: 'armory' }),
  // --- Skis ------------------------------------------------------------------------------------
  gear('skis', 'rentalPlanks', 'Rental Planks', 0, { speed: 0.04, evasion: 0.02 }, 'Somebody else’s wax.', { icon: 'iconSkis' }),
  gear('skis', 'handMeDowns', 'Hand-me-downs', 0, { speed: 0.05 }, 'They were Dad’s.', { icon: 'iconSkis' }),
  gear('skis', 'crossCountry', 'Cross-country Skis', 0, { speed: 0.03 }, 'Built for going up as well as down.', { mod: 'skate', icon: 'iconSkis' }),
  gear('skis', 'telemarks', 'Telemark Skis', 0, { speed: 0.03, accuracy: 0.03 }, 'Free the heel, free the mind.', { mod: 'plowSpeed', icon: 'iconSkis' }),
  gear('skis', 'racingCarvers', 'Racing Carvers', 1, { speed: 0.1, evasion: 0.04 }, 'Edges like knives.', { icon: 'iconSkis' }),
  gear('skis', 'waxedTwinTips', 'Waxed Twin Tips', 1, { speed: 0.06 }, 'Both ends point at the sky.', { mod: 'twinTips', icon: 'iconSkis' }),
  gear('skis', 'mogulMasters', 'Mogul Masters', 1, { speed: 0.05 }, 'Knees of steel included.', { mod: 'mogulMaster', icon: 'iconSkis' }),
  gear('skis', 'iceEdges', 'Ice Edges', 1, { speed: 0.06 }, 'Sharpened on a glacier.', { mod: 'iceEdge', icon: 'iconSkis' }),
  gear('skis', 'powderFatties', 'Powder Fatties', 1, { speed: 0.04 }, 'Float like a butterfly.', { mod: 'powderSkis', icon: 'iconSkis', unlock: 'rental' }),
  gear('skis', 'rocketSkis', 'Rocket Skis', 2, { speed: 0.25, accuracy: -0.05 }, 'Not street legal.', { icon: 'iconSkis' }),
  gear('skis', 'steadyCarvers', 'Steady Carvers', 2, { speed: 0.1 }, 'Tuck and aim, both at once.', { mod: 'steady', icon: 'iconSkis', unlock: 'rental' }),
  gear('skis', 'ghostSkis', 'Ghost Skis', 2, { speed: 0.12, evasion: 0.12 }, 'Leave no tracks.', { icon: 'iconSkis', unlock: 'rental' }),
  // --- Goggles ---------------------------------------------------------------------------------
  gear('goggles', 'foggedGoggles', 'Fogged Goggles', 0, { accuracy: 0.03 }, 'Better than nothing. Barely.', { icon: 'iconGoggles' }),
  gear('goggles', 'skiShades', 'Ski Shades', 0, { accuracy: 0.05 }, 'Very après.', { icon: 'iconGoggles' }),
  gear('goggles', 'cheapSunglasses', 'Cheap Sunglasses', 0, { crit: 0.03 }, 'Two for one at the gas station.', { icon: 'iconGoggles' }),
  gear('goggles', 'polarized', 'Polarized Lenses', 1, { accuracy: 0.1 }, 'Glare? What glare?', { icon: 'iconGoggles' }),
  gear('goggles', 'nightGoggles', 'Night Goggles', 1, { accuracy: 0.05 }, 'Everything is green and guilty.', { mod: 'nightVision', icon: 'iconGoggles' }),
  gear('goggles', 'whiteoutLenses', 'Whiteout Lenses', 1, { accuracy: 0.05 }, 'Yellow tint, clear head.', { mod: 'whiteoutLens', icon: 'iconGoggles' }),
  gear('goggles', 'scopeGoggles', 'Scope Goggles', 1, { range: 0.4, accuracy: 0.04 }, 'A rifle scope, strapped on.', { icon: 'iconGoggles' }),
  gear('goggles', 'luckyLenses', 'Lucky Lenses', 1, { crit: 0.03 }, 'Rose-tinted, four-leaf frames.', { mod: 'lucky', icon: 'iconGoggles' }),
  gear('goggles', 'xraySpecs', 'X-Ray Specs', 2, { accuracy: 0.12, crit: 0.08, range: 0.3 }, 'See through walls, jackets and lies.', { icon: 'iconGoggles' }),
  gear('goggles', 'thermalVisor', 'Thermal Visor', 2, { accuracy: 0.1, crit: 0.04 }, 'Warm bodies glow.', { mod: 'thermal', icon: 'iconGoggles', unlock: 'armory' }),
  // --- Jackets ---------------------------------------------------------------------------------
  gear('jacket', 'pufferJacket', 'Puffer Jacket', 0, { maxHp: 6, defense: 1 }, 'You look like a marshmallow. A safe one.', { icon: 'iconJacket' }),
  gear('jacket', 'thriftAnorak', 'Thrift Anorak', 0, { maxHp: 4, regen: 0.2 }, 'Smells of someone else’s adventures.', { icon: 'iconJacket' }),
  gear('jacket', 'woolSweater', 'Wool Sweater', 0, { maxHp: 8 }, 'Knitted by a worried grandmother.', { icon: 'iconJacket' }),
  gear('jacket', 'tuxedoParka', 'Tuxedo Parka', 1, { maxHp: 6, defense: 1 }, 'Shaken, not stirred.', { mod: 'style', icon: 'iconJacket' }),
  gear('jacket', 'insulatedTrench', 'Insulated Trench', 1, { maxHp: 10, defense: 2 }, 'Collar up, brim down.', { icon: 'iconJacket' }),
  gear('jacket', 'camoSmock', 'Camo Smock', 1, { maxHp: 6 }, 'Snow pattern. You were never here.', { mod: 'camo', icon: 'iconJacket' }),
  gear('jacket', 'heatedVest', 'Heated Vest', 1, { maxHp: 6, regen: 0.8 }, 'Battery included.', { icon: 'iconJacket' }),
  gear('jacket', 'spikedSuit', 'Spiked Suit', 1, { maxHp: 8, defense: 1 }, 'Hugs are off the table.', { mod: 'spiked', icon: 'iconJacket' }),
  gear('jacket', 'kevlarOnesie', 'Kevlar Onesie', 2, { maxHp: 16, defense: 4 }, 'Bulletproof, fashion-proof.', { icon: 'iconJacket' }),
  gear('jacket', 'avalancheAirbag', 'Avalanche Airbag', 2, { maxHp: 10, defense: 2 }, 'Pull the cord. Pray.', { mod: 'beacon', icon: 'iconJacket', unlock: 'rental' }),
  gear('jacket', 'yetiPelt', 'Yeti Pelt', 2, { maxHp: 45, regen: 1, defense: 3 }, 'Still warm.', { icon: 'iconJacket', unique: true }),
  // --- Gadgets ---------------------------------------------------------------------------------
  gadget('treeHugger', 'Tree Hugger', 1, 'Pine-scented air freshener, standard issue.'),
  gadget('airhead', 'Airhead', 1, 'A helmet cam and no fear.'),
  gadget('plowReload', 'Plow Reload', 1, 'Slow down, load up.'),
  gadget('insurance', 'Yard Sale Insurance', 1, 'Covers skis, poles and pride.'),
  gadget('speedDemon', 'Speed Demon', 1, 'A tiny devil on your shoulder.'),
  gadget('liftPass', 'Season Pass', 1, 'Laminated, lucky.'),
  gadget('snowballs', 'Exploding Snowballs', 2, 'Packed with something extra.'),
  gadget('grapple', 'Grappling Hook', 1, 'For when the lift is too slow.'),
  gadget('magnet', 'Loot Magnet', 1, 'Attracts gear and trouble.'),
  gadget('flask', 'Hip Flask', 1, 'Hot cocoa. Probably.'),
  gadget('coupon', 'Coupon Book', 1, 'Valid on all mountains.'),
  gadget('rabbitFoot', "Rabbit's Foot", 1, 'Not lucky for the rabbit.'),
  gadget('briefcase', 'Briefcase', 2, 'Handcuffed to your wrist.', { unlock: 'spyHq' }),
  gadget('piggyBank', 'Piggy Bank', 1, 'Oink.'),
  gadget('monocle', "The Widow's Monocle", 2, 'Cold glass, colder eye.', { unique: true }),
  gadget('sled', 'Getaway Sled', 2, 'Never once used the brakes.', { unique: true }),
];

export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEM_DEFS.map((d) => [d.id, d]));

/** Items that can drop (not starters or boss rewards). */
export const DROPPABLE = ITEM_DEFS.filter((d) => !d.unique && !d.starter);

/** Which of the buildings that unlock gear you have. */
export type GearUnlocks = Partial<Record<ItemUnlock, boolean>>;

const r2 = (n: number) => Math.round(n * 100) / 100;
const WHOLE: StatKey[] = ['maxHp', 'damage', 'defense'];

/** An item made from its def at a level: whole-number stats grow 30% a level, the rest 8%. */
export function makeItem(def: ItemDef, id: number, level: number): Item {
  const stats: Item['stats'] = {};
  for (const [k, v] of Object.entries(def.stats) as [StatKey, number][]) {
    if (v < 0) stats[k] = v;
    else if (WHOLE.includes(k)) stats[k] = Math.round(v * (1 + 0.3 * (level - 1)));
    else stats[k] = r2(v * (1 + 0.08 * (level - 1)));
  }
  return { id, def: def.id, slot: def.slot, name: def.name, rarity: def.rarity, level, stats, mod: def.mod, unique: def.unique };
}

const pool = (slot: ItemDef['slot'], rarity: Rarity, unlocks: GearUnlocks) =>
  DROPPABLE.filter((d) => d.slot === slot && d.rarity === rarity && (!d.unlock || unlocks[d.unlock]));

/** A random piece of gear (or, with gadget drops on, sometimes a gadget) at a level. */
export function rollItem(rng: Rng, id: number, level: number, rarityBoost: number, gadgets: boolean, unlocks: GearUnlocks = {}): Item {
  const roll = rng.next() + rarityBoost;
  const rarity: Rarity = roll > 1.08 ? 2 : roll > 0.8 ? 1 : 0;
  if (gadgets && rng.chance(0.08 + rarity * 0.08)) return rollGadget(rng, id, level, rarity, unlocks);
  const slot = rng.pick(['gun', 'skis', 'goggles', 'jacket'] as const);
  for (let r = rarity; r >= 0; r--) {
    const options = pool(slot, r as Rarity, unlocks);
    if (options.length) return makeItem(rng.pick(options), id, level);
  }
  return makeItem(ITEM_BY_ID.capGun, id, level);
}

export function rollGadget(rng: Rng, id: number, level: number, rarity: Rarity = 2, unlocks: GearUnlocks = {}): Item {
  const options = DROPPABLE.filter((d) => d.slot === 'gadget' && d.rarity <= Math.max(1, rarity) && (!d.unlock || unlocks[d.unlock]));
  return makeItem(rng.pick(options), id, level);
}

/** The one-of-a-kind reward each dossier boss drops. */
export function uniqueReward(boss: 'widow' | 'yetiKing' | 'kickback', id: number): Item {
  const def = { widow: 'monocle', yetiKing: 'yetiPelt', kickback: 'sled' }[boss];
  return makeItem(ITEM_BY_ID[def], id, 1);
}

/** What you head out with: a pocket pistol, or with the Armory built, a silenced .22. */
export const STARTER_GUN = (id: number, armory = false): Item => makeItem(ITEM_BY_ID[armory ? 'silenced22' : 'pocketPistol'], id, 1);

/** Old saves and tests: gadgets by mod. */
export const GADGET_IDS: ModId[] = DROPPABLE.filter((d) => d.slot === 'gadget').map((d) => d.mod!);
