# W3 rival choice scenes wired into the Story Run

- `core/story2/rivalStory.ts`: a relationship Stop or a rest/downtime Stop (`offersRivalScene`) offers one of the six W3 choice scenes (`rivalScenes.json`) with a rival the player has met (`run.story.rivals`): the rival with the fewest scenes so far (ties by a hash of the Stop), the first scene not yet played with them. One waits at a time. Called from `storyDirector.playStop`.
- Shown on the Story screen (`GameSession.storyScene` falls back to `rivalStoryScene` when no backstory scene is waiting; `finishStoryScene` routes to `finishRivalScene`). The choice goes through `dialogue.playChoice` (relationship deltas, friend/heat flags, hidden consequence); the reply and the rival's key-choice reaction follow as a short scene.
- Hidden consequences: every Stop calls `surfaceRivalConsequences`; each due one shows once as "Word on the Road" (dialogue.ts keeps fire-once across save and load).
- Save: `v2.rivalScene` and `v2.notes` (defaulted, inside run v40). No bump.
- Tests: `tests/unit/storyRivalDialogue.test.ts` (6).
- Limits: no rival met yet means no scene (early Stops); scenes use the rival's name, not a portrait; relationship gates (share a risk/secret) are not set by these scenes.
