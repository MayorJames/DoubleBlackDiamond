// Per-player client settings (not part of the simulation) and tuning overrides, kept in
// localStorage. Storage can be missing or throw (private windows, sandboxed frames), so every
// access is guarded and the game works without it.

import { DEFAULT_TUNING, type Tuning } from '../sim/tuning';

export interface Settings {
  /** Radians of turn per pixel of mouse movement. */
  sensitivity: number;
  invertY: boolean;
  /** Keyboard steering speed, rad/s. */
  keyTurnRate: number;
  /** Vertical field of view at rest, degrees. Speed widens it. */
  fov: number;
  /** Camera shake multiplier. */
  shake: number;
  /** Fraction of native resolution to render at. Below 1 gives a chunky pixel look. */
  renderScale: number;
  volume: number;
}

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  sensitivity: 0.0022,
  invertY: false,
  keyTurnRate: 1.9,
  fov: 70,
  shake: 1,
  renderScale: 1,
  volume: 0.7,
});

export const SETTING_RANGES: Record<Exclude<keyof Settings, 'invertY'>, [number, number, number]> = {
  sensitivity: [0.0005, 0.006, 0.0001],
  keyTurnRate: [0.5, 4, 0.1],
  fov: [50, 100, 1],
  shake: [0, 2, 0.05],
  renderScale: [0.25, 1, 0.05],
  volume: [0, 1, 0.05],
};

const SETTINGS_KEY = 'dbd.settings.v1';
const TUNING_KEY = 'dbd.tuning.v1';

function read<T extends object>(key: string, defaults: Readonly<T>): T {
  const out = { ...defaults } as T;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return out;
    const saved = JSON.parse(raw) as Record<string, unknown>;
    for (const k of Object.keys(defaults) as (keyof T)[]) {
      const v = saved[k as string];
      if (typeof v === typeof defaults[k]) out[k] = v as T[keyof T];
    }
  } catch {
    // Storage unavailable or corrupt: defaults it is.
  }
  return out;
}

function write(key: string, value: object): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Not persisted this session; nothing else depends on it.
  }
}

export const loadSettings = (): Settings => read(SETTINGS_KEY, DEFAULT_SETTINGS);
export const saveSettings = (s: Settings): void => write(SETTINGS_KEY, s);
export const loadTuning = (): Tuning => read(TUNING_KEY, DEFAULT_TUNING);
export const saveTuning = (t: Tuning): void => write(TUNING_KEY, t);

const BANK_KEY = 'dbd.bank.v1';

/** Cash banked across runs on this browser, until the lodge gives it somewhere to go. */
export function loadBank(): number {
  try {
    const n = Number(localStorage.getItem(BANK_KEY));
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveBank(n: number): void {
  try {
    localStorage.setItem(BANK_KEY, String(n));
  } catch {
    // Not persisted; the payout still shows.
  }
}
