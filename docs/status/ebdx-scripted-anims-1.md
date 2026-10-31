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

## Slice 5 (draft-generated)
25 more scripts via the generator (25 moves): counter, dragon-breath, flamethrower, outrage, play-rough, dragon-pulse, aerial-ace, charge, earth-power, razor-leaf, spark, bubble, roost, thunder-wave, uproar, bug-bite, hex, rock-throw, sweet-scent, baby-doll-eyes, bubble-beam, iron-head, stomp, gust, moonblast. Total 108 moves (80 scripts).

## Slice 6 (draft-generated, 75 scripts)
75 more generator drafts (75 moves; the list is in `ebdxAnims.json`), taking the total to 183 moves (155 scripts). Fixes found in headless screenshots: full-field backdrops (`fill`) now sit behind the Pokémon and cap at 35% opacity (they washed out the whole battle), and wide short beam pictures are no longer mistaken for backdrops (only 512x384 art counts). The browser test plays an even sample (about 40 scripts) plus fixed screenshot picks; the unit test checks every script. Screenshot tip: `EBDX_ONLY=ember,bite EBDX_SHOT_MS=250 npx playwright test tests/e2e/ebdxAnims.spec.ts` writes `test-results/ebdx-<name>.png` (capture latency means effects may already be fading).

## Slice 7 (draft-generated, 75 scripts)
75 more generator drafts (the list is in `ebdxAnims.json`): fling, ice-beam, surf, fire-blast, overheat, brave-bird, flash-cannon, sludge-bomb, brick-break, thunder-punch, head-smash, whirlpool, hail, electric-terrain and more. Total 259 moves (230 scripts). About 390 unported EBDX scripts remain.
