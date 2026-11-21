# Double Black Diamond

A browser-based, first-person spy shooter where you never stop skiing.

This repository is at **prototype phase 1 (Feel)**: one seeded slope with tuck and snowplow,
mouse look, a fixed-timestep loop, and the player as one entity in a list. There is no shooting,
scoring or lodge yet.

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
| W / Shift / Up | Tuck: lower drag and faster, but wider turns and a wobblier aim. |
| S / Down | Snowplow: brakes toward about 25–35 km/h, tighter turns, steady aim. It never stops you. |
| A / D | Steer with keys (also works while free-looking). |
| Space | Pop a jump. Big kickers with a pop at full speed can land you too hard. |
| Right mouse / Q (hold) | Free-look: the skis hold their line while you look around. Release to snap back. |
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
  drawn as the drifting crosshair, ready for shooting in phase 2.
- **No input lag.** Mouse movement is applied the moment the event arrives and the camera reads it
  every frame. The simulation ticks at 120 Hz, so keys are seen within 8 ms, and rendering interpolates
  between ticks. Pointer lock asks for raw (unaccelerated) mouse input where the browser supports it.

## Code layout

```
src/sim/      Pure simulation: no DOM, no Three.js, no clocks.
  course.ts   The trail, generated from the seed: height function, banks, rollers, moguls,
              kickers, and trees (with a hidden tree-free line so every seed can be finished).
  player.ts   One skier's physics, driven only by an InputFrame per tick.
  sim.ts      Run state (plain JSON), fixed-tick step, snapshot and restore, events.
  rng.ts      Seeded sfc32 generator whose state lives in the run state.
  tuning.ts   Every physics number in one place.
src/client/   Input (controls.ts), the fixed-timestep loop, settings, and game.ts, which wires it all.
src/render/   Three.js: terrain mesh, crossed-plane pines, decor, snowfall, and PlayerView
              (each player's camera, viewport, skis and camera juice).
src/ui/       HUD, overlays and the tuning panel (plain DOM).
src/audio/    Procedural wind, ski hiss, thumps and chimes (Web Audio, nothing downloaded).
tests/        Determinism, snapshot/restore, multi-player, and feel checks.
```

### Multiplayer-ready rules, as built

- Players live in `RunState.players`; singleplayer is a list of one, and the tests run two.
- Only `InputFrame`s enter the simulation. Rendering, HUD and sound read state and events.
- Fixed 120 Hz timestep with a seeded RNG, so a run is reproducible from seed, tuning and inputs.
- Each local player has a `PlayerView` with its own camera and viewport; the renderer loops over them.
- `Sim.snapshot()` and `Sim.restore()` round-trip a run exactly (covered by a test).

Known limit: runs reproduce exactly on the same browser engine. Different engines can differ in the
last bit of `Math.sin` and friends, which matters only for cross-browser replays later.

## Phase 1 budget check

Measured on the build at the end of this phase:

- Download: about 155 kB gzipped in total (151 kB of JavaScript, most of it Three.js). No image,
  model or sound files: every texture and sound is generated at startup.
- Rendering: 19–25 draw calls and 27k–60k triangles per frame along the trail; the terrain and trees
  are chunked so only the stretch ahead is drawn, and fog hides the 300 m draw distance.
- Frame rate on real hardware still needs checking by hand; the automated checks run on a software
  renderer. Lower the render scale in the tuning panel on slow machines.
