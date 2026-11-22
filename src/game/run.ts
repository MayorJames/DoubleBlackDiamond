// One expedition: the skier skis the mountain while you build it with cards. Everything here
// is deterministic. Commands (stance, placing a card, flipping a junction, equipping, the lodge
// decision) are the only thing that enters, so a run replays exactly from its seed and commands.

import { BOSS_OF, canPlace, CARDS, countAround, markDoubleBlacks, newTiles, ROUTE_OF, type CardId, type Tiles } from './cards';
import { DAY_SECONDS, DT, HAND_SIZE, INVENTORY_SIZE, MAP_W, MAX_ENEMIES_PER_TILE } from './constants';
import { ENEMIES, isBoss, levelScale, RATINGS, type BossKind, type Enemy, type EnemyKind } from './enemies';
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

export const RUN_VERSION = 3;

export type RunStatus = 'riding' | 'lodge' | 'won' | 'retreated' | 'bailed' | 'wiped';

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
  rating: number;
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
  day: number;
  dayTimer: number;
  lapTime: number;
  /** How long this lap's route would take at a cruise, for the fast-lap bonus. */
  lapPar: number;
  boss: { meter: number; max: number; spawned: boolean };
  lapHand: LapHand;
  permanentMult: number;
  /** Intel fragments towards the next dossier (three make one). */
  fragments: number;
  cash: number;
  intel: number;
  scrap: number;
  record: { kills: number; bestLap: number; placed: number; items: number; descents: number; bosses: BossKind[] };
  status: RunStatus;
  payout: Payout | null;
}

export type Command =
  | { type: 'stance'; stance: Stance }
  | { type: 'place'; hand: number; x: number; y: number }
  | { type: 'burn'; hand: number }
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
  | { type: 'lap'; lap: number; chips: number; mult: number; points: number; lines: HandLine[]; lapTime: number; descents: number }
  | { type: 'day'; day: number }
  | { type: 'boss' }
  | { type: 'bossArrives'; kind: EnemyKind }
  | { type: 'bossDown'; kind: BossKind; reward: string }
  | { type: 'fragment'; count: number; x: number; y: number }
  | { type: 'dossier'; card: CardId; boss: BossKind }
  | { type: 'discard'; card: CardId }
  | { type: 'end'; status: RunStatus; payout: Payout };

export interface RunOptions {
  seed: string;
  rating?: number;
  deck: CardId[];
  bonuses?: LodgeBonuses;
}

const KILL_LINES: Record<EnemyKind, string> = {
  guard: 'Guards',
  sniper: 'Snipers',
  snowmobile: 'Snowmobiles',
  yeti: 'Yetis',
  baron: 'The Baron',
  widow: 'The Ice Widow',
  yetiKing: 'The Yeti King',
  kickback: 'Captain Kickback',
};

/** Chance each kind drops an intel fragment, once the mountain has a second lift. */
const FRAGMENT_CHANCE: Partial<Record<EnemyKind, number>> = { guard: 0.06, sniper: 0.35, snowmobile: 0.35, yeti: 1 };
const DOSSIER_FOR: Record<BossKind, CardId> = { widow: 'dossierWidow', yetiKing: 'dossierYetiKing', kickback: 'dossierKickback' };
export const FRAGMENTS_PER_DOSSIER = 3;
/** Cash for beating a dossier boss. */
export const BOSS_BOUNTY = 1000;

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
    const rating = options.rating ?? 0;
    const state: RunState = {
      version: RUN_VERSION,
      seed: options.seed,
      rating,
      tick: 0,
      rng: hashSeed(`run:${options.seed}`),
      tiles: newTiles(),
      routes: [],
      hero: { ride: { at: LODGE, to: 1, f: 0 }, hp: 0, stance: 'cruise', cooldown: 0, airborne: false },
      enemies: [],
      nextId: 1,
      hand: [],
      deck: [...options.deck],
      inventory: [],
      equipment: { gun: STARTER_GUN(0), skis: null, goggles: null, jacket: null, gadget1: null, gadget2: null },
      bonuses,
      lap: 1,
      descent: 1,
      lapDescents: 1,
      day: 1,
      dayTimer: 0,
      lapTime: 0,
      lapPar: 0,
      boss: { meter: 0, max: RATINGS[rating].boss, spawned: false },
      lapHand: freshHand(0),
      permanentMult: 0,
      fragments: 0,
      cash: 0,
      intel: 0,
      scrap: 0,
      record: { kills: 0, bestLap: 0, placed: 0, items: 0, descents: 0, bosses: [] },
      status: 'riding',
      payout: null,
    };
    const run = new Run(state);
    state.hero.hp = run.stats.maxHp;
    for (let i = 0; i < 5; i++) run.drawCard();
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
    st.dayTimer += DT;
    if (st.dayTimer >= DAY_SECONDS) {
      st.dayTimer -= DAY_SECONDS;
      st.day++;
      this.newDay();
    }
    st.lapTime += DT;
    if (this.move()) return; // lap complete: the lodge decision waits
    this.heal();
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
          st.hero.ride = { at: LODGE, to: this.choose(LODGE), f: 0 };
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

  drawCard(): void {
    const st = this.state;
    const total = st.deck.reduce((sum, id) => sum + CARDS[id].weight, 0);
    let roll = this.rng.next() * total;
    let pick = st.deck[0];
    for (const id of st.deck) {
      roll -= CARDS[id].weight;
      if (roll < 0) {
        pick = id;
        break;
      }
    }
    st.hand.push(pick);
    if (st.hand.length > HAND_SIZE) {
      const dropped = st.hand.shift()!;
      st.intel++;
      this.events.push({ type: 'discard', card: dropped });
    }
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

    if (boss) {
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
      if (card === 'patrol') this.spawn('guard', x, y, c);
      if (card === 'sniper') this.spawn('sniper', x, y, c);
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
    st.hand.push(DOSSIER_FOR[boss]);
    if (st.hand.length > HAND_SIZE) {
      const dropped = st.hand.shift()!;
      st.intel++;
      this.events.push({ type: 'discard', card: dropped });
    }
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
    const scale = levelScale(level, st.rating);
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

  private newDay(): void {
    const st = this.state;
    this.events.push({ type: 'day', day: st.day });
    const chasers = st.enemies.filter((e) => e.ride && e.kind === 'snowmobile').length;
    st.tiles.forEach((t, c) => {
      if (!t) return;
      const x = c % MAP_W;
      const y = Math.floor(c / MAP_W);
      switch (t.card) {
        case 'patrol':
          if (--t.timer <= 0) {
            t.timer = 2;
            this.spawn('guard', x, y, c);
          }
          break;
        case 'cabin':
          if (--t.timer <= 0) {
            t.timer = 3;
            const spots = this.trailNeighbours(x, y).filter((i) => {
              const p = this.map.nodes[i];
              return this.enemiesAt(cell(p.x, p.y)).length < MAX_ENEMIES_PER_TILE;
            });
            if (spots.length) {
              const p = this.map.nodes[this.rng.pick(spots)];
              this.spawn('guard', p.x, p.y, c);
            }
          }
          break;
        case 'garage':
          if (--t.timer <= 0) {
            t.timer = 3;
            const spots = this.trailNeighbours(x, y);
            if (spots.length && chasers < 4) this.spawn('snowmobile', x, y, c, this.rng.pick(spots));
          }
          break;
        case 'sniper':
          if (!st.enemies.some((e) => e.home === c) && --t.timer <= 0) {
            t.timer = 3;
            this.spawn('sniper', x, y, c);
          }
          break;
        case 'powder': {
          const amount = powderHeal(st.tiles, x, y);
          st.hero.hp = Math.min(this.stats.maxHp, st.hero.hp + amount);
          this.events.push({ type: 'heal', amount, x: x + 0.5, y: y + 0.5 });
          break;
        }
      }
      if (t.variant === 'dbd' && --t.timer <= 0) {
        t.timer = 4;
        const i = this.nearestTrail(x, y);
        if (i >= 0) this.spawn('yeti', this.map.nodes[i].x, this.map.nodes[i].y, c);
      }
    });
    // The Yeti King calls one of his subjects down every day.
    for (const king of st.enemies.filter((e) => e.kind === 'yetiKing' && e.hp > 0)) {
      const i = this.nearestTrail(Math.floor(king.x), Math.floor(king.y));
      if (i >= 0) this.spawn('yeti', this.map.nodes[i].x, this.map.nodes[i].y, -1);
    }
  }

  // --- Movement and the lap -----------------------------------------------------------------

  /** Cruise speed on a node, in tiles per second. */
  baseSpeed(i: number): number {
    const p = this.map.nodes[i];
    if (p.kind === 'lift') return 0.9;
    if (p.kind === 'summit') return 1.3;
    if (p.kind === 'lodge') return 1.2;
    if (p.kind === 'chute') return 3;
    return dirOf(this.map, i, this.choose(i)) === 'down' ? 2.4 : 1.8;
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
      // Riding a lift partway down is a choice to chain another descent instead of going home.
      if (this.map.nodes[next].kind === 'lift' && this.map.nodes[ride.at].kind !== 'lift') this.chain();
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
  }

  private enterTile(i: number): void {
    const st = this.state;
    const p = this.map.nodes[i];
    const t = st.tiles[cell(p.x, p.y)];
    const cx = p.x + 0.5;
    const cy = p.y + 0.5;
    st.lapPar += 1 / this.baseSpeed(i);
    st.hero.airborne = t?.card === 'kicker';
    if (isPiste(this.map, i)) {
      // Base chips for the run itself, like a Balatro hand's base: one a tile, two in a chute.
      const steep = p.kind === 'chute';
      st.lapHand.chips += steep ? 2 : 1;
      this.line('The run', steep ? 2 : 1, 0, false);
      if (steep) {
        st.lapHand.mult += ROUTE_TUNING.steepMult;
        this.line('Steep', 0, ROUTE_TUNING.steepMult, false);
      }
      if (t?.card === 'moguls') this.addChips('Moguls', 12, st.hero.stance === 'tuck' ? 0.3 : 0, cx, cy);
      if (t?.card === 'kicker') {
        if (steep) this.addChips('Cliff drop', 50, 1, cx, cy);
        else this.addChips('Big air', 25, 0.5, cx, cy);
      }
      const pines = countAround(st.tiles, p.x, p.y, 'pines');
      if (pines) {
        const bonus = hasGadget(st.equipment, 'treeHugger') ? 0.05 * pines : 0;
        st.permanentMult += bonus;
        this.addChips('Graze', 4 * pines, bonus, cx, cy);
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
    const bonus = Math.min(2, Math.max(0, (st.lapPar / Math.max(st.lapTime, 1) - 1) * 2));
    if (bonus > 0.01) {
      st.lapHand.mult += bonus;
      this.line('Fast lap', 0, bonus);
    }
    const hand = st.lapHand;
    const points = Math.round(hand.chips * hand.mult);
    st.cash += points;
    st.record.bestLap = Math.max(st.record.bestLap, points);
    this.events.push({
      type: 'lap',
      lap: st.lap,
      chips: hand.chips,
      mult: hand.mult,
      points,
      lines: hand.lines,
      lapTime: st.lapTime,
      descents: st.lapDescents,
    });
    st.lapHand = freshHand(st.permanentMult);
    this.drawCard();
    st.hero.airborne = false;
    st.status = 'lodge';
  }

  private end(status: RunStatus): void {
    const st = this.state;
    const bail = hasGadget(st.equipment, 'sled') ? 0.8 : 0.6;
    const fraction = status === 'retreated' || status === 'won' ? 1 : status === 'bailed' ? bail : 0.3;
    const payout: Payout = {
      cash: Math.floor(st.cash * fraction * RATINGS[st.rating].payout),
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

  private addChips(label: string, chips: number, mult: number, x: number, y: number): void {
    const hand = this.state.lapHand;
    hand.chips += chips;
    hand.mult += mult;
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
    const terrainAim = (onIce ? 0.6 : 1) * (tile.kind === 'chute' ? ROUTE_TUNING.chuteAim : 1);

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
    if ((!hero.airborne || airhead) && hero.cooldown <= 0) {
      let target: Enemy | null = null;
      let best = stats.range;
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
      if (d > def.range) {
        e.cooldown = Math.max(e.cooldown, def.interval * 0.4);
        continue;
      }
      if (e.cooldown > 0) continue;
      e.cooldown = def.interval * rng.range(0.9, 1.1);
      const scale = levelScale(e.level, st.rating);
      const base = { type: 'enemyShot' as const, enemy: e.id, kind: e.kind, fromX: e.x, fromY: e.y, toX: me.x, toY: me.y };
      if (hero.airborne) {
        this.events.push({ ...base, hit: false, damage: 0, air: true });
        continue;
      }
      const hit = rng.next() < def.accuracy * (1 - evasion);
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
    const scale = levelScale(e.level, st.rating);
    const chips = Math.round(def.chips * scale.chips);
    st.record.kills++;
    st.lapHand.combo++;
    this.events.push({ type: 'kill', enemy: e.id, kind: e.kind, x: e.x, y: e.y, chips });
    this.addChips(KILL_LINES[e.kind], chips, 0, e.x, e.y);
    if (st.lapHand.combo >= 2) {
      st.lapHand.mult += 0.1;
      this.line('Combo', 0, 0.1);
    }

    // Loot, Loop Hero style: cards, gear and resources.
    if (this.rng.chance(def.cardChance)) {
      this.drawCard();
      this.events.push({ type: 'loot', what: 'card', label: 'Card', x: e.x, y: e.y });
    }
    if (this.rng.chance(def.itemChance)) {
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

    // Intel fragments, once the mountain has a lift of your own: three make a dossier.
    const fragmentChance = FRAGMENT_CHANCE[e.kind] ?? 0;
    if (fragmentChance > 0 && st.routes.some((r) => r.kind === 'lift') && this.rng.chance(fragmentChance)) {
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
