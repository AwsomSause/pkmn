# IMPLEMENTATION_PLAN.md — Pokémon Roguelike

**Status:** Approved by the director on 2026-10-25.

---

## 1. Starting point

- **Repository:** `AwsomSause/pkmn` (chosen by the director 2026-10-25). Currently empty and **public**; it should be switched to private before assets are added (see GAME_DESIGN §13).
- **Assets:** four zip packs inventoried in GAME_DESIGN §13. No species/move data is included.

## 2. Tech stack

| Piece | Choice | Why (plain language) |
|---|---|---|
| Language | TypeScript (strict mode) | Catches mistakes before the game runs. |
| Game engine | Phaser 3 | Draws sprites, plays sound, handles input. |
| Build tool | Vite | Fast dev server; makes a static site you can host anywhere. |
| Unit tests | Vitest | Tests game rules in milliseconds, no browser needed. |
| Browser tests | Playwright | Clicks through the real game in a real browser. |
| Data checking | Zod | Checks every data file and save file has the right shape, and gives readable errors when it doesn't. |
| Random numbers | Our own small seeded generator (e.g. sfc32) | Same seed → same run, every time. |

## 3. Architecture

The single most important rule: **game rules know nothing about Phaser.**

```
   Data files (JSON)  ─┐
                       ├─>  CORE (pure TypeScript rules)  <──>  SAVE layer (localStorage now, cloud later)
   Seeded RNG streams ─┘              │
                                      ▼ (read-only state + events)
                        SCENES & UI (Phaser + HTML overlays)
                                      ▲
                               Player input
```

- **Core** is plain functions and data: "given this battle state and these choices, here is the next state and what happened". That makes it testable without a browser, and lets the debug tools and tests drive the same code the game uses.
- **Scenes** only draw the state and send the player's choices back into the core.
- **RNG streams:** one run seed is split into named streams (`map`, `encounter`, `reward`, `battle`, `capture`, `shop`). Opening a menu can't change what the next reward will be.
- **Save layer** talks to a `StorageProvider` interface. `LocalStorageProvider` now; a cloud provider can be added later without touching the core.

## 4. Folder structure

```
/
├─ GAME_DESIGN.md, IMPLEMENTATION_PLAN.md, README.md, CHECKLIST.md
├─ index.html, vite.config.ts, tsconfig.json, package.json
├─ src/
│  ├─ main.ts                  entry: creates the Phaser game
│  ├─ core/                    PURE RULES (no Phaser imports, enforced by a lint rule)
│  │  ├─ rng/                  seeded generator + named streams
│  │  ├─ pokemon/              instance creation, stat calc, XP/levels, evolution
│  │  ├─ battle/               turn engine, damage, accuracy, crits, status, AI
│  │  ├─ capture/              catch probability
│  │  ├─ party/                add/replace/candy rules (max 6)
│  │  ├─ rewards/              5-choice draft generation + applying a reward
│  │  ├─ map/                  stage graph generation + validation
│  │  ├─ difficulty/           enemy level calculation
│  │  ├─ campaign/             region order, stage/E4/champion progression
│  │  ├─ attributes/           10 attributes (storage now, effects later)
│  │  ├─ economy/              money, shops, bank
│  │  └─ run/                  run state + actions (the "game state machine")
│  ├─ data/                    CONTENT (JSON + Zod schemas)
│  │  ├─ species.json, moves.json, types.json, items.json, rewards.json
│  │  ├─ archetypes.json, regions.json, stageTemplates.json
│  │  ├─ balance.json          every tunable number in one place
│  │  └─ schemas/
│  ├─ save/                    StorageProvider, save schemas, migrations, export/import
│  ├─ assets/                  asset manifest types + loader + placeholder generator
│  ├─ scenes/                  Boot, Preload, MainMenu, TrainerSelect, StarterSelect,
│  │                           Battle, RewardDraft, Map, Shop, Party, RunEnd
│  ├─ ui/                      reusable widgets: menu list, text box, HP bar, dialogs
│  └─ debug/                   debug panel (seed, start battle, give item, skip stage…)
├─ tests/
│  ├─ unit/                    Vitest: one file per core module
│  └─ e2e/                     Playwright: real clicks through the game
├─ tools/
│  ├─ build-asset-manifest.ts  scans asset folder → manifest.json (only real files)
│  ├─ validate-assets.ts       reports missing / unused assets
│  └─ import-game-data.ts      builds species/moves JSON from an open dataset
└─ public/assets/              game assets (only what the manifest uses; see Risk R3)
```

## 5. Milestones and dependencies

Each milestone ends with: type check, production build, unit tests, a Playwright run through the real UI, updated docs and checklist, and a short report to you.

| # | Milestone | Depends on | What you can do at the end |
|---|---|---|---|
| **M0** | **Baseline.** Repo, Vite+TS+Phaser+Vitest+Playwright, CI on GitHub, lint rule keeping Phaser out of `core/`, asset manifest tool, placeholder art, empty boot scene. | Repo decision (D0) | Open a blank game page; `npm test` passes. |
| **M1** | **Vertical slice** (details in §6). | M0, D2–D5 | Start a run, pick trainer + starter, fight wild battles, draft rewards, save/quit/continue. |
| M2 | **Battle completeness.** Switching, battle items, capture + full party flow (replace/candies), trainer battles with teams, move learning, Last Stand Charm, defeat → run end. | M1, D7 | Catch Pokémon, build a party, lose a run properly. |
| M3 | **One full stage.** Layered map generator + validator, map screen with forks and risk labels, difficulty model with debug readout, optional nodes (heal, shop stub), 2 trainers, gym leader at level 20. | M2 | Play a complete 20-level stage. |
| M4 | **One full region + dev campaign.** 8 stages, Elite Four with healing, champion, region transition, shuffled region order, short developer campaign, shops with real stock. | M3, D6, D13, D14 | Beat a region; test whole-campaign flow in minutes. |
| M5 | **Permanent progression.** Profile, bank, run-end payout (duplicate-proof), trainer unlocks, achievements, statistics, save export/import, save migrations, corrupt-save recovery. | M4, D10–D12 | Runs feed a permanent profile that survives refreshes. |
| M6 | **Content scale-up.** Data import for all species/moves, region eligibility, sprite/cry manifest at scale, lazy-loading audio, evolution rules. | M2 (can run alongside M3–M5) | Full Pokédex available. |
| M7 | **Attributes & luck.** Implement each attribute only after you approve its formula; luck-weighted rewards; shiny rules. | M5, D8, D9 | Attributes visibly matter. |
| M8 | **Advanced mechanics**, one at a time: Mega → Tera → Z-Moves → Dynamax → regional forms. | M6, M7 | Key items unlock real mechanics. |
| M9 | **Grand Region, ending, polish, deploy.** Battle animation player for the supplied anim JSON, music, final boss, ending, static deploy. | All, D1, D4 | Complete game from start to credits. |

## 6. Milestone 1 — the smallest playable prototype

**Built 2026-10-25.** Differences from the original plan, all small: status conditions and stat-stage moves were pulled forward from Milestone 2 (most early-game moves have side effects like a 10% burn, so leaving them out would have meant fake moves); the Settings stub became a working Sound on/off option; Poké Balls were left out of the reward pool until catching exists. See CHECKLIST.md for exactly what works.

**In scope**
1. **Main menu:** New Run, Continue (only enabled if a valid save exists), Sound on/off, plus a debug panel (F2).
2. **Trainer select:** Red/Blue/Green from `archetypes.json`, with their modifiers listed.
3. **Starter select:** 3 distinct species from a ~12-species prototype pool, seeded.
4. **Wild battle:** Fight only (no running, per D3). Real damage formula, type chart, accuracy, crits, priority → Speed → seeded tie-break, fainting, win/lose. Simple enemy AI (random usable move). ~25 moves, ~20 species.
5. **Rewards:** XP (Blue +25%) with level-ups, money (Green +25%).
6. **Reward draft:** 5 distinct choices from ~10 simple reward definitions (Potion, Super Potion, Poké Ball (stored for M2), money pouch, Rare Candy, temporary stat buffs…). Pick exactly one, applied immediately.
7. **Next encounter:** a fixed linear sequence of wild battles (no map yet), enemy levels from a simple placeholder curve in `balance.json`, Green's −1 / Blue's +2 applied.
8. **Save/load:** versioned run save after starter pick and after each reward pick; Continue resumes exactly; corrupted save shows a clear message and a "start fresh" option.
9. **Defeat:** game-over screen, run save cleared. *(Full run-end payout is M5.)*
10. **Debug panel:** show seed, set seed, force a specific wild Pokémon, give a reward, heal.

**Out of scope for M1 (listed so nothing pretends to work):** capture, switching, trainers, maps, shops, attributes' effects, permanent currency, animations from the anim pack, music beyond menu/battle.

**Tests in M1**
- Same seed → same starters, same encounters, same rewards, same battle outcome.
- Starters: 3 distinct, all from the eligible pool.
- Damage: known-answer cases; type effectiveness incl. immunities; crit multiplier.
- Turn order: priority beats Speed; Speed ties use the seeded roll.
- Accuracy and probability always within 0–1.
- Reward draft: exactly 5, all distinct; config with <5 rewards throws an error; picking grants exactly one.
- Archetype modifiers: Blue XP/levels, Green money/levels, Red unchanged.
- Save: round-trip; version mismatch → migration or clean error; reloading after a reward pick doesn't re-grant it.
- Playwright: menu → Blue → pick starter → win a battle → pick reward → reload page → Continue → next battle begins.

## 7. Risks

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | **Campaign scale.** ~1,600 encounters per full run (25–30+ hours). | Players may never finish; balancing 10 regions is a huge job. | All counts live in `balance.json`. Developer short campaign from M4. Decide D1 before M4. |
| R2 | **Content data.** No species/move/learnset data supplied; 1,000+ species, ~900 moves, many with special effects. | Writing every move's special effect is the single biggest job in the project. | Import base data by script. Implement move *effects* in tiers: plain damage first, common effects next, rare ones flagged "not yet supported" and excluded from eligible pools until done. |
| R3 | **Asset size.** ~690 MB unzipped, 57k files. | Slow loads, huge git repo. | Copy only what the manifest uses into the repo; keep full packs outside git (or Git LFS). Lazy-load cries/music per region. Strip `__MACOSX` files. |
| R4 | **Licensing.** PokeRogue assets are AGPL-3.0 and include Nintendo-owned material. | Public hosting has legal risk; AGPL may apply to our code. | Private repo; no public deploy until D4 is decided; art swappable via manifest. |
| R5 | **Undefined rules** (attributes, candies, bank, luck, Grand Region). | Building on guesses means rework. | Each is a listed open decision; systems ship without those effects until you approve formulas. |
| R6 | **Level cap vs. 10 regions.** Pokémon stop at 100, but difficulty should keep rising. | Late game flattens. | Needs a decision (D14): e.g. caps reached around region 7, then difficulty comes from team quality, held items, mechanics. |
| R7 | **Save reliability.** Browser storage can be cleared or full. | Lost progress. | Validation, migrations, atomic checkpoint writes, export/import, clear error messages. |
| R8 | **Battle animation format.** Supplied anim JSON is PokeRogue's own format. | Needs a custom player. | Deferred to M9; simple hit flashes/shakes until then. |

## 8. How I'll report each milestone

What works (tested in the browser), what was tested (test names + results), what's unfinished or stubbed, and how to run it (`npm install`, `npm run dev`, open the link).

## 9. Approval checklist for you

- [ ] Approve this plan and GAME_DESIGN.md (or tell me what to change)
- [x] D0 Repository: AwsomSause/pkmn
- [x] D2 Battle ruleset: Gen 9-style, no IVs/EVs/natures
- [x] D3 Fleeing: no running
- [x] D4 Keep private
- [x] D5 ~12 Gen 1 starters
- Everything else (D1, D6–D15) can wait until the milestone that needs it.
