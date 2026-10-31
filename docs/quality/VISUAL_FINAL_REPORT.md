# Visual polish: final report (left-out plan 3.x / 6.x, this thread)

Built and merged or in the closing PR:
- **Settings** (#327): Flashes and Screen shake are separate; Particles: Reduced; Showcase battle speed (0.75×). Settings save v8.
- **Glass and motion** (#341): Expedition, Minigame, Starter Select, Run Prep, Briefing and Game Over use glass panels, the sky backdrop and bouncy slide-ins.
- **Release gate** (#327): save migration test for every old version, canvas aria-label and keyboard e2e, `RELEASE_CHECKLIST.md`.
- **Style guide** (#344): `docs/quality/VISUAL_STYLE_GUIDE.md`.
- **Reward cards** (#351): evolution items and Mega Stones say who can use them.
- **Pixel compare** (#366): Hub and Trainer Select baselines (`tests/e2e/pixelCompare.spec.ts`).
- **This PR:** healing stop plays a green glow with rising sparkles; the map gets a lead-type landmark and a ground band in front of the scenery; the Pokémon summary has four pages (Info, Moves, Growth, Story) where Growth shows evolutions, Mega forms and mastery.

Screenshots after the polish: `docs/qa/after-map.png`, `docs/qa/after-summary.png` (earlier screens: `docs/qa/*.png`). There is no "before" set: nothing was captured before the polish began, and the pre-polish look can be had from any commit before #327.

Not done here (other threads own them): arenas and battlebacks (6.2, 3.2), transitions and performance (3.1), EBDX scripted move animations (6.6). Checked and not possible from the packs: Z-Crystal and Z-Ring art and King N / Champion Oak evolution art (6.8) are not in the DBK, UIE or EBDX packs.

Known: `tests/e2e/milestone10.spec.ts` "gym leader ... victory stamp" fails on main (expects lab light panels behind the first battle) independent of these changes.
