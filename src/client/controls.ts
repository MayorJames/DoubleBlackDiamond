// Keyboard and mouse for one local player, turned into an InputFrame once per tick.
//
// Mouse look is applied the moment the event arrives and the camera reads it straight from
// here every frame, so turning your head never waits for a simulation tick.
//
// The mouse steers: the skis chase where you look. Hold right mouse (or Q) to free-look:
// the skis hold their line, the mouse moves only your head (and A/D still steer), and on
// release the view swings back to your skis, GoldenEye-style.

import { DEG } from '../sim/constants';
import { clamp, wrapAngle } from '../sim/math';
import type { InputFrame } from '../sim/player';
import type { Settings } from './settings';

const PITCH_LIMIT = 85 * DEG;
/** How far beyond the skis' traverse limit you can steer your view before it stops. */
const LOOK_PAST_TRAVERSE = 35 * DEG;
const FREELOOK_LIMIT = 170 * DEG;
const RECENTER_TIME = 0.06;
/**
 * Browsers sometimes report the whole cursor jump as one movement right after pointer lock
 * engages (and occasionally spike later). Ignore those instead of spinning the player around.
 */
const LOCK_SETTLE_MS = 120;
const MAX_EVENT_MOVE = 400;

const TUCK_KEYS = ['KeyW', 'ArrowUp', 'ShiftLeft', 'ShiftRight'];
const PLOW_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];
const JUMP_KEYS = ['Space'];
const FREELOOK_KEYS = ['KeyQ'];
const GAME_KEYS = new Set([...TUCK_KEYS, ...PLOW_KEYS, ...LEFT_KEYS, ...RIGHT_KEYS, ...JUMP_KEYS, ...FREELOOK_KEYS]);

export class LocalControls {
  /** World yaw the skis should point. */
  steerYaw = 0;
  /** Head turn on top of the steer yaw (free-look). */
  lookOffset = 0;
  pitch = -0.18;
  /** True when the browser refused pointer lock: hold the left button and drag to look. */
  dragFallback = false;
  enabled = false;

  private readonly keys = new Set<string>();
  private jumpLatch = false;
  private freelookMouse = false;
  private lockedAt = 0;
  private readonly abort = new AbortController();

  constructor(
    private readonly target: HTMLElement,
    private readonly settings: Settings,
  ) {
    const opts = { signal: this.abort.signal };
    window.addEventListener('keydown', this.onKeyDown, opts);
    window.addEventListener('keyup', this.onKeyUp, opts);
    window.addEventListener('blur', () => this.keys.clear(), opts);
    document.addEventListener('mousemove', this.onMouseMove, opts);
    target.addEventListener('mousedown', this.onMouseDown, opts);
    window.addEventListener('mouseup', this.onMouseUp, opts);
    target.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
    document.addEventListener(
      'pointerlockchange',
      () => {
        if (document.pointerLockElement === target) this.lockedAt = performance.now();
      },
      opts,
    );
  }

  dispose(): void {
    this.abort.abort();
  }

  get lookYaw(): number {
    return this.steerYaw + this.lookOffset;
  }

  get freelook(): boolean {
    return this.freelookMouse || this.anyKey(FREELOOK_KEYS);
  }

  reset(yaw: number): void {
    this.steerYaw = yaw;
    this.lookOffset = 0;
    this.pitch = -0.18;
    this.jumpLatch = false;
  }

  /** Per rendered frame: keyboard steering, the free-look swing-back and the steering limit. */
  update(dt: number, trackYaw: number, maxTraverse: number): void {
    if (this.enabled) {
      const turn = (this.anyKey(LEFT_KEYS) ? 1 : 0) - (this.anyKey(RIGHT_KEYS) ? 1 : 0);
      this.steerYaw += turn * this.settings.keyTurnRate * dt;
    }
    if (!this.freelook) this.lookOffset *= Math.exp(-dt / RECENTER_TIME);
    this.lookOffset = clamp(this.lookOffset, -FREELOOK_LIMIT, FREELOOK_LIMIT);

    // Your skis can't point uphill, so steering stops a little past the traverse limit.
    const limit = maxTraverse + LOOK_PAST_TRAVERSE;
    const rel = wrapAngle(this.steerYaw - trackYaw);
    if (Math.abs(rel) > limit) this.steerYaw = trackYaw + Math.sign(rel) * limit;
  }

  /** Called once per simulation tick. */
  sample(): InputFrame {
    const jump = this.enabled && (this.anyKey(JUMP_KEYS) || this.jumpLatch);
    this.jumpLatch = false;
    const plow = this.enabled && this.anyKey(PLOW_KEYS);
    return {
      steerYaw: this.steerYaw,
      aimYaw: this.lookYaw,
      aimPitch: this.pitch,
      tuck: this.enabled && !plow && this.anyKey(TUCK_KEYS),
      plow,
      jump,
    };
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  private anyKey(codes: readonly string[]): boolean {
    for (const c of codes) if (this.keys.has(c)) return true;
    return false;
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement) return;
    if (GAME_KEYS.has(e.code)) e.preventDefault();
    if (JUMP_KEYS.includes(e.code) && !e.repeat) this.jumpLatch = true;
    this.keys.add(e.code);
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private readonly onMouseDown = (e: MouseEvent) => {
    if (e.button === 2) this.freelookMouse = true;
  };

  private readonly onMouseUp = (e: MouseEvent) => {
    if (e.button === 2) this.freelookMouse = false;
  };

  private readonly onMouseMove = (e: MouseEvent) => {
    if (!this.enabled) return;
    const locked = document.pointerLockElement === this.target;
    if (!locked && !(this.dragFallback && e.buttons & 1)) return;
    if (locked && performance.now() - this.lockedAt < LOCK_SETTLE_MS) return;
    if (Math.abs(e.movementX) > MAX_EVENT_MOVE || Math.abs(e.movementY) > MAX_EVENT_MOVE) return;
    const s = this.settings.sensitivity;
    const dx = e.movementX * s;
    const dy = e.movementY * s * (this.settings.invertY ? -1 : 1);
    if (this.freelook) this.lookOffset -= dx;
    else this.steerYaw -= dx;
    this.pitch = clamp(this.pitch - dy, -PITCH_LIMIT, PITCH_LIMIT);
  };
}
