# Whole-Game Events Library: Index and Prioritization (216 ideas)

Files: A permanent world (36), B storylines (36), C history-driven (36), D migrations/legends/phenomena (36), E factions/tournaments/economy (36), F secrets/rare/meta (36). IDs `GWE-<letter><nn>`. Companion to `ideas/game-events.md` (234 short weekly/seasonal lines; not repeated here). Nothing is approved or implemented.

## Shared building blocks (build once, unlock many)
1. **World record** (`profile.world`, versioned, Zod): permanent flags, chain stages, faction standing, tallies. Needed by almost everything in A, B, E.
2. **Chain engine**: stages advance per finished run, with letters and optional stops. Powers all of B and parts of E/F.
3. **History readers**: pure functions over `legacyRuns`, Hall of Fame, nemeses, memories (C-series). Cheap, no new RNG.
4. **Calendar seed cache**: read the real date once into a seed field so tests stay deterministic (D, F).
5. **Hub dressing slots**: statues, walls, gardens, loft (A11, A15, A29, A36, C01, C11).
6. **Map-stop type registry**: new stop kinds from A (bridge, ferry, observatory, orchard, sinkhole city).

## Priorities
**Essential:** C01 Statue, C11 Graveyard Garden, C19 Ghost of a Past Team, C21 Descendants, A15 Wall of Names, A36 Garden of Remembered Pokémon, B01 Lost Researcher, B28 Tower of Names, D11 Roaming Legend Calendar, E17 Gauntlet of Retired Champions, F36 The World Without You.
**High:** A01, A10, A21, A27, B11, B13, B18, B32, C04, C13, C22, C23, C26, C33, D01, D17, E01, E02, E06, E16, F16, F18.
**Medium:** A02-A09, A12-A14, A16-A25, B02-B10, B14-B17, C05-C10, C12, C14-C18, C24-C25, C27-C32, C34, D02-D10, D12-D16, D21-D27, E04, E07-E15, E18-E29, E31-E36.
**Low:** A26, A28, A31, A33, B33, D35, D36, E09, E14, F10, F14, F27, F29.
**Experimental:** A10 (new region), B25 Divided Legend, C28 What If? Parade, C35 Generational Handover, E03 Occupation, E05 Hub attack, F03, F13, F23.
**Extremely Rare (keep rare on purpose):** A09, A33, B04, B09, B29, B30, D16, D19, D22, D28, D29, F01-F09, F11, F12, F15, F17, F19-F23, F25, F26, F30, F31, F34-F36.

## Fit with the existing game
- Extends: Legacy runs/gallery (C), Living Rival and rival world factions/sponsors/debts (B, E), Nemesis (A27, A29, B18, C26), Daily Run (C32), Hall of Fame (A15, A36, B13), Moment codex and memories (B09, C27), False Protagonist (B06, C19).
- Needs care: save versions (check `origin/main` for next free profile version), no gameplay RNG in previews, never block progress behind a chain, offline-first (no real multiplayer; "community" tallies come from the player's own history).
