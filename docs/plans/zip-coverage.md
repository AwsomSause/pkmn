# Zip / rar coverage (project files)

What each pack holds and how much of it the game uses. Statuses: BUILT, PART, TODO, SKIP (reason). Sprite swap, battle UI styles and item icons belong to other threads.

| Pack | Holds | Status |
|---|---|---|
| `Raid Battles.zip` | 19 BGM, raid/Max/Tera/Ultra transitions + backgrounds, Raid Dens UI (8), Adventures UI (10), cheer UI (3), Ruby code | Art + 3 songs BUILT earlier. Slice Z1: 8 more battle songs by tier (BUILT). Adventure/capture songs, Dens/Adventures UI: see below |
| `Deluxe Battle Kit.zip` | Mega/Primal/Z/Dynamax/Tera art, midbattle scripting | PART (cinematics use it; scripting ideas already ported as boss scripts) |
| `Enhanced Battle UI.zip` | flag icons, move/battler info UI | BUILT (visual slice 3) |
| `Pokemon-Essentials-21-With-Unofficial-EBDX-main.zip` | EBDX art (1,155), anims, sprites, audio | PART (intro wipe, VS, ambience, hatch, Primega, anims) |
| `Pokemon Essentials 21.1 UIE.rar` (14,899 files) | 10,276 Pokémon sprites (sprite-swap thread), 886 SE, 450 item icons (item thread), 386 UI, 252 Custom UI, 212 characters, 202 battlebacks, 109 windowskins, 98+72 animations, 77 trainers, 67 transitions, 51 BGM, 24 weather | PART |
| `[000_AAI] Advanced AI System.zip` | 47 Ruby AI scripts | PARTIAL (Z8) |
| `SOS Battles.zip` | ally call PBS + code | TODO |

Opening the .rar: no unrar/7z in the container, so `node-unrar-js` (npm, WASM) lists and extracts it.

## Slices shipped from this tracker
| Slice | What | Status |
|---|---|---|
| Z1 | 8 raid/Totem battle songs (Basic/Ultra/Max/Tera sets, picked by raid id) | BUILT (#274) |
| Z2 | Battle weather overlays (rain, hail, snow, sand, sun) from UIE `Graphics/Weather` | BUILT (#274); checked in a browser screenshot |
| Z3 | Expedition route music (Raid adventure songs, by tier) | BUILT (#276) |
| Z4 | `public/assets/manifest.json` was stale: raid songs and weather art never loaded in-game. Regenerated; a unit test now fails when a fixed catalog asset is missing from it | BUILT |

## Not built, and why
| Item | Status | Note |
|---|---|---|
| Raid "capture" jingles (4 tracks) | SKIP | no raid-capture moment to play them at (a raid win gives the boss as a reward card) |
| `Graphics/Custom UI` (pause bars, trainer card, load/options backgrounds) | PARTIAL (Z6) | Pause Menu top bars (6 colours) now tint the map header by region. Not used: trainer card, load/options/save backgrounds, party, dex, bag art (each needs its own layout pass; Aero glass stays the look elsewhere) |
| `Graphics/Transitions` masks | BUILT (Z5) | 12 grayscale masks drive a rule wipe when a battle ends (`ui/battleFx/ruleWipe.ts`); one in 4 battles keeps the glass shutters; reduced motion = fade, off = none. Browser screenshots checked. `__pkr.wipe(mask)` plays one for tests |
| `Graphics/Windowskins` | SKIP | RPG-Maker dialogue frames; the Aero message bar replaces them |
| SOS Battles (wild calls for help) | BUILT (Z7) | `core/battle/sos.ts`, `sos.json` (604 species, from the pack's PBS via `tools/build-sos.ts`), `sosCall` in the engine. A hurt wild Pokémon may call a friend that takes the field in its place (one answered call per battle; rates, answer odds and levels as in the add-on). The friend can be caught or beaten; beating it brings the caller back. `balance.sos.enabled` switches it off. Save: `battle.sos` is optional, so old saves load unchanged. Limits: no SOS chain (IV/shiny/hidden ability boosts), no Adrenaline Orb, no map-specific callers, not in doubles/raids/Totems. Not checked in a browser (the call roll is seeded; unit tests cover it) |
| Advanced AI System (47 scripts) | PARTIAL (Z8) | Ported: KO bonus, priority-KO bonus, danger switch (balance trainerAi koBonus, priorityKoBonus, dangerSwitch). Not ported: the other ~40 scripts (items-in-battle choices, ability-specific reads, doubles) |
| UIE Pokémon sprites, item icons | OTHER THREAD | sprite-swap and item-audit threads |
