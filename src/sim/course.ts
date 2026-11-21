// The slope: a single trail generated entirely from a seed.
//
// Coordinates: Y is up and the trail runs downhill toward -Z. `d` is metres downhill from the
// start gate (d = -z) and `u` is the sideways offset from the trail's centreline (u = x - centerX(d)).
// Height is an analytic function, so physics and the rendered mesh sample exactly the same surface.

import { clamp, smoothstep, type Vec3, vec3, normalize } from './math';
import { Rng } from './rng';

export interface Tree {
  /** Index in Course.trees. */
  id: number;
  x: number;
  y: number;
  z: number;
  height: number;
  /** Visual canopy radius at the base. */
  radius: number;
  /** Collision radius of the trunk and inner branches. */
  hitRadius: number;
  /** 0..1, picks a shade of green when drawn. */
  tint: number;
}

export interface Kicker {
  /** Distance downhill where the ramp starts. */
  d: number;
  /** Sideways offset of the ramp's centre. */
  u: number;
  length: number;
  height: number;
  width: number;
  /** Length of the steep back side after the lip. */
  drop: number;
}

export interface Zone {
  kind: 'rollers' | 'moguls' | 'glade';
  start: number;
  end: number;
  amp: number;
  wavelength: number;
}

const TAU = Math.PI * 2;
const TREE_CELL = 8;

/** Length of the first trail, metres. Runs start short. */
export const DEFAULT_COURSE_LENGTH = 1300;

export class Course {
  readonly seed: string;
  /** Distance of the base camp line. */
  readonly finishD: number;
  /** End of the run-out at base camp, where the lodge stands. */
  readonly endD: number;
  /** Top of the generated terrain (above the start gate). */
  readonly topD = -40;
  readonly startD = 2;
  readonly bankWidth = 14;
  readonly bankHeight = 8;
  readonly plateauWidth = 46;
  readonly plateauRise = 0.08;
  readonly maxHalfWidth: number;

  readonly kickers: Kicker[] = [];
  readonly zones: Zone[] = [];
  readonly trees: Tree[] = [];

  // Centreline and width waves.
  private readonly c1: [amp: number, k: number, phase: number];
  private readonly c2: [amp: number, k: number, phase: number];
  private readonly cOffset: number;
  private readonly w: [base: number, amp: number, k: number, phase: number];
  private readonly line: [k: number, phase: number];
  private readonly undulate: [number, number, number];

  // Height of the trail floor for each metre of along-track distance.
  private readonly baseY: Float64Array;
  private readonly treeGrid = new Map<number, number[]>();

  constructor(seed: string, length = DEFAULT_COURSE_LENGTH) {
    this.seed = seed;
    this.finishD = length;
    this.endD = length + 150;
    const rng = Rng.fromSeed(`course:${seed}`);

    this.c1 = [rng.range(18, 32), TAU / rng.range(520, 760), rng.range(0, TAU)];
    this.c2 = [rng.range(5, 9), TAU / rng.range(260, 360), rng.range(0, TAU)];
    this.cOffset = 0;
    this.cOffset = this.centerX(0);
    this.w = [rng.range(28, 34), rng.range(3, 8), TAU / rng.range(240, 400), rng.range(0, TAU)];
    this.maxHalfWidth = this.w[0] + this.w[1];
    this.line = [TAU / rng.range(160, 240), rng.range(0, TAU)];
    this.undulate = [rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU)];

    this.layoutFeatures(rng);
    this.baseY = this.buildProfile(rng);
    this.plantTrees(rng);
  }

  // --- Trail shape -------------------------------------------------------------------------

  centerX(d: number): number {
    const [a1, k1, p1] = this.c1;
    const [a2, k2, p2] = this.c2;
    return a1 * Math.sin(k1 * d + p1) + a2 * Math.sin(k2 * d + p2) - this.cOffset;
  }

  /** dx/dd of the centreline. */
  centerSlope(d: number): number {
    const [a1, k1, p1] = this.c1;
    const [a2, k2, p2] = this.c2;
    return a1 * k1 * Math.cos(k1 * d + p1) + a2 * k2 * Math.cos(k2 * d + p2);
  }

  halfWidth(d: number): number {
    const [base, amp, k, p] = this.w;
    return base + amp * Math.sin(k * d + p);
  }

  /** Yaw of the trail's fall line at distance d. */
  trackYaw(d: number): number {
    return -Math.atan(this.centerSlope(d));
  }

  /** A hidden line down the trail that is always kept free of trees, so every seed is skiable. */
  lineX(d: number): number {
    return this.centerX(d) + 0.45 * this.halfWidth(d) * Math.sin(this.line[0] * d + this.line[1]);
  }

  lateral(x: number, z: number): number {
    return x - this.centerX(-z);
  }

  /** Outer limit you can travel sideways before an invisible wall. */
  wallU(d: number): number {
    return this.halfWidth(d) + this.bankWidth + this.plateauWidth - 6;
  }

  heightAt(x: number, z: number): number {
    const d = -z;
    const cs = this.centerSlope(d);
    const u = x - this.centerX(d);
    const w = this.halfWidth(d);
    const bw = this.bankWidth;
    const au = Math.abs(u);

    // Contours run across the trail, not across the world, so the fall line follows the trail.
    const ub = clamp(u, -(w + bw), w + bw);
    let y = this.baseYAt(d + (ub * cs) / (1 + cs * cs));

    // Snowbanks that steer you back in, then a forested plateau.
    if (au > w) {
      y += this.bankHeight * smoothstep(w, w + bw, au);
      if (au > w + bw) y += (au - w - bw) * this.plateauRise;
    }

    // Gentle swells so the snow never looks machine-flat.
    const [p1, p2, p3] = this.undulate;
    y += 0.35 * Math.sin(x * 0.045 + d * 0.021 + p1) * Math.sin(d * 0.037 - x * 0.013 + p2);
    y += 0.08 * Math.sin(x * 0.15 + p3) * Math.sin(d * 0.12 + p1);

    const inside = 1 - smoothstep(w - 8, w - 1, au);
    if (inside > 0) {
      for (const zone of this.zones) {
        if (d <= zone.start || d >= zone.end || zone.kind === 'glade') continue;
        const env =
          inside * smoothstep(zone.start, zone.start + 12, d) * (1 - smoothstep(zone.end - 12, zone.end, d));
        if (zone.kind === 'rollers') {
          y += env * zone.amp * Math.sin((TAU * (d - zone.start)) / zone.wavelength);
        } else {
          y += env * zone.amp * Math.sin((TAU * u) / (zone.wavelength * 0.85)) * Math.sin((TAU * d) / zone.wavelength);
        }
      }
      for (const k of this.kickers) {
        const a = d - k.d;
        if (a <= 0 || a >= k.length + k.drop) continue;
        const lat = 1 - smoothstep(k.width / 2 - 1.2, k.width / 2 + 1.2, Math.abs(u - k.u));
        if (lat <= 0) continue;
        const profile =
          a <= k.length ? k.height * (a / k.length) ** 2 : k.height * (1 - smoothstep(0, 1, (a - k.length) / k.drop));
        y += inside * lat * profile;
      }
    }
    return y;
  }

  normalAt(x: number, z: number, out: Vec3 = vec3()): Vec3 {
    const e = 0.6;
    const hx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const hz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    out.x = -hx;
    out.y = 1;
    out.z = -hz;
    return normalize(out);
  }

  /** Calls `visit` for every tree whose cell overlaps the circle. */
  forTreesNear(x: number, z: number, radius: number, visit: (tree: Tree) => void): void {
    const x0 = Math.floor((x - radius) / TREE_CELL);
    const x1 = Math.floor((x + radius) / TREE_CELL);
    const z0 = Math.floor((z - radius) / TREE_CELL);
    const z1 = Math.floor((z + radius) / TREE_CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const cell = this.treeGrid.get(cellKey(cx, cz));
        if (!cell) continue;
        for (const i of cell) visit(this.trees[i]);
      }
    }
  }

  // --- Generation --------------------------------------------------------------------------

  private baseYAt(d: number): number {
    const f = clamp(d - this.topD, 0, this.baseY.length - 1.000001);
    const i = Math.floor(f);
    const t = f - i;
    return this.baseY[i] + (this.baseY[i + 1] - this.baseY[i]) * t;
  }

  private layoutFeatures(rng: Rng): void {
    const kinds = rng.shuffle(['kicker', 'kicker', 'kicker', 'rollers', 'moguls', 'glade', 'open'] as const);
    let d = 110;
    const last = this.finishD - 140;
    for (const kind of kinds) {
      const len =
        kind === 'kicker'
          ? 100
          : kind === 'rollers'
            ? rng.range(130, 180)
            : kind === 'moguls'
              ? rng.range(90, 130)
              : rng.range(70, 120);
      if (d + len > last) continue;
      if (kind === 'kicker') {
        const kd = Math.round(d + 15);
        this.kickers.push({
          d: kd,
          u: rng.range(-0.35, 0.35) * this.halfWidth(kd),
          length: Math.round(rng.range(11, 14)),
          height: rng.range(1.3, 1.9),
          width: rng.range(8, 11),
          drop: 2.5,
        });
      } else if (kind === 'rollers') {
        this.zones.push({ kind, start: d, end: d + len, amp: rng.range(0.5, 0.75), wavelength: rng.range(34, 42) });
      } else if (kind === 'moguls') {
        this.zones.push({ kind, start: d, end: d + len, amp: rng.range(0.28, 0.38), wavelength: rng.range(9, 11) });
      } else if (kind === 'glade') {
        this.zones.push({ kind, start: d, end: d + len, amp: 0, wavelength: 0 });
      }
      d += len + rng.range(20, 50);
    }
  }

  private gradeDeg(d: number, points: number[], step: number): number {
    if (d < 0) return 8 + 13 * smoothstep(-40, 0, d);
    const i = Math.min(Math.floor(d / step), points.length - 2);
    const t = clamp((d - i * step) / step, 0, 1);
    let g = points[i] + (points[i + 1] - points[i]) * ((1 - Math.cos(Math.PI * t)) / 2);
    // Steepen the landings so a full-speed kicker still sets you down on a downslope.
    for (const k of this.kickers) {
      const lip = k.d + k.length;
      g += 5 * smoothstep(k.d - 30, k.d, d) * (1 - smoothstep(lip + 50, lip + 90, d));
    }
    // Ease off into base camp, then a run-out that tilts uphill so you coast to a stop.
    g += (9 - g) * smoothstep(this.finishD - 120, this.finishD - 20, d);
    if (d > this.finishD) g = 9 + (-5 - 9) * smoothstep(this.finishD, this.finishD + 70, d);
    return g;
  }

  private buildProfile(rng: Rng): Float64Array {
    const step = 130;
    const points: number[] = [];
    const count = Math.ceil(this.endD / step) + 2;
    for (let i = 0; i < count; i++) points.push(rng.range(15, 26));
    points[0] = 21;

    const n = Math.ceil(this.endD + 60 - this.topD) + 1;
    const ys = new Float64Array(n);
    let zeroIndex = 0;
    for (let i = 1; i < n; i++) {
      const d = this.topD + i - 0.5;
      ys[i] = ys[i - 1] - Math.tan((this.gradeDeg(d, points, step) * Math.PI) / 180);
      if (this.topD + i === 0) zeroIndex = i;
    }
    const y0 = ys[zeroIndex];
    for (let i = 0; i < n; i++) ys[i] -= y0;
    return ys;
  }

  private addTree(x: number, z: number, height: number, tint: number): void {
    const radius = height * 0.3;
    const tree: Tree = {
      id: this.trees.length,
      x,
      z,
      y: this.heightAt(x, z),
      height,
      radius,
      hitRadius: 0.3 + radius * 0.15,
      tint,
    };
    const index = this.trees.push(tree) - 1;
    const key = cellKey(Math.floor(x / TREE_CELL), Math.floor(z / TREE_CELL));
    const cell = this.treeGrid.get(key);
    if (cell) cell.push(index);
    else this.treeGrid.set(key, [index]);
  }

  private hasTreeWithin(x: number, z: number, r: number): boolean {
    let found = false;
    this.forTreesNear(x, z, r, (t) => {
      if (!found && (t.x - x) ** 2 + (t.z - z) ** 2 < r * r) found = true;
    });
    return found;
  }

  private plantTrees(rng: Rng): void {
    const nearKicker = (d: number, u: number) =>
      this.kickers.some(
        (k) => d > k.d - 25 && d < k.d + k.length + 60 && Math.abs(u - k.u) < k.width / 2 + 7,
      );

    const tryPlace = (d: number, u: number) => {
      if (d < 70 || d > this.finishD - 30) return;
      const w = this.halfWidth(d);
      if (Math.abs(u) > w + 2) return;
      const x = this.centerX(d) + u;
      if (Math.abs(x - this.lineX(d)) < 4.5) return;
      if (nearKicker(d, u)) return;
      if (this.hasTreeWithin(x, -d, 2.8)) return;
      this.addTree(x, -d, rng.range(5, 9), rng.next());
    };

    const scatterCluster = (d: number, u: number) => {
      const n = rng.int(2, 7);
      for (let i = 0; i < n; i++) tryPlace(d + rng.range(-7, 7), u + rng.range(-6, 6));
    };

    // Trees on the trail: clusters and loners, thicker in glades.
    const clusters = Math.round(this.finishD / 45);
    for (let i = 0; i < clusters; i++) {
      const d = rng.range(70, this.finishD - 30);
      scatterCluster(d, rng.range(-1, 1) * this.halfWidth(d));
    }
    const singles = Math.round(this.finishD / 25);
    for (let i = 0; i < singles; i++) {
      const d = rng.range(70, this.finishD - 30);
      tryPlace(d, rng.range(-1, 1) * this.halfWidth(d));
    }
    for (const zone of this.zones) {
      if (zone.kind !== 'glade') continue;
      for (let i = 0; i < 10; i++) {
        const d = rng.range(zone.start, zone.end);
        scatterCluster(d, rng.range(-1, 1) * this.halfWidth(d));
      }
    }

    // Forest walls along the banks and plateau.
    const bw = this.bankWidth;
    for (let d = this.topD; d < this.endD + 30; d += 4.5) {
      for (const side of [-1, 1]) {
        const w = this.halfWidth(d);
        const onBank = 1 + rng.int(0, 2);
        for (let i = 0; i < onBank; i++) {
          const dd = d + rng.range(-2, 2);
          const u = side * (this.halfWidth(dd) + bw * rng.range(0.45, 1.05));
          this.addTree(this.centerX(dd) + u, -dd, rng.range(6, 11), rng.next());
        }
        for (let i = 0; i < 2; i++) {
          const dd = d + rng.range(-2, 2);
          const u = side * (w + bw + rng.range(0, this.plateauWidth - 4));
          this.addTree(this.centerX(dd) + u, -dd, rng.range(7, 12), rng.next());
        }
      }
    }
  }
}

function cellKey(cx: number, cz: number): number {
  return (cx + 4096) * 8192 + (cz + 4096);
}
