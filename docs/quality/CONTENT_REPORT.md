# Content report

Made by `npm run report:content -- --write`. Read-only: nothing in the game data was changed. Statuses and checks are explained in QUALITY_GATES.md.

Totals: species 1027, forms 592, moves 934, items 253, evolutions 675, meetableSpecies 964, bosses 229, mechanics 42, bossTeams 8244.

## Support status

| Kind | Supported | Limited | Disabled | Invalid |
|---|---|---|---|---|
| species | 1025 | 2 | 0 | 0 |
| form | 105 | 456 | 31 | 0 |
| move | 839 | 78 | 17 | 0 |
| ability | 263 | 50 | 0 | 0 |
| item | 247 | 2 | 4 | 0 |
| evolution | 611 | 64 | 0 | 0 |
| mechanic | 35 | 4 | 3 | 0 |

## Mechanics

| Mechanic | Status | Notes |
|---|---|---|
| battle-engine | supported |  |
| damage | supported |  |
| moves | limited | Moves the engine cannot run are marked disabled in the move statuses; see the unsupported-moves check. |
| abilities | limited | Some abilities do nothing on purpose; see the ability statuses. |
| held-items | supported |  |
| terrain | supported |  |
| mega | supported |  |
| tera | supported |  |
| z-moves | supported |  |
| dynamax | supported |  |
| boss-transform | supported |  |
| hyper | supported |  |
| overdrive-events | disabled | Planned; owned by the Overdrive thread. |
| capture | supported |  |
| evolution | supported |  |
| friendship | supported |  |
| attributes | supported |  |
| map-generation | supported |  |
| encounters | supported |  |
| run-prep | supported |  |
| rewards | supported |  |
| map-items | supported |  |
| saves | supported |  |
| rivals | supported |  |
| story-engine | supported |  |
| mentorship | supported |  |
| legacy | supported |  |
| battle-drama | limited | The two Overdrive events are still planned. |
| bond-engine | supported |  |
| raids | supported |  |
| totems | supported |  |
| expeditions | supported |  |
| minigames | supported |  |
| service-stops | supported |  |
| trainer-quests | supported |  |
| trainer-evolutions | supported |  |
| trainer-perks | limited | Perks are added in batches; see the Trainers.md coverage tracker. |
| mastery | supported |  |
| game-events | supported |  |
| presentation | supported |  |
| double-battles | disabled | In progress in another thread; not on main yet. |
| egg-hatching | disabled | In progress in another thread; not on main yet. |

## Checks

| Check | Count | What it means |
|---|---|---|
| Unsupported moves (`unsupported-moves`) | 87 | Moves in the data that the battle engine cannot run yet; no Pokémon learns or uses them. |
| Level-up moves skipped (`unsupported-learnset-entries`) | 0 | Level-up learnset entries skipped because the move is unsupported (species learn fewer moves than in the main games). |
| Special forms in ordinary pools (`special-form-leaks`) | 0 | Delta, Z, Spooky or regional forms that an ordinary wild, trainer or starter pool can hand out. Should be zero: they are event-only. |
| Species with no usable moves (`species-no-usable-moves`) | 0 | Species and forms with no supported level-up move at all (they could only use Struggle). |
| Meetable species with no usable moves (`meetable-species-no-usable-moves`) | 0 | Of those, ones a player can own (wild, starter, or by evolving). Should be zero. |
| Missing Pokémon sprites (`missing-sprites`) | 0 | Sprite or icon files a species points at that are not in public/assets (the game shows a fallback). |
| Missing cries (`missing-cries`) | 0 | Cry files a species points at that are not in public/assets. |
| Missing other assets (`missing-other-assets`) | 0 | Trainer, item, background, music, sound and font files the game asks for that are not in public/assets. |
| Map problems (`unreachable-map-nodes`) | 0 | Unreachable nodes, dead ends or rule breaks found in 603 generated stage and league maps. |
| Duplicate boss teams (`duplicate-boss-teams`) | 6 | Boss teams identical (same species, moves and training) to an earlier team, for the same boss or a different one. The battle is then the same fight at a different level. |
| Boss teams that differ only in training (`near-duplicate-boss-teams`) | 983 | Boss teams with the same species and moves as an earlier team; only the extra training stacks differ. |
| Boss moves the engine cannot run (`boss-unsupported-moves`) | 0 | Moves on boss teams that are unsupported (a boss would use a move the engine treats as plain damage or nothing). |
| Broken evolutions (`broken-evolutions`) | 0 | Evolutions a meetable Pokémon cannot complete: unknown target, wrong item, item nobody can get, level above the maximum, target with no moves, or a loop. |
| Unused balance settings (`unused-balance-settings`) | 0 | Settings in balance.json that no game code reads (changing them does nothing). |
| Save upgrades with no test (`untested-save-migrations`) | 0 | Save upgrades (old version to new) that no unit test loads an old save through. |
| Invalid content entries (`invalid-entries`) | 0 | Entries whose support status is "invalid" (broken data). |
| Mechanics without code or tests (`mechanics-without-proof`) | 0 | Mechanics claimed as built whose code or unit test file is missing, so nothing shows they work. |

### Unsupported moves: 87

- 10-000-000-volt-thunderbolt
- acid-downpour
- all-out-pummeling
- black-hole-eclipse
- bloom-doom
- breakneck-blitz
- catastropika
- clangorous-soulblaze
- continental-crush
- corkscrew-crash
- devastating-drake
- extreme-evoboost
- g-max-befuddle
- g-max-cannonade
- g-max-centiferno
- g-max-chi-strike
- g-max-cuddle
- g-max-depletion
- g-max-drum-solo
- g-max-finale
- g-max-fireball
- g-max-foam-burst
- g-max-gold-rush
- g-max-gravitas
- g-max-hydrosnipe
- ... and 62 more (`npm run report:content -- --only unsupported-moves`)

### Duplicate boss teams: 6

- lenora gym #16 = lenora gym #15
- juniper elite #4 = juniper gym #16
- sophocles elite #4 = sophocles gym #16
- olivia gym #16 = olivia gym #15
- ryuki elite #3 = ryuki gym #13
- poppy elite #4 = poppy gym #16

### Boss teams that differ only in training: 983

- misty champion #7 ~ misty champion #5
- misty champion #9 ~ misty champion #6
- lt-surge elite #8 ~ lt-surge gym #14
- lt-surge elite #9 ~ lt-surge elite #5
- lt-surge champion #8 ~ lt-surge elite #10
- lt-surge champion #9 ~ lt-surge elite #7
- lt-surge champion #10 ~ lt-surge elite #7
- koga elite #9 ~ koga elite #6
- koga champion #2 ~ koga elite #8
- koga champion #5 ~ koga elite #10
- koga champion #6 ~ koga elite #10
- koga champion #7 ~ koga elite #10
- koga champion #8 ~ koga elite #8
- koga champion #9 ~ koga elite #10
- koga champion #10 ~ koga elite #10
- janine elite #10 ~ janine gym #16
- janine champion #4 ~ janine gym #15
- janine champion #7 ~ janine gym #15
- janine champion #8 ~ janine champion #2
- janine champion #10 ~ janine champion #6
- sabrina champion #4 ~ sabrina elite #10
- sabrina champion #6 ~ sabrina champion #3
- sabrina champion #8 ~ sabrina champion #7
- sabrina champion #9 ~ sabrina champion #7
- sabrina champion #10 ~ sabrina champion #7
- ... and 958 more (`npm run report:content -- --only near-duplicate-boss-teams`)
