// Player preferences, saved in this browser. Like the lodge save, storage can be missing or
// throw, so every access is guarded and the defaults apply without it.

export interface Settings {
  /** Show the card description bubble when hovering a card in the hand. */
  cardTips: boolean;
  music: boolean;
  sound: boolean;
}

const KEY = 'dbd.settings.v1';
const DEFAULTS: Settings = { cardTips: true, music: true, sound: true };

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    // Defaults below.
  }
  return { ...DEFAULTS };
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Not saved this time.
  }
}
