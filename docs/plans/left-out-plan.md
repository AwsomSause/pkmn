# Left-out plan: everything asked for but not (fully) built

Kice asked (2026-10-30 23:49): "Look through every file, chat, and document in the project and put together a plan to add everything you've left out accidentally or on purpose."

**How this was made.** Read STATUS.md, CHECKLIST.md, every tracker in `docs/plans/` (coverage, catalog, zip, visual, trainers), GAME_DESIGN §12–14, IMPLEMENTATION_PLAN, the Electric plan, the Hyper/Overdrive/Techno doc, the Balancing Overhaul doc, the Master Expansion Catalog, Kice's events plan, the starter-sets plan, the project chat and the open threads. Each gap below was then checked against the code on `origin/main` (0a80e4a4) with a grep, so "not built" means the code has no trace of it, not just that a doc says TODO.

**Size:** S = 1 PR, M = 2–3 PRs, L = 4+ PRs. **State:** NONE = no code, PART = some of it works, LIMITED = works with a documented cut.

**Copy:** `/mnt/project-files/plans/left-out-plan.md` (same text).

---

## Already in flight (don't start twice)
| Item | Owner thread | State |
|---|---|---|
| UIE Custom UI art: Z6a map header (PR #291), then trainer card, load/options backgrounds, party, Pokédex, bag screens | Implement everything from the asset zips | PART |
| Playtest 500, round 2 numbers and page update | Playtest 500 runs and chart findings | PART |

---

## P0 — fix the record, and honour decisions Kice already made
| # | Item | Source | State now | Size |
|---|---|---|---|---|
| 0.1 | **Wire `availability.json` into the game.** It holds earliest region/stage and minimum level for 1,025 species (from Kice's spreadsheet) but no code reads it. Use it for wild pools, trainer picks and the raid boss pool; a species not yet unlocked has zero odds in ordinary encounters. | Kice decision "use the spreadsheet levels as starting encounter values"; Balancing Overhaul Phase 3; Blueprint raids "availability not wired" | DONE (`core/availability.ts`: unlock at sheet min level − `balance.availability.levelSlack`, rarity weights; wild, trainers, fishing, raid dens) | M |
| 0.2 | **Real music and sound from the packs.** The game has 23 BGM files (one wild, one trainer battle theme, menu, credits, raid songs) and 12 sound effects. Add battle themes for gym leader, Elite Four, champion, rival, final boss, Totem; map/route, Hub and region themes; menu, stat up/down, status, item and save sounds. The UIE rar has 51 BGM and 886 SE, the EBDX zip more. | Zip coverage (UIE "PART"), Visual coverage "boss music: needs tracks", Visual Bible audio, catalog L 126–130 (only procedural layers built) | PART | M |
| 0.3 | **Emit the 3 story events that are defined but never fire:** `traded` (Trade Post / trades), `trainerEscaped`, `eventChoice` (every map event choice). Then let the Chronicle/quests read them. | STATUS "Biggest known gaps" | NONE (`transformed` now fires; the line in STATUS is stale) | S |
| 0.4 | **Clean the trackers.** STATUS "In progress / next" lists finished work (perk batches, M8.75 parts, M9, "CI never ran"), duplicate lines (items, Z-to-M perks, E1); CHECKLIST still shows built items unticked (C3b, 3c/4b, F, Grand Region, Lusamines); coverage-tracker says "Visual guides TODO". Make each line match the code, and point "next" at this plan. | CLAUDE.md "STATUS is one page"; Electric directive rule 1 (truth first) | stale | S |
| 0.5 | **Kice-only step:** turn on branch protection for `main` and require the `check` status (Settings → Branches). Three PRs merged before CI finished on 2026-10-30. | Project chat 20:25 | not done | Kice |

## P1 — big systems the design docs specify that are not built
| # | Item | Source | State now | Size |
|---|---|---|---|---|
| 1.1 | **Advanced AI port, the other ~44 scripts.** Only 3 of 47 are in (KO bonus, priority KO, danger switch); trainers already heal with items and switch on purpose (`balance.trainerAi` healBelow, maxItems, maxSwitches), so the item batch covers only what goes beyond that. Port in batches: item use in battle (potions, X items, status heals), ability-aware choices (immunities, Levitate, Flash Fire, Wonder Guard), setup and stat-stage logic, status move timing, weather/terrain play, doubles targeting and partner protection, smarter switching (predict, sack, pivot). Each batch behind `balance.trainerAi.*` with a test per behaviour. | `[000_AAI] Advanced AI System.zip`; priority list #1 "smarter trainers"; zip-coverage Z8 | PART (3/47) | L |
| 1.2 | **Encounter Director and Combat Threat Rating.** One encounter service for wild, trainer, gym, Elite Four/champion, event, quest and reward Pokémon: read progression state → eligible pool → rarity/level/form rules → weighted pick → validate (level, moves, ability, threat) → bounded retry → logged fallback. Threat rating per species/config with stage budgets (easy/standard/challenging/elite). Route event Pokémon through it so no event can bypass caps. 10,000-sample report per early stage and a per-stage diagnostics report (level spread, rarity, rejections, one-hit KOs, fallbacks). | Balancing Overhaul Phases 2, 4–10 (tracker: "2, 4–11 TODO") | DONE (`core/encounterDirector.ts`, `core/threat.ts`, report `docs/quality/encounter-director-report.md`; limits in `docs/status/encounter-director.md`) | L |
| 1.3 | **Nemesis system + the missing Overdrive moments.** An enemy (wild Pokémon, trainer ace or boss) that KOs your starter, beats several Pokémon, escapes a close fight or was spared becomes a nemesis: Incident → Return (changed moves/trait, telegraphed) → Reckoning (rare reward, memory, title). Archetypes: Survivor, Avenger, Stalker, Fallen Ace, Unfinished Business, Nemesis of the Nemesis. Missing moments (none in the code): "It Remembers That Defeat!", "This Isn't Over Between Us!", "The Enemy Is Fighting for Its Pride!", "Its Anger Is Becoming Dangerous!", "It Has Something to Prove!", "The Hunter Has Become the Hunted!", "This Enemy Will Return…". Respect the 30% rarity roll. | Techno §2 Nemesis; Hyper/Overdrive §1 and §3 "Rivalries, grudges, returning enemies" (tracker: 12 TODO); Electric M8.9 "rivalry, nemeses" | DONE (`core/story/nemesis.ts`, run v25) | M–L |
| 1.4 | **Bank and the rest of the Out-of-Run design.** Bank tiers 1–5 (services, not multipliers); licenses Scavenger, Fortune, Survival (3 of 6 exist); Emergency Reserve, Exchange Counter, Collector's Vault, Regional Accounts, Loan Challenges, savings milestones; draft modifiers Expanded Research, Regional Research, Rare Specimen, Evolution Specialist (Standard/Balanced/Blind/Type Focus exist); prep tokens for first-region intel, an item category and a small attribute bonus; Trainer Research (using a trainer reveals story and events); species-tagged starter events; achievements: the Relationship category (0 now), more chains and hidden achievements (31 today: 17 in chains, 2 hidden). | GAME_DESIGN §14.2–14.5, §14.7; CHECKLIST M8.75 D, E, F | PART | L |
| 1.5 | **Legacy & Live hub systems (Electric "M11").** Trainer Network (other trainers give small utility services), Research Tree, Prestige (never deletes collection), Permanent Item Museum, Regional Intelligence Board, Move Research room, a Hub that grows visually as you unlock things, shared seeds. | GAME_DESIGN §14.1, §14.6, §14.8; CHECKLIST M8.75 H; Electric §6 | NONE (Hall of Fame, Wardrobe, Contracts, Rival Ghosts, Berry Garden stop exist) | L |
| 1.6 | **Levels above 100 (to 500) and a bigger cap step per region** (Kice decided 2026-10-31: **+50 per region**, not the Balancing doc's +100). Level cap stops at 100 today. Grand Region curve and endgame cap stated in data; stat formula, XP curve, caps and boss teams checked by the playtest bot before and after. Also the "party-strength correction" in difficulty. | D14 (decided 2026-10-25: up to 500); Balancing Phase 2 (+100/region); CHECKLIST M8.75 G | DONE (PRs #301, #331, #347; docs/plans/levels-and-regions-plan.md) | L |
| 1.7 | **Custom regions.** D6 says the campaign mixes original and custom regions; only the Grand Region is custom. Design 2–3 custom regions (themes, roster rules, Torren-style identity) and add them to `regions.json`. | D6; CHECKLIST M8.75 G | DONE (PRs #301, #331, #347; docs/plans/levels-and-regions-plan.md) | L |
| 1.8 | **Raid Battles pack, the parts left.** Cheer actions in raids (3 cheer UI images), Raid Dens UI and Adventures UI art on the den preview and expedition screens; raid modifiers terrain, elemental surge, healing restriction, rotating weaknesses; bosses with more than four moves; a capture moment after a raid win (then the 4 skipped capture jingles fit). | Raid Battles.zip; Blueprint §1 TODO lines; zip-coverage | PART | M |
| 1.9 | **Totems with doubles.** True 2v1 (Totem and ally both on the field) now that the doubles engine exists; a unique status field effect; held-item uniques, Mega energy/stones and cross-run unlocks as rewards; Totem and expedition achievements; more expedition routes. | Blueprint §2–3 TODO lines | PART | M |

## P2 — finish partial systems and lift documented limits
| # | Item | Source | State now | Size |
|---|---|---|---|---|
| 2.1 | **Battle Drama gaps:** events for sent-out, status, miss, survived-a-hit, evolution and turning point; line picks by archetype/arc/bond; post-battle callbacks and encouragement; player-side declarations; mid-battle evolution for gym/Elite aces, not only rivals. | Drama tracker P2–P5 "limited" | LIMITED | M |
| 2.2 | **Rival limits:** personality-specific story behaviours (40 run as stat profiles only); battle-style tricks (berserker rage, trapping, copying) as battle hooks; type-specific habit pools; a rival giving or trading a Pokémon to the player. | Rivalry tracker §2, §3, §6, §8 | LIMITED | M |
| 2.3 | **Hyper/Overdrive limits:** emotion drawbacks/exhaustion; "Not Until It's Over"; Kindness peaceful encounters; "Feels Left Out" ask-to-lead screen; Team Chemistry labels that do something (Battle-Tested, Competitive Duo, Cover Partners, Unlikely Friends); Campfire scenes with a choice; Final Rival rebuilt first-meeting arena; Chronicle summaries per raid/region/nemesis; Protégé mastery sharing and mentor-taught move variants; rival chain steps 4–5; a trainer battle against a recorded retired team. | Overdrive tracker rows marked limited/PART | LIMITED | M |
| 2.4 | **Bond Engine:** bond-based evolution and move learning outside battle. | Bond Engine tracker | NONE | S |
| 2.5 | **Catalog leftovers:** 14 battle recap card after major battles (turning point, MVP, narrowest survival); 15 unscripted signature moments; 33 shiny discovery moment; 34/79 form silhouettes in the research log before catching; 78 Delta field research (habitat, lore); 80 form-specific passive traits; 81 Z-Form/Spooky intro and move presentation; 82 transformation mastery; 84 variant support report; 110 research notes for event families and form hints; 140 scene effects as data; 155 playstyle run titles (collector, tactician, survivor...); 157 temporary ally battles; 159 weather foreshadowed on the map; 161 validated local config packs. | catalog-coverage.md rows still PART/TODO | PART | L |
| 2.6 | **SOS limits:** chain bonuses, Adrenaline Orb, SOS in doubles/raids/Totems. | STATUS Z7 limits | LIMITED | S |
| 2.7 | **Campaign Director limits:** mystery and rival region focus change something real (not just text); sacrifice-style director events. | Electric tracker §2C, §4 | LIMITED | S |
| 2.8 | **Trainer perk re-reads:** ~20 perks were reinterpreted because a system was missing (Ginter shop rarity, Raihan sand/hail, Calem Mega cost, Giacomo/Ilima status "effectiveness", Trevor Pokédex rewards...). Revisit each now that more systems exist; keep the reading only where no better one fits. | trainers-coverage.md "limited" lines | LIMITED | S |
| 2.9 | **Small presentation limits:** Essentials Kit battle UI shows no name/level text from the kit; 130 forms still static sprites; Illusion is visual only. | STATUS limits | LIMITED | S |

## P3 — visuals, performance, release (Electric M9.5/M10)
| # | Item | Source | State now | Size |
|---|---|---|---|---|
| 3.1 | **Visual coverage TODOs:** perf pass (load time, frame pacing, memory), level-up / reward reveal / milestone transitions, per-region palettes, a unique champion arena, loading transitions, a "showcase" animation profile, a reduce-particles option, narrow-viewport text overlap, platform edge lights, miss/dodge sprite states. | visual-coverage.md TODO/PART rows | PART | M |
| 3.2 | **More pack art:** UIE battlebacks (202 in the pack, 61 arenas used), UIE character sprites for more NPC classes, the rest of DBK art and its mid-battle scripting ideas. | zip-coverage "PART" rows | PART | M |
| 3.3 | **Release gate:** full Playwright sweep at every viewport (Untitled Phase G), a test that loads a save from every old version, an accessibility check, and a written release checklist. | Electric M10; Untitled Phase G "still not done" | PART | S–M |

## Needs Kice's call (not planned until answered)
- **Regional forms as a battle mechanic** (M8.5 "if still wanted"). They exist as event-only forms today.
- **IVs/EVs, time of day, weather-based evolutions** (D2 said none; natures were added later). Add or keep out?
- **Online co-op, cloud saves, accounts** (catalog 160). The Electric plan says these are a separate project. Recommend: skip.

## Left out on purpose, and staying out
- Z-Moves, Max Moves and G-Max Moves only run through their own systems (87 move rows), by design.
- Hidden Power's type is fixed per Pokémon (D2, no IVs).
- Windowskins (RPG Maker frames; the Aero look replaces them).
- Gen 1 music: the packs don't have any; GB Sounds uses an original stand-in.

---

## Second sweep (2026-10-31): more gaps found
Kice asked to "search even further". Four more searches: the Untitled document and GAME_DESIGN line by line, the four visual docs, the other design docs (Blueprint, both Rivalry docs, Drama, Overdrive/Techno, Trainers.md, IMPLEMENTATION_PLAN §6j, QUALITY_GATES), and every thread's history (Kice's requests plus each thread's "not done" notes). Each item was grepped on `origin/main`. Item numbers continue the waves they belong to.

### Bugs and wrong data (do first, all S)
| # | Item | Source | Evidence |
|---|---|---|---|
| 4.1 | Daily Run's fourth-gym reward unlocks pool `daily-set`, which doesn't exist; its claim key `daily:fourth-gym` pays once ever, not once per daily | Untitled §16.2, §17.1 | `daily-set` appears only in `runRules.json`; `grantUnlocks` accepts any id with no check |
| 4.2 | Six trainers show raw sprite file names: `Spr_HGSS_Ethan`, `Spr_HGSS_Silver`, `Spr_Pt_Barry`, `Spr_Pt_Dawn`, `Spr_Pt_Looker`, `Spr_Pt_Lucas` | GAME_DESIGN D12 | `archetypes.json` names |
| 4.3 | Support statuses are stale: `mechanics.json` marks double-battles, egg-hatching and overdrive-events "disabled" and battle-drama/trainer-perks "limited"; notes still say G-Max effects, genders and doubles "not built"; `rivalCatalog.json` still marks alliance, mentor network and team-identity shift "planned". Re-check the 31 disabled forms, 64 limited evolutions and 4 disabled items | QUALITY_GATES; Electric rule 4 | `docs/quality/CONTENT_REPORT.md`, `src/quality/supportStatus.ts:121,131,153-155` |
| 4.4 | Recruit events offer NPC trainers you already own | Early NPC trainers thread | `npc-meet-*` events have no ownership condition |
| 4.5 | CI skips `report:assets` and `report:perf`, so the asset audit and load budget never gate a PR | QUALITY_GATES gates 4, 8 | `.github/workflows/ci.yml` |
| 4.6 | Battle badges (super effective, crit) repeat on every hit of a multi-hit move | Visual Bible 4.6 | `core/presentation/cues.ts:108-110` |
| 4.7 | Attribute growth: the economy report still shows ~10.8 points per run after #233 slowed it. Re-run the report and tune if still high | Untitled §6.3 | `docs/quality/ECONOMY_REPORT.md:51` |
| 4.8 | More stale tracker lines for 0.4: coverage-tracker says 180/220 trainers and raid crafting TODO; catalog-coverage says 148-150 and 154 TODO; CHECKLIST:206 says egg moves unsupported; QUALITY_GATES says 60 Playwright tests | several | grep as quoted |

### Wave 1–2 additions
| # | Item | Source | State | Size |
|---|---|---|---|---|
| 5.1 | **Candies can't be spent.** They're earned (release, keepsakes, events) but nothing uses them. Add a candy shop: trainer unlocks, starting buffs (D7) | IMPLEMENTATION_PLAN §6j D, D7 | NONE | S–M |
| 5.2 | **Achievements awarded when they happen**, not only at run end, with a toast | §6j E | NONE | S |
| 5.3 | **More rivalry moments:** "The Rivalry Has Only Grown Stronger!", "It Has Studied Your Strategy!", "It Hasn't Forgotten Your Kindness!", "It Hasn't Forgotten Your Cruelty!" (with 1.3) | Hyper/Overdrive §3 | DONE (`core/story/nemesis.ts`) | S |
| 5.4 | **Pokémon-to-Pokémon rivalry kinds:** Friendly (duo attacks, shared bonus), Bitter (reckless), One-Sided (pays off when mutual), Generational | Techno §1 | DONE (`core/story/rivalryKinds.ts`) | M |
| 5.5 | **Rival who wins without you:** a rival can become a Gym Leader, regional finalist or Champion; ladder states past "contender" | Rivalry Engine §15, phases 5, 7 | NONE | M |
| 5.6 | **Ultimate Rival presentation:** intro, emblem/title, custom battle intro, quest chain, "Previous Ultimate Rivals" in the Chronicle | Rivalry Engine §7, §14, phase 8 | PART | S–M |
| 5.7 | **Rival simulation report** over many seeds (how many rivals, resolutions, repeats, contradictions) + QA scenarios | Rivalry Engine phase 13 | NONE | S |
| 5.8 | **Raid memories** (First to Face the Beast, Broke Its Guard, Took the Hit for Everyone, The Final Blow Belonged to…, The One That Survived, The Rival Who Stood Beside You, The One That Got Away) and contribution rewards | Techno §3 | PART: first five built (5.8 PR); Rival Who Stood Beside You and One That Got Away come with 5.9 | S–M |
| 5.9 | **Raid types:** Regional Raid, Rival Raid (help, race for the last hit, or leave), Anomaly Raid; a boss that escapes and returns | Techno §3; Blueprint §1 Resolve | NONE | M |
| 5.10 | **Doubles limits:** only the left Pokémon can transform; Hyper moments and rage follow only the left pair; only Tate & Liza fight boss doubles | Doubles thread | LIMITED | M |
| 5.11 | **Daily Run as its own format:** curated daily starter set, daily modifiers, shorter route with a set final boss | Untitled §16.2 | PART | M |
| 5.12 | **Spooky Mode content:** its own events, shop stock, NPCs, bosses, battle lines and objectives (now it only turns 1 in 4 wilds Spooky) | Untitled §16.4 | PART | M |
| 5.13 | **Later modes:** Draft Lab, Regional Circuit, Research Expedition (Boss Gauntlet ≈ Boss Rush) | Untitled §16.7 | NONE | M |
| 5.14 | **Settings:** text speed, auto-advance, message delay, high contrast, colour-blind type markers, UI scale, sprite-animation toggle, damage-number toggle, "always show full catch details", last-save time | Untitled §12.1–12.2 | PART | M |
| 5.15 | **Fuller catch reveal:** Pokédex number, weaknesses/resistances, all abilities and Hidden Ability, move type/power/accuracy/PP, unsupported-move warning, catch source, first discovery, compare with a party member you pick, compact mode | Untitled §4.1–4.3 | PART | S–M |
| 5.16 | **Reward economy pieces:** a Legendary/Event reward tier (rarities stop at epic; 1 epic reward), Discovery-style Luck rewards (Discovery Charm, Research Lead, Supply Coupon, Form Clue, Draft Refractor), attribute tonic vs manual (manual has a drawback, repeat boosts diminish), Rare Goods Dealer and Research Exchange shops, "x/4 toward next point" on attributes | Untitled §3.1, 3.4–3.6, §6.3 | NONE/PART | M |
| 5.17 | **Generic trainer classes as data:** Lass, Camper, Picnicker, Swimmer, Breeder, Battle Girl, Ranger, Ace Trainer, Veteran, Reporter... with personality/dialogue tags and a battle style (today 18 classes, name + sprite only); fixed movesets for the 51 NPC trainers | Untitled §7.2; NPC trainers thread | PART | M |
| 5.18 | **Starter Lab extras:** Challenge and Daily set categories; Special Specimen (legendary/mythical starters with restrictions; today they're excluded everywhere); per-species mastery cosmetics (badges, sprite borders, frames) | Untitled §9.1, §18; GAME_DESIGN §14.5 | NONE/PART | M |
| 5.19 | **Hyper moment codex** on the account (moment types you've discovered) | Hyper/Overdrive §7 | DONE (`core/story/codex.ts`, Hub Moment Codex) | S |
| 5.20 | **Adventure mode:** show the wipe count and offer "end run" (now a silent cap of 8) | Playtest thread | PART | S |
| 5.21 | **Playtest in CI:** ~50 bot seeds per PR, fail on any crash or stuck run | Playtest thread | NONE | S |
| 5.22 | **Trainer unlock challenges** count feats from every run, not only runs as that trainer | Trainer unlocks thread | LIMITED | S |

### Wave 3 (visual) additions
| # | Item | Source | State | Size |
|---|---|---|---|---|
| 6.1 | Screens still plain (no glass or motion): Expedition, Minigame panel, DecisionScene (6 of 7 menus: learn move, teach, mentorship, PP Up...), GameOver menu, Briefing (no motion), Starter Select, Run Prep | Kice's style (Aero/DS/Wii, bouncy); VB | PART | M |
| 6.2 | Battle: contact shadows that follow the Pokémon and lifted flyers/levitators; parallax and foreground framing; gym and Elite Four arenas that build up (not plain type arenas); boss phase changes shift the arena light; target reticle in doubles; richer shiny/rare catch | VB 4.1–4.8; CR 5.1, 5.5, 6, 14 | NONE/PART | M |
| 6.3 | Separate shake and flash settings (one slider today; tracker wrongly says built) | VB 8; Brief phase 2 | PART | S |
| 6.4 | Healing stop animation; layered map backdrop with a stage landmark; reward cards saying who can use an evolution item / Mega Stone; summary tab for evolution, form and mastery | CR 6; VB 5, 6 | PART | S–M |
| 6.5 | Remaster deliverables: style guide (palettes, motion curves, layering), list of rejected/unresolved assets, a visual test gallery (move families, environments, cinematics, transitions), pixel compare for Hub and Trainer Select, a "before" set and a final report | CR 4, 7, 12, 13 | NONE/PART | S–M |
| 6.6 | EBDX's 442 scripted move animations are not played (only their graphics); port the most-used ones | Visuals thread | LIMITED | L |
| 6.7 | Essentials Kit battle UI: the EXP strip was never seen working; add a screenshot check | HP bars thread | untested | S |
| 6.8 | Art gaps: King N and Champion Oak evolutions reuse base art; Z-Crystal and Z-Ring icons are drawn placeholders (DBK has Z art) | Starter-sets thread; `tools/draw-z-icons.ts` | LIMITED | S |

### Corrections to the first sweep
- 1.1: trainers already heal and switch with purpose; only the AAI behaviours beyond that are missing.
- 1.4: hidden achievements and chains exist (thinly); only Relationship is at 0.
- 1.6: Kice chose +50 per region (2026-10-31).
- "Between-Level interactions" are built (the rest-spot events: Feed, Play, Groom, Talk, Train, Race, Spar, Treasure hunt, Photograph).

### Kice requests not fully finished
- Playtest 500: Kice asked for a comment after every five runs; the thread wrote one log file instead. Round 2 is still running.
- Asset zips: Custom UI screens still in progress (trainer card, options, party, dex, bag).

---

## Suggested order and threads
Each item is one or more vertical slices (rules + data + UI + save + tests + docs), one PR per slice, merged on green CI.

1. **Wave 1, in parallel (different files):** A) 0.3 + 0.4 docs and story events (S); B) 0.1 then 1.2 availability and Encounter Director (L); C) 0.2 pack music and sound (M); D) 1.1 Advanced AI port (L).
2. **Wave 2:** 1.3 Nemesis + Overdrive moments; 1.4 Bank and Out-of-Run; 1.8 + 1.9 Raids and Totems.
3. **Wave 3:** 2.1–2.9 limits; 1.5 hub systems; 3.1–3.3 visuals, perf and release.
4. **Last (biggest balance risk):** 1.6 levels to 500, then 1.7 custom regions on the new curve, re-run the 500-run playtest after each.

Every finished item updates its tracker row (coverage, catalog, zip, visual) and this file.
