// Every texture is drawn into a tiny canvas at startup, so the game downloads no image files.

import * as THREE from 'three';

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

function pixelTexture(c: HTMLCanvasElement, repeat: boolean): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Tiny deterministic hash for texture noise. */
function hash(i: number): number {
  let x = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Low-res snow: speckles and faint groomer corduroy, so the ground visibly rushes past. */
export function makeSnowTexture(): THREE.CanvasTexture {
  const size = 64;
  const [c, ctx] = canvas(size, size);
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const n = hash(y * size + x);
      let v = 241 + n * 14;
      if (x % 4 === 0) v -= 7; // corduroy runs downhill
      if (n > 0.97) v -= 20; // occasional darker fleck
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return pixelTexture(c, true);
}

/** A pixel-art pine in black ink with snow on its boughs, on a transparent background. */
export function makePineTexture(): THREE.CanvasTexture {
  const w = 32;
  const h = 64;
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(14, 54, 4, 10);
  const tiers = 5;
  for (let t = 0; t < tiers; t++) {
    const bottom = 56 - t * 10;
    const top = bottom - 18;
    const half = 15 - t * 2.6;
    ctx.fillStyle = t % 2 ? '#151515' : '#1f1f1f';
    ctx.beginPath();
    ctx.moveTo(16, top);
    ctx.lineTo(16 + half, bottom);
    ctx.lineTo(16 - half, bottom);
    ctx.closePath();
    ctx.fill();
    // Snow lying along the bottom edge and the left flank of each tier.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(Math.round(16 - half), bottom - 2, Math.round(half * 1.3), 2);
    ctx.fillRect(Math.round(16 - half * 0.45), Math.round((top + bottom) / 2), 3, 2);
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(15, 1, 2, 3);
  return pixelTexture(c, false);
}

/** Soft dot for falling snow. */
export function makeFlakeTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas(16, 16);
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A banner with chunky lettering, sized to the banner's real proportions. */
export function makeBannerTexture(text: string, widthM: number, heightM: number, bg: string, fg: string): THREE.CanvasTexture {
  const h = 64;
  const w = Math.min(2048, Math.max(64, Math.round((h * widthM) / heightM)));
  const [c, ctx] = canvas(w, h);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.fillRect(0, 4, w, 3);
  ctx.fillRect(0, h - 7, w, 3);
  ctx.font = `900 ${Math.round(h * 0.56)}px "Arial Black", Impact, system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const label = ` ${text} `;
  const textW = ctx.measureText(label).width;
  const copies = Math.max(1, Math.floor(w / (textW * 1.6)));
  for (let i = 0; i < copies; i++) ctx.fillText(label, ((i + 0.5) * w) / copies, h / 2 + 2);
  return pixelTexture(c, false);
}
