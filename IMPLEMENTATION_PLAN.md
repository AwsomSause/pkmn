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
| M5 ✅ | **Out-of-Run** (GAME_DESIGN §14, director priorities 1–2). Hub, Bank with Bank Credits and duplicate-proof run-end payout, bank tiers, Trainer Archive with data-defined unlocks, Achievement Hall with event tracking and tiered/hidden achievements, Run History, Research Points from discoveries, save export/import. One unlock architecture: requirement → progress → reward → claim. | M4, D10–D12, D16 | Runs feed a permanent profile; earn credits, achievements and new trainers. |
| M5.5 ✅ | **Run-Prep** (GAME_DESIGN §14, director priorities 3–4). Starter pools in data and the Starter Laboratory, draft modifiers, the Run-Prep flow (mode → trainer → preparation → build summary → starters → briefing), loadout presets, preparation tokens, seed copy. | M5 | Prepare each run deliberately before it starts. |
| M6 ✅ | **Content scale-up.** Data import for all species/moves, region eligibility, sprite/cry manifest at scale, lazy-loading audio, evolution rules. | M2 (can run alongside M3–M5) | Full Pokédex available. |
| M7 ✅ | **Attributes & luck.** Implement each attribute only after you approve its formula; luck-weighted rewards; shiny rules. | M5, D8, D9 | Attributes visibly matter. |
| M8 ✅ | **Custom Pokémon and forms** (director request, 2026-10-25): the director's sprite pack of Pokémon Insurgence Delta species, Z-Forms, Spooky forms and new Megas, with types, stats, evolutions and learnsets (§6i). | M6 | Over 300 new Pokémon and forms to meet, catch and evolve. |
| M8.5 | **Advanced mechanics**, one at a time: Mega → Tera → Z-Moves → Dynamax → regional forms. (Was M8; renumbered by the director, 2026-10-25.) | M6, M7, M8 | Key items unlock real mechanics, including the new Megas. |
| M8.6 | **Systems audit and quality gates** (Electric plan, 2026-10-25). `SYSTEMS_AUDIT.md`, `FEATURE_INTERACTION_MATRIX.md`, `QUALITY_GATES.md`, a content report command (counts and offending ids for unsupported moves, unusable species, missing assets, unreachable map nodes, duplicate boss teams, broken evolutions, unused balance settings, untested save upgrades), a support status on every content entry, battle simulations for balance, CI checks that fail when a number gets worse. | nothing | We can see exactly what works and what does not. |
| M8.75 | **Planned features catch-up** (director request, 2026-10-25): everything planned but not yet in a milestone (§6j). Event system and new map stops (special encounters, events, trades, detours, rare Pokémon), friendship and "Between-Level" interactions, the unsupported moves, abilities and held items, Bank tiers, the other licenses, challenge modifiers, contracts and spending candies, Pokédex & Research and starter mastery, Cynthia and the D12 trainers, party-strength difficulty, levels up to 500 and custom regions. | M7, M8 (M8.5 for anything that touches Megas or Z-Moves) | Every planned system has a home; the run gets events, side stops and relationships. |
| M8.9-0 | **Story foundation** (Electric plan, §6k). Domain event bus on top of the battle events, per-Pokémon history, relationship and enemy records, run chronicle, event queue with priorities and per-battle budget, effect ids so nothing applies twice, `story` and `hyper` RNG streams, save upgrade, debug Story Log. | nothing (can run alongside M8.5 and M8.75) | Every battle and choice is recorded; the run-end screen shows the run's top moments. |
| M8.9 | **Story systems** (Electric plan and the Hyper/Overdrive/Techno blueprint, §6k): rival trainer and Pokémon rivalries, nemeses, Hyper moments and Overdrive, the Seven Emotions, mentorship (Protégé), team chemistry, grudge and respect, promises, wild recognition, Legacy card and Chronicle. Designed with the director first. | M8.9-0, M8.75 C and A | Runs become stories: rivals and nemeses remember you, Pokémon have moments and memories. |
| M8.95 | **Raids and Grand-Enemies** (§6k): multi-phase raid battles, the regional crisis meter, the campaign Grand-Enemy, the Rival Tournament Circuit. | M8.5 (Dynamax), M8.9 | Big set-piece battles that change the campaign. |
| M9 | **Grand Region, ending, polish, deploy.** Battle animation player for the supplied anim JSON, music, final boss, ending, static deploy. | All, D1, D4 | Complete game from start to credits. |
| M9.5 | **Spectacle pass** (Electric plan): boss intros and cinematics, cut-ins, dynamic music layers, transformation scenes, event staging, victory sequences, regional recaps. All driven by game-state cues, never deciding outcomes. | M9, M10 style | Big moments look and sound big. |
| M10 | **Visuals and presentation** (director request, 2026-10-25). Purely about looks: make every screen stunning and consistent. A shared visual style (palette, fonts, window frames from the asset pack's `ui/` art, spacing); redesigned menus, Hub, Preparation Desk, map, battle and reward screens; scene transitions and small animations (cursor, cards, HP and EXP bars, level-up and catch effects); battle backgrounds per theme; readable layouts at every screen size; a final pass for clipped or overlapping text. No gameplay changes. | M9 (can start earlier, screen by screen, once a screen's features are stable) | The whole game looks finished and well put together. |
| M11 | **Legacy and live systems** (old M8.75 part H, moved by the Electric plan): Hall of Fame with Legacy cards and Chronicles, Research Laboratory, Training Center, Contract Board upgrades, Berry Garden, Prestige, Legacy runs, Rival Ghosts, reunions with Pokémon from earlier runs, trainer mastery, collection goals, shared seeds, hub upgrades. Online play and cloud sync stay separate projects. | M8.9 (for reunions and ghosts) | The Hub grows with everything you achieve. |

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

## 6b. Milestone 2 — battle completeness

**Built 2026-10-25.** What changed from the M2 row above, and why:
- **Standard level-up evolution (D15) was pulled forward from Milestone 6.** Levelling up and Rare Candies made Pokémon reach their evolution levels, so leaving evolution out would have felt broken. The 20 prototype species gained their evolved forms (41 species total). Stone evolutions (Vulpix, Growlithe) wait for items in a later milestone.
- **Trainer battles appear every 4th encounter** as a placeholder schedule until the stage map (M3) decides where trainers go. Trainer classes, names, and team pools live in `trainers.json`; team size grows from 1 to 3 with progress. Trainers' Pokémon arrive already evolved for their level.
- **Replacing a party member gives no candies; releasing the caught Pokémon does** (1 + 1 per 10 levels, in `balance.json`). Candies go to the profile when the run ends (D7); spending them is a later milestone.
- **Healing is now items.** Potions and the other healing rewards go into the Bag instead of applying instantly, so the player decides when to use them (in battle, or on the reward screen).
- **Shinies (D8, 1/2000)** roll for wild Pokémon and use the shiny sprites from the asset pack.
- Save format is now version 2 for the run and the profile. Version 1 saves upgrade automatically.

## 6c. Milestone 3 — one full stage

**Built 2026-10-25.** What changed from the M3 row above, and why:
- **Stage themes (director rule).** Every stage is themed after one of the 153 type pairs (GAME_DESIGN.md §5b). The theme picks the wild Pokémon, trainer classes and team members, and the gym leader.
- **48 species and 48 moves were pulled forward from Milestone 6.** The original 41 species had no Ice, Psychic, Dragon, Dark or Fairy Pokémon, so many themes would have been empty. The new species use official base stats, types and growth rates. Every type now has wild Pokémon.
- **Level-up moves come from the director's move dataset** (the SortedMoveset sheet, one merged list per Pokémon). `npm run data:movesets -- <SortedMoveset.html>` rewrites the learnsets in `species.json`, leaving out moves the game doesn't support yet and listing them (199 moves after the move list below, led by Fury Swipes, Taunt, Assurance). When a Pokémon's list has no supported level-1 move, its earliest supported move is moved to level 1 (9 species, e.g. Growlithe's Bite). Its egg moves and full learnable lists are kept for later milestones.
- **Moves come from the director's move list** (a saved pokemondb.net move table with power, accuracy, PP and a one-line effect). `npm run data:moves -- <pokemon_moves_list.html>` adds every move whose effect the battle engine can already run: plain damage, stat changes, status, flinching, draining, recoil, priority and high critical-hit ratio. That brought the game from 94 to 323 moves. About 530 moves need new engine features first (multi-hit, recharge, two-turn moves, confusion, healing, weather, protection and so on) and are listed by the tool. Recoil amounts and +2 priority aren't in the list's text, so a small table in the tool holds the official values.
- **Trainer pools were replaced by theme pools.** `trainers.json` now gives each class its speciality types (11 classes were added so every type has one). 70 gym leaders (Kanto to Paldea) are in `gymLeaders.json`, with their sprites from the asset pack.
- **The "trainer every 4th encounter" placeholder is gone.** The stage map places the two trainer columns.
- **Wild Pokémon are always first-stage species** (nothing in the data evolves into them). Trainers' Pokémon still arrive evolved for their level.
- **Difficulty:** `round(baseLevel + levelsPerColumn × columns travelled) ± variance + archetype offset + bonus` (trainers +1, gym +3, the gym's last Pokémon +1 more, harder routes +1–2). With `levelsPerColumn` 0.65 the first gym's ace is about level 20. This straight line would pass level 100 around stage 8, so it needs a per-region curve when regions arrive (M4, together with D14). The debug panel shows the breakdown for every enemy.
- **Heal stops** fully heal the party and PP, once. One always sits in the column before the gym. **Shops** sell 8 items at placeholder prices (`shop.json`) and can be revisited.
- Save format is now version 3 for the run. A version 2 run keeps going and gets its first stage map after its next reward.

## 6d. Milestone 4 — one full region and the developer campaign

**Built 2026-10-25.** What changed from the M4 row above, and why:
- **Regions are data.** `regions.json` lists each region's gym leaders, Elite Four and champions; `league.json` holds the 38 Elite Four members and 13 champions with their speciality types and sprites from the asset pack. Alola has no gyms, so its stages borrow unused leaders from anywhere. The Grand Region has no roster yet and does the same; its final boss and ending stay in M9.
- **Campaign shapes live in `balance.json`** (`campaigns`): the full campaign (9 shuffled regions + Grand, 8 stages of 20, Elite Four of 4) and the dev campaign (2 regions, 2 stages of 5, Elite Four of 2). The stage map's column count and trainer columns moved there from `stage`.
- **Difficulty was replaced** (the M3 straight line passed level 100 around stage 8). Now each region climbs from the previous region's cap (level 4 in the first) to 5 under its own cap, fast at first then levelling off: `start + (end − start) × progress^0.6`, with the same variance, archetype offset and bonuses as before (Elite Four +2, champion +4). The first gym's ace is still about level 20; the first champion's ace is 50.
- **Level cap (D14):** 50 × region number, stopped at 100. Experience and Rare Candy-style rewards stop at the cap. From the third region on everything is level 100 until D14 is answered.
- **Repeats:** a full run has 80 gyms and 40 Elite Four slots, but the data has 70 gym leaders and 38 Elite Four members (D6 says never repeat). When everyone has been used, the last regions reuse people. More trainers in the data fixes this.
- **Boss teams (director request).** `gymLeaders.json` and `league.json` were folded into `bosses.json` (229 bosses, any role). `tools/build-boss-teams.ts` builds 36 teams per boss into `bossTeams.json` (one line per team: `"species / moves / training"`). Teams are fixed data, levels still come from the curve. Boss battles store an `ai` value in the battle state (saves without it read as 0). The repeat problem above is gone: 229 bosses cover a full run's 130 boss battles.
- **The league gives no badges.** Elite Four and champions pay more prize money (`eliteFourPerLevel`, `championPerLevel`) and use the boss reward odds.
- Save format is now version 4 for the run. A version 3 run becomes region 1 of a full campaign and gets its shuffled region order when it is next loaded.

## 6e. Milestone 5 — Out-of-Run progression

**Built 2026-10-25.** Scope is the director's first package, priorities 1–2 (GAME_DESIGN.md §14). Run-Prep (priorities 3–4) is M5.5. What changed, and the interpretations I made:
- **The main menu leads to the Hub** instead of straight into a new run. Starting a run is now a Hub room. Continue still works from the main menu.
- **One unlock shape for everything:** requirement → progress → reward → claim (`src/core/progress.ts`). Requirements are data (`total`, `best`, `distinct`, `achievement`) over counters the run keeps in `run.log.counters`; the profile adds them up when the run ends.
- **Achievements are checked when a run ends,** not live during the run. 31 achievements in `achievements.json`, 2 of them hidden.
- **Four currencies (D16):** Poké Dollars (run only), Bank Credits (savings + stipend at run end, achievements, spent on trainers), Research Points (new species seen or caught, shinies; spent in M5.5's Starter Laboratory), candies (unchanged).
- **The developer campaign pays Bank Credits but doesn't count** toward achievements, unlocks, Research Points or species (`countsForProgress: false`), so testing can't unlock things.
- **"Clear a region without a party wipe" (Brock)** is read as "without the Last Stand Charm saving you", because a wipe already ends the run here.
- **Misty's unlock** is read as 13 boss wins in one run with a Water-type leading.
- **Cynthia** is listed as "coming later": her passive needs systems that don't exist yet. **Oak and N** are left out until they have sprites (conflict C12).
- **Run History** keeps the last 20 runs (`runHistorySize`).
- **Save export/import** writes the profile and settings to a file; import checks the file and keeps a backup of the old profile in local storage.
- Save format is now profile version 3 (Bank currency renamed to Bank Credits, new fields) and run version 5 (new log fields). Older saves upgrade automatically.

## 6f. Milestone 5.5 — Run-Prep

**Built 2026-10-25.** Scope is the director's priorities 3–4 (GAME_DESIGN.md §14.5, §14.7). What changed, and the interpretations I made:
- **The run now starts in four steps:** trainer → **Preparation Desk** → starters → **campaign briefing**. The design lists the campaign mode as a separate first step; it is a row on the Preparation Desk instead (only the full campaign counts, and the dev campaign shows only in testing), so starting a run stays quick.
- **Starter pools are data** (`runPrep.json`): Classic (the 12 starters from before, from the start), Johto, Hoenn, Research, Rare and Grand. Pools are bought with Research Points in the **Starter Laboratory**; some also need an achievement or a license. Pools may list species that aren't in the game yet: they're skipped, and a pool with fewer than three shows "arrives with the full Pokédex". That way the Johto, Hoenn and Grand starters appear by themselves when Milestone 6 imports them. `balance.starterPool` moved here as the Classic pool.
- **Draft rules:** Standard, Balanced (no shared types), Blind (hidden until chosen) and Type Focus (needs a license). A rule the pool can't meet fills in at random and says so on the starter screen: it never rerolls forever. Standard draws exactly what the old game did for the same seed, so old seeds still replay.
- **Preparation tokens:** one per run, chosen on the desk. They are unlocked once and can be chosen again on later runs, not used up. There are three: Pocket Money (first win), Ball Bundle (first catch) and Field Kit (Field Medic License).
- **Bank licenses** (bought once with Bank Credits): Type Specialist (Type Focus rule), Field Medic (Field Kit) and Research (Research pool). Scavenger, Fortune, Survival and the Bank tiers wait for the systems they change (events, reward modifiers, defeat prevention, catalogs).
- **Loadout presets:** 3 slots (`presetSlots`) storing the trainer and preparation. A preset that refers to something no longer unlocked is reset to the default and the change is shown before the run starts. The desk also remembers the last run's choices.
- **Run Build Summary** on the desk; the **briefing** shows the region order, first stage, starting resources, rules and seed, with a Copy seed button. A custom seed can be typed on the desk (`?seed=` still works).
- Left for later: Expanded Research / Regional / Evolution Specialist draft rules, starter mastery, starter events, challenge modifiers (priority 6) and Bank tiers.
- Save format is now profile version 4 (pools, licenses, presets) and run version 6 (the run's preparation). Older saves upgrade automatically, and an older run counts as Classic + Standard with no preparation.

## 6g. Milestone 6 — content scale-up

**Built 2026-10-25** (alongside M5). What changed from the M6 row above, and why:
- **All species and forms from PokeAPI's open data** (`npm run data:species -- <move dataset folder> <images.zip> <audio.zip>`; the CSVs are downloaded into `.cache/pokeapi`). 1,289 entries: 1,025 species, 57 regional, 52 alternate, 97 Mega, 34 Gigantamax, 2 Primal and 22 battle-only forms. Ids are PokeAPI's (`raichu-alola`, `rotom-wash`); old ids are unchanged. Cosmetic forms with identical stats (Unown letters, Vivillon patterns, Koraidon's builds, …) are left out. New species fields: `generation`, `evolvesFrom`, `tags`, `form`, and `assets` now holds file names (sprite, icon, cry) because forms don't follow the dex number.
- **Level-up moves still come from the director's sheet**, now kept whole: moves the engine can't run stay in learnsets and are skipped at runtime (`isUsableMove`). This replaces `npm run data:movesets`, which dropped them. Forms the sheet doesn't list use their base form's moves. Egg and other learnable moves go to `learnables.json` for tools (the boss team generator); the game doesn't load it.
- **Every move is imported** (`npm run data:moves`): 611 moves get `supported: false` and `needs` (the effect text still to build). Priority and missing categories come from PokeAPI. Re-running the tool after the engine learns an effect switches those moves on.
- **Evolution rules** (GAME_DESIGN.md §5c): evolutions are `{to, level}` or `{to, item}` with optional `region` and `condition`. Non-level methods became 44 evolution items. This was a design decision made here (the main games' trade, friendship and location methods don't exist in a roguelike); it is easy to change in the import tool.
- **Region eligibility** is a weight, not a filter: themes need every species they can get, so native Pokémon are 3× as likely (`nativeWeight`) rather than exclusive. Regions list their `generations` in `regions.json`. Applied to wild Pokémon and ordinary trainers; bosses get their own teams (boss teams work).
- **Wild Pokémon** now follow `isWildEligible` (stage 1, not legendary/mythical/special forms, base stats ≤ `wildMaxBaseStats` 560, has supported moves) instead of "nothing evolves into it", which would have hidden Pikachu (Pichu evolves into it).
- **Assets at scale:** `public/assets` grew from 32 MB to about 205 MB (every species' 4 sprites, icon and cry, about 13,000 files). Pokémon assets are marked `lazy` in the catalog: the boot screen no longer loads them; each screen queues the Pokémon it shows in `preload()`, and anything else is fetched the first time it is drawn (`ui/lazyAssets.ts`). Cries are lazy too and now play in battle.
- **No save format change.** Old saves keep working: species ids are unchanged and new fields live in the data, not the save.

## 6h. Milestone 7 — attributes and luck

**Built 2026-10-25.** The formulas and growth rules are in GAME_DESIGN.md §9; the numbers are in `balance.json`.
- **Eight attributes:** six plain (0–100) and two meters (−100–100). The profile's attributes are recomputed from lifetime counters whenever a counting run ends (`permanentAttributes`); a run copies them at the start (`baseAttributes`) and adds `attributeModifiers` from rewards and shop items.
- **New counters:** `defeatedOrCaught.<type>` (every enemy fainted or caught, by each of its types) and `statsBoosted` (stats your Pokémon raise on themselves), plus a few general ones (`encountersCompleted`, `moneySpent`, `healStopsUsed`, `caughtKept`, `caughtToCandies`, `regionsClearedWithStarter`).
- **Where effects apply:** battle damage and turn order (engine), catching, healing, shop prices, experience, prize money, the reward draft's rarity weights and the shiny roll. Love adds an `endure` battle event.
- **Attribute sources:** 11 draft rewards and 9 shop items (effect `attribute`, used when bought). Special encounters and "Between-Level" interactions need an event system, planned for Milestone 8.75.
- **Screens:** an Attributes room in the Hub (values, effects, how each grows), an Attributes line on the Run Build Summary and the Briefing, and attribute changes on the run-end screen.
- **Save format:** profile version 5 and run version 7; older saves upgrade automatically (attributes start at 0 and are recomputed at the next run end).

## 6i. Milestone 8 — custom Pokémon and forms

**Built 2026-10-25.** The director supplied sprites only (`new_sprites.zip`, a copy is in the project files under `sprites/`); this milestone gives them data. The original M8 (Advanced mechanics) is now M8.5, by the director's choice.
- **Generator:** `npm run data:custom -- <new_sprites.zip>` (`tools/import-custom-forms.ts`, with `tools/convert-custom-sprites.py` for the art). Output is kept apart from PokeAPI's data: `src/data/customSpecies.json`, plus `customEvolutions.json` for new evolutions of existing species (Raticate → Bruticate, Mightyena → Alphayena, and Z-Form branches such as Electabuzz → Z-Electivire). The game merges them when it loads (`mergeSpecies`).
- **Insurgence Deltas (255 entries):** the zip's Insurgence sprites are numbered like Insurgence's Pokédex (727 Delta Bulbasaur … 924 Delta Hoopa, `tools/insurgence-order.json`). Types, stats, evolutions and level-up moves come from Insurgence's own data (the Insurgence Showdown project, MIT). Insurgence-only moves the game doesn't have are dropped (10). Includes 22 Delta Megas, five battle-only forms, 17 Delta Ditto type forms and 12 designed extras (Delta Muk's cages, Delta Snorlax's seasons, Shadow Delta Liepard, Delta Elgyem).
- **Designed here (74 entries):** 31 Z-Forms (including two new species, Bruticate and Alphayena), 28 Z-Megas (24 "M-" sprites, Z-Mega Dragonite, and Z-Mega Alakazam, Gengar and Steelix), and 15 Spooky forms. Designs are in `tools/custom-forms.json`; rules in GAME_DESIGN.md §5d.
- **Art:** every sprite becomes a one-frame atlas in `images/pokemon/**/custom/`; Insurgence's double-size sprites are halved; a missing shiny uses the normal sprite and a missing back sprite the mirrored front. Pokémon without an icon use Minior's (director rule).
- **Tags:** `delta`, `zform`, `spooky`. First-stage forms (120) can be met in the wild like regional forms; Megas and battle-only forms wait for M8.5.
- **No save format change.**

## 6j. Milestone 8.75 — planned features catch-up

**Planned 2026-10-25** (director request: "pull everything that has been planned but not put into a Milestone and create a new milestone to use before M9"). Collected from the director's Master Development Brief and Design Decisions, the Out-of-Run/Run-Prep design (GAME_DESIGN §14), every milestone's "known limits", and every project thread. Work that already has a milestone stays there: Mega/Tera/Z-Moves/Dynamax in **M8.5**; the Grand Region roster, final boss, ending, battle animations, music and deploy in **M9**; looks in **M10**. The parts below can ship as separate pull requests, in this order: B to H first, then A last.

**B. Friendship and "Between-Level" interactions** (M7, brief §11 Love). *Friendship, Charisma's bonus and friendship evolutions built 2026-10-25 (GAME_DESIGN.md §5e); the interactions and N wait for part A.*
- A **friendship** value on each Pokémon, raised by battling, healing, items and interactions.
- **Charisma raises friendship gain** (director's M7 doc). Love and friendship work together.
- **"Between-Level" interactions:** between levels on the map you can spend time with a Pokémon (feed, train, play, talk). These can change attributes and friendship. Like events, they are designed with the director in the plan sheet and built last, with part A.
- **Friendship evolutions** by real friendship, with the Soothe Bell kept as a shortcut.
- **N's** friendship passive and alternate event outcomes (needs N's sprite).

**C. Battle engine gaps** (brief §6/§8, M1–M6 known limits)
- The **611 unsupported moves**, in tiers: confusion, multi-hit, recharge, healing and drain, Protect, weather and terrain, then the rare ones. Each tier makes more Pokémon learnable (Ditto, Smeargle, Unown, Cosmog and Abra come back).
- **Abilities**, then **held items** (also as a reward category, brief §8).
- Smarter enemy trainers: they use items and switch on purpose.
- Small rule fixes: main-game damage rounding; the "both faint in the same turn" rule.

**D. Bank, licenses, challenges and candies** (GAME_DESIGN §14.2, priority 6; D7)
- **Bank tiers 1–5** (services, not multipliers).
- The other licenses: **Scavenger, Fortune, Survival**.
- **Challenge modifiers** with their difficulty and reward shown before you confirm, and **challenge campaigns**.
- **Daily/weekly contracts** and the Contract Board.
- **Permanent item catalog**, Emergency Reserve, Exchange Counter, Collector's Vault, Regional Accounts, Loan Challenges, savings milestones with titles.
- **Spending candies** (D7: trainer unlocks, starting buffs). Candies are earned today but can't be spent.
- More preparation tokens (first-region intel, an item category in the reward pool, better odds for a starter type).

**E. Starters, Pokédex and research** (§14.5, priority 5)
- The **Pokédex & Research** room and the Research panel (encountered, caught, forms, shinies, used against bosses).
- **Starter mastery** per species, plus trainer **mastery tracks** (badges, titles, portraits, never combat power).
- The remaining draft rules: **Expanded Research, Regional Research, Evolution Specialist, Rare Specimen**.
- **Starter events** from species tags; legendary and mythical starters in a **Special Specimen** category.
- Achievements checked the moment they happen, not only at run end.

**F. Trainers** (D12, §14.3)
- **Cynthia's** passive (boss team intel before battle), so she leaves "coming later".
- **Professor Oak** and **N**: sprites supplied 2026-10-25 and both are listed in the Archive as "coming later". Oak needs the encounter preview, N needs friendship (part B).
- The D12 trainers with unlock conditions and pros and cons: **Gold, Silver, Crystal, Brendan, May, Wally, Dawn, Lucas, Barry, Looker**. Each one is proposed to the director before it is built.
- **Trainer Research** (backgrounds, dialogue, special events).

**G. Difficulty and open rules** (brief §10, D6, D14, M7)
- **Party-strength correction** in the difficulty model (brief §10: judge the whole usable party, so weak parties don't spiral). Today enemy levels follow only the region curve, route and archetype.
- **Levels above 100, up to 500** (D14, director 2026-10-25): stats, experience curve, level caps (+50 per region) and boss levels past 100, a 500 maximum in `balance.json`, and a save upgrade.
- **Custom regions** (D6, left to me by the director): new regions added to the pool so each run draws its 9 regular regions from a bigger list. First proposal: **Torren** (Pokémon Insurgence's region, where Delta Pokémon are native), plus a Z-Form region and a Spooky region, each with its own native forms and boss roster. Designs shown to the director before they're built.

**H. Later Out-of-Run systems** (§14.6, §14.8, priorities 7–8). **Moved to M11** by the Electric plan (2026-10-25).
- Trainer Wardrobe and hub upgrades, Battle Records and Hall of Fame, Berry Garden, Move Research and Training Center, Regional Intelligence Board, Permanent Item Museum, Research Laboratory and Research Tree.
- Prestige and Legacy, Legacy Records, Trainer Network, Rival Ghosts, shared seeds.

**A. Events and new map stops** (brief §7 and §9). **Built last** (director, 2026-10-25): we design these together first in the [Events and map stops plan](https://claude.ai/artifact/9fzXqgbmnewMsN97HKxS31), with PokeRogue's Mystery Encounters as the reference. Only rows the director approves there get built.
- An **event system** in data: an event has a trigger, text, choices, requirements (attributes, items, party) and outcomes (items, money, Pokémon, attribute changes, map changes). Seeded like the rest of the run.
- New optional map stops beside heal and shop: **special encounters**, **events**, **trades**, **detours** (a short side path with its own risk and reward), **rare Pokémon** and other discoveries. Route choices can change their odds.
- Special encounters and events can **change attributes** (director reminder, M7).
- Merchants, including **Giovanni's black market**.

**Optional, only if the director wants them:** IVs/EVs/natures (D2 left them out "for now"); gender, time of day and weather, so evolutions that need them work without the §5c stand-in rules.

**Answered by the director, 2026-10-25:** levels go above 100 with a cap of 500; Peace and Charisma were left to me (now half a percent per point, built in PR #12); custom regions were left to me; Oak's and N's sprites were supplied. Part H became M11 (Electric plan, 2026-10-25).

## 6k. The Electric plan: story systems and spectacle

**Planned 2026-10-25** from two director files: "Implementation Plan Electric" and "Overdrive Hyper Techno Supreme Z" (text copies in `docs/plans/`). The full expansion of every idea, with proposed numbers, is the Claude Doc [Electric plan: expanded roadmap](https://claude.ai/artifact/JuBS4mwazHULE8fuM1uKac); the director approves the open choices there before M8.9 starts. Summary:

- **Order:** M8.5 transformations, M8.6 audit, M8.75 engine and systems, M8.9-0 story foundation, M8.9 story systems, M8.95 raids and Grand-Enemies, M9 Grand Region and full campaign (with a Campaign Director: five acts per region), M9.5 spectacle, M10 visuals and release, M11 legacy and live systems.
- **Running in parallel from 2026-10-25:** M8.5, M8.6, M8.9-0 and the M9 battle animation player, beside M8.75 C, the item effects work and the M10 redesign.
- **Story foundation (M8.9-0):** domain events, commands, effects with ids (applied once), presentation cues the core never reads, and persistence rules. Records: PokemonHistory, RelationshipRecord, EnemyProfile, RunChronicle, EventQueue, each with a size limit.
- **Hyper and Overdrive:** data-driven moments (`hyperEvents.json`, 14 fields), the Seven Emotions tied to attributes, enemy Overdrive with telegraphs and counters, a per-battle budget, no stacking combat buffs.
- **Techno:** rival trainer, Pokémon rivalries, nemeses (3 appearances at most), raids (three HP segments, shields, assists instead of double battles), mentorship, one Grand-Enemy per campaign, plus Legacy card, Chronicle, Grudge and Respect, Sacrifice, Comeback, Promise, Wild Recognition, Team Chemistry, Retirement and Reunion.
- **Battle stack:** mechanics, feedback, transformations, boss spectacle; every move gets a separate presentation definition for the animation player.
- **Working rules:** `CLAUDE.md` holds the director's development directive for every session.

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
