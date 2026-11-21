// Short-lived effects in art pixels: tracers, sparks, enemies flung off the map, placement
// puffs, and falling snow. Cosmetic, so wall-clock time and Math.random are fine here.

import { INK, LIGHT, PAPER, RED } from './palette';
import type { Sprite } from './sprites';

interface Tracer {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  life: number;
  color: string;
}
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}
interface Fling {
  sprite: Sprite;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  life: number;
}
interface Ring {
  x: number;
  y: number;
  life: number;
}

/** Pixel-exact line. */
export function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string): void {
  ctx.fillStyle = color;
  let x = Math.round(x1);
  let y = Math.round(y1);
  const tx = Math.round(x2);
  const ty = Math.round(y2);
  const dx = Math.abs(tx - x);
  const dy = -Math.abs(ty - y);
  const sx = x < tx ? 1 : -1;
  const sy = y < ty ? 1 : -1;
  let err = dx + dy;
  for (let i = 0; i < 400; i++) {
    ctx.fillRect(x, y, 1, 1);
    if (x === tx && y === ty) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

export class Fx {
  private tracers: Tracer[] = [];
  private sparks: Spark[] = [];
  private flings: Fling[] = [];
  private rings: Ring[] = [];
  private readonly flakes: { x: number; y: number; v: number }[] = [];
  /** Seconds since each enemy last fired, for muzzle flashes. */
  readonly fired = new Map<number, number>();
  heroHit = 0;

  constructor(
    private readonly w: number,
    private readonly h: number,
  ) {
    for (let i = 0; i < 36; i++) this.flakes.push({ x: Math.random() * w, y: Math.random() * h, v: 6 + Math.random() * 8 });
  }

  clear(): void {
    this.tracers = [];
    this.sparks = [];
    this.flings = [];
    this.rings = [];
    this.fired.clear();
    this.heroHit = 0;
  }

  tracer(x1: number, y1: number, x2: number, y2: number, enemy: boolean): void {
    this.tracers.push({ x1, y1, x2, y2, life: enemy ? 0.12 : 0.08, color: enemy ? RED : INK });
  }

  burst(x: number, y: number, n: number, colors: string[] = [PAPER, RED, INK]): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = 20 + Math.random() * 40;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, life: 0.3 + Math.random() * 0.3, color: colors[i % colors.length] });
    }
  }

  fling(sprite: Sprite, x: number, y: number): void {
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.flings.push({ sprite, x, y, vx: dir * (25 + Math.random() * 25), vy: -70 - Math.random() * 30, rot: 0, vr: dir * (8 + Math.random() * 6), life: 0.9 });
  }

  ring(x: number, y: number): void {
    this.rings.push({ x, y, life: 0.35 });
    this.burst(x, y, 10, [LIGHT, PAPER, INK]);
  }

  update(dt: number): void {
    for (const t of this.tracers) t.life -= dt;
    this.tracers = this.tracers.filter((t) => t.life > 0);
    for (const s of this.sparks) {
      s.life -= dt;
      s.vy += 120 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
    for (const f of this.flings) {
      f.life -= dt;
      f.vy += 220 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.rot += f.vr * dt;
    }
    this.flings = this.flings.filter((f) => f.life > 0);
    for (const r of this.rings) r.life -= dt;
    this.rings = this.rings.filter((r) => r.life > 0);
    for (const [id, t] of this.fired) this.fired.set(id, t + dt);
    this.heroHit = Math.max(0, this.heroHit - dt);
    for (const f of this.flakes) {
      f.y += f.v * dt;
      f.x -= f.v * 0.4 * dt;
      if (f.y > this.h) f.y -= this.h;
      if (f.x < 0) f.x += this.w;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const r of this.rings) {
      const radius = Math.round((1 - r.life / 0.35) * 12 + 4);
      ctx.fillStyle = INK;
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        ctx.fillRect(Math.round(r.x + Math.cos(ang) * radius), Math.round(r.y + Math.sin(ang) * radius * 0.7), 1, 1);
      }
    }
    for (const t of this.tracers) line(ctx, t.x1, t.y1, t.x2, t.y2, t.color);
    for (const s of this.sparks) {
      ctx.fillStyle = s.color;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
    for (const f of this.flings) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, f.life * 2);
      ctx.translate(Math.round(f.x), Math.round(f.y));
      ctx.rotate(f.rot);
      ctx.drawImage(f.sprite, -f.sprite.width / 2, -f.sprite.height / 2);
      ctx.restore();
    }
  }

  drawSnow(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = LIGHT;
    for (const f of this.flakes) ctx.fillRect(Math.round(f.x), Math.round(f.y), 1, 1);
  }
}
