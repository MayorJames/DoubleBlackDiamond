// Pines as two crossed flat planes, N64-style: four triangles each, drawn in a handful of
// instanced batches split along the trail so off-screen batches are culled.

import * as THREE from 'three';
import type { Course } from '../sim/course';

const BATCH_LENGTH = 150;

function crossedPlanes(): THREE.BufferGeometry {
  const a = new THREE.PlaneGeometry(1, 1);
  a.translate(0, 0.5, 0);
  const b = a.clone();
  b.rotateY(Math.PI / 2);
  const geo = new THREE.BufferGeometry();
  const merge = (name: string, size: number) => {
    const pa = a.getAttribute(name).array as Float32Array;
    const pb = b.getAttribute(name).array as Float32Array;
    const out = new Float32Array(pa.length + pb.length);
    out.set(pa);
    out.set(pb, pa.length);
    geo.setAttribute(name, new THREE.BufferAttribute(out, size));
  };
  merge('position', 3);
  merge('normal', 3);
  merge('uv', 2);
  const ia = Array.from(a.getIndex()!.array);
  const offset = a.getAttribute('position').count;
  geo.setIndex([...ia, ...ia.map((i) => i + offset)]);
  a.dispose();
  b.dispose();
  return geo;
}

export function buildTrees(course: Course, pineTexture: THREE.Texture): THREE.Group {
  const group = new THREE.Group();
  group.name = 'trees';
  const geometry = crossedPlanes();
  const material = new THREE.MeshBasicMaterial({ map: pineTexture, alphaTest: 0.5, side: THREE.DoubleSide });

  const batches = new Map<number, typeof course.trees>();
  for (const t of course.trees) {
    const key = Math.floor(-t.z / BATCH_LENGTH);
    const list = batches.get(key);
    if (list) list.push(t);
    else batches.set(key, [t]);
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const dark = new THREE.Color('#9fb8a8');
  const white = new THREE.Color('#ffffff');
  const tint = new THREE.Color();

  for (const list of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry, material, list.length);
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, t.tint * Math.PI * 7);
      s.set(t.radius * 2, t.height, t.radius * 2);
      p.set(t.x, t.y - 0.3, t.z);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, tint.copy(white).lerp(dark, t.tint));
    });
    mesh.computeBoundingSphere();
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  }
  return group;
}
