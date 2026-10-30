# Asset provenance

Every file imported from the director's packs, where it came from and why. A file without a row here doesn't ship (packs guide, step 4). The repo stays private (D4); these packs are Pokémon Essentials community resources built on Nintendo/Game Freak material, credited below. Importing was approved by the director on 2026-10-30.

Older assets (species sprites, arenas, PokeRogue UI, audio) come from the PokeRogue packs (AGPL-3.0 code, Nintendo material) imported in M0–M9; see `tools/import-assets.ts`.

| Repo path (`public/assets/…`) | Source pack | Original path in the pack | Credits | Used by | Added |
|---|---|---|---|---|---|
| `images/packs/ebdx/ui/types2.png` | Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip | `Graphics/EBDX/Pictures/UI/types2.png` | Elite Battle: DX (Luka S.J. and EBDX contributors) | Move picker type label | 2026-10-30 |
| `images/packs/ebdx/ui/category.png` | same | `Graphics/EBDX/Pictures/UI/category.png` | same | Move picker category icon | 2026-10-30 |
| `images/packs/ebdx/ui/status.png` | same | `Graphics/EBDX/Pictures/UI/status.png` | same | Databox status icon | 2026-10-30 |
| `images/packs/ebdx/elements/{cloud1,cloud2,bubble,snow,star,sun,lightA,lightB,fog}.png` | same | `Graphics/EBDX/Battlebacks/elements/<name>.png` | same | Arena ambience (`src/ui/battleFx/ambience.ts`) | 2026-10-30 |
| `images/packs/ebdx/elements/bubbleDark.png` | same | `Graphics/EBDX/Battlebacks/elements/bubbleDark.png` | same | Poison ambience | 2026-10-30 |
| `images/packs/ebdx/transitions/{ball,outdoor,indoor,vs,vsBar,glow,shine2}.png` | same | `Graphics/EBDX/Transitions/Common/<name>.png` | same | Battle intro wipe and VS screen (`battleFx/spectacle.ts`) | 2026-10-30 |
| `images/packs/ebdx/transitions/vs_{background,layer}{,Evil,Skull}.png` | same | `Graphics/EBDX/Transitions/Default/<name>.png` | same | VS screen backgrounds (trainer / rival / boss) | 2026-10-30 |
| `images/packs/dbk/{burst,shine,particle,pulse}.png` | Deluxe Battle Kit.zip (v1.3.1) | `Graphics/Plugins/Deluxe Battle Kit/<name>.png` | Lucidious89 | Ambience particles; burst/shine/pulse = transformation, evolution and catch reveal | 2026-10-30 |
| `images/packs/ebdx/ui/{symMega,symDynamax}.png` | Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip | `Graphics/EBDX/Pictures/UI/<name>.png` | Elite Battle: DX (Luka S.J. and EBDX contributors) | Mega/Primal and Dynamax symbol in the databox | 2026-10-30 |
| `images/packs/ebdx/hatch/egg.png` | Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip | `Graphics/EBDX/Battlers/Eggs/000.png` | Elite Battle: DX (Luka S.J. and EBDX contributors) | Egg on the hatch screen and egg list | 2026-10-30 |
| `images/packs/ebdx/hatch/cracks.png` | same | `Graphics/EBDX/Battlers/Eggs/000cracks.png` | same | Egg crack frames while hatching | 2026-10-30 |
| `images/packs/ebdx/hatch/hatchbg.png` | same | `Graphics/EBDX/Pictures/Hatching/hatchbg.png` | same | Hatch screen backdrop and shine | 2026-10-30 |
| `images/packs/ebdx/hatch/line.png` | same | `Graphics/EBDX/Pictures/Hatching/line.png` | same | Hatch screen backdrop and shine | 2026-10-30 |
| `images/packs/ebdx/hatch/overlay.png` | same | `Graphics/EBDX/Pictures/Hatching/overlay.png` | same | Hatch screen backdrop and shine | 2026-10-30 |
| `images/packs/ebdx/hatch/shine6.png` | same | `Graphics/EBDX/Pictures/Hatching/shine6.png` | same | Hatch screen backdrop and shine | 2026-10-30 |
| `images/packs/ebdx/hatch/shine7.png` | same | `Graphics/EBDX/Pictures/Hatching/shine7.png` | same | Hatch screen backdrop and shine | 2026-10-30 |
| `audio/se/egg_get.ogg` | same | `Audio/ME/Egg get.ogg` | same | Jingle when an Egg hatches | 2026-10-30 |
| `images/packs/ebui/flags/{Contact,Sound,Biting,Powder,Pulse,Punching,HighCriticalHitRate,ZMove,DynamaxMove}.png` | Enhanced Battle UI.zip (v2.1.1) | `Graphics/Plugins/Enhanced Battle UI/Move Flags/<name>.png` | Lucidious89 | Move panel flag icons | 2026-10-30 |
| `images/packs/ebui/flags/{Bomb,Dance,ElectrocuteUser,NoMirrorMove,NoProtect,Slicing,ThawsUser,TramplesMinimize,Wind}.png` | same | same | Lucidious89 | Move panel flag icons (the other 9) | 2026-10-30 |
| `src/data/moveFlags.json` (data) | Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip | `PBS/moves.txt` (`Flags`, `Target`) | Pokémon Essentials team | Dance / no-Protect / thaw / Minimize / electrocute / no-Mirror-Move icons (`npm run data:move-flags`) | 2026-10-30 |
| `images/packs/ebui/move_effectiveness.png` | Enhanced Battle UI.zip | `Graphics/Plugins/Enhanced Battle UI/move_effectiveness.png` | Lucidious89 | Move panel effectiveness tag | 2026-10-30 |
| `images/bosses/giovanni-rocketboss.png` | Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip | `Graphics/Trainers/ROCKETBOSS.png` (copied unchanged, 128×128) | Pokémon Essentials (Maruno and contributors); Nintendo/Game Freak character | Trainer Evolution "Rocket Boss Giovanni" | 2026-10-30 |

Trainer Evolutions reuse pictures already in the PokeRogue boss pack: Champion Red `boss.red-masters`, Champion Blue `boss.blue-gen3champion`, Champion Cynthia `boss.cynthia-masters`, King N `boss.n`, Champion Oak `boss.oak` (neither pack has a separate King N or young Oak picture).
| `images/arenas/raid_{max,tera,ultra,tera2}_bg.png` | Raid Battles.zip | `Graphics/Battlebacks/raid_<name>_bg.png` (resized 512×288 → 320×180) | Raid Battles plugin (Pokémon Essentials community) | Raid and Totem battle arenas (`BattleScene.raidArena`) | 2026-10-30 |
| `audio/bgm/raid_{ultra,max,tera}.mp3` | Raid Battles.zip | `Audio/BGM/Raid (<Ultra/Max/Tera>) battle v1.ogg` (converted to mp3, 96 kbps) | Raid Battles plugin (Pokémon Essentials community) | Raid and Totem battle music (`BattleScene`) | 2026-10-30 |

Dataset: `src/data/moveTargets.json` (which moves hit both foes, everyone, the partner...) comes from PokeAPI's `data/v2/csv/moves.csv` `target_id` column (github.com/PokeAPI/pokeapi, BSD-3), built by `npm run data:move-targets` (2026-10-30).
| `battle-anims/ess-*.json` (212 moves, 11 status/weather) | Pokemon Essentials 21.1 UIE.rar (the same file is in Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip) | `Data/PkmnAnimations.rxdata`, converted by `tools/essentials/dump-animations.rb` + `npm run data:pack-anims` | Pokémon Essentials (Maruno and contributors); Nintendo/Game Freak | Each move's first-choice battle animation (`src/data/moveAnims.json` `pack`) | 2026-10-30 |
| `images/battle_anims/ess-*.png` (135 sheets) | same | `Graphics/Animations/<name>.png` (scaled to half size; `-h<deg>` copies have the animation's hue shift baked in) | Pokémon Essentials and the RPG Maker XP RTP animation sheets | Sheets for the `ess-*` animations | 2026-10-30 |
| `audio/battle_anims/ess-*.m4a` (133 sounds) | same | `Audio/SE/Anim/<name>.ogg` (converted to mono AAC 64 kbps) | Pokémon Essentials | Sounds for the `ess-*` animations | 2026-10-30 |
| `images/packs/ebdx/primega/{mega,alpha,omega}.{png,json}` | Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip | `Graphics/EBDX/Animations/Moves/Primega/{Mega,Alpha,Omega,overlayM,overlayA,overlayO,cr001–cr026}.png`, cut into shard atlases by `tools/essentials/cut-primega.py` (as EBDX's `Primega Shatter.rb` does at run time) | Elite Battle: DX (Luka S.J. and EBDX contributors) | Mega Evolution / Primal Reversion crystal shatter (`battleFx/cinematics.ts`) | 2026-10-30 |
| `images/packs/raid/{max/{bg,icon,spiral,spiral2},ultra/{bg,icon},tera/{bg,icon,spiral},transitions/{black_bars,impact,shine}}.png` | Raid Battles.zip | `Graphics/Plugins/Raid Battles/Transitions/<Max/Ultra/Tera>/<name>.png` and `Transitions/<name>.png` (copied unchanged) | Raid Battles plugin (Lucidious89, Pokémon Essentials community) | Dynamax/Gigantamax storm, Z-Power and Terastal cinematics; cinematic bars | 2026-10-30 |
| `images/packs/dbk/mega/orb_1.png` | Pokemon Essentials 21.1 UIE.rar (Deluxe Battle Kit) | `Graphics/Plugins/Deluxe Battle Kit/Mega/orb_1.png` | Lucidious89 | Mega glow orb; Primal symbol after the shatter | 2026-10-30 |
| `images/packs/dbk/mega/shine.png` | Pokemon Essentials 21.1 UIE.rar (Deluxe Battle Kit) | `Graphics/Plugins/Deluxe Battle Kit/Mega/shine.png` | Lucidious89 | Mega glow orb; Primal symbol after the shatter | 2026-10-30 |
| `images/packs/dbk/primal/icon_groudon.png` | Pokemon Essentials 21.1 UIE.rar (Deluxe Battle Kit) | `Graphics/Plugins/Deluxe Battle Kit/Primal/icon_GROUDON.png` | Lucidious89 | Mega glow orb; Primal symbol after the shatter | 2026-10-30 |
| `images/packs/dbk/primal/icon_kyogre.png` | Pokemon Essentials 21.1 UIE.rar (Deluxe Battle Kit) | `Graphics/Plugins/Deluxe Battle Kit/Primal/icon_KYOGRE.png` | Lucidious89 | Mega glow orb; Primal symbol after the shatter | 2026-10-30 |
| `images/packs/ess/bag_pockets.png` | Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip | `Graphics/UI/Bag/icon_pocket.png` (top row, padded to 28×28 frames) | Pokémon Essentials team | Shop category icons (8 bag pockets) | 2026-10-30 |
| `images/packs/ebui/{info_gender,info_stats}.png` | Enhanced Battle UI.zip (v2.1.1) | `Graphics/Plugins/Enhanced Battle UI/<name>.png` (copied unchanged) | Lucidious89 | Summary screen gender marks and raised-stat arrows (`src/ui/summaryMenu.ts`) | 2026-10-30 |
