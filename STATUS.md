# STATUS.md — where the game is now

One-page snapshot. Read this instead of CHECKLIST.md unless you need a milestone's full list or known limits (then grep its heading there). **Update the matching line here in the same PR that finishes a slice.** Last updated 2026-10-30.

## Saves
Current versions (`src/save/saveManager.ts` `CURRENT_VERSIONS`): profile 7, run 13, settings 4, meta 1. Next free run version: 14 (check `origin/main` first; another thread may have taken it).

## Done
- M0–M6: vertical slice, full battles, stages, regions + dev campaign, hub progression, Run-Prep, full species data (archive: `docs/archive/checklist-m0-m6.md`).
- M7 attributes and luck; M8 custom forms (255 Delta, Z-Forms, Spooky); M8.6 audit + content/balance reports + `report:check` gate.
- M8.5 Mega, Primal, Tera, Z-Moves, Dynamax/G-Max (PokeRogue-style limits).
- M8.75 parts: "everything left" PR (about 270 more moves, 30 more abilities, Light Clay/Red Card/Eject Button/Mental Herb, smart boss trainers: potion + deliberate switching), friendship (B), move tiers C1–C2, about 230 abilities (C3, C3b-1, C3b-2, form-change and primal-weather batch), items slices 1–3b-3a (404 of 574 items work), Oak/N sprites, Peace/Charisma pass.
- M8.9-0 story foundation (domain events, effect ledger, cues, histories, Story Log).
- M8.9 Hyper Phase 1 slices 1, 2, 3, 4, 6. Hyper evolutions (Overdrive §4): Mega Overdrive, All of Its Heart (Z), A Giant Resolve (Dynamax), Its True Colors (Tera, 7 emotion lines), Determination Evolution memory. Signature Move Awakening (Overdrive §4 + "Mastered the Power Within"): a damaging move used 8 times in trainer fights awakens for the run (+20% damage, 2 per Pokémon). §3 moments (`core/story/moments.ts`): 9 survival, 4 bond, 6 enemy Overdrives. Still open: rivalry/grudge events, Understand Each Other etc., §5/§6/§7.
- Balancing phases 1+3 (start): audit in `docs/quality/encounter-audit.md`; `availability.json` (1025 species, "suggested", unused yet). +100/region deferred to part G.
- Untitled doc Phase A: drafts offer ≤1 attribute item; base-stat sanity test (tier weights, Mega Stone gating already existed).
- Untitled doc Phase B (part): catch screen shows all six stats, base stats + BST, ability, evolution, comparison with lead (`core/catchSummary.ts`). Not yet: settings toggles, trainer bands, new NPC classes.
- Untitled doc Phase B (settings): battle speed (normal/fast/quick) in settings v3. Reduced motion already existed (battleAnimations). Still open: trainer bands, new NPC classes.
- Untitled doc Phase B (trainer bands): `trainerTeam.earlyCaps` = stage 1 has 1 Pokémon, stages 2–6 cap 2–4. NPC classes audit: 17 classes use existing sprites; no new classes yet.
- Battle Drama Engine slice 1: trainers speak in battle (`core/drama`, `data/drama.json`): opening, commands, declarations, reactions, switches, endings, rival callbacks; budgets by trainer class; settings v4 "Trainer talk". Tracker: `docs/plans/coverage-tracker.md`.
- M9 battle animations + settings; boss teams (229 bosses).
- Starter Sets slice 1 (plan `/mnt/project-files/plans/starter-sets-quests-mastery-plan.md`): Starter Laboratory has 70 sets in 10 categories (all regions, 18 types, roles, player trainers, 10 villainous teams, 9 Leagues, 7 spin-off games). Pools can list evolved species, bosses or a type/region filter (`core/runPrep.ts eligibleSpecies`).
- Trainer identity (plan Part 2a): signature types/species/set on `archetypes.json`; a signature Pokémon may take the last starter slot (50%, own seed, never forced); Cynthia (sees gym teams), Oak (+50% Research Points, sees wild Pokémon, −15% money) and N (+50% friendship) are playable.
- M10 visual slice 1 (Aero battle): glass message bar, databoxes and command window (`src/ui/aero.ts`), glossy type-tinted buttons (opt-in `glass` on `Menu`), Essentials type/category/status art, arena ambience from EBDX scenery (`battleFx/ambience.ts`), bouncy send-out + idle breathing. Respects battleAnimations (reduced = still, off = none). Provenance: `docs/quality/asset-provenance.md`. Hub/TrainerSelect untouched.
- M10 visual slice 2: EBDX intro wipe (wild) and VS screens (trainer/rival/boss), skippable; ambience preset for all 18 types (+ second-type accents); DBK burst reveal for transformations, evolution and catches (replaces full-screen flashes); low-HP glow; victory hop. Tracker: `docs/plans/visual-coverage.md`.

- Blueprint slice 1 Raids: dens on stage maps (45% per stage), 8 raids tier 1–6 (`raids.json`, `core/raid/`), shield, phases, charged attack, bonus attacks, timer, rewards, losing never ends the run. Next: Totems, Expeditions, Minigames (tracker: `docs/plans/coverage-tracker.md`).

## In progress / next
- Starter sets / quests / mastery / events plan (signed off 2026-10-30): next "?" event stops + event items (slice 4b), trainer quests, species mastery, trainer evolutions, weekly then holiday events.
- M8.9 slice 5: A Past Pokémon Wants to Join Your Party (archive across runs).
- M8.75: items 3b-3b, 3c, 4; C2b terrain + rare moves; C3b remaining abilities and smarter enemy trainers; D Bank tiers/licenses/challenges; E Pokédex/mastery; F trainer passives + more trainers; G party-strength difficulty, levels to 500, custom regions; H later hub systems; A event system (design with director first).
- M8.5: regional forms as a mechanic (if still wanted).
- M9: Grand Region, final boss, ending, deploy.
- M10 visuals (guide 9, Visual Bible V1–V5): next slices = EBUI move flag icons + info panel + effectiveness hint, boss/rival spectacle, effect families, then map/reward/shop/decision/run-end screens.

## Biggest known gaps
- 87 move rows are unsupported on purpose: Z-Moves, Max Moves and G-Max Moves are only used through the Z/Dynamax systems, never picked directly. All other moves work (Mimic, Transform, Sky Drop, Beat Up, weight moves included). Known limits: Beat Up uses the user's Attack, Hidden Power's type is a fixed roll per Pokémon (no IVs), Sky Drop only stops a slower target. 6 abilities pending: Illusion, Delta Stream, Multitype, Shields Down, Aura Guard, Teraform Zero. 98 items pending: story/key items and gadgets need the event system (design with the director first), plus mulch/berry-pot/apricorn items.
- Rival relations (`rivals/relations.ts`): training exchange, enemy Pokémon sparring, rivalry triangle, tired-ace substitute, close-battle memory (5 more mechanics "limited"); reputation, signature and conflicting rumours add 3 more (5 mechanics left).
- Rival bonds (run save v12): each rival Pokémon has 8 bond dimensions, a trait and habits; one of 39 off-screen events runs per rival each stage (`rivalBonds.json`, `rivals/bonds.ts`, built by `tools/build-rival-bonds.mjs`); bonds change the return level and show up as a pre-battle line and on the Story screen. Hyper/Overdrive and the 9 bond arcs wait.
- Rival arcs: 27 of 46 run (`rivalArcs.json`, `rivals/arcs.ts`); bond and Overdrive arcs wait for those systems.
- Rival paths: 13 of 30 run as rival origins (`rivalPaths.json`); the rest need sponsors, mentors, factions, debts, family or disasters.
- Rivals slice 5: up to 3 rivals; off-screen world sim each stage (`rivals/world.ts`): wins/defeats/private goals/cooldowns, rival graph, rumours; 11 catalog mechanics now "limited".
- Rivals slice 4: ladder (recognized→contender), outcomes (grew/shaken/ally/retired), Ultimate Rival score evaluated at rival fights and boss wins (`rivals/outcome.ts`, `ultimate.ts`; flag `ultimateRival`).
- Rival Examples doc: all lists stored in `rivalCatalog.json`; 40 personalities + 32 styles now run (`rivalProfiles.json`, status "limited"); paths, events, arcs, mechanics still "planned". Progress: `docs/plans/coverage-tracker.md`.
- Rivals slice 1 built (`src/core/rivals`, `src/data/rivals.json`): a flawless or close win over an ordinary trainer makes ONE rival (archetype, traits, memory of that battle; run save v11). Slice 2: the rival returns once per region in place of the first ordinary trainer, with its old team stronger and ONE telegraphed counter-pick (resists your most-used attack type; shown before the battle). Slice 3: rivals are listed at the top of the Story screen (`rivals/chronicle.ts`). Next: slice 4 promotion/setback and Ultimate Rival, Battle Drama. Relationships/nemesis records are still only created by rivalries and returning trainers.
- Event types `traded`, `trainerEscaped`, `transformed`, `eventChoice` are defined but never emitted.
- CI workflow exists but has never run on GitHub.
