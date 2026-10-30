---
paths:
  - "src/data/**"
  - "tools/**"
  - "src/quality/**"
---
# Rules for game data and data tools

- Generated files (`species`, `learnables`, `bossTeams`, `moves`, `moveAnims`, `megaStones`, `zMoves`, `customSpecies`, `customEvolutions`) are rebuilt by their `npm run data:*` script; edit the source or the tool, never the output. The table is in `MAP.md`.
- Don't read big JSON whole: grep the id, or print one entry with `node -e`.
- Every data file has a Zod shape in `src/core/contentSchema.ts`; new fields need one.
- Every content entry needs an explicit support status (`src/quality/supportStatus.ts`). Passing the schema is not "supported". See `QUALITY_GATES.md`.
- After a data change run `npm run report:check`; if a number honestly improves, refresh it with `npm run report:content -- --update-baseline` and say why in the PR.
- Keep provenance: note where any new dataset or asset came from (director's packs; repo stays private).
