# Double Black Diamond: design

Build the mountain, then ski it. A loop-building spy roguelite in black, white and one red.

This replaces the first-person direction of the original vision. The mountain is seen from above as a
pixel-art piste map, and the structure is drawn heavily from Loop Hero: the skier runs the loop on
their own while you build the world around them with cards, and the town between expeditions is your
camp. The other influences sit on top: Balatro for scoring, the shop and card feel, GoldenEye and
spy-vs-spy for tone, Hades for the hub, Dead Cells for gear slots.

## Pillars

When two ideas collide, the one that serves more of these wins.

1. **Gravity is the throttle.** You can't stop. Your one real-time control is stance: tuck is fast and
   hard to hit but your aim goes; snowplow is slow and accurate but you're a sitting duck.
2. **You build the mountain, then you ski it.** Twice over: the course itself between expeditions,
   and the cards on it during one. Every tile and card is a bet you have to survive on the next lap.
3. **Speed is the multiplier.** Every chip pays chips × your mult at that moment, and tucking, combos,
   air and chained descents feed the mult.
4. **Short runs, absurd builds.** Laps take 20 to 45 seconds and expeditions a few minutes, and the
   best ones end in a broken combination of course, cards and gear.
5. **Small and instant.** A browser tab, about 80 kB gzipped in all, no image or sound files: every
   sprite, illustration and note of music is made at startup.

## The pages

- **Start:** the title over your live town, which grows as you build and echoes the last expedition's
  weather (night, whiteout, blizzard, bluebird). Play, How to play, Settings.
- **How to play:** nine panels, one per mechanic, each with a small pixel vignette built from the
  game's own sprites.
- **Play,** with three tabs. **Ski town** (buildings, deck, the Trail Crew's yard of course tiles,
  trophies, the gear locker), **The mountain** (the builder, difficulty, seed, Head out) and **Ski
  loops** (the expedition). During an expedition the town and mountain are look-but-don't-touch, and
  leaving the slopes pauses them until you come back.

## The expedition loop

1. **Head out** from The Mountain tab. The expedition starts on your home mountain: its routes, the
   way you set each junction, and its special tiles.
2. Leave the **lodge** on the chairlift. The lift is the breather: you heal on the way up.
3. **Enemies arrive every descent.** Each lap brings its own wave (two or three on the first, more
   later, in ones and twos on random trail tiles away from the lodge), and every enemy card on the
   mountain rolls how many to send and where.
4. At the summit, ski back down. You never stop; you shoot whatever is in range on the way past.
5. Chips pay **points** at your current mult. Spend them in the **shop** beside your hand: three offers
   from your deck, sometimes a piece of gear, rerolled each time you buy. Kills drop gear, resources
   and the occasional card. Picking up a card pauses the slopes so you can plan.
6. A route that leads back up the mountain (a lift, or a path that doubles back) **chains another
   descent** into the lap: +1 mult, and every enemy card sends again, a level tougher.
7. Reaching the lodge ends the **lap**: its **bounties** bank as cash, and you choose to **ride again**
   or **call it a day** and keep everything.
8. Every card placed fills the **Baron alert**. When it's full, the Avalanche Baron chases you round
   the mountain in his snowcat. Beat him to win the expedition.
9. Home, the expedition's laps earn **course tiles** for your mountain; spend cash, intel and scrap on
   **buildings**, more tiles, and your **deck**.

## Loop Hero, mapped

| Loop Hero | Double Black Diamond |
| --- | --- |
| The loop road the hero walks | Your home mountain: a ski circuit you extend with course tiles |
| The hero walks and fights on their own | The skier skis and shoots on their own |
| Stopping to fight each battle | Drive-by fights while you keep moving (you can't stop) |
| No direct hero control | Stance: tuck, cruise or snowplow (speed against aim) |
| Road, roadside and landscape tiles | Trail, roadside and landscape cards |
| Tile combos | Double Black Diamond from a 3x3 of peaks; pines, aspens, cliffs and hot springs work on the trail beside them; wind ridges double jumps |
| Oblivion | Avalanche |
| Days that trigger tile spawns | Descents that trigger spawns: each lap, and each loop-back |
| Loop count raises enemy level | Each descent's new enemies arrive a level higher |
| Lich meter fills as you place tiles | Baron alert fills as you place cards |
| Retreat at camp 100%, mid-loop 60%, death 30% | Call it a day 100%, bail out 60%, wipe out 30% |
| Equipment drops with rarity | Named gear: common (white), rare (black), legendary (red) |
| Camp buildings unlock cards and perks | Town buildings unlock cards, course tiles, gear and perks |
| Choosing a deck before an expedition | Choosing up to 14 unlocked cards in town |

## The other influences

- **Balatro.** Chips times a mult you build, a line-by-line tally at the lodge, a shop of three that
  rerolls, chunky wobbly cards, and gadgets as jokers.
- **GoldenEye and spy-vs-spy.** Guards in tall busbies, snipers with red glints, a villain with a
  monocle, slapstick deaths (comic words, slide whistles), and you in a red jacket.
- **Hades.** The town is the hub you return to after every expedition, win or wipe out.
- **Dead Cells.** A fixed set of gear slots (gun, skis, goggles, jacket) plus gadget slots, so each
  pick matters.

## Art direction

Two levels of detail, on purpose:

- **The run is low-res.** The mountain map uses chunky 16px tiles and sprites, so it stays readable at
  a glance while you plan and the skier is moving.
- **Everything you stop to look at is detailed.** Card illustrations (32x32 scenes), the town panorama
  (480x120, animated: smoke, chairs, skiers, townsfolk, weather), the start page's sky over it, the
  rules vignettes (128x64), course-tile icons, boss portraits (40x40) and your portrait are drawn with
  a small pixel-art toolkit: ordered dithering for skies and shading, shaded mountains, pines with
  snow on the boughs, smoke, clouds. Ink, greys and one red throughout.
- `npm run dev` then `/gallery.html` shows every illustration and sprite on one page.

## Systems

### The mountain

An 18x10 grid. Each seed draws the main lift on the left and a 2 to 4 switchback trail down. Downhill
tiles are fast (2.4 tiles/s), traverses slower (1.8), climbing back uphill on a path a slow skate
(1.1), chutes fastest (3.0), lifts steady (0.9).

The mountain is a directed graph of path tiles, rebuilt from the seed and the routes, so it never
needs saving beyond that list and replays exactly. Three kinds of route branch it:

- **Lifts** climb from a trail tile with a clear line straight up to the trail above. Two per
  mountain.
- **Chutes** drop from a trail tile with a clear line straight down to the trail below.
- **Trail paths** run edge to edge over open snow in any shape, from a fork on the trail to trail
  anywhere else. The Cat Track card lays a straight one during a run.

Where a route branches off there's a **junction**; a red rope closes the way it won't send you, and
snowmobiles, hounds and the Baron follow the same switches. A route that leads back to trail before
its own junction is a **loop-back**, and taking it chains another descent.

### Your home mountain

Saved with the town. You build it in The Mountain tab with course tiles:

| Tile | What it does | Where from |
| --- | --- | --- |
| Trail | One cell of path | Start with 6; a tile per two laps of an expedition (up to 4); $40 in town |
| Lift | A chairlift (two per mountain) | $350 + 4 scrap, needs Gondola Works |
| Chute | A steep chute | $220 + 2 scrap, needs Trail Crew |
| Jump | A kicker on the trail | Start with 1; $100; Captain Kickback |
| Slalom Gates | +0.5 mult if you tuck through | Start with 1; $100; the Ice Widow |
| Snow Tunnel | Nobody can shoot inside | $180 + 2 scrap, needs Trail Crew; the Yeti King |
| Checkpoint | Guards every descent; harder and richer | Start with 1; $80 + 1 intel |
| Black Run Sign | A whole step harder | Beating the Baron |

A new loop-back path starts switched off, so a lap still ends at the lodge until you choose otherwise;
click a junction in the builder to set how it starts. Taking anything up refunds its tiles (and
anything that only fitted because of it); a new seed clears the mountain and refunds everything.

**Difficulty** is read off the mountain, 0 to 4: +1 per black run sign, +0.35 per checkpoint, +0.25
per chute, +0.15 per lift, +0.02 per cell of extra trail. It sets enemy strength (x0.8 at 0 to x2.0
at 4), bounties (x0.75 to x2.43) and how many cards bring the Baron (18 to 34). Its bands keep the old
names: Bunny Hill, Blue Square, Black Diamond, Double Black Diamond.

### Enemies and spawns

There's no clock. Spawns happen at the start of each **descent**: every lap, and every loop-back you
take. Each lap's own wave grows by one every two laps (up to 8); snowmobiles join it from lap 3 and
hound packs from lap 4. Enemy cards roll on top:

| Enemy | From | Behaviour |
| --- | --- | --- |
| Guard | Patrol Post (1-2 a descent), Guard Cabin (0-2 nearby), Checkpoint (1-3) | Holds a tile, shoots up close |
| Sniper | Sniper Nest (replaced each descent) | 2.6 tiles of reach, slow and hard-hitting |
| Snowmobile Goon | Snowmobile Garage (1, sometimes 2) | Chases you round the mountain |
| Yeti | Yeti Cave (most descents, two at a time), Double Black Diamond | Huge, slow, hits hard, worth a fortune |
| Sapper | Demo Shack (replaced each descent) | Lobs grenades, plants a mine nearby every 7 s |
| Turncoat Medic | Field Hospital (replaced each descent) | Heals every enemy within 2 tiles every 3 s |
| Hound | Kennel (2-3 a descent) | Fast, fragile chasers that bite |

Mines hurt unless you're airborne: jump one off a kicker or rail for chips.

### Points, the shop and bounties

- **Points:** every chip pays chips × the mult you have right now, so building mult first (tuck,
  combos, chained descents, pep talks) and then cashing in pays best.
- **The shop:** three offers from your deck, priced in points (base price, +20% a lap, less with
  hamlets or a coupon book). Buying one rerolls all three; Reroll costs 10, then 5 more each time in
  a lap. The last offer is a piece of gear about a third of the time.
- **Bounties:** every kill pays cash (guard 40, sniper 70, yeti 180 and so on, scaled by level and
  difficulty), banked at the lodge at the end of each lap. Bailing or wiping out loses the lap in
  progress.
- Kills still drop cards, at half the old rate, and gear; a full hand or pack burns the oldest.

### Cards

Fifty-three to draw and buy, plus the dossiers, the mines sappers plant, and the black run sign.

| Kind | Cards |
| --- | --- |
| Trail | Patrol Post, Checkpoint, Mogul Field, Kicker, Ice Sheet, Slalom Gates, Snow Tunnel, Grind Rail, Fresh Corduroy, Crevasse, Powder Stash, Wax Station |
| Roadside | Guard Cabin, Sniper Nest, Snowmobile Garage, Demo Shack, Field Hospital, Kennel, Supply Cache, Safehouse, Ammo Dump, Watchtower, First Aid Post, Radio Jammer, Dead Drop, Scrap Yard, Ticket Booth, Fuel Drums, Après Bar |
| Landscape | Pine Grove, Boulder, Peak, Powder Field, Yeti Cave, Glacier, Cliff Face, Aspen Stand, Hot Spring, Frozen Lake, Wind Ridge, Alpine Hamlet |
| Weather | Whiteout, Night, Bluebird Day, Blizzard |
| Action | Supply Drop, Pep Talk, Airstrike, Intel Briefing |
| Route | Chairlift, Chute, Cat Track |
| Special | Avalanche |

Roadside posts work three ways: auras while you're within a tile (Ammo Dump fire rate, Watchtower
range, First Aid regen, Radio Jammer spoiling enemy aim), once-a-lap pickups as you pass (cache,
safehouse, dead drop, scrap yard, ticket booth, après bar), or traps (fuel drums blow up whatever dies
beside them).

### Combat

The skier fires at the nearest enemy in range at their fire rate. Hit chance is aim times stance,
minus the target's dodge. Enemies fire back when you're in their range; their hit chance is reduced by
your dodge, which tucking raises. In the air (kickers, rails) you can't be hit; in a tunnel nobody
shoots.

| Stance | Speed | Aim | Dodge | Other |
| --- | --- | --- | --- | --- |
| Tuck | 160% | 65% | +20% | Builds mult on the trail |
| Cruise | 100% | 100% | — | — |
| Snowplow | 55% | 135% | −5% | +2 defense |

### Bosses

| Boss | How they come | What they do | Reward |
| --- | --- | --- | --- |
| The Avalanche Baron | The alert meter fills as you place cards | Chases you round the mountain in his snowcat | Wins the expedition; a black run sign and two trail tiles |
| The Ice Widow | Dossier card | Holds her tile, shoots from 3.4 tiles, freezes the trail around her | The Widow's Monocle, $1,000, a gates tile |
| The Yeti King | Dossier card | Holds his tile, hits hard, calls a yeti down every 10 s | The Yeti Pelt, $1,000, a tunnel tile |
| Captain Kickback | Dossier card | Laps the mountain on a rocket sled, following your switches | The Getaway Sled, $1,000, a jump tile |

Intel fragments drop from lap 2 on (snipers, snowmobiles, sappers and medics 30%, yetis always, guards
and hounds rarely), from dead drops, and from Intel Briefings. Three make a dossier for a boss you
haven't faced this expedition. A boss's arrival stops the clock and shows their dossier.

### Weather

Weather lasts the lap it's played in and the next:

- **Whiteout:** everyone sees 60% as far; kills and grazes pay double chips.
- **Night:** enemies hit 40% less often, your aim drops 15%, loot drops half as often again.
- **Bluebird Day:** you aim 20% better and ski 10% faster; enemies see you 20% further.
- **Blizzard:** everyone skis 25% slower and enemies fire 25% slower; chips pay 50% more.

### Gear

69 named items (the starter pistol, 65 that drop, and the three bosses' one-of-a-kind rewards), each
with fixed base numbers that grow with the level it drops at, and most with a mod of its own:

- **Guns:** spread (Fondue Shotgun, Avalanche Mortar), pierce (Railgun), stun and pin (Snowball
  Launcher, Harpoon Gun), tranquilize, life steal (Vampire Derringer), bounty, every fourth shot a
  crit (Golden Ski Pole), long shots and first hits.
- **Skis:** skate uphill, twin tips (double jump chips), mogul masters, ice edges, powder skis, steady
  carvers (tuck without losing aim), telemark (faster snowplow).
- **Goggles:** night vision, whiteout lenses, lucky lenses, scopes, X-ray specs.
- **Jackets:** camo, style (+15% points), spikes, and the Avalanche Airbag, which saves you once.
- **Gadgets:** the originals (Tree Hugger, Airhead, Plow Reload, Yard Sale Insurance, Speed Demon,
  Season Pass, Exploding Snowballs) and Grappling Hook, Loot Magnet, Hip Flask, Coupon Book, Rabbit's
  Foot, Briefcase and Piggy Bank.

The Armory and Rental Shop add their own legendaries to what can drop; Spy HQ adds gadgets. The town's
gear locker shows everything you've found, with silhouettes for the rest.

### The town

| Building | Unlocks |
| --- | --- |
| Trail Crew | Chute, Cat Track, Wax Station; chute and tunnel tiles |
| Ski Patrol Hut | Supply Cache, Powder Field, Field Hospital, First Aid Post, Powder Stash, Hot Spring |
| Radio Tower | Sniper Nest, Snowmobile Garage, Radio Jammer, Watchtower |
| Gondola Works | Chairlift, Kicker, Ice Sheet; lift tiles |
| Avalanche Control | Peak, Avalanche, Demo Shack, Crevasse, Cliff Face, Glacier |
| Weather Station | Whiteout, Night, Bluebird Day, Blizzard, Wind Ridge |
| Spy HQ | Safehouse, Dead Drop, Intel Briefing; gadget drops and a second gadget slot |
| Rental Shop | Ticket Booth, Scrap Yard, Alpine Hamlet, Frozen Lake; +10% speed, better drops, premium gear |
| Sauna | Après Bar, Pep Talk; +25% max HP |
| Terrain Park | Slalom Gates, Snow Tunnel, Checkpoint, Grind Rail |
| Hunting Lodge | Kennel, Yeti Cave, Aspen Stand |
| Armory | Ammo Dump, Fuel Drums, Airstrike; a better starting pistol, better drops, the best guns |

You start owning Patrol Post, Guard Cabin, Mogul Field, Pine Grove, Boulder, Fresh Corduroy and Supply
Drop. Your deck holds 4 to 14 different cards chosen from everything unlocked; new unlocks join it
while there's room. The lodge in the panorama gains a balcony at three buildings and a clock tower at
seven; townsfolk and skiers multiply as you build.

## What changed from the original vision, and why

- **First person to top-down.** Building the mountain is the heart of the game, and it reads far
  better from above. It also turns graphics into hand-made pixel art, which suits the size budget and
  the black, white and red look.
- **Aiming to stance.** Hold-to-aim and aim assist gave way to stance: the speed-against-accuracy
  trade is one decision you make all the time, and the skier handles the trigger.
- **Three.js dropped.** A 2D canvas is all a top-down map needs.
- **Payouts follow Loop Hero.** 100% / 60% / 30% replaces "halve the payout on death".
- **"Ride again?" at any junction.** The vision's mid-run choice is a switch on every loop-back.
- **The mountain persists.** The vision's open question is settled: your course persists and grows
  between expeditions; the cards you place on it last one expedition, as in Loop Hero.
- **Trail ratings became difficulty.** Ratings aren't picked from a menu any more; they're bands of a
  difficulty number that comes from what you build.
- **Kept:** the lodge and town, cards, chips × mult, speed as the multiplier, bosses, seeded runs, the
  lift as the breather, lifts and forks, and the deterministic, multiplayer-ready simulation.

## Progress against the vision's prototype order

| Phase | Step | Status |
| --- | --- | --- |
| Feel | Slope, tuck and snowplow, fixed timestep, seeded run | Done, as stance |
| Feel | Shooting and guards, speed against accuracy | Done, as drive-by combat with stance |
| Feel | Chips × mult and a payout | Done: points at your mult, and bounties |
| Build | Two weapon and two utility slots | Gun, skis, goggles, jacket and up to two gadgets |
| Build | The lift ride: steady aim, enemies along it | Done |
| Build | Two lifts, a fork and "Ride again?" | Done: lifts, chutes, paths, junctions, loop-backs |
| Meta | The lodge, payout and death penalty | Done (100/60/30%) |
| Meta | Segment graph and card placement | Done, and the course persists |
| Meta | Drops, shops, card burning, unlocks, seeded runs | Done: the shop of three, the tile yard, gear drops |
| Meta | The four trail ratings | Done, as difficulty from the mountain |
| Meta | Boss cards from intel dossiers | Done |
| Meta | The snowboarder | Not yet |
| Polish | Fog, juice, soundtrack | Done for now |
| Multiplayer | Second player and split screen | Not yet; the simulation rules allow it |

## Next

- **Balance passes** with real players: wave sizes, shop prices, bounties and tile prices were tuned
  against a simple bot.
- **More synergies** between gear mods, course tiles and cards (a gondola route, snipers riding the
  chairs, cards that only work at night).
- **The snowboarder** as a second class with its own handling and stances.
- Daily seeds, and a race on a shared seed.
