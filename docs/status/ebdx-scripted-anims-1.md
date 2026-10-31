# EBDX scripted move animations, slice 1 (left-out 6.6)

EBDX writes its 442 move animations as Ruby scripts. We can't run Ruby, so each one is re-timed by hand into a short timeline (`src/data/ebdxAnims.json`, format in `src/core/presentation/scriptAnim.ts`) that `src/ui/battleFx/scriptPlayer.ts` draws. A move with a `script` in `moveAnims.json` plays it first; the Essentials pack animation, the PokeRogue one and the family effect stay as stand-bys.

Slice 1 ported 7 scripts covering 17 moves: tackle (tackle, pound, quick-attack, covet, pounce, u-turn, flip-turn), ember, water-gun (+chilling-water), thunderbolt, absorb (+leech-life, horn-leech, drain-punch), mega-drain, giga-drain.

- Add a script: edit `ebdxAnims.json` (script + move ids), run `npm run data:ebdx-anims -- <EBDX folder>` (copies pictures, converts sounds, sets `script` in `moveAnims.json`), then `npm run assets:manifest` (do not commit the manifest).
- Presentation only: the particle spread is a hash (`scatter`), never gameplay RNG. Skip/stop restores both Pokémon. Honors effect and shake intensity, mute and SFX volume.
- Not carried over: EBDX camera moves (vector zoom/pan), per-frame sprite tone overlays beyond a target flash, and background dimming of the arena.
- Next: more shared archetypes (growl/stat waves, swords-dance, double-team, psychic, charge, punch/kick strikes), each unlocks many moves.

## Slice 2
Added growl (veil + user shake; 10 moves: growl, parting-shot, tickle, noble-roar, entrainment, yawn, after-you, fake-tears, assist, play-nice) and comet-punch (starburst hits; 6 moves: comet-punch, bullet-punch, grass-knot, rapid-spin, steamroller, belly-drum). Total 33 moves. EBDX plays the user's cry for Growl; ours has no cry hook here yet.

## Slice 3 (draft-generated)
`python3 tools/gen-ebdx-scripts.py <EBDX folder> <count>` drafts timelines for the unported scripts whose moves most species learn: it reads each Ruby body for its pictures, sounds, colours, loop length and whether it throws something from the user to the target. These are **approximations** from the script's art, sound and structure, not frame-exact ports; the hand-timed slice 1-2 scripts are never overwritten. Hand-tune any that look wrong in `ebdxAnims.json`.

Added 22 scripts (26 moves): psychic (confusion, extrasensory, psychic-noise), leer, bite, crunch, scary-face, slash, astonish, headbutt, screech, endure (bide), focus-energy, scratch, hydro-pump, protect, charm, ancient-power, taunt, psybeam, water-pulse, swords-dance, harden, thrash. Format gains full-field `fill` backdrops (Psychic's scrolling wave) and per-sound `src` paths (Essentials SEs). Total 59 moves.

## Slice 4 (draft-generated)
24 more scripts via the generator (24 moves): confuse-ray, fury-swipes, nasty-plot, rollout, air-slash, zen-headbutt, rock-slide, discharge, swift, leech-seed, mud-slap, growth, hypnosis, night-slash, metal-claw, calm-mind, recover, toxic, light-screen, safeguard, curse, rain-dance, shadow-ball, close-combat. Total 83 moves.
