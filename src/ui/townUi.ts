// The Ski Town tab: the town itself as a pixel panorama, the buildings you can put up, the deck
// you choose from the cards they've unlocked, the Trail Crew's yard of course tiles, and your
// trophy wall. While an expedition is out it's look-but-don't-touch.

import { CARDS, type CardId } from '../game/cards';
import { ENEMIES } from '../game/enemies';
import { BUILDINGS, canAfford, canBuyTile, DECK_MAX, DECK_MIN, deckFor, unlockedCards, type Building, type BuildingId, type Profile } from '../game/lodge';
import { COURSE_TILE_IDS, COURSE_TILES, tilesInUse, type CourseTile } from '../game/mountain';
import { cardArtUrl } from '../render/art/cardArt';
import { courseIconUrl } from '../render/art/courseArt';
import { buildingIcon, LodgeScene } from '../render/art/lodgeScene';
import { formatCash } from './runUi';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface TownHooks {
  build: (id: BuildingId) => void;
  toggleCard: (id: CardId) => void;
  buyTile: (tile: CourseTile) => void;
}

type Cost = { cash: number; intel: number; scrap: number };

export const costText = (c: Cost): string =>
  [formatCash(c.cash), c.intel ? `${c.intel} intel` : '', c.scrap ? `${c.scrap} scrap` : ''].filter(Boolean).join(' · ');

export class TownUi {
  /** The pixel panorama at the top of the town. */
  readonly scene = new LodgeScene($<HTMLCanvasElement>('lodge-scene'));
  private lastProfile: Profile | null = null;
  private locked = false;

  constructor(hooks: TownHooks) {
    this.bindScene();
    $('deck').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-card]');
      if (b && !b.disabled) hooks.toggleCard(b.dataset.card as CardId);
    });
    $('buildings').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-build]');
      if (b && !b.disabled) hooks.build(b.dataset.build as BuildingId);
    });
    $('tile-shop').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tile]');
      if (b && !b.disabled) hooks.buyTile(b.dataset.tile as CourseTile);
    });
  }

  /** Hovering a building in the scene names it; clicking jumps to its card. */
  private bindScene(): void {
    const canvas = this.scene.canvas;
    const tip = $('scene-tip');
    const at = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      return this.scene.plotAt(e.clientX - r.left, e.clientY - r.top);
    };
    canvas.addEventListener('mousemove', (e) => {
      const id = at(e);
      this.scene.hover = id;
      canvas.classList.toggle('over-plot', !!id);
      const b = id && BUILDINGS.find((x) => x.id === id);
      if (!b || !this.lastProfile) {
        tip.classList.add('hidden');
        return;
      }
      const built = this.lastProfile.built.includes(b.id);
      tip.innerHTML = `<span class="kind">${built ? 'Built' : 'Empty plot'}</span><b>${b.name}</b>${b.text}${
        built ? '' : `<span class="kind">${costText(b.cost)} · click to find it below</span>`
      }`;
      tip.classList.remove('hidden');
      tip.style.left = `${Math.min(window.innerWidth - tip.offsetWidth - 8, e.clientX + 14)}px`;
      tip.style.top = `${Math.min(window.innerHeight - tip.offsetHeight - 8, e.clientY + 14)}px`;
    });
    canvas.addEventListener('mouseleave', () => {
      this.scene.hover = null;
      tip.classList.add('hidden');
    });
    canvas.addEventListener('click', (e) => {
      const id = at(e);
      const card = id && document.querySelector<HTMLElement>(`.building[data-building="${id}"]`);
      if (!card) return;
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.remove('flash');
      void card.offsetWidth;
      card.classList.add('flash');
    });
    window.addEventListener('resize', () => this.scene.resize());
  }

  render(p: Profile, locked: boolean): void {
    this.lastProfile = p;
    this.locked = locked;
    this.scene.setTown(p);
    $('run-lock-town').classList.toggle('hidden', !locked);
    const trophies = p.trophies?.length ? `Trophies: ${p.trophies.map((t) => ENEMIES[t].name).join(', ')}.` : 'No boss trophies yet.';
    $('p-record').textContent = p.runs
      ? `Expeditions ${p.runs} · Barons beaten ${p.bossesBeaten} · Best haul ${formatCash(p.bestRun)}. ${trophies}`
      : 'No expeditions yet. The mountain is waiting.';

    // Every unlocked card, in or out of the deck. Full decks can't take more; small ones can't shrink.
    const deck = deckFor(p);
    $('deck-count').textContent = `${deck.length}/${DECK_MAX}`;
    $('deck').replaceChildren(
      ...unlockedCards(p).map((id) => {
        const inDeck = deck.includes(id);
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.card = id;
        b.className = inDeck ? 'in' : 'out';
        b.disabled = locked || (inDeck ? deck.length <= DECK_MIN : deck.length >= DECK_MAX);
        b.title = `${CARDS[id].name}: ${CARDS[id].text}${b.disabled && !locked ? (inDeck ? ` (a deck needs at least ${DECK_MIN} cards)` : ' (deck full: take a card out first)') : ''}`;
        b.setAttribute('aria-pressed', String(inDeck));
        b.innerHTML = `<img alt="" src="${cardArtUrl(id, 1)}">${CARDS[id].name}`;
        return b;
      }),
    );

    $('buildings').replaceChildren(...BUILDINGS.map((b) => this.buildingCard(p, b)));

    // The Trail Crew's yard: what you have (on the mountain and in stock), and what's for sale.
    const used = tilesInUse(p.mountain);
    $('tile-shop').replaceChildren(
      ...COURSE_TILE_IDS.map((t) => {
        const info = COURSE_TILES[t];
        const row = document.createElement('div');
        row.className = 'tile-row';
        const where = used[t] ? ` · ${used[t]} on the mountain` : '';
        const needs = info.needs && !p.built.includes(info.needs) ? `Needs ${BUILDINGS.find((b) => b.id === info.needs)!.name}` : '';
        row.innerHTML = `<img alt="" src="${courseIconUrl(t, 1)}"><div><b>${info.name}</b> <span class="have">${p.tiles[t]} in stock${where}</span><small>${
          info.price ? (needs || costText(info.price)) : 'Earned by beating the Baron'
        }</small></div>`;
        if (info.price) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn small';
          btn.dataset.tile = t;
          btn.textContent = 'Buy';
          btn.disabled = locked || !canBuyTile(p, t);
          btn.title = info.text;
          row.append(btn);
        }
        return row;
      }),
    );
  }

  private buildingCard(p: Profile, b: Building): HTMLElement {
    const built = p.built.includes(b.id);
    const el = document.createElement('div');
    el.className = `building${built ? ' built' : ''}`;
    el.dataset.building = b.id;
    el.innerHTML = `<img alt="" src="${buildingIcon(b.id, true, 2)}"><b>${b.name}</b><p>${b.text}</p><span class="cost">${built ? 'Built' : costText(b.cost)}</span>`;
    if (!built) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn small';
      btn.dataset.build = b.id;
      btn.textContent = this.locked ? 'After the expedition' : canAfford(p, b) ? 'Build' : 'Need more';
      btn.disabled = this.locked || !canAfford(p, b);
      el.append(btn);
    }
    return el;
  }
}
