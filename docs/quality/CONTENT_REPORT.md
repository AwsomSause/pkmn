# Content report

Made by `npm run report:content -- --write`. Read-only: nothing in the game data was changed. Statuses and checks are explained in QUALITY_GATES.md.

Totals: species 1027, forms 591, moves 934, items 64, evolutions 675, meetableSpecies 1247, bosses 229, bossTeams 8244.

## Support status

| Kind | Supported | Limited | Disabled | Invalid |
|---|---|---|---|---|
| species | 1002 | 20 | 5 | 0 |
| form | 105 | 276 | 210 | 0 |
| move | 311 | 12 | 611 | 0 |
| item | 62 | 2 | 0 | 0 |
| evolution | 611 | 64 | 0 | 0 |

## Checks

| Check | Count | What it means |
|---|---|---|
| Unsupported moves (`unsupported-moves`) | 611 | Moves in the data that the battle engine cannot run yet; no Pokémon learns or uses them. |
| Level-up moves skipped (`unsupported-learnset-entries`) | 12549 | Level-up learnset entries skipped because the move is unsupported (species learn fewer moves than in the main games). |
| Species with no usable moves (`species-no-usable-moves`) | 5 | Species and forms with no supported level-up move at all (they could only use Struggle). |
| Meetable species with no usable moves (`meetable-species-no-usable-moves`) | 0 | Of those, ones a player can own (wild, starter, or by evolving). Should be zero. |
| Missing Pokémon sprites (`missing-sprites`) | 0 | Sprite or icon files a species points at that are not in public/assets (the game shows a fallback). |
| Missing cries (`missing-cries`) | 0 | Cry files a species points at that are not in public/assets. |
| Missing other assets (`missing-other-assets`) | 0 | Trainer, item, background, music, sound and font files the game asks for that are not in public/assets. |
| Map problems (`unreachable-map-nodes`) | 0 | Unreachable nodes, dead ends or rule breaks found in 402 generated stage and league maps. |
| Duplicate boss teams (`duplicate-boss-teams`) | 6 | Boss teams identical (same species, moves and training) to an earlier team, for the same boss or a different one. The battle is then the same fight at a different level. |
| Boss teams that differ only in training (`near-duplicate-boss-teams`) | 983 | Boss teams with the same species and moves as an earlier team; only the extra training stacks differ. |
| Boss moves the engine cannot run (`boss-unsupported-moves`) | 0 | Moves on boss teams that are unsupported (a boss would use a move the engine treats as plain damage or nothing). |
| Broken evolutions (`broken-evolutions`) | 0 | Evolutions a meetable Pokémon cannot complete: unknown target, wrong item, item nobody can get, level above the maximum, target with no moves, or a loop. |
| Unused balance settings (`unused-balance-settings`) | 0 | Settings in balance.json that no game code reads (changing them does nothing). |
| Save upgrades with no test (`untested-save-migrations`) | 0 | Save upgrades (old version to new) that no unit test loads an old save through. |
| Invalid content entries (`invalid-entries`) | 0 | Entries whose support status is "invalid" (broken data). |

### Unsupported moves: 611

- 10-000-000-volt-thunderbolt
- acid-downpour
- acrobatics
- acupressure
- after-you
- all-out-pummeling
- ally-switch
- anchor-shot
- ancient-power
- aqua-ring
- arm-thrust
- aromatherapy
- aromatic-mist
- assist
- assurance
- astral-barrage
- attract
- aura-wheel
- aurora-veil
- autotomize
- avalanche
- axe-kick
- baby-doll-eyes
- baddy-bad
- baneful-bunker
- ... and 586 more (`npm run report:content -- --only unsupported-moves`)

### Level-up moves skipped: 12549

- bulbasaur@7:leech-seed
- bulbasaur@30:worry-seed
- bulbasaur@33:synthesis
- bulbasaur@42:solar-beam
- ivysaur@4:leech-seed
- ivysaur@37:worry-seed
- ivysaur@40:synthesis
- ivysaur@49:solar-beam
- venusaur@4:leech-seed
- venusaur@11:petal-dance
- venusaur@40:worry-seed
- venusaur@45:synthesis
- venusaur@59:solar-beam
- venusaur-mega@4:leech-seed
- venusaur-mega@11:petal-dance
- venusaur-mega@40:worry-seed
- venusaur-mega@45:synthesis
- venusaur-mega@59:solar-beam
- venusaur-gmax@4:leech-seed
- venusaur-gmax@11:petal-dance
- venusaur-gmax@40:worry-seed
- venusaur-gmax@45:synthesis
- venusaur-gmax@59:solar-beam
- charmander@18:fury-swipes
- charmander@20:rage
- ... and 12524 more (`npm run report:content -- --only unsupported-learnset-entries`)

### Species with no usable moves: 5

- abra
- ditto
- unown
- smeargle
- cosmog

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
