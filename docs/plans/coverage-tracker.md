# Coverage tracker: every list in every guide

Kice (2026-10-30): add EVERYTHING listed in EVERY md file. This file is the checklist. A line is only ticked when the thing works in the game (status "supported" or documented "limited"), not when it is merely stored as data. Update it in every PR that moves a line.

Status key: DATA = stored in validated JSON but the engine does not use it yet; PART = some of it works; DONE = works and tested; TODO = nothing yet.

## A Living Rivalry Engine (design doc) and its Examples doc
Data: `src/data/rivalCatalog.json` (built by `npm run data:rival-catalog` from `tools/sources/rivalry-examples.md`; every entry has a status, starting at "planned").

| Item | Count | Status |
|---|---|---|
| Rival slice 1 Spark, slice 2 return + adaptation, slice 3 Story screen | 3 slices | DONE |
| Rival paths (Examples §1) | 30 | DONE (limited): all 30 run. 17 need world state from `rivals/standing.ts` (sponsor, faction standing, debts, other rivals, bonds, crises); limits: accidental-hero/shared-disaster read close calls in the same stage, mutual-enemy reads a hostile faction (standing −12) |
| Personalities (§2) | 40 | PART: all 40 run as profiles (6 traits; vindictiveness changes the return level, low adaptability never adapts). Their special story behaviours wait for arcs/events |
| Battle styles (§3) | 32 | PART: all 32 run as AI sharpness + stat bias + adaptation cap. Style tricks (berserker rage, trapping, copying) wait for battle hooks |
| Off-screen events (§6; the doc says 40 but skips #19) | 39 | PART: all 39 run (`rivalBonds.json`, `rivals/bonds.ts`): one per rival per stage with eligibility, character/trait weighting, a cause chain, a habit, and private/rumour/observed visibility. Limited: generic habit pools, hyper events only move a readiness number |
| Character arcs (§7: 36 long-form + 10 Overdrive) | 46 | DONE (limited): 27 growth/conflict/social arcs run from birth; the 9 Pokémon-bond and 10 Overdrive arcs begin from a rival's bonds when the world moves (`rivals/arcs.ts` `triggeredArc`, triggers in `rivalArcs.json`), then turn and end like the others (they nudge traits, they do not change the fight directly) |
| Advanced mechanics (§8) | 24 | DONE (limited): all 24 run. Pokémon transfer (`rivals/transfer.ts`): release (no trust + strain), trade between friends/partners, rehome (loved but strained); bonds move with the Pokémon. Unscheduled challenge (`rivals/interrupt.ts`, `rivalChallenge`): a due, driven rival cuts in on an event/heal/service stop once per stage; the stop stays usable. Limits: transfers change the rival's saved roster only (no transfer of Pokémon to the player), interrupts never happen on boss nodes or in the League |
| Main doc slice 4: ladder, ally/retire/shaken outcomes, Ultimate Rival score + milestone evaluation | DONE (rival promotions at gyms/tournaments wait for the world sim) |
| Main doc slice 5: multiple rivals (3), rival graph, off-screen world sim, rumours | DONE (limited) |
| Main doc slice 6: scheduler (`rivals/scheduler` in `adapt.ts`: wait by ladder state, floor, pause after any rival, priority), archive on the account (`profile.rivalArchive`), legacy layer (`rivals/legacy.ts`: an archived rival's style and traits shape one new rival, once, from the seed) | DONE (limited: no absence from private goals; legacy shapes character and dialogue, it does not rebuild a full returning nemesis fight) |
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
| Untitled doc Phase C–G rest | PART (E mode rewards, Endless endpoint and reload test done): DONE: C prep slots (Field License new; Directive and Contracts by starter-sets thread). DONE: effective-attribute layers (attributeLayers). TODO: (starter-sets thread owns pools/identity/Run Build Summary); D, F, G |
| Progression and Encounter Balancing, phases 1 and 3 | DONE; 2, 4–11 TODO |
| Overdrive Hyper Techno Supreme Z | PART: see the section "Overdrive Hyper Techno Supreme Z" at the end |
| The Battle Drama Engine (9 phases) | DONE (the 2 Overdrive events are built, limited) |
| Blueprint: Raids, Totems, Expeditions, Minigames | PART (raids done; see the Blueprint section below) |
| Trainers.md perks | DONE: all 220 trainers built (A to Kurt by one thread, Z backwards by the Raids thread); per-trainer list in `docs/plans/trainers-coverage.md`. Signature mechanics (Rival's Answer etc.) come with their trainers |
| Visual guides (VISUAL_BIBLE, COMPLETE VISUAL REMASTER, brief) | PART (M10 visual slices 1-21 built; see visual-coverage.md) |
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
| Raid modifiers: weather field, terrain, elemental surge, healing restriction, rotating weaknesses | DONE (`modifiers` in raids.json; 8 raids use them) |
| Raid cheers (Offense / Defense / Healing, 3 per raid) and bosses with 5-6 moves (`extraMoves`) | DONE |
| Raid capture jingles (4) on the boss-joins card; Dens + Adventures header art on den and expedition screens | DONE (Counter cheer, other Dens/Adventures art not used) |
| Victory rewards: money, items, extra draft choices, boss joins, Mega resources (tier 5–6: Mega Stones for party Pokémon that can use one, plus a Mega Ring if you have none), rare-encounter tokens (tier 4–6: the next 1–2 wild encounters weight rare x3, Legendary x2; raids and Totems never use a token up) | DONE; crafting materials DONE (`core/crafting.ts`: materials drop by raid tier, the Workshop uses them) |
| Tiers 1, 2, 3, 4, 5, 6/Apex (8 raids, one fully featured Apex) | DONE |
| Discover (den on the map), Prepare (preview: tier, mechanics, rewards, cost), Battle, Resolve, Progress (run raid record) | DONE, incl. unlocking tiers across runs: tiers 1–3 open from the first run (`raids.json` `openTiers`); winning a tier N raid (any run, kept as the profile best counter `raidBestTier`) opens tier N+1, and in-run wins open the next tier at once. Dens in regions whose tiers are still closed hold the highest open tier. The Raid Observatory shows the open tiers |
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
- DONE bonus rewards: silver/gold can also heal the party (never revive), add Totem research points, or give a shop discount for the stage (data: `effect` in `rewardTable`; capped by `effectCapPerStage`). Medal art bounces in at the end; sounds reuse the pack sounds already in the game (no new binary assets).
- DONE balance: `tests/unit/blueprintBalance.test.ts` runs the real data and flow (prize money vs gym leaders for raids/Totems/expeditions, 300-seed expedition route mix, random-player minigame medals and payouts) and writes `docs/plans/balance-report.md`. Fishing and Treasure Hunt were retuned because a random player got gold too often.

### Blueprint acceptance and milestones
M1 audit DONE (this slice); M2 shared infrastructure PART (reward claim, entry cost and save guards done for raids); M3 Raid MVP DONE; M4 Totem MVP DONE; M5 Expedition MVP DONE; minigame framework + 14 games DONE; M6 DONE; M7 content expansion DONE (13 raids, 12 Totems, 8 expeditions, 5 mystery events, 14 minigames); M8 balance sims DONE (data-level, not full battle sims), save/load and progression tests DONE, manual QA checklist DONE (`docs/qa/blueprint-qa.md`).
## Battle Drama Engine (guide: "The Battle Drama Engine (text).md")
Code: `src/core/drama/`, data `src/data/drama.json`, tests `tests/unit/drama.test.ts`.
| Item | Status |
|---|---|
| P1 Repository audit + plan (events already exist as `BattleEvent`; hooked after `takeTurn`/battle start; lines are presentation only) | DONE (this file) |
| P2 Event system: stable ids, dedupe, battle start, move, crit, faint, switch, low HP, end | DONE (limited: no sent-out/status/missed/survived/evolution/Hyper/Overdrive/turning-point events yet) |
| P3 Dialogue: voices, rival voice from traits, rival callbacks from real history, no repeats, budgets, observed player habit | DONE (limited: archetype/arc/bond-based picks and encouragement/post-battle callbacks TODO) |
| P4 Signature attacks: 8 declaration styles (warning, signature, promise, desperate gamble, tactical call, showman, quiet threat, personal callback) chosen from the situation, only for named trainers / last Pokémon / low HP, once per Pokémon+move; aftermath reactions (hit, miss, KO); banner + sound that follow the animation settings. Presentation only | DONE (limited: no custom per-move camera/sound files; no declaration for the player's side) |
| P5 Mid-battle evolution (`core/drama/evolution.ts`): a returning rival's ace is brought in one stage below its final form when already at its evolution level; it evolves at a turn boundary (turn 3+ or half HP) with the one `evolve()` implementation (status, damage taken, moves carry over; Everstone blocks; once per Pokémon, saved); trainer reacts, Chronicle entry, rival remembers it next battle; AI reads the new species/moves next decision | DONE (limited: rivals only; no separate "became eligible" event) |
| P6 Event library `dramaEvents.json`: all 20 events of guide §5 + 2 extras, each with eligibility, severity, cooldown, rarity roll, Chronicle record, rival memory flag, optional fair AI shift / trait shift. 21 run: Last-Second Resolve, Refusal, New Move, Tactical Revelation, Comeback Call, Ace Reveal, Unplanned Combination, Failed Technique, Veteran's Adjustment, Desperate Switch, Rival Interruption, Unfinished Grudge, Mercy Moment, Breaking Point, Calm Before the Finish, Pokémon Takes Initiative, Rematch Reversal, Unexpected Respect, Pokémon Recognition, Emotional Turning Point, Breakthrough Evolution. 23 run: + Overdrive Breakthrough (a boss reacts to your Hyper/Overdrive moment) and Overdrive Misfire (a boss reacts when its own Overdrive is calmed; limited, built by the Overdrive thread) | DONE |
| P7 Bond values (`core/drama/bond.ts`: trust, affection, respect, synchronization, confidence, autonomy, strain) derived from rival traits + record (the Bond Engine itself isn't built) gate Comeback Call, Mercy Moment, Breaking Point, Unfinished Grudge; they change who may speak / traits, never stats. Rival traits pick the voice; rivals bring up real earlier moments | DONE (limited: no Pokémon-specific personality until the Bond Engine) |
| P8 Pacing director: tiers ambient/tactical/major/climactic, gaps, budgets by class, one big moment per turn, quiet after Calm Before the Finish; "Trainer talk" off/low/normal/high (settings v4: off hides all, low keeps major+, never changes what is recorded); animation speed + reduced motion already exist; lines are skippable like all battle text | DONE |
| P9 Tests (`tests/unit/drama.test.ts`, 33): eligibility+cooldowns, voice differences, ordering, no duplicates, evolution + status/state, Hyper-gated Last-Second Resolve, rival callbacks from real history only, no hidden info, fair AI shift, save round trip, skip/hide (off/low), 3 scripted scenarios (ordinary, rival rematch, major evolution). Overdrive Breakthrough/Misfire covered in the 'Overdrive drama events' tests | DONE (limited) |
| §9 Emergent battle memories: Chronicle + rival flags; evolved rival gets a new battle style (ambition/pride up); a merciful rival changes its training philosophy (empathy up, vindictiveness down) and says so; Tactical Revelation / Failed Technique / Unexpected Respect callbacks ("I spent weeks figuring out how you broke through our defense with X"); a random trainer with a gripping comeback becomes a rival through the Spark; counters via the existing rival counter-pick | DONE (limited: no new trainer classes, no Pokémon-level style change) |

## Overdrive Hyper Techno Supreme Z (thread "Finish Overdrive and Hyper evolutions")
Source: `Overdrive Hyper Techno Supreme Z (text).md` (copy: `docs/plans/hyper-overdrive-techno.md`). Statuses checked against the repo 2026-10-30.

| Section | Items | Status |
|---|---|---|
| §1 Original Hyper moments (Toughened It Out, Hung In There, Felt a Bond, Pushed Back Up, Heated Rivalry, This Trainer Will Return, Riled Up, A Past Pokémon Wants to Join) | 8 | DONE |
| §1 Evolved Early, Mega Evolved from Determination, This Enemy Will Return | 3 | DONE: Mega/evolution covered by §4 moments and the Determination Evolution memory; "This Enemy Will Return…" is told when a nemesis forms or slips away (`core/story/nemesis.ts`) |
| §2 Seven Emotions: tags, current emotion dot, Story screen; 7 Emotional Overdrives (once per battle each: Determination/Bravery/Justice +1 Attack, Kindness +1 Defense, Patience +1 Sp. Atk, Perseverance +1 Sp. Def, Integrity cures a fresh status), rare dual emotion (Determination + Kindness: heal 15%), emotional clash | 7 + 2 | DONE (limited: no drawbacks/exhaustion, no signature achievement events such as "Not Until It's Over", Kindness peaceful encounters TODO) |
| §3 Survival/recovery/transformation: Second Wind, Hasn't Given Up, Remembered Training, Broke Through Limits, Something Awakened, Mastered the Power Within (Signature Move Awakening), Instincts Took Over, Refused Its Weakness, Turned Pain Into Power, Evolved Beyond Expectations | 10 | DONE (`core/story/moments.ts`; limited: Refused Its Weakness is +1 Defense, Remembered Training is +1 Attack when a boss-finishing move is reused) |
| §3 Bond/friendship/party (10): Knows You Believe, Make You Proud, Came to Aid, More Than Teammates, Understand Each Other (bond pair with 2+ trades), Won't Let Friend Fight Alone (bond partner under 25% HP), Wants to Prove Itself (rookie leads beside an ace), Feels Left Out (benched with 0-1 fights; +5 friendship, limited: no "ask to lead" screen), Recognizes an Old Friend (past Pokémon), Refuse to Lose (Friendly Competition) | 10 | DONE (limited as noted) |
| §3 Rivalries/grudges/returning enemies | 12 | PART: 7 done with the nemesis system (It Remembers That Defeat!, This Isn't Over Between Us!, Fighting for Its Pride, Its Anger Is Becoming Dangerous!, It Has Something to Prove!, The Hunter Has Become the Hunted!, This Enemy Will Return…); rival ones by the rivals slices; Grown Stronger, Studied Your Strategy, Kindness, Cruelty are left-out plan 5.3 |
| §3 Enemy Overdrive (10): Unshaken, Pure Instinct, Learned From Your Attacks, Protecting Its Trainer, Partner's Fall, Will Not Let Trainer Down, Riled Up, Gathering Everything (two set-up turns = telegraphed charge; next attack +2 Attack), Lost Its Composure (a status on it breaks the charge, Defense -1), Fighting Beyond Limits (boss survives a half-health hit) | 10 | DONE |
| §4 Hyper evolutions: Determination Evolution (memory), Mega Overdrive, All of Its Heart, A Giant Resolve, True Colors (7 emotion lines), Signature Move Awakening | 6 | DONE |
| §5 Unusual events | 6 | DONE: 3 first-turn banners (Something Different, Waiting for This Battle, Something Watching) + 3 map "?" events (Doesn't Want to Fight, It Saw What You Did, This Place Remembers; `tools/events/overdrive.ts`). Limited: This Place Remembers fires anywhere; It Saw What You Did reads the Good/Evil meter |
| §6 Overdrive chains: engine (`core/story/chains.ts`) + 7 chains | 7 | DONE (limited: rival chain has 3 of 5 steps). The Long Gauntlet (Legacy Record) gives a permanent Hall of Fame entry: chains marked `hallOfFame` add a Legacy Record to the card, and runs holding one are never trimmed from the history |
| §7 Event generator (the 14-field definition, priority queue, scopes) | 1 | DONE (story.json definitions + queue); no separate generator UI |
| §8 Fairness rules (per-battle budget, cooldowns, no stacked buffs) | 1 | DONE (major-cue budget, one combat effect per queue) |
| §9 Phase 1 core / Phase 2 advanced | 2 | Phase 1 DONE; Phase 2 PART (this table) |
| Techno §1 Rivalry, §2 Nemesis | — | §1 owned by the rivals threads; §2 DONE: `core/story/nemesis.ts` (Incident → Return → Reckoning, 6 archetypes, 30% roll, counter-move, Reckoning reward + Nemesis Slayer title). Limited: no Nemesis Raids, no "interrupts a rare encounter / steals a reward" or "spared" causes (no flee or spare action exists) |
| Techno §3 Raids | — | owned by the Raids/Blueprint thread |
| Techno §4 Protégé: accept/decline screen, 6 paths, mentorship ends on evolution/catching up; Looks Up, Learned Something Today, Student Surpassed Teacher, Teacher's Last Lesson, Different Ways, Student Becomes Teacher (`core/story/mentorship.ts`) | 6 paths + 8 stories | PART: DONE incl. Carried Its Mentor's Legacy (the protégé's Hall of Fame card names its mentor); left: mastery sharing, mentor-taught move variants (limited: paths shape story text, not stats) |
| Techno §6.1 Legacy System: Legacy Card per Pokémon (Run Ace/Mentor/Protégé/Survivor tags, signature memory, greatest moments), 8 earned titles from real history (Iron Will, Boss Slayer, Rival Breaker, Guardian, Veteran, Tested by Fire, Grown on the Road, plus the last title), run epitaph in the chronicle; shown on the Story screen | 1 | DONE: Legacy Cards show in the Hall of Fame (Hub Events → Hall of Fame) |
| Techno §5 Grand-Enemy: one campaign threat, The Storm Sovereign (`core/story/grandEnemy.ts`), 5 phases by campaign progress (Omen, First Contact, Escalation, Reckoning, Legacy); shows as banners (Omen/First Contact) and empowers region bosses (+1 Attack, Influence/Escalation); Grudge: a Pokémon that stood against it and has boss wins gets a +1 Attack memory moment in the final region; Legacy: victory records the outcome and gives "Stood Against the Storm" | 1 | DONE: its own battles are two raid-style fights (Contact in the first-contact region, Reckoning in the last, `raids.json` entries with `grand`), Adaptation (leaning on the same damage kind as last time gives it +1 Def/Sp. Def, shown in the den preview), Weakness discovery (after a first fight the preview lists the types it is weak to). Influence: from Escalation rare Pokémon are drawn out more often (once, a run perk effect); Grudge targeting: it opens its fight with +1 Speed against the Pokémon that stood against it most, shown in the den preview. |
| Techno §6.2 Grudge & Respect: six feelings (Respect, Rivalry, Fear, Gratitude, Resentment, Unresolved) worked out from each rival's character and history (`core/rivals/feelings.ts`), shown on the Story screen; resentful rivals open with +1 Attack, fearful ones with +1 Defense, respectful ones ask for a fair rematch (banner) | 1 | DONE (partner-defeated / raid-help causes wait for Raids hooks) |
| Techno §6.3 Pokémon Chronicle: authored-template stories (`core/story/storybook.ts`) for a rivalry ("The Rival Who Wouldn't Give Up", "...Became a Friend", "...Stepped Away"), a Pokémon's run, a mentor and protégé, and the whole team; listed on the Story screen | 1 | DONE (limited: no per-raid / per-region / nemesis-campaign summaries yet) |
| Techno §6.4 Sacrifice: "It Stood Between Its Friend and Danger!" (a defensive move while a teammate is nearly down, +1 Defense), "Its Final Move Created an Opening!" (last conscious Pokémon in a boss fight, +1 Attack); never removes a Pokémon | 1 | DONE (limited: "stays behind in a special narrative event" waits for the events thread) |
| Techno §6.5 Comeback Chronicle: "The Score Is Settled!" (beats a species that beat it before), last stands; both give a Comeback Record tag and the "Comeback Kid" title; Wins while underleveled = Broke Through Limits | 1 | DONE (limited: no records for raid strategy failing or disabled signature move) |
| Techno §6.6 Promise: two losses to the same species make an optional promise, listed on the Story screen; beating it gives "A Promise Kept!", a memory and the "Promise Keeper" title | 1 | DONE (the rival, protégé and survive-a-raid promise kinds: limited) |
| Techno §6.7 Wild Recognition: a species that beat your team ambushes (+1 Attack), a wild kin of a party member is recognised | 1 | DONE (limited: spared-species approach, escaped Pokémon returning with new moves, rare observer) |
| Techno §6.8 Team Chemistry: Perfect Timing (bonded physical + special pair, +1 Attack on opening), Cover Partners, Competitive Duo, Battle-Tested, Unlikely Friends, derived from history and bonds, listed on the Story screen | 1 | DONE (limited: Old Rivals New Allies; Battle-Tested/Competitive Duo/Cover Partners/Unlikely Friends show a label only) |
| Techno §6.9 Retirement & Reunion: Past Pokémon archive and reunion join already existed (M8.9); now the archive keeps each Pokémon's legacy titles and they return with it | 1 | PART: Hall of Fame display and trainer battle with a recorded team need the hub thread |
| Techno §7A Rival Tournament Circuit: a ranking of the rivals still in the running (`circuitRanking`), shown on the Story screen | 1 | DONE: ranking plus a three-round bracket (`core/story/crisis.ts`, events in `tools/events/crisis.ts`): enter at a Rival Circuit stop (₽300), then a quarterfinal, semifinal and final, one per stage and always placed until played; withdraw any time; wins pay and advance the bracket |
| Techno §7B Regional Crisis | 1 | DONE: each region has a crisis meter (0 to 5) that rises one per stage; 4 report events (always placed once it is 2+) and a rival-help event ease it or grow it and gather Aid; at 3+ the region's boss is empowered (+1 Attack), and Aid 2+ gives your lead +1 Defense. Plus Grand-Enemy Escalation and rival alliances |
| Techno §7C Starter Destiny: your chosen starter facing a trainer 6+ levels above it gets "The Starter's Destiny" (+1 Attack, memory) | 1 | DONE (species-specific scenes: limited to this one authored scene) |
| Techno §7D Champion Memory: the Champion win records the decisive hit; a Pokémon that struggled against an earlier boss becomes the MVP; titles "Champion's Finisher" and "From Struggle to MVP" | 1 | DONE (limited: protector/survivor records) |
| Techno §7E Campfire Stories: once per stage a short scene from bonds, mentorships or a quiet Pokémon volunteering, in the chronicle | 1 | DONE (limited: text only, no choice) |
| Techno §7F Final Rival: in the last region the rival who defines your journey comes back with a line recreating where you first met | 1 | DONE (limited: no rebuilt first-encounter arena) |
| Techno §8 Memory-driven chaining: 7 chains (`chains.ts`), rivalry, mentorship, Promise, Comeback, Grand-Enemy and Chronicle stories all read the shared history | 1 | DONE |
| Techno §9 Architecture and safeguards: definitions vs runtime records, event ledger (no double apply), identity across evolution, left-party safety, seeded deterministic adaptation, caps on rivals, tests in `highHype.test.ts` | 1 | DONE |

## Implementation Plan Electric
Source: `Implementation Plan Electric (text).md` (copy: `docs/plans/electric-plan.md`).

| Section | Status |
|---|---|
| §1 Core Game Event Bus (domain events, effect ledger) | DONE (M8.9-0) |
| §2A Rivalry / §2B Nemesis | rivals threads; §2B nemesis DONE (`core/story/nemesis.ts`) |
| §2C Dynamic Event Director | DONE: common/uncommon/rare/epic tiers, eligibility from party, friendship, attributes, items, earlier events, bonds, rivals, species tags and the region's focus (5 new condition kinds), 2-4 options with their odds shown, no repeats, every choice and gamble remembered in the chronicle; 5 new Director events incl. the researcher who recognises a rare form (limited: sacrifice-style events and permanent discoveries beyond Research Points) |
| §2D Bond & Protégé | Protégé PART (above); Bond via rival bonds/Overdrive bond moments |
| §2E Raid & World Crisis | Raids thread |
| §3 Spectacle layers 1–2, animation fallback | DONE (M9) |
| §3 Layer 3 transformations | PART (Hyper evolutions add banners; cinematics M9.5) |
| §3 Layer 4 boss spectacle, dynamic music, arena modifiers, victory moments | Boss phases exist for raids/Totems (state-driven); commentary = Drama thread (done). Cinematic presentation, music layers and victory sequences belong to the visual battle thread (VISUAL_BIBLE); not built here |
| §4 Campaign dramatic arcs, route consequence engine | DONE: `core/campaign/director.ts`. Five acts per region told in the chronicle, a regional recap before the next region, a seeded region focus (mystery, rivals, raids, exploration) that changes den odds, six route labels on the map (safe, high-risk, mystery, research, nemesis, story), maps validated completable over 60 seeds. Limited: focus changes raid and expedition odds only; mystery and rival focus are told, not mechanical |
| §5 Living hub | Research Lab = Research Room (collection sets, milestones). Hall of Fame (#168). Training Center = Training School (#171). Species/Trainer mastery (Mastery room, Trainer Quests, Wardrobe). Campaign chronicle = Story screen. NEW here: Contract Board (`core/contracts.ts`, `contracts.json`: 3 daily + 2 weekly contracts rotating by UTC date, done within one run, paid once through the claim ledger, shown in the Event Hall and on the run summary) and Rival ghosts (an archived rival's lead Pokémon returns as the new rival's ace). Legacy runs are covered by Reunion (past Pokémon return with their titles), the legacy rival and kept titles; no extra stat bonus on purpose (permanent unlocks stay horizontal). Done |
| §6–§9 roadmap, directive, scale guidance | followed (CLAUDE.md) |

- Untitled Phase D1: special forms event-only (specialForms.json, special-form-leaks gate). Done. D2 services, acquisition routes, Daily/Endless/Spooky modes: still to build.

- Untitled Phase E2: Daily Run, Endless, Spooky modes done (rules.ts dailySeed/extendEndless/spookyWild). No modifier or mode is left as planned.
### Bond Engine for your Pokémon (`src/core/bond/`, built for the Drama follow-up)
The rivals' Pokémon already had bonds (`core/rivals/bonds.ts`); yours now do too, in the same `Bond` record, saved in the Pokémon's story history (`bond`, optional, created on first use).
| Item | Status |
|---|---|
| Seven values + trait (12 traits shared with rival Pokémon), starting values by how it joined | DONE |
| Growth and strain: faints strain, Hyper moments and knockouts deepen, won battles raise trust and sync | DONE |
| Refusal: willful (autonomy 60+) and distrusting (trust 35−) Pokémon refuse a reckless order (a move that faints the user) once per battle; the turn is spent (`idle` action); foreshadowed by "(may refuse)" in the move list | DONE |
| Pokémon Takes Initiative: sync 70+ and trust 60+ swaps an immune-target command for its best working move, once per battle | DONE |
| Unplanned Combination: an open Bond relationship pair (sync 50+) hands over with +1 attacking stat; rivals with bonds do the same for their next Pokémon | DONE |
| New Move: at half HP a trusted Pokémon (or a confident rival Pokémon) reveals the strongest valid learnset move, replacing its weakest if full | DONE |
| Pokémon Recognition: rival memory now stores which of your Pokémon fought it (`foes`); its Pokémon recognises them | DONE |
| Rival Interruption: a second living rival watches gym/boss/rival battles; a rival-graph tie or a rivalry step forms | DONE |
| Emotional Turning Point: five feelings counted from real events for both sides; yours become tagged memories, a rival's trainer comments and remembers | DONE |
| Bond screens (summary UI for the seven values), bond-based evolution/moves outside battle | TODO (UI belongs to the visual thread) |

- Untitled Phase D2 (§19), slice 1: Center, Tutor, Reminder, Lab, Trade Post, Scout Tower done (services.json). Left: Specialist Mart, Dojo, Nursery, Ability Researcher, Fossil, Safari, Relic Shrine, Black Market, Auction, Garden, School, Event Hall, Rival Meeting Place, Raid Observatory, Lodge.

- Untitled Phase D2 (§19), slice 2: Specialist Mart, Training Dojo, Rival Meeting Place done. Left: Nursery, Ability Researcher, Fossil, Safari, Relic Shrine, Black Market, Auction, Garden, School, Event Hall, Raid Observatory, Lodge.

- Untitled Phase D2 (§19), slice 3: Lodge, Relic Shrine, Auction House, Event Hall, Raid Observatory done. Limited/left: Nursery (no egg system), Ability Researcher (waits on ability mechanics), Fossil Restoration, Safari, Black Market, Garden, School.
- Rival world slice A (`rivals/standing.ts`, `rivalWorld.json`, `story.standing` defaults so no save bump): 6 sponsors (advance + stipend, advance called in after 2 more boss wins), 4 factions (League up, Syndicate down on boss wins), debts (player owes a sponsor; a spared rival owes a favour and goes 1 level easier once), rival sponsors (+1 level), Story screen Standing row. Left: arcs (slice B), Pokémon transfer and unscheduled challenge (slice C).

### Hyper and Overdrive rarity (Kice, 2026-10-30: "significantly more rare, they need to feel rewarding and not just guaranteed")
| Change | Status |
|---|---|
| Every Overdrive moment that helps your side now passes a seeded roll (30%; 50% for banner-only moments), fixed by the run's seed and never a gameplay stream; enemy-side moments are unchanged so difficulty does not drop | DONE (`story.rarity` in story.json) |
| At most 1 helpful moment per battle (2 in a boss fight), ordinary battles at least 2 battles apart | DONE |
| Original Hyper chance rules are scaled to 40% (e.g. Toughened It Out 15% becomes 6%) | DONE |
| Signature Move Awakening needs 14 uses (was 8) and one per Pokémon (was 2); a mentor needs 10 battles (was 6) | DONE |
| Exempt (earned once, or a player's own choice): Mega/Z/Dynamax/Tera banners, Evolved Beyond, Student Surpassed, Teacher's Last Lesson, Grand-Enemy Grudge, Rival Respect | by design |
- Rival world slice B: 19 bond/Overdrive arcs (`rivalBondArcs.test.ts`: each fits its trigger, none repeats, a running arc is never replaced). Left: Pokémon transfer and unscheduled challenge (slice C).

- Rival world slice C: Pokémon transfer + unscheduled challenge (`rivalTransfer.test.ts`). All 24 §8 mechanics now run.
- Untitled Phase D2 (§19), slice 4: Nursery done (buys a Mystery Egg, one per stop; hatching is the existing egg system). Left: Ability Researcher, Fossil, Safari, Black Market, Garden, School.
- Untitled Phase D2 (§19), slice 5: Fossil Restoration done (two seeded fossils per stop, paid, revived at the party's average level). Left: Ability Researcher, Safari, Black Market, Garden, School.
- Untitled Phase D2 (§19), slice 6: Training School done (+2 levels for one Pokémon, once per stop, level cap respected). Left: Ability Researcher, Safari, Black Market, Garden.
- Untitled Phase D2 (§19), slice 7: Black Market done (three seeded shop items your badges haven't opened, at 2x; one buy). Left: Ability Researcher, Safari, Garden.
- Untitled Phase D2 (§19), slice 8: Berry Garden done (one seeded held berry per stop, paid, given to one Pokémon). Left: Ability Researcher, Safari.
- Untitled Phase D2 (§19), slice 9: Safari Preserve and Ability Researcher done. Every §19 building is now built.
- Untitled Phase F, event registry and scheduling boundaries: done (registry checks in data/index.ts, boundary tests in gameEvents.test.ts). Species mastery slice was built by the starter-sets thread (core/mastery.ts); special-form acquisition routes remain in Phase D.
- Untitled Phase D leftovers: duplicate compensation done (unlocks.ts, all three reward paths). Special-form routes: npcTrade now limited (regional forms). Left: egg-born special forms, researchQuest clue chains, secretRoute detours, Delta/Z sets.
- Untitled Phase D, egg route: done as limited (Regional Egg at the Nursery). Left: researchQuest clue chains, secretRoute detours, Delta/Z sets.
- Untitled Phase D, researchQuest route: done as limited (Form Research clue chain, regional forms). Left: secretRoute detours, Delta/Z sets.
- Untitled Phase D, secretRoute: done as limited (Hidden Path event). Left: Delta/Z sets.
- Untitled Phase D, Delta/Z starter sets: done (delta-set, z-set pools, unlock by event claim). Phase D complete; remaining limits are listed in specialForms.json.
- Untitled Phase G (deterministic simulations): economy, early loss rate, mode multipliers, item rarity and attribute pace are all in `npm run report:economy`. Tuning is owned by the rebalance thread. Still not done in Phase G: viewport/UI pass (visuals thread) and the Playwright sweep.
- Untitled Phase D, form-family routes: Delta Research, Z-Form Trial and Haunted Detour run-event chains built (events.json). Still not built: egg-born Delta/Z/Spooky forms and Delta/Z trades.
- Untitled Phase D, form eggs and trades: done (Nursery formegg:* options and Trade Post pool open after the route battle flag).

## Left-out plan 1.5: Legacy & Live hub systems (GAME_DESIGN §14.1, §14.6, §14.8)
| Item | Status |
|---|---|
| Research Tree (10 nodes, Prestige-gated) | DONE |
| Prestige (5 ranks, never deletes collection) | DONE |
| Trainer Network (one service per trainer, start parcels) | DONE (limited: parcels only) |
| Permanent Item Museum (+ RP milestones) | DONE |
| Regional Intelligence Board | DONE |
| Move Research room (training up to Silver) | DONE |
| Hub that grows visually (6 props) | DONE (procedural art) |
| Shared seeds (Seed Shelf; seed codes existed in Run-Prep) | DONE |
