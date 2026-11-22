// Wires everything: the start and rules pages, the play page's three tabs (the town, the
// mountain, the ski loops), an expedition (Run), the renderers, the UI, input and sound. The run
// only changes through commands; everything else reads it.

import { Music } from '../audio/music';
import { Sfx } from '../audio/sfx';
import { CARDS, type CardId } from '../game/cards';
import { ENEMIES, RATINGS, ratingOf, type BossKind } from '../game/enemies';
import { bankRun, bonusesFor, build, buyTile, deckFor, toggleCard, type BuildingId } from '../game/lodge';
import { clearPlan, COURSE_TILES, runSetup, type CourseTile } from '../game/mountain';
import { Run, type Command, type RunEvent } from '../game/run';
import type { Stance } from '../game/stats';
import { LodgeScene } from '../render/art/lodgeScene';
import { portraitUrl } from '../render/art/portraits';
import { MapRenderer, type Selection } from '../render/mapRenderer';
import { MountainUi } from '../ui/mountainUi';
import { Overlays } from '../ui/overlays';
import { Pages, type Screen, type View } from '../ui/pages';
import { formatCash, RunUi } from '../ui/runUi';
import { TownUi } from '../ui/townUi';
import { FixedLoop } from './loop';
import { loadSettings, saveSettings } from './settings';
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
  private readonly profile = loadProfile(seedFromUrl() ?? randomSeed());
  private readonly settings = loadSettings();
  private run: Run | null = null;
  private readonly renderer: MapRenderer;
  private readonly runUi: RunUi;
  private readonly townUi: TownUi;
  private readonly mountainUi: MountainUi;
  private readonly pages: Pages;
  private readonly startScene = new LodgeScene(document.getElementById('start-scene') as HTMLCanvasElement);
  private readonly overlays: Overlays;
  private readonly sfx = new Sfx();
  private readonly music = new Music(this.sfx);
  private readonly loop: FixedLoop;
  private readonly canvas = document.getElementById('map') as HTMLCanvasElement;
  private selection: Selection | null = null;
  private resumeSpeed = 1;
  private autoPaused = false;
  private speed = 1;
  /** The speed the slopes were at when you left the Ski Loops tab, restored when you come back. */
  private awaySpeed: number | null = null;
  /** Positions before the last tick, to interpolate between ticks. */
  private prevHero = { x: 0, y: 0 };
  private readonly prevChasers = new Map<number, { x: number; y: number }>();
  private elapsed = 0;
  private banked = false;
  private earnedTiles: CourseTile[] = [];

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
        buy: (i) => this.command({ type: 'buy', offer: i }),
        reroll: () => this.command({ type: 'reroll' }),
        settingsChanged: () => this.settingsChanged(),
      },
      this.renderer,
      this.settings,
    );
    this.townUi = new TownUi({
      build: (id) => this.build(id),
      toggleCard: (id) => this.toggleCard(id),
      buyTile: (t) => this.buyTile(t),
    });
    this.mountainUi = new MountainUi({
      changed: () => {
        saveProfile(this.profile);
        this.sfx.unlock();
        this.sfx.place();
        this.townUi.render(this.profile, !!this.run);
      },
      start: () => this.startRun(),
      newSeed: randomSeed,
      reseed: (seed) => this.reseed(seed),
    });
    this.pages = new Pages(
      {
        screen: (s) => this.onScreen(s),
        view: (v) => this.onView(v),
        settingsChanged: () => this.settingsChanged(),
      },
      this.settings,
    );
    this.overlays = new Overlays({
      rideAgain: () => this.rideAgain(),
      callIt: () => this.command({ type: 'retreat' }),
      toLodge: () => this.toTown(),
    });
    this.loop = new FixedLoop(
      () => this.tick(),
      (alpha, dt) => this.frame(alpha, dt),
    );
    this.startScene.fit = 'cover';
    this.refreshHome();
    this.bindInput();
    this.loop.start();
    this.pages.show('start');
    // Browsers only allow sound after a gesture: start the music on the first one.
    window.addEventListener(
      'pointerdown',
      () => {
        this.sfx.unlock();
        this.applySound();
      },
      { once: true },
    );
  }

  // --- Pages and tabs -----------------------------------------------------------------------

  /** Everything that shows the save: the stash, the town, the mountain, the start page. */
  private refreshHome(): void {
    const p = this.profile;
    const locked = !!this.run;
    document.getElementById('p-cash')!.textContent = formatCash(p.cash);
    document.getElementById('p-intel')!.textContent = String(p.intel);
    document.getElementById('p-scrap')!.textContent = String(p.scrap);
    this.townUi.render(p, locked);
    this.mountainUi.render(p, locked);
    document.getElementById('run-lock-mountain')!.classList.toggle('hidden', !locked);
    this.startScene.setTown(p);
    document.getElementById('start-record')!.textContent = p.runs
      ? `${p.runs} expedition${p.runs === 1 ? '' : 's'} · ${p.bossesBeaten} Baron${p.bossesBeaten === 1 ? '' : 's'} beaten · your mountain: ${RATINGS[ratingOf(runSetup(p.mountain).difficulty ?? 0)].name}`
      : 'Your first mountain is waiting.';
    this.pages.setLive(locked);
  }

  private onScreen(s: Screen): void {
    if (s === 'start') {
      this.startScene.start();
      this.startScene.resize();
    } else this.startScene.stop();
    if (s !== 'play') {
      this.townUi.scene.stop();
      this.mountainUi.hide();
      this.leaveSlopes();
    } else this.onView(this.pages.view);
  }

  private onView(v: View): void {
    if (v === 'town') {
      this.townUi.scene.start();
      this.townUi.scene.resize();
    } else this.townUi.scene.stop();
    if (v === 'mountain') this.mountainUi.show();
    else this.mountainUi.hide();
    document.getElementById('play-screen')!.classList.toggle('on-slopes', v === 'loops' && !!this.run);
    if (v === 'loops') {
      document.getElementById('loops-empty')!.classList.toggle('hidden', !!this.run);
      document.getElementById('run-screen')!.classList.toggle('hidden', !this.run);
      if (this.run) {
        this.renderer.resize();
        if (this.awaySpeed !== null) this.setSpeed(this.awaySpeed);
        this.awaySpeed = null;
      }
    } else this.leaveSlopes();
    this.applySound();
  }

  /** Leaving the slopes mid-expedition pauses them until you come back. */
  private leaveSlopes(): void {
    if (!this.run || this.awaySpeed !== null || this.run.state.status !== 'riding') return;
    this.select(null);
    this.awaySpeed = this.speed || this.resumeSpeed || 1;
    this.loop.speed = 0;
    this.speed = 0;
    this.autoPaused = false;
  }

  private settingsChanged(): void {
    saveSettings(this.settings);
    this.applySound();
  }

  /** Music for wherever you are, and the sound switches from settings. */
  private applySound(): void {
    this.sfx.mute = !this.settings.sound;
    if (!this.settings.music) return this.music.setMode('off');
    const onSlopes = this.pages.screen === 'play' && this.pages.view === 'loops' && !!this.run && !this.run.done;
    const boss = onSlopes && this.run!.state.enemies.some((e) => e.kind === 'baron' || e.kind === 'widow' || e.kind === 'yetiKing' || e.kind === 'kickback');
    this.music.setMode(boss ? 'boss' : onSlopes ? 'run' : 'lodge');
  }

  private startRun(): void {
    if (this.run) return;
    this.sfx.unlock();
    const setup = runSetup(this.profile.mountain);
    this.run = Run.create({ ...setup, deck: deckFor(this.profile), bonuses: bonusesFor(this.profile) });
    this.banked = false;
    this.earnedTiles = [];
    this.selection = null;
    this.awaySpeed = null;
    this.runUi.reset();
    this.prevHero = this.run.heroPos();
    this.prevChasers.clear();
    this.renderer.setRun(this.run);
    this.refreshHome();
    this.pages.go('play', 'loops');
    this.setSpeed(1);
    try {
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${setup.seed}`);
    } catch {
      // Embeds may forbid this; the seed is on the mountain tab anyway.
    }
    this.runUi.banner(`${RATINGS[ratingOf(this.run.state.difficulty)].name} · seed ${setup.seed}`);
    (document.getElementById('hero-portrait') as HTMLImageElement).src = portraitUrl('hero', 2);
  }

  private toTown(): void {
    this.overlays.hideResult();
    this.overlays.hideTally();
    this.run = null;
    this.awaySpeed = null;
    this.refreshHome();
    this.pages.go('play', 'town');
    if (this.earnedTiles.length) {
      const names = this.earnedTiles.map((t) => COURSE_TILES[t].name);
      this.pages.toast(`Earned for your mountain: ${names.join(', ')}.`);
    }
  }

  private reseed(seed: string): void {
    if (this.run) return;
    clearPlan(this.profile.mountain, this.profile.tiles, seed);
    saveProfile(this.profile);
    this.refreshHome();
  }

  private build(id: BuildingId): void {
    if (!this.run && build(this.profile, id)) {
      saveProfile(this.profile);
      this.sfx.unlock();
      this.sfx.chaChing();
      this.refreshHome();
      this.townUi.scene.celebrate(id);
    }
  }

  private toggleCard(id: CardId): void {
    if (!this.run && toggleCard(this.profile, id)) {
      saveProfile(this.profile);
      this.sfx.unlock();
      this.sfx.place();
      this.refreshHome();
    }
  }

  private buyTile(t: CourseTile): void {
    if (!this.run && buyTile(this.profile, t)) {
      saveProfile(this.profile);
      this.sfx.unlock();
      this.sfx.chaChing();
      this.refreshHome();
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
          this.sfx.enemyShot(e.kind === 'sniper' ? 20 : e.kind === 'hound' ? 90 : e.kind === 'sapper' ? 35 : 60);
          break;
        case 'mine':
          fx.burst(e.x * T, e.y * T, e.hit ? 26 : 8);
          if (e.hit) {
            this.runUi.burst('BOOM!', e.x, e.y - 0.4);
            this.renderer.shake = Math.max(this.renderer.shake, 0.9);
            this.sfx.yardSale();
          } else this.runUi.pop('Mine jumped!', e.x, e.y - 1.1, 'red big');
          break;
        case 'planted':
          fx.ring(e.x * T + 8, e.y * T + 8);
          this.runUi.pop('mine!', e.x + 0.5, e.y + 0.2, 'red');
          break;
        case 'enemyHeal':
          this.runUi.pop(`+${e.amount}`, e.x, e.y - 0.9, 'heal');
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
              : r.kind === 'chute'
                ? 'Chute open! A steep shortcut straight down. Click the junction to ski past.'
                : 'Path open! Click the junction to switch it.',
          );
          this.sfx.chaChing();
          break;
        }
        case 'switch': {
          const r = run.state.routes[e.route];
          this.runUi.pop(e.take ? ({ lift: 'Lift: ride', chute: 'Chute: drop in', trail: 'Path: take it' } as const)[r.kind] : 'Ski on', r.x + 0.5, r.y - 0.2, e.take ? 'red' : '');
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
          break;
        case 'wave':
          if (e.count > 0 && e.chained) this.runUi.pop(`+${e.count} enemies: descent ${e.descent}`, run.heroPos().x, run.heroPos().y - 1.8, 'red');
          else if (e.count > 0) this.runUi.banner(`Lap ${e.lap}: ${e.count} enem${e.count === 1 ? 'y' : 'ies'} out on the mountain`);
          break;
        case 'weather':
          if (e.kind === 'whiteout') this.runUi.banner('Whiteout! Nobody can see far, this lap and next. Kills and grazes pay double.');
          else if (e.kind === 'night') this.runUi.banner('Night falls. Enemies miss more and loot drops more, this lap and next.');
          else if (e.kind === 'bluebird') this.runUi.banner('Bluebird day! You aim and ski better, but they can see you coming.');
          else if (e.kind === 'blizzard') this.runUi.banner('Blizzard! Everyone slows down, and chips pay half as much again.');
          else this.runUi.banner('The weather clears.');
          this.sfx.chime();
          break;
        case 'bossArrives':
          if (e.kind === 'baron' || e.kind === 'widow' || e.kind === 'yetiKing' || e.kind === 'kickback') this.bossArrives(e.kind);
          break;
        case 'bossDown':
          this.runUi.banner(`${ENEMIES[e.kind].name} is down! +$1,000 and the ${e.reward}.`);
          this.sfx.fanfare();
          this.renderer.shake = 1;
          if (!run.state.enemies.some((x) => x.kind === 'baron' || x.kind === 'widow' || x.kind === 'yetiKing' || x.kind === 'kickback')) this.applySound();
          break;
        case 'fragment':
          this.runUi.pop(`+ intel fragment ${e.count}/3`, e.x, e.y - 1.6, 'red');
          this.sfx.chime();
          break;
        case 'dossier':
          this.runUi.banner(`Dossier assembled: ${ENEMIES[e.boss].name}. Place it on the trail to summon them.`);
          this.sfx.chaChing();
          break;
        case 'bought': {
          const me = run.heroPos();
          this.runUi.pop(`Bought ${e.name}`, me.x, me.y - 1.4, 'loot');
          this.sfx.chaChing();
          break;
        }
        case 'saved':
          this.runUi.banner('Airbag! You survive on 1 HP. That was your one.');
          this.sfx.alarm();
          this.renderer.shake = 1;
          break;
        case 'reroll':
          this.sfx.chipTick(3);
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
              kills: e.kills,
              bounty: e.bounty,
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

  /** A boss's dossier stops the clock until you've read it. */
  private bossArrives(kind: 'baron' | BossKind): void {
    this.select(null);
    const resume = this.speed > 0 ? this.speed : this.autoPaused ? this.resumeSpeed : 0;
    this.loop.speed = 0;
    this.speed = 0;
    this.autoPaused = false;
    this.sfx.alarm();
    this.renderer.shake = 0.8;
    if (this.settings.music) this.music.setMode('boss');
    this.overlays.showBoss(kind, () => this.setSpeed(resume || 1));
  }

  private endRun(won: boolean): void {
    const run = this.run!;
    const st = run.state;
    this.select(null);
    this.overlays.hideTally();
    this.overlays.hideBoss();
    if (!this.banked && st.payout) {
      this.banked = true;
      const laps = st.status === 'retreated' || st.status === 'won' ? st.lap : st.lap - 1;
      this.earnedTiles = bankRun(this.profile, st.status, st.payout, st.record.bosses, laps, st.record.found);
      this.profile.lastRun = { weather: st.weather?.kind ?? 'clear', status: st.status };
      saveProfile(this.profile);
    }
    this.music.setMode(this.settings.music ? 'lodge' : 'off');
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
      ['Routes', String(st.routes.length)],
      ['Enemies down', String(st.record.kills)],
      ['Best lap bounty', formatCash(st.record.bestLap)],
      ['Cards bought', String(st.record.bought)],
      ['Cards placed', String(st.record.placed)],
    ];
    const tiles = this.earnedTiles.length ? `Course tiles earned: ${this.earnedTiles.map((t) => COURSE_TILES[t].name).join(', ')}.` : null;
    setTimeout(() => this.overlays.showResult(st.status, st.payout!, st.difficulty, record, tiles), won || st.status === 'wiped' ? 900 : 200);
  }

  // --- Input --------------------------------------------------------------------------------

  private bindInput(): void {
    window.addEventListener('resize', () => this.renderer.resize());
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.code === 'Escape' && this.pages.closeSettings()) return;
      if (e.code === 'KeyM') {
        this.settings.sound = !this.settings.sound;
        this.pages.syncSettings();
        this.settingsChanged();
        return;
      }
      if (this.pages.screen === 'play' && this.pages.view === 'mountain' && e.code === 'Escape') {
        this.mountainUi.cancel();
        return;
      }
      const run = this.run;
      if (!run || this.pages.screen !== 'play' || this.pages.view !== 'loops') return;
      if (this.overlays.bossOpen) {
        if (e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape') {
          e.preventDefault();
          this.overlays.hideBoss();
        }
        return;
      }
      if (e.code === 'Enter' && this.overlays.tallyOpen) {
        e.preventDefault();
        this.rideAgain();
        return;
      }
      if (this.overlays.resultOpen && e.code === 'Enter') {
        this.toTown();
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
