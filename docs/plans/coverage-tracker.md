# Coverage tracker: every list in every guide

Kice (2026-10-30): add EVERYTHING listed in EVERY md file. This file is the checklist. A line is only ticked when the thing works in the game (status "supported" or documented "limited"), not when it is merely stored as data. Update it in every PR that moves a line.

Status key: DATA = stored in validated JSON but the engine does not use it yet; PART = some of it works; DONE = works and tested; TODO = nothing yet.

## A Living Rivalry Engine (design doc) and its Examples doc
Data: `src/data/rivalCatalog.json` (built by `npm run data:rival-catalog` from `tools/sources/rivalry-examples.md`; every entry has a status, starting at "planned").

| Item | Count | Status |
|---|---|---|
| Rival slice 1 Spark, slice 2 return + adaptation, slice 3 Story screen | 3 slices | DONE |
| Rival paths (Examples §1) | 30 | DATA (Spark path only runs) |
| Personalities (§2) | 40 | PART: all 40 run as profiles (6 traits; vindictiveness changes the return level, low adaptability never adapts). Their special story behaviours wait for arcs/events |
| Battle styles (§3) | 32 | PART: all 32 run as AI sharpness + stat bias + adaptation cap. Style tricks (berserker rage, trapping, copying) wait for battle hooks |
| Off-screen events (§6; the doc says 40 but skips #19) | 39 | DATA |
| Character arcs (§7: 36 long-form + 10 Overdrive) | 46 | DATA |
| Advanced mechanics (§8) | 24 | DATA |
| Main doc: promotion/setback, Ultimate Rival, rival graph, offscreen sim, scheduler, legacy layer, Chronicle | slices 4–6 | TODO |
| Bond Engine (Examples §4, §9: Trainer–Pokémon bond dimensions, habits) | — | TODO |

## Other guides (see how-to-execute-guides.md for the order)
| Guide | Status |
|---|---|
| Untitled document phases A, B | DONE (except new NPC classes); C–G TODO (C overlaps the planning thread) |
| Progression and Encounter Balancing, phases 1 and 3 | DONE; 2, 4–11 TODO |
| The Battle Drama Engine (9 phases) | TODO |
| Overdrive Hyper Techno Supreme Z | PART (see M8.9) |
| Blueprint: Raids, Totems, Expeditions, Minigames | TODO |
| Trainers.md perks | TODO |
| Visual guides (VISUAL_BIBLE, COMPLETE VISUAL REMASTER, brief) | TODO |
| POKEMON_ROGUELIKE_MASTER_EXPANSION_CATALOG (reference) | reference |
