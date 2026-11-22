// One expedition: the skier skis the mountain while you build it with cards. Everything here
// is deterministic. Commands (stance, placing a card, flipping a junction, equipping, the lodge
// decision) are the only thing that enters, so a run replays exactly from its seed and commands.

import { BOSS_OF, canPlace, CARDS, countAround, markDoubleBlacks, newTiles, ROUTE_OF, type CardId, type Tiles } from './cards';
import { DT, HAND_SIZE, INVENTORY_SIZE, MAP_W, MAX_ENEMIES_PER_TILE } from './constants';
import { difficultyMods, ENEMIES, isBoss, levelScale, type BossKind, type Enemy, type EnemyKind } from './enemies';
import { rollGadget, rollItem, STARTER_GUN, uniqueReward, type Item, type Slot } from './items';
import {
  cell,
  dirOf,
  generateMap,
  isPiste,
  LODGE,
  neighbours,
  nodeAt,
  rideNode,
  ridePos,
  type MountainMap,
  type Ride,
  type Route,
} from './map';
import { hashSeed, Rng, type RngState } from './rng';
import { computeStats, hasGadget, NO_BONUSES, powderHeal, STANCES, type Equipment, type LodgeBonuses, type Stance, type Stats } from './stats';

export const RUN_VERSION = 4;

export type RunStatus = 'riding' | 'lodge' | 'won' | 'retreated' | 'bailed' | 'wiped';
export type WeatherKind = 'whiteout' | 'night';

/** How weather bends the rules while it lasts. */
export const WEATHER = {
  /** Laps it lasts, counting the one it starts in. */
  laps: 2,
  whiteoutRange: 0.6,
  whiteoutChips: 2,
  nightEnemyAim: 0.6,
  nightAim: 0.85,
  nightLoot: 1.5,
};

export interface HandLine {
  label: string;
  chips: number;
  mult: number;
  count: number;
}

/** This lap's score so far: Balatro's chips and mult. It cashes in at the lodge. */
export interface LapHand {
  chips: number;
  mult: number;
  combo: number;
  lines: HandLine[];
}

/** Something for sale in the shop beside the hand. */
export type ShopOffer = { kind: 'card'; card: CardId; price: number };

/** The shop: three offers that reroll whenever you buy one, or pay to reroll. */
export const SHOP = {
  size: 3,
  /** Prices rise this much per lap after the first. */
  lapScale: 0.2,
  rerollBase: 10,
  rerollStep: 5,
  /** Cards dealt into your hand at the start of an expedition. */
  startingHand: 4,
};

export interface Payout {
  cash: number;
  intel: number;
  scrap: number;
  /** Share kept: 1 at the lodge or after the boss, 0.6 for bailing out, 0.3 for a wipeout. */
  fraction: number;
}

export interface RunState {
  version: number;
  seed: string;
  /** How hard the mountain is (from what's built on it), 0 to 4: see difficultyMods. */
  difficulty: number;
  tick: number;
  rng: RngState;
  tiles: Tiles;
  /** Lifts and chutes you've built, in the order you built them, with their junction switches. */
  routes: Route[];
  hero: { ride: Ride; hp: number; stance: Stance; cooldown: number; airborne: boolean };
  enemies: Enemy[];
  nextId: number;
  hand: CardId[];
  deck: CardId[];
  inventory: Item[];
  equipment: Equipment;
  bonuses: LodgeBonuses;
  lap: number;
  /** Descents so far this expedition, counting the one under way. New enemies arrive at this level. */
  descent: number;
  /** Descents in the current lap: more than one means you rode a lift instead of going home. */
  lapDescents: number;
  /** Card points to spend in the shop: every chip you earn pays chips x your mult at that moment. */
  points: number;
  shop: ShopOffer[];
  /** Paid rerolls this lap (each costs more than the last). */
  rerolls: number;
  /** This lap so far: points earned, enemies down, and the cash bounty that banks at the lodge. */
  lapPoints: number;
  lapKills: number;
  lapBounty: number;
  lapTime: number;
  /** How long this lap's route would take at a cruise, for the fast-lap bonus. */
  lapPar: number;
  boss: { meter: number; max: number; spawned: boolean };
  lapHand: LapHand;
  permanentMult: number;
  /** The weather over the whole mountain, and how many more laps it lasts (this one included). */
  weather: { kind: WeatherKind; laps: number } | null;
  /** Intel fragments towards the next dossier (three make one). */
  fragments: number;
  cash: number;
  intel: number;
  scrap: number;
  record: { kills: number; bestLap: number; placed: number; items: number; descents: number; bosses: BossKind[]; bought: number };
  status: RunStatus;
  payout: Payout | null;
}

export type Command =
  | { type: 'stance'; stance: Stance }
  | { type: 'place'; hand: number; x: number; y: number }
  | { type: 'burn'; hand: number }
  | { type: 'buy'; offer: number }
  | { type: 'reroll' }
  | { type: 'switch'; route: number }
  | { type: 'equip'; item: number }
  | { type: 'salvage'; item: number }
  | { type: 'rideAgain' }
  | { type: 'retreat' }
  | { type: 'bail' };

export type RunEvent =
  | { type: 'shot'; fromX: number; fromY: number; toX: number; toY: number; hit: boolean; damage: number; crit: boolean; target: number }
  | { type: 'enemyShot'; enemy: number; kind: EnemyKind; fromX: number; fromY: number; toX: number; toY: number; hit: boolean; damage: number; air: boolean }
  | { type: 'kill'; enemy: number; kind: EnemyKind; x: number; y: number; chips: number }
  | { type: 'spawn'; enemy: number; kind: EnemyKind }
  | { type: 'placed'; card: CardId; x: number; y: number }
  | { type: 'route'; route: number; x: number; y: number }
  | { type: 'switch'; route: number; take: boolean }
  | { type: 'chain'; descents: number; x: number; y: number }
  | { type: 'avalanche'; x: number; y: number }
  | { type: 'doubleBlack'; x: number; y: number }
  | { type: 'chips'; label: string; chips: number; mult: number; x: number; y: number }
  | { type: 'loot'; what: 'card' | 'item' | 'intel' | 'scrap'; label: string; x: number; y: number }
  | { type: 'heal'; amount: number; x: number; y: number }
  | { type: 'heroHit'; damage: number }
  | { type: 'mine'; x: number; y: number; hit: boolean; damage: number }
  | { type: 'planted'; x: number; y: number }
  | { type: 'enemyHeal'; x: number; y: number; amount: number }
  | { type: 'lap'; lap: number; chips: number; mult: number; points: number; kills: number; bounty: number; lines: HandLine[]; lapTime: number; descents: number }
  | { type: 'bought'; card: CardId; price: number }
  | { type: 'reroll'; price: number }
  | { type: 'wave'; lap: number; descent: number; count: number; chained: boolean }
  | { type: 'boss' }
  | { type: 'weather'; kind: WeatherKind | null }
  | { type: 'bossArrives'; kind: EnemyKind }
  | { type: 'bossDown'; kind: BossKind; reward: string }
  | { type: 'fragment'; count: number; x: number; y: number }
  | { type: 'dossier'; card: CardId; boss: BossKind }
  | { type: 'discard'; card: CardId }
  | { type: 'end'; status: RunStatus; payout: Payout };

/** A special tile laid on the mountain before the run, as a card on that trail tile. */
export interface Feature {
  x: number;
  y: number;
  card: CardId;
}

export interface RunOptions {
  seed: string;
  difficulty?: number;
  /** Routes already built on the mountain (from the mountain view), switches as set there. */
  routes?: Route[];
  features?: Feature[];
  deck: CardId[];
  bonuses?: LodgeBonuses;
}

const KILL_LINES: Record<EnemyKind, string> = {
  guard: 'Guards',
  sniper: 'Snipers',
  snowmobile: 'Snowmobiles',
  yeti: 'Yetis',
  sapper: 'Sappers',
  medic: 'Medics',
  hound: 'Hounds',
  baron: 'The Baron',
  widow: 'The Ice Widow',
  yetiKing: 'The Yeti King',
  kickback: 'Captain Kickback',
};

/** Chance each kind drops an intel fragment, from lap FRAGMENT_LAP on. */
const FRAGMENT_CHANCE: Partial<Record<EnemyKind, number>> = { guard: 0.05, sniper: 0.3, snowmobile: 0.3, sapper: 0.3, medic: 0.3, hound: 0.04, yeti: 1 };
export const FRAGMENT_LAP = 2;
const DOSSIER_FOR: Record<BossKind, CardId> = { widow: 'dossierWidow', yetiKing: 'dossierYetiKing', kickback: 'dossierKickback' };
export const FRAGMENTS_PER_DOSSIER = 3;
/** Cash for beating a dossier boss. */
export const BOSS_BOUNTY = 1000;

/** What enemy cards send at the start of each descent: inclusive ranges and chances. */
export const SPAWNS = {
  patrol: [1, 2] as const,
  checkpoint: [1, 3] as const,
  cabin: [0, 2] as const,
  garageSecond: 0.4,
  dbdYeti: 0.6,
  maxChasers: 4,
  caveYeti: 0.55,
  caveMax: 2,
  kennel: [2, 3] as const,
  maxHounds: 6,
};

/** Specialists' timers and the damage a mine does (scaled by level like a gunshot). */
export const SPECIALISTS = { mineEvery: 7, mineDamage: 12, mineAirChips: 20, healEvery: 3, healShare: 0.25, healReach: 2 };

/** Kills drop cards less often now the shop sells them. */
const KILL_CARDS = 0.5;

/** Seconds between the Yeti King's calls. */
const KING_CALL = 10;

/** Each lap's own wave: `base` plus `perLap` a lap, plus up to `spread` more, at most `max`. */
export const WAVE = { base: 2, perLap: 0.5, spread: 1, max: 8 };

/** Offsets so up to three enemies on one tile stand apart. */
const SLOT_OFFSETS = [
  [0, 0.05],
  [-0.26, -0.18],
  [0.26, -0.18],
];

/** Tuning for the route network. */
export const ROUTE_TUNING = {
  /** Mult for each extra descent chained in one lap (riding a lift instead of going home). */
  chainMult: 1,
  /** Mult for each chute tile, at any stance. */
  steepMult: 0.2,
  /** Aim in a chute. */
  chuteAim: 0.85,
  /** Tiles a second skating back uphill on a trail path. */
  climb: 1.1,
};

const freshHand = (permanentMult: number): LapHand => ({ chips: 0, mult: 1 + permanentMult, combo: 0, lines: [] });

export class Run {
  /** Rebuilt whenever a route is placed; compare by identity to notice. */
  map: MountainMap;
  readonly state: RunState;
  /** Stats as of the last tick, for the HUD. */
  stats: Stats;
  private readonly rng: Rng;
  private events: RunEvent[] = [];

  private constructor(state: RunState) {
    this.state = state;
    this.map = generateMap(state.seed, state.routes);
    this.rng = new Rng(state.rng);
    this.stats = computeStats(state.equipment, state.tiles, state.bonuses);
  }

  static create(options: RunOptions): Run {
    const bonuses = options.bonuses ?? NO_BONUSES;
    const difficulty = options.difficulty ?? 0;
    const state: RunState = {
      version: RUN_VERSION,
      seed: options.seed,
      difficulty,
      tick: 0,
      rng: hashSeed(`run:${options.seed}`),
      tiles: newTiles(),
      routes: (options.routes ?? []).map((r) => ({ ...r, cells: r.cells ? [...r.cells] : undefined })),
      hero: { ride: { at: LODGE, to: 1, f: 0 }, hp: 0, stance: 'cruise', cooldown: 0, airborne: false },
      enemies: [],
      nextId: 1,
      hand: [],
      deck: [...options.deck],
      inventory: [],
      equipment: { gun: STARTER_GUN(0, bonuses.armory), skis: null, goggles: null, jacket: null, gadget1: null, gadget2: null },
      bonuses,
      lap: 1,
      descent: 1,
      lapDescents: 1,
      points: 0,
      shop: [],
      rerolls: 0,
      lapPoints: 0,
      lapKills: 0,
      lapBounty: 0,
      lapTime: 0,
      lapPar: 0,
      boss: { meter: 0, max: difficultyMods(difficulty).boss, spawned: false },
      lapHand: freshHand(0),
      permanentMult: 0,
      weather: null,
      fragments: 0,
      cash: 0,
      intel: 0,
      scrap: 0,
      record: { kills: 0, bestLap: 0, placed: 0, items: 0, descents: 0, bosses: [], bought: 0 },
      status: 'riding',
      payout: null,
    };
    const run = new Run(state);
    for (const f of options.features ?? []) {
      const i = nodeAt(run.map, f.x, f.y);
      if (isPiste(run.map, i)) state.tiles[cell(f.x, f.y)] = { card: f.card, timer: 0, lastLap: -1, variant: null };
    }
    state.hero.ride.to = run.choose(LODGE);
    state.hero.hp = run.stats.maxHp;
    for (let i = 0; i < SHOP.startingHand; i++) run.drawCard();
    run.rollShop();
    // The mountain is never empty: the first lap's enemies are already out on the trail.
    run.startDescent(true);
    run.events = [];
    return run;
  }

  static restore(snapshot: RunState | string): Run {
    const state: RunState = typeof snapshot === 'string' ? JSON.parse(snapshot) : structuredClone(snapshot);
    if (state.version !== RUN_VERSION) throw new Error(`Unsupported run version ${state.version}`);
    return new Run(state);
  }

  snapshot(): RunState {
    return structuredClone(this.state);
  }

  drainEvents(): RunEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }

  get done(): boolean {
    const s = this.state.status;
    return s !== 'riding' && s !== 'lodge';
  }

  heroPos(): { x: number; y: number } {
    return ridePos(this.map, this.state.hero.ride);
  }

  /** The node the skier is on. */
  heroNode(): number {
    return rideNode(this.state.hero.ride);
  }

  canPlace(card: CardId, x: number, y: number): boolean {
    return canPlace(this.map, this.state.tiles, card, x, y);
  }

  /** Where a junction sends you from node `at`. */
  choose(at: number): number {
    const n = this.map.nodes[at];
    return n.next.length > 1 && this.state.routes[n.junction]?.take ? n.next[1] : n.next[0];
  }

  /** The next junction ahead of the skier along the way the switches point, if any. */
  nextJunction(): number {
    let at = this.state.hero.ride.to;
    for (let k = 0; k < this.map.nodes.length; k++) {
      const n = this.map.nodes[at];
      if (n.junction >= 0) return n.junction;
      if (at === LODGE && k > 0) return -1;
      at = this.choose(at);
    }
    return -1;
  }

  /** The route that branches off at cell (x, y), or -1. */
  junctionAt(x: number, y: number): number {
    const i = nodeAt(this.map, x, y);
    return i >= 0 ? this.map.nodes[i].junction : -1;
  }

  // --- The tick -----------------------------------------------------------------------------

  /**
   * Applies commands between ticks without advancing time, so you can plan while paused.
   * A replay records each command with the tick it was applied on.
   */
  applyCommands(commands: readonly Command[]): void {
    for (const c of commands) this.apply(c);
  }

  step(commands: readonly Command[] = []): void {
    const st = this.state;
    for (const c of commands) this.apply(c);
    st.tick++;
    if (st.status !== 'riding') return;

    this.stats = computeStats(st.equipment, st.tiles, st.bonuses);
    st.lapTime += DT;
    if (this.move()) return; // lap complete: the lodge decision waits
    this.heal();
    this.abilities();
    this.combat();
    if (st.status === 'riding' && st.hero.hp <= 0) this.end('wiped');
  }

  private apply(c: Command): void {
    const st = this.state;
    const live = st.status === 'riding' || st.status === 'lodge';
    switch (c.type) {
      case 'stance':
        st.hero.stance = c.stance;
        break;
      case 'place':
        if (live) this.place(c.hand, c.x, c.y);
        break;
      case 'burn':
        if (live && st.hand[c.hand]) {
          st.hand.splice(c.hand, 1);
          st.intel++;
        }
        break;
      case 'buy':
        if (live) this.buy(c.offer);
        break;
      case 'reroll':
        if (live && st.points >= this.rerollPrice()) {
          const price = this.rerollPrice();
          st.points -= price;
          st.rerolls++;
          this.rollShop();
          this.events.push({ type: 'reroll', price });
        }
        break;
      case 'switch': {
        const r = st.routes[c.route];
        if (live && r) {
          r.take = !r.take;
          this.events.push({ type: 'switch', route: c.route, take: r.take });
        }
        break;
      }
      case 'equip':
        if (live) this.equip(c.item);
        break;
      case 'salvage':
        if (live && st.inventory[c.item]) {
          st.scrap += 1 + st.inventory[c.item].rarity * 2;
          st.inventory.splice(c.item, 1);
        }
        break;
      case 'rideAgain':
        if (st.status === 'lodge') {
          st.status = 'riding';
          st.lap++;
          st.descent++;
          st.lapDescents = 1;
          st.lapTime = 0;
          st.lapPar = 0;
          st.rerolls = 0;
          st.hero.ride = { at: LODGE, to: this.choose(LODGE), f: 0 };
          this.startDescent(true);
        }
        break;
      case 'retreat':
        if (st.status === 'lodge') this.end('retreated');
        break;
      case 'bail':
        if (st.status === 'riding') this.end('bailed');
        break;
    }
  }

  // --- Cards --------------------------------------------------------------------------------

  /** A card from `pool`, by draw weight. */
  private pickCard(pool: readonly CardId[]): CardId {
    const total = pool.reduce((sum, id) => sum + CARDS[id].weight, 0);
    let roll = this.rng.next() * total;
    for (const id of pool) {
      roll -= CARDS[id].weight;
      if (roll < 0) return id;
    }
    return pool[0];
  }

  drawCard(): void {
    this.addToHand(this.pickCard(this.state.deck));
  }

  /** Into the hand; a full hand burns its oldest card for 1 intel. */
  private addToHand(card: CardId): void {
    const st = this.state;
    st.hand.push(card);
    if (st.hand.length > HAND_SIZE) {
      const dropped = st.hand.shift()!;
      st.intel++;
      this.events.push({ type: 'discard', card: dropped });
    }
  }

  // --- The shop -----------------------------------------------------------------------------

  /** What a card costs in the shop this lap. */
  price(card: CardId): number {
    return Math.round(CARDS[card].cost * (1 + SHOP.lapScale * (this.state.lap - 1)));
  }

  rerollPrice(): number {
    return SHOP.rerollBase + SHOP.rerollStep * this.state.rerolls;
  }

  /** Three fresh offers from your deck, no two alike while the deck allows. */
  rollShop(): void {
    const st = this.state;
    const pool = st.deck.filter((id) => CARDS[id].weight > 0);
    const offers: ShopOffer[] = [];
    for (let k = 0; k < SHOP.size && pool.length; k++) {
      const fresh = pool.filter((id) => !offers.some((o) => o.card === id));
      const card = this.pickCard(fresh.length ? fresh : pool);
      offers.push({ kind: 'card', card, price: this.price(card) });
    }
    st.shop = offers;
  }

  private buy(index: number): void {
    const st = this.state;
    const offer = st.shop[index];
    if (!offer || st.points < offer.price) return;
    st.points -= offer.price;
    st.record.bought++;
    this.addToHand(offer.card);
    this.events.push({ type: 'bought', card: offer.card, price: offer.price });
    this.rollShop();
  }

  private place(handIndex: number, x: number, y: number): void {
    const st = this.state;
    const card = st.hand[handIndex];
    if (!card || !this.canPlace(card, x, y)) return;
    st.hand.splice(handIndex, 1);
    const c = cell(x, y);
    const before = this.stats.maxHp;
    const route = ROUTE_OF[card];
    const boss = BOSS_OF[card];

    if (card === 'whiteout' || card === 'night') {
      st.weather = { kind: card, laps: WEATHER.laps };
      st.record.placed++;
      this.events.push({ type: 'weather', kind: card });
    } else if (boss) {
      this.summon(boss, x, y);
    } else if (route) {
      // New routes open straight away: the switch starts on the route you just built.
      st.routes.push({ kind: route, x, y, take: true });
      this.map = generateMap(st.seed, st.routes);
      st.record.placed++;
      this.events.push({ type: 'placed', card, x, y });
      this.events.push({ type: 'route', route: st.routes.length - 1, x, y });
    } else if (card === 'avalanche') {
      st.tiles[c] = null;
      st.enemies = st.enemies.filter((e) => e.ride || Math.abs(e.x - (x + 0.5)) > 1.5 || Math.abs(e.y - (y + 0.5)) > 1.5);
      markDoubleBlacks(st.tiles);
      this.events.push({ type: 'avalanche', x, y });
    } else {
      st.tiles[c] = { card, timer: card === 'patrol' ? 2 : card === 'boulder' || card === 'peak' ? 4 : 3, lastLap: -1, variant: null };
      st.record.placed++;
      this.events.push({ type: 'placed', card, x, y });
      if (card === 'patrol' || card === 'checkpoint') this.spawn('guard', x, y, c);
      if (card === 'sniper') this.spawn('sniper', x, y, c);
      if (card === 'demoShack') this.spawn('sapper', x, y, c);
      if (card === 'fieldHospital') this.spawn('medic', x, y, c);
      if (card === 'boulder' || card === 'peak') {
        const had = st.tiles.filter((t) => t?.variant === 'dbd').length;
        markDoubleBlacks(st.tiles);
        if (st.tiles.filter((t) => t?.variant === 'dbd').length > had) this.events.push({ type: 'doubleBlack', x, y });
      }
    }

    // New max HP from the mountain comes with the HP to fill it.
    this.stats = computeStats(st.equipment, st.tiles, st.bonuses);
    if (this.stats.maxHp > before) st.hero.hp += this.stats.maxHp - before;
    st.hero.hp = Math.min(st.hero.hp, this.stats.maxHp);

    st.boss.meter += CARDS[card].boss;
    if (!st.boss.spawned && st.boss.meter >= st.boss.max) {
      st.boss.spawned = true;
      const top = this.map.nodes[this.map.summit];
      this.spawn('baron', top.x, top.y, -1, this.map.summit);
      this.events.push({ type: 'boss' });
      this.events.push({ type: 'bossArrives', kind: 'baron' });
    }
  }

  /** A dossier boss takes the field at (x, y). */
  private summon(boss: BossKind, x: number, y: number): void {
    const st = this.state;
    if (boss === 'kickback') this.spawn('kickback', x, y, -1, nodeAt(this.map, x, y));
    else this.spawn(boss, x, y, cell(x, y));
    if (boss === 'widow') {
      // She freezes the trail around her: the nearest open trail tiles turn to ice.
      const around = this.map.nodes
        .map((n, i) => ({ n, i, d: Math.max(Math.abs(n.x - x), Math.abs(n.y - y)) }))
        .filter(({ n, i, d }) => d > 0 && d <= 2 && isPiste(this.map, i) && !st.tiles[cell(n.x, n.y)])
        .sort((a, b) => a.d - b.d || a.i - b.i)
        .slice(0, 5);
      for (const { n } of around) {
        st.tiles[cell(n.x, n.y)] = { card: 'ice', timer: 3, lastLap: -1, variant: null };
        this.events.push({ type: 'placed', card: 'ice', x: n.x, y: n.y });
      }
    }
    this.events.push({ type: 'bossArrives', kind: boss });
  }

  /** Three fragments make a dossier: a boss card for one you haven't faced this expedition. */
  private addDossier(): void {
    const st = this.state;
    const all: BossKind[] = ['widow', 'yetiKing', 'kickback'];
    const fresh = all.filter((b) => !st.record.bosses.includes(b) && !st.hand.includes(DOSSIER_FOR[b]));
    const boss = this.rng.pick(fresh.length ? fresh : all);
    this.addToHand(DOSSIER_FOR[boss]);
    this.events.push({ type: 'dossier', card: DOSSIER_FOR[boss], boss });
  }

  private equip(index: number): void {
    const st = this.state;
    const item = st.inventory[index];
    if (!item) return;
    let slot: Slot;
    if (item.slot === 'gadget') {
      slot = !st.equipment.gadget1 ? 'gadget1' : st.bonuses.gadgetSlots > 1 && !st.equipment.gadget2 ? 'gadget2' : 'gadget1';
    } else slot = item.slot;
    const before = this.stats.maxHp;
    const old = st.equipment[slot];
    st.equipment[slot] = item;
    st.inventory.splice(index, 1);
    if (old) st.inventory.push(old);
    this.stats = computeStats(st.equipment, st.tiles, st.bonuses);
    if (this.stats.maxHp > before) st.hero.hp += this.stats.maxHp - before;
    st.hero.hp = Math.min(st.hero.hp, this.stats.maxHp);
  }

  // --- Enemies ------------------------------------------------------------------------------

  /** Enemies holding the tile at cell c. */
  enemiesAt(c: number): Enemy[] {
    return this.state.enemies.filter((e) => !e.ride && cell(Math.floor(e.x), Math.floor(e.y)) === c);
  }

  /** Spawns an enemy holding tile (x, y), or, given a node, chasing along the path from there. */
  private spawn(kind: EnemyKind, x: number, y: number, home: number, from = -1): Enemy | null {
    const st = this.state;
    const def = ENEMIES[kind];
    let ex = x + 0.5;
    let ey = y + 0.5;
    let ride: Ride | null = null;
    if (from < 0 && isBoss(kind)) {
      ey -= 0.1;
    } else if (from < 0) {
      const here = this.enemiesAt(cell(x, y));
      if (here.length >= MAX_ENEMIES_PER_TILE) return null;
      const used = new Set(here.map((e) => `${(e.x - x - 0.5).toFixed(2)}`));
      const off = SLOT_OFFSETS.find(([ox]) => !used.has(ox.toFixed(2))) ?? SLOT_OFFSETS[0];
      ex += off[0];
      ey += off[1];
    } else {
      ride = { at: from, to: this.choose(from), f: 0 };
      const p = ridePos(this.map, ride);
      ex = p.x;
      ey = p.y;
    }
    // Bosses have fixed stats; everything else levels up with the descent it arrives on.
    const level = isBoss(kind) ? 1 : st.descent;
    const scale = levelScale(level, st.difficulty);
    const enemy: Enemy = {
      id: st.nextId++,
      kind,
      level,
      hp: Math.round(def.hp * scale.hp),
      maxHp: Math.round(def.hp * scale.hp),
      x: ex,
      y: ey,
      ride,
      home,
      cooldown: this.rng.range(0.4, def.interval),
    };
    if (kind === 'yetiKing') enemy.ability = KING_CALL;
    if (kind === 'sapper') enemy.ability = SPECIALISTS.mineEvery * 0.6;
    if (kind === 'medic') enemy.ability = SPECIALISTS.healEvery;
    st.enemies.push(enemy);
    this.events.push({ type: 'spawn', enemy: enemy.id, kind });
    return enemy;
  }

  /** Trail nodes next to cell (x, y), preferring the four straight neighbours. */
  private trailNeighbours(x: number, y: number): number[] {
    const out: number[] = [];
    for (const [nx, ny] of neighbours(x, y)) {
      const i = nodeAt(this.map, nx, ny);
      if (isPiste(this.map, i) && (nx === x || ny === y)) out.push(i);
    }
    if (!out.length)
      for (const [nx, ny] of neighbours(x, y)) {
        const i = nodeAt(this.map, nx, ny);
        if (isPiste(this.map, i)) out.push(i);
      }
    return out;
  }

  /** Where a chaser leaves from: the trail beside its tile, or the nearest within two tiles. */
  private chaseFrom(x: number, y: number): number[] {
    const beside = this.trailNeighbours(x, y);
    return beside.length ? beside : this.trailNear(x, y, 2);
  }

  private nearestTrail(x: number, y: number): number {
    let best = -1;
    let bestD = Infinity;
    this.map.nodes.forEach((p, i) => {
      if (!isPiste(this.map, i) || this.enemiesAt(cell(p.x, p.y)).length >= MAX_ENEMIES_PER_TILE) return;
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }

  /** Trail nodes within `r` tiles of (x, y) (a square), with room for another enemy. */
  private trailNear(x: number, y: number, r: number): number[] {
    const out: number[] = [];
    this.map.nodes.forEach((p, i) => {
      if (!isPiste(this.map, i) || Math.max(Math.abs(p.x - x), Math.abs(p.y - y)) > r) return;
      if (this.enemiesAt(cell(p.x, p.y)).length < MAX_ENEMIES_PER_TILE) out.push(i);
    });
    return out;
  }

  /**
   * A new descent begins: at the lodge for a new lap, or partway down when you chain one with a
   * lift. Every enemy card rolls how many to send and where, from the seeded generator, so you
   * can plan for it but never quite count on it. A new lap also brings a wave of its own (the
   * mountain is never empty, even on lap one), moves the weather on, and lets powder heal.
   */
  startDescent(newLap: boolean): void {
    const st = this.state;
    const rng = this.rng;
    const before = st.enemies.length;
    if (newLap) {
      if (st.weather && --st.weather.laps <= 0) {
        st.weather = null;
        this.events.push({ type: 'weather', kind: null });
      }
      this.wildWave();
    }
    let chasers = st.enemies.filter((e) => e.ride && e.kind === 'snowmobile').length;
    st.tiles.forEach((t, c) => {
      if (!t) return;
      const x = c % MAP_W;
      const y = Math.floor(c / MAP_W);
      switch (t.card) {
        case 'patrol':
        case 'checkpoint': {
          const [lo, hi] = t.card === 'patrol' ? SPAWNS.patrol : SPAWNS.checkpoint;
          const n = rng.int(lo, hi + 1);
          for (let k = 0; k < n; k++) this.spawn('guard', x, y, c);
          break;
        }
        case 'cabin': {
          const n = rng.int(SPAWNS.cabin[0], SPAWNS.cabin[1] + 1);
          for (let k = 0; k < n; k++) {
            const spots = this.trailNear(x, y, 2);
            if (!spots.length) break;
            const p = this.map.nodes[rng.pick(spots)];
            this.spawn('guard', p.x, p.y, c);
          }
          break;
        }
        case 'garage': {
          const n = 1 + (rng.chance(SPAWNS.garageSecond) ? 1 : 0);
          for (let k = 0; k < n && chasers < SPAWNS.maxChasers; k++) {
            const spots = this.chaseFrom(x, y);
            if (!spots.length) break;
            this.spawn('snowmobile', x, y, c, rng.pick(spots));
            chasers++;
          }
          break;
        }
        case 'sniper':
        case 'demoShack':
        case 'fieldHospital':
          if (!st.enemies.some((e) => e.home === c)) this.spawn(t.card === 'sniper' ? 'sniper' : t.card === 'demoShack' ? 'sapper' : 'medic', x, y, c);
          break;
        case 'kennel': {
          const n = rng.int(SPAWNS.kennel[0], SPAWNS.kennel[1] + 1);
          for (let k = 0; k < n; k++) {
            const spots = this.chaseFrom(x, y);
            if (!spots.length || st.enemies.filter((e) => e.kind === 'hound').length >= SPAWNS.maxHounds) break;
            this.spawn('hound', x, y, c, rng.pick(spots));
          }
          break;
        }
        case 'yetiCave':
          if (st.enemies.filter((e) => e.home === c).length < SPAWNS.caveMax && rng.chance(SPAWNS.caveYeti)) {
            const i = this.nearestTrail(x, y);
            if (i >= 0) this.spawn('yeti', this.map.nodes[i].x, this.map.nodes[i].y, c);
          }
          break;
        case 'powder':
          if (newLap) {
            const amount = powderHeal(st.tiles, x, y);
            st.hero.hp = Math.min(this.stats.maxHp, st.hero.hp + amount);
            this.events.push({ type: 'heal', amount, x: x + 0.5, y: y + 0.5 });
          }
          break;
      }
      if (t.variant === 'dbd' && rng.chance(SPAWNS.dbdYeti)) {
        const i = this.nearestTrail(x, y);
        if (i >= 0) this.spawn('yeti', this.map.nodes[i].x, this.map.nodes[i].y, c);
      }
    });
    this.events.push({ type: 'wave', lap: st.lap, descent: st.descent, count: st.enemies.length - before, chained: !newLap });
  }

  /**
   * Each lap's own wave: a few enemies scattered over the trail in ones and twos, more as the laps
   * go by. Never right by the lodge, so a lap always starts with a moment to breathe.
   */
  private wildWave(): void {
    const st = this.state;
    const rng = this.rng;
    const lodge = this.map.nodes[LODGE];
    let left = Math.min(WAVE.max, WAVE.base + Math.floor((st.lap - 1) * WAVE.perLap) + rng.int(0, WAVE.spread + 1));
    for (let tries = 0; left > 0 && tries < 20; tries++) {
      const spots = this.map.nodes
        .map((_, i) => i)
        .filter((i) => {
          const p = this.map.nodes[i];
          return isPiste(this.map, i) && Math.max(Math.abs(p.x - lodge.x), Math.abs(p.y - lodge.y)) > 2 && this.enemiesAt(cell(p.x, p.y)).length === 0;
        });
      if (!spots.length) break;
      const p = this.map.nodes[rng.pick(spots)];
      const chasers = st.enemies.filter((e) => e.ride).length;
      if (st.lap >= 4 && chasers < SPAWNS.maxHounds && rng.chance(0.15)) {
        const from = nodeAt(this.map, p.x, p.y);
        for (let k = 0; k < Math.min(2, left); k++) this.spawn('hound', p.x, p.y, -1, from);
        left -= Math.min(2, left);
        continue;
      }
      if (st.lap >= 3 && chasers < SPAWNS.maxChasers && rng.chance(0.2)) {
        this.spawn('snowmobile', p.x, p.y, -1, nodeAt(this.map, p.x, p.y));
        left--;
        continue;
      }
      const group = Math.min(left, rng.chance(0.4) ? 2 : 1);
      for (let k = 0; k < group; k++) this.spawn('guard', p.x, p.y, -1);
      left -= group;
    }
  }

  /** How far round the lap the skier is, from 0 at the lodge to 1 back there. */
  lapProgress(): number {
    const map = this.map;
    let i = this.heroNode();
    if (i >= map.loopLength) {
      const seg = [...map.lifts, ...map.chutes, ...map.paths].find((s) => s.nodes.includes(i));
      i = seg ? seg.from : 0;
    }
    return i / map.loopLength;
  }

  // --- Movement and the lap -----------------------------------------------------------------

  /** Cruise speed on a node, in tiles per second. */
  baseSpeed(i: number): number {
    const p = this.map.nodes[i];
    if (p.kind === 'lift') return 0.9;
    if (p.kind === 'summit') return 1.3;
    if (p.kind === 'lodge') return 1.2;
    if (p.kind === 'chute') return 3;
    const dir = dirOf(this.map, i, this.choose(i));
    // Downhill is fast, traverses slower, and climbing back uphill on a path is a slow skate.
    return dir === 'down' ? 2.4 : dir === 'up' ? ROUTE_TUNING.climb : 1.8;
  }

  /** Returns true when the skier just reached the lodge. */
  private move(): boolean {
    const st = this.state;
    const hero = st.hero;
    const ride = hero.ride;
    const i = rideNode(ride);
    const p = this.map.nodes[i];
    const t = st.tiles[cell(p.x, p.y)];
    const onLift = p.kind === 'lift';
    const tileMod = t?.card === 'moguls' ? 0.7 : t?.card === 'ice' ? 1.6 : 1;
    const speed = this.baseSpeed(i) * tileMod * (onLift ? 1 : STANCES[hero.stance].speed * this.stats.speed);
    const before = ride.f;
    ride.f += speed * DT;
    if (before < 0.5 && ride.f >= 0.5) this.enterTile(ride.to);
    while (ride.f >= 1) {
      ride.f -= 1;
      ride.at = ride.to;
      if (ride.at === LODGE) {
        ride.f = 0;
        ride.to = this.choose(LODGE);
        this.completeLap();
        return true;
      }
      const next = this.choose(ride.at);
      // Taking a route that leads back up the mountain (a lift, or a path that doubles back) is a
      // choice to chain another descent instead of going home.
      const here = this.map.nodes[ride.at];
      if (here.junction >= 0 && next === here.next[1] && this.map.segments[here.junction]?.back) this.chain();
      ride.to = next;
      if (ride.f >= 0.5) this.enterTile(ride.to);
    }
    if (isPiste(this.map, i) && hero.stance === 'tuck') {
      const m = STANCES.tuck.mult * DT * (hasGadget(st.equipment, 'speedDemon') ? 2 : 1);
      st.lapHand.mult += m;
      this.line('Tucking', 0, m, false);
    }
    return false;
  }

  private chain(): void {
    const st = this.state;
    st.descent++;
    st.lapDescents++;
    st.record.descents++;
    const mult = ROUTE_TUNING.chainMult * (hasGadget(st.equipment, 'sled') ? 2 : 1);
    st.lapHand.mult += mult;
    this.line('Chained descents', 0, mult);
    const me = this.heroPos();
    this.events.push({ type: 'chain', descents: st.lapDescents, x: me.x, y: me.y });
    // Another descent, another round from every enemy card, a level tougher.
    this.startDescent(false);
  }

  private enterTile(i: number): void {
    const st = this.state;
    const p = this.map.nodes[i];
    const t = st.tiles[cell(p.x, p.y)];
    const cx = p.x + 0.5;
    const cy = p.y + 0.5;
    st.lapPar += 1 / this.baseSpeed(i);
    // Still in the air from a kicker on the tile before? Then you sail over whatever is here.
    const flying = st.hero.airborne;
    st.hero.airborne = t?.card === 'kicker';
    if (t?.card === 'mine') {
      st.tiles[cell(p.x, p.y)] = null;
      if (flying) {
        this.events.push({ type: 'mine', x: cx, y: cy, hit: false, damage: 0 });
        this.addChips('Mine jumped', SPECIALISTS.mineAirChips, 0, cx, cy);
      } else {
        const damage = Math.max(1, Math.round(SPECIALISTS.mineDamage * levelScale(st.descent, st.difficulty).damage) - this.stats.defense);
        st.hero.hp -= damage;
        if (!hasGadget(st.equipment, 'insurance')) st.lapHand.combo = 0;
        this.events.push({ type: 'mine', x: cx, y: cy, hit: true, damage });
        this.events.push({ type: 'heroHit', damage });
      }
    }
    if (isPiste(this.map, i)) {
      // Base chips for the run itself, like a Balatro hand's base: one a tile, two in a chute.
      const steep = p.kind === 'chute';
      this.earn(steep ? 2 : 1);
      this.line('The run', steep ? 2 : 1, 0, false);
      if (steep) {
        st.lapHand.mult += ROUTE_TUNING.steepMult;
        this.line('Steep', 0, ROUTE_TUNING.steepMult, false);
      }
      if (t?.card === 'moguls') this.addChips('Moguls', 12, st.hero.stance === 'tuck' ? 0.3 : 0, cx, cy);
      if (t?.card === 'gates') this.addChips(st.hero.stance === 'tuck' ? 'Slalom' : 'Gates', 10, st.hero.stance === 'tuck' ? 0.5 : 0, cx, cy);
      if (t?.card === 'tunnel') this.addChips('Tunnel', 6, 0, cx, cy);
      if (t?.card === 'blackRun' && st.hero.stance === 'tuck') this.addChips('Black run', 15, 0.3, cx, cy);
      if (t?.card === 'kicker') {
        if (steep) this.addChips('Cliff drop', 50, 1, cx, cy);
        else this.addChips('Big air', 25, 0.5, cx, cy);
      }
      const pines = countAround(st.tiles, p.x, p.y, 'pines');
      if (pines) {
        const bonus = hasGadget(st.equipment, 'treeHugger') ? 0.05 * pines : 0;
        st.permanentMult += bonus;
        this.addChips('Graze', 4 * pines * (st.weather?.kind === 'whiteout' ? WEATHER.whiteoutChips : 1), bonus, cx, cy);
      }
    }
    for (const [nx, ny] of neighbours(p.x, p.y)) {
      const n = st.tiles[cell(nx, ny)];
      if (!n || n.lastLap === st.lap) continue;
      if (n.card === 'cache') {
        n.lastLap = st.lap;
        const amount = Math.round(this.stats.maxHp * 0.2);
        st.hero.hp = Math.min(this.stats.maxHp, st.hero.hp + amount);
        this.events.push({ type: 'heal', amount, x: nx + 0.5, y: ny + 0.5 });
        this.addChips('Supplies', 10, 0, nx + 0.5, ny + 0.5);
      } else if (n.card === 'safehouse') {
        n.lastLap = st.lap;
        this.drawCard();
        st.intel++;
        this.events.push({ type: 'loot', what: 'card', label: 'Safehouse card', x: nx + 0.5, y: ny + 0.5 });
      }
    }
  }

  private completeLap(): void {
    const st = this.state;
    st.record.descents++;
    // A fast lap pays a bonus on every chip of it, at its own mult.
    const bonus = Math.min(2, Math.max(0, (st.lapPar / Math.max(st.lapTime, 1) - 1) * 2));
    if (bonus > 0.01) {
      const pts = st.lapHand.chips * bonus;
      st.points += pts;
      st.lapPoints += pts;
      this.line('Fast lap', 0, bonus);
    }
    const hand = st.lapHand;
    // The day's pay goes home: bounties for everything you shot this lap.
    st.cash += st.lapBounty;
    st.record.bestLap = Math.max(st.record.bestLap, st.lapBounty);
    this.events.push({
      type: 'lap',
      lap: st.lap,
      chips: hand.chips,
      mult: hand.mult,
      points: Math.round(st.lapPoints),
      kills: st.lapKills,
      bounty: st.lapBounty,
      lines: hand.lines,
      lapTime: st.lapTime,
      descents: st.lapDescents,
    });
    st.lapHand = freshHand(st.permanentMult);
    st.lapPoints = 0;
    st.lapKills = 0;
    st.lapBounty = 0;
    this.drawCard();
    st.hero.airborne = false;
    st.status = 'lodge';
  }

  private end(status: RunStatus): void {
    const st = this.state;
    const bail = hasGadget(st.equipment, 'sled') ? 0.8 : 0.6;
    const fraction = status === 'retreated' || status === 'won' ? 1 : status === 'bailed' ? bail : 0.3;
    // Beating the Baron mid-lap banks the lap's bounties too; bailing or wiping out loses them.
    if (status === 'won') {
      st.cash += st.lapBounty;
      st.lapBounty = 0;
    }
    const payout: Payout = {
      cash: Math.floor(st.cash * fraction),
      intel: Math.floor(st.intel * fraction),
      scrap: Math.floor(st.scrap * fraction),
      fraction,
    };
    st.status = status;
    st.payout = payout;
    this.events.push({ type: 'end', status, payout });
  }

  // --- Scoring ------------------------------------------------------------------------------

  /** Adds to a line of the tally. Continuous lines (tucking, the run) don't count passes. */
  private line(label: string, chips: number, mult: number, counts = true): void {
    const lines = this.state.lapHand.lines;
    let l = lines.find((x) => x.label === label);
    if (!l) lines.push((l = { label, chips: 0, mult: 0, count: 0 }));
    l.chips += chips;
    l.mult += mult;
    if (counts) l.count++;
  }

  /** Chips earn points at the mult you have right now: build mult first, then cash in. */
  private earn(chips: number): void {
    const st = this.state;
    const pts = chips * st.lapHand.mult;
    st.lapHand.chips += chips;
    st.points += pts;
    st.lapPoints += pts;
  }

  private addChips(label: string, chips: number, mult: number, x: number, y: number): void {
    const hand = this.state.lapHand;
    hand.mult += mult;
    this.earn(chips);
    this.line(label, chips, mult);
    this.events.push({ type: 'chips', label, chips, mult, x, y });
  }

  // --- Healing and combat -------------------------------------------------------------------

  private heal(): void {
    const st = this.state;
    const p = this.map.nodes[this.heroNode()];
    let rate = this.stats.regen;
    if (p.kind === 'lift') rate += 2 * (hasGadget(st.equipment, 'liftPass') ? 3 : 1);
    st.hero.hp = Math.min(this.stats.maxHp, st.hero.hp + rate * DT);
  }

  /** Special moves on their own timers. */
  private abilities(): void {
    const st = this.state;
    for (const e of [...st.enemies]) {
      if (e.hp <= 0 || e.ability === undefined) continue;
      e.ability -= DT;
      if (e.ability > 0) continue;
      if (e.kind === 'yetiKing') {
        // The Yeti King calls one of his subjects down.
        e.ability = KING_CALL;
        const i = this.nearestTrail(Math.floor(e.x), Math.floor(e.y));
        if (i >= 0) this.spawn('yeti', this.map.nodes[i].x, this.map.nodes[i].y, -1);
      } else if (e.kind === 'sapper') {
        // A mine on an open trail tile near him, never under the skier's skis.
        e.ability = SPECIALISTS.mineEvery;
        const me = this.heroNode();
        const spots = this.trailNear(Math.floor(e.x), Math.floor(e.y), 2).filter((i) => {
          const p = this.map.nodes[i];
          return i !== me && !st.tiles[cell(p.x, p.y)];
        });
        if (spots.length) {
          const p = this.map.nodes[this.rng.pick(spots)];
          st.tiles[cell(p.x, p.y)] = { card: 'mine', timer: 0, lastLap: -1, variant: null };
          this.events.push({ type: 'planted', x: p.x, y: p.y });
        }
      } else if (e.kind === 'medic') {
        // Patches up everyone near him (not himself).
        e.ability = SPECIALISTS.healEvery;
        for (const o of st.enemies) {
          if (o === e || o.hp <= 0 || o.hp >= o.maxHp || Math.hypot(o.x - e.x, o.y - e.y) > SPECIALISTS.healReach) continue;
          const amount = Math.min(o.maxHp - o.hp, Math.ceil(o.maxHp * SPECIALISTS.healShare));
          o.hp += amount;
          this.events.push({ type: 'enemyHeal', x: o.x, y: o.y, amount });
        }
      }
    }
  }

  private combat(): void {
    const st = this.state;
    const hero = st.hero;
    const stats = this.stats;
    const stance = STANCES[hero.stance];
    const rng = this.rng;
    const me = this.heroPos();
    const tile = this.map.nodes[this.heroNode()];
    const onLift = tile.kind === 'lift';
    const onIce = st.tiles[cell(tile.x, tile.y)]?.card === 'ice';
    const whiteout = st.weather?.kind === 'whiteout';
    const night = st.weather?.kind === 'night';
    // In a snow tunnel nobody can see anybody.
    const hidden = st.tiles[cell(tile.x, tile.y)]?.card === 'tunnel';
    const sight = whiteout ? WEATHER.whiteoutRange : 1;
    const terrainAim = (onIce ? 0.6 : 1) * (tile.kind === 'chute' ? ROUTE_TUNING.chuteAim : 1) * (night ? WEATHER.nightAim : 1);

    // Chasers ride the mountain too, and follow the same switches.
    for (const e of st.enemies) {
      if (!e.ride) continue;
      const r = e.ride;
      r.f += ENEMIES[e.kind].speed * DT;
      while (r.f >= 1) {
        r.f -= 1;
        r.at = r.to;
        r.to = this.choose(r.at);
      }
      const p = ridePos(this.map, r);
      e.x = p.x;
      e.y = p.y;
    }

    // The skier fires at the nearest enemy in range, on the move.
    const airhead = hasGadget(st.equipment, 'airhead');
    hero.cooldown -= DT;
    if ((!hero.airborne || airhead) && !hidden && hero.cooldown <= 0) {
      let target: Enemy | null = null;
      let best = stats.range * sight;
      for (const e of st.enemies) {
        const d = Math.hypot(e.x - me.x, e.y - me.y);
        if (d <= best) {
          best = d;
          target = e;
        }
      }
      if (target) {
        const plowReload = hero.stance === 'plow' && hasGadget(st.equipment, 'plowReload');
        hero.cooldown = 1 / (stats.fireRate * (plowReload ? 1.6 : 1));
        const steady = onLift ? (hasGadget(st.equipment, 'liftPass') ? 1.5 : 1.2) : 1;
        const chance = stats.accuracy * stance.accuracy * terrainAim * steady - ENEMIES[target.kind].evasion;
        const hit = rng.next() < Math.min(0.97, Math.max(0.05, chance));
        const monocle = hasGadget(st.equipment, 'monocle');
        const crit = hit && (rng.next() < stats.crit + (monocle ? 0.15 : 0) || (hero.airborne && airhead));
        const critMult = (hero.airborne && airhead) || monocle ? 3 : 2;
        const damage = hit ? Math.round(stats.damage * (crit ? critMult : 1)) : 0;
        this.events.push({ type: 'shot', fromX: me.x, fromY: me.y, toX: target.x, toY: target.y, hit, damage, crit, target: target.id });
        if (hit) this.damage(target, damage);
      }
    }
    st.enemies = st.enemies.filter((e) => e.hp > 0);
    if (st.status !== 'riding') return;

    // Everything in range fires back. Speed is armour: tucking dodges more.
    const evasion = Math.min(0.75, Math.max(0, stats.evasion + stance.evasion));
    const insured = hasGadget(st.equipment, 'insurance');
    for (const e of st.enemies) {
      if (e.hp <= 0) continue;
      const def = ENEMIES[e.kind];
      e.cooldown -= DT;
      const d = Math.hypot(e.x - me.x, e.y - me.y);
      if (d > def.range * sight) {
        e.cooldown = Math.max(e.cooldown, def.interval * 0.4);
        continue;
      }
      if (e.cooldown > 0 || hidden) continue;
      e.cooldown = def.interval * rng.range(0.9, 1.1);
      const scale = levelScale(e.level, st.difficulty);
      const base = { type: 'enemyShot' as const, enemy: e.id, kind: e.kind, fromX: e.x, fromY: e.y, toX: me.x, toY: me.y };
      if (hero.airborne) {
        this.events.push({ ...base, hit: false, damage: 0, air: true });
        continue;
      }
      const hit = rng.next() < def.accuracy * (1 - evasion) * (night ? WEATHER.nightEnemyAim : 1);
      const damage = hit ? Math.max(1, Math.round(def.damage * scale.damage) - stats.defense - stance.defense) : 0;
      this.events.push({ ...base, hit, damage, air: false });
      if (!hit) continue;
      hero.hp -= damage;
      this.events.push({ type: 'heroHit', damage });
      if (!insured) st.lapHand.combo = 0;
      if (hero.hp <= 0) return;
    }
  }

  private damage(e: Enemy, amount: number): void {
    const st = this.state;
    if (e.hp <= 0) return;
    e.hp -= amount;
    if (e.hp > 0) return;
    const def = ENEMIES[e.kind];
    const scale = levelScale(e.level, st.difficulty);
    const chips = Math.round(def.chips * scale.chips * (st.weather?.kind === 'whiteout' ? WEATHER.whiteoutChips : 1));
    st.record.kills++;
    st.lapKills++;
    st.lapBounty += Math.round(def.bounty * scale.chips * difficultyMods(st.difficulty).payout);
    st.lapHand.combo++;
    this.events.push({ type: 'kill', enemy: e.id, kind: e.kind, x: e.x, y: e.y, chips });
    this.addChips(KILL_LINES[e.kind], chips, 0, e.x, e.y);
    if (st.lapHand.combo >= 2) {
      st.lapHand.mult += 0.1;
      this.line('Combo', 0, 0.1);
    }

    // Loot, Loop Hero style: cards, gear and resources.
    const loot = st.weather?.kind === 'night' ? WEATHER.nightLoot : 1;
    if (this.rng.chance(Math.min(1, def.cardChance * KILL_CARDS * loot))) {
      this.drawCard();
      this.events.push({ type: 'loot', what: 'card', label: 'Card', x: e.x, y: e.y });
    }
    if (this.rng.chance(Math.min(1, def.itemChance * loot))) {
      const item =
        e.kind === 'baron'
          ? rollGadget(this.rng, st.nextId++, st.descent, 2)
          : rollItem(this.rng, st.nextId++, e.level, st.bonuses.rarityBoost, st.bonuses.gadgetDrops);
      st.inventory.push(item);
      st.record.items++;
      if (st.inventory.length > INVENTORY_SIZE) {
        const old = st.inventory.shift()!;
        st.scrap += 1 + old.rarity * 2;
      }
      this.events.push({ type: 'loot', what: 'item', label: item.name, x: e.x, y: e.y });
    }
    const intel = def.intel >= 1 ? def.intel : this.rng.chance(def.intel) ? 1 : 0;
    const scrap = def.scrap >= 1 ? def.scrap : this.rng.chance(def.scrap) ? 1 : 0;
    if (intel) {
      st.intel += intel;
      this.events.push({ type: 'loot', what: 'intel', label: `+${intel} intel`, x: e.x, y: e.y });
    }
    if (scrap) {
      st.scrap += scrap;
      this.events.push({ type: 'loot', what: 'scrap', label: `+${scrap} scrap`, x: e.x, y: e.y });
    }

    // Intel fragments, from the second lap on: three make a dossier.
    const fragmentChance = FRAGMENT_CHANCE[e.kind] ?? 0;
    if (fragmentChance > 0 && st.lap >= FRAGMENT_LAP && this.rng.chance(fragmentChance)) {
      st.fragments++;
      this.events.push({ type: 'fragment', count: st.fragments, x: e.x, y: e.y });
      if (st.fragments >= FRAGMENTS_PER_DOSSIER) {
        st.fragments -= FRAGMENTS_PER_DOSSIER;
        this.addDossier();
      }
    }

    // A dossier boss pays a bounty and drops its one-of-a-kind reward.
    if (e.kind === 'widow' || e.kind === 'yetiKing' || e.kind === 'kickback') {
      const reward = uniqueReward(e.kind, st.nextId++);
      st.inventory.push(reward);
      st.record.items++;
      if (st.inventory.length > INVENTORY_SIZE) {
        const old = st.inventory.shift()!;
        st.scrap += 1 + old.rarity * 2;
      }
      st.record.bosses.push(e.kind);
      st.cash += BOSS_BOUNTY;
      this.events.push({ type: 'loot', what: 'item', label: reward.name, x: e.x, y: e.y });
      this.events.push({ type: 'bossDown', kind: e.kind, reward: reward.name });
    }

    if (hasGadget(st.equipment, 'snowballs')) {
      for (const other of st.enemies) {
        if (other !== e && other.hp > 0 && Math.hypot(other.x - e.x, other.y - e.y) <= 1) this.damage(other, 8);
      }
    }
    if (e.kind === 'baron') {
      st.cash += 2000;
      this.end('won');
    }
  }
}
