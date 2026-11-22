# Double Black Diamond

Build the mountain, then ski it. A loop-building spy roguelite in the browser, in black, white and
one red.

Your skier skis your mountain on their own: up the chairlift, down the trail, back to the lodge,
lap after lap. Between expeditions you build that mountain with course tiles: paths that fork and
double back, lifts, chutes, jumps and checkpoints. On the slopes you build around it with cards
bought from a shop with the points you earn, steer the skier's speed, flip the junctions, dress them
in named gear, and decide at every lap whether to ride again or call it a day. The structure leans
heavily on Loop Hero; scoring comes from Balatro. The full design is in
[docs/design.md](docs/design.md).

## Run it

```bash
npm install
```

```bash
npm run dev
```

Open the printed local URL. `npm run build` makes a static build in `dist/` that runs from any static
host. `npm test` runs the simulation tests. A new save grows its mountain from the seed in the address
(`#SEED`), or a random one.

## The pages

- **Start:** the title over your town, which grows as you build it and echoes the last expedition's
  weather. Play, How to play, Settings (music, sound, card tips).
- **How to play:** nine illustrated panels, one per mechanic.
- **Play**, with three tabs:
  - **Ski town:** put up buildings, choose your deck, buy course tiles, and see your trophies and
    gear locker.
  - **The mountain:** build your home mountain with course tiles, read its difficulty, and head out.
  - **Ski loops:** the expedition itself. Leaving this tab mid-run pauses the slopes.

## Controls

| Input | Action |
| --- | --- |
| Click a card, then a dotted tile | Place it. Picking up a card pauses the slopes; a hint along the top says where it goes. |
| Right-click a card | Burn it for 1 intel. |
| Click a shop offer | Buy it with points. The shop rerolls; Reroll buys new offers. |
| Click a junction (or R for the next one) | Switch between a route and the trail. |
| Click anywhere with a weather or action card | Weather covers the whole mountain; actions happen at once. |
| W / S (or the stance buttons) | Faster / slower: snowplow, cruise, tuck. |
| Space | Pause or resume. |
| 1 / 2 / 3 | Game speed. |
| Click gear in your pack | Wear it. Right-click to scrap it. |
| Enter at the lodge | Ride again. |
| Esc / right-click the map | Cancel placing a card (or a half-laid path in the mountain builder). |
| M | Sound on or off. |
| Card tips button (by the hand) | Turn the hover descriptions off or on. |
| Mountain builder: pick a tile, click the map | Lay it. Paths: click a trail tile, then open snow, then trail to join. Click a junction to set how it starts. |

Hover anything on the map, a card, a shop offer or a piece of gear to see what it does.

## How it plays

- **Your mountain.** Each save has a home mountain: the seed lays the first loop, and you add to it
  between expeditions. Trail tiles lay paths in any shape over open snow, joining the trail further
  down for a detour or back up the mountain for a loop-back. Lifts, chutes, jumps, slalom gates,
  tunnels, checkpoints and black run signs go on it too. Difficulty comes from what's on it, and
  sets how tough enemies are, how much they pay and how soon the Baron comes.
- **Enemies every descent.** Each lap brings its own wave, from the first lap on, and every enemy card
  you've placed rolls how many to send and where. Seven kinds come from cards: guards, snipers,
  snowmobiles, yetis, sappers who mine the trail, turncoat medics who heal the others, and hounds.
- **You can't stop.** Fights happen as you ski past. Tuck to go fast, dodge and build mult with poor
  aim; snowplow to go slow and shoot straight while you're an easy target.
- **Points and the shop.** Every chip you earn pays chips × your current mult in points. Spend them in
  the shop beside your hand: three offers from your deck (sometimes a piece of gear), rerolled each
  time you buy.
- **Cards build the mountain.** About fifty to draw and buy: trail features, roadside posts with auras
  and once-a-lap pickups, landscape that combines with its neighbours, enemy cards, weather, one-shot
  actions, and routes (Chairlift, Chute, Cat Track) that branch the trail.
- **Bounties.** Every kill pays cash, scaled by level and difficulty, banked at the lodge each lap.
  Call it a day to keep 100%, bail out mid-lap for 60%, or wipe out and keep 30%.
- **Loop-backs.** A lift, or a path that leads back up, chains another descent into the lap: +1 mult,
  and every enemy card sends again, a level tougher.
- **Gear.** 69 named items, most with a mechanic of their own: shotguns that splash, harpoons that
  pin, skis that tuck without losing aim, an airbag that saves you once.
- **Bosses.** Every card you place fills the Baron alert; fill it and the Avalanche Baron comes. Beat
  him to win and earn a black run sign. From lap 2, intel fragments drop; three make a dossier that
  summons the Ice Widow, the Yeti King or Captain Kickback.
- **The town.** Spend cash, intel and scrap on twelve buildings that unlock cards, course tiles and
  gear. Your town and mountain are saved in this browser.

## Code layout

```
src/game/     The simulation: no DOM, no rendering, no clocks. Commands are its only input.
  map.ts      The mountain as a graph on an 18x10 grid: the seeded loop plus every route (lifts,
              chutes, free-form trail paths), their junctions, and which routes loop back.
  mountain.ts Your home mountain: course tiles, laying and taking up routes and special tiles,
              difficulty read off the mountain, and the setup an expedition starts from.
  cards.ts    Card definitions, where each can go, and tile combinations.
  run.ts      One expedition: movement, junctions and chained descents, per-descent spawns, combat
              and gear mods, points and the shop, bounties, the lodge decision, bosses and payouts.
  enemies.ts  The enemy kinds and bosses, levels, and what difficulty does.
  items.ts    The gear catalogue: named items, their mods, rarities and unlocks.
  stats.ts    Hero stats from gear, the mountain and the town; stances.
  lodge.ts    The meta layer: buildings, unlocks, deck choice, buying course tiles, banking a run.
src/render/   The low-res run: hand-authored 16px sprites, the piste-map renderer, weather, effects.
  art/        The detailed pixel art: a drawing toolkit (dithering, shapes), scenery, card
              illustrations, course-tile icons, the animated town, rules vignettes, portraits.
src/audio/    Procedural sound effects and the surf-spy soundtrack (Web Audio, nothing downloaded).
src/ui/       DOM: pages and tabs, the town, the mountain builder, the expedition HUD, hand and
              shop, the lap tally and results.
src/app/      Wiring, the fixed-timestep loop (with pause and speed), saving the town and settings.
gallery.html  A developer page (npm run dev, then /gallery.html) showing every illustration and sprite.
tests/        Loop generation, card rules, routes and loop-backs, laps and spawns, the shop, enemy
              types, the mountain builder, new cards, gear mods, determinism and snapshots, payouts,
              bosses, the town and deck, and sprite sanity.
```

The simulation keeps the multiplayer-ready rules from the original plan: it runs on a fixed 30 Hz tick
with a seeded random generator, only commands enter it, and a run can be saved and restored exactly
(covered by a test).

## Budget

About 82 kB gzipped for the page, script and styles, plus two small Google Fonts (Silkscreen and
VT323). There are no image, model or sound files: sprites are character grids, illustrations are
drawn by code at startup, and the sound effects and music are synthesized.
