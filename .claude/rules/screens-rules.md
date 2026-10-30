---
paths:
  - "src/scenes/**"
  - "src/ui/**"
---
# Rules for screens and UI

- Screens call `GameSession` / core functions; they never change game state directly or roll gameplay RNG (previews and hovers included).
- Animation, audio, camera and banners go through the presentation-cue layer. A presentation failure must never break battle state.
- Respect the settings: visual intensity, reduced motion, animation skip, audio volume.
- Asset names come from `src/assets/catalog.ts`; load lazily via `src/ui/lazyAssets.ts`. Missing art must fall back, not crash.
- Check rendered screens at several window sizes; no console errors.
