# CLAUDE.md

Router for Claude sessions. Read this, then [MAP.md](MAP.md), then only what the task needs.

The director, Kice (GitHub `AwsomSause`), is a beginner programmer: write reports and PR descriptions in plain language.

## Where context lives

| Need | Go to |
|---|---|
| What every folder and key file is | [MAP.md](MAP.md) |
| How to work cheaply (search, reads, subagents, git) | [.claude/rules/working-style.md](.claude/rules/working-style.md) |
| Rules for one area (core, data, saves, screens, tests) | `.claude/rules/*.md` (load by themselves when you touch those paths) |
| What works right now, per milestone | [CHECKLIST.md](CHECKLIST.md) (grep the milestone heading) |
| Game rules and director decisions (D1–D16) | [GAME_DESIGN.md](GAME_DESIGN.md) (grep the § you need) |
| Milestone plan | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) |
| Quality gates, content statuses, reports | [QUALITY_GATES.md](QUALITY_GATES.md), `docs/quality/` |
| Full development directive (source of the rules below) | `docs/plans/electric-plan.md` (588 lines; grep, don't read whole) |

## Development directive (short form)

Adopted from the director's "Implementation Plan Electric" (2026-10-25). Every session follows it.

**Mission:** a complete, deterministic, browser-based Pokémon roguelike that is fun to replay. A working, integrated, maintainable game beats feature count.

1. **Establish the truth first.** Check git state and recent commits, read the CHECKLIST/plan sections that apply, run `npm run check` and the relevant e2e spec. A milestone marked done does not prove a feature works. Write a short proposal: files, acceptance criteria, tests, rollback.
2. **Vertical slices.** One verifiable slice at a time: rules + validated data, UI, save/load, unit tests (normal, boundary, failure), integration and browser tests, docs and checklist, clean diff.
3. **Architecture.** `src/core` never imports Phaser. Strict TS; Zod for imported data and saves. Named seeded RNG streams; a new stream never changes existing rolls. Outcomes never depend on animation or UI state. Balance numbers live in `src/data/balance.json` or validated data. Versioned save migrations; never silently discard a save. Never substitute placeholder behaviour for a requested mechanic.
4. **Measurable content.** Every species, form, move, ability, item, evolution, transformation and mechanic has a status: fully supported, supported with documented limits, disabled pending implementation, or invalid. Passing the schema is not "supported".
5. **Spectacle via the presentation-cue layer.** A presentation failure never corrupts battle state. Respect intensity, reduced motion, animation skip and audio settings. Boss phases are triggered by game state, never animation playback.
6. **Determinism.** Same state, seed and actions give the same result. Previews, hovers, asset loading and animations never use gameplay RNG. No reward or event is ever applied twice. Test save/reload at every checkpoint; recover from malformed saves.
7. **Quality gates before a slice is done:** typecheck, unit/integration tests, build, relevant Playwright, no console errors, screens checked at several sizes, assets/perf checked, diff reviewed for unrelated changes, docs and known limits updated. Then review the diff in separate passes: correctness, architecture, UI, determinism/saves, performance. Never claim a test passed unless it ran and you read the result.
8. **Report after every slice:** what was built, what the player can now do, files changed, tests and results, what is still stubbed, risks and decisions needing approval, commands to reproduce, recommended next slice. No claims without evidence.

## Project facts

- Stack: TypeScript, Phaser 3.90, Vite, Vitest, Playwright 1.63.0, Zod. Node 22.
- `npm run check` = typecheck + unit tests + build + content-report gate. `npm run test:e2e` = Playwright.
- Assets come from the director's packs (PokeRogue, AGPL-3.0, Nintendo material). The repo stays private (D4); keep provenance for every asset and dataset.
- Several threads work on `main` at once: start from fresh `origin/main` and rebase before pushing (see working-style).

**Success:** completable, deterministic, coherent, polished, save-safe and fun to replay.
