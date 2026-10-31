# M15/M16 animation audit (6.3 interactions, 6.4 Hyper/Overdrive, 6.5 rivals)

Status: audit and plan only. No animation code yet. Build starts when the central animation registry (M14, "Build animation framework and ability animations" thread) is on `main`. Nothing here adds a second system.

## Style reference (Kice's video, 2 s, watermark ignored)

`anim-reference/intimidate-keyframes.jpg` (8 frames, 4 per second). Intimidate: a caption bar ("GYRODOS INTIMIDATES THE FOE") sits top-left for the whole beat. The big Pokémon art swoops in from the right with overshoot and a bounce, holds roaring, a small red star mark pops on its brow, then it slides out the left. Soft translucent bands cross the screen. Reads as: slide in, bounce, hold one beat, one accent pop, slide out. About 1.5 s, flowy and bouncy. Reuse this shape for every cue below (ease `Back.easeOut` in, `Sine.easeIn` out).

## What exists today (reuse, don't rebuild)

| Area | Where | Notes |
|---|---|---|
| Intro wipe by role (`wild`, `wild-dark`, `trainer`, `rival`, `boss`) | `ui/battleFx/spectacle.ts` `introTransition` | Rival already has its own kind, but it is mostly a colour change. |
| Title card ("RIVAL", boss name, Ultimate Rival) | `spectacle.ts` `titleCard`, called from `BattleScene.playIntro` (~line 982) | Rim colours in `ROLE_RIMS`. One card for every rival. |
| Transformation cinematics: mega, primal, dynamax, gigantamax, dynamaxEnd, zmove, tera, evolve | `ui/battleFx/cinematics.ts`, `cineLook.ts` (`CINE_MS`, `SWAP_AT`) | Wrapped as `Beat` (`playBeat`, skippable). No "determination" Mega variant or early-evolve variant. |
| Hyper moment handler | `BattleScene` event `case 'hyper'` (~line 1669) | Only sets HP, clears status, refreshes the info box. No flash, pause, aura or text treatment. |
| Hyper definitions | `src/data/story.json` `definitions`: `toughened-it-out`, `pushed-back-up`, `felt-a-bond`, `heated-rivalry`, plus ~90 other story defs; message pools already written | Animation cue ids can key off the definition id, so no new data shape is needed. |
| Battle text | `ui/battleText.ts` (`hyper` case at ~line 111), `AUTO_EVENTS` in `BattleScene` | Text treatment for Hyper lines is the 6.2 thread's work; 6.4 only supplies the cue. |
| Motion level | `ui/aero.ts` `MotionLevel`; settings owned by the "Unify landing and Hub settings" thread | Every cue must read it. Failure of a cue must never touch battle state (Directive 5). |
| Rival state | `core/rivals/*`, `run.story.rivals`, `battle.rivalId`, `rivalNote` | Presentation can read it; outcomes never depend on it. |

## Gaps to fill, mapped to slices

**Slice 6.4 Hyper/Overdrive (first, smallest, data-driven):** register one cue per hyper definition id.
- Toughened It Out: white flash, 250 ms freeze, short defensive aura ring, bounce settle.
- Hung in There: sprite shake, HP bar pulse.
- Felt a Bond: soft screen fade, trainer-to-Pokémon link line with hearts/sparkles.
- Evolved Early: evolve cinematic with different tint (gold/magenta) and particles.
- Mega Evolved From Determination: mega cinematic with a red-gold aura variant.
- Pushed Himself Back Up: fall, ~400 ms silence (music duck), rise, vignette pulse.
- Heated Rivalry: both sprites get a red/orange rim, brief clash sparks, field tint while the rivalry lasts.
Settings it will honour: Hyper/Overdrive Animations, Screen Shake, Particle Effects, Intensity, Speed, Disable All.

**Slice 6.3 Interaction animations:** party enter/leave, catch and ball open, item use, evolution, Mega/form change, rare item, achievement, unlock, new stage, gym leader meet. Most exist as one-off tweens or toasts (`achievementToast.ts`, `cinematics.ts`, the `catch` flow). Plan: move each onto the registry as a short cue, keep them under ~700 ms except evolve and Mega, skippable.

**Slice 6.5 Rival presentation:** per-rival intro (slide-in like the reference, rival colour, signature Pokémon silhouette), distinct transition, sprite expression (use trainer art variants if present, else tint/pose tween), ace send-out flourish, victory and defeat poses, reaction beats to player milestones. Data: a small `rivalPresentation` block per rival id with a safe default so new rivals need no code.

## Assets to prepare

- Trainer expression/pose art: check `public/assets/` trainer sets for alternate poses before generating anything (grep `src/assets/catalog.ts`).
- Reuse EBDX/DBK pack particles and sounds already in `CINE_ASSETS` / `CINE_SOUNDS`; add only a defence-aura ring, heart/spark, clash-spark and vignette (procedural Phaser graphics is enough, no new files).
- Keep provenance notes for anything imported.

## Rules carried into every slice

Register through the central registry only. Respect settings (Disable All wins, individual values remembered). Reduced/Off motion gives a still frame plus the text line. A cue that errors falls back to the plain text line. Never use gameplay RNG. One PR per slice, merge once GitHub CI is green.
