// Small math helpers for the simulation. Plain objects only, so state stays JSON-serialisable.

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const vec3 = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const copyVec = (out: Vec3, a: Vec3): Vec3 => {
  out.x = a.x;
  out.y = a.y;
  out.z = a.z;
  return out;
};

export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const length = (a: Vec3): number => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);

export const cross = (a: Vec3, b: Vec3, out: Vec3 = vec3()): Vec3 => {
  const x = a.y * b.z - a.z * b.y;
  const y = a.z * b.x - a.x * b.z;
  const z = a.x * b.y - a.y * b.x;
  out.x = x;
  out.y = y;
  out.z = z;
  return out;
};

export const normalize = (a: Vec3): Vec3 => {
  const l = length(a);
  if (l > 1e-9) {
    a.x /= l;
    a.y /= l;
    a.z /= l;
  }
  return a;
};

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Move `v` toward `target` by at most `maxDelta`. */
export const approach = (v: number, target: number, maxDelta: number): number =>
  v < target ? Math.min(v + maxDelta, target) : Math.max(v - maxDelta, target);

/** Wrap an angle to (-PI, PI]. */
export const wrapAngle = (a: number): number => {
  const TAU = Math.PI * 2;
  a = a % TAU;
  if (a > Math.PI) a -= TAU;
  else if (a <= -Math.PI) a += TAU;
  return a;
};

/** Rotate angle `a` toward `target` along the shortest arc by at most `maxDelta`. */
export const approachAngle = (a: number, target: number, maxDelta: number): number => {
  const diff = wrapAngle(target - a);
  if (Math.abs(diff) <= maxDelta) return target;
  return a + Math.sign(diff) * maxDelta;
};

/** Interpolate between two angles along the shortest arc. */
export const lerpAngle = (a: number, b: number, t: number): number => a + wrapAngle(b - a) * t;

/**
 * Yaw convention used everywhere: yaw 0 faces downhill (-Z), positive yaw turns left
 * (counter-clockwise seen from above), matching a Three.js camera's rotation.y.
 */
export const forwardFromYaw = (yaw: number, out: Vec3 = vec3()): Vec3 => {
  out.x = -Math.sin(yaw);
  out.y = 0;
  out.z = -Math.cos(yaw);
  return out;
};
