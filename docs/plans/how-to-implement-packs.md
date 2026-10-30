# How to implement the .zip / .rar packs

Companion to [how-to-execute-guides.md](how-to-execute-guides.md). All packs sit in `/mnt/project-files/` and are Pokémon Essentials v21.1 (RPG Maker XP, Ruby) material. Two kinds of use:

- **Code packs (Ruby plugins): reference only.** Read the Ruby to learn the mechanic, then write our own TypeScript in `src/core` (no Phaser, seeded RNG streams, Zod data). Never port line by line; never run Ruby.
- **Asset packs (PNG/OGG): import selected files** into `public/assets/` with provenance (Kice approved importing, 2026-10-30; repo stays private, D4).

How to look inside without extracting everything: `unzip -l "<pack>.zip"`, or `python3 -I -c "import zipfile…"`; for the .rar use `rarfile` (`pip install rarfile`, needs `unrar`/`bsdtar`). Extract single files with `unzip -p "<pack>" "<path>" > <file>` into a new empty folder under the scratchpad.

## Import recipe for assets (use for every pack below)
1. **Pick** files for one slice only (e.g. 10 battlebacks), list them in the PR.
2. **Convert** if needed. Essentials battlebacks are layered (`*_bg.png`, `*_base0/1.png`, `*_message.png`); look at one before choosing how to compose the arena. Audio: `.ogg` is fine, `.mid` is skipped.
3. **Name** under `public/assets/images/<group>/…` or `audio/<group>/…`; add entries to the asset catalog (`src/assets/catalog.ts` via the data it reads), then `npm run assets:manifest`.
4. **Record provenance**: source pack, original path, author/credits (from the pack's `meta.txt` or credits), licence note, date. Keep it in the existing provenance record (see `.claude/rules/data-rules.md`); a file without a provenance row doesn't ship.
5. **Check**: `npm run check`, one Playwright screenshot of the screen that uses it, no 404s in the console, size added to the repo (public/assets is already 250 MB, so import only what a slice uses; never the whole pack).

`tools/import-assets.ts` copies only what the catalog asks for from `images.zip/audio.zip/fonts.zip`. Extend it with a second input folder for these packs rather than writing a new importer.

---

## Code packs: what to read, what to build

| Pack | Read these scripts | Build in TypeScript | When |
|---|---|---|---|
| **[000_AAI] Advanced AI System** (v2.7.2, 47 files) | `Battle_Personalities`, `Switch_Intelligence`, `Move_Scorer`, `Threat_Assessment`, `Role_Detection`, `Setup_Recognition`, `Priority_Tiers`, `Speed_Tiers`, `Win_Conditions`, `Mega/ZMove/Dynamax/Terastallization_Intelligence` | `src/core/ai/`: a move scorer with named factors; switch logic; per-trainer personality flag (data); transformation-use rules so bosses use Z-Moves/Dynamax. Randomness only from a named AI stream. Slices: personalities+scorer → switching → transformation use. | Screenshot items 3 and 4 (next) |
| **Deluxe Battle Kit** (1.3.1) | `[002] Midbattle Triggers`, `[001] Midbattle Overwrites`, `[003] Deluxe Battle Rules`, `[004] Wild Boss Attributes`, `[007] Shadow Pokemon`, `[008] Databox Styles` | The trigger list becomes the **battle event bus** of the Battle Drama Engine (guide 4); wild-boss attributes feed Totems; Shadow rules feed Shadow forms; databox styles inform the status panels. | With Drama Engine |
| **Enhanced Battle UI** (DBK add-on) | `[003] Battler Info UI`, `[004] Move Info UI`, `[005] Poke Ball UI` | Layout ideas for the battle info/move info panels and catch panel. Its 18 move-flag icons (`Graphics/Plugins/Enhanced Battle UI/Move Flags`) can be imported (recipe above) for the move picker. | Visual battle slice |
| **SOS Battles** (DBK add-on) | `[004] Battle`, `[005] Battle_Battler`, `PBS/Plugins/[DBK] SOS Battles/*` (call tables) | "Call for help" wild battle capability: ally joins mid-battle with a call chance that grows each turn. Reused by Totem allies. Call-partner table becomes `src/data/sosCalls.json`. | With Totems |
| **Raid Battles** (2.0.1) | `Raid Shield`, `Raid Counters`, `Cheer Mechanics/Handlers/AI`, `Raid Captures`, `Raid Rewards`, `Den Events`, `AdventureMap/Tile/Traversal`, `Rentals`, `Endless Record`, `Adventure Spoils` | Raids (guide 6 M3): shield HP, phase triggers, counters, cheers (player support actions), capture after win, rewards. The Adventure map (tile grid, rentals, exchange, spoils, endless record) is the model for **Mega-Expeditions** (guide 6 M5). | Guide 6 |

## Asset packs: what to take

| Pack | Take | For | Notes |
|---|---|---|---|
| **Pokemon-Essentials-21-With-Unofficial-EBDX** (280 MB) | `Graphics/Battlebacks` (204 files), `Graphics/Transitions` (66), `Graphics/Trainers` (78 class sprites), `Graphics/UI` (battle/party UI), `Graphics/Weather`, selected `Audio/BGM` (50) and `Audio/SE` | Visual battle slice: arenas, battle intros, Common-NPC class art (first check what `public/assets/images` already has), weather, music | Don't take `Graphics/Pokemon` (10,655 files): we already have species sprites. `Graphics/EBDX` (1,155) holds move/ball effects for a later effect-pipeline slice. |
| **Pokemon Essentials 21.1 UIE (.rar)** (194 MB) | Only what EBDX lacks: windowskins, title/UI pieces, fonts | UI polish | Lower priority; check EBDX first. |
| **Deluxe Battle Kit** | `Graphics/Plugins/Deluxe Battle Kit/Databoxes`, Mega/Primal icons, 3 SE, 1 BGM | Status panel styling, transformation cues | Small. |
| **Enhanced Battle UI** | 18 move-flag icons + selection UI pieces | Move picker | Small. |
| **Raid Battles** | `Audio/BGM` (19 raid tracks), `Graphics/Battlebacks` (13 raid arenas), `Graphics/Plugins/Raid Battles/Raid Dens` and `Adventures/Tiles` (map tiles/icons) | Raid music and arenas, expedition map tiles | Take when guide 6 reaches M3/M5. |

## Order of use
1. AAI as reference for the "smarter trainers" and boss-transformation slices (now).
2. Battlebacks + transitions + UI + trainer sprites from EBDX for the first visual battle slice (guide 9 phase 2), with Enhanced Battle UI as layout reference.
3. DBK midbattle triggers when building the Battle Drama Engine event bus.
4. SOS + Raid Battles code and assets when building Totems, then raids, then expeditions.
