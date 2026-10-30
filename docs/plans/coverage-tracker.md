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
| Untitled document phases A, B | DONE (except new NPC classes) |
| Untitled doc Phase E1 (§13 difficulty, §13.2 modifiers, §13.3 multiplier, §14 Death-Block, §15 Adventure) | PART: 5 difficulties, multiplier formula with 2.0 cap and published x on the Preparation Desk, snapshot in `run.rules` (run v14), all 12 modifiers run, one per kind (e.g. one party rule at a time): No Transformations, Scarce Supplies, Monotype, Single Region Dex, Rich Route, Blind Research (map hides stage themes, research x1.5), No Revives, Random Draft, Boss Rush (own 4-stage campaign), Variant Hunt (+50% event stops; shiny odds unchanged), Limited Party (4), No Duplicate Species, Death-Block (first 5 battles, once, back to stage start), Adventure (checkpoint on stage start/heal stops, wipe = back to checkpoint, no account rewards). Daily, Endless, Spooky modes planned |
| Untitled doc Phase C–G rest | TODO: C prep slots (Field License, Research Directive, Challenge Contract) and effective-attribute layers (starter-sets thread owns pools/identity/Run Build Summary); D, F, G |
| Progression and Encounter Balancing, phases 1 and 3 | DONE; 2, 4–11 TODO |
| Overdrive Hyper Techno Supreme Z | PART: see the section "Overdrive Hyper Techno Supreme Z" at the end |
| The Battle Drama Engine (9 phases) | DONE except planned events (see table below) |
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

### 2. Mega-Expeditions (slice 3, DONE except the TODO lines)
Code: `src/core/expedition/` (schema, graph, flow, gate), `src/data/expeditions.json` (5 expeditions, tiers 1–4), screen `ExpeditionScene`. Gate = map side stop `E`.
| Item | Status |
|---|---|
| Structure: 5–9 stops, branching, part of the route visible, validated before it is shown | DONE |
| Nodes: wild, trainer, elite, rest, item cache, research station, mystery event, recruit/rental, Mega-energy deposit, Totem, raid boss, final boss | DONE (all 12 kinds); elite = a harder trainer fight with a loot bonus |
| Example flow: briefing, combat/resource route choice (two-stop layers), checkpoint (rest), finale, extract and claim | DONE |
| A. Route generation: directed graph, valid path, no dead ends, unit-tested over 300 seeds | DONE |
| B. Party modes: own, rental, recruit, draft, combined (one expedition each) | DONE |
| C. Attrition and recovery: HP/status/PP carry between stops; rest and events heal | DONE |
| D. Mega: Mega Energy resource, temporary Mega Stone + lent Mega Ring (stone kept on completion), Mega guardian finale that Mega Evolves, research objective, exclusive finales | DONE; achievements TODO; Mega bosses use the normal Mega rules only |
| E. Extraction and failure rules written in `flow.ts`: completion keeps all + unlock; early extract keeps loot, no finale rewards; loss forfeits loot (share of money kept), heals, never ends the run, never loses your own Pokémon | DONE |
| Reload mid-expedition (run v16), no double reward (gate used on entry) | DONE |
| Progression table by region (tiers 1–4, unlock chain) | DONE |
| Raid as finale or Totem as finale/stop | DONE |
| Encounter availability rules for wild stops | DONE (uses the normal stage encounter planner) |
| Temporary Mega in battle for rentals | limited: only for Pokémon with a Mega Stone available |
| More expeditions / routes (content expansion, Blueprint M7) | TODO |

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

### 4. Minigames (slice 4, DONE except the TODO lines)
- DONE framework: every field (id, name, category, unlockRequirements, difficultyTiers, durationLimit, attemptLimit, scoringRules, rewardTable, failureOutcome, replayRules, uiConfiguration, accessibilityOptions) in `minigames.json`, validated by `core/minigame/schema.ts`; one standard result (score, max, medal, money, item) from `flow.ts`; one generic screen (`MinigameScene`); one reward system.
- DONE the six recommended games: Pokémon Memory, Catching Challenge, Rhythm Challenge, Berry Foraging, Knowledge Quiz (questions built from real species/type/ability data), Fossil Excavation.
- DONE the eight extra concepts: fishing, battle puzzle, type-match, tracking, berry-growing, trainer's trial, treasure hunt, reaction.
- DONE economy: money cap per stage, repeats pay less, items only from the Normal tier up and capped per stage, failing costs nothing, leaving forfeits the attempt, reward paid once (stored outcome), save v19, play with the keyboard/mouse, slow mode (S) and pause (T) for timed games.
- TODO: rewards other than money/items (recovery, research progress, temporary advantages); minigame art/sfx beyond the shared menu look; balance simulation of payouts.

### Blueprint acceptance and milestones
M1 audit DONE (this slice); M2 shared infrastructure PART (reward claim, entry cost and save guards done for raids); M3 Raid MVP DONE; M4 Totem MVP DONE; M5 Expedition MVP DONE; minigame framework + 14 games DONE; M6–M8 content expansion, balance sims and the manual QA checklist TODO.
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
| P7 Bond values (`core/drama/bond.ts`: trust, affection, respect, synchronization, confidence, autonomy, strain) derived from rival traits + record (the Bond Engine itself isn't built) gate Comeback Call, Mercy Moment, Breaking Point, Unfinished Grudge; they change who may speak / traits, never stats. Rival traits pick the voice; rivals bring up real earlier moments | DONE (limited: no Pokémon-specific personality until the Bond Engine) |
| P8 Pacing director: tiers ambient/tactical/major/climactic, gaps, budgets by class, one big moment per turn, quiet after Calm Before the Finish; "Trainer talk" off/low/normal/high (settings v4: off hides all, low keeps major+, never changes what is recorded); animation speed + reduced motion already exist; lines are skippable like all battle text | DONE |
| P9 Tests (`tests/unit/drama.test.ts`, 33): eligibility+cooldowns, voice differences, ordering, no duplicates, evolution + status/state, Hyper-gated Last-Second Resolve, rival callbacks from real history only, no hidden info, fair AI shift, save round trip, skip/hide (off/low), 3 scripted scenarios (ordinary, rival rematch, major evolution). Hyper/Overdrive breakthrough tests belong to the Overdrive thread | DONE (limited) |
| §9 Emergent battle memories: Chronicle + rival flags; evolved rival gets a new battle style (ambition/pride up); a merciful rival changes its training philosophy (empathy up, vindictiveness down) and says so; Tactical Revelation / Failed Technique / Unexpected Respect callbacks ("I spent weeks figuring out how you broke through our defense with X"); a random trainer with a gripping comeback becomes a rival through the Spark; counters via the existing rival counter-pick | DONE (limited: no new trainer classes, no Pokémon-level style change) |

## Overdrive Hyper Techno Supreme Z (thread "Finish Overdrive and Hyper evolutions")
Source: `Overdrive Hyper Techno Supreme Z (text).md` (copy: `docs/plans/hyper-overdrive-techno.md`). Statuses checked against the repo 2026-10-30.

| Section | Items | Status |
|---|---|---|
| §1 Original Hyper moments (Toughened It Out, Hung In There, Felt a Bond, Pushed Back Up, Heated Rivalry, This Trainer Will Return, Riled Up, A Past Pokémon Wants to Join) | 8 | DONE |
| §1 Evolved Early, Mega Evolved from Determination, This Enemy Will Return | 3 | PART: Mega/evolution covered by §4 moments and the Determination Evolution memory; "Enemy Will Return" needs nemesis (rivals threads) |
| §2 Seven Emotions: tags, current emotion dot, Story screen; 7 Emotional Overdrives (once per battle each: Determination/Bravery/Justice +1 Attack, Kindness +1 Defense, Patience +1 Sp. Atk, Perseverance +1 Sp. Def, Integrity cures a fresh status), rare dual emotion (Determination + Kindness: heal 15%), emotional clash | 7 + 2 | DONE (limited: no drawbacks/exhaustion, no signature achievement events such as "Not Until It's Over", Kindness peaceful encounters TODO) |
| §3 Survival/recovery/transformation: Second Wind, Hasn't Given Up, Remembered Training, Broke Through Limits, Something Awakened, Mastered the Power Within (Signature Move Awakening), Instincts Took Over, Refused Its Weakness, Turned Pain Into Power, Evolved Beyond Expectations | 10 | DONE (`core/story/moments.ts`; limited: Refused Its Weakness is +1 Defense, Remembered Training is +1 Attack when a boss-finishing move is reused) |
| §3 Bond/friendship/party: Knows You Believe, Make You Proud, Came to Aid, More Than Teammates, Recognizes an Old Friend (past Pokémon), Refuse to Lose (Friendly Competition) | 6 of 10 | DONE; TODO: Understand Each Other, Won't Let Friend Fight Alone, Wants to Prove Itself, Feels Left Out (need pair combos / a choice screen) |
| §3 Rivalries/grudges/returning enemies | 12 | TODO here; the rivals threads own rivalry/nemesis (some covered by rival slices) |
| §3 Enemy Overdrive: Unshaken, Pure Instinct, Learned From Your Attacks, Protecting Its Trainer, Partner's Fall, Will Not Let Trainer Down, Riled Up | 7 of 10 | DONE; TODO: Gathering Everything, Fighting Beyond Limits, Lost Its Composure (need telegraphed ultimates + counterplay) |
| §4 Hyper evolutions: Determination Evolution (memory), Mega Overdrive, All of Its Heart, A Giant Resolve, True Colors (7 emotion lines), Signature Move Awakening | 6 | DONE |
| §5 Unusual events | 6 | DONE: 3 first-turn banners (Something Different, Waiting for This Battle, Something Watching) + 3 map "?" events (Doesn't Want to Fight, It Saw What You Did, This Place Remembers; `tools/events/overdrive.ts`). Limited: This Place Remembers fires anywhere; It Saw What You Did reads the Good/Evil meter |
| §6 Overdrive chains: engine (`core/story/chains.ts`) + 7 chains | 7 | DONE (limited: rival chain has 3 of 5 steps; Legacy Record gives a title, not a Hall of Fame entry) |
| §7 Event generator (the 14-field definition, priority queue, scopes) | 1 | DONE (story.json definitions + queue); no separate generator UI |
| §8 Fairness rules (per-battle budget, cooldowns, no stacked buffs) | 1 | DONE (major-cue budget, one combat effect per queue) |
| §9 Phase 1 core / Phase 2 advanced | 2 | Phase 1 DONE; Phase 2 PART (this table) |
| Techno §1 Rivalry, §2 Nemesis | — | owned by the rivals threads |
| Techno §3 Raids | — | owned by the Raids/Blueprint thread |
| Techno §4 Protégé: accept/decline screen, 6 paths, mentorship ends on evolution/catching up; Looks Up, Learned Something Today, Student Surpassed Teacher, Teacher's Last Lesson, Different Ways, Student Becomes Teacher (`core/story/mentorship.ts`) | 6 paths + 8 stories | PART: DONE except Carried Its Mentor's Legacy (Hall of Fame), mastery sharing, mentor-taught move variants (limited: paths shape story text, not stats) |
| Techno §5 Grand-Enemy, §6 Additional systems (Lucario example, Rival Who Wouldn't Give Up), §7 high-hype moments, §8 Memory-driven chaining | — | TODO |

## Implementation Plan Electric
Source: `Implementation Plan Electric (text).md` (copy: `docs/plans/electric-plan.md`).

| Section | Status |
|---|---|
| §1 Core Game Event Bus (domain events, effect ledger) | DONE (M8.9-0) |
| §2A Rivalry / §2B Nemesis | rivals threads |
| §2C Dynamic Event Director | PART: 173 map events exist (events thread); curated eligibility, risks and memory of choices TODO |
| §2D Bond & Protégé | Protégé PART (above); Bond via rival bonds/Overdrive bond moments |
| §2E Raid & World Crisis | Raids thread |
| §3 Spectacle layers 1–2, animation fallback | DONE (M9) |
| §3 Layer 3 transformations | PART (Hyper evolutions add banners; cinematics M9.5) |
| §3 Layer 4 boss spectacle, dynamic music, battle commentary (Drama thread), arena modifiers, victory moments | TODO / Drama thread |
| §4 Campaign dramatic arcs, route consequence engine | TODO |
| §5 Living hub (Research Lab, Hall of Fame, Training Center, Contract Board, legacy runs, mastery, rival ghosts, collection goals, chronicle) | PART (Story screen = chronicle; rest per starter-sets plan) |
| §6–§9 roadmap, directive, scale guidance | followed (CLAUDE.md) |

- Untitled Phase D1: special forms event-only (specialForms.json, special-form-leaks gate). Done. D2 services, acquisition routes, Daily/Endless/Spooky modes: still to build.
