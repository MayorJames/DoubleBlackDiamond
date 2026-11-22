// Draws the mountain as an old piste map in pixel art: contour lines on white snow, the groomed
// trail, chutes, every chairlift, every card you have placed, the rope that closes off whichever
// way a junction isn't sending you, and the skier and enemies on top. Everything is drawn at art
// resolution (16px tiles) and scaled up by a whole number so pixels stay crisp.

import { CARDS, type CardId, type TileState } from '../game/cards';
import { MAP_H, MAP_W, TILE } from '../game/constants';
import { isBoss, type Enemy } from '../game/enemies';
import { dirOf, rideNode, type Dir, type MountainMap, type Segment } from '../game/map';
import type { Run } from '../game/run';
import { hashSeed } from '../game/rng';
import { bayer } from './art/pixel';
import { Fx, line } from './fx';
import {
  BACKDROP,
  CONTOUR,
  CONTOUR_MAJOR,
  DARK,
  INK,
  LIFT_CLEAR,
  LIGHT,
  MID,
  PAPER,
  RED,
  SHADE,
  SNOW,
  SNOW_FLECK,
  TRAIL,
  TRAIL_EDGE,
  TRAIL_LINE,
} from './palette';
import { Atlas, type SpriteName } from './sprites';

export const ART_W = MAP_W * TILE;
export const ART_H = MAP_H * TILE;

const TILE_SPRITES: Record<
  Exclude<CardId, 'avalanche' | 'chairlift' | 'chute' | 'whiteout' | 'night' | 'dossierWidow' | 'dossierYetiKing' | 'dossierKickback'>,
  SpriteName
> = {
  patrol: 'patrol',
  moguls: 'moguls',
  kicker: 'kicker',
  ice: 'ice',
  cabin: 'cabin',
  sniper: 'sniperNest',
  garage: 'garage',
  cache: 'cache',
  safehouse: 'safehouse',
  pines: 'pines',
  boulder: 'boulder',
  peak: 'peak',
  powder: 'powder',
  yetiCave: 'yetiCave',
  demoShack: 'demoShack',
  fieldHospital: 'fieldHospital',
  kennel: 'kennel',
  mine: 'mine',
  gates: 'gates',
  tunnel: 'tunnel',
  checkpoint: 'checkpoint',
  blackRun: 'blackRun',
};

const SPECIAL_SPRITES: Partial<Record<CardId, SpriteName>> = {
  avalanche: 'peak',
  chairlift: 'chairlift',
  chute: 'chute',
  whiteout: 'powder',
  night: 'safehouse',
  dossierWidow: 'widow',
  dossierYetiKing: 'yetiKing',
  dossierKickback: 'kickback',
};

export const spriteForCard = (card: CardId): SpriteName => SPECIAL_SPRITES[card] ?? TILE_SPRITES[card as keyof typeof TILE_SPRITES];

const ROTATION: Record<Dir, number> = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export interface Selection {
  card: CardId;
  hover: { x: number; y: number } | null;
}

export interface FrameView {
  /** Skier's position in tiles, interpolated between ticks. */
  hero: { x: number; y: number };
  /** Interpolated chaser positions by enemy id. */
  chasers: Map<number, { x: number; y: number }>;
  time: number;
  dt: number;
  selection: Selection | null;
  paused: boolean;
  /** Drawn over the mountain, under the skier (the builder's guides). In art pixels. */
  overlay?: (b: CanvasRenderingContext2D) => void;
  /** Leave out enemies, the skier and effects: just the mountain. */
  still?: boolean;
}

export class MapRenderer {
  readonly atlas = new Atlas();
  readonly fx = new Fx(ART_W, ART_H);
  private readonly ctx: CanvasRenderingContext2D;
  private readonly buffer: HTMLCanvasElement;
  private readonly bctx: CanvasRenderingContext2D;
  private background: HTMLCanvasElement | null = null;
  private pathLayer: HTMLCanvasElement | null = null;
  private tileLayer: HTMLCanvasElement | null = null;
  private tilesKey = '';
  private map: MountainMap | null = null;
  /** Device pixels per art pixel, and where the map sits on the canvas. */
  scale = 1;
  ox = 0;
  oy = 0;
  dpr = 1;
  shake = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    [this.buffer, this.bctx] = canvas2(ART_W, ART_H);
  }

  resize(): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * this.dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * this.dpr));
    this.canvas.width = w;
    this.canvas.height = h;
    const fit = Math.min((w - 16 * this.dpr) / ART_W, (h - 16 * this.dpr) / ART_H);
    this.scale = fit >= 1 ? Math.floor(fit) : fit;
    this.ox = Math.round((w - ART_W * this.scale) / 2);
    this.oy = Math.round((h - ART_H * this.scale) / 2);
  }

  /** A new expedition: fresh layers and no leftover effects. */
  setRun(run: Run): void {
    this.setMap(run.map);
    this.fx.clear();
  }

  /** The mountain changed shape (a route went down): redraw the static layers. */
  private setMap(map: MountainMap): void {
    if (this.map?.seed !== map.seed || !this.background) this.background = buildBackground(map);
    this.map = map;
    this.pathLayer = this.buildPath(map);
    this.tilesKey = '';
  }

  /** Map tile under a point in CSS pixels, or null. */
  tileAtCss(cssX: number, cssY: number): { x: number; y: number } | null {
    const x = Math.floor((cssX * this.dpr - this.ox) / (this.scale * TILE));
    const y = Math.floor((cssY * this.dpr - this.oy) / (this.scale * TILE));
    return x >= 0 && y >= 0 && x < MAP_W && y < MAP_H ? { x, y } : null;
  }

  /** CSS pixel position of a point given in tiles. */
  cssOf(tx: number, ty: number): { x: number; y: number } {
    return { x: (this.ox + tx * TILE * this.scale) / this.dpr, y: (this.oy + ty * TILE * this.scale) / this.dpr };
  }

  get tileCss(): number {
    return (TILE * this.scale) / this.dpr;
  }

  render(run: Run, view: FrameView): void {
    const b = this.bctx;
    const map = run.map;
    if (!this.background || this.map !== map) this.setMap(map);
    this.fx.update(view.dt);

    b.drawImage(this.background!, 0, 0);
    b.drawImage(this.pathLayer!, 0, 0);
    const key = run.state.tiles.map((t) => (t ? `${t.card}${t.variant ?? ''}` : '')).join(',');
    if (key !== this.tilesKey) {
      this.tileLayer = this.buildTiles(run);
      this.tilesKey = key;
    }
    b.drawImage(this.tileLayer!, 0, 0);
    this.drawJunctions(run);
    if (view.selection) this.drawSelection(run, view.selection);
    this.drawChairs(run, view);
    view.overlay?.(b);

    // Entities, back to front.
    const actors: { y: number; draw: () => void }[] = [];
    if (!view.still) {
      for (const e of run.state.enemies) {
        const pos = e.ride ? (view.chasers.get(e.id) ?? e) : e;
        actors.push({ y: pos.y, draw: () => this.drawEnemy(run, e, pos.x, pos.y, view.time) });
      }
      const hp = view.hero;
      actors.push({ y: hp.y + 0.01, draw: () => this.drawHero(run, view, hp.x, hp.y) });
    }
    actors.sort((a, c) => a.y - c.y);
    for (const a of actors) a.draw();

    if (!view.still) this.fx.draw(b);
    const weather = run.state.weather?.kind;
    if (weather === 'night') this.drawNight(run, view);
    this.fx.drawSnow(b);
    if (weather === 'whiteout') this.drawWhiteout(view.time);

    // To the screen, scaled up and framed in ink.
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = BACKDROP;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.shake = Math.max(0, this.shake - view.dt * 3);
    const sx = this.shake ? Math.round((Math.random() - 0.5) * this.shake * 10 * this.dpr) : 0;
    const sy = this.shake ? Math.round((Math.random() - 0.5) * this.shake * 10 * this.dpr) : 0;
    const w = ART_W * this.scale;
    const h = ART_H * this.scale;
    const border = Math.max(2, Math.round(3 * this.dpr));
    ctx.fillStyle = INK;
    ctx.fillRect(this.ox - border + sx + border * 2, this.oy - border + sy + border * 2, w + border * 2, h + border * 2);
    ctx.fillRect(this.ox - border + sx, this.oy - border + sy, w + border * 2, h + border * 2);
    ctx.drawImage(this.buffer, this.ox + sx, this.oy + sy, w, h);
    if (view.paused) {
      ctx.fillStyle = 'rgba(20,20,20,0.18)';
      ctx.fillRect(this.ox + sx, this.oy + sy, w, h);
    }
  }

  // --- Weather ------------------------------------------------------------------------------

  private whiteoutLayer: HTMLCanvasElement | null = null;
  private nightLayer: HTMLCanvasElement | null = null;
  private nightCut: HTMLCanvasElement | null = null;

  /** Blowing snow: banks of dithered white drifting across, twice the map wide so it can scroll. */
  private drawWhiteout(time: number): void {
    if (!this.whiteoutLayer) {
      const [c, ctx] = canvas(ART_W * 2, ART_H);
      const img = ctx.createImageData(ART_W * 2, ART_H);
      for (let y = 0; y < ART_H; y++)
        for (let x = 0; x < ART_W * 2; x++) {
          const band = 7 + 4 * Math.sin((x / (ART_W * 2)) * Math.PI * 6 + y * 0.09) + 2 * Math.sin(x * 0.05 - y * 0.13);
          if (bayer(x, y, band)) img.data.set([255, 255, 255, 255], (y * ART_W * 2 + x) * 4);
        }
      ctx.putImageData(img, 0, 0);
      this.whiteoutLayer = c;
    }
    const off = Math.floor((time * 14) % ART_W);
    this.bctx.drawImage(this.whiteoutLayer, -off, 0);
    this.bctx.drawImage(this.whiteoutLayer, ART_W * 2 - off, 0);
  }

  /** Night: a dithered dark over everything except a pool of light around the skier and the lodge. */
  private drawNight(run: Run, view: FrameView): void {
    if (!this.nightLayer) {
      const [c, ctx] = canvas(ART_W, ART_H);
      // A smooth dark keeps the trail readable; a sparse dither gives it texture.
      const img = ctx.createImageData(ART_W, ART_H);
      for (let y = 0; y < ART_H; y++)
        for (let x = 0; x < ART_W; x++) img.data.set(bayer(x, y, 3) ? [10, 10, 24, 200] : [16, 16, 34, 150], (y * ART_W + x) * 4);
      ctx.putImageData(img, 0, 0);
      this.nightLayer = c;
      this.nightCut = canvas(ART_W, ART_H)[0];
    }
    const cut = this.nightCut!;
    const ctx = cut.getContext('2d')!;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, ART_W, ART_H);
    ctx.drawImage(this.nightLayer, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    const hole = (cx: number, cy: number, r: number) => {
      for (let y = Math.floor(cy - r); y <= cy + r; y++) {
        const half = Math.sqrt(Math.max(0, r * r - (y - cy) ** 2));
        ctx.fillRect(Math.round(cx - half), y, Math.round(half * 2), 1);
      }
    };
    // The pool of light has a dithered rim: a ring cut at half strength, then the bright core.
    const hx = view.hero.x * TILE;
    const hy = view.hero.y * TILE - 4;
    const r = 30 + Math.sin(view.time * 3) * 1.5;
    ctx.globalAlpha = 0.5;
    hole(hx, hy, r + 6);
    ctx.globalAlpha = 1;
    hole(hx, hy, r);
    const lodge = run.map.nodes[0];
    hole(lodge.x * TILE + 8, lodge.y * TILE + 8, 14);
    this.bctx.drawImage(cut, 0, 0);
  }

  // --- Static layers ------------------------------------------------------------------------

  private buildPath(map: MountainMap): HTMLCanvasElement {
    const [c, ctx] = canvas(ART_W, ART_H);
    // A mask of groomed snow: 1 runs down the screen, 2 runs across, 3 is a chute.
    const mask = new Uint8Array(ART_W * ART_H);
    const fill = (x0: number, y0: number, w: number, h: number, v: number) => {
      for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) mask[y * ART_W + x] = v;
    };
    const groomed = (i: number) => map.nodes[i].kind !== 'lift';
    const style = (a: number, b: number) => {
      if (map.nodes[a].kind === 'chute' || map.nodes[b].kind === 'chute') return 3;
      const d = dirOf(map, a, b);
      return d === 'down' || d === 'up' ? 1 : 2;
    };
    map.nodes.forEach((p, i) => {
      if (groomed(i)) fill(p.x * TILE + 3, p.y * TILE + 3, 10, 10, style(i, p.next[0]));
    });
    // Join each tile to the ones it leads to, half a tile from each side.
    const half = (i: number, side: Dir, v: number) => {
      const x0 = map.nodes[i].x * TILE;
      const y0 = map.nodes[i].y * TILE;
      if (side === 'right') fill(x0 + 8, y0 + 3, 8, 10, v);
      if (side === 'left') fill(x0, y0 + 3, 8, 10, v);
      if (side === 'down') fill(x0 + 3, y0 + 8, 10, 8, v);
      if (side === 'up') fill(x0 + 3, y0, 10, 8, v);
    };
    map.nodes.forEach((p, i) => {
      if (!groomed(i)) return;
      for (const j of p.next) {
        if (!groomed(j)) continue;
        const v = style(i, j);
        half(i, dirOf(map, i, j), v);
        half(j, dirOf(map, j, i), v);
      }
    });

    // Lift lines: a cleared strip under every lift.
    ctx.fillStyle = LIFT_CLEAR;
    for (const lift of map.lifts) {
      const { x, top, bottom } = liftSpan(map, lift);
      ctx.fillRect(x + 2, top, 12, bottom - top);
    }

    // Trail pixels: edges, a soft shadow, groomer corduroy along the direction of travel, and
    // steep hatching down chutes.
    const img = ctx.getImageData(0, 0, ART_W, ART_H);
    const put = (i: number, hex: string) => {
      img.data[i * 4] = parseInt(hex.slice(1, 3), 16);
      img.data[i * 4 + 1] = parseInt(hex.slice(3, 5), 16);
      img.data[i * 4 + 2] = parseInt(hex.slice(5, 7), 16);
      img.data[i * 4 + 3] = 255;
    };
    for (let y = 0; y < ART_H; y++) {
      for (let x = 0; x < ART_W; x++) {
        const i = y * ART_W + x;
        const v = mask[i];
        if (!v) {
          const lit = (x > 0 && mask[i - 1]) || (y > 0 && mask[i - ART_W]);
          if (lit) put(i, SHADE);
          continue;
        }
        const edge = x === 0 || y === 0 || x === ART_W - 1 || y === ART_H - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - ART_W] || !mask[i + ART_W];
        if (edge) put(i, v === 3 ? INK : TRAIL_EDGE);
        else if (v === 3) put(i, (x + y) % 4 === 0 ? MID : (x + y) % 4 === 2 ? LIGHT : TRAIL);
        else put(i, (v === 1 ? x % 3 === 0 : y % 3 === 0) ? TRAIL_LINE : TRAIL);
      }
    }
    ctx.putImageData(img, 0, 0);

    // A black diamond at the lip of every chute.
    for (const chute of map.chutes) {
      const first = map.nodes[chute.nodes[0]];
      diamond(ctx, first.x * TILE + 8, first.y * TILE + 3);
    }

    // Cables, towers and stations.
    for (const lift of map.lifts) {
      const { x: lx, top, bottom } = liftSpan(map, lift);
      const cableTop = top;
      const cableBottom = lift.route < 0 ? bottom - 4 : bottom;
      ctx.fillStyle = INK;
      ctx.fillRect(lx + 5, cableTop, 1, cableBottom - cableTop);
      ctx.fillRect(lx + 10, cableTop, 1, cableBottom - cableTop);
      lift.nodes.forEach((n, k) => {
        if (k % 2 !== (lift.route < 0 ? 0 : 1) && lift.nodes.length > 1) return;
        const y = map.nodes[n].y;
        ctx.fillStyle = DARK;
        ctx.fillRect(lx + 7, y * TILE + 5, 2, 9);
        ctx.fillStyle = INK;
        ctx.fillRect(lx + 3, y * TILE + 5, 10, 1);
        ctx.fillRect(lx + 6, y * TILE + 14, 4, 1);
      });
      if (lift.route >= 0) {
        // Bull wheels at both ends of a lift you built.
        for (const y of [top - 2, bottom]) {
          ctx.fillStyle = INK;
          ctx.fillRect(lx + 3, y, 10, 2);
          ctx.fillStyle = RED;
          ctx.fillRect(lx + 7, y, 2, 2);
        }
      }
    }
    // The main lift's top station, the summit flag and the lodge.
    const lodge = map.nodes[0];
    const summit = map.nodes[map.summit];
    const lx = lodge.x * TILE;
    ctx.fillStyle = INK;
    ctx.fillRect(lx + 2, summit.y * TILE + 4, 12, 5);
    ctx.fillStyle = PAPER;
    ctx.fillRect(lx + 3, summit.y * TILE + 5, 10, 2);
    ctx.drawImage(this.atlas.get('flag'), lx + 10, summit.y * TILE - 4);
    ctx.drawImage(this.atlas.get('lodge'), lx, lodge.y * TILE + 1);
    return c;
  }

  private buildTiles(run: Run): HTMLCanvasElement {
    const [c, ctx] = canvas(ART_W, ART_H);
    const tiles = run.state.tiles;
    tiles.forEach((t, i) => {
      if (!t || t.variant === 'dbdPart') return;
      const x = (i % MAP_W) * TILE;
      const y = Math.floor(i / MAP_W) * TILE;
      if (t.variant === 'dbd') {
        drawDoubleBlack(ctx, x - TILE, y - TILE);
        return;
      }
      this.drawTile(ctx, run, t, x, y, i);
    });
    return c;
  }

  private drawTile(ctx: CanvasRenderingContext2D, run: Run, t: TileState, x: number, y: number, i: number): void {
    const sprite = this.atlas.get(spriteForCard(t.card));
    const node = run.map.index[i];
    const across = t.card === 'patrol' || t.card === 'checkpoint' || t.card === 'gates' || t.card === 'tunnel';
    if (node >= 0 && (t.card === 'kicker' || t.card === 'ice' || across)) {
      // Trail features face the direction of travel; barriers, gates and tunnels lie across it.
      const dir = dirOf(run.map, node, run.map.nodes[node].next[0]);
      const turn = across ? (dir === 'left' || dir === 'right' ? Math.PI / 2 : 0) : ROTATION[dir] + Math.PI;
      ctx.save();
      ctx.translate(x + 8, y + 8);
      ctx.rotate(turn);
      ctx.drawImage(sprite, -8, -8);
      ctx.restore();
      return;
    }
    ctx.drawImage(sprite, x, y);
  }

  // --- Dynamic ------------------------------------------------------------------------------

  private drawSelection(run: Run, sel: Selection): void {
    const b = this.bctx;
    if (CARDS[sel.card].kind === 'weather') {
      // Weather covers everything: frame the whole mountain.
      b.fillStyle = RED;
      for (let k = 0; k < ART_W; k += 4) {
        b.fillRect(k, 0, 2, 2);
        b.fillRect(k, ART_H - 2, 2, 2);
      }
      for (let k = 0; k < ART_H; k += 4) {
        b.fillRect(0, k, 2, 2);
        b.fillRect(ART_W - 2, k, 2, 2);
      }
      return;
    }
    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!run.canPlace(sel.card, x, y)) continue;
        b.fillStyle = 'rgba(20,20,20,0.55)';
        for (let k = 1; k < 15; k += 2) {
          b.fillRect(x * TILE + k, y * TILE + 1, 1, 1);
          b.fillRect(x * TILE + k, y * TILE + 14, 1, 1);
          b.fillRect(x * TILE + 1, y * TILE + k, 1, 1);
          b.fillRect(x * TILE + 14, y * TILE + k, 1, 1);
        }
      }
    }
    const h = sel.hover;
    if (!h) return;
    const ok = run.canPlace(sel.card, h.x, h.y);
    if (ok && sel.card !== 'avalanche') {
      b.globalAlpha = 0.65;
      b.drawImage(this.atlas.get(spriteForCard(sel.card)), h.x * TILE, h.y * TILE);
      b.globalAlpha = 1;
    }
    b.fillStyle = ok ? RED : MID;
    b.fillRect(h.x * TILE, h.y * TILE, TILE, 1);
    b.fillRect(h.x * TILE, h.y * TILE + 15, TILE, 1);
    b.fillRect(h.x * TILE, h.y * TILE, 1, TILE);
    b.fillRect(h.x * TILE + 15, h.y * TILE, 1, TILE);
  }

  /**
   * At every junction, a rope (red flags on a line) closes off the way it isn't sending you, so
   * the open way reads at a glance. Drawn each frame because switches flip at any time.
   */
  private drawJunctions(run: Run): void {
    const b = this.bctx;
    const map = run.map;
    run.state.routes.forEach((r, k) => {
      const j = map.index[r.y * MAP_W + r.x];
      if (j < 0 || map.nodes[j].junction !== k) return;
      const closed = map.nodes[j].next[r.take ? 0 : 1];
      const side = dirOf(map, j, closed);
      const x0 = r.x * TILE;
      const y0 = r.y * TILE;
      const across = side === 'up' || side === 'down';
      // Two pixels thick, just inside the tile edge, with ink posts at both ends.
      const at = side === 'right' ? x0 + 13 : side === 'left' ? x0 + 1 : side === 'down' ? y0 + 13 : y0 + 1;
      for (let k2 = 1; k2 <= 14; k2++) {
        b.fillStyle = k2 <= 2 || k2 >= 13 ? INK : k2 % 4 < 2 ? RED : PAPER;
        if (across) b.fillRect(x0 + k2, at, 1, 2);
        else b.fillRect(at, y0 + k2, 2, 1);
      }
    });
  }

  private drawChairs(run: Run, view: FrameView): void {
    const b = this.bctx;
    const map = run.map;
    const chair = this.atlas.get('chair');
    const heroNode = map.nodes[rideNode(run.state.hero.ride)];
    const heroY = view.hero.y * TILE;
    for (const lift of map.lifts) {
      const { x: lx, top, bottom } = liftSpan(map, lift);
      const off = (view.time * 14.4) % 16;
      const heroHere = heroNode.kind === 'lift' && heroNode.x * TILE === lx;
      const upFrom = lift.route < 0 ? bottom - 6 : bottom;
      for (let y = upFrom - off; y > top + 2; y -= 16) {
        if (heroHere && Math.abs(y - heroY) < 12) continue;
        b.drawImage(chair, lx + 2, Math.round(y) - 2);
      }
      for (let y = top + off; y < upFrom - 4; y += 16) b.drawImage(chair, lx + 7, Math.round(y) - 2);
    }
  }

  private drawEnemy(run: Run, e: Enemy, x: number, y: number, time: number): void {
    const b = this.bctx;
    const px = x * TILE;
    const py = y * TILE;
    let name: SpriteName = e.kind === 'snowmobile' ? 'snowmobile' : e.kind;
    let flip = false;
    if (e.ride) flip = dirOf(run.map, e.ride.at, e.ride.to) === 'left';
    if (e.kind === 'sniper') name = 'sniper';
    const sprite = this.atlas.get(name, flip);
    const big = isBoss(e.kind) ? 2 : 1;
    const w = sprite.width * big;
    const h = sprite.height * big;
    const bob = !e.ride && e.kind !== 'sniper' ? Math.floor(time * 2 + e.id * 0.37) % 2 : 0;
    const left = Math.round(px - w / 2);
    const topY = Math.round(e.kind === 'sniper' ? py - 11 : py - h + 5) - bob;
    if (e.kind !== 'sniper') {
      b.fillStyle = 'rgba(20,20,20,0.18)';
      b.fillRect(Math.round(px - w / 3), Math.round(py + 4), Math.round((w * 2) / 3), 2);
    }
    b.drawImage(sprite, left, topY, w, h);
    // Muzzle flash just after firing.
    const since = this.fx.fired.get(e.id);
    if (since !== undefined && since < 0.12) {
      b.fillStyle = RED;
      const fx = flip ? left - 1 : left + w;
      b.fillRect(fx - 1, topY + Math.round(h * 0.68), 3, 2);
    }
    if (e.hp < e.maxHp) {
      const bw = big > 1 ? 24 : 12;
      const bx = Math.round(px - bw / 2);
      const by = topY - 3;
      b.fillStyle = INK;
      b.fillRect(bx - 1, by - 1, bw + 2, 4);
      b.fillStyle = PAPER;
      b.fillRect(bx, by, bw, 2);
      b.fillStyle = RED;
      b.fillRect(bx, by, Math.max(1, Math.round((bw * e.hp) / e.maxHp)), 2);
    }
  }

  private drawHero(run: Run, view: FrameView, x: number, y: number): void {
    const b = this.bctx;
    const map = run.map;
    const hero = run.state.hero;
    const p = map.nodes[rideNode(hero.ride)];
    const dir: Dir = run.state.status === 'riding' ? dirOf(map, hero.ride.at, hero.ride.to) : 'down';
    const px = Math.round(x * TILE);
    const py = Math.round(y * TILE);
    const moving = run.state.status === 'riding' && !view.paused;
    if (p.kind === 'lift') {
      b.drawImage(this.atlas.get('heroLift'), px - 8 - 3, py - 12);
      return;
    }
    let name: SpriteName = 'heroDown';
    let flip = false;
    if (dir === 'left' || dir === 'right') {
      name = hero.stance === 'tuck' ? 'heroSideTuck' : 'heroSide';
      flip = dir === 'left';
    } else if (hero.stance === 'tuck') name = 'heroDownTuck';
    else if (hero.stance === 'plow') name = 'heroDownPlow';
    const air = hero.airborne ? 5 : 0;
    const bob = moving && !air ? Math.floor(view.time * 8) % 2 : 0;

    // Shadow, speed lines for a tuck, spray for a plow.
    b.fillStyle = 'rgba(20,20,20,0.2)';
    b.fillRect(px - 4, py + 3, 8, 2);
    if (moving && hero.stance === 'tuck') {
      const back = { down: [0, -1], up: [0, 1], right: [-1, 0], left: [1, 0] }[dir];
      for (let k = 0; k < 3; k++) {
        const len = 3 + ((Math.floor(view.time * 20) + k) % 3);
        const ox = back[0] * (9 + k * 2) + (back[1] ? (k - 1) * 4 : 0);
        const oy = back[1] * (12 + k * 2) + (back[0] ? (k - 1) * 4 - 4 : 0);
        line(b, px + ox, py + oy, px + ox + back[0] * len, py + oy + back[1] * len, LIGHT);
      }
    }
    if (moving && hero.stance === 'plow') {
      b.fillStyle = Math.floor(view.time * 12) % 2 ? PAPER : LIGHT;
      b.fillRect(px - 5 + (Math.floor(view.time * 17) % 3), py + 2, 1, 1);
      b.fillRect(px + 4 - (Math.floor(view.time * 13) % 3), py + 3, 1, 1);
    }
    const blink = this.fx.heroHit > 0 && Math.floor(this.fx.heroHit * 20) % 2 === 0;
    if (!blink) b.drawImage(this.atlas.get(name, flip), px - 8, py - 13 - air - bob);
  }
}

function canvas2(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  return canvas(w, h);
}

/** Snow with contour lines: a vintage piste map, unique to the seed. */
function buildBackground(map: MountainMap): HTMLCanvasElement {
  const [c, ctx] = canvas(ART_W, ART_H);
  const img = ctx.createImageData(ART_W, ART_H);
  const [a, b2, c2, d] = hashSeed(`bg:${map.seed}`).map((v) => (v / 4294967296) * Math.PI * 2);
  const top = map.nodes[map.summit];
  const sx = top.x * TILE + 8;
  const sy = top.y * TILE + 8;
  const height = (x: number, y: number) =>
    ((ART_H - y) / ART_H) * 7 +
    1.2 * Math.sin(x * 0.034 + a) * Math.sin(y * 0.05 + b2) +
    0.6 * Math.sin(x * 0.09 + y * 0.045 + c2) +
    2.4 * Math.exp(-((x - sx) ** 2 + (y - sy) ** 2) / 2600) +
    0.4 * Math.sin(x * 0.2 + d) * Math.sin(y * 0.17);
  const step = 0.5;
  const level = new Int16Array(ART_W * ART_H);
  for (let y = 0; y < ART_H; y++) for (let x = 0; x < ART_W; x++) level[y * ART_W + x] = Math.floor(height(x, y) / step);
  const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
  const snow = rgb(SNOW);
  const fleck = rgb(SNOW_FLECK);
  const minor = rgb(CONTOUR);
  const major = rgb(CONTOUR_MAJOR);
  for (let y = 0; y < ART_H; y++) {
    for (let x = 0; x < ART_W; x++) {
      const i = y * ART_W + x;
      const lv = level[i];
      const contour = (x < ART_W - 1 && level[i + 1] !== lv) || (y < ART_H - 1 && level[i + ART_W] !== lv);
      const noise = ((x * 73856093) ^ (y * 19349663) ^ (a * 1000)) >>> 0;
      const col = contour ? (lv % 4 === 0 ? major : minor) : noise % 29 === 0 ? fleck : snow;
      img.data.set([col[0], col[1], col[2], 255], i * 4);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Where a lift line runs, in art pixels: its column, and from its top station to its bottom one. */
function liftSpan(map: MountainMap, lift: Segment): { x: number; top: number; bottom: number } {
  const from = map.nodes[lift.from];
  const to = map.nodes[lift.to];
  if (lift.route < 0) return { x: from.x * TILE, top: to.y * TILE + 8, bottom: from.y * TILE + 8 };
  return { x: from.x * TILE, top: to.y * TILE + 14, bottom: from.y * TILE + 2 };
}

/** A small black diamond, centred on (cx, top). */
function diamond(ctx: CanvasRenderingContext2D, cx: number, top: number): void {
  ctx.fillStyle = PAPER;
  ctx.fillRect(cx - 3, top - 1, 7, 9);
  ctx.fillStyle = INK;
  for (let k = 0; k < 4; k++) ctx.fillRect(cx - k, top + k, 1 + k * 2, 1);
  for (let k = 0; k < 3; k++) ctx.fillRect(cx - 2 + k, top + 4 + k, 5 - k * 2, 1);
}

/** A 3x3 of peaks becomes one big mountain with a double-black-diamond sign. */
function drawDoubleBlack(ctx: CanvasRenderingContext2D, x0: number, y0: number): void {
  const apex = 24;
  for (let r = 3; r <= 42; r++) {
    const half = ((r - 3) / 39) * 22;
    const xl = Math.round(apex - half);
    const xr = Math.round(apex + half);
    for (let x = xl; x <= xr; x++) {
      let col = x < apex - (r - 3) * 0.12 ? MID : DARK;
      const snowLine = 15 + ((x * 7) % 4);
      if (r < snowLine) col = x < apex ? PAPER : SHADE;
      if (x === xl || x === xr) col = INK;
      ctx.fillStyle = col;
      ctx.fillRect(x0 + x, y0 + r, 1, 1);
    }
  }
  ctx.fillStyle = INK;
  ctx.fillRect(x0 + 1, y0 + 43, 46, 1);
  ctx.fillStyle = LIGHT;
  ctx.fillRect(x0 + 3, y0 + 44, 42, 1);
  // The sign: two black diamonds on a white plate.
  ctx.fillStyle = INK;
  ctx.fillRect(x0 + 15, y0 + 30, 18, 9);
  ctx.fillStyle = PAPER;
  ctx.fillRect(x0 + 16, y0 + 31, 16, 7);
  ctx.fillStyle = INK;
  for (const cx of [20, 28]) {
    for (let k = 0; k < 3; k++) ctx.fillRect(x0 + cx - k, y0 + 32 + k, 1 + k * 2, 1);
    for (let k = 0; k < 2; k++) ctx.fillRect(x0 + cx - 1 + k, y0 + 35 + k, 3 - k * 2, 1);
  }
}
