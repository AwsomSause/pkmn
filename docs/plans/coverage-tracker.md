# Coverage tracker: every list in every guide

Kice (2026-10-30): add EVERYTHING listed in EVERY md file. This file is the checklist. A line is only ticked when the thing works in the game (status "supported" or documented "limited"), not when it is merely stored as data. Update it in every PR that moves a line.

Status key: DATA = stored in validated JSON but the engine does not use it yet; PART = some of it works; DONE = works and tested; TODO = nothing yet.

## A Living Rivalry Engine (design doc) and its Examples doc
Data: `src/data/rivalCatalog.json` (built by `npm run data:rival-catalog` from `tools/sources/rivalry-examples.md`; every entry has a status, starting at "planned").

| Item | Count | Status |
|---|---|---|
| Rival slice 1 Spark, slice 2 return + adaptation, slice 3 Story screen | 3 slices | DONE |
| Rival paths (Examples §1) | 30 | PART: 13 run as origins chosen from the battle and the rival's character (dominant win, close win, repeated loss, personality, region); 17 need systems that don't exist yet (sponsors, mentors, factions, debts, family, disasters, contests) |
| Personalities (§2) | 40 | PART: all 40 run as profiles (6 traits; vindictiveness changes the return level, low adaptability never adapts). Their special story behaviours wait for arcs/events |
| Battle styles (§3) | 32 | PART: all 32 run as AI sharpness + stat bias + adaptation cap. Style tricks (berserker rage, trapping, copying) wait for battle hooks |
| Off-screen events (§6; the doc says 40 but skips #19) | 39 | PART: all 39 run (`rivalBonds.json`, `rivals/bonds.ts`): one per rival per stage with eligibility, character/trait weighting, a cause chain, a habit, and private/rumour/observed visibility. Limited: generic habit pools, hyper events only move a readiness number |
| Character arcs (§7: 36 long-form + 10 Overdrive) | 46 | PART: 27 run (growth, conflict and social arcs: start, turn, good/bad ending that nudges the rival's traits); the 9 Pokémon-bond arcs and 10 Overdrive arcs wait for the bond/Overdrive systems |
| Advanced mechanics (§8) | 24 | PART: 19 limited (public reputation, signature technique, conflicting account, independent rivalry, unseen win/defeat, cooldown, private goal, challenge refusal, missed encounter, return encounter, rumour mill, handoff, shared rival, rival-to-rival Pokémon influence, training exchange, rivalry triangle, substitute for a worn-out ace, legacy encounter); 5 planned (alliance, mentor network, team identity shift, Pokémon transfer, unscheduled challenge: each needs a system that does not exist yet, e.g. mentor NPCs, release rules, map interrupts) |
| Main doc slice 4: ladder, ally/retire/shaken outcomes, Ultimate Rival score + milestone evaluation | DONE (rival promotions at gyms/tournaments wait for the world sim) |
| Main doc slice 5: multiple rivals (3), rival graph, off-screen world sim, rumours | DONE (limited) |
| Main doc slice 6: scheduler, legacy layer, account-level rival state | TODO |
| Bond Engine §4.1 eight bond dimensions per rival Pokémon (0–100) | 8 | DONE (+ hyperReadiness) |
| Bond Engine §4.2 trainer behaviours | 14 | DONE: picked by the rival's character after you beat it; shift every member's bond |
| Bond Engine §4.3 Pokémon traits | 12 | DONE (each raises the odds of events with matching tags) |
| Bond Engine §6.1 consequences | — | PART: bonds change the return (synced+confident +1 level, worn out −1), observed events show as a line before the fight, the Story screen lists each Pokémon's mood; causal chains Overtraining→Recovery, Conflict→Apology, Separation→Reconciliation. Overdrive expression/control and the 9 bond arcs wait for the Overdrive thread |
| Bond Engine §9.1 habit slots | 7 | PART: all 7 slots exist; filled by events; generic pools + 8 type comfort habits |
| Examples §11 simulation pipeline (8 steps) | 8 | DONE except "story hooks" beyond rumours/notes |

## Other guides (see how-to-execute-guides.md for the order)
| Guide | Status |
|---|---|
| Untitled document phases A, B | DONE (except new NPC classes); C–G TODO (C overlaps the planning thread) |
| Progression and Encounter Balancing, phases 1 and 3 | DONE; 2, 4–11 TODO |
| Overdrive Hyper Techno Supreme Z | PART: §1 Phase 1 events + §2 emotions tags + §4 Hyper evolutions (4 transform moments + Determination Evolution memory) DONE; §4 Signature Move Awakening DONE (also §3 "It Mastered the Power Within"); §3 other 29 events, §5 (6 unusual events), §6 chains, §7 generator TODO |
| The Battle Drama Engine (9 phases) | PART: see table below |
| Blueprint: Raids, Totems, Expeditions, Minigames | PART (raids done; see the Blueprint section below) |
| Trainers.md perks | PART: batch 1 of 11 (20 of 220 trainers, A–B); per-trainer list in `docs/plans/trainers-coverage.md`. Signature mechanics (Rival's Answer etc.) come with their trainers |
| Visual guides (VISUAL_BIBLE, COMPLETE VISUAL REMASTER, brief) | TODO |
| POKEMON_ROGUELIKE_MASTER_EXPANSION_CATALOG (reference) | reference |


## Blueprint: Raids, Mega-Expeditions, Totem Pokémon & Minigames (every item)
Order: Raids, Totems, Expeditions, Minigames. Code: `src/core/raid/` + `src/data/raids.json`.

### 1. Raids (slice 1, DONE except the TODO lines)
| Item | Status |
|---|---|
| Boss HP pool, configurable per raid (`hpBoostPercent`) | DONE |
| Raid shield at HP thresholds (1–3 per raid), blocks the boss until broken | DONE |
| Boss phases at HP thresholds (boost, weather, cleanse, clear player stages) | DONE |
| Telegraphed attacks (charged hit, shown in the battle header; breaking a shield cancels it) | DONE |
| Extra actions per round (one bonus attack under an HP line, strict `max`) | DONE; "more than four moves" TODO |
| Battle timer (tiers 5–6), warnings at 10 and 5 turns | DONE |
| Raid modifiers: weather field | DONE; terrain, elemental surge, healing restriction, rotating weaknesses TODO |
| Victory rewards: money, items, extra draft choices, boss joins | DONE; crafting materials, Mega resources, rare-encounter tokens TODO (need Expeditions) |
| Tiers 1, 2, 3, 4, 5, 6/Apex (8 raids, one fully featured Apex) | DONE |
| Discover (den on the map), Prepare (preview: tier, mechanics, rewards, cost), Battle, Resolve, Progress (run raid record) | DONE; unlocking tiers across runs TODO |
| Safeguards: encounter level cap, no double reward/cost (den used on entry, battle cleared once), saved mid-raid (run v12), failure never ends the run, config validated at load, visual shield/phase/timer/charge | DONE |
| Reference plugin (Raid Battles DBK): mechanics rebuilt natively, nothing copied | DONE |
| Overworld raid dens | DONE (map side stop `raid`); Raid Adventures mode = Expedition below |
| Use encounter availability for the boss pool | PART (species are listed in `raids.json`; `availability.json` is not wired yet) |

### 2. Mega-Expeditions — TODO (every item)
Nodes: wild, trainer, elite, rest, item cache, research station, mystery event, recruit/rental, Mega-energy deposit, Totem, raid, final boss. Route generation (5–9 nodes, valid graph, visible route). Party modes: own, rental, recruit one, draft, combined. Attrition and recovery (rest node). Mega Energy, Mega Stones, temporary Mega, Mega bosses, Mega research, exclusive encounters/achievements. Extraction and failure rules. Progression by region. Briefing, route choice, checkpoint, finale, extract.

### 3. Totem Pokémon (slice 2, DONE except the TODO lines)
Code: `src/core/totem/`, `src/data/totems.json` (8 Totems, tiers early/mid/late/grand), territory = map side stop `T`.
| Item | Status |
|---|---|
| Every Totem has a mechanic beyond inflated HP (load check: aura present, at most 2 stages of boost) | DONE |
| Aura at battle start: stat boost, weather, terrain, hazard; visible in the battle header and a message | DONE; "resist a damage category" is done as a Defense/Special Defense stage; unique status field effect TODO |
| Ally calls: HP trigger, max calls, no infinite loops, ally takes the Totem's place and defeating it brings the Totem back (interrupt), resummon rule per Totem, support (heal, weather, screens) | DONE; true 2v1 (both on field) TODO, the engine is 1v1 |
| Behaviour phases at HP lines (reuse raid phases) | DONE |
| Environmental advantage: weather, terrain, hazards, tied to the stage (Totem type matches the stage theme) | DONE |
| Rewards: money, items, draft choices, rare Pokémon offer, unlock (per run), research points | DONE; held-item uniques, Mega energy/stones, achievements, cross-run unlocks TODO |
| Progression table (early: one aura + one weak ally; mid: aura + ally or phase; late: several; grand: unique) | DONE |
| Validation: species, ally, rewards checked at load; sim of every Totem at 3 levels for 60 turns stays within its call cap | DONE |
| Same level-cap rules as other battles; failure never ends the run; reload cannot repeat the fight (run v14) | DONE |

### 4. Minigames — TODO (every item)
Framework (id, name, category, unlockRequirements, difficultyTiers, durationLimit, attemptLimit, scoringRules, rewardTable, failureOutcome, replayRules, uiConfiguration, accessibilityOptions), standard result, reward caps and medals. Memory, Catching Challenge, Rhythm, Foraging/Berry Picking, Knowledge Quiz, Fossil Excavation. Extra concepts: fishing, battle puzzle, type-match, tracking, berry-growing, trainer's trial, treasure hunt, reaction.

### Blueprint acceptance and milestones
M1 audit DONE (this slice); M2 shared infrastructure PART (reward claim, entry cost and save guards done for raids); M3 Raid MVP DONE; M4 Totem MVP DONE; M5–M8 TODO.
## Battle Drama Engine (guide: "The Battle Drama Engine (text).md")
Code: `src/core/drama/`, data `src/data/drama.json`, tests `tests/unit/drama.test.ts`.
| Item | Status |
|---|---|
| P1 Repository audit + plan (events already exist as `BattleEvent`; hooked after `takeTurn`/battle start; lines are presentation only) | DONE (this file) |
| P2 Event system: stable ids, dedupe, battle start, move, crit, faint, switch, low HP, end | DONE (limited: no sent-out/status/missed/survived/evolution/Hyper/Overdrive/turning-point events yet) |
| P3 Dialogue: voices, rival voice from traits, rival callbacks from real history, no repeats, budgets, observed player habit | DONE (limited: archetype/arc/bond-based picks and encouragement/post-battle callbacks TODO) |
| P4 Signature attacks: 8 declaration styles (warning, signature, promise, desperate gamble, tactical call, showman, quiet threat, personal callback) chosen from the situation, only for named trainers / last Pokémon / low HP, once per Pokémon+move; aftermath reactions (hit, miss, KO); banner + sound that follow the animation settings. Presentation only | DONE (limited: no custom per-move camera/sound files; no declaration for the player's side) |
| P5 Mid-battle evolution (`core/drama/evolution.ts`): a returning rival's ace is brought in one stage below its final form when already at its evolution level; it evolves at a turn boundary (turn 3+ or half HP) with the one `evolve()` implementation (status, damage taken, moves carry over; Everstone blocks; once per Pokémon, saved); trainer reacts, Chronicle entry, rival remembers it next battle; AI reads the new species/moves next decision | DONE (limited: rivals only; no separate "became eligible" event) |
| P6 Event library `dramaEvents.json`: all 20 events of guide §5 listed with eligibility, severity, cooldown, rarity roll, Chronicle record and rival memory flag; 14 run now (Breakthrough Evolution, Last-Second Resolve [enemy Hyper], Tactical Revelation, Comeback Call, Ace Reveal, Failed Technique, Veteran's Adjustment, Desperate Switch, Unfinished Grudge, Mercy Moment, Breaking Point, Calm Before the Finish, Rematch Reversal, Unexpected Respect); 8 planned: Refusal, New Move, Unplanned Combination, Overdrive Breakthrough/Misfire (Overdrive thread), Rival Interruption, Pokémon Takes Initiative, Pokémon Recognition, Emotional Turning Point (need bond/autonomy/enemy-emotion systems) | PART |
| P7 Relationship/rival/bond integration; memories | PART: rival traits pick the voice; rivals bring up a real earlier moment next battle (flags `drama:rival:*`); bond values TODO (bond engine not built) |
| P8 Pacing director: tiers, gaps, budgets, dialogue-frequency setting (settings v4) | DONE (limited: animation-speed/reduced-motion already exist) |
| P9 Tests: 14 unit tests; 3 scripted scenarios, evolution/Hyper tests | PART |
| §9 Emergent battle memories | PART: Chronicle entries + rival callbacks; style changes / recurring-rival promotion TODO |
