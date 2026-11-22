# Double Black Diamond: design

Build the mountain, then ski it. A loop-building spy roguelite in black, white and one red.

This replaces the first-person direction of the original vision. The mountain is now seen from above
as a pixel-art piste map, and the structure is drawn heavily from Loop Hero: the skier runs the loop
on their own while you build the world around them with cards, and the lodge between expeditions is
your camp. The other influences sit on top: Balatro for scoring and card feel, GoldenEye and spy-vs-spy
for tone, Hades for the hub, Dead Cells for gear slots.

## Pillars

When two ideas collide, the one that serves more of these wins.

1. **Gravity is the throttle.** You can't stop. Your one real-time control is stance: tuck is fast and
   hard to hit but your aim goes; snowplow is slow and accurate but you're a sitting duck.
2. **You build the mountain, then you ski it.** Every card you place is a bet you have to survive on
   the next lap.
3. **Speed is the multiplier.** Each lap scores chips × mult, and tucking, fast laps and big air feed
   the mult.
4. **Short runs, absurd builds.** Laps take 20 to 45 seconds and expeditions a few minutes, and the
   best ones end in a broken combination of tiles, routes and gadgets.
5. **Small and instant.** A browser tab, about 50 kB gzipped in all, no image or sound files: every
   sprite, illustration and note of music is made at startup.

## The expedition loop

1. Leave the **lodge** on the chairlift. The lift is the breather: you heal on the way up, but
   roadside cards beside it still reach you.
2. At the **summit**, ski the switchbacks back down. You never stop; you shoot whatever is in range
   on the way past.
3. Kills drop **cards, gear and resources**. Place cards to build the mountain as you go. Choosing a
   card pauses time so you can plan.
4. **Route cards reshape the mountain.** A Chairlift climbs from the trail back up to the trail
   above; a Chute drops straight down to the trail below. Each opens a **junction** whose switch you
   flip at any time, so one mountain gives many different laps.
5. Riding a lift you built **chains another descent** into the same lap: +1 mult, but new enemies
   arrive a level higher each descent, and the lap's hand only cashes in at the lodge. This is the
   vision's "ride again or ski on?" made a decision you take mid-run.
6. Reaching the lodge ends the **lap**: its chips × mult cashes in, and you choose to **ride again**
   or **call it a day** and keep everything.
7. Every card placed fills the **Baron alert**. When it is full, the Avalanche Baron chases you round
   the mountain in his snowcat. Beat him to win the expedition and unlock the next trail rating.
8. Home at the lodge, spend what you brought back on **buildings** that unlock cards and perks for
   every expedition after, and choose which unlocked cards make up your **deck**.

## Loop Hero, mapped

| Loop Hero | Double Black Diamond |
| --- | --- |
| The loop road the hero walks | A ski circuit (lodge, lift up, switchback trail down) that route cards branch into a network |
| The hero walks and fights on their own | The skier skis and shoots on their own |
| Stopping to fight each battle | Drive-by fights while you keep moving (you can't stop) |
| No direct hero control | Stance: tuck, cruise or snowplow (speed against aim) |
| Road, roadside and landscape tiles | Trail, roadside and landscape cards |
| Tile combos (mountain peaks, meadows by groves) | Double Black Diamond from a 3x3 of peaks; powder heals more beside pines; pines pay graze chips |
| Oblivion | Avalanche |
| Days that trigger tile spawns | Days that trigger spawns, respawns and healing |
| Loop count raises enemy level | Each descent's new enemies arrive a level higher |
| Lich meter fills as you place tiles | Baron alert fills as you place cards |
| Retreat at camp 100%, mid-loop 60%, death 30% | Call it a day 100%, bail out 60%, wipe out 30% |
| Equipment drops with rarity | Gear drops: common (white), rare (black), legendary (red) |
| Camp buildings unlock cards and perks | Lodge buildings unlock cards and perks |
| Choosing a deck before an expedition | Choosing up to 8 unlocked cards at the lodge |
| Resources from the expedition build the camp | Cash, intel and scrap build the lodge |

## The other influences

- **Balatro.** Every lap is a hand: chips from kills, the run, grazes, air and supplies, times a mult
  that tucking, fast laps, air and combos build. The tally at the lodge lists every line before
  chips × mult counts up. Cards are chunky and wobble; gadgets are the jokers.
- **GoldenEye and spy-vs-spy.** Guards in tall busbies, snipers with red glints, a villain with a
  monocle, slapstick deaths (comic words, slide whistles), and you in a red jacket.
- **Hades.** The lodge is the hub you return to after every expedition, win or wipe out.
- **Dead Cells.** A fixed set of gear slots (gun, skis, goggles, jacket) plus gadget slots, so each
  pick matters.

## Art direction

Two levels of detail, on purpose:

- **The run is low-res.** The mountain map uses chunky 16px tiles and sprites, so it stays readable at
  a glance while you plan and the skier is moving.
- **Everything you stop to look at is detailed.** Card illustrations (32x32 scenes), the lodge
  panorama (360x120, animated, with every building drawn), boss portraits (40x40) and your portrait
  are drawn with a small pixel-art toolkit: ordered dithering for skies and shading, shaded
  mountains, pines with snow on the boughs, smoke, clouds. Ink, greys and one red throughout.
- `npm run dev` then `/gallery.html` shows every illustration on one page for checking art.

## Systems

### The mountain

An 18x10 grid. Each seed draws the lift on the left and a 2 to 4 switchback trail down. Downhill
tiles are fast (2.4 tiles/s), traverses slower (1.8), chutes fastest (3.0), lifts steady (0.9). A
day is 10 seconds.

The mountain is a directed graph of path tiles, rebuilt from the seed and the routes placed so far,
so it never needs saving and replays exactly. Trail higher up always comes earlier in the loop, which
gives the route rules for free:

- A **Chairlift** goes on a trail tile with at least two open cells straight above it and more trail
  beyond. It always lands on trail that leads back down to where it started, so it makes a loop
  inside the lap.
- A **Chute** goes on a trail tile with at least two open cells straight below and more trail
  beyond. It always skips trail.
- Routes can't cross anything you've placed, and each trail tile holds one junction. Every seed
  tested has about a dozen places for each.
- A new route's switch starts **on**, so placing one visibly changes your next lap. Click a junction,
  or press R for the next one ahead, to flip it. A red rope closes the way it won't send you.
  Snowmobiles and the Baron follow the same switches.

| Route | Effect |
| --- | --- |
| Chained descent (boarding a lift you built) | +1 mult; descent count +1, so enemies placed after arrive a level up |
| Chute tile | +2 chips (trail pays 1), +0.2 mult, aim x0.85 |
| Kicker in a chute | A cliff drop: +50 chips and +1 mult instead of +25 and +0.5 |

### Cards

| Card | Kind | Effect |
| --- | --- | --- |
| Patrol Post | Trail | A guard now, another every 2 days (up to 3) |
| Mogul Field | Trail | Slows you; chips each pass, mult if tucked |
| Kicker | Trail | Airborne: can't be hit or shoot; chips and mult |
| Ice Sheet | Trail | Faster here, but worse aim |
| Guard Cabin | Roadside | A guard walks onto the trail every 3 days |
| Sniper Nest | Roadside | Long-range sniper; returns 3 days after you drop him |
| Snowmobile Garage | Roadside | A snowmobile chases you round the loop every 3 days |
| Supply Cache | Roadside | Heals 20% once a lap, plus chips |
| Safehouse | Roadside | A card and intel once a lap |
| Pine Grove | Landscape | Dodge, and graze chips on the trail beside it |
| Boulder | Landscape | +4 max HP |
| Peak | Landscape | +8 max HP; a 3x3 of peaks and boulders is a Double Black Diamond (+40 HP, yetis) |
| Powder Field | Landscape | Heals every day, more beside pines |
| Avalanche | Special | Wipes a placed tile and everything around it |
| Whiteout | Weather | 3 days: everyone sees 60% as far; kills and grazes pay double |
| Night | Weather | 3 days: enemies hit less, you aim worse, more loot |
| Dossier (x3) | Boss | Summons the Ice Widow, the Yeti King or Captain Kickback; from three intel fragments |
| Chairlift | Route | A lift from the trail back up to the trail above: chain another descent |
| Chute | Route | A steep shortcut straight down to the trail below |

### Combat

The skier fires at the nearest enemy in range at their fire rate. Hit chance is aim times stance,
minus the target's dodge. Enemies fire back when you're in their range; their hit chance is reduced by
your dodge, which tucking raises. In the air you can't be hit. Guards and snipers hold their tiles;
snowmobiles and the Baron chase you along the loop.

| Stance | Speed | Aim | Dodge | Other |
| --- | --- | --- | --- | --- |
| Tuck | 160% | 65% | +20% | Builds mult on the trail |
| Cruise | 100% | 100% | — | — |
| Snowplow | 55% | 135% | −5% | +2 defense |

### Bosses

| Boss | How they come | What they do | Reward |
| --- | --- | --- | --- |
| The Avalanche Baron | The alert meter fills as you place cards | Chases you round the mountain in his snowcat | Wins the expedition and unlocks the next rating |
| The Ice Widow | Dossier card | Holds her tile, shoots from 3.4 tiles, freezes the trail around her to ice | The Widow's Monocle: +15% crit, triple crits |
| The Yeti King | Dossier card | Holds his tile, hits hard up close, calls a yeti down every day | The Yeti Pelt: +45 max HP, +1 regen, +3 defense |
| Captain Kickback | Dossier card | Laps the mountain on a rocket sled at 2.9 tiles/s, following your switches | The Getaway Sled: +2 mult per chained descent, bailing keeps 80% |

Intel fragments drop from snipers (35%), snowmobiles (35%), yetis (always) and guards (6%), but only
once you've built a chairlift: the vision's rule that bosses come to a mountain with two lifts.
Three fragments make a dossier for a boss you haven't faced this expedition. Dossier bosses pay a
$1,000 bounty and drop a one-of-a-kind reward that never turns up as ordinary loot; beaten ones are
kept as trophies at the lodge. A boss's arrival stops the clock and shows their dossier.

### Weather

Weather cards cover the whole mountain for 3 days (click anywhere to play one):

- **Whiteout:** everyone sees 60% as far, you and them; kills and grazes pay double chips.
- **Night:** enemies hit 40% less often, your aim drops 15%, and cards and gear drop half as often
  again.

### Loot and gear

Kills drop cards (most enemies around 45%), gear (around 30%) and intel or scrap. Gear has three
rarities and scales with the lap. Gadgets bend the rules: Tree Hugger (grazes add permanent mult),
Airhead (shoot in the air for triple damage), Plow Reload, Yard Sale Insurance, Speed Demon, Season
Pass, Exploding Snowballs. A full pack or hand burns the oldest for resources; you can scrap gear and
burn cards on purpose too.

### The lodge

| Building | Unlocks |
| --- | --- |
| Trail Crew | Chute |
| Weather Station | Whiteout, Night |
| Ski Patrol Hut | Supply Cache, Powder Field |
| Radio Tower | Sniper Nest, Snowmobile Garage |
| Gondola Works | Kicker, Ice Sheet |
| Avalanche Control | Peak, Avalanche |
| Spy HQ | Safehouse, gadget drops, a second gadget slot |
| Rental Shop | +10% speed, better drops |
| Sauna | +25% max HP |

Trail ratings (Bunny Hill, Blue Square, Black Diamond, Double Black Diamond) scale enemies and the
cash payout. Beating the Baron on your highest rating unlocks the next.

You start owning Patrol Post, Chairlift, Guard Cabin, Mogul Field, Pine Grove and Boulder. Your deck
holds 4 to 8 different cards chosen from everything unlocked; new unlocks join it while there is
room. A small deck makes the cards you want come up more often; a wide one covers more situations.

## What changed from the original vision, and why

- **First person to top-down.** Building the mountain is the heart of the game, and it reads far
  better from above. It also turns graphics into hand-made pixel art, which suits the size budget and
  the black, white and red look.
- **Aiming to stance.** Hold-to-aim and aim assist gave way to stance: the speed-against-accuracy
  trade is now one decision you make all the time, and the skier handles the trigger.
- **Three.js dropped.** A 2D canvas is all a top-down map needs; the download fell from about 170 kB
  to about 30 kB.
- **Payouts follow Loop Hero.** 100% / 60% / 30% replaces "halve the payout on death".
- **"Ride again?" at any lift.** The vision's mid-run choice is now a junction switch on every lift
  you build, so chaining descents is a bet you can change your mind about until the last moment.
- **Kept:** the lodge, cards, chips × mult, speed as the multiplier, trail ratings, bosses, seeded
  runs, the lift as the breather, lift cards and forks, and the deterministic, multiplayer-ready
  simulation.
- **Open question:** the vision has the mountain persist between runs; Loop Hero rebuilds it each
  expedition, and so does this version for now. A middle ground is that routes persist and tiles
  don't.

## Progress against the vision's prototype order

| Phase | Step | Status |
| --- | --- | --- |
| Feel | Slope, tuck and snowplow, fixed timestep, seeded run | Done in first person, then carried over as stance |
| Feel | Shooting and guards, speed against accuracy | Done in first person; now drive-by combat with stance |
| Feel | Chips × mult and a payout | Done |
| Build | Two weapon and two utility slots | Partly: gun, skis, goggles, jacket and up to two gadgets |
| Build | The lift ride: steady aim, enemies along it | Done: you heal and aim steadier; roadside cards reach you |
| Build | Two lifts, a fork and "Ride again?" | Done: Chairlift and Chute cards, junction switches, chained descents |
| Meta | The lodge, payout and death penalty | Done (100/60/30%) |
| Meta | Segment graph and card placement | Done, within an expedition (see the open question above) |
| Meta | Drops, shops, card burning, unlocks, seeded runs | Partly: drops, burning, buildings and seeds; no shops yet |
| Meta | The four trail ratings | Done |
| Meta | Boss cards from intel dossiers | Done: three dossier bosses with one-of-a-kind rewards, plus the Baron from the meter |
| Meta | The snowboarder | Not yet |
| Polish | Fog, juice, soundtrack | Done for now: detailed card art, the lodge panorama, portraits, whiteout and night, and a surf-spy soundtrack |
| Multiplayer | Second player and split screen | Not yet; the simulation rules allow it |

## Next

- **More synergies with routes and weather:** snipers riding the chairs, a gondola route, moguls
  that only pay in a chute, cards that only work at night.
- **A shop** at the lodge or mid-run, so cards and gear can be bought as well as found.
- **The snowboarder** as a second class with its own handling and stances.
- A soundtrack, daily seeds, and a race on a shared seed.
