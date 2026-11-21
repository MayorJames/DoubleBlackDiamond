// The lodge screen: what you have banked, buildings to spend it on, and the next expedition
// (trail rating, seed and the deck your buildings have unlocked).

import { CARDS } from '../game/cards';
import { RATINGS } from '../game/enemies';
import { BUILDINGS, canAfford, deckFor, type BuildingId, type Profile } from '../game/lodge';
import { spriteUrl, type SpriteName } from '../render/sprites';
import { cardArt, formatCash } from './runUi';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

const RATING_SYMBOLS = ['●', '■', '◆', '◆◆'];

export interface LodgeHooks {
  build: (id: BuildingId) => void;
  start: (rating: number, seed: string) => void;
  newSeed: () => string;
}

export class LodgeUi {
  rating = 0;

  constructor(hooks: LodgeHooks) {
    $('seed-random').addEventListener('click', () => {
      $<HTMLInputElement>('seed-input').value = hooks.newSeed();
    });
    $('start').addEventListener('click', () => {
      const seed = $<HTMLInputElement>('seed-input').value.trim().toUpperCase() || hooks.newSeed();
      hooks.start(this.rating, seed);
    });
    $('buildings').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-build]');
      if (b) hooks.build(b.dataset.build as BuildingId);
    });
    $('ratings').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-rating]');
      if (!b || b.disabled) return;
      this.rating = Number(b.dataset.rating);
      this.renderRatings(this.lastProfile!);
    });
  }

  private lastProfile: Profile | null = null;

  setSeed(seed: string): void {
    $<HTMLInputElement>('seed-input').value = seed;
  }

  render(p: Profile): void {
    this.lastProfile = p;
    this.rating = Math.min(this.rating, p.rating);
    $('p-cash').textContent = formatCash(p.cash);
    $('p-intel').textContent = String(p.intel);
    $('p-scrap').textContent = String(p.scrap);
    $('p-record').textContent = p.runs
      ? `Expeditions ${p.runs} · Barons beaten ${p.bossesBeaten} · Best haul ${formatCash(p.bestRun)}`
      : 'No expeditions yet. The mountain is waiting.';
    this.renderRatings(p);

    const deck = deckFor(p);
    $('deck').replaceChildren(
      ...deck.map((id) => {
        const s = document.createElement('span');
        s.innerHTML = `<img alt="" src="${cardArt(id)}">${CARDS[id].name}`;
        return s;
      }),
    );

    $('buildings').replaceChildren(
      ...BUILDINGS.map((b) => {
        const built = p.built.includes(b.id);
        const el = document.createElement('div');
        el.className = `building${built ? ' built' : ''}`;
        const cost = [formatCash(b.cost.cash), b.cost.intel ? `${b.cost.intel} intel` : '', b.cost.scrap ? `${b.cost.scrap} scrap` : '']
          .filter(Boolean)
          .join(' · ');
        // Built buildings flip to white-on-ink; red stays red.
        const icon = spriteUrl(b.icon as SpriteName, 3, built ? { k: 'w', d: 'l', m: 'l', w: 'k', s: 'd', l: 'm' } : undefined);
        el.innerHTML = `<img alt="" src="${icon}"><b>${b.name}</b><p>${b.text}</p><span class="cost">${built ? 'Built' : cost}</span>`;
        if (!built) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'btn small';
          btn.dataset.build = b.id;
          btn.textContent = canAfford(p, b) ? 'Build' : 'Need more';
          btn.disabled = !canAfford(p, b);
          el.append(btn);
        }
        return el;
      }),
    );
  }

  private renderRatings(p: Profile): void {
    $('ratings').replaceChildren(
      ...RATINGS.map((r, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `rating${i === this.rating ? ' on' : ''}`;
        b.dataset.rating = String(i);
        b.disabled = i > p.rating;
        b.title = i > p.rating ? 'Beat the Baron on the trail before this to unlock it.' : `Enemies x${r.enemy}, payout x${r.payout}`;
        b.innerHTML = `<span class="sym">${RATING_SYMBOLS[i]}</span>${r.name}`;
        return b;
      }),
    );
  }
}
