# Animations M15/M16: Hyper/Overdrive, interactions, rivals (spec 6.3, 6.4, 6.5)

Built on the central animation registry (`core/presentation/animRegistry.ts`). Registry data and id mapping: `core/presentation/storyAnims.ts`. Drawing: `ui/battleFx/storyFx.ts`. Presentation only: no save change, no gameplay RNG, outcomes never depend on it.

## What plays

**6.4 Hyper/Overdrive** (cue `storyAnim`, ids `overdrive.*`, picked from the story definition id by `hyperAnimId`; every one of the 94 definitions maps to one):
- `toughened`: white flash, short freeze, defensive aura rings close in.
- `rise` (Pushed Back Up): Pokémon falls, ~0.4 s of stillness, gets back up with a burst and shake.
- `bond`: soft pink wash, hearts drawn in and drifting up, ring.
- `rivalry`: both Pokémon ringed, clash sparks between them, tremble.
- `flair` (Mega/Z/Dynamax/Tera/awakening moments): three aura rings, burst, flash, bounce.
- `hung`, `emotion`, `rage`, `moment`: smaller variants for the other survival, emotion, enemy and generic moments.

**6.3 Interactions:** `interaction.enter` (Pokémon enters the field), `interaction.item` (item used), `interaction.catch` (caught: star burst after the ball settles). `interaction.rare` is registered for rare items; its trigger waits for the reward screen thread. Evolution, Mega and form changes already use the transformation cinematics.

**6.5 Rivals:** `rival.intro` (a caption bar, the rival's picture swoops in with a bounce, red star pops, slides out; plays before the title card), `rival.ace` (when their last Pokémon comes out), `rival.win` / `rival.lose` (victory hop or defeat slump, including narrative defeats).

## Settings
Uses only existing keys: Hyper/Overdrive, Interaction and Rival Animations switches, `disableAllAnimations` (remembers the switches), Animation mode, intensity, shake and Reduced Particles. Reduced motion gives a calm dip, Off plays nothing; the text lines still show. The registry resolver (`animSettingsFrom`) applies the category switches, speed and strength.

## Known limits
- Rival expressions use the existing trainer art (no new poses); per-rival signature intros are not data-driven yet.
- No silence/audio duck during Pushed Back Up (no audio ducking API).
- Party enter/leave outside battle, achievement and unlock animations were not touched (existing toasts).
- Tested by unit tests only (mapping, cues, switches, reduced mode); not watched in a browser here.
