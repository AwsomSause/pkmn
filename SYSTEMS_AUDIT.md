# Systems audit (M8.6)

The real status of every planned system on 2026-10-25, checked against the code and the tests on `main` (after PR #14). A milestone marked done does not prove a feature works, so every line below names its evidence.

**How it was checked:** `npm run check` (type check, 255 unit tests, production build, content gate: all passed), `npm run test:e2e` (20 browser tests: 19 passed and the Blind Draft test timed out once, then passed when run again), `npm run report:content` and `npm run report:balance` (both new in this milestone), and reading the code. Systems being built in other threads right now (M8.5 Advanced Mechanics, M8.75 item effects, M8.9-0 story foundation, M10 redesign) are listed as they are on `main`, not as they are on their branches.

## Status words

| Status | Meaning |
|---|---|
| **Working** | Built, connected to the screens, and covered by unit and browser tests. |
| **Working, untested in browser** | Built and unit-tested, but no Playwright test goes through it. |
| **Partial** | Some of the planned behaviour is in; what is missing is listed. |
| **Stubbed** | Something stands in for it (a placeholder rule or screen). |
| **Not started** | Planned, no code yet. |

## Summary

- **Working:** 36 systems (3 of them new in this milestone, 2 without a browser test). The core loop (trainer, starter, map, battles, catching, rewards, shops, gyms, league, regions, run end, Hub, Bank, achievements, Run-Prep, saves) is complete and tested end to end in the developer campaign.
- **Partial:** 6, **stubbed:** 2 (the double knock-out rule and the Grand Region). The biggest gaps: 611 of 934 moves (65%) can't be used yet, levels stop at 100 so regions 3 to 10 all play at level 100, and the Grand Region has no roster or final boss.
- **Not started:** 11, all already scheduled in M8.5 to M11.
- **Content:** no broken data (0 invalid entries), no missing art or sound, no broken evolutions, no unreachable map nodes, every save upgrade tested. Details in [`docs/quality/CONTENT_REPORT.md`](docs/quality/CONTENT_REPORT.md).
- **New findings from this audit**, in order of importance:
  1. **GitHub Actions has never run on this repository** (0 workflow runs ever, checked with the GitHub API). The CI file is correct, so the tests, the build and the new content gate only run when someone runs `npm run check` by hand. Kice needs to switch Actions on (repository Settings → Actions → General → "Allow all actions").
  2. **Champions are close to unbeatable** in the battle simulations: a fresh party at the curve level wins 0–3% of champion battles in every region, against 30–60% for the region's gyms. Real players have items and a chosen team, but the jump is large. See [`docs/quality/BALANCE_REPORT.md`](docs/quality/BALANCE_REPORT.md).
  3. **From region 3 on, every enemy is level 100** (level cap D14 is not built yet), so the curve flattens and later regions differ only by team training.
  4. **983 boss teams repeat an earlier team's Pokémon and moves** (only the training stacks differ), and 6 are exact copies. Most are late champion and Elite Four teams of bosses with a small type pool: later regions can feel like a rematch.
  5. **27 wild lines win 10% or less of one-on-one battles**, mostly because their moves aren't supported yet (Wobbuffet, Wishiwashi, Pyukumuku, Shuckle, Shedinja, the Delta Ditto forms). They are fine to meet but poor to catch.
  6. **One browser test is flaky**: "the Blind Draft hides the starters" timed out once when all tests ran together and passed alone. It looks like the known dropped-key-press problem after a scene change.
  7. Battles keep Abra, Ditto, Unown, Smeargle and Cosmog out entirely (no supported moves). Smeargle still appears on one boss's team with moves the boss generator gave it.

## Core rules and battle

| System | Status | Evidence | Gaps and notes |
|---|---|---|---|
| Damage formula, STAB, type chart, immunities, crits | Working | `src/core/battle/damage.ts`; `damage.test.ts` (hand-calculated values) | Whole-number rounding after each step can differ from the main games by about 1 HP (documented M1 limit). |
| Accuracy, evasion, stat stages, priority, Speed order | Working | `damage.ts`, `engine.ts`; `damage.test.ts`, `battle.test.ts` | |
| Status conditions (burn, poison, paralysis, sleep, freeze) | Working | `engine.ts`; `battle.test.ts` | No badly-poisoned, confusion, or volatile statuses. |
| Move effects: secondary status, flinch, stat changes, drain, recoil, fixed damage, PP, Struggle | Working | `engine.ts`; `battle.test.ts`, `milestone3.test.ts` "imported effects" | Only these effect kinds exist. |
| Move coverage | **Partial** | `npm run report:content`: 311 supported, 12 supported with documented limits, 611 disabled | 12,549 level-up entries are skipped. Missing: multi-hit, two-turn, Protect, weather, terrain, healing, hazards, screens, variable power, switching moves, Z-Moves and Max Moves (M8.75 C). |
| Abilities | Not started | No field in `SpeciesSchema` | M8.75 C. |
| Held items | Not started | No held-item slot on `PokemonInstance` | M8.75 C. Trade evolutions use the Linking Cord from the Bag instead. |
| Enemy AI | Working | `chooseEnemyMove` in `engine.ts`; `bosses.test.ts` "a clever boss picks its best move" | Ordinary trainers pick random moves; bosses pick their best move with chance `ai`. Enemies never switch or use items (M8.75 C). |
| Double knock-out rule | **Stubbed** | M1 known limit | If both Pokémon faint in the same turn, the player wins. |
| Switching, forced replacement after a faint | Working | `milestone2.test.ts` "switching"; `milestone2.spec.ts` | |
| Catching, shakes, shinies | Working | `capture.ts`; `milestone2.test.ts`; `milestone2.spec.ts` | |
| Last Stand Charm, Love's endure | Working | `milestone2.test.ts`, `milestone7.test.ts` | |
| Experience, level-up, move learning | Working | `pokemon.ts`; `pokemon.test.ts`, `milestone2.test.ts` | Levels capped at 100 (`balance.difficulty.maxLevel`). |
| Evolution (level, stone, trade, friendship, branches, regional) | Working | `evolution.ts`; `milestone6.test.ts`, `milestone8_75.test.ts`; `milestone6.spec.ts` | 64 evolutions are "limited": substitute rules (Linking Cord, Soothe Bell), Tyrogue's condition, regional branches. Gender and time of day don't exist. |
| Friendship | Working, untested in browser | `friendship.ts`; `milestone8_75.test.ts` | N's passive and friendship events wait for M8.75 A/B. |
| Advanced mechanics: Mega, Tera, Z-Moves, Dynamax | Not started on `main` | 210 forms are "disabled" (mega, gigantamax, primal, battle) | Being built in M8.5 (separate thread). |
| Battle animations from the asset pack | Not started | `BattleScene.ts` uses hit flashes, HP and EXP bar tweens and ball shakes only | M9. |
| Presentation-cue layer, reduced motion, animation skip | Not started | No code | CLAUDE.md §5 asks for it; M9.5. Battle results are fully decided by the engine before the screen plays them, so animation can't change outcomes today. |

## Run structure

| System | Status | Evidence | Gaps and notes |
|---|---|---|---|
| Trainer select and archetypes (Red, Blue, Green, Brock, Misty, Giovanni) | Working | `archetypes.ts`; `run.test.ts`, `milestone5.test.ts`; `milestone1.spec.ts`, `milestone5.spec.ts` | Cynthia, Oak and N are "coming later"; D12 trainers not started. |
| Starter select and starter pools | Working | `runPrep.ts`; `milestone5_5.test.ts`; `milestone5_5.spec.ts` | |
| Stage maps (20 levels, forks, 2 trainer columns, gym) | Working | `map.ts`; `milestone3.test.ts` (validator over hundreds of seeds); content report: 0 problems in 402 generated maps | |
| Stage themes (all 153 type pairs) | Working | `themes.ts`, `themes.json`; `milestone3.test.ts` | |
| Side stops: healing, shop | Working | `run.ts` `visitSide`; `milestone3.spec.ts` | |
| Side stops: special encounters, events, trades, detours, merchants | Not started | `SideStopSchema` only has `heal` and `shop` | M8.75 A. |
| Difficulty curve per region | **Partial** | `encounters.ts`; `milestone3.test.ts`, `milestone4.test.ts`; balance report | Regions 3–10 sit at the level-100 cap (D14 up to 500 is decided, built in M8.75 G). No party-strength correction. |
| Reward draft (5 choices, rarity, luck) | Working | `rewards.ts`; `run.test.ts`, `milestone7.test.ts`; `milestone1.spec.ts` | M8.75 item effects is replacing the item list in another thread. |
| Shops and prices | Working | `run.ts`; `milestone4.test.ts`; `milestone3.spec.ts` | |
| Gym leaders, Elite Four, champions with boss teams | Working | `encounters.ts`, `bossTeams.json`; `bosses.test.ts`; `milestone4.spec.ts` | Many late teams repeat (finding 4). Champions very hard (finding 2). |
| Regions, region order, league, region transition, victory | Working | `regions.ts`; `milestone4.test.ts` "the dev campaign, start to finish"; `milestone4.spec.ts` | |
| Grand Region | **Stubbed** | `regions.json` has a `grand` region with borrowed bosses | No roster, final boss or ending (M9). |
| Custom regions (Torren and others) | Not started | | M8.75 G. |
| Developer campaign | Working | `?campaign=dev`; `milestone4.spec.ts` | |
| Attributes and luck (10 stats as 6 values + 2 meters) | Working | `attributes.ts`; `milestone7.test.ts`; `milestone7.spec.ts` | Events that change attributes wait for M8.75 A. |
| Candies | **Partial** | Earned on release, added to the profile once (`milestone2.test.ts`) | Nothing to spend them on yet (M8.75 D). |
| Money and the Bank (Bank Credits, stipend) | Working | `progress.ts`; `milestone5.test.ts`; `milestone5.spec.ts` | Bank tiers 1–5 not started (M8.75 D). |

## Out of run

| System | Status | Evidence | Gaps and notes |
|---|---|---|---|
| Hub (Trainer Archive, Achievement Hall, Bank, Run History, Attributes room, save data) | Working | `HubScene.ts`; `milestone5.spec.ts`, `milestone7.spec.ts` | Visual redesign in M10. |
| Achievements (31, tiers, hidden) | **Partial** | `progress.ts`; `milestone5.test.ts` | Checked only when a run ends, not the moment they happen (M8.75 E). |
| Research Points and the Starter Laboratory | Working | `milestone5_5.test.ts`; `milestone5_5.spec.ts` | Pokédex & Research room not started (M8.75 E). |
| Licenses, preparation tokens, draft rules, presets, briefing | Working | `milestone5_5.test.ts`; `milestone5_5.spec.ts` | Only 3 licenses and 3 tokens; challenge modifiers, contracts not started. |
| Starter and trainer mastery | Not started | | M8.75 E. |
| Story systems (event bus, chronicle, rivals, nemeses, Hyper/Overdrive, emotions) | Not started | No `story` or `hyper` RNG stream yet (`rng.ts` has 7 streams) | M8.9-0 (separate thread) and M8.9. |
| Raids, Grand-Enemies | Not started | | M8.95. |
| Legacy systems (Hall of Fame, Berry Garden, Prestige, Rival Ghosts...) | Not started | | M11. |

## Data, saves and tools

| System | Status | Evidence | Gaps and notes |
|---|---|---|---|
| Content validation (Zod + cross-references) | Working | `src/data/index.ts`; `content.test.ts` | Now also the content report (this milestone). |
| Support status on every entry | Working (new) | `src/quality/supportStatus.ts`; `quality.test.ts` | Worked out from the data each time; hand notes in `src/quality/knownLimits.json`. |
| Species and forms (1,027 + 591) | Working | `milestone6.test.ts`, `milestone8.test.ts` | 1,002 species and 105 forms fully supported; 5 species and 210 forms disabled; 0 invalid. |
| Assets: sprites, icons, cries, trainers, items, arenas, music | Working | Content report: 0 missing files; `milestone6.spec.ts` (lazy loading) | 329 entries (almost all of them the director's custom forms) use another species' cry; 8 forms use another entry's art (documented). |
| Saves: versioned records, backups, corrupt-save recovery, newer-version refusal | Working | `saveManager.ts`; `save.test.ts`; `milestone1.spec.ts` | |
| Save upgrades (profile v1→v5, run v1→v8) | Working | Every one of the 11 upgrades has a unit test that loads an old save (content report check `untested-save-migrations` = 0) | |
| Save export and import | Working | `milestone5.test.ts` | |
| Seeded RNG streams, determinism | Working | `rng.ts`; `rng.test.ts`, `run.test.ts` "the same seed and the same choices reproduce the whole run" | |
| Debug panel (F2) | Working, untested in browser | `src/debug/debugPanel.ts` | |
| Settings | **Partial** | `DEFAULT_SETTINGS` has music volume, effects volume and mute | Only Sound on/off is on screen; no visual intensity, reduced motion or animation speed (M9.5/M10). |
| CI on GitHub | **Not running** | `.github/workflows/ci.yml` is correct, but GitHub reports 0 workflow runs ever | See finding 1. |
| Content report and quality gate | Working (new) | `npm run report:content`, `npm run report:check`; `quality.test.ts` | See QUALITY_GATES.md. |
| Balance simulations | Working (new) | `npm run report:balance`; `quality.test.ts` (same seed, same results) | |
| Asset and data provenance list | **Partial** | Sources are named in CHECKLIST.md, the import tools and GAME_DESIGN.md | No single `ASSET_SOURCES.md` yet (Electric plan risk "asset licensing"). |

## Save compatibility risks for the work starting now

- M8.5 (Mega, Tera...) and M8.9-0 (story) will both add fields to the run save. Each needs its own version number and upgrade test; if both merge, the second one must rebase its version number. The `untested-save-migrations` gate catches an upgrade with no test.
- Raising the level cap above 100 (D14) touches `PokemonInstanceSchema` (`level` max 100), the boss team schema and `levelFromXp`. Old saves stay valid (their levels are lower), so no upgrade is needed, but the schema maximums must move together.
