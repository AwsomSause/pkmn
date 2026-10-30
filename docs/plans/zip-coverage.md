# Zip / rar coverage (project files)

What each pack holds and how much of it the game uses. Statuses: BUILT, PART, TODO, SKIP (reason). Sprite swap, battle UI styles and item icons belong to other threads.

| Pack | Holds | Status |
|---|---|---|
| `Raid Battles.zip` | 19 BGM, raid/Max/Tera/Ultra transitions + backgrounds, Raid Dens UI (8), Adventures UI (10), cheer UI (3), Ruby code | Art + 3 songs BUILT earlier. Slice Z1: 8 more battle songs by tier (BUILT). Adventure/capture songs, Dens/Adventures UI: see below |
| `Deluxe Battle Kit.zip` | Mega/Primal/Z/Dynamax/Tera art, midbattle scripting | PART (cinematics use it; scripting ideas already ported as boss scripts) |
| `Enhanced Battle UI.zip` | flag icons, move/battler info UI | BUILT (visual slice 3) |
| `Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip` | EBDX art (1,155), anims, sprites, audio | PART (intro wipe, VS, ambience, hatch, Primega, anims) |
| `Pokemon Essentials 21.1 UIE.rar` (14,899 files) | 10,276 Pokémon sprites (sprite-swap thread), 886 SE, 450 item icons (item thread), 386 UI, 252 Custom UI, 212 characters, 202 battlebacks, 109 windowskins, 98+72 animations, 77 trainers, 67 transitions, 51 BGM, 24 weather | PART |
| `[000_AAI] Advanced AI System.zip` | 47 Ruby AI scripts | TODO |
| `SOS Battles.zip` | ally call PBS + code | TODO |

Opening the .rar: no unrar/7z in the container, so `node-unrar-js` (npm, WASM) lists and extracts it.
