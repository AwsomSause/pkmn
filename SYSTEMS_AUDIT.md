# Systems audit

The real status of every system on 2026-10-30, checked against the code, the unit tests and the browser tests on `main`. A milestone marked done does not prove a feature works, so every line names its evidence. The first audit (M8.6, 2026-10-25) listed 11 systems as "not started"; this refresh replaces it.

**How it was checked:** `npm run check` (type check, unit tests, production build, content gate), `npm run test:e2e` (56 browser tests on `main`, all passing; plus 4 new window-size tests), `npm run report:dashboard` (the machine-made list; open `docs/quality/dashboard.html`). The mechanics list lives in `src/quality/mechanics.json`: each entry names its code and its unit tests, and the report marks an entry "invalid" if either file is missing. Never trust this page over a fresh `npm run report:content`.

## Status words

| Status | Meaning |
|---|---|
| **Working** | Built, connected to the screens, covered by unit tests (and browser tests where noted). |
| **Limited** | Works, with documented limits. |
| **Not built** | Planned, no code on `main`. |

## Summary

- **Mechanics:** 42 listed; 35 supported, 4 limited (moves, abilities, Battle Drama, Trainers.md perks), 3 not built (Overdrive Breakthrough/Misfire events, double battles, egg hatching; the last two are in progress in other threads).
- **Content:** 87 of 934 moves can't be run by the engine (was 611); 0 broken evolutions, 0 missing sprites/cries/assets, 0 unreachable map nodes in 603 generated maps, 0 invalid entries, every save upgrade has a test.
- **Open findings**, in order of importance:
  1. **GitHub Actions is now switched on** (2026-10-30; it had never run before). The first runs on pull requests show whether CI itself passes: the browser tests take about 13 minutes there.
  2. **Boss teams are now all different**: `npm run data:bosses` retries a team with more variety whenever its lineup (Pokémon and moves) was already used, so the 6 exact copies and 983 repeats are 0 (baseline 0). Teams that needed a retry pick slightly weaker Pokémon than their first choice.
  3. **Browser tests are slow under load** (the full run takes about 12 minutes). Two long-fight tests now have a 180 s budget; keep new long tests on `test.setTimeout`.
  4. **The balance report now covers abilities and Mega/Tera/Z/Dynamax** (regenerated 2026-10-30): with every key item, stone and crystal the average one-on-one win rate rises from 47% to 61% and 24 lines win 90% or more (3 without). The kit makes fights much easier than the plain numbers show; watch this when tuning.
  5. **No translations exist** (the game is English only), so the plan's "incomplete translations" report has nothing to check.
  6. **Save versions are shared between threads**: profile 10, run 21, settings 4 on `main`. Take the next free number after fetching `origin/main`.

## Systems

| System | Status | Evidence (code · tests) |
|---|---|---|
| Battle engine, damage, type chart, status, weather, terrain | Working | `core/battle/engine.ts`, `damage.ts` · `battle.test.ts`, `damage.test.ts`, `terrain.test.ts` |
| Moves (934 in the data) | Limited | 839 supported, 78 limited, 17 not run · `moves2.test.ts` … `moves6.test.ts`, `movesTier1/2.test.ts` |
| Abilities (313) | Limited | 263 supported, 50 do nothing on purpose · `abilities.test.ts`, `abilities2.test.ts`, `abilities3.test.ts` |
| Held items | Working | `core/battle/held.ts` · `heldItems.test.ts` |
| Mega, Primal, Tera, Z-Moves, Dynamax / G-Max, boss transforms | Working | `core/battle/transform.ts` · `milestone8_5.test.ts`, `bossTransform.test.ts`; `milestone8_5.spec.ts` |
| Hyper evolutions (Overdrive §4) | Working | `core/battle/hyper.ts`, `core/story/hyper.ts` · `hyper*.test.ts`; `milestone8_9.spec.ts` |
| Catching, evolution, friendship, attributes and luck | Working | `capture.ts`, `evolution.ts`, `friendship.ts`, `attributes.ts` · `milestone2/6/7/8_75.test.ts`, `milestone6/7.spec.ts` |
| Stage maps, themes, side stops, "?" event stops, map items | Working | `map.ts`, `events.ts`, `mapItems.ts` · `milestone3.test.ts`, `events.test.ts`, `mapItems.test.ts`; `milestone3.spec.ts`, `events.spec.ts` |
| Regions, league, bosses (229 bosses, 8,244 teams) | Working | `regions.ts`, `encounters.ts` · `milestone4.test.ts`, `bosses.test.ts`; `milestone4.spec.ts` |
| Rewards, shops, draft items | Working | `rewards.ts` · `rewardDraft.test.ts`, `shopItems.test.ts`, `draftItems.test.ts` |
| Run-Prep, Starter Laboratory (70 sets), licenses, briefing | Working | `runPrep.ts` · `milestone5_5.test.ts`, `starterSets.test.ts`; `milestone5_5.spec.ts` |
| Hub, Bank, Trainer Archive, achievements, Run History | Working | `HubScene.ts`, `progress.ts` · `milestone5.test.ts`; `milestone5.spec.ts` |
| Trainer quests, Trainer Evolutions, Species Mastery | Working | `quests.ts`, `trainerEvolution.ts`, `mastery.ts` · `quests/trainerEvolution/mastery.test.ts`; `quests/trainerEvolution/mastery.spec.ts` |
| Trainer perks (Trainers.md) | Limited | `trainerPerks.ts` · `trainerPerks.test.ts`; added in batches (see the coverage tracker) |
| Rivals: memory, adaptation, bonds, arcs, chronicle, Grand-Enemy | Working | `core/rivals/`, `core/story/grandEnemy.ts` · `rivals.test.ts`, `rivalScheduler.test.ts`, `grandEnemy.test.ts` |
| Story engine, moments, emotions, mentorship, legacy, reunions | Working | `core/story/` · `story.test.ts`, `moments.test.ts`, `emotions.test.ts`, `mentorship.test.ts`, `legacy.test.ts`, `reunion.test.ts` |
| Battle Drama Engine | Limited | `core/drama/` · `drama.test.ts` · 21 of 23 library events; the 2 Overdrive events are planned |
| Bond Engine and Bond screen | Working | `core/bond/` · `bond.test.ts`, `bondScreen.test.ts` |
| Raids, Totems, Expeditions, Minigames, Service stops | Working | `core/raid/`, `core/totem`, `core/expedition/`, `core/minigame/`, `core/services/` · matching `*.test.ts`; `raids/totems/expeditions/minigames.spec.ts` |
| Weekly and holiday game events | Working | `gameEvents.ts` · `gameEvents.test.ts`, `holidayEvents.test.ts`; `gameEvents.spec.ts`, `holidayEvents.spec.ts` |
| Presentation cues, battle animations, reduced motion, skip | Working | `core/presentation/` · `visual.test.ts`; outcomes are decided before the screen plays them |
| Saves: versions, backups, corrupt-save recovery, export/import | Working | `save/saveManager.ts` · `save.test.ts`; `milestone1.spec.ts` |
| Seeded RNG streams, determinism | Working | `rng.ts` (streams: battle, capture, encounter, hyper, map, reward, shop, starter, story) · `rng.test.ts`, `run.test.ts` |
| Content report, support statuses, mechanics, dashboard, gate | Working | `src/quality/`, `tools/report-content.ts` · `quality.test.ts`, `qualityMechanics.test.ts` |
| Balance simulations | Limited | `quality/balanceSim.ts` · `quality.test.ts`; report out of date (finding 4) |
| Window sizes, console errors, failed requests | Working | `viewports.spec.ts` (4 sizes: 1280×720, 1024×600, 768×1024, 390×844) |
| CI on GitHub | Working (just switched on) | `.github/workflows/ci.yml`; first runs being checked |
| Double battles, egg hatching, Overdrive events | Not built | other threads |

## Save compatibility risks

- Every new field on a run, profile or settings record needs a default (`.default()` / `.optional()`) so old saves load, a version number only when the shape changes, and an upgrade test. The `untested-save-migrations` gate catches a missing test.
- Raising the level cap above 100 (D14) touches `PokemonInstanceSchema`, the boss team schema and `levelFromXp` together.
- Anything that draws random numbers for a preview, hover or animation must not use a gameplay stream (CLAUDE.md §6).
