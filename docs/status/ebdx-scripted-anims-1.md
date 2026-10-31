# EBDX scripted move animations, slice 1 (left-out 6.6)

EBDX writes its 442 move animations as Ruby scripts. We can't run Ruby, so each one is re-timed by hand into a short timeline (`src/data/ebdxAnims.json`, format in `src/core/presentation/scriptAnim.ts`) that `src/ui/battleFx/scriptPlayer.ts` draws. A move with a `script` in `moveAnims.json` plays it first; the Essentials pack animation, the PokeRogue one and the family effect stay as stand-bys.

Slice 1 ported 7 scripts covering 17 moves: tackle (tackle, pound, quick-attack, covet, pounce, u-turn, flip-turn), ember, water-gun (+chilling-water), thunderbolt, absorb (+leech-life, horn-leech, drain-punch), mega-drain, giga-drain.

- Add a script: edit `ebdxAnims.json` (script + move ids), run `npm run data:ebdx-anims -- <EBDX folder>` (copies pictures, converts sounds, sets `script` in `moveAnims.json`), then `npm run assets:manifest` (do not commit the manifest).
- Presentation only: the particle spread is a hash (`scatter`), never gameplay RNG. Skip/stop restores both Pokémon. Honors effect and shake intensity, mute and SFX volume.
- Not carried over: EBDX camera moves (vector zoom/pan), per-frame sprite tone overlays beyond a target flash, and background dimming of the arena.
- Next: more shared archetypes (growl/stat waves, swords-dance, double-team, psychic, charge, punch/kick strikes), each unlocks many moves.
