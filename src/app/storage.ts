// The lodge is saved in this browser. Storage can be missing or throw (private windows,
// sandboxed frames), so every access is guarded and the game still works without it.

import { newProfile, type Profile } from '../game/lodge';

const KEY = 'dbd.lodge.v1';

export function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...newProfile(), ...(JSON.parse(raw) as Partial<Profile>) };
  } catch {
    // Fall through to a fresh lodge.
  }
  return newProfile();
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Not saved this time; the lodge still works for this visit.
  }
}
