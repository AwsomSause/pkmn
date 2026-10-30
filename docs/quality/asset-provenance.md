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
| `images/packs/ebui/flags/{Contact,Sound,Biting,Powder,Pulse,Punching,HighCriticalHitRate,ZMove,DynamaxMove}.png` | Enhanced Battle UI.zip (v2.1.1) | `Graphics/Plugins/Enhanced Battle UI/Move Flags/<name>.png` | Lucidious89 | Move panel flag icons | 2026-10-30 |
| `images/packs/ebui/move_effectiveness.png` | Enhanced Battle UI.zip | `Graphics/Plugins/Enhanced Battle UI/move_effectiveness.png` | Lucidious89 | Move panel effectiveness tag | 2026-10-30 |
| `images/bosses/giovanni-rocketboss.png` | Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip | `Graphics/Trainers/ROCKETBOSS.png` (copied unchanged, 128×128) | Pokémon Essentials (Maruno and contributors); Nintendo/Game Freak character | Trainer Evolution "Rocket Boss Giovanni" | 2026-10-30 |

Trainer Evolutions reuse pictures already in the PokeRogue boss pack: Champion Red `boss.red-masters`, Champion Blue `boss.blue-gen3champion`, Champion Cynthia `boss.cynthia-masters`, King N `boss.n`, Champion Oak `boss.oak` (neither pack has a separate King N or young Oak picture).
| `images/arenas/raid_{max,tera,ultra,tera2}_bg.png` | Raid Battles.zip | `Graphics/Battlebacks/raid_<name>_bg.png` (resized 512×288 → 320×180) | Raid Battles plugin (Pokémon Essentials community) | Raid and Totem battle arenas (`BattleScene.raidArena`) | 2026-10-30 |
| `audio/bgm/raid_{ultra,max,tera}.mp3` | Raid Battles.zip | `Audio/BGM/Raid (<Ultra/Max/Tera>) battle v1.ogg` (converted to mp3, 96 kbps) | Raid Battles plugin (Pokémon Essentials community) | Raid and Totem battle music (`BattleScene`) | 2026-10-30 |
