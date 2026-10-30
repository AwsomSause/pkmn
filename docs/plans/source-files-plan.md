# Source files plan: what Kice supplied and how we use it

Written 2026-10-30. Covers every file in the project's shared folder (`/mnt/project-files/`). Each entry says what the file is, what is useful in it, and where it fits in the game. Grep this file for a file name; don't read it whole.

## How to read the big files cheaply

- Five design docs are huge only because they carry pasted images (`data:image` lines). The text is 22–70 KB each. Read them with `grep -v 'data:image' FILE`, then grep headings (`grep -n '^#'`).
- `Overdrive Hyper Techno Supreme Z.md` (100 MB) is the same blueprint as `... (text).md` plus images. Always use the text copy. The repo copy is `docs/plans/hyper-overdrive-techno.md`.
- The `.zip` and `.rar` packs are Pokémon Essentials (RPG Maker XP, Ruby) plugins. None of their code runs in our browser game. They are **reference designs**: read a plugin's Ruby to see how a mechanic is meant to behave, then build our own version in `src/core` (TypeScript, no Phaser). List with `unzip -l` or Python `zipfile`/`rarfile`; never extract the 280 MB packs whole.
- Spreadsheets: open with `openpyxl` in read-only mode and print one sheet's header.

## Already in the repo (no action)

| File | Status |
|---|---|
| `Implementation Plan Electric (text).md` | Copied as `docs/plans/electric-plan.md`; its directive is CLAUDE.md's short form. |
| `Overdrive Hyper Techno Supreme Z (text).md` and the 100 MB version | Copied as `docs/plans/hyper-overdrive-techno.md`; M8.9 slices 1–4 and 6 are built from it. |
| `CHECKLIST.md`, `GAME_DESIGN.md`, `IMPLEMENTATION_PLAN.md` | **Older copies** of the repo files (the repo's are newer and longer). Ignore the shared copies. |
| `uploads/hearth/06e694e3-…` | The screenshot of the current to-do list (story slices 5–6, item effects 3b–4, features catch-up, transformation leftovers). |

## Design docs: new, not yet used

Order below is the recommended order to use them.

### 1. `A Living Rivalry Engine.md` (57 KB text) and `… Examples, Possibilities, and Guidence.md` (65 KB text)
- **What:** the full rival system. Five linked systems: how a rival is born (Spark, Slow Burn, Collision paths plus a Rival Potential score), personality archetypes with hidden beliefs, a Nemesis memory of past battles with fair counter-adaptation, rival promotion from nobody to Ultimate Rival, a rivalry graph between rivals, offscreen simulation and rumours, rival battle styles and aces, branching arcs, and how it all survives a roguelike run. The Examples doc is a menu: 30 rival paths, 40 personalities, 32 battle styles, a Trainer–Pokémon Bond engine, 40 offscreen Pokémon events, 36 character arcs, 24 advanced rival mechanics, and a Rival Chronicle.
- **Fit:** this is the M8.9 "rivals, nemesis" work the story foundation was built for (CHECKLIST says relationships have records but nothing creates them yet). It builds on slices 3 (Heated Rivalry) and 4 (This Trainer Will Return).
- **Plan:** slice A, one rival born by one path (Spark) with a personality and memory of the last battle, saved across stages. Slice B, the rival adapts fairly (counter-picks one move or Pokémon, telegraphed). Slice C, the Rival Chronicle screen (reuses the Story screen). Later: Ultimate Rival scoring, rival-to-rival graph, offscreen events. Use the Examples doc as a data menu (archetypes, styles) in a new `src/data/rivals.json`, not as code.

### 2. `The Battle Drama Engine.md` (27 KB text)
- **What:** enemy trainers talk during battle (on events like low HP, last Pokémon, crit), signature attacks get big presentation, mid-battle evolution, story-changing battle events, enemy teams react to your team, a battle has a dramatic arc, and "emergent battle memories". It ends with a 9-phase implementation directive.
- **Fit:** the presentation-cue layer and the battle event bus from the Electric plan. Pairs with rivals (rivals need lines).
- **Plan:** slice 1, battle event hooks plus a data file of trainer lines keyed by event and personality, shown as a banner (no RNG from presentation). Slice 2, signature-move presentation for bosses. Slice 3, mid-battle evolution as a Hyper moment. Reference: `Deluxe Battle Kit.zip` midbattle scripts (see below) show the same trigger list.

### 3. `PROGRESSION & ENCOUNTER BALANCING OVERHAUL.md` (11 KB) and `Pokemon_Spreadsheet.xlsx`
- **What:** an 11-phase plan: audit, centralize progression numbers, a Pokémon availability database, an Encounter Director, level and difficulty controls, a Combat Threat Rating, protection for random events, trainer/boss rebalance, automated simulation tests, and a balancing dashboard. The spreadsheet gives 1,025 species with rarity, difficulty 1–10, lowest/highest level, capture rate and BST.
- **Caution:** the spreadsheet's own notes say its levels and difficulty are **made up** by formula (from BST and capture rate). Rarity comes from capture rate. Use it as a starting suggestion, not truth.
- **Fit:** `balance.json`, `regions.json`, the encounter tables, and `docs/quality/BALANCE_REPORT.md`.
- **Plan:** one tool script (`tools/`) imports the spreadsheet into a validated `availability` field (rarity, min/max level) for each species, flagged as "suggested". Then an Encounter Director in `src/core` that reads it per stage. Then a simulation test that plays N seeded runs and reports level gaps.

### 4. `Untitled document.md` (64 KB): progression, economy, modes and content expansion
- **What:** a full proposal (marked "for director review"): item rarity and reward economy overhaul, a full catch comparison screen, fixed base stats, permanent vs run attributes, a common-NPC early game, special forms only from events, Starter Sets, more run prep, trainer signature Pokémon, settings, difficulty with reward multipliers, an optional Death-Block, a non-roguelike Adventure mode, game modes, daily/weekly/holiday events, per-Pokémon unlocks, more buildings, a permanent rewards catalog, data contracts and a roadmap.
- **Fit:** touches many decisions already made (D1–D16). Several items may conflict (for example fixed base stats, attribute split).
- **Plan:** top priority (decision 1 below); it wins conflicts with earlier decisions. Build in its §23 roadmap order, one slice at a time, and note each overridden earlier decision in GAME_DESIGN.md §12.

### 5. `Trainers.md` (32 KB): 220 trainer perks
- **What:** pros and cons for about 220 named trainers (for example "Aaron: Bug-types deal 20% more damage and gain 15% more EXP; take 10% more damage").
- **Fit:** the player trainer archetypes (`src/data/archetypes.json`, only 9 today, from GAME_DESIGN §3 and §14.3).
- **Plan:** convert to data with a script, each perk mapped to existing modifier kinds. Perks that need a new modifier kind get status "disabled pending implementation" in the content report rather than a fake version. Unlock them through achievements. Check balance with the simulation test from item 3.

### 6. `Blueprint_ Raids, Mega-Expeditions, Totem Pokémon & Minigames.md` (22 KB text)
- **What:** raids (tiers, 5-step flow, safeguards), Mega-Expeditions (multi-node expeditions with their own progression), Totem Pokémon (boosted encounters with allies), a minigame framework with reward balancing, a shared architecture, milestones and acceptance criteria.
- **Fit:** the Electric plan's "Raid & World Crisis" system and M9.5. Bosses already exist.
- **Plan:** after rivals and drama. Totems first (smallest: a boosted wild boss with a stat aura plus one ally call, which reuses SOS below). Then one raid tier. Expeditions and minigames last. References: `Raid Battles.zip` and `SOS Battles.zip`.

### 7. `POKEMON_ROGUELIKE_MASTER_EXPANSION_CATALOG.md` (48 KB) and `START_HERE.md`
- **What:** a feature library in 15 groups (battle drama, mid-battle transformations, wild Pokémon identity, bonds, rivals, world events, Shadow/Delta forms, bosses/raids, run pacing, progression, UI, audio, tooling, endgame, experimental), six feature combos, and a gated order (Gate 0 baseline → 1 truthful combat → 2 battle slice → 3 rival → 4 events → 5 boss/raid → 6 expansion). START_HERE explains the pack and warns about repo visibility.
- **Fit:** a backlog, not a spec. Its gate order matches this plan.
- **Plan:** use as the idea source when a slice needs more content. Re-check START_HERE's warning: the repo must stay private (D4).

### 8. Visual pack: `VISUAL_BIBLE.md` (43 KB), `COMPLETE VISUAL REMASTER.md` (22 KB), `CLAUDE_VISUAL_REVAMP_BRIEF.md` (7 KB), `VISUAL_REFERENCE_BOARD.html` (10 KB)
- **What:** one art direction (DS-era Pokémon look), design tokens, a battle screen overhaul, map/reward/shop screens, effects by type, motion rules, Phaser performance tips, an asset policy ("searching is not permission"), and phased gates. The Brief is the short prompt; the Remaster is the long directive; the board is a moodboard of external links.
- **Fit:** Milestone 10 (visuals). Hard rule in all of them: keep the Hub screens and Trainer selection screen untouched.
- **Plan:** one battle-screen vertical slice first (Brief Phase 2), checked with screenshots at several sizes. Board images are references only: never copy them into `public/assets`.

## Essentials plugin packs: reference code and possible assets

| File | What it is | How we use it |
|---|---|---|
| `[000_AAI] Advanced AI System.zip` (v2.7.2) | 47 Ruby scripts: move scoring, switch logic, prediction, threat assessment, role detection, speed/priority tiers, battle personalities, Mega/Z/Dynamax/Tera use, win conditions. | Design reference for "smarter enemy trainers" (screenshot item 3) and boss Z-Move/Dynamax use (item 4). Port ideas, keeping our AI deterministic with its own named RNG stream. Start with `Battle_Personalities` and `Switch_Intelligence`. |
| `Deluxe Battle Kit.zip` (DBK 1.3.1) | Base kit: midbattle triggers and scripts, wild boss attributes, Mega, Primal, Shadow, databox styles, a few SFX/BGM. | Midbattle trigger list is the checklist for the Battle Drama Engine. Shadow Pokémon rules for the catalog's Shadow forms. |
| `Enhanced Battle UI.zip` (DBK add-on) | Battler info panel, move info panel (with move-flag icons), Poké Ball UI, about 40 PNGs. | Layout reference for the visual battle slice. The 18 move-flag icons could be used if their licence allows (check credits). |
| `SOS Battles.zip` (DBK add-on) | Wild Pokémon call allies; PBS data for who calls whom. | Totem ally calls, and an optional SOS mechanic for wild battles. Its PBS tables are a ready list of call partners. |
| `Raid Battles.zip` (DBK 2.0.1, 49 MB) | Raid dens, raid shields, cheer actions, raid captures and rewards, plus a full "Adventure" mode: map tiles, rentals, Pokémon exchange, endless record, and 19 BGM tracks. | The closest working model for raids and Mega-Expeditions (the Adventure map is a raid run with branching tiles). Read `Raid Shield`, `Cheer Mechanics` and `AdventureMap` before designing ours. |
| `Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip` (280 MB) | A whole Essentials 21 game with Elite Battle DX: about 10,600 Pokémon graphics, 3,000 overworld characters, 1,500 SFX, 52 BGM, 206 battlebacks, 79 trainer sprites, 67 battle transitions, EBDX battle UI. | Asset source to fill gaps only (for example battle transitions, battlebacks, trainer sprites) after checking what the PokeRogue pack already has. Each imported file needs a provenance entry. Also a reference for EBDX's dynamic battle camera. |
| `Pokemon Essentials 21.1 UIE.rar` (194 MB) | Essentials 21.1 with UI Extensions: about 12,400 graphics, 960 audio, 121 plugin files, 82 PBS data files. | Same role as EBDX: gap-filling assets and UI layouts. Lower priority; the EBDX pack covers most of it. |

## Data workbooks

| File | What it is | How we use it |
|---|---|---|
| `pokemon_master_reference_expanded_2026-10-29.xlsx` | Built from **our own** repo data: all 1,618 species/form records with types, stats, abilities with provenance, evolution paths, type summary, and a "Data coverage" sheet listing gaps (TM/TR compatibility not split by game, move rows not expanded). | A readable audit of our data for Kice. Its gaps list is a to-do for the content report (TM compatibility per game). Not a new data source. |
| `Pokemon_Spreadsheet.xlsx` | See item 3 above. | Encounter availability suggestions. |

## Recommended order

This follows the current to-do list (screenshot), then adds the new docs.

1. Finish what's open: story slice 5 (A Past Pokémon Wants to Join), item effects 3b–4, features catch-up, transformation leftovers. Use AAI (`Battle_Personalities`, `Mega/ZMove/Dynamax_Intelligence`) for smarter trainers and bosses using transformations.
2. `Untitled document.md` (item 4, top priority per decision 1), following its own roadmap (§23). Start with the reward economy (§3), the catch comparison screen (§4) and fixed base stats (§5).
3. Encounter Director and balance simulation (item 3), seeded from the spreadsheet. This also gives the tool to balance Trainers.md perks (item 5).
4. Rivals (item 1), with trainer battle lines from the Drama Engine (item 2).
5. Visual battle slice (item 8), using Enhanced Battle UI as layout reference and Essentials graphics where they fill gaps.
6. Totems → raids → expeditions (item 6), using SOS and Raid Battles code as reference.

## Director decisions (Kice, 2026-10-30)

1. **`Untitled document.md` comes first.** Its proposals win where they conflict with earlier decisions (D1–D16), including fixed base stats and the permanent/run attribute split. Update GAME_DESIGN.md when a slice changes an earlier decision.
2. **Essentials-pack graphics may be imported, and this is recommended.** Prefer them for gaps (battlebacks, transitions, trainer sprites, UI). Keep a provenance entry for each imported file; the repo stays private (D4).
3. **The spreadsheet's levels are meant to be used** as the starting encounter levels and difficulty. Tune them later with the balance simulation.
