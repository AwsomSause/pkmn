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

- **The story never decides an outcome by itself.** Run actions (`core/run.ts`) change the run, then call the hooks to record what happened. Hyper moments that change a battle are decided by the battle engine (`core/battle/hyper.ts`), which reads their numbers from story.json and asks the run who is eligible (`core/story/hyper.ts`).
- **Ids are deterministic.** An event id is `seed#seq`. A run replayed from the same seed with the same actions gets the same events.
- **Never twice.** Run-scope effect ids are saved in `run.story.appliedEffects`; battle-scope ones in `run.battle.storyEffects` (gone when the battle ends).
- **Cues are presentation only.** `TurnResult.cues` tells the battle screen which event index gets a banner and which lines replace that event's text. They are never saved and the rules never read them. If drawing one fails, the battle carries on.
- **Randomness.** Story choices (which line from a message pool) use the `story` stream; Hyper chances use the `hyper` stream. Streams are derived from the seed by name, so adding them changed no existing roll (`tests/unit/story.test.ts` pins this against fingerprints taken on main, with the Hyper definitions switched off).
- **Limits** (story.json `limits`): 250 recent events, 20 memories per Pokémon, 60 histories, 12 open relationships, 6 recurring enemies per run and 3 per region, 300 chronicle entries, 2000 applied effect ids. Lists drop their least important entry first.

## Hyper moments (M8.9 Phase 1)

| Moment | Trigger | When | Chance | Effect | Limit |
| --- | --- | --- | --- | --- | --- |
| Toughened It Out | `toughenedItOut` | A fatal hit, first hit of a move, from 25% HP or more | 15% + 0.1 pt per Love point, at most 30%; "Again" at half once it happened this run | Hangs on at 1 HP | Once per battle per Pokémon |
| Felt a Bond | `feltABond` | Friendship 220+ and a close call, survived knockout or boss win this run | 10% + 0.1 pt per point of Love and Charisma (averaged), at most 20% | Hangs on at 1 HP, or shakes off a status at the end of the turn | Once per battle per Pokémon |
| Pushed Itself Back Up | `pushedBackUp` | Knocked out, with a close call, survived knockout or bond memory this run | 3% + 0.1 pt per point of Love and Luck (averaged), at most 6% | Gets back up at 20% HP | Once per battle for the whole party |
| The Enemy Is Getting Riled Up | `enemyRiledUp` | An opposing Pokémon took 3 hits from your moves, saw its ally fall (a trainer's next Pokémon), or was denied a finishing blow (your Pokémon survived it by a Hyper moment, a charm or a held item). Never while it has a status | Always | Shown a turn ahead (banner and a "Riled up!" badge); just before its next move it gets +1 Attack and Sp. Atk. "Its Rage Is Uncontrollable" (chance = your Evil share) also gives it −1 Defense. A status, a super-effective hit, or a move that lowers its Attack or Sp. Atk calms it first | Once per battle per opposing Pokémon |
| The Two Pokémon Feel a Heated Rivalry | `heatedRivalry` | Your Pokémon is on the field against an opposing species it has now fought in 3 battles this run (counting this one; `history.foes` counts battles per species, added up when each battle ends) | Always | Banner before the first move; "It Recognizes Its Rival!" in later battles (quieter). +10% damage against that species for the battle. Reckless (chance = your Rage share): +20% instead, and −1 Defense. Opens a `rivalry` relationship (`enemy` ref `species:<id>`) and a `rivalryFormed` memory | Once per battle per pair |
| Friendly Competition | `friendlyCompetition` | Two Pokémon in your party take turns landing finishing blows 3 times (`history.finishTrades`, `story.flags.lastFinisher`, counted across the run; decided by the story hooks, not the engine) | Always | Banner, a `rivalry` relationship between the two and a memory. Afterwards, when one lands a finishing blow, the other "won't be outdone": +10% damage for the rest of that battle | Forms once per pair; "outdo" once per battle per Pokémon |
| Hung In There | `hungInThere` | 3 turns in a row at 25% HP or less ("Wouldn't Stay Down": 2 super-effective hits survived) | Always | +1 Defense and Sp. Def; Peace heals up to 10% | Once per battle per Pokémon |

Only one Hyper moment changes the battle per turn on each side. The enemy's rage lives in `battle.hyper.rage` (by uid: hits, calm/warned/spent, uncontrollable). Rivalries use `battle.hyper.met` (species each of your Pokémon faced), `rivals` ("uid|speciesId": calm/reckless) and `outdo`; rivalry lines never take the knockout-save slot in the queue. The battle keeps its counters (`battle.hyper`: the low-HP streak and super-effective hits survived) and its cooldowns in `battle.storyEffects`; each history counts its moments in `hyper`, which is how "Again" knows. Love's old endure became Toughened It Out (run save v10 renames its ledger key).

## Adding a story event

1. Add a row to `story.json` `definitions` with the 14 fields from the Hyper blueprint (`id`, `displayName`, `messagePool`, `category`, `triggerConditions`, `chance`, `effect`, `duration`, `cooldown`, `memoryRecord`, `followUpEvents`, `visualCue`, `priority`, `eligibilityTags`).
2. If it needs a new kind of trigger, add it to `STORY_TRIGGERS` in `schema.ts`. A trigger that changes a battle is decided in the engine (`core/battle/hyper.ts`, with its effect in `HYPER_EFFECTS`) and sends a `hyper` battle event; `recordBattleTurn` in `hooks.ts` turns that into a `StoryTrigger` and the queue does the rest.
3. Roll any `chance` on the `hyper` stream, never on a gameplay stream.
4. Test: same seed gives the same events, save/reload never repeats the effect, and the old-seed fingerprints still match.

## Save versions

Run v9 adds `story`, the `story`/`hyper` streams (from the seed) and turns `battle.enduredUids` into `battle.storyEffects`. Run v10 renames Love's endure key to `toughened-it-out@uid` and adds `battle.hyper` and each history's `hyper` counts. Profile v6 adds `moments` to each Run History entry. A run loaded from an older save gets histories for its party on Continue (`prepareLoadedRun`).
