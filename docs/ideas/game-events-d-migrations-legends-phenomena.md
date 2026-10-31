# Whole-Game Events D: Migrations, Legends, Phenomena (GWE-D01 to D36)

Field key and shared rules as in file A (*Desc, How, Trigger, Feel, Deps, Rar, Pay, Cx, Bal*). Date-seeded or tally-seeded so they work offline. Unlike the weekly one-liners, these have memory: they escalate or decay across runs. Real dates are read once into a cached seed field for determinism.

---

## D1. Migrations

### GWE-D01 Great Butterfree Migration
- *Desc:* A yearly cloud crosses the map.
- *How:* Walking through without fighting earns a petal reward; fighting many lowers next year's size.
- *Trigger:* One autumn week.
- *Feel:* Drifting wings.
- *Deps:* calendar seed.
- *Rar:* U.
- *Pay:* Petals.
- *Cx:* M.
- *Bal:* Reward small.

### GWE-D02 Salmon Run
- *Desc:* Water Pokémon swim upstream.
- *How:* A "feed vs catch" choice flips next season's Water pool.
- *Trigger:* A river season.
- *Feel:* Silhouettes in the water.
- *Deps:* wild pools.
- *Rar:* U.
- *Pay:* Rare Water spawns.
- *Cx:* M.
- *Bal:* Pool change mild.

### GWE-D03 Wild Pokémon Move South
- *Desc:* Winter migration.
- *How:* Ice/Flying shift to southern regions; arrows on the world map.
- *Trigger:* Winter.
- *Feel:* Informational.
- *Deps:* wild pools.
- *Rar:* C.
- *Pay:* Pool shifts.
- *Cx:* S.
- *Bal:* None.

### GWE-D04 Nesting Season
- *Desc:* Nests on maps.
- *How:* Leave them to grow wild populations or take eggs for a hatching bonus (parents fight back).
- *Trigger:* Spring.
- *Feel:* Tense and sweet.
- *Deps:* eggs.
- *Rar:* U.
- *Pay:* Eggs or populations.
- *Cx:* M.
- *Bal:* Defensive fights fair.

### GWE-D05 The Wandering Herd
- *Desc:* A herd roams.
- *How:* It appears wherever you finished your last run.
- *Trigger:* Automatic.
- *Feel:* Curious.
- *Deps:* run history.
- *Rar:* U.
- *Pay:* A recurring species.
- *Cx:* M.
- *Bal:* None.

### GWE-D06 Stormbird Season
- *Desc:* Flying types gather.
- *How:* Boosts the Flying wild pool before Weather events.
- *Trigger:* Pre-storm runs.
- *Feel:* Gathering clouds.
- *Deps:* weather.
- *Rar:* U.
- *Pay:* Flying spawns.
- *Cx:* S.
- *Bal:* None.

### GWE-D07 Bug Hatch Swarm
- *Desc:* Mass hatch.
- *How:* Stops pack with low-level Bugs giving small XP chains; one Heracross lurks.
- *Trigger:* Every N runs.
- *Feel:* Buzzing.
- *Deps:* encounters.
- *Rar:* U.
- *Pay:* XP.
- *Cx:* S.
- *Bal:* XP capped.

### GWE-D08 Ghost Parade of the Lost
- *Desc:* Abandoned-run Pokémon drift as ghosts.
- *How:* Touching one lets you adopt it with a tragic backstory.
- *Trigger:* Abandoned runs in history.
- *Feel:* Haunting.
- *Deps:* run history.
- *Rar:* R.
- *Pay:* A Pokémon.
- *Cx:* M.
- *Bal:* Normal catch power.

### GWE-D09 Fossil Seasons
- *Desc:* Erosion unearths fossils.
- *How:* Each fossil type has a season; a museum quest needs the full set.
- *Trigger:* Calendar.
- *Feel:* Dusty digs.
- *Deps:* museum.
- *Rar:* U.
- *Pay:* Fossils.
- *Cx:* M.
- *Bal:* None.

### GWE-D10 Starlit Pilgrimage
- *Desc:* Fairy and Psychic types visit a shrine.
- *How:* Bring an offering for one guaranteed-outcome wish.
- *Trigger:* Meteor nights.
- *Feel:* Magical.
- *Deps:* shrines.
- *Rar:* R.
- *Pay:* A wish.
- *Cx:* M.
- *Bal:* Wish list curated.

## D2. Legendary Activity

### GWE-D11 Roaming Legend Calendar
- *Desc:* A different legend roams each month.
- *How:* Footprints and weather hint; each sighting raises catch odds up to a cap.
- *Trigger:* Automatic.
- *Feel:* Chasing.
- *Deps:* legends.
- *Rar:* R.
- *Pay:* A legend.
- *Cx:* L.
- *Bal:* Odds capped.

### GWE-D12 Legend Tantrum
- *Desc:* Farming annoys a guardian.
- *How:* Legends vanish for 5 runs; a gift ends it.
- *Trigger:* Heavy legend farming.
- *Feel:* Grumpy.
- *Deps:* legends.
- *Rar:* U.
- *Pay:* Resolution quest.
- *Cx:* S.
- *Bal:* None.

### GWE-D13 Twin Legends, One Season
- *Desc:* Opposite-type legends alternate.
- *How:* Whichever you meet first shapes the next 10 runs' weather.
- *Trigger:* Season start.
- *Feel:* Duality.
- *Deps:* weather.
- *Rar:* R.
- *Pay:* Weather shift.
- *Cx:* M.
- *Bal:* Symmetric.

### GWE-D14 Legend Hatchlings
- *Desc:* A legend's egg.
- *How:* Hatches over months; friendship events speed it.
- *Trigger:* Rare find.
- *Feel:* Tender.
- *Deps:* eggs.
- *Rar:* XR.
- *Pay:* A baby legend.
- *Cx:* L.
- *Bal:* Slow growth.

### GWE-D15 Fallen Legend
- *Desc:* A weakened legend is harassed.
- *How:* Protect it to earn an ally for one run.
- *Trigger:* Random.
- *Feel:* Heroic.
- *Deps:* legends.
- *Rar:* R.
- *Pay:* A temporary ally.
- *Cx:* M.
- *Bal:* Ally scaled down.

### GWE-D16 Legends in Disguise
- *Desc:* A legend wanders as a plain Pokémon.
- *How:* A subtle sparkle hints; catching it reveals it.
- *Trigger:* Rare date.
- *Feel:* Delightful.
- *Deps:* encounters.
- *Rar:* XR.
- *Pay:* A legend.
- *Cx:* M.
- *Bal:* Rare.

### GWE-D17 Legend Council
- *Desc:* Legends vote every 100 runs.
- *How:* A tally partly tied to your actions changes boss rosters.
- *Trigger:* 100 runs.
- *Feel:* Epic.
- *Deps:* boss rosters.
- *Rar:* XR.
- *Pay:* Roster changes.
- *Cx:* L.
- *Bal:* Cosmetic changes first.

### GWE-D18 The Rival Legend
- *Desc:* Your rival catches a legend.
- *How:* The legend appears in the final fight if you let them.
- *Trigger:* Rival rank.
- *Feel:* Tense.
- *Deps:* rival.
- *Rar:* R.
- *Pay:* A showdown.
- *Cx:* M.
- *Bal:* Scaled.

### GWE-D19 Legend's Debt
- *Desc:* A spared legend returns the favour.
- *How:* It intervenes at a pivotal fight in a later run.
- *Trigger:* Spared a legend.
- *Feel:* Triumphant.
- *Deps:* memories.
- *Rar:* XR.
- *Pay:* A rescue.
- *Cx:* M.
- *Bal:* Once.

### GWE-D20 Mythical Stamp Rally
- *Desc:* A 12-shrine stamp card.
- *How:* Complete to summon a mythical on one special day.
- *Trigger:* Shrine visits.
- *Feel:* Collectible.
- *Deps:* shrines.
- *Rar:* R.
- *Pay:* A mythical.
- *Cx:* L.
- *Bal:* None.

## D3. Natural and Cosmic Phenomena

### GWE-D21 Aurora Season
- *Desc:* Auroras for a week.
- *How:* Psychic and Ice moves glow and are slightly stronger; photos unlock a cosmetic.
- *Trigger:* Winter week.
- *Feel:* Beautiful.
- *Deps:* cosmetics.
- *Rar:* U.
- *Pay:* Cosmetic.
- *Cx:* S.
- *Bal:* Small boost.

### GWE-D22 Double Rainbow
- *Desc:* A rainbow after rain.
- *How:* Spawns a golden-tinted rare wild.
- *Trigger:* Random.
- *Feel:* Joyful.
- *Deps:* weather.
- *Rar:* XR.
- *Pay:* A rare.
- *Cx:* S.
- *Bal:* None.

### GWE-D23 Solar Flare
- *Desc:* Electric overcharge.
- *How:* Shocks fire randomly; device items malfunction.
- *Trigger:* Solar date.
- *Feel:* Zappy.
- *Deps:* items.
- *Rar:* U.
- *Pay:* Fun risk.
- *Cx:* S.
- *Bal:* No lethal outcomes.

### GWE-D24 Comet Pass
- *Desc:* A 76-day comet.
- *How:* Dragon encounters rise; a comet shard item exists for that run only.
- *Trigger:* Every 76 days.
- *Feel:* Spectacular.
- *Deps:* items.
- *Rar:* R.
- *Pay:* Shard.
- *Cx:* S.
- *Bal:* One shard.

### GWE-D25 Tidal Wave Warning
- *Desc:* A run-long countdown.
- *How:* Surviving grants a Water blessing.
- *Trigger:* Coastal season.
- *Feel:* Tense.
- *Deps:* timer.
- *Rar:* U.
- *Pay:* Blessing.
- *Cx:* M.
- *Bal:* Fair timer.

### GWE-D26 Drought
- *Desc:* Water dries up.
- *How:* Grass shrinks; fire spreads; rain-dance rituals end it.
- *Trigger:* 3 runs.
- *Feel:* Dry.
- *Deps:* weather.
- *Rar:* U.
- *Pay:* Ritual reward.
- *Cx:* M.
- *Bal:* Mild.

### GWE-D27 Earthquake Swarm
- *Desc:* Tremors shuffle stops.
- *How:* One stop shifts each battle; a seismologist gives a prediction tool afterwards.
- *Trigger:* Random.
- *Feel:* Rumbly.
- *Deps:* map.
- *Rar:* U.
- *Pay:* Tool.
- *Cx:* M.
- *Bal:* Path remains valid.

### GWE-D28 Blue Moon
- *Desc:* A second full moon.
- *How:* Moon moves gain an extra effect; a special boss appears only then.
- *Trigger:* Second full moon of a month.
- *Feel:* Rare.
- *Deps:* calendar.
- *Rar:* XR.
- *Pay:* Boss reward.
- *Cx:* S.
- *Bal:* None.

### GWE-D29 The Day the Sun Didn't Rise
- *Desc:* Perpetual night.
- *How:* All fights use dark/night mechanics; the next day brings relief.
- *Trigger:* Rare date.
- *Feel:* Eerie.
- *Deps:* day/night.
- *Rar:* XR.
- *Pay:* Ghost/Dark bonuses.
- *Cx:* M.
- *Bal:* Symmetric.

### GWE-D30 Meteor Shower Wishes
- *Desc:* Falling stars.
- *How:* Tap three falling stars for small boons; the last is a Wishing Star item.
- *Trigger:* Shower nights.
- *Feel:* Wonder.
- *Deps:* items.
- *Rar:* U.
- *Pay:* Boons.
- *Cx:* S.
- *Bal:* Small.

### GWE-D31 Magnetic Storm
- *Desc:* Steel/Electric attraction.
- *How:* Forced doubles pairings.
- *Trigger:* Random.
- *Feel:* Chaotic.
- *Deps:* doubles.
- *Rar:* U.
- *Pay:* Fun.
- *Cx:* S.
- *Bal:* Fair.

### GWE-D32 Volcanic Ash Winter
- *Desc:* Ash dims colours.
- *How:* Grass growth lowers; Rock types thrive for a month.
- *Trigger:* After a volcano event.
- *Feel:* Grey.
- *Deps:* A17.
- *Rar:* R.
- *Pay:* Rock boosts.
- *Cx:* M.
- *Bal:* Mild.

### GWE-D33 Poison Mist Drift
- *Desc:* A mist drifts.
- *How:* Where it lands decides a Poison outbreak.
- *Trigger:* Between runs.
- *Feel:* Spooky.
- *Deps:* encounters.
- *Rar:* U.
- *Pay:* Poison spawns.
- *Cx:* M.
- *Bal:* Antidotes cheap.

### GWE-D34 Time Slips
- *Desc:* Past and future bleed.
- *How:* Bag items appear aged or fresh.
- *Trigger:* Rare day.
- *Feel:* Strange.
- *Deps:* items.
- *Rar:* XR.
- *Pay:* Fun.
- *Cx:* M.
- *Bal:* Cosmetic.

### GWE-D35 Pollen Season
- *Desc:* Allergies.
- *How:* Allergy statuses; double berry drops.
- *Trigger:* Spring.
- *Feel:* Sniffly.
- *Deps:* status effects.
- *Rar:* C.
- *Pay:* Berries.
- *Cx:* S.
- *Bal:* Mild.

### GWE-D36 Tidal Bloom
- *Desc:* Glowing algae.
- *How:* Night routes are safer and prettier.
- *Trigger:* Summer nights.
- *Feel:* Magical.
- *Deps:* night.
- *Rar:* U.
- *Pay:* Safer routes.
- *Cx:* S.
- *Bal:* None.
