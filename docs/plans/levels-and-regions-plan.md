# Levels above 100 and custom regions (left-out plan 1.6 and 1.7)

Started 2026-10-31. The last wave of `/mnt/project-files/plans/left-out-plan.md`. One PR per slice, merged on green CI.

## Sources
- D14 (2026-10-25): each region raises the cap by 50; levels go up to 500.
- Balancing Overhaul Phase 2 (2026-10-30): change +50 to **+100 per region**, spread each region's 100 levels across its 8 stages, stats must scale to very high levels (e.g. 1000), state the Grand Region curve and endgame cap, all numbers in one place.
- D6: the campaign mixes the original regions with custom ones (Torren and others, CHECKLIST M8.75 G).
- GAME_DESIGN §2 modifier order: base → region/stage → **party-strength correction** → archetype → items → clamp. C7: the correction must not cancel Blue's/Green's archetype edge, so archetype comes after it and the correction is capped.

The two sources disagree (9 regions × 100 = 900, Grand 1000, versus a 500 maximum). **Kice decided 2026-10-31: +50 per region, up to 500** (caps 50 … 450, Grand Region 500). Everything is data-driven, so +100 stays a data change (`levelCapStep` 100, `maxLevel` 1000, `xpScale` 4 passes `report-levels --check`).

## Slice 1.6a: the engine can go past 100 (no gameplay change)
- `balance.difficulty.maxLevel` may be up to 1000 (`LEVEL_LIMIT`); saves accept levels up to 1000 (a looser bound, so no save version).
- EXP curve above 100 (`xpForLevel`): each level costs `highLevelXp` (0.4) × the cost of level 100 × level / 100. The cost per level grows in step with the EXP a same-level foe gives (which is linear in level), so a region's 100 levels take about the battles a region has. The standard formulas are kept up to 100 (Erratic's would go negative past 160).
- Stats: the usual formula is linear in level, and damage scales with level × Attack / Defense against HP that also scales with level, so fights at 500 feel like fights at 50. Unit tests cover levels 1–1000 for every growth rate.
- Learnsets and evolutions stay at 1–100; a Pokémon above 100 simply has no new moves to learn.
- Every hard-coded 100 used as a level limit now reads `maxLevel` (eggs, enemy level bonus, wild clamp, EXP bar).
- `tools/report-levels.ts` walks a full campaign with the real level curve, stage caps and EXP formula and prints enemy vs. lead level per stage (`--step/--max/--xp/--high` to try numbers, `--check` fails past a 10-level gap).

## Slice 1.6b: the new curve (after the Encounter Director, 0.1/1.2, merges)
Checked with `report-levels` (lead never more than 0 levels behind any stage end in both):

| Rule | Data | Caps | Notes |
|---|---|---|---|
| +100 per region (not chosen) | `levelCapStep` 100, `maxLevel` 1000, `xpScale` 4 | 100 … 900, Grand 1000 | With `xpScale` 2 the lead falls 17 levels behind in region 1 (fails `--check`), so EXP doubles. |
| **+50 per region (chosen)** | `levelCapStep` 50, `maxLevel` 500, `xpScale` 2 | 50 … 450, Grand 500 | Same early game as today. |

- Grand Region curve and endgame cap: the Grand Region is the last region index, so its cap is the last step (1000 or 500); its league sits at cap − `capMargin` + bonuses, never above the cap.
- **Built (1.6c).** Party-strength correction (`balance.difficulty.partyStrength`, `encounters.ts withPartyStrength`): enemy level += clamp(round((party top-3 average − curve level − `grace` 3) × `factor` 0.5), 0, `maxBonus` 4), before the archetype offset (C7), never above the cap. Applied to every map battle (wild, trainer, gym, league) and event battles. Threat budgets get `perLevelAbove100` so the budget cap keeps rising past 100 (the rating is level-relative, so without it later regions would draw the same species as level 100).
- Playtest bot: 500 runs before (`--heal`) and after; compare reach (badges, region), deaths by stage and level gaps.

## Slice 1.7: custom regions (built)
Built from the 108 bosses no region uses yet (all have sprites and teams in `bossTeams.json`). `regions.json` gains `custom: true` and an optional roster rule; the 9-region campaign then draws 9 of 12 regular regions, so each run sees a different mix (D6). Saved runs keep their stored `regionOrder`.

| Region | Identity | Gym leaders | Elite Four | Champions | Roster rule |
|---|---|---|---|---|---|
| **Torren** | Insurgence-style land of cults and Delta Pokémon | zinnia, maxie, archie, tabitha, shelly, plumeria, guzma, nanu | cyrus, lysandre, ghetsis, giacomo | volo, lusamine | Delta forms are native (extra wild weight); every generation. |
| **Frontier Isles** | A chain of battle facilities run by the Frontier Brains | anabel, thorton, palmer, noland, ingo, emmet, riley, cheryl | marley, mira, klara, peony | the-royal, ballguy | Every generation; no theme repeats. |
| **Trial Archipelago** | Island trials and their captains | ilima, lana, kiawe, mallow, sophocles, hapu, ryuki, mina | kurt, eusine, wally, colress | gladion, carmine | Gens 7–9 native. |

Exact rosters are checked against `bosses.json` types when the slice lands (a boss with no speciality only takes "any" themes). Each region also gets a presentation identity (palette, map header) from `regionIdentity`, a research-note line and a short arrival line.
