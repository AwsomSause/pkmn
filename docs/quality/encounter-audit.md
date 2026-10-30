# Encounter and level audit (balancing overhaul, phase 1)

Written 2026-10-30. Source of the plan: `PROGRESSION & ENCOUNTER BALANCING OVERHAUL.md`.

## How levels work today
- **One cap formula.** `levelCap(content, regionIndex)` in `src/core/regions.ts` = `levelCapStep × (region + 1)`, stopped at `maxLevel`. Both come from `balance.json` `difficulty` (`levelCapStep` 50, `maxLevel` 100). `runLevelCap` is the same for the current run.
- **One enemy-level formula.** `levelScale`, `leagueScale` and `enemyLevel` in `src/core/encounters.ts`: start of region (`baseLevel` 4 in region 1, else the previous cap) rising by `curve` to `cap - capMargin`, plus variance, archetype offset and a node bonus (trainer, gym, ace, Elite Four, champion, harder route), clamped to `[minLevel, cap]`.
- **Player XP and levels** stop at the same cap (`gainXp`, `addLevels` in `src/core/pokemon.ts`). XP tables end at 100.
- "20 levels per stage" in the plan is not a Pokémon level. A stage is a column of map nodes; the level moves smoothly across a region's stages rather than per stage.

## Findings
1. The cap and enemy levels are already centralized; there is no second formula to merge.
2. **+100 per region is not safe yet.** With `maxLevel` 100 the first region would already cap at 100. Raising the step needs levels above 100 (XP tables, stat scaling to 500 or 1000), which is milestone M8.75 part G. **Decision: keep +50 until part G lands, then change `levelCapStep` and `maxLevel` together.** Recorded in GAME_DESIGN §12 (D14).
3. Wild species choice does not look at rarity or level availability. The spreadsheet data below is the first step toward doing that.
4. Event and fishing encounters (`mapItems`, rods) pick species through their own paths. They should go through an Encounter Director (phase 4, not built).

## What this slice adds (phase 3 start)
- `tools/availability-source.csv`: the director's Pokedex sheet (1025 species).
- `npm run data:availability` writes `src/data/availability.json` (rarity, difficulty 1–10, min and max level, capture rate), status **suggested**, for 1025 of 1289 species. Forms and custom species have no row.
- `tests/unit/availability.test.ts` checks every id exists, levels are sane and min ≤ max.
- Nothing reads the file yet; encounter rules are unchanged.

## Not done (next)
Phases 2 (config; waits on part G), 4 (Encounter Director), 5 (level policy per category), 6 (threat rating), 7–11.
