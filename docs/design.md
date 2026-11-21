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
   best ones end in a broken combination of tiles and gadgets.
5. **Small and instant.** A browser tab, about 30 kB of code, no image or sound files: every sprite
   and sound is made at startup.

## The expedition loop

1. Leave the **lodge** on the chairlift. The lift is the breather: you heal on the way up, but
   roadside cards beside it still reach you.
2. At the **summit**, ski the switchbacks back down. You never stop; you shoot whatever is in range
   on the way past.
3. Kills drop **cards, gear and resources**. Place cards to build the mountain as you go. Choosing a
   card pauses time so you can plan.
4. Reaching the lodge ends the **lap**: its chips × mult cashes in, and you choose to **ride again**
   (new enemies arrive a level higher) or **call it a day** and keep everything.
5. Every card placed fills the **Baron alert**. When it is full, the Avalanche Baron chases you round
   the loop in his snowcat. Beat him to win the expedition and unlock the next trail rating.
6. Home at the lodge, spend what you brought back on **buildings** that unlock cards and perks for
   every expedition after.

## Loop Hero, mapped

| Loop Hero | Double Black Diamond |
| --- | --- |
| The loop road the hero walks | A ski circuit: lodge, lift up, switchback trail down |
| The hero walks and fights on their own | The skier skis and shoots on their own |
| Stopping to fight each battle | Drive-by fights while you keep moving (you can't stop) |
| No direct hero control | Stance: tuck, cruise or snowplow (speed against aim) |
| Road, roadside and landscape tiles | Trail, roadside and landscape cards |
| Tile combos (mountain peaks, meadows by groves) | Double Black Diamond from a 3x3 of peaks; powder heals more beside pines; pines pay graze chips |
| Oblivion | Avalanche |
| Days that trigger tile spawns | Days that trigger spawns, respawns and healing |
| Loop count raises enemy level | Each lap's new enemies arrive a level higher |
| Lich meter fills as you place tiles | Baron alert fills as you place cards |
| Retreat at camp 100%, mid-loop 60%, death 30% | Call it a day 100%, bail out 60%, wipe out 30% |
| Equipment drops with rarity | Gear drops: common (white), rare (black), legendary (red) |
| Camp buildings unlock cards and perks | Lodge buildings unlock cards and perks |
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

## Systems

### The mountain

An 18x10 grid. Each seed draws the lift on the left and a 2 to 4 switchback trail down. Downhill
tiles are fast (2.4 tiles/s), traverses slower (1.8), the lift steady (0.9). A day is 10 seconds.

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

### Loot and gear

Kills drop cards (most enemies around 45%), gear (around 30%) and intel or scrap. Gear has three
rarities and scales with the lap. Gadgets bend the rules: Tree Hugger (grazes add permanent mult),
Airhead (shoot in the air for triple damage), Plow Reload, Yard Sale Insurance, Speed Demon, Season
Pass, Exploding Snowballs. A full pack or hand burns the oldest for resources; you can scrap gear and
burn cards on purpose too.

### The lodge

| Building | Unlocks |
| --- | --- |
| Ski Patrol Hut | Supply Cache, Powder Field |
| Radio Tower | Sniper Nest, Snowmobile Garage |
| Gondola Works | Kicker, Ice Sheet |
| Avalanche Control | Peak, Avalanche |
| Spy HQ | Safehouse, gadget drops, a second gadget slot |
| Rental Shop | +10% speed, better drops |
| Sauna | +25% max HP |

Trail ratings (Bunny Hill, Blue Square, Black Diamond, Double Black Diamond) scale enemies and the
cash payout. Beating the Baron on your highest rating unlocks the next.

## What changed from the original vision, and why

- **First person to top-down.** Building the mountain is the heart of the game, and it reads far
  better from above. It also turns graphics into hand-made pixel art, which suits the size budget and
  the black, white and red look.
- **Aiming to stance.** Hold-to-aim and aim assist gave way to stance: the speed-against-accuracy
  trade is now one decision you make all the time, and the skier handles the trigger.
- **Three.js dropped.** A 2D canvas is all a top-down map needs; the download fell from about 170 kB
  to about 30 kB.
- **Payouts follow Loop Hero.** 100% / 60% / 30% replaces "halve the payout on death".
- **Kept:** the lodge, cards, chips × mult, speed as the multiplier, trail ratings, bosses, seeded
  runs, the lift as the breather, and the deterministic, multiplayer-ready simulation.

## Next

- **Lift cards** that add a second lift and a fork, so later expeditions chain several descents.
- **Intel dossiers** that assemble into boss cards with one-of-a-kind rewards, and more bosses.
- **Deck choice** before each expedition, as in Loop Hero, once there are enough cards to choose from.
- **The snowboarder** as a second class with its own handling and stances.
- More synergies, weather cards (whiteout, night), a soundtrack, daily seeds, and a race on a shared
  seed.
