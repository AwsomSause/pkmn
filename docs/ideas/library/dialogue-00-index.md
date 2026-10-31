# Dialogue library index (1,114 new lines)

Initiative 7. Design doc only; nothing here is wired into the game. These lines are NEW on top of the 1,000+ generic lines in `ideas/dialogue.md` (rivals, gyms, battle drama, Hub, map events). They add context conditions (`[situation | gate]`) so lines can be picked by game state.

| File | Lines | Covers |
|---|---|---|
| dialogue-01-rival-personalities.md | 240 | All 40 rival personalities x 6 situations (meet, pre, won, lost, soft, bye) |
| dialogue-02-party-banter.md | 157 | Pokémon-to-Pokémon and Pokémon-to-trainer lines by chem tier, bond, nature, stat, rival presence |
| dialogue-03-type-and-species-barks.md | 232 | 18 types, ~60 species, form/variant barks |
| dialogue-04-world-npcs-events.md | 167 | Hub NPCs, merchants, trainer classes, time/season/weather, "?" events, gym entrances |
| dialogue-05-memory-legacy-meta.md | 134 | Previous-run callbacks, rival arcs, nemesis, False Protagonist, streaks, death, meta-aware |
| dialogue-06-battle-ui-flavor.md | 184 | Ability, item, move text, achievement toasts, letters, hints, signs |

Conventions: placeholders `{player} {rival} {name} {rname} {A} {B} {enemy} {lastRun} {lastKiller} {n}`. Conditions after `|` map to data the game already tracks (`rivalProfiles`, `partyLife`, `rivalArcs`, legacy records). Next step if approved: add a `dialogueLines.json` with Zod schema keyed by situation and gate, then wire with seeded (non-gameplay) RNG. Some lines are tone-dark (death, nemesis); keep them behind the intensity setting.
