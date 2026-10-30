# Quality gates

What has to pass before a slice of work counts as done, which checks run by themselves, and how the content gate works. The rules come from CLAUDE.md §7; this page says how each one is checked.

## The gates

| # | Gate | How it is checked | Automatic? |
|---|---|---|---|
| 1 | Type check | `npm run typecheck` | Yes: `npm run check` and CI |
| 2 | Unit and integration tests | `npm test` (Vitest, `tests/unit/`) | Yes: `npm run check` and CI |
| 3 | Production build | `npm run build` | Yes: `npm run check` and CI |
| 4 | Content gate: no content number worse than before | `npm run report:check` (below) | Yes: `npm run check` and CI |
| 5 | Browser tests for what the player does | `npm run test:e2e` (Playwright, 60 tests, about 12 minutes) | Yes in CI once Actions is on; by hand until then |
| 6 | No console errors or failed requests | `viewports.spec.ts` fails on any console error, page error, failed request or HTTP 4xx/5xx on the main screens; other specs fail on page errors | Yes (main screens); by hand for new screens |
| 7 | Screens checked at several sizes | `viewports.spec.ts` opens the menu, Hub, trainer select, map and battle at 1280×720, 1024×600, 768×1024 and 390×844 and fails if the canvas is bigger than the window or the page scrolls sideways; screenshots go to `test-results/viewport-*.png`. Whether it looks good is still a look by hand | Partly |
| 8 | Asset loading, missing files, memory, performance | The content report finds missing files; `milestone6.spec.ts` checks lazy loading; memory and frame rate by hand | Partly |
| 9 | Diff reviewed for unrelated changes | By the session, in five passes: gameplay edge cases, architecture, screen quality, determinism and save safety, performance | No |
| 10 | Docs and known limits updated | STATUS.md, CHECKLIST.md, SYSTEMS_AUDIT.md, this page | No |
| 11 | Balance looked at when numbers change | `npm run report:balance -- --write`, then compare `docs/quality/BALANCE_REPORT.md` in the diff | No (it reports, it doesn't fail) |

**CI is not running yet.** `.github/workflows/ci.yml` runs gates 1 to 5 on every pull request and every push to `main`, but GitHub has recorded no workflow run on this repository, ever (checked again on 2026-10-30; the workflow is listed as active). Until GitHub Actions is switched on (repository Settings → Actions → General → "Allow all actions and reusable workflows"), the gates only run when someone runs `npm run check` and `npm run test:e2e`.

Never claim a gate passed unless it ran and you read the result.

## The content report

```
npm run report:content                     counts, with the first offending ids of each check
npm run report:content -- --only <check>   one check, every offending id
npm run report:content -- --all            every offending id of every check
npm run report:content -- --status         every entry that isn't fully supported, and why
npm run report:content -- --json <file>    everything as JSON
npm run report:content -- --write          also write docs/quality/CONTENT_REPORT.md
npm run report:content -- --html           also write docs/quality/dashboard.html
npm run report:dashboard                   both of the above
npm run report:check                       the CI gate (same as --check)
npm run report:content -- --update-baseline   accept today's numbers as the new baseline
```

It reads the game data, the asset files on disk and the test sources. It never changes anything. The code is in `src/quality/` (no Phaser, like `src/core`); `tools/report-content.ts` runs it.

### Checks

| Check | Counts | Today |
|---|---|---|
| `unsupported-moves` | Moves the battle engine can't run (`supported: false`) | 87 |
| `unsupported-learnset-entries` | Level-up entries skipped because the move is unsupported | 12,549 |
| `species-no-usable-moves` | Species and forms with no supported level-up move | 5 |
| `meetable-species-no-usable-moves` | Of those, ones a player can own (wild, starter, by evolving) | 0 |
| `missing-sprites` | Front, back, shiny, shiny back or icon files missing | 0 |
| `missing-cries` | Cry files missing | 0 |
| `missing-other-assets` | Trainer, item, arena, music, sound or font files missing | 0 |
| `unreachable-map-nodes` | Unreachable nodes, dead ends or rule breaks in 200 generated maps per campaign, plus the league maps | 0 |
| `duplicate-boss-teams` | Boss teams identical to an earlier one (species, moves and training) | 0 |
| `near-duplicate-boss-teams` | Boss teams with the same species and moves as an earlier one (only training differs) | 0 |
| `boss-unsupported-moves` | Boss team moves the engine can't run | 0 |
| `broken-evolutions` | Evolutions an ownable Pokémon can't complete: unknown target, wrong or unobtainable item, level above the maximum, target with no moves, or a loop | 0 |
| `unused-balance-settings` | Settings in `balance.json` that no game code reads | 0 |
| `untested-save-migrations` | Save upgrades (vN → vN+1) that no unit test loads an old save through | 0 |
| `mechanics-without-proof` | Mechanics claimed as built whose code file or unit test file is missing (`src/quality/mechanics.json`) | 0 |
| `special-form-leaks` | Event-only forms that an ordinary wild, trainer or starter pool can hand out | 0 |
| `invalid-entries` | Entries with the status "invalid" | 0 |

Two checks are heuristics, and say so: `unused-balance-settings` looks for the setting's name in the game code (comments don't count, and a name that is also used for something else hides an unused setting), and `untested-save-migrations` looks for a test that writes a save envelope with `record: '<name>', schemaVersion: <N>`.

### Support status

Every species, form, move, ability, item, evolution and mechanic gets exactly one status. It is worked out from the data each time the report runs (`src/quality/supportStatus.ts`), so it can't go out of date.

| Status | Meaning | Examples |
|---|---|---|
| **supported** | Works in the game with no known gaps | Tackle, Bulbasaur, Potion |
| **limited** | Works, with documented limits (the reasons are listed) | Earthquake (no Dig, so no double damage); custom forms using their base species' cry; trade evolutions done with the Linking Cord; species that lost most of their moves to unsupported ones |
| **disabled** | In the data, switched off until its mechanic is built | The 611 unsupported moves; Mega, Gigantamax, Primal and battle-only forms (M8.5); Ditto and Smeargle (no supported moves) |
| **invalid** | Broken data | A missing front sprite, icon or cry; a reference to something that doesn't exist; a damaging move with no power. Today: none |

Battle mechanics and game systems (Mega, Tera, Z-Moves, Dynamax, raids, the Bond Engine and so on) are listed in `src/quality/mechanics.json` with the code files that run them and the unit tests that exercise them. A mechanic marked built whose code or test file is missing is "invalid", so "done" has to point at something. When a new system lands, add its entry there; if it isn't built yet, add it as `disabled` with a note.

Limits a rule can't see go in `src/quality/knownLimits.json`, with a plain sentence for each. The move notes there were found by running the director's move list through the same sentence rules as `tools/import-moves.ts`.

### The gate and the baseline

`tools/content-baseline.json` holds the last accepted numbers. `npm run report:check` fails when:

- a check's count goes **up** (more problems), or
- the number of **supported** entries of a kind (species, form, move, item, evolution) goes **down**.

New content that isn't supported yet (for example new moves imported as unsupported) raises `unsupported-moves` and fails the gate on purpose: someone has to look. If the change is intended, run `npm run report:content -- --update-baseline`, commit the new baseline, and say why in the pull request. When a number gets better, the gate passes and suggests updating the baseline so the improvement can't slip back.

The gate is tested in `tests/unit/quality.test.ts`: each check is shown to catch the problem it reports (a starter with no usable moves, a stone nobody can get, a copied boss team, missing cries, an unreachable map node, an unread setting, an untested save upgrade), and the gate's pass and fail rules are checked.

## The quality dashboard

`npm run report:dashboard` writes `docs/quality/dashboard.html`: one page with the support status of every kind, every check's count against the baseline (better, same or WORSE), the offending ids behind each count, and every mechanic with its status. It also rewrites `CONTENT_REPORT.md`. Open the HTML file in a browser. The code is `src/quality/dashboard.ts`; `qualityMechanics.test.ts` checks it.

The plan also asks for an "incomplete translations" report. The game is English only and has no translation files, so there is nothing to count; add the check when a second language exists.

## Review passes

After each slice, read the same diff five times with different questions: (1) gameplay correctness and edge cases, (2) architecture and maintainability, (3) UI quality and hierarchy, (4) determinism and save safety, (5) performance and asset loading. Say in the pull request which passes found something.

## Keeping the browser tests healthy

The full Playwright run is the only check that touches everything, so someone owns it: run `npm run test:e2e` after each batch of merged pull requests and fix every failure at once. Fixes that held up so far: press the extra Enter when a Hub tile opens a menu first, look up a trainer's slot instead of counting key presses, give long fights `test.setTimeout(180_000)`, and filter generated "?" stops out of a test map before adding the one under test. Never skip a test to get green. Running the suite rewrites two tracked screenshots in `docs/`; run `git checkout docs/*.png` before committing.

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
3. **Abilities:** abilities run in every simulated battle (the engine applies them). The report averages the win rate of the lines that have each ability, so an ability far from the middle stands out.
4. **With the kit:** sections 1 and 2 are run a second time with every key item (Mega Ring, Tera Orb, Z-Ring, Dynamax Band), Mega Stone and Z-Crystal in the Bag. Mega and Gigantamax happen by themselves; each battle the player also uses one of Tera, a Z-Move or Dynamax (picked by the seed) from the second turn. The report shows both columns side by side and the lines that gain most.

The simulated player has no vitamins, healing or team choice, and only the kit run has the transformation items, so real runs are easier. Use it to see where the curve jumps and which Pokémon stand out, and to compare before and after a balance change. It doesn't fail CI: balance changes are a decision, not a bug.

## Before you open a pull request

1. `npm run check` passes (type check, unit tests, build, content gate).
2. `npm run test:e2e` passes, or the failing test is named in the pull request with the reason.
3. If you changed data or balance: `npm run report:content -- --write` and `npm run report:balance -- --write`, and look at the diff of `docs/quality/`.
4. Update STATUS.md, CHECKLIST.md and SYSTEMS_AUDIT.md for what changed.
