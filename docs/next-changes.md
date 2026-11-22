# Double Black Diamond: next round of changes

Notes from playtesting the routes, art, bosses and weather build (Nov 22, 2026). Nothing here is built
yet. Each item records the request, how the current build differs, and a proposed approach to confirm
before building.

## Vision for this round

Keep the loop-building heart, but make every lap an active economy:

- **The mountain is dangerous from the first lap.** Enemies arrive every lap, in numbers and places you
  can't fully predict, so the run never starts empty.
- **You shop as you ski.** Skiing earns card points; you spend them on one of three cards on offer,
  which reroll after each purchase. The game is about what you buy and where you put it.
- **You build the course itself.** The fixed switchback and the trail-rating picker give way to tiles
  you earn and buy, so a mountain can grow many loops and paths, including ones that double back on
  themselves.
- **Much more stuff.** Roughly 3x the cards, at least six enemy types from their own cards, and 50 to
  100 guns and pieces of gear.
- **Time is measured in laps,** not a ten-second clock.
- **The interface stays out of the way** while you place cards.
- **The game reads in a logical order:** a start page, a rules page, and a play page with a view for
  each mechanic. The ski town is the showcase for detailed pixel art and changes with what you buy.

## The changes

### 1. Enemies from lap 1

- **Request:** there should be enemies on the first lap.
- **Now:** the mountain starts empty; enemies appear only when you place enemy cards.
- **Proposal:** at the start of every lap, including the first, spawn a wave on the trail. It should
  scale with the lap number and difficulty. Pairs with item 9.

### 2. Card points and a shop while you ski

- **Request:** gain cards as you loop. Earn card points instead of total points as you ski, and spend
  them on one of three random cards, which reroll after each selection. Daily payouts depend on enemies
  killed and difficulty.
- **Now:** cards come from kills (about 45%) and safehouses. Each lap cashes chips x mult into cash, and
  cash pays for lodge buildings.
- **Proposal:**
  - Skiing and kills earn card points during the run.
  - A three-card offer is always visible beside the hand. Buying one rerolls all three.
  - The payout that goes home to the lodge is based on enemies killed and difficulty, not chips x mult.
- **To decide:**
  - Does chips x mult stay at all, perhaps as what earns card points?
  - Can you reroll without buying (at a cost)?
  - Is the "daily" payout per lap (item 9) or per expedition?

### 3. Build the course from tiles, replacing the difficulty picker

- **Request:** replace the selectable Bunny Hill and other ratings with an interface where you earn and
  buy normal and special tiles. Make the mountain more interesting, with many possible loops and paths
  that can go back on themselves.
- **Now:** each seed is a fixed switchback loop. Routes (lifts, chutes) only branch straight up or down.
  Difficulty comes from four trail ratings chosen at the lodge.
- **Proposal:**
  - **Path tiles** extend or rewire the trail graph: straights, turns, forks, merges, crossings,
    switchbacks and traverses that loop back uphill.
  - **Special tiles** such as jumps, chutes, gates and tunnels.
  - The mountain graph from the routes work already supports branching and rejoining, so tiles add
    nodes and edges to it.
  - Difficulty becomes a property of the mountain you build (steepness, enemy density, special tiles)
    rather than a menu choice.
- **To decide:**
  - Are tiles bought at the lodge (meta), during the run (with card points), or both?
  - Does a mountain persist between expeditions? This is the open question from the vision doc.

### 4. Fewer chairlifts

- **Request:** you should not get so many chairlifts.
- **Now:** Chairlift is a starter card with draw weight 2, the same as most cards.
- **Proposal:**
  - Make lifts rare: drop the weight, take them out of the starter deck or make them shop-only, and cap
    how many one mountain can have.
  - Intel fragments currently need a lift, so that gate may need rethinking.

### 5. About three times as many cards

- **Request:** ultimately about 3x as many cards.
- **Now:** 16 deck cards (trail, roadside, landscape, special, route, weather) plus 3 dossiers.
- **Proposal:**
  - Aim for about 50 deck cards across the kinds, with more neighbour combinations in the spirit of the
    Double Black Diamond 3x3.
  - Add them in themed batches: enemy cards (item 6), terrain, support, weather, and path tiles
    (item 3).
  - Each card needs a 32x32 illustration in the existing art style.

### 6. At least six enemy types, each from its own card

- **Request:** at least 6 different enemy types from different placeable cards.
- **Now:**
  - From cards: guards (Patrol Post, Guard Cabin), snipers (Sniper Nest) and snowmobiles (Garage).
  - Not from cards: yetis come only from a Double Black Diamond; bosses come from dossiers or the meter.
- **Proposal:**
  - Give every enemy type its own card.
  - Add at least three new types with distinct behaviour, for example:
    - a gondola gunner who rides the lifts;
    - a demolitions expert who drops ice or mines on tiles;
    - a ski-patrol traitor who heals other enemies;
    - an avalanche spotter who triggers slides;
    - a dog handler with fast chasers.
  - Each needs a map sprite and an illustration.

### 7. Many more guns and gear, eventually 50 to 100

- **Request:** many more guns and other gear cards, about 50 to 100 ultimately.
- **Now:**
  - Four gear slots (gun, skis, goggles, jacket), each with a few names across three rarities and
    random stats.
  - Seven regular gadgets and two boss-only gadgets.
- **Proposal:**
  - Replace random-stat gear with named, hand-designed items that each have a mechanic, not only stats.
    Examples: a shotgun that hits every enemy on a tile, a harpoon that pulls a chaser in, skis that
    tuck without losing aim.
  - Add a gear illustration style, like the card art, and a rarity and unlock pool at the lodge.
- **To decide:** does "gear cards" mean gear also shows up as buyable cards in the shop (item 2)?

### 8. Card description bubbles cover the bottom row

- **Request:** card descriptions cover the bottom row of tiles, so you can't see where you're placing a
  card on that row. The bubbles should appear, be easy to cancel, or have a "don't show again" option.
- **Now:** the card tooltip sits centred above the hand, over the bottom of the map. It got bigger when
  it gained a 96px illustration.
- **Proposal:**
  - Hide the bubble the moment a card is selected for placing.
  - Move it off the map (beside the hand or in the side panel).
  - Add a close button and a "don't show card tips" toggle remembered in the browser.

### 9. Count laps, not days; spawn enemies per lap

- **Request:** the day counter should be based on loops completed, not an arbitrary day. That reworks
  enemy spawning: enemies should spawn per loop and be less predictable about which tile and how many.
- **Now:** a "day" is a 10-second timer. It drives patrol posts (every 2 days), cabins and garages
  (every 3), sniper respawns, Double Black Diamond yetis, the Yeti King, powder healing and weather
  (3 days).
- **Proposal:**
  - Replace days with laps everywhere.
  - At the start of each lap, each enemy card rolls how many enemies to send (a range, from the seeded
    random generator) and which tile to send them to.
  - Weather lasts N laps; powder heals once a lap.
  - Pairs with item 1. Spawns stay seeded, so runs remain reproducible.

### 10. Reorganise the game into clear pages and menus

- **Request:** put the game's pages in a more logical order:
  - a start page;
  - a rules page;
  - a play page, with a menu or view for each mechanic: one for the buildable mountain, one for ski
    loops, and one for the ski town.

  These are good places to show more detailed pixel art, especially a dynamic ski town that changes
  with what you buy.
- **Now:** there are two screens.
  - The lodge screen mixes the title, the lodge panorama, the stash, expedition setup (rating, seed,
    deck), buildings and the how-to list on one scrolling page.
  - The run screen holds the map, hand, side panel and overlays.
- **Proposal:**
  - **Start page:** the title over a full-screen animated pixel scene of the mountain and town, with
    Play, Rules and Settings (sound, card tips from item 8).
  - **Rules page:** an illustrated guide, one panel per mechanic (skiing and stance, cards and
    placement, routes and junctions, scoring, bosses, weather), each with its own small pixel vignette
    rather than a bullet list.
  - **Play page,** with a menu to switch between three views:
    - **Ski town:** the hub, replacing today's lodge panorama and building cards. A larger, more
      detailed town that grows and changes with what you buy: new buildings, upgrades that visibly
      change existing ones, townsfolk and skiers walking about, and time of day or weather echoing the
      last run. Building, unlocks and the deck live here.
    - **The mountain:** the buildable mountain from item 3. Place and arrange course tiles, see every
      loop and path, and pick the run's setup (seed, difficulty) before heading out.
    - **Ski loops:** the run itself, keeping the low-res map, with the card shop from item 2 and the
      hand.
  - Showcase detailed pixel art on the start page, rules vignettes and the ski town. Keep the run map
    chunky and readable.
- **To decide:**
  - Can you open the town or mountain views during a run (paused), or only between runs?
  - Should the start page carry over the latest town state, so it reflects your progress?

## Suggested order

1. **Interface fix (item 8).** Small, and it unblocks playtesting.
2. **Laps and spawning (items 9 and 1).** This changes the run's clock that everything else hangs on.
3. **Card points and the shop (item 2), with fewer chairlifts (item 4).** This is the new economy.
4. **Enemy types (item 6).** Six or more types with their own cards and art.
5. **Course tiles replacing the difficulty picker (item 3).** This is the largest structural change.
6. **Pages and views (item 10).** A start page, a rules page, and play views for the town, the
   mountain and the ski loops. The skeleton can come early (after step 1), and the views fill in as
   the mountain builder and the dynamic town arrive.
7. **Content scale-up (items 5 and 7).** About 50 cards and 50 to 100 items, in batches.
