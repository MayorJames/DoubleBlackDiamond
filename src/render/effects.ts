// Short-lived combat effects from pooled meshes: tracers and puffs. Cosmetic only.

import * as THREE from 'three';
import { makeFlakeTexture } from './textures';

interface Tracer {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  life: number;
  maxLife: number;
}

interface Puff {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  life: number;
  maxLife: number;
  size: number;
  rise: number;
}

const TRACERS = 24;
const PUFFS = 40;

export class Effects {
  private readonly tracers: Tracer[] = [];
  private readonly puffs: Puff[] = [];
  private nextTracer = 0;
  private nextPuff = 0;

  constructor(private readonly scene: THREE.Scene) {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    for (let i = 0; i < TRACERS; i++) {
      const material = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false });
      const mesh = new THREE.Mesh(geo, material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      this.tracers.push({ mesh, material, life: 0, maxLife: 1 });
    }
    const flake = makeFlakeTexture();
    for (let i = 0; i < PUFFS; i++) {
      const material = new THREE.SpriteMaterial({ map: flake, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(material);
      sprite.visible = false;
      scene.add(sprite);
      this.puffs.push({ sprite, material, life: 0, maxLife: 1, size: 1, rise: 0 });
    }
  }

  dispose(): void {
    for (const t of this.tracers) {
      this.scene.remove(t.mesh);
      t.material.dispose();
    }
    for (const p of this.puffs) {
      this.scene.remove(p.sprite);
      p.material.dispose();
    }
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, color: THREE.ColorRepresentation, width: number, life = 0.12): void {
    const t = this.tracers[this.nextTracer++ % TRACERS];
    const len = from.distanceTo(to);
    if (len < 0.01) return;
    t.mesh.position.copy(from).lerp(to, 0.5);
    t.mesh.scale.set(width, width, len);
    t.mesh.lookAt(to);
    t.material.color.set(color);
    t.material.opacity = 1;
    t.mesh.visible = true;
    t.life = t.maxLife = life;
  }

  puff(at: THREE.Vector3, color: THREE.ColorRepresentation, size = 1.2, life = 0.4): void {
    const p = this.puffs[this.nextPuff++ % PUFFS];
    p.sprite.position.copy(at);
    p.material.color.set(color);
    p.material.opacity = 1;
    p.sprite.visible = true;
    p.life = p.maxLife = life;
    p.size = size;
    p.rise = 0.8;
  }

  update(dt: number): void {
    for (const t of this.tracers) {
      if (!t.mesh.visible) continue;
      t.life -= dt;
      if (t.life <= 0) t.mesh.visible = false;
      else t.material.opacity = t.life / t.maxLife;
    }
    for (const p of this.puffs) {
      if (!p.sprite.visible) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        continue;
      }
      const k = 1 - p.life / p.maxLife;
      p.sprite.scale.setScalar(p.size * (0.3 + k));
      p.sprite.position.y += p.rise * dt;
      p.material.opacity = 1 - k;
    }
  }
}
