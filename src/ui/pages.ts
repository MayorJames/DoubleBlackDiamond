// The pages: the start page, how to play, and the play page with its three tabs (the town, the
// mountain, the ski loops), plus the settings box. Buttons anywhere can carry data-go (a page),
// data-view (a tab on the play page) or data-open="settings".

import type { Settings } from '../app/settings';
import { RULES, vignetteUrl } from '../render/art/vignettes';

export type Screen = 'start' | 'rules' | 'play';
export type View = 'town' | 'mountain' | 'loops';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface PageHooks {
  screen: (s: Screen) => void;
  view: (v: View) => void;
  settingsChanged: () => void;
}

export class Pages {
  screen: Screen = 'start';
  view: View = 'town';
  private rulesDrawn = false;

  constructor(
    private readonly hooks: PageHooks,
    private readonly settings: Settings,
  ) {
    document.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-go], [data-view], [data-open]');
      if (!el || (el as HTMLButtonElement).disabled) return;
      if (el.dataset.open === 'settings') return this.openSettings();
      if (el.dataset.go) this.go(el.dataset.go as Screen, el.dataset.view as View | undefined);
      else if (el.dataset.view) this.go('play', el.dataset.view as View);
    });
    $('settings-close').addEventListener('click', () => this.closeSettings());
    $('settings').addEventListener('click', (e) => {
      if (e.target === $('settings')) this.closeSettings();
    });
    const bind = (id: string, key: keyof Settings) =>
      $<HTMLInputElement>(id).addEventListener('change', (e) => {
        settings[key] = (e.target as HTMLInputElement).checked;
        hooks.settingsChanged();
      });
    bind('set-music', 'music');
    bind('set-sound', 'sound');
    bind('set-tips', 'cardTips');
    this.syncSettings();
  }

  /** Goes to a page (and, on the play page, a tab). */
  go(screen: Screen, view?: View): void {
    if (screen === 'rules') this.drawRules();
    const changed = screen !== this.screen;
    this.screen = screen;
    for (const s of ['start', 'rules', 'play'] as Screen[]) $(`${s}-screen`).classList.toggle('hidden', s !== screen);
    if (screen === 'play' && view && view !== this.view) {
      this.view = view;
      this.renderTabs();
      if (!changed) this.hooks.view(view);
    }
    this.renderTabs();
    if (changed || screen !== 'play') this.hooks.screen(screen);
  }

  show(screen: Screen): void {
    this.screen = screen === 'start' ? 'rules' : 'start';
    this.go(screen);
  }

  private renderTabs(): void {
    document.querySelectorAll<HTMLButtonElement>('.tabs [data-view]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.view === this.view)));
    for (const v of ['town', 'mountain', 'loops'] as View[]) $(`${v}-view`).classList.toggle('hidden', v !== this.view);
  }

  /** Marks the Ski Loops tab while an expedition is out. */
  setLive(live: boolean): void {
    document.querySelector('.tabs [data-view="loops"]')?.classList.toggle('live', live);
  }

  syncSettings(): void {
    $<HTMLInputElement>('set-music').checked = this.settings.music;
    $<HTMLInputElement>('set-sound').checked = this.settings.sound;
    $<HTMLInputElement>('set-tips').checked = this.settings.cardTips;
  }

  private openSettings(): void {
    this.syncSettings();
    $('settings').classList.remove('hidden');
    $('settings-close').focus();
  }

  /** Closes the settings box. Returns whether it was open. */
  closeSettings(): boolean {
    const open = !$('settings').classList.contains('hidden');
    $('settings').classList.add('hidden');
    return open;
  }

  /** A short note across the bottom of the screen. */
  toast(text: string): void {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.setAttribute('role', 'status');
      document.body.append(el);
    }
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  }

  private drawRules(): void {
    if (this.rulesDrawn) return;
    this.rulesDrawn = true;
    $('rules').replaceChildren(
      ...RULES.map((r, i) => {
        const el = document.createElement('article');
        el.className = 'panel rule';
        el.innerHTML = `<img alt="" src="${vignetteUrl(i, 3)}"><h2><span class="num">${i + 1}</span>${r.title}</h2><p>${r.text}</p>`;
        return el;
      }),
    );
  }
}
