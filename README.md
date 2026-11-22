# Double Black Diamond

Build the mountain, then ski it. A loop-building spy roguelite in the browser, in black, white and
one red.

Your skier skis a seeded mountain on their own: up the chairlift, down the switchbacks, back to the
lodge. You build the mountain around them with cards (including lifts and chutes that branch it into
a network of routes), steer their speed, flip the junctions, dress them in loot, and decide at every
lap whether to ride again or call it a day. The structure leans heavily on Loop Hero;
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
| Click a junction (or R for the next one) | Switch between a route and the trail. |
| Click anywhere with a weather card | Set the weather over the whole mountain. |
| Enter (when a boss arrives) | Close their dossier and carry on. |
| W / S (or the stance buttons) | Faster / slower: snowplow, cruise, tuck. |
| Space | Pause or resume. |
| 1 / 2 / 3 | Game speed. |
| Click gear in your pack | Wear it. Right-click to scrap it. |
| Enter at the lodge | Ride again. |
| Click a card in Your deck (lodge screen) | Take it out of the deck or put it back. |
| Esc / right-click the map | Cancel placing a card. |
| M | Mute the music and sound. |
| Hover or click a building in the lodge scene | See what it does; jump to its card. |

Hover anything on the map, a card or a piece of gear to see what it does.

## How it plays

- **Cards build the mountain.** Trail cards go on the run (patrol posts, moguls, kickers, ice), roadside
  cards beside it (cabins, sniper nests, garages, supply caches, safehouses), landscape cards on open snow
  (pines, boulders, peaks, powder). Neighbours combine: a 3x3 of peaks and boulders becomes a Double Black
  Diamond.
- **Routes.** A Chairlift climbs from the trail back up the mountain: ride it to chain another descent
  into the lap for +1 mult, while every descent brings tougher enemies and the lap only cashes in at
  the lodge. A Chute drops straight down: fast, steep and +mult, skipping everything in between. A red
  rope at each junction closes the way you won't go.
- **You can't stop.** Fights happen as you ski past. Tuck to go fast, dodge and build mult with poor aim;
  snowplow to go slow and shoot straight while you're an easy target.
- **Chips × mult.** Kills, the run itself, grazes, air and supplies earn chips; tucking, fast laps, air and
  combos build mult. Each lap cashes in at the lodge with a line-by-line tally.
- **Ride again?** Each descent's new enemies arrive a level higher. Call it a day at the lodge to keep 100%,
  bail out mid-lap for 60%, or wipe out and keep 30%.
- **Dossier bosses.** Once you've built a chairlift, snipers, snowmobiles and yetis drop intel fragments.
  Three make a dossier: a boss card for the Ice Widow, the Yeti King or Captain Kickback, each with their
  own trick and a one-of-a-kind reward.
- **Weather.** Whiteout and Night cards change the whole mountain for three days.
- **The Baron.** Every card you place fills the Baron alert. Fill it and the Avalanche Baron chases you in
  his snowcat. Beat him to win the expedition and unlock the next trail rating.
- **The lodge.** Spend cash, intel and scrap on buildings that unlock cards and perks, and choose up to 8
  unlocked cards for your deck. Your lodge is saved in this browser.

## Code layout

```
src/game/     The simulation: no DOM, no rendering, no clocks. Commands are its only input.
  map.ts      The mountain as a graph on an 18x10 grid: the seeded loop (lodge, lift, summit,
              switchback trail) plus the lifts and chutes you build, and their junctions.
  cards.ts    Card definitions, where each can go, and tile combinations.
  run.ts      One expedition: movement along the graph, junctions and chained descents, days and
              spawns, drive-by combat, loot, chips × mult, the lodge decision, the boss and payouts.
  enemies.ts  Guards, snipers, snowmobiles, yetis and the Baron; levels and trail ratings.
  items.ts    Gear, rarities and gadgets.
  stats.ts    Hero stats from gear, the mountain and the lodge; stances.
  lodge.ts    The meta layer: buildings, unlocks, deck choice, banking a run.
src/render/   The low-res run: hand-authored 16px sprites, the piste-map renderer, weather, effects.
  art/        The detailed pixel art: a drawing toolkit (dithering, shapes), scenery, card
              illustrations, the animated lodge panorama, and portraits.
src/audio/    Procedural sound effects and the surf-spy soundtrack (Web Audio, nothing downloaded).
gallery.html  A developer page (npm run dev, then /gallery.html) showing every illustration.
src/ui/       DOM: the expedition HUD and hand, the lodge, the lap tally and results.
src/app/      Wiring, the fixed-timestep loop (with pause and speed), saving the lodge.
tests/        Loop generation, card rules, routes and junctions, chained descents, determinism and
              snapshots (with routes), stance trade-offs, payouts, the boss, the lodge and deck, and
              sprite sanity.
```

The simulation keeps the multiplayer-ready rules from the original plan: it runs on a fixed 30 Hz tick
with a seeded random generator, only commands enter it, and a run can be saved and restored exactly
(covered by a test).

## Budget

About 51 kB gzipped for the page, script and styles (44 kB of it JavaScript), plus two small Google
Fonts (Silkscreen and VT323). There are no image, model or sound files: sprites are character grids,
illustrations are drawn by code at startup, and the sound effects and music are synthesized.
