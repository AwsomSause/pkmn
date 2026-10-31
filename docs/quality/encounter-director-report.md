# Encounter Director report

Written by `tests/unit/encounterDirector.test.ts` (part of `npm run check`): 10000 wild and 2000 trainer teams per early stage, region 1, column 3, trainer Red. Full numbers (level, rarity and evolution-stage spreads, top species) are in `encounter-director-report.json`.

| Stage | Source | Intended levels | Levels seen | Samples | Species | Threat avg / max | Draws rejected | Fallbacks | Invalid | Locked picks | One-hit KO |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | wild | 4–6 | 4, 5, 6 | 10000 | 101 | 52.811 / 86 (budget 88.003) | 3.6% | 0 | 0 | 0 | 0.00% |
| 1 | trainer | 4–6 | 5, 6, 7 | 2000 | 106 | 53.412 / 102 (budget 105.636) | 1.2% | 0 | 0 | 0 | 0.00% |
| 2 | wild | 9–11 | 9, 10, 11 | 10000 | 262 | 56.439 / 91 (budget 95.989) | 0.4% | 0 | 0 | 0 | 0.00% |
| 2 | trainer | 9–11 | 10, 11, 12 | 4000 | 264 | 58.021 / 112 (budget 118.508) | 0.7% | 0 | 0 | 0 | 0.00% |
| 3 | wild | 14–16 | 14, 15, 16 | 10000 | 329 | 61.658 / 104 (budget 103.994) | 0.6% | 0 | 0 | 0 | 0.00% |
| 3 | trainer | 14–16 | 15, 16, 17 | 6000 | 341 | 65.582 / 134 (budget 131.616) | 0.7% | 0 | 0 | 0 | 0.00% |
| 4 | wild | 19–21 | 19, 20, 21 | 10000 | 354 | 66.032 / 113 (budget 111.993) | 1.4% | 0 | 0 | 0 | 0.00% |
| 4 | trainer | 19–21 | 20, 21, 22 | 6000 | 361 | 75.066 / 140 (budget 144.639) | 0.8% | 0 | 0 | 0 | 0.00% |

One-hit KO = the foe's best attack at a max roll, neutral type, no crit, beats an all-70 Pokémon of the same level. Party loss and win rates are measured by the playtest bot (`node tools/playtest.ts`, `docs/quality/playtest/`), not here.
