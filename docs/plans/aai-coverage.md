# Advanced AI System port: coverage (left-out plan item 1.1)

Source: `[000_AAI] Advanced AI System.zip` (47 Ruby scripts for Pokémon Essentials). Our port lives in `src/core/battle/aai.ts` (move scoring) and `trainerAiTurn` / `moveValue` in `src/core/battle/engine.ts`. Every behaviour has a switch in `balance.trainerAi` (the `aai.*` booleans default to off in the schema and are on in `balance.json`). Smart trainers only (`battle.ai > 0`); the scorer uses no random numbers.

Statuses: BUILT, PART (some of the script), BATCH n (planned), EXISTS (the game already did this before the port), N/A (Essentials plumbing with nothing to port, reason given).

| # | Script | Status | What we have |
|---|---|---|---|
| 1 | 1_Core/0_Settings.rb | BUILT | `balance.trainerAi` and its `aai` switches |
| 2 | 1_Core/Core.rb | N/A | Essentials AI hook-up; our entry points are `chooseEnemyMove` and `trainerAiTurn` |
| 3 | 1_Core/Combat_Utilities.rb | BUILT | `estimateDamage`, `damageFromScore`, `aaiView` (speed order, reserves, threat) |
| 4 | 1_Core/Utilities.rb | N/A | Ruby helpers (type lookups, logging) covered by `core/pokemon.ts` and `battle/damage.ts` |
| 5 | 1_Core/Illusion_Perception.rb | BUILT | a disguised Zoroark fools the trainer: it scores against the disguise's types (`aai.illusion`) |
| 6 | 1_Core/Debug_Menu.rb | N/A | RPG Maker debug menu |
| 7 | 1_Core/OptionsMenu.rb | N/A | RPG Maker options entry (our switches are data) |
| 8 | 2_Move_Intelligence/0_Move_Scorer.rb | BUILT | damage, type, STAB, accuracy, KO and priority-KO bonus (Z8), set-up safety, status utility, recoil risk, contact punishment, protect repetition, Prankster/Dark, Sturdy/Sash, Knock Off, pivots, item disruption. Not ported: Moody, Mirror Herb, crit-stage scoring |
| 9 | 2_Move_Intelligence/Move_Categories.rb | BUILT | move effects in `moves.json` (`sideMove`, `disrupt`, `userFaint`, `protect`...) are the categories |
| 10 | 2_Move_Intelligence/Move_Memory.rb | BUILT | Taunt, Heal Block and screens read only moves the player has used this battle (`movesUsed`) |
| 11 | 2_Move_Intelligence/Special_Moves.rb | BUILT | Pain Split, Destiny Bond, Substitute, Memento / Healing Wish / Lunar Dance, Final Gambit, Endeavor, hazard removal |
| 12 | 2_Move_Intelligence/Disruption_Moves.rb | BUILT | Taunt, Encore, Disable, Heal Block, Torment, Knock Off, Trick / Switcheroo, Thief |
| 13 | 3_Combat_Mechanics/Recoil_Tracking.rb | BUILT | recoil, Mind Blown-style HP cost, crash on miss, at low HP |
| 14 | 3_Combat_Mechanics/Weather_Terrain_Wars.rb | BUILT | a weather or terrain move only when it helps the user more than the foe (boosted attack types, Swift Swim-style abilities, Sand/Snow typing), never when already up (`aai.fieldPlay`) |
| 15 | 3_Combat_Mechanics/Field_Effects.rb | BUILT | rain/sun damage (Utility Umbrella aware), Electric/Grassy/Psychic Terrain boosts, Misty Terrain vs Dragon, Grassy Terrain vs Earthquake, Psychic Terrain blocks priority, Misty/Electric Terrain status blocks, Trick Room only for the slower side. Gravity: kept at the engine's base value |
| 16 | 3_Combat_Mechanics/Advanced_Abilities.rb | BUILT | Soundproof, Bulletproof, Wind Rider, Earth Eater, Well-Baked Body, Thick Fat, Heatproof, Water Bubble, Purifying Salt, Dry Skin, Fluffy, Ice Scales, Fur Coat, Multiscale, Shadow Shield, Filter/Solid Rock/Prism Armor, Disguise/Ice Face, Mold Breaker; Volt Absorb-style and Levitate/Wonder Guard existed |
| 17 | 4_Battle_Strategy/Threat_Assessment.rb | BUILT | `threat` in `aaiView` (the foe's best hit) drives set-up safety, Destiny Bond, pivots and endgame; doubles target choice EXISTS in `battle/doubles.ts` |
| 18 | 4_Battle_Strategy/Team_Preview_Intelligence.rb | N/A | no team preview: trainers' order is fixed (ace last, Mega/Tera rules depend on it), and the player can't see the foe's team before battle |
| 19 | 4_Battle_Strategy/Prediction_System.rb | BUILT | it remembers the player's moves (Move Memory), reads the last move (Encore, Disable), and guesses a switch without random numbers: when it has a super-effective hit and the player's moves do under 30% to it, hazards and set-up get a free-turn bonus and attacks are also judged on the player's bench (`aai.prediction`). Not ported: pattern tracking over several turns |
| 20 | 4_Battle_Strategy/Role_Detection.rb | BUILT | sweeper / wall / staller counts per team feed the personality (row 34) |
| 21 | 4_Battle_Strategy/Tactical_Enhancements.rb | BUILT | Magic Bounce, Mold Breaker, Sturdy, Focus Sash, Multiscale, Disguise/Ice Face, Guts/Facade, Poison Heal, Trick Room setter, Belly Drum-style HP cost (set-up safety), two-turn moves (endgame). Not ported: Wish/Future Sight planning, Booster Energy |
| 22 | 4_Battle_Strategy/Setup_Recognition.rb | BUILT | no set-up into a KO; Haze / Roar-style moves against a +2 foe |
| 23 | 4_Battle_Strategy/Switch_Intelligence.rb | EXISTS | type-matchup switch and danger switch (`switchRatio`, `dangerSwitch`) |
| 24 | 4_Battle_Strategy/Item_Intelligence.rb | BUILT | reads the target's held items through their hooks: Air Balloon, damage-taken items, status-immunity items (`aai.itemReads`); Choice lock is the engine's. In-battle potions EXIST (`healBelow`, `maxItems`) |
| 25 | 4_Battle_Strategy/Advanced_Items.rb | BUILT | resist berries; Rocky Helmet (recoil); Trick with Choice items / Orbs / Sticky Barb (disruption). Not ported: Eject Button/Pack prediction |
| 26 | 4_Battle_Strategy/Strategic_Awareness.rb | PART | sack logic is the endgame rule and the danger switch; win-condition preservation is the ace-last order. Not ported: archetype labels for the player's team |
| 27 | 5_Format_Specific/Pivot_Moves.rb | BUILT | U-turn / Volt Switch worth more when the foe threatens half its HP and it has a teammate; Baton Pass only with +2 boosts to pass (`aai.pivot`) |
| 28 | 5_Format_Specific/Priority_Tiers.rb | BUILT | priority KO from the slower side (Z8); a slower user picks off a target under 25% with priority; no priority into Psychic Terrain |
| 29 | 5_Format_Specific/Doubles_Coordination.rb | EXISTS | doubles AI picks best move and target, avoids hitting its partner (`battle/doubles.ts`) |
| 30 | 5_Format_Specific/Speed_Tiers.rb | BUILT | speed order (Trick Room aware) in `aaiView`; Thunder Wave worth more when slower, less when faster; Tailwind when slower; Trick Room |
| 31 | 5_Format_Specific/Doubles_Strategy.rb | EXISTS | as row 29 |
| 32 | 6_Meta_Mechanics/Mega_Intelligence.rb | EXISTS | a boss's ace Mega Evolves as soon as it is out (the pack's advice: Mega at once) |
| 33 | 6_Meta_Mechanics/Terastallization_Intelligence.rb | BUILT | Tera waits until it gains or keeps STAB or saves it from a super-effective hit the player has shown, under 50% HP, or `gimmickMaxWait` turns (`aai.gimmickTiming`) |
| 34 | 6_Meta_Mechanics/Battle_Personalities.rb | BUILT | aggressive / defensive / balanced / hyper offensive, read from the trainer's team, with the pack's bonuses as score shares (`aai.personality`) |
| 35 | 6_Meta_Mechanics/Endgame_Scenarios.rb | BUILT | the last, slower Pokémon about to be KO'd only attacks, no two-turn moves (`aai.endgame`) |
| 36 | 6_Meta_Mechanics/ZMove_Intelligence.rb | BUILT | no Z-Move into an immune foe or a foe under 25% |
| 37 | 6_Meta_Mechanics/Dynamax_Intelligence.rb | BUILT | no Dynamax just to finish a foe under 25% |
| 38 | 6_Meta_Mechanics/Win_Conditions.rb | PART | KO bonus, endgame, set-up safety and the ace-last order. Not ported: naming the player's win condition |
| 39 | 7_Integration/Custom_Content.rb | N/A | hooks for fan-game moves; our moves are data |
| 40 | 7_Integration/Debug_Replacement.rb | N/A | Essentials debug logging |
| 41 | 7_Integration/Hotfixes.rb | N/A | patches for Essentials bugs |
| 42 | 7_Integration/Mechanics_Hooks.rb | N/A | Essentials event hooks |
| 43 | 7_Integration/Console_Fix.rb | N/A | Windows console fix |
| 44 | 7_Integration/DBK_Compatibility.rb | N/A | Deluxe Battle Kit plumbing |
| 45 | 7_Integration/Switch_Determinism.rb | EXISTS | our AI uses no gameplay RNG for switching |
| 46 | 7_Integration/Per_Trainer_Flags.rb | EXISTS | per-battle `battle.ai` skill by trainer class |
| 47 | 7_Integration/Switch_Turn_Guard.rb | EXISTS | `turnsOut` and `maxSwitches` stop switch loops |
