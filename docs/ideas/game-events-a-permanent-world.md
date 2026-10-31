# Whole-Game Events A: Permanent World Changes (GWE-A01 to A36)

Part of the Whole-Game Events library. Index and priorities: `game-events-00-index.md`. Expands `ideas/game-events.md` without repeating it. Design only, nothing approved.

**Field key.** *Desc* what it is. *How* the rules. *Trigger* what starts it (counted from saved profile data). *Feel* what the player sees and hears. *Deps* systems it touches. *Rar* C common, U uncommon, R rare, XR extremely rare. *Pay* rewards and consequences. *Cx* build size S/M/L/XL with the approach. *Bal* balance concerns.
**Shared rules.** World state lives in a versioned, Zod-validated profile record (`world`). All outcomes derive from saved history plus the date/run seed, never from animation or gameplay RNG. A world change never blocks progress and never deletes an unlock; a retired feature keeps an archive stop.

---

## A1. Landscape and Map Changes

### GWE-A01 The Rebuilt Bridge
- *Desc:* A broken bridge in a region is slowly rebuilt by an NPC crew over many runs.
- *How:* Each finished run in that region adds a build step (0 to 5). At step 5 a shortcut branch opens on the region map: skip one stop, lose one shop on that path.
- *Trigger:* Clear the same bridge-blocked region 5 times.
- *Feel:* Hub letters from the foreman; the bridge art gains one plank per run; a ribbon-cutting with the crew's Machop at the end.
- *Deps:* map generator, Hub letters, region art.
- *Rar:* U.
- *Pay:* A new optional route. No penalty for ignoring it.
- *Cx:* M. A map-graph variant flag plus five art states.
- *Bal:* The shortcut must never skip a boss or the last shop before one.

### GWE-A02 The Great Thaw
- *Desc:* Warm play melts the frozen routes into marshes.
- *How:* After the trigger, Ice routes in two regions swap to Marsh biome: Ice wild pool shrinks, Water/Bug/Poison pools grow. One-way, but a "Glacier Archive" stop keeps the old Ice table reachable.
- *Trigger:* 50 Fire-type wins across all runs.
- *Feel:* Map art swap with a dripping sound; a "Thaw" entry in the Chronicle.
- *Deps:* encounter tables, biome art, Chronicle.
- *Rar:* R.
- *Pay:* New Marsh spawns; Ice specialists keep the archive.
- *Cx:* L. Data-driven biome swap plus art.
- *Bal:* Keep Ice-only unlocks obtainable; do not strand Ice-type collectors.

### GWE-A03 Flooded Valley
- *Desc:* A raid-driven flood turns one valley into a lake for a while.
- *How:* For 12 runs, stops in that valley become boat stops: Water types lead with a speed edge, ground-bound parties lose one speed step on that path. Then the water recedes and leaves a rare item bed.
- *Trigger:* A Kyogre-style Water raid beaten twice.
- *Feel:* Rising water over a few runs; a Lapras ferry cameo.
- *Deps:* raids, weather, map art.
- *Rar:* R.
- *Pay:* Water-only rare spawns during the flood; item bed after.
- *Cx:* M.
- *Bal:* Speed penalty small and opt-out via the dry route.

### GWE-A04 Tunnel Under the Mountain
- *Desc:* Miners dig a tunnel linking two regions' route graphs.
- *How:* Unlocks a "Crossing" run option that starts between regions with a mixed encounter pool and a combined boss.
- *Trigger:* 25 Ground/Rock/Steel Pokémon across Hall of Fame teams.
- *Feel:* Digging sounds in the Hub; a new door on the region select.
- *Deps:* region order, levels-and-regions plan.
- *Rar:* R.
- *Pay:* Mixed pools for variety; no raw power gain.
- *Cx:* L. New campaign template.
- *Bal:* Level curve for mixed regions must follow the +50/region rule.

### GWE-A05 The Lighthouse Relit
- *Desc:* A dark Hub lighthouse is restored.
- *How:* At night (in-game time) a coastal region reveals one hidden stop at run start, once per run.
- *Trigger:* Complete three rescue-at-sea events.
- *Feel:* The beam sweeps the Hub shoreline.
- *Deps:* hidden stops, Hub scene.
- *Rar:* U.
- *Pay:* One free reveal per run.
- *Cx:* S.
- *Bal:* Reveal only shows, never grants.

### GWE-A06 Desert Sinks / Desert Blooms
- *Desc:* A monthly tug between two moods of the desert region.
- *How:* Compare your own Grass wins to Ground wins over the last 30 days; the leader sets the mood (flower fields or quicksand mazes) until the next month, with a matching rare spawn set.
- *Trigger:* Automatic monthly.
- *Feel:* Region art and sounds change; NPC chatter notes the season.
- *Deps:* date seed, type tallies.
- *Rar:* C.
- *Pay:* Themed spawns either way.
- *Cx:* M.
- *Bal:* Use only the player's own tallies so it works offline.

### GWE-A07 Overgrown Ruins
- *Desc:* Ruins you ignore get swallowed by vines.
- *How:* Each ruin tracks days since last visit; after 100 days it overgrows. Returning lets you cut in; the cache inside grows with days away (capped).
- *Trigger:* 100 real days since last ruin stop.
- *Feel:* Vines over the stop icon; a machete-style chop animation.
- *Deps:* ruin events.
- *Rar:* U.
- *Pay:* Larger cache for longer absence.
- *Cx:* S.
- *Bal:* Cap the cache so absence is not the best farm.

### GWE-A08 Ghost Town Reopens
- *Desc:* A story chain's end turns a ghost town into a stop type.
- *How:* The Ghost Town stop can appear in any region: a Ghost-only shop and a séance event.
- *Trigger:* Reach stage 3 of the Ghost-type chain (see B-series).
- *Feel:* Lanterns flicker on in the Hub map preview.
- *Deps:* chain engine, shop tables.
- *Rar:* R.
- *Pay:* Ghost items and a safe haven.
- *Cx:* M.
- *Bal:* Ghost shop prices sit near normal shops.

### GWE-A09 The Cursed Bell Rings
- *Desc:* A one-day curse.
- *How:* While active, every map shows a tolling bell; each toll swaps one wild encounter to a Ghost.
- *Trigger:* Visit one specific bell stop at midnight local time on the 13th.
- *Feel:* A low bell across the whole run.
- *Deps:* date seed cache, encounter swaps.
- *Rar:* XR.
- *Pay:* "Bell Cursed" cosmetic if you survive.
- *Cx:* S.
- *Bal:* Ghosts swapped only at the wild tier you already meet.

### GWE-A10 A New Region on the Horizon
- *Desc:* A foggy silhouette hints at a future region.
- *How:* After every current region is cleared, each run adds 1 fog-clearing progress. At the goal a new region unlocks.
- *Trigger:* All regions cleared by the profile.
- *Feel:* The world map fog thins run by run.
- *Deps:* levels-and-regions plan (+50 levels per region).
- *Rar:* R.
- *Pay:* A long-term unlock.
- *Cx:* XL. New region content.
- *Bal:* Level cap per region stays within the plan.

### GWE-A11 The Hub Gets a Second Floor
- *Desc:* A trophy loft.
- *How:* A staircase appears; upstairs shelves show real keepsakes from runs.
- *Trigger:* All Hub upgrades bought.
- *Feel:* Footsteps and a quiet room.
- *Deps:* museum, Legacy gallery.
- *Rar:* U.
- *Pay:* Display only, plus a few lore cards.
- *Cx:* M.
- *Bal:* None.

### GWE-A12 Hub Garden Overgrows
- *Desc:* Neglect has a gentle cost.
- *How:* Without planting for 30 runs, weeds grow and idle Hub Pokémon gain friendship slightly slower. Weeding is a short ritual that gives seeds.
- *Trigger:* 30 runs without planting.
- *Feel:* Weeds over the plots; a satisfying pluck.
- *Deps:* Hub, berries.
- *Rar:* C.
- *Pay:* Seeds for tending.
- *Cx:* S.
- *Bal:* Cost small and reversible.

### GWE-A13 The Moving Gym
- *Desc:* A leader whose gym is on wheels.
- *How:* That gym changes location each run; the leader's team gets a mobility kit (trick room or priority moves).
- *Trigger:* Beat a gym leader by Speed sweep 3 times.
- *Feel:* A rumbling caravan on the map.
- *Deps:* gym order, trainer tiers.
- *Rar:* U.
- *Pay:* Rematch reward unique to the caravan.
- *Cx:* M.
- *Bal:* Gym tier unchanged.

### GWE-A14 Ferry Network
- *Desc:* Ferries link coastal regions.
- *How:* An optional "Ferry Run" crosses two regions with a combined boss.
- *Trigger:* 10 coastal region clears.
- *Feel:* Horn and gulls on the select screen.
- *Deps:* region order, boss templates.
- *Rar:* R.
- *Pay:* Double region credit at higher risk.
- *Cx:* L.
- *Bal:* Reward scaled to the harder boss.

### GWE-A15 The Wall of Names
- *Desc:* A town wall carves every Hall of Fame team.
- *How:* Walking by reacts to Pokémon you own; one touch-up lets you leave a short message to your future self.
- *Trigger:* First Hall of Fame entry.
- *Feel:* Stone carving that grows.
- *Deps:* Hall of Fame.
- *Rar:* C.
- *Pay:* Sentimental; the message returns in a later run.
- *Cx:* S.
- *Bal:* None.

### GWE-A16 Eroded Coastline
- *Desc:* Heavy Water use reshapes the coast.
- *How:* Two coastal stops merge into a single tide-pool stop with its own mini events.
- *Trigger:* 200 total Water moves used in one region.
- *Feel:* Beach art shrinks.
- *Deps:* map variants.
- *Rar:* U.
- *Pay:* Tide-pool items.
- *Cx:* S.
- *Bal:* Stop count stays the same.

### GWE-A17 Volcano Wakes
- *Desc:* A defeated Fire legend leaves the mountain restless.
- *How:* For 20 runs, lava lines one region border; lava stops deal chip damage but drop fire stones.
- *Trigger:* Fire legend defeated.
- *Feel:* Glow and rumble.
- *Deps:* hazards, items.
- *Rar:* R.
- *Pay:* Evolution items.
- *Cx:* M.
- *Bal:* Chip damage opt-in on Careful mode.

### GWE-A18 Shifting Seasons Region
- *Desc:* One region cycles seasons by run count.
- *How:* Spring, summer, autumn, winter in a four-run loop, each with a biome skin and seasonal forms.
- *Trigger:* Automatic.
- *Feel:* A different-looking region on every visit.
- *Deps:* biome art, seasonal forms.
- *Rar:* U.
- *Pay:* Seasonal spawns.
- *Cx:* M.
- *Bal:* Same difficulty each season.

### GWE-A19 The Crater Lake
- *Desc:* Meteorites leave a crater.
- *How:* A dig site stop that rewards space items (Moon Stone, meteorite chunk).
- *Trigger:* Meteorite event 3 times.
- *Feel:* A steaming crater with a starfield sky.
- *Deps:* meteorite-crash map event.
- *Rar:* R.
- *Pay:* Space items.
- *Cx:* S.
- *Bal:* Item quantities capped per run.

### GWE-A20 Cable Car Lines
- *Desc:* Vertical shortcuts on mountains.
- *How:* A branch stop where falling is an unlucky roll but never lethal.
- *Trigger:* 15 Flying/Psychic teams.
- *Feel:* Swaying gondolas.
- *Deps:* map branches.
- *Rar:* U.
- *Pay:* A shortcut or a mild detour.
- *Cx:* M.
- *Bal:* Fall result just reroutes.

### GWE-A21 The Library Opens
- *Desc:* A library in the Hub with lore bundles.
- *How:* Reading unlocks permanent tiny hints, such as a boss's weakness line.
- *Trigger:* 100 Pokédex entries.
- *Feel:* Page turns and a hushed theme.
- *Deps:* Moment codex, memories.
- *Rar:* U.
- *Pay:* Hint text only.
- *Cx:* M.
- *Bal:* Hints never reveal exact teams.

### GWE-A22 Cavern Collapse
- *Desc:* Overused caves can collapse.
- *How:* Mid-run, a cave may collapse; Rock/Ground teammates dig you out for a bonus, otherwise a detour.
- *Trigger:* A cave stop visited 40 times.
- *Feel:* Rumble and dust, a quick dig minigame.
- *Deps:* teammate typing.
- *Rar:* U.
- *Pay:* Bonus on a successful dig.
- *Cx:* S.
- *Bal:* Detour costs time, not health.

### GWE-A23 Fog Never Lifts
- *Desc:* Defeat thickens the fog.
- *How:* Each loss in a forest region hides more stop names until you win, which plays a "Clearing" scene.
- *Trigger:* Fail a forest region 3 times in a row.
- *Feel:* Heavier fog art.
- *Deps:* narrative defeat.
- *Rar:* U.
- *Pay:* Relief and a small boon on the win.
- *Cx:* S.
- *Bal:* Names hidden, never stops.

### GWE-A24 Orchard Grows
- *Desc:* A berry orchard stop type.
- *How:* Pick one berry for a held buff; trees mature with real days.
- *Trigger:* 500 berries eaten.
- *Feel:* Trees grow taller across weeks.
- *Deps:* berries, held items.
- *Rar:* U.
- *Pay:* Buff berries.
- *Cx:* S.
- *Bal:* One pick per run.

### GWE-A25 The Observatory
- *Desc:* A telescope in the world.
- *How:* One peek per run at the next boss team's types.
- *Trigger:* 20 Stargazing sightings.
- *Feel:* A lens view of the sky.
- *Deps:* Stargazing event, boss data.
- *Rar:* R.
- *Pay:* Information only.
- *Cx:* S.
- *Bal:* Types only, not moves.

### GWE-A26 Rail Line Across Regions
- *Desc:* Trains link regions.
- *How:* A train stop carries one chosen item to the next region (limited slot).
- *Trigger:* Hub rail upgrade.
- *Feel:* Station sounds.
- *Deps:* inventory.
- *Rar:* U.
- *Pay:* Convenience.
- *Cx:* M.
- *Bal:* One slot only.

### GWE-A27 Haunted Mansion Wing
- *Desc:* Nemeses leave trophies.
- *How:* Each nemesis you defeat adds a mansion wing with a mini quiz about that fight.
- *Trigger:* Defeat a nemesis in a Ghost-flavoured region.
- *Feel:* Candlelit corridors.
- *Deps:* nemesis system.
- *Rar:* U.
- *Pay:* Trophy and a small reward.
- *Cx:* M.
- *Bal:* Quiz rewards capped.

### GWE-A28 Training Arena Expansion
- *Desc:* A gauntlet room.
- *How:* Pre-run drills preview a boss's first move.
- *Trigger:* Hub training maxed.
- *Feel:* Drill sergeant NPC.
- *Deps:* Hub training.
- *Rar:* U.
- *Pay:* Information.
- *Cx:* M.
- *Bal:* Only the first move.

### GWE-A29 Graffiti Wall
- *Desc:* Rival tags the Hub.
- *How:* Rival graffiti after wins against you; beating them lets you paint over it with your own symbol.
- *Trigger:* A rival wins 3 times.
- *Feel:* A living record of the rivalry.
- *Deps:* rivalry kinds.
- *Rar:* U.
- *Pay:* Cosmetic.
- *Cx:* S.
- *Bal:* None.

### GWE-A30 Floating Islands
- *Desc:* Sky stops.
- *How:* Reachable only by Flying/Levitate members; each has an unusual wild.
- *Trigger:* Sky Pillar-style legend completed.
- *Feel:* Clouds and wind.
- *Deps:* party typing.
- *Rar:* R.
- *Pay:* Rare spawns.
- *Cx:* M.
- *Bal:* Optional.

### GWE-A31 Snowed-In Season
- *Desc:* Winter closes routes.
- *How:* A route is skipped each winter run, forcing different paths.
- *Trigger:* Winter dates.
- *Feel:* Snow drifts.
- *Deps:* calendar seed.
- *Rar:* C.
- *Pay:* Variety.
- *Cx:* S.
- *Bal:* At least two routes stay open.

### GWE-A32 Sinkhole City
- *Desc:* A hidden underground city.
- *How:* After enough sinkhole events a 3-stop mini-map with unique merchants opens.
- *Trigger:* 5 Sinkhole events.
- *Feel:* Neon lamps underground.
- *Deps:* mini-map template, merchants.
- *Rar:* R.
- *Pay:* Unique stock.
- *Cx:* L.
- *Bal:* Short and optional.

### GWE-A33 Crop Circles
- *Desc:* Strange patterns.
- *How:* Stepping inside triggers an alien rule change for one battle.
- *Trigger:* 3 Psychic legend sightings.
- *Feel:* Humming lights.
- *Deps:* battle rule hooks.
- *Rar:* XR.
- *Pay:* A rare item.
- *Cx:* S.
- *Bal:* One battle only.

### GWE-A34 The Border Wall Falls
- *Desc:* Peace merges maps.
- *How:* Two regions share border routes.
- *Trigger:* Both factions in a conflict reach peace (E-series).
- *Feel:* A celebration scene.
- *Deps:* faction state.
- *Rar:* R.
- *Pay:* New route options.
- *Cx:* L.
- *Bal:* Route lengths unchanged.

### GWE-A35 Neon Takeover
- *Desc:* Cyber-Maximalism region skin.
- *How:* A toggled reskin of one region in Frutiger Aero/Cyber style.
- *Trigger:* Cyber-Maximalism cosmetic unlocked.
- *Feel:* Glassy neon UI.
- *Deps:* visual style guide.
- *Rar:* U.
- *Pay:* Cosmetic.
- *Cx:* M.
- *Bal:* None.

### GWE-A36 Garden of Remembered Pokémon
- *Desc:* A memorial garden.
- *How:* One flower per retired Pokémon, coloured by its types; ghost sprites of past Pokémon wander through.
- *Trigger:* 20 Pokémon retired to the Hall of Fame.
- *Feel:* Warm, quiet music.
- *Deps:* Legacy, memories.
- *Rar:* U.
- *Pay:* Sentimental plus a small friendship buff when visited.
- *Cx:* M.
- *Bal:* Buff tiny and once per run.
