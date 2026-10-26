# CLAUDE.md — development directive

Adopted from the director's "Implementation Plan Electric" (2026-10-25; full text in `docs/plans/electric-plan.md`). Every session working in this repository follows it.

The director, Kice (GitHub `AwsomSause`), is a beginner programmer: write reports and PR descriptions in plain language.

## Mission

Deliver a complete, deterministic, browser-based Pokémon roguelike with deep replayability, expressive battles, meaningful progression and polished presentation. Optimize for a working, integrated, maintainable game, not for the number of features written.

## 1. Establish the truth before changing code

1. Read `IMPLEMENTATION_PLAN.md`, `GAME_DESIGN.md`, `CHECKLIST.md` and the design decisions that apply.
2. Look at the real repository: git status, branch, recent commits, package scripts.
3. Run `npm run check` (type check, unit tests, build) and the relevant `npm run test:e2e` tests.
4. Find out which planned features really work and which are stubbed, partial, disabled or untested. A milestone marked done does not prove a feature works.
5. Note save compatibility risks, migrations and dependencies.
6. Write a short proposal: files affected, acceptance criteria, tests, how to roll back.

## 2. Work in vertical slices

One independently verifiable slice at a time. Each slice has: core rules and validated data; UI integration; save/load where it applies; unit tests for normal, boundary and failure cases; integration tests for connected systems; browser tests for what the player does; docs and checklist updates; a clean diff. Prefer small, reversible changes. Don't start unrelated work until the slice passes.

## 3. Preserve the architecture

- `src/core` never imports Phaser (a unit test enforces it).
- Strict TypeScript; Zod validation for imported data and saves.
- Named, seeded RNG streams. A new stream must not change existing rolls.
- Game outcomes never depend on animation timing or UI state.
- Systems talk through explicit commands, domain events and validated effects.
- Balance numbers live in `src/data/balance.json` or validated content data.
- Versioned save migrations; never silently discard a save.
- Never substitute placeholder behaviour for a requested mechanic.

## 4. Make content completeness measurable

Species, forms, moves, abilities, held items, evolutions, transformations and battle mechanics each carry an explicit status: fully supported, supported with documented limits, disabled pending implementation, or invalid data. Importing or passing schema validation is not "supported". Every enabled move has verified behaviour (accuracy, damage, secondary effects, targets); every enabled species has usable moves.

## 5. Spectacle without breaking correctness

Animation, audio, camera, dialogue and transitions go through a presentation-cue layer. A presentation failure never corrupts battle state. Support visual intensity settings, reduced motion, animation skip and audio controls. Boss phases and transformations are triggered by game state, never by animation playback.

## 6. Determinism and reliability

Same initial state, seed and actions give the same results. UI previews, hovers, asset loading and animations never consume gameplay RNG. No reward or event is ever applied twice (refresh, replayed animation, resumed save). Test save and reload at every meaningful checkpoint; recover safely from malformed saves.

## 7. Quality gates before a slice is done

1. Type check. 2. Unit and integration tests. 3. Production build. 4. Relevant Playwright runs. 5. No console errors or failed requests. 6. Rendered screens checked at several sizes. 7. Asset loading, missing files, memory and performance checked. 8. Diff reviewed for unrelated changes. 9. Docs and known limitations updated.

Never claim a test passed unless it ran and you read the result. If a tool or environment limit blocks verification, say so.

After a slice, review the same diff in separate passes for: gameplay correctness and edge cases; architecture; UI quality; determinism and save integrity; performance and asset loading.

## 8. Report after every slice

What was built; what the player can now do; files and systems changed; tests run and their results; what is still stubbed; known bugs, risks and decisions needing approval; exact commands to reproduce; the recommended next slice. No claims about commits, deploys or tests without evidence.

## Project facts

- Stack: TypeScript, Phaser 3.90, Vite, Vitest, Playwright 1.63.0, Zod.
- Assets come from the director's packs (PokeRogue, AGPL-3.0, Nintendo material). The repo stays private (D4); keep provenance for every asset and dataset.
- Playwright gotcha: the first key press right after a scene change can be dropped; e2e tests wait 250 ms after each scene change.

## Definition of success

The finished game is completable, deterministic, mechanically coherent, visually polished, save-safe and fun to replay. A large feature count is not a substitute for a finished game.
