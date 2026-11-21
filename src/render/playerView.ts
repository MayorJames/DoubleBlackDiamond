// A player's eyes: their camera and viewport, their skis, and the camera juice (speed FOV,
// carve lean, landing dip, chatter, and the yard-sale tumble). Cameras belong to players,
// so split screen is just more PlayerViews with smaller viewports.

import * as THREE from 'three';
import type { Course } from '../sim/course';
import { clamp, lerp, length, smoothstep, type Vec3 } from '../sim/math';
import { eyeHeight, eyeLean, LEG_REACH, type PlayerState, type SimEvent } from '../sim/player';
import type { Settings } from '../client/settings';
import { INK, INK_SOFT, PAPER, RED } from './palette';

export interface Viewport {
  /** Normalised 0..1 rectangle, origin bottom-left (WebGL convention). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ViewFrame {
  player: PlayerState;
  /** Interpolated between the last two ticks. */
  pos: Vec3;
  heading: number;
  /** Straight from the mouse, not the simulation, so looking never lags. */
  lookYaw: number;
  lookPitch: number;
  dt: number;
  time: number;
  settings: Settings;
}

interface Loose {
  obj: THREE.Object3D;
  vel: THREE.Vector3;
  spin: THREE.Vector3;
}

const SKI_RED = RED;
/** Where the gun sits when firing from the hip, and when aiming down the sights. */
const GUN_HIP = new THREE.Vector3(0.2, -0.2, -0.56);
const GUN_AIM = new THREE.Vector3(0, -0.105, -0.52);
const GUN_SCALE = 0.72;
/** How far holding aim zooms the view in. */
const AIM_ZOOM = 0.72;
const GRAVITY = 11.5;
/** Skis are drawn a little ahead of the feet so the tips poke into view, as hands do in shooters. */
const SKI_FORWARD = 0.85;

function makeSki(): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: SKI_RED, flatShading: true });
  const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 1.75), mat);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.26), mat);
  tip.position.set(0, 0.06, -0.98);
  tip.rotation.x = 0.5;
  const binding = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.08, 0.32),
    new THREE.MeshLambertMaterial({ color: INK, flatShading: true }),
  );
  binding.position.set(0, 0.05, 0.05);
  g.add(board, tip, binding);
  return g;
}

function makeGoggles(): THREE.Group {
  const g = new THREE.Group();
  const strap = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.03), new THREE.MeshLambertMaterial({ color: INK }));
  const lens = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.04), new THREE.MeshLambertMaterial({ color: RED, emissive: '#500000' }));
  lens.position.z = 0.03;
  g.add(strap, lens);
  return g;
}

function makePole(): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.2, 0.03), new THREE.MeshLambertMaterial({ color: INK }));
}

/** A silenced pocket pistol in a black glove, with a red dot sight. Built from boxes. */
function makeGun(): { gun: THREE.Group; flash: THREE.Mesh } {
  const gun = new THREE.Group();
  const ink = new THREE.MeshLambertMaterial({ color: INK, flatShading: true });
  const soft = new THREE.MeshLambertMaterial({ color: INK_SOFT, flatShading: true });
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.26), ink);
  slide.position.set(0, 0.035, -0.02);
  const silencer = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.2, 6), soft);
  silencer.rotation.x = Math.PI / 2;
  silencer.position.set(0, 0.04, -0.24);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.13, 0.07), ink);
  grip.position.set(0, -0.05, 0.07);
  grip.rotation.x = -0.25;
  const glove = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.11), soft);
  glove.position.set(0.005, -0.06, 0.09);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.02, 0.03), new THREE.MeshBasicMaterial({ color: RED }));
  sight.position.set(0, 0.08, 0.04);
  const flash = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.07, 0),
    new THREE.MeshBasicMaterial({ color: PAPER, transparent: true, opacity: 0.95, fog: false }),
  );
  flash.position.set(0, 0.04, -0.37);
  flash.scale.set(1, 1, 2.2);
  flash.visible = false;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), new THREE.MeshBasicMaterial({ color: RED, fog: false }));
  flash.add(core);
  gun.add(slide, silencer, grip, glove, sight, flash);
  return { gun, flash };
}

const tmpFwd = new THREE.Vector3();
const tmpUp = new THREE.Vector3();
const tmpRight = new THREE.Vector3();
const tmpBack = new THREE.Vector3();
const basis = new THREE.Matrix4();

export class PlayerView {
  readonly camera = new THREE.PerspectiveCamera(62, 1, 0.05, 340);
  viewport: Viewport = { x: 0, y: 0, w: 1, h: 1 };

  private readonly skis = new THREE.Group();
  private readonly skiL = makeSki();
  private readonly skiR = makeSki();
  private loose: Loose[] = [];
  private fov = 62;
  private roll = 0;
  private dip = 0;
  private dipVel = 0;
  private kick = 0;
  private crashT = -1;
  private spinDir = 1;
  private readonly gun: THREE.Group;
  private readonly flash: THREE.Mesh;
  private recoil = 0;
  private flashT = 0;
  private aimBlend = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly course: Course,
    readonly playerIndex: number,
  ) {
    this.camera.rotation.order = 'YXZ';
    this.skis.add(this.skiL, this.skiR);
    scene.add(this.skis);
    const { gun, flash } = makeGun();
    this.gun = gun;
    this.flash = flash;
    this.camera.add(gun);
    scene.add(this.camera); // so the gun, a child of the camera, is drawn
  }

  dispose(): void {
    this.scene.remove(this.skis);
    this.scene.remove(this.camera);
    for (const l of this.loose) this.scene.remove(l.obj);
    this.loose = [];
  }

  onEvent(e: SimEvent, player: PlayerState): void {
    if (!('player' in e) || e.player !== this.playerIndex) return;
    switch (e.type) {
      case 'land':
        this.dipVel -= Math.min(0.6 + e.impact * 0.28, 3.2);
        this.kick = Math.max(this.kick, Math.min(e.impact * 0.01, 0.1));
        break;
      case 'impact':
        this.dipVel -= Math.min(e.impact * 0.12, 1.5);
        this.kick = Math.max(this.kick, Math.min(e.impact * 0.008, 0.08));
        break;
      case 'treeBump':
        this.kick = Math.max(this.kick, 0.06);
        break;
      case 'shot':
        this.recoil = 1;
        this.flashT = 0.05;
        break;
      case 'playerHit':
        this.kick = Math.max(this.kick, 0.12);
        this.dipVel -= 1.2;
        break;
      case 'crash':
        this.yardSale(player);
        break;
    }
  }

  update(f: ViewFrame): void {
    const { player: p, pos, dt, settings } = f;
    const speed = length(p.vel);
    const crashed = this.crashT >= 0;
    const groundY = this.course.heightAt(pos.x, pos.z);
    const gap = Math.max(0, pos.y - groundY);

    // Landing dip: a damped spring on the eye height.
    this.dipVel += (-140 * this.dip - 16 * this.dipVel) * dt;
    this.dip += this.dipVel * dt;
    this.kick *= Math.exp(-dt * 7);

    // Speed widens the view; the tuck adds a touch more; holding aim zooms in.
    this.aimBlend += (p.aiming - this.aimBlend) * (1 - Math.exp(-dt * 18));
    const fovTarget = (settings.fov + 18 * smoothstep(10, 45, speed) + 5 * p.tuck) * lerp(1, AIM_ZOOM, this.aimBlend);
    this.fov += (fovTarget - this.fov) * (1 - Math.exp(-dt * (this.aimBlend > 0.05 ? 12 : 3)));
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    // Bank into carves.
    const rollTarget = crashed ? 0 : clamp(-p.lean * 0.07, -0.13, 0.13);
    this.roll += (rollTarget - this.roll) * (1 - Math.exp(-dt * 6));

    // Snow chatter grows with the square of speed; airborne is smooth.
    const onSnow = gap < LEG_REACH + 0.05;
    const chatter = settings.shake * (onSnow ? 0.003 + 0.03 * (speed / 45) ** 2 : 0.001);
    const t = f.time;
    const shakeY = chatter * (0.6 * Math.sin(t * 31) + 0.4 * Math.sin(t * 47.3)) + this.kick * settings.shake * Math.sin(t * 41);
    const shakeP = chatter * 0.5 * (Math.sin(t * 27.1) + 0.5 * Math.sin(t * 53.7));
    const shakeYaw = chatter * 0.3 * Math.sin(t * 23.3);

    let eyeH = eyeHeight(p);
    const leanFwd = eyeLean(p);
    let yaw = f.lookYaw + shakeYaw;
    let pitch = f.lookPitch + shakeP;
    let roll = this.roll;

    if (crashed) {
      this.crashT += dt;
      const ct = this.crashT;
      const settle = 1 - Math.exp(-ct * 3.2);
      eyeH = lerp(eyeH, 0.35, Math.min(1, ct * 2.5));
      roll = this.spinDir * settle * (Math.PI * 2 + 1.25);
      pitch = lerp(f.lookPitch, -0.35, settle) + Math.sin(ct * 9) * Math.exp(-ct * 2.2) * 0.7;
      yaw = f.lookYaw + this.spinDir * settle * 0.9;
    }

    tmpFwd.set(-Math.sin(f.heading), 0, -Math.cos(f.heading));
    this.camera.position.set(
      pos.x + tmpFwd.x * leanFwd,
      pos.y + eyeH + this.dip * settings.shake + shakeY,
      pos.z + tmpFwd.z * leanFwd,
    );
    this.camera.rotation.set(pitch, yaw, roll);

    if (!crashed) this.placeSkis(f, gap);
    this.placeGun(p, dt, crashed);
    this.updateLoose(dt);
  }

  /** Where shots leave the gun, in world space (for tracers). */
  muzzleWorld(out: THREE.Vector3): THREE.Vector3 {
    this.camera.updateMatrixWorld();
    return this.flash.getWorldPosition(out);
  }

  private placeGun(p: PlayerState, dt: number, crashed: boolean): void {
    this.gun.visible = !crashed;
    if (crashed) return;
    this.recoil *= Math.exp(-dt * 14);
    this.flashT -= dt;
    this.flash.visible = this.flashT > 0;
    if (this.flash.visible) this.flash.rotation.z = Math.random() * Math.PI;
    const reloading = p.weapon.reload > 0 ? Math.sin(Math.min(1, 1 - p.weapon.reload / 1.3) * Math.PI) : 0;
    this.gun.position.lerpVectors(GUN_HIP, GUN_AIM, this.aimBlend);
    // Keep the gun the same size on screen when the view zooms or widens.
    const fovScale = Math.tan((this.camera.fov * Math.PI) / 360) / Math.tan((70 * Math.PI) / 360);
    this.gun.position.multiplyScalar(fovScale);
    this.gun.scale.setScalar(GUN_SCALE * fovScale);
    this.gun.position.z += this.recoil * 0.07;
    this.gun.position.y -= reloading * 0.18;
    // The gun sways with the same wobble that throws your shots off.
    this.gun.rotation.set(this.recoil * 0.3 - reloading * 0.9 + p.wobblePitch * 2, p.wobbleYaw * 2, reloading * 0.5);
  }

  private placeSkis(f: ViewFrame, gap: number): void {
    const { pos, player: p } = f;
    const n = this.course.normalAt(pos.x, pos.z);
    tmpUp.set(n.x, n.y, n.z);
    tmpFwd.set(-Math.sin(f.heading), 0, -Math.cos(f.heading));
    tmpFwd.addScaledVector(tmpUp, -tmpFwd.dot(tmpUp)).normalize();
    tmpBack.copy(tmpFwd).negate();
    tmpRight.crossVectors(tmpUp, tmpBack);
    basis.makeBasis(tmpRight, tmpUp, tmpBack);
    this.skis.quaternion.setFromRotationMatrix(basis);
    const footY = pos.y - Math.min(gap, LEG_REACH);
    this.skis.position.set(pos.x + tmpFwd.x * SKI_FORWARD, footY + 0.02, pos.z + tmpFwd.z * SKI_FORWARD);

    // Parallel when cruising or tucked, a wedge when snowplowing.
    const sep = lerp(lerp(0.28, 0.22, p.tuck), 0.46, p.plow);
    const wedge = p.plow * 0.3;
    this.skiL.position.set(-sep / 2, 0, 0);
    this.skiR.position.set(sep / 2, 0, 0);
    this.skiL.rotation.set(0, -wedge, 0);
    this.skiR.rotation.set(0, wedge, 0);
  }

  private yardSale(p: PlayerState): void {
    if (this.crashT >= 0) return;
    this.crashT = 0;
    this.spinDir = Math.random() < 0.5 ? -1 : 1;
    const base = new THREE.Vector3(p.vel.x, p.vel.y, p.vel.z).multiplyScalar(0.55);
    const fling = (obj: THREE.Object3D, up: number) => {
      this.scene.attach(obj);
      this.loose.push({
        obj,
        vel: base.clone().add(new THREE.Vector3((Math.random() - 0.5) * 7, up + Math.random() * 3, (Math.random() - 0.5) * 7)),
        spin: new THREE.Vector3((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18),
      });
    };
    this.skis.updateMatrixWorld(true);
    fling(this.skiL, 5);
    fling(this.skiR, 6);
    // Goggles and poles leave from where your head and hands were.
    const goggles = makeGoggles();
    goggles.position.copy(this.camera.position);
    this.scene.add(goggles);
    fling(goggles, 4);
    for (const side of [-1, 1]) {
      const pole = makePole();
      pole.position.copy(this.camera.position).add(new THREE.Vector3(side * 0.4, -0.6, 0));
      this.scene.add(pole);
      fling(pole, 3);
    }
  }

  private updateLoose(dt: number): void {
    for (const l of this.loose) {
      l.vel.y -= GRAVITY * dt;
      l.obj.position.addScaledVector(l.vel, dt);
      l.obj.rotation.x += l.spin.x * dt;
      l.obj.rotation.y += l.spin.y * dt;
      l.obj.rotation.z += l.spin.z * dt;
      const floor = this.course.heightAt(l.obj.position.x, l.obj.position.z) + 0.05;
      if (l.obj.position.y < floor) {
        l.obj.position.y = floor;
        l.vel.y = Math.abs(l.vel.y) * 0.3;
        l.vel.x *= 0.6;
        l.vel.z *= 0.6;
        l.spin.multiplyScalar(0.55);
      }
    }
  }
}
