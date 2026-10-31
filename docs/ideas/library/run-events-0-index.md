# Run Events Library: Index (initiative 2)

Design only, nothing built. Brainstormed 2026-10-31 for Kice's "Massive Game Expansion" initiative 2 (500+ run events).
Checked against: 642 events already in `src/data/events.json`, 560 earlier idea lines in `ideas/run-events.md`, and the events-and-map-stops plan. These are new premises, with the emphasis the earlier lists lacked: party feelings, the run's own choices, previous runs, transformations, mythic rarities, run-defining spectacles.

| File | Theme | Events |
|---|---|---|
| run-events-1 | Party bonds, personality, disagreements (RE-A) | 70 |
| run-events-2 | Echoes of your own choices (RE-B) | 66 |
| run-events-3 | Previous runs and Legacy (RE-C) | 60 |
| run-events-4 | Evolutions and transformations (RE-D) | 70 |
| run-events-5 | Legendary, mythic, rarest (RE-E) | 66 |
| run-events-6 | Spectacles and run-defining (RE-F) | 60 |
| run-events-7 | People, rivals, trainers (RE-G) | 62 |
| run-events-8 | World, weather, economy, oddities (RE-H) | 62 |
| **Total** | | **516** |

## Entry format
Rarity C/U/R/VR/M (M = once in hundreds of hours), Size S/M/L/XL, Trigger, Scene, Outcomes, Reward/Cost, Variations. Run-defining entries add a Run Mutation.

## Build notes for whoever implements
- Most events are data in `events.json` form with a `requires` clause on a run flag, Bond, Memory, nemesis, rival or legacy record.
- Choice-log events (file 2) need a small `choiceLog` of flags in the run record (save bump).
- Previous-run events (file 3) read `profile.legacyRuns` only; skipped on a first run; never edit history.
- Mythic events (file 5) use a profile pity counter, never run RNG; always skippable.
- Entries are first-pass concepts: many "Variations" lines are seeds, to be expanded when an event is picked for a slice. Rewards and numbers need balance passes.
