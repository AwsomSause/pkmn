# Visual style guide (left-out 6.5)

The one-page rulebook for how screens look and move. Direction from Kice: Frutiger Aero, DS era, Wii era, Cyber-Maximalism; flowy, bouncy, animated. Sources: `src/ui/aero.ts`, `src/ui/theme.ts`, `VISUAL_BIBLE.md`.

## Palettes
| Use | Colour | Where |
|---|---|---|
| Deep glass (text panels) | `0x0b2a4a`, low `0x061528` | `AERO.glass`, `AERO.glassLow` |
| Rim and focus glow | `0x7ff3ff` | `AERO.rim` |
| Sky / aqua accents | `0x38c8ff` / `0x2ee6c8` | `AERO.sky`, `AERO.aqua` |
| Cyber highlight, warnings | `0xff4fd8` | `AERO.neon` |
| Hub and Trainer Select (kept) | plum `0x362d3e`, red trim `0xc73625` | `COLORS` in `theme.ts` |
| HP bar | green `0x2ed35a`, yellow `0xf3b200`, red `0xfb3041` | kept from PokeRogue |
| EXP bar | blue `0x00baf3` | kept |
| Reward tiers | common grey, uncommon blue, rare gold, epic purple | `COLORS.rarity` |
Each region tints the sky (`regionIdentity(...).sky`) and each stage's map takes its types' ambience.

## Layers (back to front)
1. Backdrop: `aeroBackdrop` (sky and bubbles) or an arena background.
2. Ambience: clouds, rays, fog, then particles (`battleFx/ambience.ts`; particles drop out under Particles: Reduced).
3. Platforms and contact shadows, then Pokémon and trainers.
4. Glass panels (`glassPanel`), text, cursors and focus frames.
5. Cinematic accents: banners, flashes, wash (always above, always skippable).

## Motion
- Entrances: `bounceIn` (Back.easeOut, ~420 ms, scale from 0.6) for objects; `slideIn` (Back.easeOut ~520 ms) for panels. Reduced motion: a quarter of the distance, Sine.easeOut ~200 ms. Off: no tween.
- Idle: `floatIdle` and `breathe` (Sine.easeInOut, 1.6–1.8 s, yoyo).
- Ambience drift: Sine.easeInOut / Linear, 5–10 s, repeat.
- Battle speed scales tweens and timers (Showcase 0.75×, Normal 1×, Fast 2×, Quick 3×); outcomes never depend on it.
- Settings that gate motion: Animations (Full / Reduced / Off), Flashes, Screen shake, Particles. The Reduced Motion preset turns all of them down.

## Rules
- Presentation failure never changes battle state; no gameplay RNG in visuals.
- New screens use `glassPanel` + the Aero backdrop + a slide-in; keep text white with the soft shadow.
- Every imported asset gets a row in `docs/quality/asset-provenance.md`.

## Rejected or unresolved assets
- RPG-Maker Windowskins (replaced by the Aero message bar) and UIE `.mid` songs (browser can't play MIDI; ogg stand-ins used): see `docs/plans/zip-coverage.md` SKIP rows.
- Placeholders still drawn by tools: Z-Crystal and Z-Ring icons (`tools/draw-z-icons.ts`; Deluxe Battle Kit has Z art to swap in), King N and Champion Oak evolutions reuse base art (left-out 6.8).
- EBDX's 442 scripted move animations: graphics are used, scripts are not played (left-out 6.6).

## Visual test gallery
`tests/e2e/viewports.spec.ts` screenshots Menu, Hub, Trainers, Map and Battle at four sizes into `test-results/`; `tests/e2e/blueprint-qa.spec.ts` writes expedition, raid, totem, minigame and map-stop shots to `test-results/qa/`; `tests/e2e/visualSnapshots.spec.ts` covers move-family and cinematic shots. Not yet: automatic pixel compare for Hub and Trainer Select, and a "before" set.
