# MAP.md — where everything is

Two-level map of the repo with one line per entry. Use it instead of `ls`-ing around. Line counts and sizes are rough (2026-10-30); anything over ~400 lines or ~100 KB is marked **big**: grep it, then read a tight window.

Update this file when you add, move or delete a folder or a key file.

## Root

| Path | What it is |
|---|---|
| `CLAUDE.md` | Router and short development directive. Start here. |
| `STATUS.md` | One-page current state: done, next, save versions, biggest gaps. |
| `README.md` | How to run the game, URL flags (`?seed=`, `?campaign=dev`, `?debug=1`), F2 debug panel. |
| `GAME_DESIGN.md` | Game rules and director decisions D1–D16, §1–§14 (360 lines). |
| `IMPLEMENTATION_PLAN.md` | Architecture, folder plan, every milestone's scope (341 lines). |
| `CHECKLIST.md` | Per-milestone done/known-limits list from M7 on (165 lines). M0–M6 in `docs/archive/checklist-m0-m6.md`. |
| `QUALITY_GATES.md` | Content support statuses, report tools, baseline workflow. |
| `SYSTEMS_AUDIT.md` | M8.6 audit of each system and its gaps. |
| `FEATURE_INTERACTION_MATRIX.md` | Which systems touch which (items × battle × saves …). |
| `package.json` | npm scripts: `dev`, `check`, `test`, `test:e2e`, `data:*` builders, `report:*`. |
| `.github/workflows/ci.yml` | CI: typecheck, unit, build, `report:check`, Playwright. |
| `.claude/rules/` | Short rules; path-scoped ones auto-load when you touch matching files. |
| `.claude/agents/` | Project subagents. `explore.md`: cheap read-only search on Haiku. |
| `.claude/settings.json` | Blocks reading `learnables.json` (one 1 MB line) and `package-lock.json`. |
| `.ignore` | Makes folder-wide ripgrep/Grep skip generated data, assets and the lockfile (~19,000 files to ~190). Exact-path searches still work. |

## `src/` — the game

| Path | What it is |
|---|---|
| `src/main.ts` | Phaser boot: registers scenes. |
| `src/core/` | **Pure game rules. Never imports Phaser.** Everything deterministic lives here. |
| `src/core/run.ts` | **big** (1430). The run state machine: every player action is a function on run state. |
| `src/core/state.ts` | Types for changing state: Pokémon instances, battles, the run. |
| `src/core/contentSchema.ts` | **big** (1300). Zod shapes of every data file. |
| `src/core/rng.ts` | Seeded RNG and named streams. |
| `src/core/battle/` | `engine.ts` **big** (1930) turn engine; `abilities.ts`; `damage.ts` pure maths; `held.ts` held items; `transform.ts` Mega/Tera/Z/Dynamax; `hyper.ts` Hyper moments (M8.9). |
| `src/core/presentation/` | Presentation-cue layer: `cues.ts` (engine events → animation plan), `moveAnims.ts`, `animFormat.ts`. |
| `src/core/story/` | Story layer (M8.9): `schema`, `record` (domain events), `effects` + `ledger` (never apply twice), `queue`, `hooks` (run → story), `hyper` (Hyper moment eligibility). Guide: `docs/story-foundation.md`. |
| `src/core/raid/` | Raids: `schema` (raids.json shape), `raid.ts` (shields, phases, telegraph, timer, den placement; the engine calls its hooks). |
| `src/core/events.ts` | Map events ("!"/"?" stops): placement, choices, checks, effects, event battles. Data: `src/data/events.json`, built from `tools/events/*.ts` by `npm run data:events`. Screen: `src/scenes/EventScene.ts`. |
| `src/core/*.ts` (rest) | One system each: `archetypes`, `attributes`, `capture`, `catalog` (item effects), `encounters` (difficulty, enemy planning), `evolution`, `friendship`, `items` (bag use), `map` (stage graph), `mapItems` (repels, shop, money), `pokemon` (stats, XP), `profile`, `progress` (permanent), `regions`, `rewards` (five-choice draft), `runPrep`, `themes`. |
| `src/data/` | Game content JSON + `index.ts` (loads and validates it). See the data index below. |
| `src/game/` | `GameSession.ts` connects rules to saving (screens call it); `services.ts` shared objects. |
| `src/save/` | `saveManager.ts` versioned save records and migrations; `storage.ts` where bytes live. |
| `src/scenes/` | Phaser screens: Boot, MainMenu, Hub (**big**, 710), RunPrep, Briefing, TrainerSelect, StarterSelect, Map, Battle (**big**, 940), Reward, Shop, Decision, GameOver; `routing.ts` picks the screen for a run phase. |
| `src/ui/` | Shared UI: `widgets`, `theme`, `input`, `sprites`, `lazyAssets`, `audio`, `battleText`, `partyPanel`, `fieldMenus`, `showcase`, `battleFx/` (animation player). |
| `src/quality/` | `supportStatus.ts` (content statuses), `contentReport.ts`, `balanceSim.ts`, `knownLimits.json`. |
| `src/assets/catalog.ts` | The one place asset file names and folders are defined. |
| `src/debug/debugPanel.ts` | F2 developer panel. |

### Data index (`src/data/`)

Generated files: never hand-edit, never read whole. Rebuild with the npm script.

| File | Size | Source / how to rebuild |
|---|---|---|
| `bossTeams.json` | 3.9 MB | `npm run data:bosses` from `bosses.json` |
| `species.json` | 1.9 MB | `npm run data:species` |
| `learnables.json` | 1.1 MB | `npm run data:movesets` |
| `customSpecies.json`, `customEvolutions.json` | 500 KB | `npm run data:custom` (M8 custom forms) |
| `moves.json` | 290 KB | `npm run data:moves` |
| `moveAnims.json` | 270 KB | `npm run data:anims` |
| `megaStones.json` | 120 KB | `npm run data:megas` |
| `zMoves.json` | 40 KB | `npm run data:zmoves` |

Hand-edited (small): `balance.json` (all balance numbers), `itemCatalog.json` (**big**, 220 KB, item effects), `items.json`, `rewards.json`, `shop.json`, `bosses.json` (boss profiles), `trainers.json`, `archetypes.json`, `regions.json`, `themes.json` (153 type-pair stage themes), `typeChart.json`, `ruleset.json`, `runPrep.json`, `achievements.json`, `story.json`.

To look something up: `grep -n '"id": "pikachu"' src/data/species.json` then read ~40 lines around it, or use `node -e` with `JSON.parse` to print one entry.

## `tests/`

| Path | What it is |
|---|---|
| `tests/unit/` | Vitest. One file per milestone (`milestone8_75.test.ts` …) plus per-system files (`battle`, `damage`, `save`, `story`, `rng` …). `helpers.ts`, `autoplay.ts` shared. |
| `tests/e2e/` | Playwright, one spec per milestone (`milestone8_9.spec.ts` …). |

## `tools/` — Node scripts behind `npm run data:*`, `assets:*`, `report:*`

`import-*` bring in the director's data; `build-*` generate data files; `report-content.ts` / `report-balance.ts` write `docs/quality/`; `content-baseline.json` is the CI gate baseline; `lib/gameModules.ts` lets tools import game code.

## `docs/`

| Path | What it is |
|---|---|
| `docs/plans/INDEX.md` | Line ranges per topic in the two plan docs below. Use it before opening them. |
| `docs/plans/electric-plan.md` | Full director directive "Implementation Plan Electric" (588 lines). |
| `docs/plans/hyper-overdrive-techno.md` | **big** (1370). Story/Hyper/emotions design source. Grep for the system you need. |
| `docs/plans/source-files-plan.md` | What every file in the shared project folder is, and where each fits in the game. Grep by file name. |
| `docs/plans/how-to-execute-guides.md`, `docs/plans/how-to-implement-packs.md` | Step-by-step: how to execute each design guide, and how to use each Essentials pack (code reference + asset import recipe). |
| `docs/story-foundation.md` | How to add story events. |
| `docs/m8-designed-forms.md` | Custom forms list (M8). |
| `docs/quality/` | Generated `CONTENT_REPORT.md`, `BALANCE_REPORT.md`. |
| `docs/archive/` | Finished checklist sections (M0–M6). |

## `public/assets/` — 250 MB, committed

`images/` (194 MB), `audio/`, `battle-anims/`, `fonts/`, `manifest.json` (2.4 MB, generated by `npm run assets:manifest`). Never list or read recursively; look names up in `src/assets/catalog.ts` or grep `manifest.json`.

## Outside the repo

Director's source packs and plan copies are in the project files folder (`/mnt/project-files/`): `images.zip`, `audio.zip`, `bosses/`, `items/`, `data/move-dataset/`, `plan/`. Only open them when importing.
