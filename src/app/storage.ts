// The lodge is saved in this browser. Storage can be missing or throw (private windows,
// sandboxed frames), so every access is guarded and the game still works without it.

import { DECK_MAX, newProfile, unlockedCards, type Profile } from '../game/lodge';
import { STARTING_TILES } from '../game/mountain';

const KEY = 'dbd.lodge.v1';

/** Loads the save, or starts a fresh one on a mountain grown from `seed`. */
export function loadProfile(seed: string): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<Profile>;
      const p = { ...newProfile(seed), ...saved };
      // Lodges saved before deck choice take every card they've unlocked, up to the limit.
      if (!saved.deck) p.deck = unlockedCards(p).slice(0, DECK_MAX);
      // Saves from before the mountain builder: the trail ratings they'd unlocked become signs.
      if (!saved.tiles) p.tiles = { ...STARTING_TILES, blackRun: saved.rating ?? 0 };
      p.tiles = { ...STARTING_TILES, ...p.tiles };
      // Saves from before named gear start with an empty locker.
      if (!Array.isArray(p.seenItems)) p.seenItems = ['pocketPistol'];
      return p;
    }
  } catch {
    // Fall through to a fresh lodge.
  }
  return newProfile(seed);
}

export function saveProfile(p: Profile): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Not saved this time; the lodge still works for this visit.
  }
}
