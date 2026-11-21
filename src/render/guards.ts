// Guards as chunky black-and-white figures with an ink outline. Red only appears when a
// guard is about to shoot you (a glint on the muzzle, and a laser from snipers), so red always
// means danger. Downed guards do a slapstick backflip and lose their hats.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Course } from '../sim/course';
import type { GuardKind, GuardState } from '../sim/guards';
import type { SimEvent } from '../sim/player';
import { INK, INK_SOFT, PAPER, RED } from './palette';

/** A box: size, centre, colour, and optional rotation about X. */
type Part = [w: number, h: number, d: number, x: number, y: number, z: number, color: string, rx?: number];

const OUTLINE = 0.05;
const GRAVITY = 14;

function partsFor(kind: GuardKind): Part[] {
  const crouch = kind === 'skier' ? -0.12 : 0;
  const parts: Part[] = [
    // Boots and legs
    [0.17, 0.12, 0.3, -0.12, 0.06, -0.03, INK],
    [0.17, 0.12, 0.3, 0.12, 0.06, -0.03, INK],
    [0.16, 0.66 + crouch, 0.18, -0.12, 0.45 + crouch / 2, 0, INK_SOFT],
    [0.16, 0.66 + crouch, 0.18, 0.12, 0.45 + crouch / 2, 0, INK_SOFT],
    // Trench coat with a white belt
    [0.62, 0.82, 0.36, 0, 1.16 + crouch, 0, INK],
    [0.64, 0.07, 0.38, 0, 1.0 + crouch, 0, PAPER],
    // Arms out front, holding the gun
    [0.14, 0.14, 0.5, -0.2, 1.36 + crouch, -0.24, INK],
    [0.14, 0.14, 0.5, 0.2, 1.36 + crouch, -0.24, INK],
    // Serious white face: eyes, angry brows and a long nose
    [0.3, 0.32, 0.3, 0, 1.7 + crouch, 0, PAPER],
    [0.05, 0.05, 0.02, -0.07, 1.74 + crouch, -0.155, INK],
    [0.05, 0.05, 0.02, 0.07, 1.74 + crouch, -0.155, INK],
    [0.1, 0.025, 0.02, -0.07, 1.8 + crouch, -0.155, INK, 0],
    [0.1, 0.025, 0.02, 0.07, 1.8 + crouch, -0.155, INK, 0],
    [0.05, 0.07, 0.14, 0, 1.68 + crouch, -0.2, PAPER],
  ];
  const gunLength = kind === 'sniper' ? 0.95 : 0.4;
  parts.push([0.07, 0.09, gunLength, 0.06, 1.4 + crouch, -0.5 - gunLength / 2 + 0.2, INK]);
  if (kind === 'skier') {
    parts.push([0.1, 0.03, 1.7, -0.13, 0.015, -0.1, INK], [0.1, 0.03, 1.7, 0.13, 0.015, -0.1, INK]);
  }
  return parts;
}

function hatParts(kind: GuardKind): Part[] {
  if (kind === 'sniper') return [[0.36, 0.08, 0.36, 0.02, 0, 0, INK]];
  if (kind === 'skier')
    return [
      [0.32, 0.16, 0.32, 0, 0, 0, INK],
      [0.33, 0.05, 0.33, 0, -0.02, 0, PAPER],
      [0.09, 0.09, 0.09, 0, 0.12, 0, PAPER],
    ];
  return [[0.34, 0.36, 0.34, 0, 0.08, 0, INK]]; // a tall fur busby
}

function build(parts: Part[], grow = 0): THREE.BufferGeometry {
  const color = new THREE.Color();
  const geos = parts.map(([w, h, d, x, y, z, c, rx]) => {
    const g = new THREE.BoxGeometry(w + grow, h + grow, d + grow);
    if (rx) g.rotateX(rx);
    g.translate(x, y, z);
    color.set(c);
    const n = g.getAttribute('position').count;
    const cols = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) cols.set([color.r, color.g, color.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    return g;
  });
  const merged = mergeGeometries(geos)!;
  for (const g of geos) g.dispose();
  return merged;
}

const outlineMaterial = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
const glintMaterial = new THREE.MeshBasicMaterial({ color: RED, fog: false });
const laserMaterial = new THREE.MeshBasicMaterial({ color: RED, transparent: true, opacity: 0.75, fog: false });
const towerMaterial = new THREE.MeshLambertMaterial({ color: INK, flatShading: true });
const roofMaterial = new THREE.MeshLambertMaterial({ color: PAPER, flatShading: true });

const geometryCache = new Map<string, THREE.BufferGeometry>();
function cached(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geometryCache.get(key);
  if (!g) geometryCache.set(key, (g = make()));
  return g;
}

function tower(): THREE.Group {
  const g = new THREE.Group();
  const h = 4.5;
  for (const [x, z] of [
    [-0.9, -0.9],
    [0.9, -0.9],
    [-0.9, 0.9],
    [0.9, 0.9],
  ]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.18, h + 0.6, 0.18), towerMaterial);
    post.position.set(x, -h / 2 + 0.3, z);
    g.add(post);
  }
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.18, 2.3), towerMaterial);
  deck.position.y = -0.09;
  const rail = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.5, 0.1), towerMaterial);
  rail.position.set(0, 0.45, 1.1);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.1, 4, 1), roofMaterial);
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 2.8;
  const brace = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.8, 0.1), towerMaterial);
  brace.position.set(-0.9, 1.4, -0.9);
  const brace2 = brace.clone();
  brace2.position.set(0.9, 1.4, -0.9);
  g.add(deck, rail, roof, brace, brace2);
  return g;
}

interface Pratfall {
  t: number;
  dirX: number;
  dirZ: number;
  turns: number;
  distance: number;
  height: number;
  baseX: number;
  baseZ: number;
  hatVel: THREE.Vector3;
  hatSpin: number;
}

class GuardView {
  readonly root = new THREE.Group();
  readonly body: THREE.Group;
  readonly material: THREE.MeshLambertMaterial;
  readonly hat: THREE.Mesh;
  readonly glint: THREE.Mesh;
  readonly laser: THREE.Mesh | null;
  readonly muzzle: THREE.Vector3;
  readonly prev = new THREE.Vector3();
  fall: Pratfall | null = null;
  flashT = 0;

  constructor(
    readonly kind: GuardKind,
    scene: THREE.Scene,
  ) {
    this.material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.body = new THREE.Group();
    this.body.add(
      new THREE.Mesh(cached(`body-${kind}`, () => build(partsFor(kind))), this.material),
      new THREE.Mesh(cached(`outline-${kind}`, () => build(partsFor(kind), OUTLINE)), outlineMaterial),
    );
    const crouch = kind === 'skier' ? -0.12 : 0;
    this.hat = new THREE.Mesh(cached(`hat-${kind}`, () => build(hatParts(kind))), this.material);
    this.hat.add(new THREE.Mesh(cached(`hat-outline-${kind}`, () => build(hatParts(kind), OUTLINE)), outlineMaterial));
    this.hat.position.set(0, 1.92 + crouch, 0);
    this.body.add(this.hat);
    const gunLength = kind === 'sniper' ? 0.95 : 0.4;
    this.muzzle = new THREE.Vector3(0.06, 1.4 + crouch, -0.3 - gunLength);
    this.glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 0), glintMaterial);
    this.glint.position.copy(this.muzzle);
    this.glint.visible = false;
    this.body.add(this.glint);
    this.root.add(this.body);
    this.laser = kind === 'sniper' ? new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 1), laserMaterial) : null;
    if (this.laser) {
      this.laser.visible = false;
      scene.add(this.laser);
    }
    scene.add(this.root);
  }
}

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

export class GuardViews {
  private readonly views: GuardView[] = [];
  private readonly towers: THREE.Group[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly course: Course,
    guards: readonly GuardState[],
  ) {
    for (const g of guards) {
      const view = new GuardView(g.kind, scene);
      view.prev.set(g.pos.x, g.pos.y, g.pos.z);
      this.views.push(view);
      if (g.perch > 0) {
        const t = tower();
        t.position.set(g.pos.x, g.pos.y, g.pos.z);
        t.rotation.y = g.yaw;
        scene.add(t);
        this.towers.push(t);
      }
    }
  }

  dispose(): void {
    for (const v of this.views) {
      this.scene.remove(v.root);
      this.scene.remove(v.hat);
      if (v.laser) {
        this.scene.remove(v.laser);
        v.laser.geometry.dispose();
      }
      v.glint.geometry.dispose();
      v.material.dispose();
    }
    for (const t of this.towers) {
      this.scene.remove(t);
      t.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
    }
  }

  /** Call before each simulation tick so moving guards can be interpolated. */
  capture(guards: readonly GuardState[]): void {
    guards.forEach((g, i) => this.views[i].prev.set(g.pos.x, g.pos.y, g.pos.z));
  }

  /** World position of a guard's muzzle, for tracers. */
  muzzleOf(index: number, out: THREE.Vector3): THREE.Vector3 {
    const v = this.views[index];
    v.root.updateMatrixWorld();
    return out.copy(v.muzzle).applyMatrix4(v.root.matrixWorld);
  }

  onEvent(e: SimEvent, guards: readonly GuardState[]): void {
    if (e.type === 'guardHit' && !e.head) this.views[e.guard].flashT = 0.15;
    if (e.type !== 'guardDown') return;
    const v = this.views[e.guard];
    const g = guards[e.guard];
    const bowled = e.cause === 'bowled';
    const len = Math.hypot(e.dirX, e.dirZ) || 1;
    v.fall = {
      t: 0,
      dirX: e.dirX / len,
      dirZ: e.dirZ / len,
      turns: bowled ? 2 : 1,
      distance: bowled ? 7 : g.perch > 0 ? 3 : 2.2,
      height: bowled ? 2.6 : 1.3,
      baseX: g.pos.x,
      baseZ: g.pos.z,
      hatVel: new THREE.Vector3(e.dirX / len * 2 + (Math.random() - 0.5) * 2, 6 + Math.random() * 2, e.dirZ / len * 2 + (Math.random() - 0.5) * 2),
      hatSpin: (Math.random() - 0.5) * 20,
    };
    v.flashT = 0;
    v.glint.visible = false;
    if (v.laser) v.laser.visible = false;
    // The hat leaves on its own.
    this.scene.attach(v.hat);
  }

  update(guards: readonly GuardState[], alpha: number, dt: number, time: number, targetEye: (player: number) => THREE.Vector3 | null): void {
    guards.forEach((g, i) => {
      const v = this.views[i];
      if (g.mode === 'gone') {
        v.root.visible = false;
        if (v.laser) v.laser.visible = false;
        return;
      }
      if (v.fall) {
        this.pratfall(v, g, dt);
        return;
      }
      v.root.position.set(
        v.prev.x + (g.pos.x - v.prev.x) * alpha,
        v.prev.y + (g.pos.y - v.prev.y) * alpha,
        v.prev.z + (g.pos.z - v.prev.z) * alpha,
      );
      v.root.rotation.y = g.yaw;
      // Ski goons glance back over their shoulder at you.
      v.body.rotation.y = g.kind === 'skier' && g.target >= 0 ? Math.PI * 0.85 : 0;

      v.flashT -= dt;
      v.material.emissive.set(v.flashT > 0 ? RED : '#000000');

      const aiming = g.mode === 'aim';
      v.glint.visible = aiming;
      if (aiming) v.glint.scale.setScalar(0.7 + 0.5 * Math.abs(Math.sin(time * 14)));
      if (v.laser) {
        const eye = aiming ? targetEye(g.target) : null;
        v.laser.visible = !!eye;
        if (eye) {
          this.muzzleOf(i, tmp);
          tmp2.copy(eye).sub(tmp);
          const len = Math.max(0.1, tmp2.length() - 1.2);
          tmp2.setLength(len);
          v.laser.position.copy(tmp).addScaledVector(tmp2, 0.5);
          v.laser.scale.set(1, 1, len);
          v.laser.lookAt(tmp.add(tmp2));
        }
      }
    });
  }

  private pratfall(v: GuardView, g: GuardState, dt: number): void {
    const f = v.fall!;
    f.t += dt;
    const flight = 0.75;
    const k = Math.min(f.t / flight, 1);
    const ease = 1 - (1 - k) * (1 - k);
    const x = f.baseX + f.dirX * f.distance * ease;
    const z = f.baseZ + f.dirZ * f.distance * ease;
    const ground = g.perch > 0 && k < 0.2 ? g.pos.y : this.course.heightAt(x, z);
    const arc = 4 * f.height * k * (1 - k);
    const startY = g.pos.y;
    const y = k < 1 ? startY + (ground - startY) * ease + arc : ground;
    v.root.position.set(x, y + (k >= 1 ? 0.12 : 0), z);
    // Backflip(s), ending flat on the back.
    v.body.rotation.set(-(Math.PI * 2 * f.turns + Math.PI / 2) * ease, 0, 0);
    v.glint.visible = false;

    const hat = v.hat;
    f.hatVel.y -= GRAVITY * dt;
    hat.position.addScaledVector(f.hatVel, dt);
    hat.rotation.x += f.hatSpin * dt;
    hat.rotation.z += f.hatSpin * 0.5 * dt;
    const floor = this.course.heightAt(hat.position.x, hat.position.z) + 0.1;
    if (hat.position.y < floor) {
      hat.position.y = floor;
      f.hatVel.set(0, 0, 0);
      f.hatSpin = 0;
    }
  }
}
