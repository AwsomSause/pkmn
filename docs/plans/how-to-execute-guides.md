# How to execute every text guide

Written 2026-10-30 after reading each guide's directive sections (the "(text)" copies for the image-heavy ones). Companion to [source-files-plan.md](source-files-plan.md) (what each file is) and [how-to-implement-packs.md](how-to-implement-packs.md) (the .zip/.rar packs).

**Rules for every guide** (from CLAUDE.md / electric-plan): audit first, one vertical slice per PR, `src/core` never imports Phaser, named seeded RNG streams, data in validated JSON, a save migration + test for every new saved field, nothing marked "supported" unless it works in a real battle, report what ran. Start each slice from fresh `origin/main`; save versions are shared, take the next free one.

**Priority note.** Kice's decision stands: the Untitled document is top priority for this plan and wins clashes. Their later "exclude it" only removed it from the separate roadmap thread's to-do list.

Status key: BUILT = already in the repo, PART = some slices done, TODO = nothing built.

---

## 1. Untitled document.md — progression, economy, modes (TODO, 25 sections)
Its own roadmap (§23) is the execution order. One phase = several PRs.
- **A. Foundations.** Audit vs GAME_DESIGN/CHECKLIST. Item eligibility predicate (one pure function; Mega Stone needs Mega Ring + compatible party member + not owned). Reward tier weights in `balance.json` (55–65 / 22–30 / 7–12 / 1.5–4 / <1 %). Fixed base stats: add a content-gate check that BST = sum of six stats. Cut attribute items to ≤1 per draft. *Exit:* generated-draft tests (thousands of seeds), no unusable options.
- **B. Catch clarity + trainers.** "Pokémon Acquired" panel (stats, base stats, BST, abilities, moves, evolution, comparison with party member); persist the catch *before* the animation. Settings: always-show-details, animation speed, reduced motion. Common-NPC classes from sprites that exist (audit `public/assets/images` first). Early-game bands: 1 Pokémon first, 2–4 mid. *Exit:* reload-safe catch, no early wipe on test seeds.
- **C. Attributes + prep.** One `effectiveAttribute()` core function; run modifiers persist through the run and never leak. Trainer identity fields on `archetypes.json` (signature type/species, passive, tradeoff). Starter Pool vs Starter Set. Run Build Summary screen.
- **D. Special forms + services.** Tag form families, remove from wild/start pools, add event/trade/egg routes + duplicate compensation. Service nodes: Research Lab, Move Tutor, Trade Post first.
- **E. Difficulty + modes.** `difficultyPresets.json`, `gameModes.json`; Death-Block; Adventure mode (checkpoint on wipe, no account rewards); Daily (stable seed, one-time claim); Endless.
- **F. Events.** Event registry with stable claim keys (idempotent); Spooky as first themed event; species mastery slice.
- **G. Balance + polish.** Deterministic sims, viewport checks, reports.
- **Where it can clash with built work:** attributes (M7), Friendship, Run-Prep, shop. For each clash write the override into GAME_DESIGN §12 before coding.
- **Files to touch first:** `src/data/balance.json`, `src/data/rewards.json`, `src/core` reward draft code, `tools/report-content.ts`.

## 2. PROGRESSION & ENCOUNTER BALANCING OVERHAUL.md (TODO, 11 phases)
1. Audit and write the report (where levels, caps, encounters are computed). 2. One progression config (the doc says +100 levels per region; the repo may use +50: decide from the audit, record in GAME_DESIGN). 3. Availability metadata per species/form: import `Pokemon_Spreadsheet.xlsx` (rarity, min/max level, difficulty, capture rate) via a new `tools/import-availability.ts` into `src/data/availability.json`, flag as "suggested". 4. Encounter Director: one service for wild, trainers, bosses, events; bounded retries, validated fallback, logged rejections. 5. Level policy per category (easy −2…−1, standard ±1, trainers 0…+1, gym 0…+2). 6. Combat Threat Rating (config-driven). 7. Route events through the Director. 8. Authored boss teams. 9. Tests: 10,000 samples per early stage, real battle simulations. 10. Machine-readable per-stage report → `docs/quality/`. 11. Acceptance list.
*Start with:* phases 1–3 in one PR (audit + config + availability data). Don't claim balance from species tests alone; run the battle simulator.

## 3. A Living Rivalry Engine.md + Examples, Possibilities, and Guidence.md (PART: relationships/Heated Rivalry/returning trainer exist)
Main doc = the design; Examples doc = a menu of content (30 rival paths, 40 personalities, 32 battle styles, 40 offscreen events, 36 arcs, 24 advanced mechanics).
Modules to add under `src/core/rivals/` (names from §12 of the doc, adapt to repo): `RivalManager`, `RivalryEngine` (Rival Potential score), `RivalMemory`, `NemesisEngine`, `RivalBattleDirector`, `RivalChronicle`, `RivalPersistence`. Later: `RivalWorldSimulator`, `RivalStoryEngine`, `RivalScheduler`.
Slices: (1) one rival born by "Spark" with traits + a memory of the last battle, saved per run. (2) Fair counter-adaptation: one telegraphed change after a loss. (3) Rival Chronicle screen on the existing Story screen. (4) Promotion/setback + Ultimate Rival score. (5) Rival-to-rival graph and offscreen events. (6) Legacy layer (optional).
Data: `src/data/rivals.json` (personalities, battle styles, paths) picked from the Examples doc; Zod-validated. **Keep run state and account state in separate layers** (doc §11): a major source of save bugs.

## 4. The Battle Drama Engine.md (TODO, 9 phases)
1 audit turn lifecycle. 2 battle event bus (stable ids, no double processing on re-render/save-load). 3 contextual trainer dialogue (personality + state + history; no repeats; skippable; deterministic). 4 signature-attack presentation (metadata only; never change damage/priority). 5 mid-battle evolution (valid evolutions only, safe turn boundary, no double trigger). 6 dramatic event library (each with conditions, cooldown, severity, outcome record). 7 relationship/rival integration. 8 pacing director. 9 tests.
*Slice order:* event bus + 10 lines of dialogue for one trainer class → signature move cue for bosses → mid-battle evolution as a Hyper moment. Presentation goes through the existing presentation-cue layer.

## 5. Overdrive Hyper Techno Supreme Z (text).md (PART: M8.9 Phase 1 slices 1–4, 6 built)
Already in repo as `docs/plans/hyper-overdrive-techno.md`. Remaining, in order: slice 5 (A Past Pokémon Wants to Join; screenshot item 1e), then doc §3 more Hyper events (survival, bond, rivalry, enemy Overdrive), the Seven Emotions' Overdrives (battle effects, clash, dual emotion), §4 hyper evolutions (Determination Evolution, Mega Overdrive, Z "All of Its Heart", Dynamax "A Giant Resolve", Tera, Signature Move Awakening), §6 chains. The "Techno Systems" half (Rivalry, Nemesis, Raids, Protégé, Grand-Enemy, Legacy) feeds guides 3 and 6.

## 6. Blueprint_ Raids, Mega-Expeditions, Totem Pokémon & Minigames (text).md (TODO, M1–M8)
Order the doc recommends: Raids → Totems → Mega-Expeditions → Minigames. M1 audit; M2 shared infrastructure (progression/encounter/reward/save hooks); M3 one complete raid (shield, phase change, rewards, tests); M4 one Totem (aura + optional ally call); M5 one expedition (branching route, resource persistence, finale, extraction); M6 one minigame + scoring/reward interface; M7 content; M8 balance/regression. Raid shields, multiple boss actions and Totem allies are *battle-engine capabilities*, not separate engines. Reference code for each: see packs guide (Raid Battles, SOS Battles).

## 7. Implementation Plan Electric (text).md (BUILT as the directive; roadmap in progress)
CLAUDE.md already carries its operating rules. Roadmap left: M8.5 transformations (screenshot item 4: bosses using Z/Dynamax, Max Move terrain, G-Max side effects, signature Z-Moves), M8.75 engine completion (items, ~107 abilities, smarter trainers), M8.9 narrative systems, M9 Grand Region, M9.5 spectacle, M10 polish.

## 8. POKEMON_ROGUELIKE_MASTER_EXPANSION_CATALOG.md + START_HERE.md (backlog)
Not a spec. Use its gates as the quality bar: Gate 0 baseline + asset provenance registry, Gate 1 truthful combat, Gate 2 one exemplary battle slice, Gate 3 rival slice (3 triggers, one breakthrough, replay tests), Gate 4 events (5–10 events, one branching chain), Gate 5 boss/raid (telegraph, scout option, two arena states), Gate 6 expansion. Pull ideas from sections A–O when a slice needs content. START_HERE: repo must stay private (D4); don't copy moodboard images.

## 9. Visual pack: VISUAL_BIBLE.md, COMPLETE VISUAL REMASTER.md, CLAUDE_VISUAL_REVAMP_BRIEF.md, VISUAL_REFERENCE_BOARD.html (TODO; M10)
The Brief is the executable prompt. Phases: 0 baseline (screenshots of Battle, move picker, Map, Reward, Shop, Event, League, Run End at fixed seeds; checks; provenance manifest) → 1 visual system (960×540 space, 320×180 pixel baseline, panel roles, tokens) → 2 **one** exemplary battle (arena layers, status panels, one contact/projectile/status/heavy move, trainer reaction from real events, reduced-motion/fast/skip) → 3 effect pipeline (data-driven animation families + coverage report) → 4 boss/rival spectacle → 5 propagate to other screens. Visual Bible gates V0–V5 are the same list. **Never restyle `HubScene` or `TrainerSelectScene`.** Presentation never decides outcomes.

## 10. Trainers.md (TODO, 220 trainer perks)
Write `tools/import-trainer-perks.ts` that parses each "Name — Pros: … Cons: …" line into modifier entries for `archetypes.json`. Existing modifier kinds: xpMultiplier, enemyLevelOffset, moneyMultiplier, captureMultiplier, healingMultiplier, priceMultiplier, typeDamageMultiplier, weaknessDamageTakenMultiplier, shopUnlockOffset. Perks that need other kinds (survive-KO chance, move-category damage, speed-based XP…) are imported with status "disabled pending implementation", not approximated. Unlock via achievements/mastery. Balance with the simulator from guide 2. Do it in batches of ~20 trainers.

## 11. Pokemon_Spreadsheet.xlsx and pokemon_master_reference_expanded_2026-10-29.xlsx
First: input to guide 2 phase 3 (import to `availability.json`). Second: output from our own data; use its "Data Coverage & Next Steps" sheet as the to-do for TM/TR compatibility and move rows in the content report.

## 12. Screenshot to-do list (Kice's current work)
Slices 5–6 and item slices are being built in other threads (see CHECKLIST). Don't duplicate; check `git log origin/main` first.
