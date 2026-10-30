# Quality gates (M8.6)

What has to pass before a slice of work counts as done, which checks run by themselves, and how the content gate works. The rules come from CLAUDE.md §7; this page says how each one is checked.

## The gates

| # | Gate | How it is checked | Automatic? |
|---|---|---|---|
| 1 | Type check | `npm run typecheck` | Yes: `npm run check` and CI |
| 2 | Unit and integration tests | `npm test` (Vitest, `tests/unit/`) | Yes: `npm run check` and CI |
| 3 | Production build | `npm run build` | Yes: `npm run check` and CI |
| 4 | Content gate: no content number worse than before | `npm run report:check` (below) | Yes: `npm run check` and CI |
| 5 | Browser tests for what the player does | `npm run test:e2e` (Playwright) | Yes: CI only (they take about 3 minutes) |
| 6 | No console errors or failed requests | The Playwright tests fail on page errors; check the console by hand for new screens | Partly |
| 7 | Screens checked at several sizes | By hand, with screenshots in the pull request | No |
| 8 | Asset loading, missing files, memory, performance | The content report finds missing files; `milestone6.spec.ts` checks lazy loading; memory and frame rate by hand | Partly |
| 9 | Diff reviewed for unrelated changes | By the session, in five passes: gameplay edge cases, architecture, screen quality, determinism and save safety, performance | No |
| 10 | Docs and known limits updated | STATUS.md, CHECKLIST.md, SYSTEMS_AUDIT.md, this page | No |
| 11 | Balance looked at when numbers change | `npm run report:balance -- --write`, then compare `docs/quality/BALANCE_REPORT.md` in the diff | No (it reports, it doesn't fail) |

**CI is not running yet.** `.github/workflows/ci.yml` runs gates 1 to 5 on every pull request and every push to `main`, but GitHub has recorded no workflow run on this repository, ever. Until GitHub Actions is switched on (repository Settings → Actions → General → "Allow all actions and reusable workflows"), the gates only run when someone runs `npm run check` and `npm run test:e2e`.

Never claim a gate passed unless it ran and you read the result.

## The content report

```
npm run report:content                     counts, with the first offending ids of each check
npm run report:content -- --only <check>   one check, every offending id
npm run report:content -- --all            every offending id of every check
npm run report:content -- --status         every entry that isn't fully supported, and why
npm run report:content -- --json <file>    everything as JSON
npm run report:content -- --write          also write docs/quality/CONTENT_REPORT.md
npm run report:check                       the CI gate (same as --check)
npm run report:content -- --update-baseline   accept today's numbers as the new baseline
```

It reads the game data, the asset files on disk and the test sources. It never changes anything. The code is in `src/quality/` (no Phaser, like `src/core`); `tools/report-content.ts` runs it.

### Checks

| Check | Counts | Today |
|---|---|---|
| `unsupported-moves` | Moves the battle engine can't run (`supported: false`) | 611 |
| `unsupported-learnset-entries` | Level-up entries skipped because the move is unsupported | 12,549 |
| `species-no-usable-moves` | Species and forms with no supported level-up move | 5 |
| `meetable-species-no-usable-moves` | Of those, ones a player can own (wild, starter, by evolving) | 0 |
| `missing-sprites` | Front, back, shiny, shiny back or icon files missing | 0 |
| `missing-cries` | Cry files missing | 0 |
| `missing-other-assets` | Trainer, item, arena, music, sound or font files missing | 0 |
| `unreachable-map-nodes` | Unreachable nodes, dead ends or rule breaks in 200 generated maps per campaign, plus the league maps | 0 |
| `duplicate-boss-teams` | Boss teams identical to an earlier one (species, moves and training) | 6 |
| `near-duplicate-boss-teams` | Boss teams with the same species and moves as an earlier one (only training differs) | 983 |
| `boss-unsupported-moves` | Boss team moves the engine can't run | 0 |
| `broken-evolutions` | Evolutions an ownable Pokémon can't complete: unknown target, wrong or unobtainable item, level above the maximum, target with no moves, or a loop | 0 |
| `unused-balance-settings` | Settings in `balance.json` that no game code reads | 0 |
| `untested-save-migrations` | Save upgrades (vN → vN+1) that no unit test loads an old save through | 0 |
| `invalid-entries` | Entries with the status "invalid" | 0 |

Two checks are heuristics, and say so: `unused-balance-settings` looks for the setting's name in the game code (comments don't count, and a name that is also used for something else hides an unused setting), and `untested-save-migrations` looks for a test that writes a save envelope with `record: '<name>', schemaVersion: <N>`.

### Support status

Every species, form, move, item and evolution gets exactly one status. It is worked out from the data each time the report runs (`src/quality/supportStatus.ts`), so it can't go out of date.

| Status | Meaning | Examples |
|---|---|---|
| **supported** | Works in the game with no known gaps | Tackle, Bulbasaur, Potion |
| **limited** | Works, with documented limits (the reasons are listed) | Earthquake (no Dig, so no double damage); custom forms using their base species' cry; trade evolutions done with the Linking Cord; species that lost most of their moves to unsupported ones |
| **disabled** | In the data, switched off until its mechanic is built | The 611 unsupported moves; Mega, Gigantamax, Primal and battle-only forms (M8.5); Ditto and Smeargle (no supported moves) |
| **invalid** | Broken data | A missing front sprite, icon or cry; a reference to something that doesn't exist; a damaging move with no power. Today: none |

Abilities, held items and battle mechanics (Mega, Tera, Z-Moves, Dynamax) don't exist in the data yet, so they have no entries; SYSTEMS_AUDIT.md lists them as not started. When they arrive, add their kind to `ENTRY_KINDS` and a status rule.

Limits a rule can't see go in `src/quality/knownLimits.json`, with a plain sentence for each. The move notes there were found by running the director's move list through the same sentence rules as `tools/import-moves.ts`.

### The gate and the baseline

`tools/content-baseline.json` holds the last accepted numbers. `npm run report:check` fails when:

- a check's count goes **up** (more problems), or
- the number of **supported** entries of a kind (species, form, move, item, evolution) goes **down**.

New content that isn't supported yet (for example new moves imported as unsupported) raises `unsupported-moves` and fails the gate on purpose: someone has to look. If the change is intended, run `npm run report:content -- --update-baseline`, commit the new baseline, and say why in the pull request. When a number gets better, the gate passes and suggests updating the baseline so the improvement can't slip back.

The gate is tested in `tests/unit/quality.test.ts`: each check is shown to catch the problem it reports (a starter with no usable moves, a stone nobody can get, a copied boss team, missing cries, an unreachable map node, an unread setting, an untested save upgrade), and the gate's pass and fail rules are checked.

## The balance report

```
npm run report:balance                   print it
npm run report:balance -- --write        write docs/quality/BALANCE_REPORT.md
npm run report:balance -- --seed <text>  another seed (default balance-v1)
npm run report:balance -- --quick        fewer battles
```

It plays real battles with the game's own engine (`src/quality/balanceSim.ts`), seeded, so the same seed gives the same numbers (tested). Both sides pick moves like a clever boss.

1. **Species strength:** every fully evolved wild line at level 50 fights 40 random lines one on one. Lines that win 90% or more, or 10% or less, are possible outliers.
2. **Difficulty curve:** a fresh party (random wild-line Pokémon at the level ordinary enemies have at that point, 3 Pokémon at the first gym rising to 6, no items) fights 40 random bosses in every gym, Elite Four and champion slot of a full campaign.

The simulated player has no items, vitamins, healing or team choice, so real runs are easier. Use it to see where the curve jumps and which Pokémon stand out, and to compare before and after a balance change. It doesn't fail CI: balance changes are a decision, not a bug.

## Before you open a pull request

1. `npm run check` passes (type check, unit tests, build, content gate).
2. `npm run test:e2e` passes, or the failing test is named in the pull request with the reason.
3. If you changed data or balance: `npm run report:content -- --write` and `npm run report:balance -- --write`, and look at the diff of `docs/quality/`.
4. Update STATUS.md, CHECKLIST.md and SYSTEMS_AUDIT.md for what changed.
