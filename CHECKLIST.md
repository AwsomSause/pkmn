# Implementation checklist

Status of every feature. "Done" means implemented **and** tested (unit tests and/or a browser test).

## Milestone 0 — Baseline ✅

- [x] Vite + TypeScript (strict) + Phaser 3.90 project
- [x] Vitest unit tests, Playwright browser tests
- [x] GitHub Actions CI: type check, unit tests, build, browser tests
- [x] Architecture rule: `src/core` never imports Phaser (enforced by a unit test)
- [x] Asset catalog, manifest generator, import script, placeholders for missing files

## Milestone 1 — Vertical slice ✅

- [x] Main menu: Continue (only with a valid save), New Run, Sound on/off, profile stats, save warnings
- [x] Trainer select: Red / Blue / Green from data, pros and cons shown
- [x] Starter select: 3 distinct, seeded, first-stage species from a 12-species pool
- [x] Wild battles with the Gen 9-style baseline ruleset:
  - [x] damage formula, STAB, type chart (18 types), immunities
  - [x] accuracy and accuracy/evasion stages, critical hits (with crit stages)
  - [x] priority → Speed → seeded tie-break turn order
  - [x] status conditions: burn, poison, paralysis, sleep, freeze (incl. type and powder immunities)
  - [x] stat stage moves, secondary effects (status chance, flinch, stat drops), drain, recoil, fixed damage
  - [x] PP, Struggle when out of PP
  - [x] fainting, victory and defeat
- [x] No running from battles (director decision D3)
- [x] XP (Blue +25%) with level-ups and new moves while a slot is free
- [x] Money for wins (Green +25%)
- [x] Enemy levels from a prototype curve, with Blue +2 / Green −1 and level caps
- [x] Five distinct reward choices, pick exactly one, applied immediately
- [x] Next encounter after each reward
- [x] Save at safe checkpoints (starter pick, every turn, reward pick, run end)
- [x] Continue after refresh resumes exactly; reward screen shows the same five choices
- [x] Damaged saves detected; backed up (never deleted) before starting fresh
- [x] Saves from newer versions refused; migration framework for older ones
- [x] Defeat ends the run; profile statistics updated exactly once
- [x] Debug panel (F2): run state, heal, replace wild Pokémon, seeded new run, asset report

### Known limits in Milestone 1 (by design, documented)

- ~~Party is always one Pokémon~~ (done in Milestone 2).
- ~~New moves skipped when four are known~~ (done in Milestone 2).
- ~~No Bag/battle items~~ (done in Milestone 2).
- Encounters are a straight sequence, not a stage map (Milestone 3).
- Luck and the other nine attributes are stored but have no effect until their formulas are approved.
- ~~Move animations from the supplied pack are not played yet~~ (done in Milestone 9, battle animations).
- ~~Prototype learnsets are hand-written and simplified to supported moves~~ (full data import done in Milestone 6).
- ~~Damage uses whole-number rounding after each step~~ (main-game rounding since Milestone 8.75 part C).
- ~~If both Pokémon faint in the same turn, the player wins~~ (since Milestone 8.75 part C: the user of Explosion loses, the user of a recoil move wins; otherwise the player wins).

## Milestone 2 — Battle completeness ✅

- [x] Battle menu: Fight / Bag / Pokémon (still no running, D3)
- [x] Bag: Poké / Great / Ultra Balls, Potion, Super Potion, Hyper Potion, Full Heal, Full Restore, Ether, Revive, Last Stand Charm
- [x] Items in battle use the turn; the opponent still moves
- [x] Items outside battle, on the reward screen (Bag button)
- [x] Catching: modern catch formula (HP, catch rate, ball, status), seeded roll, 0–3 shakes shown, Green's 0.85 capture modifier
- [x] Balls can't be thrown at a trainer's Pokémon
- [x] Party of up to 6; party screen with HP, level, status, fainted marker
- [x] Switching uses the turn; after a faint the player must send out another Pokémon (no turn used)
- [x] Caught Pokémon: add to party, or (party full) replace a member with confirmation, or release for candies with confirmation
- [x] Candies saved with the run and added to the profile once at run end (D7)
- [x] Trainer battles with teams of 1–3: intro, sends out the next Pokémon, prize money = class rate × highest level
- [x] Experience shared by every Pokémon that took part and is still standing
- [x] Move learning: choose a move to forget, or skip, with confirmation; never offered twice
- [x] Standard level-up evolution (D15), after battles and Rare Candies; fainted Pokémon don't evolve
- [x] Last Stand Charm: the last healthy Pokémon survives a knockout once at 1 HP; the charm is used up
- [x] Rewards for one Pokémon (vitamins, Rare Candy) ask which party member gets them
- [x] Reward screen: change the lead Pokémon
- [x] Shiny wild Pokémon (1/2000, D8) with shiny sprites and a sparkle
- [x] Party icons, ball icons, trainer battle music, ball sounds from the asset packs
- [x] Save format v2 (run and profile) with automatic upgrade of v1 saves; saves checked for unknown items and trainers
- [x] Debug panel: give items, add a Pokémon to the party

### Known limits in Milestone 2 (by design, documented)

- Trainers appear every 4th encounter as a placeholder; the stage map (M3) will place them.
- Enemy trainers don't use items or switch on purpose; their AI picks a random usable move.
- The party is not healed between battles except by items (healing nodes arrive with the map in M3).
- Stone and trade evolutions are not in yet (Vulpix and Growlithe don't evolve).
- Candies can be earned but not spent yet.
- Levels are capped at 100 for now (see the open question on D14).

## Milestone 3 — One full stage ✅

- [x] Stage themes: all 153 type pairs, each with a name (director's examples kept); theme decides wild Pokémon, trainers and gym leader
- [x] 89 species and 94 moves (every type has wild Pokémon and a trainer class); 70 gym leaders with sprites
- [x] Level-up moves imported from the director's move dataset (`npm run data:movesets`)
- [x] 323 moves imported from the director's move list (`npm run data:moves`); moves needing new battle features are listed for later
- [x] Layered stage map: 20 columns of 1–3 nodes, forks, no crossing paths, exactly 2 trainer columns, gym in column 20
- [x] Map validator (dead ends, unreachable nodes, skipped columns, trainer columns, single gym), checked over hundreds of seeds
- [x] Map screen: theme name and types, level counter, money, badges, scrolling, risk labels on harder routes
- [x] Harder routes: +1–2 enemy levels and better reward odds; gym rewards use the best odds
- [x] Healing spot (once) and shop (buy with run money) beside nodes; a healing spot always before the gym
- [x] Gym leader battle with intro, sprite and badge; then the next stage starts with a new theme and leader
- [x] Battle backgrounds follow the theme (arena art from the asset pack)
- [x] Difficulty model with a full breakdown in the debug panel; debug jump to any column
- [x] Party and Bag usable from the map
- [x] Save format v3 with automatic upgrade of v2 runs; reload resumes on the map

### Known limits in Milestone 3 (by design, documented)

- Shop prices are placeholders, and the shop has a fixed stock.
- The difficulty curve is a straight line tuned for the first gym (about level 20); it needs a per-region curve in M4.
- Gym leaders use the theme's Pokémon rather than their famous teams.
- After the first gym the run continues into more stages, but regions, the Elite Four and the champion come in M4.

## Milestone 4 — One full region + dev campaign ✅

- [x] Regions in data (Kanto to Paldea, Alola, Grand) with their own gym leaders, Elite Four and champions; 51 league sprites from the asset pack
- [x] Shuffled region order per run, each region once, Grand Region last
- [x] 8 stages per region, then the Pokémon League map: Elite Four in a line, then the champion
- [x] Full heal on entering the league and after every Elite Four win; a reward draft after each win (D13)
- [x] Elite Four teams from their speciality type; champions from their speciality or the region's stage themes
- [x] Bosses never repeat in a run across gym leader, Elite Four and champion roles (D6), as long as the data has enough people
- [x] Level cap per region (D14): 50, then 100; experience and level-up rewards stop at the cap
- [x] Difficulty curve per region (first gym ace about 20, first champion 50)
- [x] Region transition after the champion, and a victory screen after the last one
- [x] Developer campaign (2 regions × 2 stages × 5 levels, Elite Four of 2): `?campaign=dev` or the debug panel
- [x] Shop stock unlocks with badges; prices now follow the main games
- [x] Map and battle screens show the region, level cap, league, Elite Four and champion titles and sprites
- [x] Debug panel: region info, jump to the league, start a run in either campaign
- [x] Save format v4 with automatic upgrade of v3 runs

### Known limits in Milestone 4 (by design, documented)

- Levels stop at 100 for now, so regions 3 onward are all level 100. D14 is decided (up to 500) and is built in Milestone 8.75.
- ~~A full run needs more gym leaders (80) and Elite Four members (40) than the data has (70 and 38); the last regions reuse people.~~ Fixed by the boss teams below (229 bosses).
- The Grand Region has no roster, final boss or ending yet (M9); it plays like a regular region with borrowed leaders.
- ~~Gym leaders, Elite Four and champions use type- or theme-based teams rather than their famous teams.~~ Fixed by the boss teams below.
- The profile doesn't count wins yet (M5).

## Milestone 5 — Out-of-Run progression ✅

- [x] The Hub: start a run, Trainer Archive, Achievement Hall, Bank, Run History, save data
- [x] Counters for wins, bosses, regions, catches, shinies, evolutions and money, merged into the profile when a run ends
- [x] 31 achievements in data (9 categories, chains with tiers, 2 hidden) paying Bank Credits, Research Points, candies or titles
- [x] Bank Credits: savings from leftover money plus a stipend for progress, shown on the run-end screen
- [x] Research Points for new species seen and caught, and for shinies
- [x] Trainer unlocks: Brock, Misty and Giovanni with their passives, claimed in the Trainer Archive for Bank Credits; Cynthia shown as coming later
- [x] Titles from achievements, shown on the profile
- [x] Run History with the last 20 runs, including what defeated you
- [x] Save export and import
- [x] Developer campaign runs don't count toward progress
- [x] Save format: profile v3 and run v5, with automatic upgrades

### Known limits in Milestone 5 (by design, documented)

- Achievements are checked at the end of a run, not the moment they happen.
- ~~Oak and N aren't in the Archive until they have sprites~~ (sprites supplied; both are in the Archive as "coming later"). Cynthia's, Oak's and N's passives come in Milestone 8.75.
- Research Points pile up but have nothing to buy until the Starter Laboratory (M5.5).

## Milestone 5.5 — Run-Prep ✅

- [x] Preparation Desk after choosing a trainer: campaign, starter pool, draft rule, focus type, preparation, seed, with a Run Build Summary
- [x] Starter pools in data (Classic, Johto, Hoenn, Research, Rare, Grand), unlocked with Research Points in the Starter Laboratory
- [x] Pools list future species safely; they appear once the full Pokédex arrives
- [x] Draft rules: Standard, Balanced, Blind, Type Focus, with a clear fallback note instead of endless rerolls
- [x] Preparation tokens: Pocket Money, Ball Bundle, Field Kit (one per run)
- [x] Bank licenses: Type Specialist, Field Medic, Research
- [x] Loadout presets (3 slots), with unavailable choices resolved before the run starts; the last run's choices are remembered
- [x] Campaign briefing: region order, first stage, starting resources, rules, seed with Copy seed
- [x] Save format: profile v4 and run v6, with automatic upgrades

### Known limits in Milestone 5.5 (by design, documented)

- Johto and Hoenn were incomplete until Milestone 6; every pool is now complete.
- Only three licenses and three tokens so far; Bank tiers, challenge modifiers and starter mastery come later.

## Milestone 6 — Content scale-up ✅

- [x] Every species (1,025) and 264 forms from PokeAPI's open data (`npm run data:species`): types, base stats, catch rates, experience, growth rates (incl. erratic and fluctuating), legendary/mythical/baby tags, pre-evolutions
- [x] Regional forms (57), alternate forms (52), and Mega/Gigantamax/Primal/battle-only forms stored for M8.5 (never met yet)
- [x] Level-up moves for every species and form from the director's move dataset; egg and other learnable moves in `learnables.json` (tools only)
- [x] All 934 moves from the director's move list; 611 flagged "not supported" with what they need, kept in learnsets, never learned or used
- [x] Evolution rules: level, stones and other items, trade (held item or Linking Cord), friendship (Soothe Bell), branches, Tyrogue, regional evolutions
- [x] 44 evolution items: usable from the Bag, with a choice when there are several results; in the reward draft only when useful; stones in shops
- [x] Trainers' Pokémon evolve by item at level 30 (babies at 15)
- [x] Wild eligibility (first stage, not legendary/mythical/special forms, base stats ≤ 560, has supported moves) and region eligibility (native Pokémon 3× as likely)
- [x] Sprites, shiny sprites, icons and cries for every species and form (form-aware file names), loaded on demand instead of at start-up
- [x] Cries play when a Pokémon appears in battle

### Known limits in Milestone 6 (by design, documented)

- 611 moves (Protect, multi-hit moves, weather, healing, …) are not supported by the battle engine yet, so many Pokémon know fewer moves than in the main games. Ditto, Smeargle, Unown, Cosmog and Abra have no supported moves and don't appear.
- Gender, time of day and weather don't exist, so evolutions that depend on them use the rules in GAME_DESIGN.md §5c.
- A few forms have no art of their own in the pack and use their species' art (White-Striped Basculin, Mega Floette, Mega Meowstic).
- ~~Battle animations from the pack are still not played~~ (done in Milestone 9, battle animations).

## Milestone 7 — Attributes and luck

- [x] Six attributes (0–100) and two meters (Rage/Peace, Good/Evil, −100–100), permanent value + run modifiers
- [x] Effect formulas approved by the director: each point is worth the full percentage, no cap
- [x] Permanent growth by type defeated or caught, stats boosted, catches, shinies, evolutions and keeping your starter
- [x] Luck tilts the reward draft toward uncommon and rare, and raises the shiny chance
- [x] Love: a chance to hang on at 1 HP, once per Pokémon per battle
- [x] Charisma: cheaper shop and more experience
- [x] 11 attribute rewards in the after-battle draft, 9 attribute items in the shop
- [x] Hub Attributes room, attributes on the Run Build Summary, Briefing and run-end screen
- [x] Saves upgrade (profile v5, run v7)
- [ ] Special encounters and "Between-Level" interactions that change attributes (moved to Milestone 8.75, part A/B)
- [x] Friendship from Charisma (done in Milestone 8.75, part B)

## Milestone 8 — Custom Pokémon and forms ✅

- [x] `npm run data:custom -- <new_sprites.zip>` builds `customSpecies.json` / `customEvolutions.json` and converts the sprites; kept apart from PokeAPI's data so either import can be re-run
- [x] 255 Insurgence Delta entries with Insurgence's own types, stats, evolutions and level-up moves (incl. 22 Delta Megas, battle-only forms, Delta Ditto's type forms, designed extras)
- [x] 31 Z-Forms (incl. new species Bruticate and Alphayena), 28 Z-Megas, 15 Spooky forms, designed in `tools/custom-forms.json` (rules in GAME_DESIGN.md §5d)
- [x] Front, back, shiny and shiny back sprites for every entry; icons where supplied, Minior's otherwise
- [x] First-stage forms appear in the wild; Megas and battle-only forms wait for M8.5
- [x] Unit tests (data, evolutions, learnsets, art on disk) and a browser test (custom sprites in battle)

### Known limits in Milestone 8 (by design, documented)

- The pack's female sprites and Delta Ditto's ??? sprite aren't used (no gender, no ??? type).
- Sprites are single frames (the pack has no animations); a missing shiny reuses the normal sprite, a missing back sprite the mirrored front.
- Cries are the base species' cries.

## Milestone 8.5 — Advanced mechanics (in progress)

Rules in GAME_DESIGN.md §5f; build notes in IMPLEMENTATION_PLAN.md §6h5.

- [x] Mega Evolution: Mega Ring key item (draft + shop), 145 Mega Stones (`npm run data:megas`), once per battle, one transformation per Pokémon, changes back after battle, boss aces from gym 5 and in the league, challenge switch, battle menu option with a flash and the new sprite
- [x] Primal Reversion with the Red and Blue Orbs
- [x] Tests: unit (rules, data, save/load mid-battle, rewards and shop) and a browser test
- [x] Terastallization: Tera Orb (draft + shop), Tera Type per Pokémon, 18 Tera Shards, STAB and 60-power rules, boss aces, battle menu option, badge and tint, unit and browser tests
- [x] Z-Moves: Z-Ring (draft + shop), 18 type Z-Crystals, Z-power from Showdown data, status Z bonuses, Protect, battle menu option, drawn icons, unit and browser tests (species-exclusive Z-Moves and boss Z-Moves still to come)
- [ ] Dynamax / Gigantamax
- [ ] Regional forms as a mechanic (if still wanted)

## Milestone 8.6 — Systems audit and quality gates ✅

- [x] SYSTEMS_AUDIT.md: real status of every planned system, with the code and tests behind it
- [x] FEATURE_INTERACTION_MATRIX.md: where each pair of systems meets and which meeting points are tested
- [x] QUALITY_GATES.md: the gates, what runs automatically, the content gate and the balance report
- [x] `npm run report:content`: counts and offending ids for unsupported moves, species with no usable moves, missing sprites and cries, map problems, duplicate boss teams, broken evolutions, unused balance settings, untested save upgrades
- [x] A support status (supported / limited / disabled / invalid) on every species, form, move, item and evolution, with reasons
- [x] `npm run report:balance`: seeded battle simulations (species strength, difficulty curve), written to docs/quality/BALANCE_REPORT.md
- [x] `npm run report:check` in `npm run check` and CI: fails when a content number gets worse than tools/content-baseline.json

### Known limits in Milestone 8.6

- GitHub Actions has never run on the repository, so CI (including the new gate) only runs when switched on in the repository settings.
- The balance simulations use a fresh party with no items; they show the curve's shape, not real win rates.
- Abilities, held items and battle mechanics have no entries to give a status to until they exist.

## Milestone 8.75 — Planned features catch-up (planned)

Everything planned but not yet in a milestone, gathered on 2026-10-25. Details in IMPLEMENTATION_PLAN.md §6j.

- [x] B. Friendship on each Pokémon (gains from levels, wins and vitamins; loss on fainting); Charisma raises friendship gains; real friendship evolutions at 220 (Soothe Bell kept); hearts on the party screen; run save v8
- [ ] B. N's friendship passive and friendship event outcomes (with part A, the events)
- [x] C1. Moves tier 1 (85 moves): confusion, multi-hit, recharge, healing, Protect, one-hit KOs, Explosion, False Swipe, binding, Leech Seed, Flail, Brine, Psyshock, Chip Away, always-crit; main-game damage rounding; both-faint rule
- [x] C2. Two-turn moves (Solar Beam, Sky Attack, Skull Bash; Fly, Bounce, Dig, Dive, Phantom Force hide the user) and the moves that reach them (Earthquake, Gust, Surf, Thunder, Sky Uppercut); Thrash, Outrage, Petal Dance; weather (rain, sun, sandstorm, snow, hail) with Weather Ball, Synthesis/Moonlight/Shore Up healing and Thunder/Hurricane/Blizzard accuracy; Fake Out and First Impression (28 more moves)
- [ ] C2b. Terrain and the rare moves (498 still unsupported, 89 of them Z-Moves and Max Moves for M8.5)
- [ ] C3. Abilities; enemy trainers use items and switch on purpose (held items are part of the item effects work)
- [x] Item effects, slice 1 (director, 2026-10-25: every item except Potions and Poké Balls gets its own effect): item catalog of 574 items (itemCatalog.json, each with a status); 127 work now as draft rewards: attribute items (Heart Scale +2 Love, shards, berries, mail), valuables sold for money, Wings, friendship berries, healing and care items, PP Up/PP Max, TMs (1 of 3 random moves) and HMs (any move) of 17 types, the 9 fossils, and run-long perks (Amulet Coin, Luck Incense, Exp. Share, Coin Case, Teachy TV, Photo Album, Fashion Case); a new Epic rarity; drafts of five with variety from Luck; a team or player item at its max is a free re-roll; evolution items nobody can use can be cashed in from the Bag for attributes; icons from the director's pack
- [x] Item effects, slice 2: 198 more items work (325 of 574 in all). 164 held items (a Pokémon can hold many, each up to its max): type boosters and Plates, Gems (once a battle), Choice Band/Specs/Scarf, Life Orb, Expert Belt, Leftovers, Black Sludge, Focus Sash and Focus Band, Rocky Helmet, King's Rock, Toxic and Flame Orbs, Air Balloon, Power Herb, White Herb, Shed Shell, Macho Brace, Everstone, Power items, Prism Scale, the Scarves and 40 berries (healing, curing, PP, stat, resist and pinch berries). 34 battle boosts (X items, Dire Hit, Guard Spec.) last the first 5 turns of the next battle. Bosses hold items (Gym Leaders 1, Elite Four 2, Champions 3, rarer each region) from their own random generator, so no other roll changes. Held items show on the party screen. 14 battle items stay disabled with the reason written down (screens, forced switching, Taunt-type moves, form items, a few berries)
- [x] Item effects, slice 3a: 45 wild-encounter and catching items (370 of 574 work now). Repels skip wild battles (the level still counts); Black and White Flutes change wild levels for the rest of the stage (White also +25% EXP); Incense and type Mail make a type more common; Mosaic, Glitter, Dream and Retro Mail change the next stage's wild Pokémon; Honey and Dream Mail bring the strongest of three; Unown Report brings Unown; Bluk Berry, Poké Doll (the wild Pokémon loses its first turn), Poké Toy (its Speed -1); Apricorns and the Fluffy Tail raise the catch rate; Poké Radar doubles the shiny chance; Cleanse Tag, Full, Lax and Pure Incense are held items; Blue Flute is a battle boost. The map screen lists the items that are working. Their random rolls use a generator of their own. Red Flute and Poké Flute wait for infatuation and wake-up rules
- [x] Item effects, slice 3b-1: 12 shop and money items (382 of 574 work now): Coupons (-10/25/50% on the next purchase), Point Card (every 10th purchase free), Member Card and Wepear Berry (shops sell the next locked item early), Bead and Reply Mail (trainers pay more), Soot Sack (wild money on Fire stages), Loot Sack and Blue Card (Bag items after trainer wins), Pass Orb (money each new region). The shop marks early items and free prices. Seal Bag and Pass wait for selling and region shops
- [ ] Item effects, slice 3b-2: getting around the map (Bikes, Escape Rope, Town Map, Devon Scope, VS Seeker…); 3b-3: extra map stops (Rods, Wave/Tropic/Harbor and Bridge Mail) and draft items (Dowsing Machine, Bloom Mail, Cornn Berry…); slice 3c: berry, delivery and gadget items; slice 4: items that open events, with their events built too
- [ ] D. Bank tiers 1–5; Scavenger, Fortune and Survival licenses; challenge modifiers and challenge campaigns; contracts; item catalog and the other Bank services; spending candies; more preparation tokens
- [ ] E. Pokédex & Research room; starter mastery and trainer mastery tracks; remaining draft rules; starter events; Special Specimen starters; achievements checked as they happen
- [x] F. Oak's and N's sprites in the game; both listed in the Trainer Archive as "coming later"
- [ ] F. Cynthia's, Oak's and N's passives; Gold, Silver, Crystal, Brendan, May, Wally, Dawn, Lucas, Barry, Looker; Trainer Research
- [x] G. Peace and Charisma balance pass: half a percent per point (Peace 100 halves damage, Charisma 100 is half price)
- [ ] G. Party-strength correction in difficulty; levels above 100 up to 500 (D14); custom regions (Torren and others, D6)
- [ ] H. Later Out-of-Run systems (wardrobe, hub upgrades, Hall of Fame, Berry Garden, Training Center, Intelligence Board, Item Museum, Research Tree, Prestige, Legacy, Trainer Network, Rival Ghosts, shared seeds)
- [ ] A. Event system; new map stops: special encounters, events, trades, detours, rare Pokémon; merchants (Giovanni's black market); events that change attributes; "Between-Level" interactions — built last, designed with the director first in the Events and map stops plan
- [ ] Optional: IVs/EVs/natures; gender, time of day and weather

## Milestone 8.9-0 — Story foundation ✅

The shared layer every story system reads (design: docs/plans/hyper-overdrive-techno.md §7–9 and the Electric plan; how it works: docs/story-foundation.md).

- [x] 28 domain event types with deterministic ids (seed + sequence number), recorded from the run's actions and each battle turn
- [x] Story effects with ids; the save keeps the applied ids, so an effect never applies twice (battle-scope ids live in the battle and go when it ends)
- [x] Presentation cues (banner, colour, sound, shake) that the rules never read; the battle screen shows them
- [x] PokemonHistory per uid (survives evolution), RelationshipRecord, EnemyProfile, RunChronicle, with the plan's limits (20 memories, 12 open relationships, 6 enemies per run and 3 per region, 300 chronicle entries)
- [x] Event queue: the plan's priority order, one combat effect per turn, merged banners, 3 cinematic moments per battle
- [x] New "story" and "hyper" random streams; old seeds play exactly as before (pinned by fingerprints taken on main)
- [x] Love's "hung on at 1 HP" runs through the story layer as its first user (story.json "love-hung-on")
- [x] Run save v9 and profile save v6 upgrades
- [x] Debug Story Log (F2); the run-end screen and the Run History show the run's top five moments

### Known limits in Milestone 8.9-0 (by design, documented)

- Trades, escapes, Mega/Tera/Z/Dynamax and map events don't exist yet, so their event types (`traded`, `trainerEscaped`, `transformed`, `eventChoice`) are defined but not emitted.
- Knockouts don't record overkill yet (the engine caps damage at the HP left; adding the raw number needs an engine change, left for the Hyper slices).
- Relationships and recurring enemies have their records, limits and functions, but nothing creates them yet: that is M8.9 (rivals, nemesis).
- Only the newest 250 domain events are kept in the save; histories and the chronicle keep what matters from older ones.

## Milestone 9 — Grand Region, ending, deploy

See IMPLEMENTATION_PLAN.md §5.

### Battle animations (done)

- [x] PokeRogue's animation frame data (from its asset repo; the packs only had the sprite sheets) converted to a compact format by `npm run data:anims`: 887 animation files, 492 sprite sheets, 1,111 sounds (WAV turned into small .m4a)
- [x] Every move has a presentation definition in `src/data/moveAnims.json` (animation, shake, flash colour, hit-stop, telegraph), kept apart from its rules: 851 moves use their own animation, 83 borrow one of their type; two-turn moves have a wind-up animation
- [x] A presentation-cue layer (`src/core/presentation/cues.ts`) plans what the screen shows from the finished turn; it never changes battle state or draws random numbers (unit tests check both)
- [x] The animation player (`src/ui/battleFx/`) draws sheet pieces, moves the Pokémon, plays sounds and background fades; status, healing, confusion, binding, Leech Seed, Protect and weather animations too
- [x] Feedback: hit-stop, field-only screen shake, type-coloured flashes, floating damage and heal numbers, Super effective / Not very effective / No effect / Critical hit badges, an HP bar that drains smoothly with a trailing "damage ghost", telegraph rings (speed lines for priority moves), stat arrows
- [x] Settings on the title screen: Animations Full / Reduced motion / Off, Effects 100% / 50% / 25%; Enter or a click skips a playing animation; new players whose browser asks for reduced motion start on Reduced motion (settings save v2)
- [x] Animation files load the first time a move is used (and the moves on the field load while you read); a file that is missing, damaged or slow (1.5 s) plays a short fallback (lunge and flash)

Known limits: a frame that shows two copies of the same Pokémon shows one; colour tones can only darken; animation backgrounds fill the field rather than PokeRogue's exact scroll; Fly/Dig don't hide the user's sprite yet; boss cinematics are M9.5.

- [ ] Grand Region roster, final boss, ending, music, static deploy

## Boss teams (director request, 2026-10-25)

- [x] 229 bosses in `bosses.json` (every trainer in the boss pack plus the earlier gym leaders, Elite Four and champions), with the pack's portraits
- [x] Any boss can be a gym leader, Elite Four member or champion; nobody repeats in a run (229 bosses cover the 130 boss battles of a full run)
- [x] 16 gym teams per boss (1–8 first eight stages, 9–16 next eight, 16 repeats after)
- [x] 10 Elite Four teams and 10 champion teams per boss, one per region, getting harder
- [x] Team generator `npm run data:bosses` (signature Pokémon, moves, training, clever move choice)
- [x] Green's archetype uses the boss pack's Green portrait
- [x] Teams rebuilt on the full species data (M6): every signature Pokémon is in the game

## Milestone 10 — Visuals and presentation (planned)

A milestone purely for looks: a shared visual style, redesigned screens, transitions and animations, and a final layout pass. No gameplay changes. See IMPLEMENTATION_PLAN.md §5.
