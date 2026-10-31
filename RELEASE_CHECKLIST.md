# Release checklist

Run before tagging a release or telling Kice a slice is ship-ready. Tick each line only when you ran it and read the result.

## Automatic (CI runs these)
- [ ] `npm run check` (typecheck, unit tests, build, content gate)
- [ ] `npm run test:e2e` (all specs; `viewports.spec.ts` covers 1280×720, 1024×600, 768×1024, 390×844 with no console errors and the canvas inside the window)
- [ ] `tests/unit/releaseGate.test.ts`: every save record has a migration from every old version; bad saves never crash a load

## Saves
- [ ] `CURRENT_VERSIONS` in `src/save/saveManager.ts` matches STATUS.md; each bump has a migration and a test
- [ ] Load a save made on the previous release in the browser: profile, run and settings all load, nothing silently dropped

## Look and feel (by hand, `npm run dev`)
- [ ] Menu, Hub, Trainer Select, Map, Battle, Reward, Shop, Event, Game Over at 960×540 and 480×800: no text overlap
- [ ] Settings: Animations Off / Reduced, Flashes, Screen shake, Particles, Battle speed (Showcase … Quick) all change what you see
- [ ] Reduced Motion preset: no shake, no flash, no drifting particles

## Accessibility
- [ ] Page has `lang`, a title, and a named canvas (e2e checks this)
- [ ] Whole game playable with the keyboard alone
- [ ] Low Flash and Reduced Motion presets exist and work

## Content and docs
- [ ] `npm run check` content gate shows no new invalid content
- [ ] STATUS.md, CHECKLIST.md and the coverage docs updated; known limits written down
- [ ] Asset provenance (`docs/quality/asset-provenance.md`) lists every new asset
