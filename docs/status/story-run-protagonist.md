# Story Run: name and pronouns carried into the run

- `createRun` takes `protagonist` (look, name, pronouns); `GameSession.newRun` passes `profile.story.protagonist` once a name is set. On a Story Run (story campaign) it is stored in `run.story.v2.protagonist` (the backstory keeps it). Classic runs ignore it.
- Story scenes (`activeScene`) now fill the pronoun tokens as well as `{player}`: `{they} {them} {their} {theirs} {themself} {they_are} {they_were}` and capitalised forms (`{They_are}`), from `pronounForms` (custom sets work). The tokens are on the `story-template-tokens` allow list.
- No save bump (`v2.protagonist` already existed, optional). Test: `tests/unit/storyProtagonist.test.ts` (5).
- Limit: only Story scene text reads these; Classic run text and news/Chronicle templates still say "you".
