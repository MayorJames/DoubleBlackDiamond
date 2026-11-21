// Falling snow that wraps around the camera. The flakes stay put in the world, so at speed
// they streak past you: one of the cheapest and strongest speed cues there is.

import * as THREE from 'three';

const COUNT = 1400;
const SIZE = new THREE.Vector3(70, 36, 70);

export class SnowField {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly drift: Float32Array;

  constructor(texture: THREE.Texture) {
    this.positions = new Float32Array(COUNT * 3);
    this.drift = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      this.positions[i * 3] = (Math.random() - 0.5) * SIZE.x;
      this.positions[i * 3 + 1] = (Math.random() - 0.5) * SIZE.y;
      this.positions[i * 3 + 2] = (Math.random() - 0.5) * SIZE.z;
      this.drift[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      map: texture,
      transparent: true,
      depthWrite: false,
      color: '#ffffff',
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
  }

  /** Cosmetic only, so it uses wall-clock time and Math.random freely. */
  update(dt: number, time: number, center: THREE.Vector3): void {
    const p = this.positions;
    const wind = Math.sin(time * 0.3) * 1.5 + 1;
    for (let i = 0; i < COUNT; i++) {
      const k = i * 3;
      p[k] += (wind + Math.sin(time * 1.3 + this.drift[i]) * 0.4) * dt;
      p[k + 1] -= 1.6 * dt;
      p[k + 2] += Math.cos(time * 1.1 + this.drift[i]) * 0.4 * dt;
      p[k] = wrap(p[k], center.x, SIZE.x);
      p[k + 1] = wrap(p[k + 1], center.y, SIZE.y);
      p[k + 2] = wrap(p[k + 2], center.z, SIZE.z);
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;
  }
}

function wrap(v: number, center: number, size: number): number {
  const half = size / 2;
  const rel = v - center + half;
  return center - half + (((rel % size) + size) % size);
}
