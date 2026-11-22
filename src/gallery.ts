// Developer gallery: renders every detailed illustration so art can be checked at a glance.
// Not part of the game build (only index.html is an entry point).

import { CARDS, CARD_IDS } from './game/cards';
import { BUILDINGS, type BuildingId } from './game/lodge';
import { cardArtUrl } from './render/art/cardArt';
import { sceneStill } from './render/art/lodgeScene';
import { scaled } from './render/art/pixel';
import { portraitUrl, type PortraitId } from './render/art/portraits';

const root = document.getElementById('gallery')!;

function section(title: string, items: { label: string; el: HTMLElement }[]): void {
  const h = document.createElement('h2');
  h.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'grid';
  for (const { label, el } of items) {
    const fig = document.createElement('figure');
    const cap = document.createElement('figcaption');
    cap.textContent = label;
    fig.append(el, cap);
    grid.append(fig);
  }
  root.append(h, grid);
}

const img = (src: string) => Object.assign(document.createElement('img'), { src, alt: '' });

section(
  'Cards (4x)',
  CARD_IDS.map((id) => ({ label: CARDS[id].name, el: img(cardArtUrl(id, 4)) })),
);

const still = (built: BuildingId[]) => scaled(sceneStill(built), 3);
section('Lodge scene, nothing built (3x)', [{ label: 'Fresh lodge', el: still([]) }]);
section('Lodge scene, everything built (3x)', [{ label: 'Fully built', el: still(BUILDINGS.map((b) => b.id)) }]);

const portraitIds: PortraitId[] = ['hero', 'baron', 'widow', 'yetiKing', 'kickback'];
section(
  'Portraits (4x)',
  portraitIds.map((id) => ({ label: id, el: img(portraitUrl(id, 4)) })),
);
