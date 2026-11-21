// Owns the WebGL renderer and the scene. Rendering only reads the simulation; nothing here
// can change it.

import * as THREE from 'three';
import type { Course } from '../sim/course';
import { buildDecor } from './decor';
import { PlayerView } from './playerView';
import { SnowField } from './snow';
import { buildTerrain } from './terrain';
import { makeFlakeTexture, makePineTexture, makeSnowTexture } from './textures';
import { buildTrees } from './trees';

import { FOG } from './palette';


export class WorldRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  views: PlayerView[] = [];

  private readonly snow: SnowField;
  private readonly snowTexture = makeSnowTexture();
  private readonly pineTexture = makePineTexture();
  private course: Course | null = null;
  private courseGroup: THREE.Group | null = null;
  private renderScale = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.scene.background = new THREE.Color(FOG);
    // The blizzard hides the short draw distance, as fog did on the N64.
    this.scene.fog = new THREE.Fog(FOG, 30, 300);

    // A low side sun so bumps and moguls read through flat shading.
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#858585', 1.8));
    const sun = new THREE.DirectionalLight('#ffffff', 2.3);
    sun.position.set(-1, 0.55, 0.25);
    this.scene.add(sun);

    this.snow = new SnowField(makeFlakeTexture());
    this.scene.add(this.snow.points);
    this.resize();
  }

  get currentCourse(): Course | null {
    return this.course;
  }

  setCourse(course: Course): void {
    if (this.course === course) return;
    if (this.courseGroup) {
      this.scene.remove(this.courseGroup);
      disposeTree(this.courseGroup, [this.snowTexture, this.pineTexture]);
    }
    this.course = course;
    const group = new THREE.Group();
    group.add(buildTerrain(course, this.snowTexture), buildTrees(course, this.pineTexture), buildDecor(course));
    this.courseGroup = group;
    this.scene.add(group);
  }

  /** One view per local player; split screen is just more views. */
  setViewCount(count: number): PlayerView[] {
    if (!this.course) throw new Error('setCourse first');
    for (const v of this.views) v.dispose();
    this.views = [];
    for (let i = 0; i < count; i++) {
      const view = new PlayerView(this.scene, this.course, i);
      view.viewport = { x: i / count, y: 0, w: 1 / count, h: 1 };
      this.views.push(view);
    }
    return this.views;
  }

  setRenderScale(scale: number): void {
    if (scale === this.renderScale) return;
    this.renderScale = scale;
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr * this.renderScale);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
  }

  render(dt: number, time: number): void {
    const r = this.renderer;
    const w = r.domElement.clientWidth || window.innerWidth;
    const h = r.domElement.clientHeight || window.innerHeight;
    if (this.views.length) this.snow.update(dt, time, this.views[0].camera.position);
    r.setScissorTest(this.views.length > 1);
    for (const view of this.views) {
      const vp = view.viewport;
      const x = vp.x * w;
      const y = vp.y * h;
      const vw = vp.w * w;
      const vh = vp.h * h;
      r.setViewport(x, y, vw, vh);
      r.setScissor(x, y, vw, vh);
      const aspect = vw / Math.max(1, vh);
      if (Math.abs(view.camera.aspect - aspect) > 1e-4) {
        view.camera.aspect = aspect;
        view.camera.updateProjectionMatrix();
      }
      r.render(this.scene, view.camera);
    }
  }
}

function disposeTree(root: THREE.Object3D, keep: THREE.Texture[]): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const mats = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
    for (const m of mats) {
      const map = (m as THREE.MeshBasicMaterial).map;
      if (map && !keep.includes(map)) map.dispose();
      m.dispose();
    }
  });
}
