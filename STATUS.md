# STATUS.md — where the game is now

One-page snapshot. Read this instead of CHECKLIST.md unless you need a milestone's full list or known limits (then grep its heading there). **Update the matching line here in the same PR that finishes a slice.** Last updated 2026-10-30.

## Saves
Current versions (`src/save/saveManager.ts` `CURRENT_VERSIONS`): profile 6, run 11, settings 3, meta 1. Next free run version: 12 (check `origin/main` first; another thread may have taken it).

## Done
- M0–M6: vertical slice, full battles, stages, regions + dev campaign, hub progression, Run-Prep, full species data (archive: `docs/archive/checklist-m0-m6.md`).
- M7 attributes and luck; M8 custom forms (255 Delta, Z-Forms, Spooky); M8.6 audit + content/balance reports + `report:check` gate.
- M8.5 Mega, Primal, Tera, Z-Moves, Dynamax/G-Max (PokeRogue-style limits).
- M8.75 parts: friendship (B), move tiers C1–C2, 188 abilities (C3, C3b-1), items slices 1–3b-3a (404 of 574 items work), Oak/N sprites, Peace/Charisma pass.
- M8.9-0 story foundation (domain events, effect ledger, cues, histories, Story Log).
- M8.9 Hyper Phase 1 slices 1, 2, 3, 4, 6.
- Balancing phases 1+3 (start): audit in `docs/quality/encounter-audit.md`; `availability.json` (1025 species, "suggested", unused yet). +100/region deferred to part G.
- Untitled doc Phase A: drafts offer ≤1 attribute item; base-stat sanity test (tier weights, Mega Stone gating already existed).
- Untitled doc Phase B (part): catch screen shows all six stats, base stats + BST, ability, evolution, comparison with lead (`core/catchSummary.ts`). Not yet: settings toggles, trainer bands, new NPC classes.
- Untitled doc Phase B (settings): battle speed (normal/fast/quick) in settings v3. Reduced motion already existed (battleAnimations). Still open: trainer bands, new NPC classes.
- Untitled doc Phase B (trainer bands): `trainerTeam.earlyCaps` = stage 1 has 1 Pokémon, stages 2–6 cap 2–4. NPC classes audit: 17 classes use existing sprites; no new classes yet.
- M9 battle animations + settings; boss teams (229 bosses).

## In progress / next
- M8.9 slice 5: A Past Pokémon Wants to Join Your Party (archive across runs).
- M8.75: items 3b-3b, 3c, 4; C2b terrain + rare moves; C3b remaining abilities and smarter enemy trainers; D Bank tiers/licenses/challenges; E Pokédex/mastery; F trainer passives + more trainers; G party-strength difficulty, levels to 500, custom regions; H later hub systems; A event system (design with director first).
- M8.5: regional forms as a mechanic (if still wanted).
- M9: Grand Region, final boss, ending, deploy. M10: visuals only.

## Biggest known gaps
- 498 moves unsupported (terrain, rare moves); 170 items without effects.
- Rivals slice 1 built (`src/core/rivals`, `src/data/rivals.json`): a flawless or close win over an ordinary trainer makes ONE rival (archetype, traits, memory of that battle; run save v11). Slice 2: the rival returns once per region in place of the first ordinary trainer, with its old team stronger and ONE telegraphed counter-pick (resists your most-used attack type; shown before the battle). Next: slice 3 Chronicle screen. Relationships/nemesis records are still only created by rivalries and returning trainers.
- Event types `traded`, `trainerEscaped`, `transformed`, `eventChoice` are defined but never emitted.
- CI workflow exists but has never run on GitHub.
