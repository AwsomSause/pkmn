# Story foundation (M8.9-0)

How the story layer works, for whoever builds the next story system (Hyper moments, rivals, nemesis, protégé, chronicle UI). Code: `src/core/story/`. Data: `src/data/story.json`.

## The pieces

| File | What it holds |
| --- | --- |
| `schema.ts` | Zod shapes: domain events, memories, `PokemonHistory`, `RelationshipRecord`, `EnemyProfile`, chronicle entries, the run's `StoryState`, story event definitions and `StoryConfig` |
| `record.ts` | `emit()` records a domain event and updates histories, memories and the chronicle; helpers for relationships, enemy profiles and `topMoments()` |
| `effects.ts` | `applyStoryEffect()`: money, friendship, attributes, items, flags, stat stages. Every application has an id; an id already in the ledger does nothing |
| `ledger.ts` | The battle-scope ledger (`battle.storyEffects`) and cooldown keys. Plain state only, so the battle engine can use it |
| `queue.ts` | The event queue: priority order, one combat effect per turn, merged banners, the per-battle budget of cinematic moments. Produces `PresentationCue`s |
| `hooks.ts` | Where the run feeds the story: run start, routes, battle start, every turn, catches, rewards, releases, and a before/after diff for joins, departures, evolutions, friendship milestones and the end of the run |

## Rules

- **The story never decides an outcome by itself.** Run actions (`core/run.ts`) change the run, then call the hooks to record what happened. Love's endure is still rolled by the engine on the `battle` stream at the same moment as before; the engine only asks the story ledger whether this Pokémon has used it this battle.
- **Ids are deterministic.** An event id is `seed#seq`. A run replayed from the same seed with the same actions gets the same events.
- **Never twice.** Run-scope effect ids are saved in `run.story.appliedEffects`; battle-scope ones in `run.battle.storyEffects` (gone when the battle ends).
- **Cues are presentation only.** `TurnResult.cues` tells the battle screen which event index gets a banner and which lines replace that event's text. They are never saved and the rules never read them. If drawing one fails, the battle carries on.
- **Randomness.** Story choices (which line from a message pool) use the `story` stream; Hyper chances will use the `hyper` stream. Streams are derived from the seed by name, so adding them changed no existing roll (`tests/unit/story.test.ts` pins this against fingerprints taken on main).
- **Limits** (story.json `limits`): 250 recent events, 20 memories per Pokémon, 60 histories, 12 open relationships, 6 recurring enemies per run and 3 per region, 300 chronicle entries, 2000 applied effect ids. Lists drop their least important entry first.

## Adding a story event

1. Add a row to `story.json` `definitions` with the 14 fields from the Hyper blueprint (`id`, `displayName`, `messagePool`, `category`, `triggerConditions`, `chance`, `effect`, `duration`, `cooldown`, `memoryRecord`, `followUpEvents`, `visualCue`, `priority`, `eligibilityTags`).
2. If it needs a new kind of trigger, add it to `STORY_TRIGGERS` in `schema.ts` and detect it in `hooks.ts` (`recordBattleTurn` for battle triggers). Push a `StoryTrigger`; the queue does the rest.
3. Roll any `chance` on the `hyper` stream, never on a gameplay stream.
4. Test: same seed gives the same events, save/reload never repeats the effect, and the old-seed fingerprints still match.

## Save versions

Run v9 adds `story`, the `story`/`hyper` streams (from the seed) and turns `battle.enduredUids` into `battle.storyEffects`. Profile v6 adds `moments` to each Run History entry. A run loaded from an older save gets histories for its party on Continue (`prepareLoadedRun`).
