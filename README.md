# Double Black Diamond

A browser-based, first-person spy shooter where you never stop skiing.

This repository covers the three **Feel** steps of the prototype plan:

1. One seeded slope with tuck and snowplow, mouse look, a fixed-timestep loop and a seeded run,
   with the player as one entity in a list.
2. Shooting and three guard types, with hold-to-aim and an aim assist that shrinks as you tuck.
3. Chips × mult scoring and an end-of-run payout.

There is no lodge, card building or lift yet. The look is black, white and one red, leaning into
slapstick: guards backflip out of their hats, headshots go *BONK!*, and lost hands get a sad trombone.

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open the printed local URL and click to drop in. `npm run build` makes a static build in
`dist/` that runs from any static host (it uses relative paths). `npm test` runs the simulation
tests.

The current mountain's seed is shown on screen and kept in the address as `#SEED`, so a copied
link opens the same mountain. `?seed=anything` also works for seeds with other characters.

## Controls

| Input | Action |
| --- | --- |
| Mouse | Steer. Your skis chase where you look, so the camera never waits on the skis. |
| Left mouse / F | Shoot (silenced pistol, 8 rounds, reloads itself when empty). |
| Right mouse / Q (hold) | Aim: the view zooms, the aim assist widens, and the skis hold their line while the mouse moves your gun. Release to snap back to your skis. |
| W / Shift / Up | Tuck: lower drag and faster, but wider turns and a wobblier aim. |
| S / Down | Snowplow: brakes toward about 25–35 km/h, tighter turns, steady aim. It never stops you. |
| A / D | Steer with keys (also works while aiming). |
| Space | Pop a jump. Big kickers with a pop at full speed can land you too hard. |
| R / N | Retry this mountain / new mountain. |
| M | Mute. |
| ` (backtick) | Tuning panel: every physics number, mouse sensitivity, FOV, shake, render scale. |
| Esc | Pause (releases the mouse). |

## How the feel works

- **Gravity is the throttle.** Gravity always pulls; the snow only pushes back where the skis press
  into it. Air drag sets top speed, and the tuck has less than half the drag of a cruise
  (about 115 km/h cruising versus 125–145 km/h tucked on the first trail).
- **Carving versus skidding.** The skis pivot toward where you steer at a limited rate, and the edges
  cancel sideways sliding up to a grip limit. A clean carve keeps your speed; pivoting harder than
  the edges can hold turns into a skid that scrubs it off. The tuck has the least grip, so tucking
  through trees is the risky line.
- **You can't stop.** The skis can't point more than 75° off the fall line, and the snowplow brakes
  toward a floor speed rather than to zero.
- **Absorbing bumps.** The legs can reach 30 cm, so over moguls and rollers the body floats while the
  skis keep their edge. At speed you leave the snow off rollers and kickers.
- **Wipeouts.** Hitting a tree straight on, landing too hard, or landing sideways is a full yard sale.
  A glancing blow off a tree just bumps you.
- **Aim wobble** is computed by the simulation (it grows with speed and tuck and shrinks with plow) and
  drawn as the drifting crosshair. Shots go where the crosshair dot is.
- **No input lag.** Mouse movement is applied the moment the event arrives and the camera reads it
  every frame. The simulation ticks at 120 Hz, so keys are seen within 8 ms, and rendering interpolates
  between ticks. Pointer lock asks for raw (unaccelerated) mouse input where the browser supports it.

## Gunfights: speed versus accuracy

- **Your gun** is hitscan from your eyes, plus the aim wobble. Firing from the hip adds spread; holding
  aim removes it, zooms in and widens the aim assist.
- **Aim assist** bends a shot toward a guard inside a cone (7° aiming, 2.5° from the hip). Tucking
  shrinks the cone by up to 80% and snowplowing grows it by 60%, on top of the wobble. Red brackets show
  which guard it will pull toward; it picks head or chest, whichever you are actually aiming nearer.
- **Guards** telegraph every shot: a red glint on the muzzle, and a red laser from snipers. Their hit
  chance halves at 22 m/s (about 80 km/h) and keeps falling the faster you go, and carving hard or being
  airborne helps too. Fast is hard to shoot and hard to hit with; slow is the reverse.
  - *Sentries* stand on the snow, take two body shots or one headshot.
  - *Snipers* sit in watchtowers at the trail edge with long range and a slow, accurate shot.
  - *Ski goons* wait by the clean line and race you down it, shooting back over their shoulder.
  - Ski straight into any guard on the snow to bowl them over (*STRIKE!*). Tower legs are solid.
- **Taking hits:** three hits and you are shot down. A hit costs a little speed and your open hand, and
  you win one hit back after 10 seconds without being shot.

## Scoring: chips × mult

- **Chips** come from guards (40–80, double for headshots, bonuses for bowling, air shots and long
  range), air time, grazing trees at speed, and *whiffs* (a guard's shot missing you up close).
- **Mult** grows with every scoring event by how fast you were going (+0.06 per m/s above 10 m/s), and
  trickles in while you stay above 20 m/s (faster in a tuck).
- Chips and mult build up in an open **hand**. It cashes in as chips × mult once you go 3.5 seconds without
  scoring (time in the air doesn't count). Getting shot or wiping out **loses** the open hand.
- **Base camp** adds a bonus hand worth more the faster you got there.
- **Payout** is your score at base camp, or half of it if you wipe out. It is added to a bank kept in
  this browser until the lodge exists to spend it.

With the same aim, a bot that cruises and shoots pays out 12,000–35,000 per run on six test seeds,
against 1,500–1,900 for one that snowplows the whole way (a test checks that fast pays at least three
times more). The slow bot kills just as many guards; it just never builds a mult.

## Code layout

```
src/sim/      Pure simulation: no DOM, no Three.js, no clocks.
  course.ts   The trail, generated from the seed: height function, banks, rollers, moguls,
              kickers, and trees (with a hidden tree-free line so every seed can be finished).
  player.ts   One skier's physics, driven only by an InputFrame per tick.
  combat.ts   The player's gun: hitscan, hip spread, aim assist, bowling guards over.
  guards.ts   Guard placement from the seed, their aim-then-fire behaviour and hit chance.
  ray.ts      Ray tests against snow, trees and guard hit spheres; lines of sight.
  scoring.ts  Chips × mult hands, cashing and losing them, the base camp bonus and payout.
  sim.ts      Run state (plain JSON), fixed-tick step, snapshot and restore, events.
  rng.ts      Seeded sfc32 generator whose state lives in the run state.
  tuning.ts   Every physics number in one place.
src/client/   Input (controls.ts), the fixed-timestep loop, settings, and game.ts, which wires it all.
src/render/   Three.js: terrain mesh, crossed-plane pines, decor, snowfall, guards (with pratfalls),
              tracers and puffs, and PlayerView (each player's camera, viewport, skis, gun and juice).
              palette.ts holds the ink, paper and red.
src/ui/       HUD, overlays and the tuning panel (plain DOM).
src/audio/    Procedural wind, ski hiss, gunshots, bonks, slide whistles and sad trombones (Web Audio).
tests/        Determinism, snapshot/restore, multi-player, feel, gunfight and scoring checks.
```

### Multiplayer-ready rules, as built

- Players live in `RunState.players`; singleplayer is a list of one, and the tests run two.
- Only `InputFrame`s enter the simulation. Rendering, HUD and sound read state and events.
- Fixed 120 Hz timestep with a seeded RNG, so a run is reproducible from seed, tuning and inputs.
- Each local player has a `PlayerView` with its own camera and viewport; the renderer loops over them.
- `Sim.snapshot()` and `Sim.restore()` round-trip a run exactly (covered by a test).

Known limit: runs reproduce exactly on the same browser engine. Different engines can differ in the
last bit of `Math.sin` and friends, which matters only for cross-browser replays later.

## Budget check (end of the Feel phase)

- Download: about 170 kB gzipped in total (165 kB of JavaScript, most of it Three.js; phase 1 was
  155 kB). No image, model or sound files: every texture and sound is generated at startup.
- Rendering: 30–72 draw calls and 27k–63k triangles per frame along the trail (phase 1: 19–25 calls).
  The terrain and trees are chunked so only the stretch ahead is drawn, and fog hides the 300 m draw
  distance.
- Frame rate on real hardware still needs checking by hand; the automated checks run on a software
  renderer. Lower the render scale in the tuning panel on slow machines.
