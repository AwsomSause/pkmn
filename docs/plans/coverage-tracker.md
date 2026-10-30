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
| Off-screen events (§6; the doc says 40 but skips #19) | 39 | DATA |
| Character arcs (§7: 36 long-form + 10 Overdrive) | 46 | PART: 27 run (growth, conflict and social arcs: start, turn, good/bad ending that nudges the rival's traits); the 9 Pokémon-bond arcs and 10 Overdrive arcs wait for the bond/Overdrive systems |
| Advanced mechanics (§8) | 24 | PART: 11 limited (independent rivalry, unseen win/defeat, cooldown, private goal, challenge refusal, missed encounter, return encounter, rumour mill, handoff, shared rival); 13 planned |
| Main doc slice 4: ladder, ally/retire/shaken outcomes, Ultimate Rival score + milestone evaluation | DONE (rival promotions at gyms/tournaments wait for the world sim) |
| Main doc slice 5: multiple rivals (3), rival graph, off-screen world sim, rumours | DONE (limited) |
| Main doc slice 6: scheduler, legacy layer, account-level rival state | TODO |
| Bond Engine (Examples §4, §9: Trainer–Pokémon bond dimensions, habits) | — | TODO |

## Other guides (see how-to-execute-guides.md for the order)
| Guide | Status |
|---|---|
| Untitled document phases A, B | DONE (except new NPC classes); C–G TODO (C overlaps the planning thread) |
| Progression and Encounter Balancing, phases 1 and 3 | DONE; 2, 4–11 TODO |
| The Battle Drama Engine (9 phases) | TODO |
| Overdrive Hyper Techno Supreme Z | PART: §1 Phase 1 events + §2 emotions tags + §4 Hyper evolutions (4 transform moments + Determination Evolution memory) DONE; §4 Signature Move Awakening DONE (also §3 "It Mastered the Power Within"); §3 other 29 events, §5 (6 unusual events), §6 chains, §7 generator TODO |
| Blueprint: Raids, Totems, Expeditions, Minigames | TODO |
| Trainers.md perks | TODO |
| Visual guides (VISUAL_BIBLE, COMPLETE VISUAL REMASTER, brief) | TODO |
| POKEMON_ROGUELIKE_MASTER_EXPANSION_CATALOG (reference) | reference |
