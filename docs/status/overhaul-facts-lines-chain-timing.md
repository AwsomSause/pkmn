# Trainer facts, line polish, chain timing (2026-11-07)

From the plans audit, section 4.

- **Trainer facts check:** `node tools/overhaul/check-trainer-facts.mjs` checks each major trainer's ace and type against their real boss team (and a few canon fixes, e.g. Sada's ace is Koraidon). `--fix` rewrote 49 entries in `src/data/overhaul/major_trainers.json`. A unit test (`overhaulTrainerFacts.test.ts`) keeps it clean.
- **Line polish:** `node tools/overhaul/polish-lines.mjs` (safe to re-run) trims trainer lines to 90 characters or less, drops filler clauses ("..., even with ...") and repeated sign-off tics, and removes duplicate lines per trainer. 2494 archetype lines and 1133 gym/rival/champion lines changed.
- **Chain timing:** a later chain stage now only shows between its `minNodesAfterPrevious` and `maxNodesAfterPrevious` map nodes after the stage before (a counter flag `ev:ovt-<stage>` ticks on every node; saves from before start the counter on their next node). Past the window the chain lapses.
- **Choices that depend on earlier ones:** 17 later options carry `needs` (one flag an earlier choice set), written by `tools/overhaul/chain-needs.mjs`. Every stage keeps at least one option open to everyone (checked by the catalog validator).

No save version change: everything lives in existing story flags.

Known limits: the windows can make long chains finish less often in short runs; the 17 dependent options were hand-picked, others in the pack don't depend on earlier choices.
