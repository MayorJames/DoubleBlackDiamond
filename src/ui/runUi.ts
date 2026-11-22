// The expedition screen's DOM: top bar, side panel (HP, stance, stats, gear, pack, this lap's
// chips × mult), the hand of cards, tooltips, and pops over the map.

import { CARDS, type CardId, type CardKind } from '../game/cards';
import { DAY_SECONDS, MAP_W } from '../game/constants';
import { ENEMIES } from '../game/enemies';
import { GADGETS, RARITY_NAMES, type Item, type Slot, type StatKey } from '../game/items';
import { nodeAt } from '../game/map';
import type { Run } from '../game/run';
import { STANCES, type Stance } from '../game/stats';
import { cardArtUrl } from '../render/art/cardArt';
import type { MapRenderer } from '../render/mapRenderer';
import { spriteUrl, type SpriteName } from '../render/sprites';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} missing`);
  return el as T;
};

export const formatCash = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

const KIND_LABEL: Record<CardKind, string> = {
  trail: 'Trail',
  roadside: 'Roadside',
  landscape: 'Landscape',
  special: 'Special',
  route: 'Route',
  boss: 'Boss',
};
const KIND_HINT: Record<CardKind, string> = {
  trail: 'Goes on the trail itself.',
  roadside: 'Goes beside the trail or lift.',
  landscape: 'Goes on any open snow.',
  special: 'Goes on a tile you already placed.',
  route: 'Goes on the trail where there is a clear line straight up (lift) or down (chute) to more trail.',
  boss: 'Goes on the trail. Assembled from three intel fragments.',
};
const ROUTE_NAME = { lift: 'Chairlift', chute: 'Chute' } as const;
const STANCE_TEXT: Record<Stance, string> = {
  tuck: '160% speed, 65% aim, +20% dodge. Builds mult on the trail.',
  cruise: 'Steady. No bonuses, no penalties.',
  plow: '55% speed, 135% aim, +2 defense. Easy to hit.',
};
const SLOTS: { slot: Slot; label: string; icon: SpriteName }[] = [
  { slot: 'gun', label: 'Gun', icon: 'iconGun' },
  { slot: 'skis', label: 'Skis', icon: 'iconSkis' },
  { slot: 'goggles', label: 'Goggles', icon: 'iconGoggles' },
  { slot: 'jacket', label: 'Jacket', icon: 'iconJacket' },
  { slot: 'gadget1', label: 'Gadget', icon: 'iconGadget' },
  { slot: 'gadget2', label: 'Gadget', icon: 'iconGadget' },
];
const ICON_FOR: Record<Item['slot'], SpriteName> = {
  gun: 'iconGun',
  skis: 'iconSkis',
  goggles: 'iconGoggles',
  jacket: 'iconJacket',
  gadget: 'iconGadget',
};
const RARITY_RECOLOR = [undefined, { k: 'w', d: 'l', m: 'l', w: 'd' }, { k: 'w', d: 's', m: 's', w: 'q' }];

const STAT_LABEL: Record<StatKey, string> = {
  maxHp: 'Max HP',
  damage: 'Damage',
  fireRate: 'Fire rate',
  range: 'Range',
  accuracy: 'Aim',
  defense: 'Defense',
  evasion: 'Dodge',
  speed: 'Speed',
  crit: 'Crit',
  regen: 'Regen',
};

function formatStat(k: StatKey, v: number): string {
  const sign = v >= 0 ? '+' : '−';
  const a = Math.abs(v);
  switch (k) {
    case 'accuracy':
    case 'evasion':
    case 'speed':
    case 'crit':
      return `${sign}${Math.round(a * 100)}%`;
    case 'fireRate':
      return `${sign}${a.toFixed(2)}/s`;
    case 'range':
      return `${sign}${a.toFixed(1)} tiles`;
    case 'regen':
      return `${sign}${a.toFixed(1)}/s`;
    default:
      return `${sign}${Math.round(a)}`;
  }
}

const artCache = new Map<string, string>();

/** A card's illustration at the size the hand shows it. */
export const cardArt = (card: CardId): string => cardArtUrl(card, 2);

function iconUrl(item: Item): string {
  const key = `${item.slot}:${item.rarity}`;
  let url = artCache.get(key);
  if (!url) {
    url = spriteUrl(ICON_FOR[item.slot], 3, RARITY_RECOLOR[item.rarity]);
    artCache.set(key, url);
  }
  return url;
}

export interface RunUiHooks {
  selectCard: (index: number | null) => void;
  burnCard: (index: number) => void;
  setStance: (s: Stance) => void;
  setSpeed: (speed: number) => void;
  equip: (index: number) => void;
  salvage: (index: number) => void;
  bail: () => void;
}

export class RunUi {
  private readonly last = new Map<string, string>();
  private handKey = '';
  private gearKey = '';
  private prevHand: CardId[] = [];
  selected: number | null = null;
  private hoverCard: number | null = null;

  private readonly handEl = $('hand');
  private readonly cardTip = $('card-tip');
  private readonly itemTip = $('item-tip');
  private readonly fxEl = $('map-fx');
  private readonly mapWrap = $('map-wrap');

  constructor(
    hooks: RunUiHooks,
    private readonly renderer: MapRenderer,
  ) {
    document.querySelectorAll<HTMLButtonElement>('.stance button').forEach((b) =>
      b.addEventListener('click', () => hooks.setStance(b.dataset.stance as Stance)),
    );
    document.querySelectorAll<HTMLButtonElement>('.tb.speed button').forEach((b) =>
      b.addEventListener('click', () => hooks.setSpeed(Number(b.dataset.speed))),
    );
    $('bail').addEventListener('click', () => hooks.bail());

    this.handEl.addEventListener('click', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.card');
      if (!card) return;
      const i = Number(card.dataset.index);
      hooks.selectCard(this.selected === i ? null : i);
    });
    this.handEl.addEventListener('contextmenu', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.card');
      if (!card) return;
      e.preventDefault();
      hooks.burnCard(Number(card.dataset.index));
    });
    this.handEl.addEventListener('mouseover', (e) => {
      const card = (e.target as HTMLElement).closest<HTMLElement>('.card');
      this.hoverCard = card ? Number(card.dataset.index) : null;
    });
    this.handEl.addEventListener('mouseleave', () => (this.hoverCard = null));

    for (const id of ['gear', 'inventory']) {
      const el = $(id);
      el.addEventListener('click', (e) => {
        const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-item]');
        if (slot) hooks.equip(Number(slot.dataset.item));
      });
      el.addEventListener('contextmenu', (e) => {
        const slot = (e.target as HTMLElement).closest<HTMLElement>('[data-item]');
        if (!slot) return;
        e.preventDefault();
        hooks.salvage(Number(slot.dataset.item));
      });
      el.addEventListener('mousemove', (e) => this.itemHover(e));
      el.addEventListener('mouseleave', () => this.hideTip());
    }
  }

  private currentRun: Run | null = null;

  reset(): void {
    this.handKey = '';
    this.gearKey = '';
    this.prevHand = [];
    this.selected = null;
    this.last.clear();
    this.fxEl.replaceChildren();
  }

  update(run: Run, speed: number): void {
    this.currentRun = run;
    const st = run.state;
    const stats = run.stats;
    this.text('day', String(st.day));
    $('day-fill').style.width = `${Math.min(100, (st.dayTimer / DAY_SECONDS) * 100).toFixed(1)}%`;
    this.text('lap', String(st.lap));
    this.text('descent', String(st.descent));
    this.text('boss-count', st.boss.spawned ? 'HERE!' : `${st.boss.meter}/${st.boss.max}`);
    $('boss-fill').style.width = `${Math.min(100, (st.boss.meter / st.boss.max) * 100).toFixed(1)}%`;
    document.querySelector('.tb.boss')!.classList.toggle('hot', st.boss.spawned || st.boss.meter >= st.boss.max * 0.75);
    this.text('run-cash', formatCash(st.cash));
    this.text('run-intel', String(st.intel));
    this.text('run-scrap', String(st.scrap));
    this.text('run-frag', st.routes.some((r) => r.kind === 'lift') ? `${st.fragments}/3` : 'build a lift');
    document.querySelectorAll<HTMLButtonElement>('.tb.speed button').forEach((b) =>
      b.classList.toggle('on', Number(b.dataset.speed) === speed),
    );
    $('paused-tag').classList.toggle('hidden', speed !== 0 || st.status !== 'riding');

    const hp = Math.max(0, st.hero.hp);
    this.text('hp-text', `${Math.ceil(hp)}/${stats.maxHp}`);
    $('hp-fill').style.width = `${Math.min(100, (hp / stats.maxHp) * 100).toFixed(1)}%`;
    $('hp-fill').parentElement!.classList.toggle('low', hp / stats.maxHp < 0.3);
    document.querySelectorAll<HTMLButtonElement>('.stance button').forEach((b) =>
      b.classList.toggle('on', b.dataset.stance === st.hero.stance),
    );
    this.text('stance-text', STANCE_TEXT[st.hero.stance]);
    this.renderJunction(run);

    const stance = STANCES[st.hero.stance];
    const statsHtml = [
      ['DMG', String(stats.damage)],
      ['Rate', `${stats.fireRate.toFixed(2)}/s`],
      ['Range', stats.range.toFixed(1)],
      ['Aim', `${Math.round(Math.min(0.97, stats.accuracy * stance.accuracy) * 100)}%`],
      ['Def', String(stats.defense + stance.defense)],
      ['Dodge', `${Math.round(Math.min(0.75, Math.max(0, stats.evasion + stance.evasion)) * 100)}%`],
      ['Speed', `${Math.round(stats.speed * stance.speed * 100)}%`],
      ['Crit', `${Math.round(stats.crit * 100)}%`],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join('');
    if (this.changed('stats', statsHtml)) $('stats').innerHTML = statsHtml;

    this.text('chips', String(st.lapHand.chips));
    this.text('mult', st.lapHand.mult.toFixed(1));
    this.text('combo', `Combo ${st.lapHand.combo}${st.permanentMult > 0 ? ` · +${st.permanentMult.toFixed(2)} mult kept` : ''}`);

    this.renderHand(run);
    this.renderGear(run);
    this.renderCardTip(run);
  }

  /** The next junction ahead and which way it will send you. */
  private renderJunction(run: Run): void {
    const k = upcomingJunction(run);
    const box = $('junction');
    box.classList.toggle('hidden', k < 0);
    if (k < 0) return;
    const r = run.state.routes[k];
    box.classList.toggle('taking', r.take);
    this.text('junction-text', r.take ? `Take the ${ROUTE_NAME[r.kind]}` : `Ski past the ${ROUTE_NAME[r.kind]}`);
  }

  pulseHand(): void {
    for (const el of document.querySelectorAll('.lap-hand .chips, .lap-hand .mult')) {
      el.classList.remove('pulse');
      void (el as HTMLElement).offsetWidth;
      el.classList.add('pulse');
    }
  }

  private renderHand(run: Run): void {
    const hand = run.state.hand;
    const key = `${hand.join(',')}|${this.selected}`;
    if (key === this.handKey) return;
    // New cards (compared with last time) get dealt in with a flourish.
    const fresh = new Set<number>();
    const prev = [...this.prevHand];
    hand.forEach((c, i) => {
      const j = prev.indexOf(c);
      if (j >= 0) prev.splice(j, 1);
      else fresh.add(i);
    });
    this.prevHand = [...hand];
    this.handKey = key;
    this.handEl.replaceChildren(
      ...hand.map((card, i) => {
        const def = CARDS[card];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `card ${def.kind}${i === this.selected ? ' selected' : ''}${fresh.has(i) ? ' dealt' : ''}`;
        b.dataset.index = String(i);
        b.title = `${def.name}: ${def.text} (right-click to burn for 1 intel)`;
        b.innerHTML = `<span class="ckind">${KIND_LABEL[def.kind]}</span><img alt="" src="${cardArt(card)}"><span class="cname">${def.name}</span>`;
        return b;
      }),
    );
  }

  private renderCardTip(run: Run): void {
    const i = this.hoverCard ?? this.selected;
    const card = i !== null ? run.state.hand[i] : undefined;
    if (!card) {
      this.cardTip.classList.add('hidden');
      this.last.delete('cardtip');
      return;
    }
    const def = CARDS[card];
    const html = `<img class="tip-art" alt="" src="${cardArtUrl(card, 3)}"><span class="kind">${KIND_LABEL[def.kind]} · ${KIND_HINT[def.kind]}</span><b>${def.name}</b>${def.text}<i>${def.flavor}</i>${
      this.selected === i ? '<span class="kind">Click a dotted tile to place · Esc to cancel</span>' : '<span class="kind">Click to place · right-click to burn</span>'
    }`;
    if (this.changed('cardtip', html)) this.cardTip.innerHTML = html;
    this.cardTip.classList.remove('hidden');
  }

  private renderGear(run: Run): void {
    const st = run.state;
    const key = JSON.stringify([SLOTS.map(({ slot }) => st.equipment[slot]?.id ?? 0), st.inventory.map((i) => i.id), st.bonuses.gadgetSlots]);
    if (key === this.gearKey) return;
    const fresh = this.gearKey !== '';
    this.gearKey = key;
    $('gear').replaceChildren(
      ...SLOTS.map(({ slot, label, icon }) => {
        const item = st.equipment[slot];
        const el = document.createElement('div');
        const locked = slot === 'gadget2' && st.bonuses.gadgetSlots < 2;
        el.className = `slot ${item ? `r${item.rarity}` : 'empty'}${locked ? ' locked' : ''}`;
        el.dataset.slot = slot;
        if (item) el.innerHTML = `<img alt="" src="${iconUrl(item)}"><span class="slot-name">${label}</span>`;
        else el.innerHTML = `<img alt="" src="${spriteUrl(icon, 3, { k: 'l', d: 'l', m: 's' })}"><span class="slot-name">${locked ? 'Spy HQ' : label}</span>`;
        return el;
      }),
    );
    const inv = $('inventory');
    const cells: HTMLElement[] = [];
    for (let i = 0; i < 10; i++) {
      const item = st.inventory[i];
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `slot ${item ? `r${item.rarity}` : 'empty'}${item && fresh && i === st.inventory.length - 1 ? ' fresh' : ''}`;
      if (item) {
        el.dataset.item = String(i);
        el.innerHTML = `<img alt="" src="${iconUrl(item)}">`;
        el.setAttribute('aria-label', item.name);
      } else el.disabled = true;
      cells.push(el);
    }
    inv.replaceChildren(...cells);
  }

  private itemHover(e: MouseEvent): void {
    const run = this.currentRun;
    if (!run) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-item], [data-slot]');
    let item: Item | null = null;
    let compare: Item | null = null;
    if (target?.dataset.item) {
      item = run.state.inventory[Number(target.dataset.item)] ?? null;
      if (item) compare = item.slot === 'gadget' ? null : run.state.equipment[item.slot];
    } else if (target?.dataset.slot) item = run.state.equipment[target.dataset.slot as Slot];
    if (!item) return this.hideTip();
    const lines = (Object.entries(item.stats) as [StatKey, number][]).map(([k, v]) => {
      const d = v - (compare?.stats[k] ?? 0);
      const delta = compare ? ` <span class="${d < 0 ? 'neg' : ''}">(${formatStat(k, d)})</span>` : '';
      return `${STAT_LABEL[k]} ${formatStat(k, v)}${delta}`;
    });
    if (compare) {
      for (const [k, v] of Object.entries(compare.stats) as [StatKey, number][]) {
        if (item.stats[k] === undefined) lines.push(`<span class="neg">${STAT_LABEL[k]} ${formatStat(k, -v)}</span>`);
      }
    }
    const gadget = item.gadget ? `<i>${GADGETS[item.gadget].text}</i>` : '';
    const slotName = item.slot === 'gadget' ? 'gadget' : item.slot;
    const hint = target?.dataset.item ? '<span class="kind">Click to wear · right-click to scrap</span>' : '';
    this.showTip(
      `<span class="kind">${RARITY_NAMES[item.rarity]} ${slotName} · level ${item.level}</span><b>${item.name}</b>${lines.join('<br>') || ''}${gadget}${hint}`,
      e.clientX,
      e.clientY,
    );
  }

  showTip(html: string, x: number, y: number): void {
    const tip = this.itemTip;
    if (this.changed('itemtip', html)) tip.innerHTML = html;
    tip.classList.remove('hidden');
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    tip.style.left = `${Math.max(8, Math.min(window.innerWidth - w - 8, x - w - 14))}px`;
    tip.style.top = `${Math.max(8, Math.min(window.innerHeight - h - 8, y + 12))}px`;
  }

  hideTip(): void {
    this.itemTip.classList.add('hidden');
    this.last.delete('itemtip');
  }

  /** Tooltip for whatever is under the mouse on the map. */
  mapHover(run: Run, tile: { x: number; y: number } | null, cssX: number, cssY: number): void {
    if (!tile) return this.hideTip();
    const t = run.state.tiles[tile.y * MAP_W + tile.x];
    const enemies = run.state.enemies.filter((e) => Math.floor(e.x) === tile.x && Math.floor(e.y) === tile.y);
    const parts: string[] = [];
    for (const e of enemies) parts.push(`<b>${ENEMIES[e.kind].name} · level ${e.level}</b>HP ${Math.ceil(e.hp)}/${e.maxHp}`);
    if (t) {
      const def = CARDS[t.card];
      const name = t.variant === 'dbd' ? 'Double Black Diamond' : def.name;
      const text = t.variant === 'dbd' ? '+40 max HP. A yeti comes down every 4 days.' : def.text;
      parts.push(`<span class="kind">${KIND_LABEL[def.kind]}</span><b>${name}</b>${text}`);
    }
    const i = nodeAt(run.map, tile.x, tile.y);
    const p = run.map.nodes[i];
    if (p && p.junction >= 0) {
      const r = run.state.routes[p.junction];
      const name = ROUTE_NAME[r.kind];
      parts.push(
        `<span class="kind">Junction</span><b>${r.take ? `Taking the ${name}` : `Skiing past the ${name}`}</b>${
          r.kind === 'lift'
            ? r.take
              ? 'Up the lift for another descent (+1 mult), instead of home to the lodge.'
              : 'On down the trail towards the lodge.'
            : r.take
              ? 'Straight down the chute: fast and steep, skipping the trail in between.'
              : 'On along the trail, past everything you built there.'
        }<span class="kind">Click to switch · R switches the next one</span>`,
      );
    }
    if (!t && p && p.junction < 0) {
      const built = i >= run.map.loopLength;
      const label = { lodge: 'The lodge', lift: 'Chairlift', summit: 'The summit', trail: 'The trail', chute: 'Chute' }[p.kind];
      const hint = {
        lodge: 'Each lap cashes in here. Ride again or call it a day.',
        lift: built
          ? 'A lift you built. Riding it chains another descent: +1 mult, and new enemies arrive a level higher. You heal on the way up.'
          : 'The breather: you heal on the way up. Roadside cards still reach you.',
        summit: 'Top of the lift. The Baron starts here.',
        trail: 'Trail cards go here. Downhill is fast, traverses are slower.',
        chute: 'Steep and fast: +0.2 mult a tile, but your aim suffers. Trail cards go here too; a kicker here is a cliff drop.',
      }[p.kind];
      parts.push(`<b>${label}</b>${hint}`);
    }
    if (!parts.length) return this.hideTip();
    const rect = this.mapWrap.getBoundingClientRect();
    this.showTip(parts.join('<br><br>'), rect.left + cssX, rect.top + cssY);
  }

  // --- Pops over the map --------------------------------------------------------------------

  pop(text: string, tx: number, ty: number, cls = ''): void {
    const { x, y } = this.renderer.cssOf(tx, ty);
    const el = document.createElement('div');
    el.className = `pop ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y - this.renderer.tileCss * 0.4}px`;
    this.fxEl.append(el);
    setTimeout(() => el.remove(), 900);
  }

  burst(text: string, tx: number, ty: number): void {
    const { x, y } = this.renderer.cssOf(tx, ty);
    const el = document.createElement('div');
    el.className = 'burst';
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y - this.renderer.tileCss * 0.6}px`;
    el.style.rotate = `${(Math.random() - 0.5) * 20}deg`;
    this.fxEl.append(el);
    setTimeout(() => el.remove(), 800);
  }

  banner(text: string): void {
    const el = $('banner');
    el.textContent = text;
    el.classList.remove('hidden');
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = '';
    clearTimeout((el as unknown as { t?: number }).t);
    (el as unknown as { t?: number }).t = window.setTimeout(() => el.classList.add('hidden'), 2600);
  }

  hurt(): void {
    this.mapWrap.classList.remove('hurt');
    void this.mapWrap.offsetWidth;
    this.mapWrap.classList.add('hurt');
  }

  private text(id: string, value: string): void {
    if (this.changed(id, value)) $(id).textContent = value;
  }

  private changed(key: string, value: string): boolean {
    if (this.last.get(key) === value) return false;
    this.last.set(key, value);
    return true;
  }
}

/** The route index of the next junction ahead, or -1. */
function upcomingJunction(run: Run): number {
  return run.state.status === 'riding' || run.state.status === 'lodge' ? run.nextJunction() : -1;
}
