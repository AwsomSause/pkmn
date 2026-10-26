# Feature interaction matrix (M8.6)

Bugs in a roguelike usually live where two systems meet: an item used in battle that should also count for an achievement, a reward replayed after a reload, an evolution in the middle of a level-up. This page lists how each pair of built systems touches, and whether a test proves the meeting point works. Checked on `main` on 2026-10-25; see SYSTEMS_AUDIT.md for each system on its own.

## Symbols

| Symbol | Meaning |
|---|---|
| ✅ | They interact and a test covers it (the test is named below the grid). |
| 🟡 | They interact, it works in the code, but no test checks the meeting point. |
| ❌ | They should interact and don't yet (a planned gap). |
| · | They don't touch. |

## Built systems

Battle (B), Catching (C), Items and Bag (I), Rewards (R), Shop (S), Map and stages (M), Difficulty (D), Bosses and league (L), Evolution (E), Friendship (F), Attributes (A), Trainers / archetypes (T), Run-Prep (P), Profile and Bank (O), Saves (V).

|   | B | C | I | R | S | M | D | L | E | F | A | T | P | O | V |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **B** Battle | | ✅1 | ✅2 | ✅3 | · | ✅4 | ✅5 | ✅6 | ✅7 | ✅8 | ✅9 | ✅10 | · | ✅11 | ✅12 |
| **C** Catching | | | ✅13 | · | · | · | · | ✅14 | 🟡15 | ✅16 | 🟡17 | ✅18 | · | ✅19 | ✅20 |
| **I** Items | | | | ✅21 | ✅22 | ✅23 | · | · | ✅24 | ✅25 | ✅26 | ✅27 | ✅28 | · | ✅29 |
| **R** Rewards | | | | | · | ✅30 | ✅31 | ✅32 | ✅33 | ✅34 | ✅35 | ✅36 | ✅37 | · | ✅38 |
| **S** Shop | | | | | | ✅39 | · | ✅40 | 🟡41 | · | ✅42 | ✅43 | · | ✅44 | 🟡45 |
| **M** Map | | | | | | | ✅46 | ✅47 | · | · | · | · | 🟡48 | · | ✅49 |
| **D** Difficulty | | | | | | | | ✅50 | ✅51 | · | · | ✅52 | · | · | · |
| **L** Bosses | | | | | | | | | 🟡53 | ✅54 | 🟡55 | · | · | ✅56 | ✅57 |
| **E** Evolution | | | | | | | | | | ✅58 | ✅59 | · | · | ✅60 | 🟡61 |
| **F** Friendship | | | | | | | | | | | ✅62 | · | · | · | ✅63 |
| **A** Attributes | | | | | | | | | | | | · | 🟡64 | ✅65 | ✅66 |
| **T** Trainers | | | | | | | | | | | | | ✅67 | ✅68 | ✅69 |
| **P** Run-Prep | | | | | | | | | | | | | | ✅70 | ✅71 |
| **O** Profile | | | | | | | | | | | | | | | ✅72 |

## Notes and evidence

1. Balls end a wild battle as "caught"; can't be thrown at a trainer's Pokémon. `milestone2.test.ts` "balls are used up, and cannot be thrown"; `milestone2.spec.ts`.
2. Bag items take the turn and the opponent still moves. `milestone2.test.ts`, `milestone2.spec.ts`.
3. Winning leads to the reward draft; the draft never repeats after a reload. `run.test.ts`, `GameSession` tests in `save.test.ts`.
4. Map nodes start wild, trainer and gym battles. `milestone3.test.ts` "a full stage".
5. Enemy levels come from the curve. `milestone3.test.ts` "difficulty".
6. Boss teams with their moves, training and AI. `bosses.test.ts`.
7. Evolution after a battle; fainted Pokémon don't evolve. `milestone2.test.ts`.
8. Wins raise and faints lower friendship. `milestone8_75.test.ts`.
9. Strength, Rage, Peace, Speed and Love change damage, Speed and survival. `milestone7.test.ts` "effects in the game".
10. Trainers' type damage passives (Misty). `milestone5.test.ts`.
11. Battles are counted for achievements. `milestone5.test.ts` "counting during a run".
12. The run is saved every turn; reload resumes the same battle. `save.test.ts`, `milestone1.spec.ts`.
13. Ball strength in the catch formula. `milestone2.test.ts` "catch probability".
14. No balls against trainers or bosses. `milestone2.test.ts`.
15. **🟡** A caught Pokémon that is already past its evolution level does not evolve until its next level-up or battle win. Works, untested.
16. Caught Pokémon start at the base friendship. `milestone8_75.test.ts`.
17. **🟡** Good raises the catch chance (`goodCatch` in `attributes.ts`); no test checks it.
18. Green's 0.85 capture modifier. `run.test.ts`.
19. Catches and shinies are counted and give Research Points. `milestone5.test.ts`.
20. A caught Pokémon waiting in a pending decision keeps its data through a save upgrade. `milestone8_75.test.ts`.
21. Item rewards go into the Bag. `run.test.ts`.
22. Bought items go into the Bag; attribute items never do. `milestone3.test.ts`, `milestone7.test.ts`.
23. Bag usable from the map. `milestone3.spec.ts`.
24. Stones evolve from the Bag; Eevee asks. `milestone6.test.ts`, `milestone6.spec.ts`.
25. Soothe Bell before the friendship threshold. `milestone8_75.test.ts`.
26. Shop Plates raise an attribute. `milestone7.spec.ts`.
27. Brock heals more and starts with Potions. `milestone5.test.ts`.
28. Preparation tokens add items. `milestone5_5.test.ts`.
29. Saves are refused if they name an item that no longer exists. `milestone2.test.ts`.
30. Harder routes give better reward odds. `milestone3.test.ts`.
31. Gyms use the best odds. `milestone3.test.ts`.
32. A reward draft after each Elite Four win (D13). `milestone4.test.ts`.
33. Rare Candy at the evolution level evolves. `milestone2.test.ts`.
34. Vitamins raise friendship. `milestone8_75.test.ts`.
35. Luck tilts the draft. `milestone7.test.ts`.
36. Green's money multiplier on money rewards. `run.test.ts`.
37. Draft rules (Blind, Type Focus) only affect the starter draft; the reward draft is unchanged. `milestone5_5.test.ts` "Standard draws the same three as before".
38. The reward screen shows the same five after a reload. `save.test.ts`.
39. Shops sit beside map nodes. `milestone3.spec.ts`.
40. Stock unlocks with badges. `milestone4.test.ts`.
41. **🟡** Evolution stones are sold in shops and work when bought; no test buys one and uses it.
42. Charisma lowers prices. `milestone7.test.ts`.
43. Giovanni's earlier stock and price passives. `milestone5.test.ts`.
44. Money spent is counted. `milestone5.test.ts`.
45. **🟡** A purchase is saved immediately; no test reloads straight after buying.
46. Column position sets the level. `milestone3.test.ts`.
47. The last column is the gym; the league is its own map. `milestone4.test.ts`.
48. **🟡** The run's seed builds the maps, so a copied seed replays the same maps; tested for the starter draft but not for maps from a Run-Prep seed.
49. Reload resumes on the map. `milestone3.spec.ts`.
50. League levels stay under the cap. `milestone4.test.ts`.
51. Ordinary trainers' Pokémon arrive evolved for their level. `milestone2.test.ts`.
52. Blue +2, Green −1 enemy levels. `run.test.ts`.
53. **🟡** Boss teams list their own (already evolved) species; no test checks that a boss Pokémon never evolves mid-run or into a disabled form. The content report checks the data side.
54. Boss wins raise friendship more. `milestone8_75.test.ts`.
55. **🟡** Boss wins count by the lead's type for attributes; covered for wild Pokémon only.
56. Boss wins are counted; Bank stipend per badge. `milestone5.test.ts`.
57. A reload during a boss battle keeps the team. `save.test.ts` (round-trip).
58. Friendship evolutions at 220. `milestone8_75.test.ts`.
59. Evolutions raise Love. `milestone7.test.ts`.
60. Evolutions are counted. `milestone5.test.ts`.
61. **🟡** When an item has several results the player chooses on the spot (`milestone6.test.ts`); the choice isn't saved, so a reload before choosing just asks again. No test reloads there.
62. Charisma scales friendship gains. `milestone8_75.test.ts`.
63. v7 runs get friendship on upgrade. `milestone8_75.test.ts`.
64. **🟡** The Run Build Summary shows attributes; no test changes one on the Preparation Desk.
65. Permanent attributes from lifetime counters. `milestone7.test.ts`.
66. Attribute keys upgraded in profile v5 and run v7. `milestone7.test.ts`.
67. A trainer's passives show on the Preparation Desk and Briefing. `milestone5_5.spec.ts`.
68. Trainers unlocked and claimed with Bank Credits. `milestone5.test.ts`, `milestone5.spec.ts`.
69. Saves are refused for an unknown trainer. `milestone2.test.ts`.
70. Pools and licenses bought with Research Points and Bank Credits. `milestone5_5.test.ts`.
71. Presets resolve choices that are no longer unlocked. `milestone5_5.test.ts`.
72. Run end applied to the profile exactly once. `save.test.ts` "finalizing the same run twice only counts it once".

## Planned systems: what they will have to touch

When these arrive, each meeting point below needs a test. The ❌ items are gaps today.

| Planned system | Must work with | Risk to watch |
|---|---|---|
| ❌ Advanced Mechanics (M8.5: Mega, Tera, Z, Dynamax) | Battle, Items (key items), Rewards, Shop, Evolution (a Mega is not an evolution), Bosses (boss Megas), Saves | A transformation must end with the battle and never be saved as the Pokémon's species. The 210 disabled forms switch on here; the content gate's `supported.form` number should rise. |
| ❌ Abilities and held items (M8.75 C) | Battle, Catching (abilities that change catch rates), Items, Evolution (trade with held item), Bosses, Saves | 12 moves with documented limits ("ignores abilities", "breaks screens") become real; update `src/quality/knownLimits.json`. |
| ❌ Unsupported moves (M8.75 C) | Battle, Bosses (the generator picks only supported moves today), Rewards (TMs, if added) | `unsupported-moves` and `unsupported-learnset-entries` should fall; `npm run report:balance` will move a lot. |
| ❌ Events and new map stops (M8.75 A) | Map, Rewards, Attributes, Friendship, Saves, Profile | An event must never apply twice on reload (effect ids from M8.9-0). |
| ❌ Levels to 500 (M8.75 G, D14) | Difficulty, Battle (stat formula), Experience, Bosses, Saves (schema maximums of 100) | The balance report's curve will change from region 3 on. |
| ❌ Story systems (M8.9-0, M8.9) | Battle events, every counter, Saves, RNG (new `story`/`hyper` streams must not shift existing rolls) | Determinism: run `run.test.ts` "the same seed ... reproduce the whole run" against an old seed. |
| ❌ Presentation cues (M9.5) | Battle events, Evolution, Bosses, Settings | A presentation failure must never change battle state. |
| ❌ Grand Region and ending (M9) | Regions, Bosses, Profile (victory), Saves | |
