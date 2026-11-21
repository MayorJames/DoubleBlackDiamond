// Ray tests for bullets and lines of sight: snow, tree trunks and guards' hit spheres.

import type { Course } from './course';
import { type Vec3, vec3 } from './math';

/** Guard hit spheres, as height above the guard's feet and radius. */
export const GUARD_HEAD = { y: 1.68, r: 0.22 };
export const GUARD_BODY = [
  { y: 1.1, r: 0.45 },
  { y: 0.45, r: 0.3 },
];
export const GUARD_EYE = 1.6;

/** Unit direction for a yaw and pitch (same convention as the camera). */
export function aimDirection(yaw: number, pitch: number, out: Vec3 = vec3()): Vec3 {
  const c = Math.cos(pitch);
  out.x = -Math.sin(yaw) * c;
  out.y = Math.sin(pitch);
  out.z = -Math.cos(yaw) * c;
  return out;
}

/** Distance along a unit ray to a sphere, or -1. */
export function raySphere(o: Vec3, d: Vec3, cx: number, cy: number, cz: number, r: number): number {
  const ox = o.x - cx;
  const oy = o.y - cy;
  const oz = o.z - cz;
  const b = ox * d.x + oy * d.y + oz * d.z;
  const c = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  let t = -b - s;
  if (t < 0) t = -b + s;
  return t >= 0 ? t : -1;
}

/** Distance along a unit ray to the snow surface, or Infinity. */
export function terrainHit(course: Course, o: Vec3, d: Vec3, maxT: number): number {
  let prev = 0;
  let t = 0.5;
  while (t <= maxT) {
    if (o.y + d.y * t < course.heightAt(o.x + d.x * t, o.z + d.z * t)) {
      let lo = prev;
      let hi = t;
      for (let i = 0; i < 5; i++) {
        const m = (lo + hi) / 2;
        if (o.y + d.y * m < course.heightAt(o.x + d.x * m, o.z + d.z * m)) hi = m;
        else lo = m;
      }
      return hi;
    }
    prev = t;
    t += t < 20 ? 1 : 2.5;
  }
  return Infinity;
}

/** Distance along a unit ray to a tree's trunk and inner branches, or Infinity. */
export function treeHit(course: Course, o: Vec3, d: Vec3, maxT: number): number {
  const hh = d.x * d.x + d.z * d.z;
  if (hh < 1e-6) return Infinity;
  const seen = new Set<number>();
  let best = Infinity;
  for (let s = 0; s <= maxT + 8; s += 8) {
    course.forTreesNear(o.x + d.x * s, o.z + d.z * s, 7, (tree) => {
      if (seen.has(tree.id)) return;
      seen.add(tree.id);
      const r = tree.radius * 0.45;
      const wx = o.x - tree.x;
      const wz = o.z - tree.z;
      const b = wx * d.x + wz * d.z;
      const c = wx * wx + wz * wz - r * r;
      const disc = b * b - hh * c;
      if (disc < 0) return;
      const t = (-b - Math.sqrt(disc)) / hh;
      if (t < 0 || t > maxT || t >= best) return;
      const y = o.y + d.y * t;
      if (y < tree.y || y > tree.y + tree.height * 0.9) return;
      best = t;
    });
  }
  return best;
}

const los = vec3();

/** True when nothing solid sits between two points. */
export function lineOfSight(course: Course, a: Vec3, b: Vec3): boolean {
  los.x = b.x - a.x;
  los.y = b.y - a.y;
  los.z = b.z - a.z;
  const dist = Math.sqrt(los.x * los.x + los.y * los.y + los.z * los.z);
  if (dist < 1) return true;
  los.x /= dist;
  los.y /= dist;
  los.z /= dist;
  const reach = dist - 0.6;
  return terrainHit(course, a, los, reach) === Infinity && treeHit(course, a, los, reach) === Infinity;
}
