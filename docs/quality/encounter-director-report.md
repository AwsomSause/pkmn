# Encounter Director report

Written by `tests/unit/encounterDirector.test.ts` (part of `npm run check`): 10000 wild and 2000 trainer teams per early stage, region 1, column 3, trainer Red. Full numbers (level, rarity and evolution-stage spreads, top species) are in `encounter-director-report.json`.

| Stage | Source | Intended levels | Levels seen | Samples | Species | Threat avg / max | Draws rejected | Fallbacks | Invalid | Locked picks | One-hit KO |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | wild | 4–5 | 4, 5 | 10000 | 85 | 53.253 / 79 (budget 86.937) | 5.5% | 0 | 0 | 0 | 0.00% |
| 1 | trainer | 4–5 | 4, 5, 6 | 2000 | 87 | 54.846 / 108 (budget 102.96) | 22.1% | 47 | 0 | 0 | 0.00% |
| 2 | wild | 6–8 | 6, 7, 8 | 10000 | 141 | 54.684 / 90 (budget 91.189) | 2.0% | 0 | 0 | 0 | 0.00% |
| 2 | trainer | 6–8 | 7, 8, 9 | 4000 | 145 | 56 / 106 (budget 110.767) | 0.5% | 0 | 0 | 0 | 0.00% |
| 3 | wild | 10–12 | 10, 11, 12 | 10000 | 294 | 58.801 / 99 (budget 97.594) | 0.4% | 0 | 0 | 0 | 0.00% |
| 3 | trainer | 10–12 | 11, 12, 13 | 6000 | 295 | 60.244 / 114 (budget 121.197) | 0.4% | 0 | 0 | 0 | 0.00% |
| 4 | wild | 14–16 | 14, 15, 16 | 10000 | 330 | 62.801 / 104 (budget 103.993) | 0.9% | 0 | 0 | 0 | 0.00% |
| 4 | trainer | 14–16 | 15, 16, 17 | 6000 | 343 | 67.027 / 134 (budget 131.58) | 0.9% | 0 | 0 | 0 | 0.00% |

One-hit KO = the foe's best attack at a max roll, neutral type, no crit, beats an all-70 Pokémon of the same level. Party loss and win rates are measured by the playtest bot (`node tools/playtest.ts`, `docs/quality/playtest/`), not here.
