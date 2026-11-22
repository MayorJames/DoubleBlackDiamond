// Wires everything: the lodge hub, an expedition (Run), the renderer, the UI, input and sound.
// The run only changes through commands; everything else reads it.

import { Sfx } from '../audio/sfx';
import { CARDS } from '../game/cards';
import { RATINGS } from '../game/enemies';
import { bankRun, bonusesFor, build, deckFor, toggleCard, type BuildingId } from '../game/lodge';
import { Run, type Command, type RunEvent } from '../game/run';
import type { CardId } from '../game/cards';
import type { Stance } from '../game/stats';
import { MapRenderer, type Selection } from '../render/mapRenderer';
import { LodgeUi } from '../ui/lodgeUi';
import { Overlays } from '../ui/overlays';
import { formatCash, RunUi } from '../ui/runUi';
import { FixedLoop } from './loop';
import { loadProfile, saveProfile } from './storage';

const SEED_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const BURST_WORDS = ['WHAM!', 'THWACK!', 'KAPOW!', 'SPLAT!', 'KLONK!', 'BOFF!', 'ZOK!'];
const STANCE_ORDER: Stance[] = ['plow', 'cruise', 'tuck'];

export function randomSeed(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => SEED_ALPHABET[b % SEED_ALPHABET.length]).join('');
}

function seedFromUrl(): string | null {
  try {
    const s = decodeURIComponent(location.hash.slice(1)).trim().toUpperCase();
    return /^[A-Z0-9-]{1,24}$/.test(s) ? s : null;
  } catch {
    return null;
  }
}

export class App {
  private readonly profile = loadProfile();
  private run: Run | null = null;
  private readonly renderer: MapRenderer;
  private readonly runUi: RunUi;
  private readonly lodgeUi: LodgeUi;
  private readonly overlays: Overlays;
  private readonly sfx = new Sfx();
  private readonly loop: FixedLoop;
  private readonly canvas = document.getElementById('map') as HTMLCanvasElement;
  private selection: Selection | null = null;
  private resumeSpeed = 1;
  private autoPaused = false;
  private speed = 1;
  /** Positions before the last tick, to interpolate between ticks. */
  private prevHero = { x: 0, y: 0 };
  private readonly prevChasers = new Map<number, { x: number; y: number }>();
  private elapsed = 0;
  private banked = false;
  private unlockedRating: string | null = null;

  constructor() {
    this.renderer = new MapRenderer(this.canvas);
    this.runUi = new RunUi(
      {
        selectCard: (i) => this.select(i),
        burnCard: (i) => this.burn(i),
        setStance: (s) => this.command({ type: 'stance', stance: s }),
        setSpeed: (s) => this.setSpeed(s),
        equip: (i) => this.command({ type: 'equip', item: i }),
        salvage: (i) => this.command({ type: 'salvage', item: i }),
        bail: () => this.command({ type: 'bail' }),
      },
      this.renderer,
    );
    this.lodgeUi = new LodgeUi({
      build: (id) => this.build(id),
      toggleCard: (id) => this.toggleCard(id),
      start: (rating, seed) => this.startRun(rating, seed),
      newSeed: randomSeed,
    });
    this.overlays = new Overlays({
      rideAgain: () => this.rideAgain(),
      callIt: () => this.command({ type: 'retreat' }),
      toLodge: () => this.toLodge(),
    });
    this.loop = new FixedLoop(
      () => this.tick(),
      (alpha, dt) => this.frame(alpha, dt),
    );
    this.lodgeUi.setSeed(seedFromUrl() ?? randomSeed());
    this.lodgeUi.render(this.profile);
    this.bindInput();
    this.loop.start();
  }

  // --- Screens ------------------------------------------------------------------------------

  private startRun(rating: number, seed: string): void {
    this.sfx.unlock();
    this.run = Run.create({ seed, rating, deck: deckFor(this.profile), bonuses: bonusesFor(this.profile) });
    this.banked = false;
    this.unlockedRating = null;
    this.selection = null;
    this.runUi.reset();
    this.prevHero = this.run.heroPos();
    this.prevChasers.clear();
    document.getElementById('lodge-screen')!.classList.add('hidden');
    document.getElementById('run-screen')!.classList.remove('hidden');
    this.renderer.resize();
    this.renderer.setRun(this.run);
    this.setSpeed(1);
    try {
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${seed}`);
    } catch {
      // Embeds may forbid this; the seed is on the lodge screen anyway.
    }
    this.runUi.banner(`${RATINGS[rating].name} · seed ${seed}`);
  }

  private toLodge(): void {
    this.overlays.hideResult();
    this.overlays.hideTally();
    this.run = null;
    document.getElementById('run-screen')!.classList.add('hidden');
    document.getElementById('lodge-screen')!.classList.remove('hidden');
    this.lodgeUi.setSeed(randomSeed());
    this.lodgeUi.render(this.profile);
  }

  private build(id: BuildingId): void {
    if (build(this.profile, id)) {
      saveProfile(this.profile);
      this.sfx.unlock();
      this.sfx.chaChing();
      this.lodgeUi.render(this.profile);
    }
  }

  private toggleCard(id: CardId): void {
    if (toggleCard(this.profile, id)) {
      saveProfile(this.profile);
      this.sfx.unlock();
      this.sfx.place();
      this.lodgeUi.render(this.profile);
    }
  }

  // --- Commands -----------------------------------------------------------------------------

  /** Applies a command right away (even while paused) and reacts to what it caused. */
  private command(c: Command): void {
    if (!this.run) return;
    this.sfx.unlock();
    this.run.applyCommands([c]);
    this.handle(this.run.drainEvents());
  }

  private setSpeed(s: number): void {
    this.speed = s;
    this.loop.speed = s;
    this.autoPaused = false;
  }

  private select(i: number | null): void {
    if (!this.run) return;
    this.runUi.selected = i;
    this.selection = i === null ? null : { card: this.run.state.hand[i], hover: null };
    this.canvas.classList.toggle('placing', i !== null);
    // Planning pauses time, Loop Hero style, and resumes once the card is down.
    if (i !== null && this.speed > 0) {
      this.resumeSpeed = this.speed;
      this.loop.speed = 0;
      this.speed = 0;
      this.autoPaused = true;
    } else if (i === null && this.autoPaused) {
      this.setSpeed(this.resumeSpeed);
    }
  }

  private burn(i: number): void {
    if (!this.run?.state.hand[i]) return;
    const name = CARDS[this.run.state.hand[i]].name;
    this.select(null);
    this.command({ type: 'burn', hand: i });
    const me = this.run.heroPos();
    this.runUi.pop(`Burned ${name}: +1 intel`, me.x, me.y - 0.6, 'loot');
  }

  /** Flips the next junction ahead of the skier. */
  private flipNext(): void {
    const k = this.run?.nextJunction() ?? -1;
    if (k >= 0) this.command({ type: 'switch', route: k });
  }

  private rideAgain(): void {
    if (this.run?.state.status !== 'lodge') return;
    this.overlays.hideTally();
    this.command({ type: 'rideAgain' });
  }

  // --- The loop -----------------------------------------------------------------------------

  private tick(): void {
    const run = this.run;
    if (!run || run.state.status !== 'riding') return;
    this.prevHero = run.heroPos();
    this.prevChasers.clear();
    for (const e of run.state.enemies) if (e.ride) this.prevChasers.set(e.id, { x: e.x, y: e.y });
    run.step();
    this.handle(run.drainEvents());
  }

  private frame(alpha: number, dt: number): void {
    this.elapsed += dt;
    const run = this.run;
    if (!run) return;
    const cur = run.heroPos();
    const hero = run.state.status === 'riding' ? lerp(this.prevHero, cur, alpha) : cur;
    const chasers = new Map<number, { x: number; y: number }>();
    for (const e of run.state.enemies) {
      if (!e.ride) continue;
      const prev = this.prevChasers.get(e.id);
      chasers.set(e.id, prev ? lerp(prev, e, alpha) : { x: e.x, y: e.y });
    }
    if (this.selection) this.selection.card = run.state.hand[this.runUi.selected ?? -1] ?? this.selection.card;
    this.renderer.render(run, {
      hero,
      chasers,
      time: this.elapsed,
      dt: this.speed > 0 ? dt : dt * 0.25,
      selection: this.selection,
      paused: this.speed === 0 && run.state.status === 'riding',
    });
    this.runUi.update(run, this.speed);
    const moving = run.state.status === 'riding' && this.speed > 0;
    const stanceSpeed = { tuck: 1.4, cruise: 0.8, plow: 0.4 }[run.state.hero.stance];
    this.sfx.ambient(stanceSpeed, run.state.hero.stance === 'plow' ? 1 : 0, moving);
  }

  // --- Events -------------------------------------------------------------------------------

  private handle(events: RunEvent[]): void {
    const run = this.run;
    if (!run) return;
    const fx = this.renderer.fx;
    const T = 16;
    for (const e of events) {
      switch (e.type) {
        case 'shot': {
          const me = run.heroPos();
          const missX = e.hit ? 0 : (Math.random() - 0.5) * 0.6;
          fx.tracer(me.x * T + 3, me.y * T - 6, (e.toX + missX) * T, (e.toY - 0.3) * T, false);
          if (e.hit) {
            fx.burst(e.toX * T, (e.toY - 0.3) * T, e.crit ? 8 : 3);
            this.runUi.pop(e.crit ? `CRIT ${e.damage}` : String(e.damage), e.toX, e.toY - 0.5, e.crit ? 'red big' : '');
          }
          this.sfx.gunshot();
          break;
        }
        case 'enemyShot':
          fx.tracer(e.fromX * T, (e.fromY - 0.4) * T, e.toX * T, (e.toY - 0.4) * T, true);
          fx.fired.set(e.enemy, 0);
          if (e.air) this.runUi.pop('AIR!', e.toX, e.toY - 0.8);
          else if (!e.hit) this.runUi.pop('miss', e.toX + 0.3, e.toY - 0.6);
          this.sfx.enemyShot(e.kind === 'sniper' ? 20 : 60);
          break;
        case 'heroHit': {
          const me = run.heroPos();
          this.runUi.pop(`-${e.damage}`, me.x, me.y - 0.7, 'red big');
          fx.heroHit = 0.35;
          this.renderer.shake = Math.max(this.renderer.shake, 0.5);
          this.runUi.hurt();
          this.sfx.oof();
          break;
        }
        case 'kill': {
          const sprite = this.renderer.atlas.get(e.kind === 'snowmobile' ? 'snowmobile' : e.kind);
          fx.fling(sprite, e.x * T, (e.y - 0.4) * T);
          fx.burst(e.x * T, (e.y - 0.4) * T, 12);
          this.runUi.burst(e.kind === 'baron' ? 'KA-BOOM!' : BURST_WORDS[Math.floor(Math.random() * BURST_WORDS.length)], e.x, e.y - 0.6);
          this.sfx.slideWhistle();
          if (e.kind === 'yeti' || e.kind === 'baron') this.sfx.bonk();
          break;
        }
        case 'route': {
          const r = run.state.routes[e.route];
          fx.burst(e.x * T + 8, e.y * T + 8, 16);
          this.runUi.banner(
            r.kind === 'lift'
              ? 'Chairlift open! Ride it to chain another descent (+1 mult). Click the junction to ski past.'
              : 'Chute open! A steep shortcut straight down. Click the junction to ski past.',
          );
          this.sfx.chaChing();
          break;
        }
        case 'switch': {
          const r = run.state.routes[e.route];
          this.runUi.pop(e.take ? (r.kind === 'lift' ? 'Lift: ride' : 'Chute: drop in') : 'Ski on', r.x + 0.5, r.y - 0.2, e.take ? 'red' : '');
          fx.ring(r.x * T + 8, r.y * T + 8);
          this.sfx.chipTick(e.take ? 6 : 2);
          break;
        }
        case 'chain':
          this.runUi.burst(`CHAIN ×${e.descents}!`, e.x, e.y - 0.6);
          this.runUi.pop('+1.0× chained descent', e.x, e.y - 1.2, 'red big');
          this.runUi.pulseHand();
          this.sfx.chaChing();
          break;
        case 'chips':
          this.runUi.pop(`+${e.chips} ${e.label}${e.mult >= 0.05 ? ` +${e.mult.toFixed(1)}×` : ''}`, e.x, e.y - 0.9, e.mult >= 0.05 ? 'red' : '');
          this.runUi.pulseHand();
          this.sfx.chipTick(run.state.lapHand.lines.reduce((s, l) => s + l.count, 0));
          break;
        case 'loot':
          if (e.what === 'item' || e.what === 'card') this.runUi.pop(e.what === 'item' ? `+ ${e.label}` : '+ card', e.x, e.y - 1.3, 'loot');
          break;
        case 'heal':
          this.runUi.pop(`+${e.amount} HP`, e.x, e.y - 0.6);
          break;
        case 'placed':
          fx.ring(e.x * T + 8, e.y * T + 8);
          this.sfx.place();
          break;
        case 'avalanche':
          fx.burst(e.x * T + 8, e.y * T + 8, 30);
          this.runUi.burst('WHUMP!', e.x + 0.5, e.y + 0.5);
          this.sfx.yardSale();
          break;
        case 'doubleBlack':
          this.runUi.banner('Double Black Diamond! +40 max HP. Yetis live here now.');
          this.sfx.alarm();
          break;
        case 'boss':
          this.runUi.banner('The Avalanche Baron is coming down the mountain!');
          this.sfx.alarm();
          break;
        case 'discard':
          this.runUi.pop(`Hand full: burned ${CARDS[e.card].name}`, run.heroPos().x, run.heroPos().y - 1.4, 'loot');
          break;
        case 'lap':
          this.select(null);
          this.overlays.showTally(
            {
              lap: e.lap,
              chips: e.chips,
              mult: e.mult,
              points: e.points,
              lines: e.lines,
              lapTime: e.lapTime,
              descents: e.descents,
              nextLevel: run.state.descent + 1,
              enemies: run.state.enemies.length,
              bossSoon: !run.state.boss.spawned && run.state.boss.meter >= run.state.boss.max * 0.75,
            },
            (i) => this.sfx.chipTick(i),
            () => this.sfx.chaChing(),
          );
          break;
        case 'end':
          this.endRun(e.status === 'won');
          break;
      }
    }
  }

  private endRun(won: boolean): void {
    const run = this.run!;
    const st = run.state;
    this.select(null);
    this.overlays.hideTally();
    if (!this.banked && st.payout) {
      this.banked = true;
      const before = this.profile.rating;
      bankRun(this.profile, st.status, st.payout, st.rating);
      if (this.profile.rating > before) this.unlockedRating = `Unlocked: ${RATINGS[this.profile.rating].name}`;
      saveProfile(this.profile);
    }
    if (won) this.sfx.fanfare();
    else if (st.status === 'wiped') {
      this.sfx.yardSale();
      this.sfx.sadTrombone();
      const me = run.heroPos();
      this.renderer.fx.fling(this.renderer.atlas.get('heroDown'), me.x * 16, me.y * 16 - 6);
      this.runUi.burst('YARD SALE!', me.x, me.y - 0.5);
    } else if (st.status === 'bailed') this.sfx.sadTrombone();
    else this.sfx.chaChing();
    const record: [string, string][] = [
      ['Laps', String(st.status === 'retreated' || st.status === 'won' ? st.lap : st.lap - 1)],
      ['Descents', String(st.record.descents)],
      ['Routes built', String(st.routes.length)],
      ['Guards down', String(st.record.kills)],
      ['Best lap', formatCash(st.record.bestLap)],
      ['Cards placed', String(st.record.placed)],
      ['Loot found', String(st.record.items)],
      ['Days', String(st.day)],
    ];
    setTimeout(() => this.overlays.showResult(st.status, st.payout!, st.rating, record, this.unlockedRating), won || st.status === 'wiped' ? 900 : 200);
  }

  // --- Input --------------------------------------------------------------------------------

  private bindInput(): void {
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      const run = this.run;
      if (!run) return;
      if (e.code === 'Enter' && this.overlays.tallyOpen) {
        e.preventDefault();
        this.rideAgain();
        return;
      }
      if (this.overlays.resultOpen && e.code === 'Enter') {
        this.toLodge();
        return;
      }
      const i = STANCE_ORDER.indexOf(run.state.hero.stance);
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          e.preventDefault();
          this.command({ type: 'stance', stance: STANCE_ORDER[Math.min(2, i + 1)] });
          break;
        case 'KeyS':
        case 'ArrowDown':
          e.preventDefault();
          this.command({ type: 'stance', stance: STANCE_ORDER[Math.max(0, i - 1)] });
          break;
        case 'Space':
          e.preventDefault();
          if (this.selection) this.select(null);
          this.setSpeed(this.speed === 0 ? this.resumeSpeed || 1 : 0);
          if (this.speed === 0) this.resumeSpeed = 1;
          break;
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
          this.setSpeed(Number(e.code.slice(5)));
          break;
        case 'Escape':
          this.select(null);
          break;
        case 'KeyR':
          this.flipNext();
          break;
        case 'KeyM':
          this.sfx.toggleMute();
          break;
      }
    });

    const local = (e: MouseEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    this.canvas.addEventListener('mousemove', (e) => {
      if (!this.run) return;
      const p = local(e);
      const tile = this.renderer.tileAtCss(p.x, p.y);
      this.canvas.classList.toggle('switchable', !this.selection && !!tile && this.run.junctionAt(tile.x, tile.y) >= 0);
      if (this.selection) {
        this.selection.hover = tile;
        this.runUi.hideTip();
      } else this.runUi.mapHover(this.run, tile, p.x, p.y);
    });
    this.canvas.addEventListener('mouseleave', () => {
      if (this.selection) this.selection.hover = null;
      this.runUi.hideTip();
    });
    document.getElementById('flip')!.addEventListener('click', () => this.flipNext());
    this.canvas.addEventListener('click', (e) => {
      const run = this.run;
      if (!run) return;
      const p = local(e);
      const tile = this.renderer.tileAtCss(p.x, p.y);
      if (!this.selection) {
        // Without a card in hand, clicking a junction flips its switch.
        const k = tile ? run.junctionAt(tile.x, tile.y) : -1;
        if (k >= 0) this.command({ type: 'switch', route: k });
        return;
      }
      const index = this.runUi.selected;
      if (!tile || index === null || !run.canPlace(this.selection.card, tile.x, tile.y)) return;
      this.command({ type: 'place', hand: index, x: tile.x, y: tile.y });
      this.select(null);
    });
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.select(null);
    });
  }
}

const lerp = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
