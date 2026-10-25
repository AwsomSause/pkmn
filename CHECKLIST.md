# Implementation checklist

Status of every feature. "Done" means implemented **and** tested (unit tests and/or a browser test).

## Milestone 0 — Baseline ✅

- [x] Vite + TypeScript (strict) + Phaser 3.90 project
- [x] Vitest unit tests, Playwright browser tests
- [x] GitHub Actions CI: type check, unit tests, build, browser tests
- [x] Architecture rule: `src/core` never imports Phaser (enforced by a unit test)
- [x] Asset catalog, manifest generator, import script, placeholders for missing files

## Milestone 1 — Vertical slice ✅

- [x] Main menu: Continue (only with a valid save), New Run, Sound on/off, profile stats, save warnings
- [x] Trainer select: Red / Blue / Green from data, pros and cons shown
- [x] Starter select: 3 distinct, seeded, first-stage species from a 12-species pool
- [x] Wild battles with the Gen 9-style baseline ruleset:
  - [x] damage formula, STAB, type chart (18 types), immunities
  - [x] accuracy and accuracy/evasion stages, critical hits (with crit stages)
  - [x] priority → Speed → seeded tie-break turn order
  - [x] status conditions: burn, poison, paralysis, sleep, freeze (incl. type and powder immunities)
  - [x] stat stage moves, secondary effects (status chance, flinch, stat drops), drain, recoil, fixed damage
  - [x] PP, Struggle when out of PP
  - [x] fainting, victory and defeat
- [x] No running from battles (director decision D3)
- [x] XP (Blue +25%) with level-ups and new moves while a slot is free
- [x] Money for wins (Green +25%)
- [x] Enemy levels from a prototype curve, with Blue +2 / Green −1 and level caps
- [x] Five distinct reward choices, pick exactly one, applied immediately
- [x] Next encounter after each reward
- [x] Save at safe checkpoints (starter pick, every turn, reward pick, run end)
- [x] Continue after refresh resumes exactly; reward screen shows the same five choices
- [x] Damaged saves detected; backed up (never deleted) before starting fresh
- [x] Saves from newer versions refused; migration framework for older ones
- [x] Defeat ends the run; profile statistics updated exactly once
- [x] Debug panel (F2): run state, heal, replace wild Pokémon, seeded new run, asset report

### Known limits in Milestone 1 (by design, documented)

- Party is always one Pokémon: catching, switching, and the party screen arrive in Milestone 2.
- When a Pokémon already knows four moves, a new move is skipped with a message (choosing a move to forget arrives in Milestone 2).
- No Bag/battle items yet: rewards are applied immediately when chosen.
- Encounters are a straight sequence, not a stage map (Milestone 3).
- Luck and the other nine attributes are stored but have no effect until their formulas are approved.
- Green's 15% capture penalty is in the data but has nothing to act on until catching exists.
- Move animations from the supplied pack are not played yet (hit flashes only).
- Prototype learnsets are hand-written and simplified to supported moves; full data import is Milestone 6.
- Damage uses whole-number rounding after each step; the main games use a slightly different rounding, so results can differ by about 1 HP.
- If both Pokémon faint in the same turn (e.g. from recoil), the player wins.

## Milestone 2+ — not started

See IMPLEMENTATION_PLAN.md §5.
