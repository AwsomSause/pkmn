# False Protagonist: timeline replays (M13)

Kice's spec §4 (Revisit This Timeline, rivals ahead, The False Protagonist, 5 outcomes, timeline integrity). Short design note.

## Audit: how a run is made today
- `createRun` (`src/core/run.ts`) is pure: a seed gives the RNG streams, starters, region order and every later roll. `src/core` uses no clock or `Math.random`.
- But a run also reads the **profile at its start**: attributes, mastery, licenses, Candy perks, owned trainers, raid tier, today's game events, and three archive picks (legacy rival, reunion, champion team). `GameSession.newRun` then adds the Trainer Network parcel. All of these change between runs, so the seed alone cannot rebuild a lost run. That was the missing piece.
- Only one run save slot existed (`pkr.run`), and ending a run always writes the profile.

## What was built
- **Genesis** (`src/core/timeline/genesis.ts`): at `newRun` every start input is saved, plus the *results* of the archive picks and the parcel (not whole archives, to keep saves small). `reconstructRun` rebuilds the run field for field; a unit test plays 120 steps on both and compares fingerprints.
- **Timeline store** (`pkr.timeline`, new record, v1): genesis of up to 20 lost runs and every replay's record. Kept apart from the profile, so the original `runHistory` entry is never edited. A won run drops its genesis; a lost run gets an **origin** (badges, regions, encounters, and the rival that mattered most).
- **Replay slot** (`pkr.replay`): a run record (same versions and migrations as `pkr.run`) under its own key, so a normal run and a replay can both be saved. Replay ids are `<runId>~tl<attempt>`.
- **Profile isolation**: a replay never awards live achievements and never runs `finalizeRun`; its end only writes the timeline store. Abandon marks the record `abandoned` and clears the slot; a damaged replay save can still be abandoned.
- **The world has moved on** (`src/core/timeline/frontRunner.ts`): the origin rival joins the replay as a contender ranked Gym Leader, so it stands in for the first Gym you reach (existing takeover in `core/rivals/promotion.ts`). Each time you beat it, it climbs: regional finals, then Champion. Without an origin it is the seed's first rival.
- **Presentation**: "THE FALSE PROTAGONIST" tag on the map with who is ahead, a start line, seeded stranger lines each stage, rival intros per rank, after-win lines (all in `src/data/timeline.json`). Hall of Fame lists lost runs with "Revisit This Timeline", and Continue / Abandon for the active one.
- **Five outcomes** (end screen, saved on the replay record): Impossible Victory (beat it as Champion with ≤1 Pokémon standing or 5+ levels down), Usurper (beat it as Champion), Catch-Up (beat it earlier), Second Place (won the run without beating it), Forgotten (lost again).

## Limits
- A content or rule change after a run began can make its replay differ (the Hall of Fame row says so when the rule version changed).
- Replays give no account rewards yet (by design for now; a later slice can pay a small, separate reward).
- When the Legacy thread's frozen run record (`profile.legacyRuns`, `legacyRunStart`) lands, the genesis store should read from it instead of keeping its own copy, and the Legacy Gallery should host the Revisit button.
