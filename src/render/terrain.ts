// The snow mesh, sampled from the same height function the physics uses. Split into chunks
// along the trail so the GPU only draws the stretch in front of the camera.

import * as THREE from 'three';
import type { Course } from '../sim/course';
import { PAPER, SNOW_SHADE } from './palette';

const ROW_STEP = 2;
const FINE_ROW_STEP = 0.5;
const ROWS_PER_CHUNK = 30;

function rowDistances(course: Course): number[] {
  const rows = new Set<number>();
  for (let d = course.topD; d <= course.endD + 20; d += ROW_STEP) rows.add(d);
  // Extra rows around each kicker so the lip is crisp where the physics says it is.
  for (const k of course.kickers) {
    for (let d = k.d - 2; d <= k.d + k.length + k.drop + 2; d += FINE_ROW_STEP) rows.add(d);
  }
  return [...rows].sort((a, b) => a - b);
}

function columnOffsets(course: Course): number[] {
  const fine = course.maxHalfWidth + course.bankWidth + 6;
  const outer = course.maxHalfWidth + course.bankWidth + course.plateauWidth + 6;
  const cols: number[] = [];
  for (let u = -outer; u < -fine; u += 5) cols.push(u);
  for (let u = -fine; u <= fine + 1e-6; u += 2) cols.push(u);
  const right = cols.filter((u) => u < -fine).map((u) => -u).reverse();
  return cols.concat(right);
}

const snow = new THREE.Color(PAPER);
const bank = new THREE.Color(SNOW_SHADE);
const forest = new THREE.Color('#efefef');
const ice = new THREE.Color('#bdbdbd');

export function buildTerrain(course: Course, snowTexture: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'terrain';
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, map: snowTexture, flatShading: true });
  const rows = rowDistances(course);
  const cols = columnOffsets(course);
  const nc = cols.length;
  const c = new THREE.Color();

  for (let r0 = 0; r0 < rows.length - 1; r0 += ROWS_PER_CHUNK) {
    const r1 = Math.min(rows.length - 1, r0 + ROWS_PER_CHUNK);
    const nr = r1 - r0 + 1;
    const pos = new Float32Array(nr * nc * 3);
    const col = new Float32Array(nr * nc * 3);
    const uv = new Float32Array(nr * nc * 2);
    let vi = 0;
    for (let r = r0; r <= r1; r++) {
      const d = rows[r];
      const cx = course.centerX(d);
      const w = course.halfWidth(d);
      for (let j = 0; j < nc; j++) {
        const u = cols[j];
        const x = cx + u;
        const z = -d;
        const y = course.heightAt(x, z);
        pos[vi * 3] = x;
        pos[vi * 3 + 1] = y;
        pos[vi * 3 + 2] = z;
        uv[vi * 2] = x / 8;
        uv[vi * 2 + 1] = z / 8;

        const au = Math.abs(u);
        c.copy(snow);
        if (au > w + course.bankWidth) c.copy(forest);
        else if (au > w) c.lerp(bank, Math.min(1, (au - w) / 4));
        for (const k of course.kickers) {
          const a = d - k.d;
          if (a > 0 && a < k.length + 0.25 && Math.abs(u - k.u) < k.width / 2) c.lerp(ice, 0.25 + 0.5 * (a / k.length));
        }
        const jitter = 0.97 + 0.05 * Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453 % 1);
        col[vi * 3] = c.r * jitter;
        col[vi * 3 + 1] = c.g * jitter;
        col[vi * 3 + 2] = c.b * jitter;
        vi++;
      }
    }
    const index: number[] = [];
    for (let r = 0; r < nr - 1; r++) {
      for (let j = 0; j < nc - 1; j++) {
        const a = r * nc + j;
        const b = a + 1;
        const cc = a + nc;
        const dd = cc + 1;
        // Alternate the diagonal for a less regular, more faceted look.
        // Counter-clockwise seen from above, so the faces (and normals) point up.
        if ((r + j) % 2 === 0) index.push(a, b, cc, b, dd, cc);
        else index.push(a, dd, cc, a, b, dd);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, material);
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  return group;
}

/** A thin painted strip that hugs the snow, e.g. the finish line or the blue line on a kicker lip. */
export function buildSnowStrip(
  course: Course,
  d0: number,
  d1: number,
  u0: number,
  u1: number,
  color: THREE.ColorRepresentation,
): THREE.Mesh {
  const steps = Math.max(2, Math.ceil((u1 - u0) / 0.75));
  const pos: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = u0 + ((u1 - u0) * i) / steps;
    for (const d of [d0, d1]) {
      const x = course.centerX(d) + u;
      pos.push(x, course.heightAt(x, -d) + 0.08, -d);
    }
    if (i < steps) {
      const a = i * 2;
      index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  const material = new THREE.MeshBasicMaterial({
    color,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.matrixAutoUpdate = false;
  return mesh;
}
