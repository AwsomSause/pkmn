# Story Run trainer introductions (S16)

In a Story Run, rivals, Gym Leaders, the Elite Four and the Champion now say their intro lines when a battle starts (after the opening transition). Ordinary trainers and wild battles are unchanged.

- Picker and text fill: `src/core/story2/cutscene.ts` (`introForBattle`, `introText`). Shown by `BattleScene.storyIntro()` (presentation only; no gameplay state touched).
- Tests: `tests/unit/storyTrainerIntros.test.ts` (4).
- Limits: poses, emotes and stings from `TRAINER_INTROS` are not played yet (text only).
