# Advanced AI System port: coverage (left-out plan item 1.1)

Source: `[000_AAI] Advanced AI System.zip` (47 Ruby scripts for Pokémon Essentials). Our port lives in `src/core/battle/aai.ts` (move scoring) and `trainerAiTurn` / `moveValue` in `src/core/battle/engine.ts`. Every behaviour has a switch in `balance.trainerAi` (the `aai.*` booleans default to off in the schema and are on in `balance.json`). Smart trainers only (`battle.ai > 0`); the scorer uses no random numbers.

Statuses: BUILT, PART (some of the script), BATCH n (planned), EXISTS (the game already did this before the port), N/A (Essentials plumbing with nothing to port, reason given).

| # | Script | Status | What we have |
|---|---|---|---|
| 1 | 1_Core/0_Settings.rb | BUILT | `balance.trainerAi` and its `aai` switches |
| 2 | 1_Core/Core.rb | N/A | Essentials AI hook-up; our entry points are `chooseEnemyMove` and `trainerAiTurn` |
| 3 | 1_Core/Combat_Utilities.rb | BUILT | `estimateDamage`, `damageFromScore`, `aaiView` (speed order, reserves, threat) |
| 4 | 1_Core/Utilities.rb | N/A | Ruby helpers (type lookups, logging) covered by `core/pokemon.ts` and `battle/damage.ts` |
| 5 | 1_Core/Illusion_Perception.rb | BATCH 3 | |
| 6 | 1_Core/Debug_Menu.rb | N/A | RPG Maker debug menu |
| 7 | 1_Core/OptionsMenu.rb | N/A | RPG Maker options entry (our switches are data) |
| 8 | 2_Move_Intelligence/0_Move_Scorer.rb | PART | damage, type, STAB, accuracy, KO and priority-KO bonus (Z8), set-up safety, status utility, recoil risk, contact punishment, protect repetition, Prankster/Dark, Sturdy/Sash; batch 2–3 add the rest |
| 9 | 2_Move_Intelligence/Move_Categories.rb | BUILT | move effects in `moves.json` (`sideMove`, `disrupt`, `userFaint`, `protect`...) are the categories |
| 10 | 2_Move_Intelligence/Move_Memory.rb | BUILT | Taunt, Heal Block and screens read only moves the player has used this battle (`movesUsed`) |
| 11 | 2_Move_Intelligence/Special_Moves.rb | BUILT | Pain Split, Destiny Bond, Substitute, Memento / Healing Wish / Lunar Dance, Final Gambit, Endeavor, hazard removal |
| 12 | 2_Move_Intelligence/Disruption_Moves.rb | BUILT | Taunt, Encore, Disable, Heal Block, Torment, Knock Off, Trick / Switcheroo, Thief |
| 13 | 3_Combat_Mechanics/Recoil_Tracking.rb | BUILT | recoil, Mind Blown-style HP cost, crash on miss, at low HP |
| 14 | 3_Combat_Mechanics/Weather_Terrain_Wars.rb | BUILT | a weather or terrain move only when it helps the user more than the foe (boosted attack types, Swift Swim-style abilities, Sand/Snow typing), never when already up (`aai.fieldPlay`) |
| 15 | 3_Combat_Mechanics/Field_Effects.rb | BUILT | rain/sun damage (Utility Umbrella aware), Electric/Grassy/Psychic Terrain boosts, Misty Terrain vs Dragon, Grassy Terrain vs Earthquake, Psychic Terrain blocks priority, Misty/Electric Terrain status blocks, Trick Room only for the slower side. Gravity: kept at the engine's base value |
| 16 | 3_Combat_Mechanics/Advanced_Abilities.rb | PART | Soundproof, Bulletproof, Wind Rider, Earth Eater, Well-Baked Body, Thick Fat, Heatproof, Water Bubble, Purifying Salt, Dry Skin, Fluffy, Ice Scales, Fur Coat, Multiscale, Shadow Shield, Filter/Solid Rock/Prism Armor, Disguise/Ice Face, Mold Breaker; Volt Absorb-style and Levitate/Wonder Guard existed |
| 17 | 4_Battle_Strategy/Threat_Assessment.rb | BATCH 3 | |
| 18 | 4_Battle_Strategy/Team_Preview_Intelligence.rb | BATCH 3 | |
| 19 | 4_Battle_Strategy/Prediction_System.rb | BATCH 3 | |
| 20 | 4_Battle_Strategy/Role_Detection.rb | BATCH 3 | |
| 21 | 4_Battle_Strategy/Tactical_Enhancements.rb | PART | Magic Bounce, Good as Gold, Sturdy, Focus Sash, Multiscale, Disguise/Ice Face, Guts/Facade, Poison Heal; the rest in batch 2–3 |
| 22 | 4_Battle_Strategy/Setup_Recognition.rb | BUILT | no set-up into a KO; Haze / Roar-style moves against a +2 foe |
| 23 | 4_Battle_Strategy/Switch_Intelligence.rb | EXISTS | type-matchup switch and danger switch (`switchRatio`, `dangerSwitch`) |
| 24 | 4_Battle_Strategy/Item_Intelligence.rb | BATCH 3 | (in-battle potions EXIST: `healBelow`, `maxItems`) |
| 25 | 4_Battle_Strategy/Advanced_Items.rb | BATCH 3 | |
| 26 | 4_Battle_Strategy/Strategic_Awareness.rb | BATCH 3 | |
| 27 | 5_Format_Specific/Pivot_Moves.rb | BATCH 3 | |
| 28 | 5_Format_Specific/Priority_Tiers.rb | BUILT | priority KO from the slower side (Z8); a slower user picks off a target under 25% with priority; no priority into Psychic Terrain |
| 29 | 5_Format_Specific/Doubles_Coordination.rb | EXISTS | doubles AI picks best move and target, avoids hitting its partner (`battle/doubles.ts`) |
| 30 | 5_Format_Specific/Speed_Tiers.rb | BUILT | speed order (Trick Room aware) in `aaiView`; Thunder Wave worth more when slower, less when faster; Tailwind when slower; Trick Room |
| 31 | 5_Format_Specific/Doubles_Strategy.rb | EXISTS | as row 29 |
| 32 | 6_Meta_Mechanics/Mega_Intelligence.rb | BATCH 3 | |
| 33 | 6_Meta_Mechanics/Terastallization_Intelligence.rb | BATCH 3 | |
| 34 | 6_Meta_Mechanics/Battle_Personalities.rb | BATCH 3 | |
| 35 | 6_Meta_Mechanics/Endgame_Scenarios.rb | BATCH 3 | |
| 36 | 6_Meta_Mechanics/ZMove_Intelligence.rb | BATCH 3 | |
| 37 | 6_Meta_Mechanics/Dynamax_Intelligence.rb | BATCH 3 | |
| 38 | 6_Meta_Mechanics/Win_Conditions.rb | BATCH 3 | |
| 39 | 7_Integration/Custom_Content.rb | N/A | hooks for fan-game moves; our moves are data |
| 40 | 7_Integration/Debug_Replacement.rb | N/A | Essentials debug logging |
| 41 | 7_Integration/Hotfixes.rb | N/A | patches for Essentials bugs |
| 42 | 7_Integration/Mechanics_Hooks.rb | N/A | Essentials event hooks |
| 43 | 7_Integration/Console_Fix.rb | N/A | Windows console fix |
| 44 | 7_Integration/DBK_Compatibility.rb | N/A | Deluxe Battle Kit plumbing |
| 45 | 7_Integration/Switch_Determinism.rb | EXISTS | our AI uses no gameplay RNG for switching |
| 46 | 7_Integration/Per_Trainer_Flags.rb | EXISTS | per-battle `battle.ai` skill by trainer class |
| 47 | 7_Integration/Switch_Turn_Guard.rb | EXISTS | `turnsOut` and `maxSwitches` stop switch loops |
