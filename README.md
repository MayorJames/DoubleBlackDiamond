# Double Black Diamond

Build the mountain, then ski it. A loop-building spy roguelite in the browser, in black, white and
one red.

Your skier loops a seeded mountain on their own: up the chairlift, down the switchbacks, back to the
lodge. You build the mountain around them with cards, steer their speed, dress them in loot, and
decide at every lap whether to ride again or call it a day. The structure leans heavily on Loop Hero;
scoring comes from Balatro. The full design is in [docs/design.md](docs/design.md).

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open the printed local URL. `npm run build` makes a static build in `dist/` that runs from any static
host. `npm test` runs the simulation tests. A mountain's seed goes in the address as `#SEED`.

## Controls

| Input | Action |
| --- | --- |
| Click a card, then a dotted tile | Place it. Choosing a card pauses time so you can plan. |
| Right-click a card | Burn it for 1 intel. |
| W / S (or the stance buttons) | Faster / slower: snowplow, cruise, tuck. |
| Space | Pause or resume. |
| 1 / 2 / 3 | Game speed. |
| Click gear in your pack | Wear it. Right-click to scrap it. |
| Enter at the lodge | Ride again. |
| Esc / right-click the map | Cancel placing a card. |
| M | Mute. |

Hover anything on the map, a card or a piece of gear to see what it does.

## How it plays

- **Cards build the mountain.** Trail cards go on the run (patrol posts, moguls, kickers, ice), roadside
  cards beside it (cabins, sniper nests, garages, supply caches, safehouses), landscape cards on open snow
  (pines, boulders, peaks, powder). Neighbours combine: a 3x3 of peaks and boulders becomes a Double Black
  Diamond.
- **You can't stop.** Fights happen as you ski past. Tuck to go fast, dodge and build mult with poor aim;
  snowplow to go slow and shoot straight while you're an easy target.
- **Chips × mult.** Kills, the run itself, grazes, air and supplies earn chips; tucking, fast laps, air and
  combos build mult. Each lap cashes in at the lodge with a line-by-line tally.
- **Ride again?** Each lap's new enemies arrive a level higher. Call it a day at the lodge to keep 100%,
  bail out mid-lap for 60%, or wipe out and keep 30%.
- **The Baron.** Every card you place fills the Baron alert. Fill it and the Avalanche Baron chases you in
  his snowcat. Beat him to win the expedition and unlock the next trail rating.
- **The lodge.** Spend cash, intel and scrap on buildings that unlock cards and perks. Your lodge is saved
  in this browser.

## Code layout

```
src/game/     The simulation: no DOM, no rendering, no clocks. Commands are its only input.
  map.ts      The seeded loop (lodge, lift, summit, switchback trail) on an 18x10 grid.
  cards.ts    Card definitions, where each can go, and tile combinations.
  run.ts      One expedition: movement, days and spawns, drive-by combat, loot, chips × mult,
              the lodge decision, the boss and payouts.
  enemies.ts  Guards, snipers, snowmobiles, yetis and the Baron; levels and trail ratings.
  items.ts    Gear, rarities and gadgets.
  stats.ts    Hero stats from gear, the mountain and the lodge; stances.
  lodge.ts    The meta layer: buildings, unlocks, banking a run.
src/render/   Canvas pixel art: hand-authored sprites, the piste-map renderer, effects.
src/ui/       DOM: the expedition HUD and hand, the lodge, the lap tally and results.
src/app/      Wiring, the fixed-timestep loop (with pause and speed), saving the lodge.
src/audio/    Procedural sound (Web Audio, nothing downloaded).
tests/        Loop generation, card rules, determinism and snapshots, stance trade-offs, payouts,
              the boss, the lodge, and sprite sanity.
```

The simulation keeps the multiplayer-ready rules from the original plan: it runs on a fixed 30 Hz tick
with a seeded random generator, only commands enter it, and a run can be saved and restored exactly
(covered by a test).

## Budget

About 32 kB gzipped for the page, script and styles (26 kB of it JavaScript), plus two small Google
Fonts (Silkscreen and VT323). There are no image, model or sound files: sprites are character grids
drawn to canvases at startup, and sounds are synthesized.
