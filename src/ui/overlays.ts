// The lap tally at the lodge (Balatro's scoring moment, plus the vision's "Ride again?") and
// the end-of-expedition result.

import { BOSS_INFO, difficultyMods, ENEMIES, RATINGS, ratingOf, type BossKind } from '../game/enemies';
import { portraitUrl } from '../render/art/portraits';
import type { HandLine, Payout, RunStatus } from '../game/run';
import { formatCash } from './runUi';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface TallyInfo {
  lap: number;
  chips: number;
  mult: number;
  points: number;
  kills: number;
  bounty: number;
  lines: HandLine[];
  lapTime: number;
  descents: number;
  nextLevel: number;
  enemies: number;
  bossSoon: boolean;
}

export class Overlays {
  private counting = 0;

  private onBossClose: (() => void) | null = null;

  constructor(hooks: { rideAgain: () => void; callIt: () => void; toLodge: () => void }) {
    $('boss-go').addEventListener('click', () => this.hideBoss());
    $('ride-again').addEventListener('click', hooks.rideAgain);
    $('call-it').addEventListener('click', hooks.callIt);
    $('to-lodge').addEventListener('click', hooks.toLodge);
  }

  get tallyOpen(): boolean {
    return !$('tally').classList.contains('hidden');
  }

  get bossOpen(): boolean {
    return !$('boss-splash').classList.contains('hidden');
  }

  /** A boss's dossier slams down over the map; `onClose` runs when you dismiss it. */
  showBoss(kind: 'baron' | BossKind, onClose: () => void): void {
    const info = BOSS_INFO[kind];
    $<HTMLImageElement>('boss-portrait').src = portraitUrl(kind, 4);
    $('boss-epithet').textContent = info.epithet;
    $('boss-name').textContent = ENEMIES[kind].name;
    $('boss-text').textContent = info.text;
    $('boss-reward').textContent = info.reward;
    $('boss-splash').classList.remove('hidden');
    this.onBossClose = onClose;
    $('boss-go').focus();
  }

  hideBoss(): void {
    if (!this.bossOpen) return;
    $('boss-splash').classList.add('hidden');
    const done = this.onBossClose;
    this.onBossClose = null;
    done?.();
  }

  get resultOpen(): boolean {
    return !$('result').classList.contains('hidden');
  }

  /** Lines tick in one by one, then chips × mult counts up. `tick` plays a blip per line. */
  showTally(t: TallyInfo, tick: (i: number) => void, done: () => void): void {
    const descents = t.descents > 1 ? ` · ${t.descents} descents` : '';
    $('tally-title').textContent = `Lap ${t.lap}${descents} · ${t.lapTime.toFixed(0)}s · at the lodge`;
    const lines = [...t.lines].sort((a, b) => b.chips - a.chips || b.mult - a.mult);
    $('tally-lines').replaceChildren(
      ...(lines.length ? lines : [{ label: 'A quiet lap', chips: 0, mult: 0, count: 0 }]).map((l, i) => {
        const li = document.createElement('li');
        li.style.animationDelay = `${i * 0.09}s`;
        const count = l.count > 1 ? ` ×${l.count}` : '';
        li.innerHTML = `<span>${l.label}${count}</span><span>${l.chips ? `+${l.chips} chips` : ''}</span><span class="m">${l.mult >= 0.05 ? `+${l.mult.toFixed(1)}×` : ''}</span>`;
        setTimeout(() => tick(i), i * 90);
        return li;
      }),
    );
    $('tally-chips').textContent = String(t.chips);
    $('tally-mult').textContent = String(t.points);
    $('tally-kills').textContent = String(t.kills);
    $('tally-points').textContent = '$0';
    const note = [`Next descent: new enemies arrive at level ${t.nextLevel}.`, `${t.enemies} on the mountain now.`];
    if (t.bossSoon) note.push('The Baron is close.');
    $('tally-note').textContent = note.join(' ');
    $('tally').classList.remove('hidden');
    $('ride-again').focus();

    const start = performance.now() + lines.length * 90 + 150;
    const id = ++this.counting;
    const count = (now: number) => {
      if (id !== this.counting) return;
      const k = Math.min(1, Math.max(0, (now - start) / 600));
      $('tally-points').textContent = formatCash(t.bounty * k);
      if (k < 1) requestAnimationFrame(count);
      else done();
    };
    requestAnimationFrame(count);
  }

  hideTally(): void {
    this.counting++;
    $('tally').classList.add('hidden');
  }

  showResult(status: RunStatus, payout: Payout, difficulty: number, record: [string, string][], unlocked: string | null): void {
    const titles: Record<RunStatus, [string, string]> = {
      retreated: ['Called it a day', 'Home for cocoa with everything you carried.'],
      won: ['Baron defeated!', 'The Avalanche Baron is snow angel material. Everything is yours.'],
      bailed: ['Bailed out', 'You walked down. You kept 60% of the haul.'],
      wiped: ['Yard sale!', 'Skis here, goggles there. Ski patrol saved 30% of your haul.'],
      riding: ['', ''],
      lodge: ['', ''],
    };
    const [title, sub] = titles[status];
    const pay = difficultyMods(difficulty).payout;
    $('result-title').textContent = title;
    $('result-sub').textContent = `${sub} ${RATINGS[ratingOf(difficulty)].name}: bounties paid x${pay.toFixed(2)}.`;
    $('result-pay').innerHTML = [
      ['Cash', formatCash(payout.cash)],
      ['Intel', String(payout.intel)],
      ['Scrap', String(payout.scrap)],
    ]
      .map(([k, v]) => `<div><span class="label">${k}</span><b>${v}</b></div>`)
      .join('');
    $('result-stats').innerHTML = record.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
    const unlock = $('result-unlock');
    unlock.classList.toggle('hidden', !unlocked);
    unlock.textContent = unlocked ?? '';
    $('result').classList.remove('hidden');
    $('to-lodge').focus();
  }

  hideResult(): void {
    $('result').classList.add('hidden');
  }
}
