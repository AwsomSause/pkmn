# Implementation checklist

Status of every feature. "Done" means implemented **and** tested (unit tests and/or a browser test).

Milestones 0–6 are done and moved to [docs/archive/checklist-m0-m6.md](docs/archive/checklist-m0-m6.md). Short current state: [STATUS.md](STATUS.md).

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
- [x] Dynamax / Gigantamax: Dynamax Band (draft + shop), double HP for 3 turns, Max Moves and Max Guard from Showdown data, 33 G-Max Moves, weather and stat effects, battle menu option, unit and browser tests (terrain and most G-Max side effects still to come)
- [x] PokeRogue-style limits (director 2026-10-29): Mega and Gigantamax forms by themselves in every battle; Tera, Z-Moves and Dynamax once per battle
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
- [x] C-terrain. Terrain: Electric, Grassy, Misty and Psychic Terrain (5 turns, set by the moves or by Electric/Grassy/Misty/Psychic Surge), and the four terrain Max Moves (Max Lightning, Overgrowth, Starfall, Mindstorm). On the ground only (not Flying or Levitate): Electric/Grassy/Psychic boost their type 30%; Electric stops sleep; Misty stops every status and halves Dragon moves; Grassy heals 1/16 a turn; Psychic blocks priority moves. Not yet: Terrain Pulse, Seed Sower, Mimicry, Terrain Extender, Rising Voltage-style moves
- [x] Transformation leftovers (part): bosses use Z-Moves and Dynamax (an Elite Four ace's one Z-Move per battle; the champion's ace Dynamaxes); G-Max Finale, Sweetness, Stun Shock and Befuddle effects. Still not done: the G-Max moves that need hazards, Gravity, DoT or PP effects, and the species-exclusive Z-Moves (no data for them in the repo)
- [x] C2b (partial). Everything-left PR: ~270 moves now run (power rules, fixed damage, screens, hazards, Tailwind, pivots, Disable/Encore/Taunt, Substitute, Perish Song, Trick Room, Gravity, ability tricks, Stockpile, triple hits, and more). 230 still unsupported (known limits: Z/Max/G-Max rows, weight moves, item moves, form-dependent types, delayed damage, doubles-only support moves are listed as no-ops in single battles; Feint does not break Protect; Piercing Drill is always quarter damage through Protect).
- [x] C3. Abilities: every Pokémon has one (random, hidden 1 in 20), 190 work in battle, shown on the party screen and announced in battle
- [x] C3b-1. 31 more abilities: Intrepid Sword, Dauntless Shield, Dragon's Maw, Rocky Payload, Steelworker, Transistor, Fire Mane, Dark/Fairy Aura + Aura Break, Neuroforce, Good as Gold, Corrosion, Tangled Feet, Wonder Skin, Spicy Spray, Toxic Chain (plain poison, the game has no bad poison), Sand Spit, Seed Sower, Bad Dreams, Grass Pelt, Surge Surfer, Hadron Engine, Orichalcum Pulse, Queenly Majesty / Dazzling / Armor Tail (tests/unit/abilities2.test.ts)
- [x] C2c. 49 more moves from effects the engine already has (Shell Smash, Swagger, the Torque moves, Lumina Crash, multi-hit darts, ...). About 345 rarer moves still need new systems (tests/unit/moves2.test.ts)
- [x] C3b-3. Trace (copies and runs the foe's ability), Protean and Libero (first move after coming in changes its type), Mummy and Lingering Aroma (contact spreads the ability). New per-battle fields `typeShift` and `abilityOverride`, reset on switch-out
- [x] C3b-2. Cloud Nine and Air Lock switch weather effects off (weather still runs out)
- [x] C3b-4. 30 more abilities: Neutralizing Gas, Eelevate, Guard Dog, Color Change, Cursed Body, Perish Body, Cotton Down, Toxic Debris, Piercing Drill, Unseen Fist, Supreme Overlord, Normalize, Liquid Voice, Moody, Wandering Spirit, Magic Bounce, the four Ruin abilities, Berserk, Anger Shell, and Shadow Tag / Arena Trap / Magnet Pull (they stop the player switching). 44 pending: form changes (Forecast, Zen Mode, Disguise, Ice Face, Schooling...), primal weather, Protosynthesis, Quark Drive, Illusion, Imposter, Stakeout, Stall, Quick Draw, Opportunist, Mirror Armor, Gorilla Tactics.
- [x] C2d + C3b-5. The last moves and abilities: ~120 rarer moves (stat tricks, typing, item moves, delayed hits, Bide, Snatch, Mimic, Transform, Sky Drop, Beat Up, Hidden Power, Natural Gift, Stuff Cheeks, Teatime, weight moves via species weight), and ~40 abilities (form changes through `swapForm`: Zen Mode, Schooling, Stance Change, Power Construct, Hunger Switch, Battle Bond, Disguise, Ice Face, Gulp Missile, Zero to Hero, Tera Shift, Forecast; primal weather; Bulletproof, Wind Rider, Sharpness, Parental Bond, Protosynthesis, Imposter and more). Later pass: Beat Up uses each party member's Attack, Sky Drop holds the target (it can't act, can be hit by Gust and Thunder), Mycelium Might ignores the foe's ability on status moves, and Illusion, Delta Stream, Multitype, Shields Down, Aura Guard and Teraform Zero work. Known limits: Hidden Power's type is a fixed roll per Pokémon (D2: no IVs); Shields Down has no separate Core form; a weather ability that fails against a primal weather still shows its start message. Z/Max/G-Max move rows stay unsupported on purpose (they run through the Z and Dynamax systems).
- [x] Item slice 4c: story items through events (Oak's Parcel, Letter, Parcel, Devon Goods, Scanner, Gold Teeth, Grams 1-3, Machine Part, Lost Item, Data Card, Odd Keystone, Meteorite, Kyurem's stones, Therian mirrors; new event conditions `partySpecies`/`eventSeen` and effect `formChange`), Pass (early shop stock), held Orbs/Gracidea/Lunar Wing/Enigma/God Stone/Dragon Skull/Go-Goggles/Poké Flute (new hooks `formHeld`, `statusImmune`, `weatherImmune`, `wakeAll`), real Attract (infatuation) with Captivate and Red Flute. Limits: Keldeo Resolution has no Resolute form; Dragon Skull boosts Dragon moves of the whole team.
- [x] Smarter enemy trainers: a boss (ai > 0) drinks one Hyper Potion under 30% HP and swaps up to twice when a teammate's moves are worth twice as much (balance.json trainerAi; uses no random numbers). Ordinary trainers are unchanged.
- [ ] C3b (rest, older note). The remaining ~80 abilities (Trace, Synchronize-style copies, Shadow Tag/Arena Trap, Illusion, Disguise, form changes, Neutralizing Gas, ...); enemy trainers use items and switch on purpose
- [x] Item effects, slice 1 (director, 2026-10-25: every item except Potions and Poké Balls gets its own effect): item catalog of 574 items (itemCatalog.json, each with a status); 127 work now as draft rewards: attribute items (Heart Scale +2 Love, shards, berries, mail), valuables sold for money, Wings, friendship berries, healing and care items, PP Up/PP Max, TMs (1 of 3 random moves) and HMs (any move) of 17 types, the 9 fossils, and run-long perks (Amulet Coin, Luck Incense, Exp. Share, Coin Case, Teachy TV, Photo Album, Fashion Case); a new Epic rarity; drafts of five with variety from Luck; a team or player item at its max is a free re-roll; evolution items nobody can use can be cashed in from the Bag for attributes; icons from the director's pack
- [x] Item effects, slice 2: 198 more items work (325 of 574 in all). 164 held items (a Pokémon can hold many, each up to its max): type boosters and Plates, Gems (once a battle), Choice Band/Specs/Scarf, Life Orb, Expert Belt, Leftovers, Black Sludge, Focus Sash and Focus Band, Rocky Helmet, King's Rock, Toxic and Flame Orbs, Air Balloon, Power Herb, White Herb, Shed Shell, Macho Brace, Everstone, Power items, Prism Scale, the Scarves and 40 berries (healing, curing, PP, stat, resist and pinch berries). 34 battle boosts (X items, Dire Hit, Guard Spec.) last the first 5 turns of the next battle. Bosses hold items (Gym Leaders 1, Elite Four 2, Champions 3, rarer each region) from their own random generator, so no other roll changes. Held items show on the party screen. 14 battle items stay disabled with the reason written down (screens, forced switching, Taunt-type moves, form items, a few berries)
- [x] Item effects, slice 3a: 45 wild-encounter and catching items (370 of 574 work now). Repels skip wild battles (the level still counts); Black and White Flutes change wild levels for the rest of the stage (White also +25% EXP); Incense and type Mail make a type more common; Mosaic, Glitter, Dream and Retro Mail change the next stage's wild Pokémon; Honey and Dream Mail bring the strongest of three; Unown Report brings Unown; Bluk Berry, Poké Doll (the wild Pokémon loses its first turn), Poké Toy (its Speed -1); Apricorns and the Fluffy Tail raise the catch rate; Poké Radar doubles the shiny chance; Cleanse Tag, Full, Lax and Pure Incense are held items; Blue Flute is a battle boost. The map screen lists the items that are working. Their random rolls use a generator of their own. Red Flute and Poké Flute wait for infatuation and wake-up rules
- [x] Item effects, slice 3b-1: 12 shop and money items (382 of 574 work now): Coupons (-10/25/50% on the next purchase), Point Card (every 10th purchase free), Member Card and Wepear Berry (shops sell the next locked item early), Bead and Reply Mail (trainers pay more), Soot Sack (wild money on Fire stages), Loot Sack and Blue Card (Bag items after trainer wins), Pass Orb (money each new region). The shop marks early items and free prices. Seal Bag and Pass wait for selling and region shops
- [x] Item effects, slice 3b-2: 12 items for getting around the map (394 of 574 work now). A new Items button on the map: Escape Rope (back to the last fork), Bicycle (two columns ahead), Acro Bike (any stop in the next column), Mach Bike (ride past a wild Pokémon, keep its reward), VS Seeker (rematch a trainer from this stage for double money). Bike Voucher (a Bicycle at the next shop, or ₽1500). Previews on the map: Devon Scope (next wild Pokémon), Town Map (next trainers' teams), Rule Book (gym ace), Orange Mail (whole gym team next stage), Fame Checker (next gym leaders). Itemfinder hides a Bag item at one wild stop per stage (✦). RSVP Mail moved to slice 4 (it needs rival events)
- [x] Item effects, slice 3b-3a: 10 extra-stop items (404 of 574 work now). Rods give each stage a fishing spot (Old Rod 1 Pokémon to pick, Good Rod 2, Super Rod 3 with a strong one); fishing is an extra Water Pokémon to battle and catch, with no reward draft. Wave, Tropic and Harbor Mail add a fishing spot, healing spot or shop to the next stage. Bridge Mail D and M put a shop or healing spot beside the next stop you reach; S gives the next trainer's draft the gym leader's odds; T makes the next wild Pokémon the strongest of three
- [x] Item effects, slice 3b-3b: 6 draft items (410 of 574 work now). Dowsing Machine: each stage's first draft shows 6 choices; Bloom Mail: next stage, drafts after trainer wins show one more; Cornn Berry: a Re-roll button on the reward screen swaps one card for a new one; Lock Capsule: a Lock button keeps one card for the next draft too; Favored Mail: the best card you skip comes back in the next draft; TM Case: TMs offer 4 moves instead of 3. Cards shrink to fit bigger drafts
- [x] Item effects, slice 4a: RSVP Mail (411 of 574 work now): next stage, the first ordinary trainer is a rival ("Rival …", 3 levels higher, "challenges you to a rival battle!"); beating it gives a draft with gym odds and one more choice. Once per stage
- [x] Item effects, slice 3c (partial): Light Clay (screens last 8 turns), Red Card, Eject Button, Mental Herb (cures Taunt only; Encore and infatuation are not modelled) now work (415 of 574).
- [ ] Item effects, slice 3c (rest: Razz/Nanab/Pinap berries, mulch, berry pots, apricorn box, gadgets) and slice 4b: the "?" event stops and the other items that open events (Inquiry Mail, Bridge Mail V, Silph Scope, keys and tickets) need those events built first
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

## Milestone 8.9 — Hyper moments, Phase 1 (in progress)

Design: the Hyper section of the Electric plan doc (Kice ticked all 10 Phase 1 items, 2026-10-25); numbers are the doc's starting balance. One slice per PR.

- [x] Slice 1: Toughened It Out (replaces Love's endure), Felt a Bond, Pushed Itself Back Up, Hung In There (with "Again" and "Wouldn't Stay Down"); run save v10
- [x] Slice 2: The Enemy Is Getting Riled Up (telegraphed a turn ahead with a banner and a badge; calmed by a status, a super-effective hit or a move that lowers its attacks; Evil makes it uncontrollable)
- [x] Slice 3: The Two Pokémon Feel a Heated Rivalry (your Pokémon that fought the same species in 3 battles: +10% damage against it, Rage can make it reckless for +20% and −1 Defense; Friendly Competition between teammates who trade finishing blows)
- [x] Slice 4: This Trainer Will Return (an ordinary trainer you barely beat, with one Pokémon left at 25% HP or less, comes back in a later stage with its old team 2 levels above the usual and one more Pokémon; 1 per stage, 4 per region)
- [x] Slice 5: A Past Pokémon Wants to Join Your Party, simple version (a finished run's party goes into the profile's archive of 30 past Pokémon; a new run has a 40% chance to meet one, Hall of Fame Pokémon twice as likely, after 4 to 12 battles won. It comes at that battle's level, back to an earlier form if it is below its evolution level, keeping its moves, ability, shininess and Tera type. Recruit it, take a keepsake (twice a release's candies) or let it go; "It never forgot you" and higher friendship for Hall of Fame Pokémon); profile save v7
- [x] Slice 6: The Seven Emotions as event tags (memories carry emotion tags; a Pokémon's current emotion, the most common tag in its last 10 tagged memories, shows as a coloured dot on the party screen; Justice for knocking out the foe that knocked out a teammate); a Story screen on the map lists the run's chronicle with its emotions

### Known limits in slices 1 to 6

- "Our Hearts Beat as One" (Felt a Bond after a Champion win) is not in yet: histories count boss wins but not which boss. Rescues don't exist yet, so Felt a Bond reads close calls, survived knockouts and boss wins.
- A "Peace-tagged move" (the doc's third counter) is read as any move that lowers the foe's Attack or Sp. Atk, since moves have no Peace tag yet.
- A Heated Rivalry is with an opposing species, not one individual Pokémon: wild Pokémon are new every battle, and trainers don't come back yet (slice 4). Your rival evolving counts as a new species. Opposing Pokémon have no rivals of their own.
- Rivalry records share the run's limit of 12 open relationships; past that a rivalry still works in battle but isn't recorded. Friendly Competition needs the record, so it stops forming once the limit is reached.
- A returning trainer comes back at the first ordinary trainer of any later stage, even in a later region; it has no special dialogue, arena or reward yet, and its team only changes by level, evolution and one extra Pokémon (no counter-picks: that is the nemesis system).
- Past Pokémon: only the party at a run's end is archived (not released, traded or left-behind Pokémon), and the meeting is a choice screen after a battle, not a map event with its own scene. It carries its moves, ability and Tera type, not its old memories or emotion.
- Emotions are tags only: their Overdrives (battle effects), emotional clash and dual emotion come later. Integrity has no source yet (it reads event choices and challenge rules), and nothing tags Patience or Kindness outside Hung In There, Felt a Bond and friendship milestones.

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

## Starter Sets, Trainer Quests, Mastery, Events (director request, 2026-10-30)
Plan: `/mnt/project-files/plans/starter-sets-quests-mastery-plan.md` (Kice's answers at its end override the text above them).
- [x] Slice 1: Starter Laboratory sets by category: 9 regions (+ All of Kanto), 18 types, 4 roles, 9 player-trainer sets, 10 villainous teams, 9 Pokémon Leagues (Elite Four + champions), 7 spin-off games. Mixed unlocks: Research Points, achievements, or earned-only (type sets: 2 boss wins with that type leading).
- [x] Slice 2: trainer identity: signature types, species and set for all 9 trainers; signature Pokémon in the starter draw; Cynthia, Oak and N passives.
- [x] Slice 3: "?" event stops: 170 events (every event and map stop in Kice's plan, one per type, rest spots, 30 key-item/ticket events, Lost Property and other key sources). Choices can need money, items, party types, attributes or a trainer tag (N won't make aggressive choices); attribute checks; battles with prizes; Pokémon joining; gym scouting. Event items (slice 4b): Silph Scope, Inquiry Mail, Bridge Mail V, Explorer Kit, Prop Case, Tidal Bell, Clear Bell and all keys/tickets. Animated scene (bouncy cards, cast, ambient effects; calm when animations are reduced). Tests: `tests/unit/events.test.ts`, `tests/e2e/events.spec.ts`.
- [x] Slice 3b: doubled events: 134 more (304 in all): 17 PokeRogue-style encounters (Dark Deal, Safari Zone, Teleporting Hijinks, Delibird-y, Absolute Avarice, Clowning Around, Part-Timer, Dancing Lessons, GTS, Fun and Games, Bug-Type Superfan, An Unlikely Ally, Trash to Treasure, Field Trip…), about 11 more in every group, a new Places and weather group, and 3 more rest spots.
- [x] Slice 4: trainer quests + claim ledger: every trainer has a 5-step line done in order across runs (counters count only runs as that trainer); rewards are Research Points, Bank Credits, candies, titles, the trainer's starter set, and (Red, Blue, Cynthia, Giovanni, N, Oak) the Trainer Evolution unlock. One Run Quest per run (22 goals). Tests: `tests/unit/quests.test.ts`, `tests/e2e/quests.spec.ts`.
- [x] Slice 5: Species Mastery for every species (`core/mastery.ts`, profile `mastery`): ranks Seen → Caught → Bronze → Silver → Gold → Master from each run's Pokémon histories (thresholds in `balance.mastery`); a family has its best member's rank. Unlocks for Pokémon of the family that join a run: Bronze first egg move, Silver Hidden Ability, Gold second egg move + choice of ability, Master its strongest move starts awakened. Each rank pays Research Points once (claim ledger), Master gives "<Species> Master". "Mastered" starter set (Silver species, opens at 3). Hub > Unlocks > Species Mastery (family pages, picks), catch screen preview, run-end ranks. Saves: profile v9, run v20. Tests: `tests/unit/mastery.test.ts`, `tests/e2e/mastery.spec.ts`.
- [x] Slice 6: Trainer Evolutions (`core/trainerEvolution.ts`, `evolvedFrom` in archetypes.json): finishing Red, Blue, Cynthia, Giovanni, N or Oak's quest line unlocks their evolved form, chosen beside the base trainer each run (a sidegrade). Each has its own mechanic: Champion Red Last Stand (last Pokémon survives a KO hit once per battle), Champion Blue Smell Ya Later (moves first on a trainer battle's first turn), Champion Cynthia Champion's Aura (boss battles: lead's best stat +1), Rocket Boss Giovanni Black Market (shops sell locked stock at 1.5×), King N Voice of Pokémon (a defeated wild Pokémon may ask to join, 1 in 4), Champion Oak Field Research (₽300 per new species caught). Runs count toward the base trainer's quests. Art: pack pictures + Essentials ROCKETBOSS (`docs/quality/asset-provenance.md`). Tests: `tests/unit/trainerEvolution.test.ts`, `tests/e2e/trainerEvolution.spec.ts`.
- [ ] Weekly events; holiday/themed events (Spooky).

### Known limits in slice 6
- King N and Champion Oak reuse the base trainers' pictures (no separate art in the packs); a gold aura and EVOLVED tag mark them.
- No content-report row compares variant strength yet. Pokémon that ask to join (King N) count as caught.

### Known limits in slice 5
- "Battles" counts battles the Pokémon fought in (you win every battle of a run except a losing last one). Gold's "never fainted" is per run (a boss win in a run where it never fainted), not per stage; Master needs it in the party at the end of a run that cleared a region.
- Each run credits every species the Pokémon was (Charmander that became Charizard counts for both). Runs before profile v9 don't count.
- Egg moves come from the family's first stage; ones the engine can't run are listed as "found, not active yet" and never used. Many species' egg moves are not supported yet (e.g. Bulbasaur, Charmander), so those families get no egg move until the moves are built.
- The Master "signature move" is the strongest move it joins with, awakened (Signature Move Awakening). No form licenses yet.
- The Mastered set can't use Type Focus (its types depend on your profile). Sprite borders and badges are not drawn yet; the rank colour shows instead.

### Known limits in slice 4
- Per-trainer counters start at zero for old profiles (runs before v8 don't count toward quest lines).
- Trainers added later need `npm run data:quests` (the content check fails until they have a line).

### Known limits in slice 3
- Scanner (trade at a shop) still needs the shop; Room 6's event trades it on the spot for an Epic item instead.
- Event trainers without a trainer class use the event's first cast member as their sprite and pay ₽24 per level (`balance.events.trainerMoneyPerLevel`).
- Each event appears at most once per run, except rest spots; key-item events need the key at the start of a stage.

### Known limits in slice 2
- N's aggressive event choices are locked by the `pacifist` tag. Oak previews every wild stop rather than one per stage (information only, no roll).

### Known limits in slice 1
- Regional forms still count as ordinary first stages (as in the wild); the special-form rule is Untitled-doc Phase D.
- The Preparation Desk cycles through every unlocked set one by one; no category step there yet.
- No challenge sets with reward multipliers yet (needs a payout rule), and no Mastered set (comes with species mastery).

## Trainers.md perks (director request, 2026-10-30; in progress)

Every trainer in Trainers.md becomes a playable trainer with all its pros and cons, 20 per PR. List: `docs/plans/trainers-coverage.md`.
- [x] Batch 1 (Aaron to Bianca, 20 trainers) and the shared perk system (`core/trainerPerks.ts`).
- [x] Batch 2 (Bill to Canari, 20 trainers) with the PC box and Rival's Answer.
- [x] Batch 3 (Carmine to Diantha, 20 trainers) with Distortion Protocol.
- [x] Batch 4 (Drake to Ginter, 20 trainers).
- [x] Batch 5 (Glacia to Ingo, 20 trainers).
- [ ] Batches 6–7 (Iono to Lysandre; the Raids thread does M–Z) and the rest (the other 120 trainers), then the signature mechanics (Beautiful Parasite, Encore!, Perfect Shot, The Final Revelation, Meteor's Prophecy; they reuse `core/signature.ts`).
- Known limits: a few clauses have no effect yet and are listed per trainer in `docs/plans/trainers-coverage.md` (burns never wear off; Mega Evolution has no cost). "fast" means base Speed 90+ and "slow" 60 or less. HP perks update when a battle, stage or starter pick starts (not mid-menu). Legendary wild encounters are new: 2% per wild battle from the second region.

## Milestone 10 — Visuals and presentation (planned)

A milestone purely for looks: a shared visual style, redesigned screens, transitions and animations, and a final layout pass. No gameplay changes. See IMPLEMENTATION_PLAN.md §5.
