# CLAUDE.md

Router for Claude sessions. Read this, then [STATUS.md](STATUS.md) (where the game is now), then [MAP.md](MAP.md) only if you need to find a file. Read nothing else until the task needs it.

The director, Kice (GitHub `AwsomSause`), is a beginner programmer: write reports and PR descriptions in plain language, and keep replies short.

## Where context lives

| Need | Go to |
|---|---|
| Current state, save versions, what's next | [STATUS.md](STATUS.md) (one page) |
| What every folder and key file is | [MAP.md](MAP.md) |
| How to work cheaply (search, reads, git) | [.claude/rules/working-style.md](.claude/rules/working-style.md) |
| Rules for one area (core, data, saves, screens, tests) | `.claude/rules/*.md` (auto-load for those paths) |
| A milestone's full list and known limits | [CHECKLIST.md](CHECKLIST.md) (grep the heading); M0–M6 in `docs/archive/` |
| Game rules, director decisions D1–D16 | [GAME_DESIGN.md](GAME_DESIGN.md) (grep the §) |
| Milestone plan | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (grep the §) |
| Quality gates, content statuses | [QUALITY_GATES.md](QUALITY_GATES.md) |
| Long design docs | [docs/plans/INDEX.md](docs/plans/INDEX.md) gives line ranges; never read them whole |

## Development directive (short form)

From the director's "Implementation Plan Electric" (2026-10-25; full text `docs/plans/electric-plan.md` lines 387–539). Every session follows it.

**Mission:** a complete, deterministic, browser-based Pokémon roguelike that is fun to replay. Working and integrated beats feature count.

1. **Truth first.** Check git state, the STATUS/CHECKLIST lines that apply, run `npm run check` and the relevant e2e spec. "Done" in a doc doesn't prove it works. Propose: files, acceptance criteria, tests, rollback.
2. **Vertical slices.** One verifiable slice: rules + validated data, UI, save/load, unit tests (normal, boundary, failure), browser test, docs and checklist, clean diff.
3. **Architecture.** `src/core` never imports Phaser. Strict TS; Zod for data and saves. Named seeded RNG streams; a new stream never changes existing rolls. Outcomes never depend on animation/UI. Balance numbers in `src/data/balance.json` or validated data. Versioned save migrations; never silently drop a save. No placeholder behaviour for a requested mechanic.
4. **Measurable content.** Everything has a status: supported, limited (documented), disabled, or invalid. Passing the schema isn't "supported".
5. **Spectacle via presentation cues.** Presentation failure never corrupts battle state. Respect motion/intensity/skip/audio settings. Boss phases follow game state, not animation.
6. **Determinism.** Same state + seed + actions = same result. Previews, hovers, asset loading, animations never use gameplay RNG. No reward/event applies twice. Test save/reload at checkpoints; recover from bad saves.
7. **Gates before done:** typecheck, tests, build, relevant Playwright, no console errors, screens at several sizes, diff free of unrelated changes, STATUS/CHECKLIST and known limits updated. Review the diff for correctness, architecture, UI, determinism/saves, performance. Never claim a test passed unless it ran and you read the result.
8. **Report each slice (short):** what was built, what the player can do, tests and results, what's stubbed, risks/decisions, next slice. No claims without evidence.

## Project facts

- Stack: TypeScript, Phaser 3.90, Vite, Vitest, Playwright 1.63.0, Zod. Node 22.
- `npm run check` = typecheck + unit tests + build + content gate (~80 s). `npm run test:e2e` = Playwright. Output is short on success (`report:check` prints one line per check; Playwright prints dots); failures print in full.
- Assets are from the director's packs (PokeRogue, AGPL-3.0, Nintendo material). Repo stays private (D4); keep provenance for every asset and dataset.
- Several threads work on `main` at once: start from fresh `origin/main`, rebase before pushing.
