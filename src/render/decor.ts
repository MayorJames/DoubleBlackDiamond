// Readability props: trail-edge poles, kicker flags and lip lines, the start and base camp
// arches, and the lodge. All flat-coloured boxes plus two text banners.

import * as THREE from 'three';
import type { Course } from '../sim/course';
import { buildSnowStrip } from './terrain';
import { INK, PAPER, RED } from './palette';
import { makeBannerTexture } from './textures';

function box(w: number, h: number, d: number, color: THREE.ColorRepresentation): THREE.Mesh {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color, flatShading: true }));
}

function arch(course: Course, d: number, halfSpan: number, text: string, bg: string, fg: string): THREE.Group {
  const g = new THREE.Group();
  const cx = course.centerX(d);
  const postH = 5.5;
  for (const side of [-1, 1]) {
    const x = cx + side * halfSpan;
    const post = box(0.5, postH, 0.5, bg);
    post.position.set(x, course.heightAt(x, -d) + postH / 2 - 0.2, -d);
    g.add(post);
  }
  const yTop = Math.max(course.heightAt(cx - halfSpan, -d), course.heightAt(cx + halfSpan, -d)) + postH - 0.2;
  const bannerH = 1.6;
  const width = halfSpan * 2 + 0.5;
  const banner = new THREE.Mesh(
    new THREE.PlaneGeometry(width, bannerH),
    new THREE.MeshBasicMaterial({ map: makeBannerTexture(text, width, bannerH, bg, fg), side: THREE.DoubleSide }),
  );
  banner.position.set(cx, yTop - bannerH / 2, -d);
  g.add(banner);
  return g;
}

function lodge(course: Course): THREE.Group {
  const g = new THREE.Group();
  const d = course.endD + 2;
  const x = course.centerX(d);
  const y = course.heightAt(x, -d);
  const body = box(22, 7, 12, INK);
  body.position.set(0, 3.5, 0);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(15, 6, 4, 1),
    new THREE.MeshLambertMaterial({ color: RED, flatShading: true }),
  );
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1, 1, 0.62);
  roof.position.set(0, 10, 0);
  const snowCap = new THREE.Mesh(
    new THREE.ConeGeometry(15.4, 1.2, 4, 1, true),
    new THREE.MeshLambertMaterial({ color: PAPER, flatShading: true, side: THREE.DoubleSide }),
  );
  snowCap.rotation.y = Math.PI / 4;
  snowCap.scale.set(1, 1, 0.62);
  snowCap.position.set(0, 7.4, 0);
  g.add(body, roof, snowCap);
  for (const wx of [-7, -2.5, 2.5, 7]) {
    const win = box(2.2, 1.8, 0.2, PAPER);
    win.position.set(wx, 4, 6.05);
    g.add(win);
  }
  const door = box(2.4, 3.4, 0.2, RED);
  door.position.set(0, 1.7, 6.05);
  g.add(door);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 1.6),
    new THREE.MeshBasicMaterial({ map: makeBannerTexture('LODGE', 9, 1.6, PAPER, INK) }),
  );
  sign.position.set(0, 6.3, 6.2);
  g.add(sign);
  g.position.set(x, y - 0.5, -d);
  return g;
}

export function buildDecor(course: Course): THREE.Group {
  const group = new THREE.Group();
  group.name = 'decor';

  // Orange poles marking both edges of the trail.
  const poleGeo = new THREE.BoxGeometry(0.12, 1.8, 0.12);
  poleGeo.translate(0, 0.9, 0);
  const spacing = 16;
  const count = Math.floor(course.finishD / spacing) * 2;
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: INK }), count);
  const m = new THREE.Matrix4();
  let i = 0;
  for (let d = spacing; i < count; d += spacing) {
    for (const side of [-1, 1]) {
      if (i >= count) break;
      const x = course.centerX(d) + side * (course.halfWidth(d) + 1.2);
      m.makeTranslation(x, course.heightAt(x, -d) - 0.1, -d);
      poles.setMatrixAt(i++, m);
    }
  }
  poles.computeBoundingSphere();
  group.add(poles);

  // Kickers: a blue line on the lip and flags either side, so you can read the jump at speed.
  for (const k of course.kickers) {
    const lip = k.d + k.length;
    group.add(buildSnowStrip(course, lip - 0.45, lip - 0.05, k.u - k.width / 2 + 0.4, k.u + k.width / 2 - 0.4, RED));
    for (const side of [-1, 1]) {
      const d = lip - 1;
      const x = course.centerX(d) + k.u + side * (k.width / 2 + 0.8);
      const y = course.heightAt(x, -d);
      const pole = box(0.1, 2.4, 0.1, INK);
      pole.position.set(x, y + 1.1, -d);
      const flag = box(0.04, 0.6, 0.9, RED);
      flag.position.set(x, y + 2.0, -d + 0.45);
      group.add(pole, flag);
    }
  }

  group.add(arch(course, 24, 7, 'DROP IN', RED, PAPER));
  const finishSpan = course.halfWidth(course.finishD) - 1;
  group.add(arch(course, course.finishD, finishSpan, 'BASE CAMP', INK, PAPER));
  group.add(buildSnowStrip(course, course.finishD - 0.6, course.finishD + 0.6, -finishSpan, finishSpan, RED));
  group.add(lodge(course));

  group.traverse((o) => {
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });
  return group;
}
