// The Mountain tab: your home mountain drawn as the run map, with a palette of course tiles to
// lay on it. Trail tiles lay a path one cell at a time (click or drag) from a fork on the trail
// over open snow until you join the trail again; lifts and chutes go on a trail tile with a clear
// line up or down; special tiles go on the trail. Clicking a junction sets which way it starts.
// Difficulty is read off the mountain as you build.

import { MAX_LIFTS } from '../game/cards';
import { MAP_H, MAP_W, TILE } from '../game/constants';
import { difficultyMods, MAX_DIFFICULTY, RATINGS } from '../game/enemies';
import type { Profile } from '../game/lodge';
import { cell, isPiste, nodeAt, routeCourse, type MountainMap } from '../game/map';
import {
  buildStraight,
  canExtend,
  canFeature,
  canFork,
  COURSE_TILE_IDS,
  COURSE_TILES,
  difficultyOf,
  layTrail,
  placeFeature,
  removeAt,
  runSetup,
  toggleStart,
  type CourseTile,
} from '../game/mountain';
import { Run } from '../game/run';
import { courseIconUrl, type BuilderTool } from '../render/art/courseArt';
import { MapRenderer } from '../render/mapRenderer';
import { INK, MID, RED } from '../render/palette';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

export interface MountainHooks {
  /** The plan or the stock changed: save it. */
  changed: () => void;
  start: () => void;
  newSeed: () => string;
  /** A new seed was asked for (the hook confirms and clears). */
  reseed: (seed: string) => void;
}

const HINT: Record<BuilderTool, string> = {
  trail: 'Click a trail tile to fork a path off it, then click (or drag) over open snow and back onto the trail to join it.',
  lift: 'Click a trail tile with a clear line straight up to more trail.',
  chute: 'Click a trail tile with a clear line straight down to more trail.',
  jump: 'Click a trail tile to put a jump on it.',
  gates: 'Click a trail tile to set slalom gates on it.',
  tunnel: 'Click a trail tile to dig a snow tunnel.',
  checkpoint: 'Click a trail tile to set up a checkpoint.',
  blackRun: 'Click a trail tile to post a black run sign.',
  remove: 'Click anything you built to take it up. Its tiles go back in stock.',
};

export class MountainUi {
  private readonly renderer: MapRenderer;
  private readonly canvas = $<HTMLCanvasElement>('builder-map');
  private tool: BuilderTool = 'trail';
  /** A trail path being laid: where it forks, and the open cells so far. */
  private draft: { x: number; y: number; cells: number[] } | null = null;
  private hover: { x: number; y: number } | null = null;
  private dragging = false;
  private preview: Run | null = null;
  private profile: Profile | null = null;
  private locked = false;
  private raf = 0;
  private time = 0;
  private flash = '';
  private flashUntil = 0;

  constructor(private readonly hooks: MountainHooks) {
    this.renderer = new MapRenderer(this.canvas);
    $('tools').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-tool]');
      if (!b || b.disabled) return;
      this.tool = b.dataset.tool as BuilderTool;
      this.draft = null;
      this.renderTools();
    });
    // A new mountain clears what you've built, so it takes a second click to confirm.
    $('seed-random').addEventListener('click', () => {
      const seed = this.pendingSeed ?? hooks.newSeed();
      if (this.built() && performance.now() > this.armedUntil) return this.arm(seed);
      this.disarm();
      hooks.reseed(seed);
    });
    $('seed-input').addEventListener('change', () => {
      const seed = $<HTMLInputElement>('seed-input').value.trim().toUpperCase();
      if (!seed || !this.profile || seed === this.profile.mountain.seed) {
        if (this.profile) $<HTMLInputElement>('seed-input').value = this.profile.mountain.seed;
        return;
      }
      if (this.built()) this.arm(seed);
      else hooks.reseed(seed);
    });
    $('start').addEventListener('click', () => hooks.start());

    const tileAt = (e: MouseEvent) => {
      const r = this.canvas.getBoundingClientRect();
      return this.renderer.tileAtCss(e.clientX - r.left, e.clientY - r.top);
    };
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      const t = tileAt(e);
      if (t) this.click(t.x, t.y);
      this.dragging = this.tool === 'trail' && !!this.draft;
    });
    window.addEventListener('mouseup', () => (this.dragging = false));
    this.canvas.addEventListener('mousemove', (e) => {
      const t = tileAt(e);
      const moved = t && (!this.hover || t.x !== this.hover.x || t.y !== this.hover.y);
      this.hover = t;
      // Dragging lays a path cell by cell (never undoes).
      if (moved && this.dragging && this.draft && t) {
        const c = cell(t.x, t.y);
        const map = this.map();
        if (map && (canExtend(map, this.draft.x, this.draft.y, this.draft.cells, c) || this.joinable(map, c))) this.click(t.x, t.y);
      }
    });
    this.canvas.addEventListener('mouseleave', () => (this.hover = null));
    this.canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.cancel();
    });
    window.addEventListener('resize', () => this.renderer.resize());
  }

  private pendingSeed: string | null = null;
  private armedUntil = 0;
  private armTimer = 0;

  private built(): number {
    return this.profile ? this.profile.mountain.routes.length + this.profile.mountain.features.length : 0;
  }

  /** Asks for a second click before clearing the mountain for `seed`. */
  private arm(seed: string): void {
    this.pendingSeed = seed;
    this.armedUntil = performance.now() + 5000;
    const btn = $<HTMLButtonElement>('seed-random');
    btn.textContent = 'Click again to clear';
    btn.classList.add('go');
    this.say(`A new mountain (${seed}) clears everything built on this one; every tile goes back in stock. Click again to go ahead.`);
    clearTimeout(this.armTimer);
    this.armTimer = window.setTimeout(() => this.disarm(), 5000);
  }

  private disarm(): void {
    clearTimeout(this.armTimer);
    this.pendingSeed = null;
    this.armedUntil = 0;
    const btn = $<HTMLButtonElement>('seed-random');
    btn.textContent = 'New mountain';
    btn.classList.remove('go');
    if (this.profile) $<HTMLInputElement>('seed-input').value = this.profile.mountain.seed;
  }

  /** Drops a half-laid path. Returns whether there was one. */
  cancel(): boolean {
    const had = !!this.draft;
    this.draft = null;
    return had;
  }

  private map(): MountainMap | null {
    return this.preview?.map ?? null;
  }

  render(p: Profile, locked: boolean): void {
    this.profile = p;
    this.locked = locked;
    this.preview = Run.create({ ...runSetup(p.mountain), deck: ['pines'] });
    this.preview.state.enemies = [];
    const input = $<HTMLInputElement>('seed-input');
    if (document.activeElement !== input) input.value = p.mountain.seed;
    $<HTMLButtonElement>('seed-random').disabled = locked;
    input.disabled = locked;
    $<HTMLButtonElement>('start').disabled = locked;
    this.renderTools();
    this.renderDifficulty();
  }

  show(): void {
    if (this.raf) return;
    this.renderer.resize();
    let last = performance.now();
    const tick = (now: number) => {
      this.time += Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  hide(): void {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.draft = null;
  }

  // --- Building -------------------------------------------------------------------------------

  private say(text: string): void {
    this.flash = text;
    this.flashUntil = performance.now() + (text.length > 80 ? 5000 : 2200);
  }

  /** Whether cell c would finish the path being laid: trail right next to its last cell. */
  private joinable(map: MountainMap, c: number): boolean {
    const d = this.draft;
    if (!d || !d.cells.length) return false;
    const j = map.index[c];
    const last = d.cells[d.cells.length - 1];
    const near = Math.abs((c % MAP_W) - (last % MAP_W)) + Math.abs(Math.floor(c / MAP_W) - Math.floor(last / MAP_W)) === 1;
    return near && j >= 0 && isPiste(map, j) && c !== cell(d.x, d.y);
  }

  private click(x: number, y: number): void {
    const p = this.profile;
    const map = this.map();
    if (!p || !map || this.locked) return;
    const plan = p.mountain;
    const stock = p.tiles;
    const c = cell(x, y);
    const node = nodeAt(map, x, y);
    let changed = false;

    // A junction's switch: which way it starts each expedition.
    if (this.tool !== 'remove' && !this.draft && node >= 0 && map.nodes[node].junction >= 0) {
      changed = toggleStart(plan, map.nodes[node].junction);
      this.say(plan.routes[map.nodes[node].junction].take ? 'This junction will start switched onto the route.' : 'This junction will start switched past the route.');
    } else if (this.tool === 'remove') {
      changed = removeAt(plan, stock, x, y);
      if (!changed) this.say('Nothing you built is there.');
    } else if (this.tool === 'trail') {
      const d = this.draft;
      if (!d) {
        if (canFork(map, x, y) && !plan.features.some((f) => f.x === x && f.y === y)) {
          if (stock.trail < 1) this.say('No trail tiles left: earn more on expeditions, or buy them in town.');
          else this.draft = { x, y, cells: [] };
        } else this.say('Paths fork off a plain trail tile (not a junction, and nothing built on it).');
      } else if (d.cells.length && c === d.cells[d.cells.length - 1]) {
        d.cells.pop();
      } else if (canExtend(map, d.x, d.y, d.cells, c)) {
        if (d.cells.length >= stock.trail) this.say(`Out of trail tiles (${stock.trail}). Join the trail, or buy more in town.`);
        else d.cells.push(c);
      } else if (this.joinable(map, c)) {
        if (layTrail(plan, stock, d.x, d.y, [...d.cells, c])) {
          this.draft = null;
          changed = true;
          const seg = Run.create({ ...runSetup(plan), deck: ['pines'] }).map.segments.at(-1);
          this.say(seg?.back ? 'A loop-back! Switch its junction on to ski it again for another descent.' : 'Path built.');
        } else this.say("Can't join there.");
      } else if (!d.cells.length && canFork(map, x, y)) {
        this.draft = { x, y, cells: [] };
      } else this.say('Lay the path over open snow next to its last tile, then join the trail.');
    } else if (this.tool === 'lift' || this.tool === 'chute') {
      changed = buildStraight(plan, stock, this.tool, x, y);
      if (!changed) {
        if (stock[this.tool] < 1) this.say(`No ${COURSE_TILES[this.tool].name.toLowerCase()} tiles: buy them in town.`);
        else if (this.tool === 'lift' && map.lifts.filter((l) => l.route >= 0).length >= MAX_LIFTS) this.say(`Two lifts per mountain at most.`);
        else this.say(this.tool === 'lift' ? 'A lift needs a clear line straight up from trail to trail.' : 'A chute needs a clear line straight down from trail to trail.');
      }
    } else {
      changed = placeFeature(plan, stock, this.tool, x, y);
      if (!changed) this.say(stock[this.tool] < 1 ? `No ${COURSE_TILES[this.tool].name} tiles left.` : 'Special tiles go on plain trail tiles.');
    }
    if (changed) {
      this.hooks.changed();
      this.render(p, this.locked);
    }
  }

  // --- Drawing --------------------------------------------------------------------------------

  /** Cells the current tool could act on. */
  private targets(map: MountainMap): Set<number> {
    const p = this.profile!;
    const out = new Set<number>();
    const stock = p.tiles;
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        const c = cell(x, y);
        let ok = false;
        switch (this.tool) {
          case 'trail':
            if (!this.draft) ok = stock.trail > 0 && canFork(map, x, y) && !p.mountain.features.some((f) => f.x === x && f.y === y);
            else ok = (this.draft.cells.length < stock.trail && canExtend(map, this.draft.x, this.draft.y, this.draft.cells, c)) || this.joinable(map, c);
            break;
          case 'lift':
          case 'chute':
            ok = stock[this.tool] > 0 && !!routeCourse(map, this.tool, x, y) && !p.mountain.features.some((f) => f.x === x && f.y === y);
            if (this.tool === 'lift' && map.lifts.filter((l) => l.route >= 0).length >= MAX_LIFTS) ok = false;
            break;
          case 'remove': {
            const i = map.index[c];
            ok = p.mountain.features.some((f) => f.x === x && f.y === y) || (i >= map.loopLength) || (i >= 0 && map.nodes[i].junction >= 0);
            break;
          }
          default:
            ok = stock[this.tool] > 0 && canFeature(p.mountain, map, x, y);
        }
        if (ok) out.add(c);
      }
    return out;
  }

  private draw(): void {
    const run = this.preview;
    const p = this.profile;
    if (!run || !p) return;
    const map = run.map;
    const targets = this.locked ? new Set<number>() : this.targets(map);
    const d = this.draft;
    const hover = this.hover;
    const blink = Math.floor(this.time * 3) % 2 === 0;
    this.renderer.render(run, {
      hero: run.heroPos(),
      chasers: new Map(),
      time: this.time,
      dt: 1 / 60,
      selection: null,
      paused: false,
      still: true,
      overlay: (b) => {
        // Where the tool can go: dotted frames.
        b.fillStyle = 'rgba(20,20,20,0.5)';
        for (const c of targets) {
          const x = (c % MAP_W) * TILE;
          const y = Math.floor(c / MAP_W) * TILE;
          for (let k = 1; k < 15; k += 2) {
            b.fillRect(x + k, y + 1, 1, 1);
            b.fillRect(x + k, y + 14, 1, 1);
            b.fillRect(x + 1, y + k, 1, 1);
            b.fillRect(x + 14, y + k, 1, 1);
          }
        }
        // The path being laid: groomed cells joined to the fork, in red.
        if (d) {
          const pts = [cell(d.x, d.y), ...d.cells].map((c) => [(c % MAP_W) * TILE + 8, Math.floor(c / MAP_W) * TILE + 8] as const);
          for (const c of d.cells) {
            const x = (c % MAP_W) * TILE;
            const y = Math.floor(c / MAP_W) * TILE;
            b.fillStyle = 'rgba(255,255,255,0.85)';
            b.fillRect(x + 3, y + 3, 10, 10);
          }
          b.fillStyle = RED;
          for (let k = 0; k + 1 < pts.length; k++) {
            const [ax, ay] = pts[k];
            const [bx, by] = pts[k + 1];
            const n = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
            for (let s = 0; s <= n; s += 2) b.fillRect(Math.round(ax + ((bx - ax) * s) / n) - 1, Math.round(ay + ((by - ay) * s) / n) - 1, 2, 2);
          }
          const [fx, fy] = pts[0];
          b.fillStyle = INK;
          b.fillRect(fx - 3, fy - 3, 6, 6);
          b.fillStyle = blink ? RED : '#ffffff';
          b.fillRect(fx - 2, fy - 2, 4, 4);
        }
        // A straight route's course, if the mouse is on a spot for one.
        if (hover && (this.tool === 'lift' || this.tool === 'chute') && targets.has(cell(hover.x, hover.y))) {
          const course = routeCourse(map, this.tool, hover.x, hover.y);
          b.fillStyle = RED;
          for (const c of course?.cells ?? []) b.fillRect((c % MAP_W) * TILE + 7, Math.floor(c / MAP_W) * TILE + 2, 2, 12);
        }
        if (hover) {
          const ok = targets.has(cell(hover.x, hover.y));
          b.fillStyle = ok ? RED : MID;
          b.fillRect(hover.x * TILE, hover.y * TILE, TILE, 1);
          b.fillRect(hover.x * TILE, hover.y * TILE + 15, TILE, 1);
          b.fillRect(hover.x * TILE, hover.y * TILE, 1, TILE);
          b.fillRect(hover.x * TILE + 15, hover.y * TILE, 1, TILE);
        }
      },
    });
    const hint = $('builder-hint');
    let text = this.locked ? 'Out on an expedition: look, but no building.' : HINT[this.tool];
    if (d && !this.locked) text = d.cells.length ? `Path: ${d.cells.length} tile${d.cells.length > 1 ? 's' : ''} of ${p.tiles.trail}. Click trail next to it to join, or its last tile to undo. Right-click cancels.` : 'Now click open snow next to the fork.';
    if (performance.now() < this.flashUntil) text = this.flash;
    if (hint.textContent !== text) hint.textContent = text;
  }

  private renderTools(): void {
    const p = this.profile;
    if (!p) return;
    const tools: BuilderTool[] = [...COURSE_TILE_IDS, 'remove'];
    $('tools').replaceChildren(
      ...tools.map((t) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.tool = t;
        b.className = `tool${t === this.tool ? ' on' : ''}`;
        b.setAttribute('aria-pressed', String(t === this.tool));
        const have = t === 'remove' ? null : p.tiles[t as CourseTile];
        b.disabled = this.locked;
        b.title = t === 'remove' ? HINT.remove : `${COURSE_TILES[t as CourseTile].name}: ${COURSE_TILES[t as CourseTile].text}`;
        const name = t === 'remove' ? 'Take up' : COURSE_TILES[t as CourseTile].name;
        b.innerHTML = `<img alt="" src="${courseIconUrl(t, 1)}"><b>${name}</b><span>${have === null ? 'refunds tiles' : `${have} in stock`}</span>`;
        return b;
      }),
    );
  }

  private renderDifficulty(): void {
    const p = this.profile!;
    const d = difficultyOf(p.mountain);
    const mods = difficultyMods(d.value);
    const r = RATINGS[d.rating];
    const parts = d.parts.length
      ? `<ul>${d.parts.map(([k, v]) => `<li>${k} +${v.toFixed(2)}</li>`).join('')}</ul>`
      : '<p class="muted">Nothing on it yet. Black run signs, checkpoints, chutes, lifts and extra trail all make it harder, and richer.</p>';
    $('difficulty').innerHTML = `
      <div class="rating-badge"><span class="sym">${r.symbol}</span><div><b>${r.name}</b><br><span>${d.value.toFixed(2)} of ${MAX_DIFFICULTY}</span></div></div>
      <div class="meter"><i style="width:${((d.value / MAX_DIFFICULTY) * 100).toFixed(0)}%"></i></div>
      <dl>
        <dt>Enemy strength</dt><dd>×${mods.enemy.toFixed(2)}</dd>
        <dt>Bounties</dt><dd>×${mods.payout.toFixed(2)}</dd>
        <dt>Baron comes after</dt><dd>${mods.boss} cards</dd>
        <dt>Routes · special tiles</dt><dd>${p.mountain.routes.length} · ${p.mountain.features.length}</dd>
      </dl>
      ${parts}`;
  }
}
