import { expect, it } from 'vitest';
import { PIXELS, SPRITES } from '../src/render/sprites';

it('every sprite is a clean rectangle of known colours', () => {
  for (const [name, rows] of Object.entries(SPRITES)) {
    const width = rows[0].length;
    for (const row of rows) {
      expect({ name, width: row.length }).toEqual({ name, width });
      for (const ch of row) expect(ch === '.' || ch in PIXELS, `${name} uses ${ch}`).toBe(true);
    }
  }
});
