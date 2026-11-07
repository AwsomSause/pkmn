# Story S6: Keepsakes

20 cosmetic accessories (design Part II-E), five slots, no stat effect.

- `core/story2/keepsakes.ts`: catalog (id, slot, rule, status), `keepsakesEarned(run)`, `foldKeepsakes` (called from `foldModuleIntoProfile` at run end), `wearKeepsake`.
- Profile: `story.keepsakes` (unlocked ids) and `story.worn` (one per slot), both defaulted, no save bump.
- Hub Tales & News: "Keepsakes" screen (`ui/keepsakesMenu.ts`): locked ones show the rule; unlocked ones can be worn or taken off (`GameSession.wearKeepsake`).
- Earnable now (5): Charm Necklace (latch 5), Star Pin (latch 7), Bell Collar (latch 3, Playful/Mischievous), Ribbon Bow (latch 6, Affectionate/Playful), Tiny Hat (Keystone earned).
- All 20 earnable (follow-up, 2026-11-07). Story Runs leave marks in `run.itemCounters` (`ks:<mark>`, no save bump): Gym wins with the Starter in the fight (Bandana at 3), a Gym won with no faints (Bowtie), the Primary Rival beaten in the last region with the Starter in the fight (Cape), the Champion beaten (Medal), a win at a type disadvantage (Headband), 5 loved snacks (Flower Pin), a Weather & Hazards or rain/snow event (Goggles), a snow-scene event (Scarf), a garden/bloom/calm-rain event from `NATURE_EVENTS` (Flower Crown), a clue Discovery Stop with an Intelligent Starter (Glasses), and **The Gift** beat (Satchel): a quest or Starter arc ending on its good exit plays a Gift chronicle moment once per run. Profile rules at run end: Feather (a bird line unlocked in the Archive), Leaf Crown (Familiar Friend on a Grass line), Monocle (10 Lore entries found), Party Hat (the first Story Run ends; the Tuftin egg hatches).
- Remembrance Mastery now folds at run end (`foldStarterMastery`): the Starter's line is unlocked in the Archive, `runs` +1, tier Familiar Friend 1 / Trusted Partner 2 (latch 7) / Mastered 3 (latch 10 + Keystone), never falls.
- Limits: Story Run starters from the old pool have no Remembrance line, so Leaf Crown, Feather (via a bird Starter) and Mastery need a quiz Starter; "the final rival fight" is any win over the Primary Rival in the last region; Party Hat is a Keepsake only (no Tuftin hatch scene yet); the Gift line shows in the Chronicle/Journal, not as a cutscene.
- Not built: drawing the worn Keepsake on the Hub follower, party menu and camp scenes.
- Tests: `tests/unit/storyKeepsakes.test.ts` (16), Gift check in `storyQuestArcs.test.ts`.
