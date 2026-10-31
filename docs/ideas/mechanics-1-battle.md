# New Mechanics 1/4: Battle (M-001 to M-029)

Part of the 100+ New Mechanics library (116 total across 4 files). Design only; nothing here is built or approved. These are NEW versus `ideas/mechanics.md` (120 ideas A-L) and versus shipped systems (Last Stand, Perfect Counter, Brace, Team Chemistry labels, Nemesis, grudges, revenge pacts, terrain, Totems, raids, Z/Dynamax/Mega, SOS calls).

Format per entry: **Rules** / **Loop** (what the player does turn to turn) / **Interacts** (existing systems it touches) / **Balance** / **Cx** (implementation complexity: Low, Med, High).
All outcomes must stay deterministic: new RNG goes on a NEW named seeded stream so existing rolls never change. Presentation (animations, banners) never decides results.

---

### M-001 Stance Shift
**Rules:** Every Pokémon has three stances: Strike (+15% damage dealt, +10% taken), Guard (-15% taken, -10% dealt), Flow (no modifier, moves that hit first get +1 accuracy tier). Shifting is a free action once per turn but a shifted Pokémon acts one speed tier later that turn. **Loop:** read the board, shift before committing the move. **Interacts:** speed order, Protect, boss phases (bosses use stances too, shown by a sprite aura). **Balance:** the "act later" cost stops permanent Strike; species have a default stance. **Cx:** Med.

### M-002 Reaction Slot
**Rules:** Each Pokémon owns one Reaction (Dodge, Brace, Deflect, Taunt-Back) chosen by the move category it knows most. When it is targeted you may spend the Reaction after the move is announced: Dodge avoids a physical hit, Brace halves it, Deflect redirects a status move, Taunt-Back flinches an attacker. Cooldown 4 turns. **Loop:** a defensive layer with timing: use now or save for the big hit. **Interacts:** Perfect Counter (boss tells), Protect, Abilities. **Balance:** reactions cannot answer multi-target spread moves; the AI uses them by Behavior Profile (M-005). **Cx:** Med.

### M-003 Move Fusion
**Rules:** Two moves adjacent in the move list can be fused for one turn into a hybrid (Surf + Thunderbolt = Electrified Wave: Water/Electric dual-type, hits both foes in doubles). Costs 1 PP from each; power is 60% of the sum, the type is whichever combined chart is better. Only once per battle per Pokémon. **Loop:** move order in the list becomes a build decision. **Interacts:** TM tutoring, type chart, move mastery. **Balance:** generated name and animation come from a table of 150 authored fusions; others fall back to "Mixed Strike" (neutral). **Cx:** High.

### M-004 Observe Turn
**Rules:** Spend a turn (Observe command) to study the active foe. For the next 3 turns you see the foe's next-move category (attack, status, switch, protect). Observe by a Pokémon with high Sp. Def or Intimidate-family abilities also reveals the foe's held item. **Loop:** trade tempo for information in fights that are not boss tells. **Interacts:** Telegraphed boss moves, Behavior Profiles, trainer taunts. **Balance:** foes on Protect or Sleep waste your Observe; bosses show only their category, never the exact move. **Cx:** Low.

### M-005 Behavior Profiles
**Rules:** Every trainer and wild AI has one readable profile: Coward (switches under 30% HP), Gambler (50% to pick the riskiest move), Mirror (copies your last move type), Bully (targets the weakest ally), Planner (sets up before attacking), Stubborn (never switches). Profiles are revealed by Observe (M-004), by Rival memory, or by defeating the trainer once. **Loop:** exploit a profile with the right lead. **Interacts:** trainer AI, Nemesis (a nemesis learns a counter-profile), Living Rival. **Balance:** profiles change AI choices only, never stats. **Cx:** Med.

### M-006 Study Foe
**Rules:** When a Pokémon survives a foe's move that is super-effective on it, it "studies" the move. Studied moves become Loaner moves: for the rest of that battle the Pokémon can replace one move slot with a copy at 70% power and 5 PP. After the battle, 1 loaner per run may be kept as a Memory (one extra learnable move). **Loop:** punishment becomes a resource. **Interacts:** Mimic/Copycat, move tutoring, Silvally Memories. **Balance:** cannot study signature or boss moves; max one loaner active. **Cx:** Med.

### M-007 Delay Marks
**Rules:** Any Pokémon may spend a turn to place a Delay Mark on a foe slot: the chosen move fires in 2 turns for full power regardless of who is there, and bypasses Protect. The foe can dodge by switching out of the marked slot (the mark then hits the incoming Pokémon at -30%). **Loop:** predict the AI, or force a switch. **Interacts:** Future Sight, hazards, Behavior Profiles (Coward switches into marks). **Balance:** a Delay Mark costs the turn's attack; only one mark per side at a time. **Cx:** Med.

### M-008 Called Shots
**Rules:** Single-target physical moves can aim at a body part: Head (+crit chance, -accuracy), Body (normal), Limbs (lowers target's Speed one stage on hit, -damage). Species have a part map: Charizard's wings can be clipped to ground it; Chansey has no weak head. **Loop:** choosing aim per matchup. **Interacts:** Flying immunity to ground, stat stages, Boss weakness windows. **Balance:** accuracy penalty scales with foe's Speed; bosses have armored parts that need Guard Break first. **Cx:** High.

### M-009 Ring Positions
**Rules:** The arena in singles is a 5-position line (the Pokémon stand at 2 and 4). Heavy hits (Superpower, Earthquake, boss slams) shove the target one position; being shoved off the edge costs it a turn ("Ring Out"). Light, airborne Pokémon move more. Terrain can add pits, walls or ice. **Loop:** positioning makes weight and move choice meaningful. **Interacts:** terrain, Weight Poise (M-014), hazards, Gym field rules. **Balance:** bosses and Totems are immune to ring-outs but can be shoved for a stagger. **Cx:** High.

### M-010 Absorb Reservoir
**Rules:** Pokémon with absorb abilities (Volt Absorb, Water Absorb, Flash Fire, Sap Sipper, Storm Drain) store the absorbed hit in a reservoir (max 3 charges) instead of just healing. Spend all charges to release a burst of that type at 40% of the stored damage per charge. **Loop:** bait the foe into feeding you. **Interacts:** Abilities, type matchups, Elemental Reactions (M-020). **Balance:** releasing resets the reservoir; foes with Mold Breaker ignore it. **Cx:** Med.

### M-011 Duel Lock
**Rules:** Either side may issue a Duel: the two active Pokémon are locked together for 3 turns (no switching or targeting others). While locked both gain +1 Speed and take 10% less from outside sources; the winner (higher HP% afterwards or KO) recovers 15% HP and gets a boost. **Loop:** use a Duel to deny a sweeper support, or to claim a clean fight. **Interacts:** doubles, Showdown (M-022), rivalry moments. **Balance:** the AI issues duels from Behavior Profile (Bully, Gambler); duels cannot be called on bosses unless Guard-broken. **Cx:** Med.

### M-012 Ability Awakening
**Rules:** Each Pokémon's hidden ability sleeps until a per-species condition is met in battle (e.g. Gyarados lands 3 hits while Intimidated; Gardevoir heals an ally; Pikachu is hit by Electric). An awakened ability lasts that battle and, if awakened in 3 separate battles, unlocks permanently. **Loop:** play to a Pokémon's story to unlock its best self. **Interacts:** Ability data, mastery, Overdrive. **Balance:** 30 species authored at first; condition progress is shown as a ring around the sprite. **Cx:** High.

### M-013 Field Saturation
**Rules:** Each time a move of one type is used, the field gains one Saturation of that type (shared by both sides). At 3 saturations of a type the field "saturates": all moves of that type deal +25% for both sides for 3 turns, then it clears. Using opposing types removes one saturation. **Loop:** feed or starve the field; sneak the third hit for yourself. **Interacts:** weather, terrain, Type Resonance, boss arenas. **Balance:** saturation caps at one type; weather setters count double. **Cx:** Med.

### M-014 Weight Poise
**Rules:** Each Pokémon has Poise = weight class (1-5) plus Defense bonus. A hit that deals more than the target's Poise threshold of HP% staggers it (loses 25 Speed for the turn and cannot use priority). Heavy species resist stagger; light ones can be knocked around. Grass Knot and Low Kick scale with the same table. **Loop:** heavy bruisers can lock down fast glass cannons. **Interacts:** Guard break (bosses), Ring Positions, priority moves. **Balance:** stagger cannot chain on the same Pokémon within 2 turns. **Cx:** Med.

### M-015 Final Act
**Rules:** When a Pokémon faints it gets a Final Act (once per battle): Pass (give a stat-boost it had to the next Pokémon), Seed (set a random hazard on the foe's side), Cheer (heal an ally 20%), or Last Word (the foe loses 1 Defense). The player chooses from 2 options based on the Pokémon's personality. **Loop:** KOs have a silver lining, so tradeoff attacks become tactical. **Interacts:** Memento, personality, chemistry, Last Stand (a Pokémon that triggers Last Stand cannot also Final Act). **Balance:** options are small; Acts do not stack with revenge pacts. **Cx:** Med.

### M-016 Assist Call
**Rules:** Bench Pokémon fill an Assist meter by watching (1 per turn, +1 more if bonded to the active). At 3 charges you can call one bench member to fire a single move at 50% power from outside the field, without switching in, using its first damaging move. **Loop:** keep the bench relevant and plan who gets called. **Interacts:** Tag-in strike, bond levels, chemistry labels (Competitive Duo calls at 2). **Balance:** one Assist per battle per Pokémon; a fainted bench member cannot assist. **Cx:** Med.

### M-017 Pattern Reading
**Rules:** The foe's AI remembers your last 3 move types in the battle. If you repeat a type, it prepares (+10% resistance reaction, ranked by Behavior Profile). If you use 3 different types in a row, you get "Unpredictable" for one turn: your next hit cannot be dodged or protected against. **Loop:** variety pays; repetition gets answered. **Interacts:** Combo chains, Stat streaks, Observe. **Balance:** spread moves count as no type; bosses read patterns at +10%. **Cx:** Low.

### M-018 Weather Tug-of-War
**Rules:** Weather has a Dominance meter. Each weather-setting move or ability pushes it +1 toward its side; a rival weather pushes it back. Weather held at Dominance 3+ becomes Entrenched (cannot be replaced for 5 turns, boosts that weather's effects +10%). **Loop:** fight over the sky instead of simply replacing it. **Interacts:** Drought, Drizzle, Sand Stream, weather forecast, battlebacks. **Balance:** switching setters in costs a turn; Entrenched weather shows an aura animation (cue only). **Cx:** Med.

### M-019 Stat Barter
**Rules:** Once per battle either side can offer a swap: exchange one of your stat stages with one of the foe's (Power Swap generalised, including negatives). The AI accepts based on Behavior Profile (Gambler always, Planner if it wins stages). **Loop:** dump your drops or raid their boosts. **Interacts:** stat streaks, Haze, Skill Swap, Heart Swap. **Balance:** limited to the stat with the most stages; boss-immune. **Cx:** Low.

### M-020 Elemental Reactions
**Rules:** Hits leave a Brand on the target (Scorch from Fire, Soak from Water, Static from Electric, Frost from Ice, Spore from Grass/Poison). A follow-up of a reacting type triggers a reaction: Soak + Electric = Shock Burst (+30%, hits the adjacent foe), Scorch + Water = Steam (Accuracy -1 for the foe), Frost + Fire = Melt (+50%), Spore + Fire = Ember Cloud (poison DoT). Brands last 2 turns. **Loop:** sequence moves across two Pokémon to detonate combos. **Interacts:** type chart, Absorb Reservoir, Field Saturation, doubles, Party synergy codex. **Balance:** reaction tables stored in data; bosses carry 1 brand at a time. **Cx:** High.

### M-021 Tempo Tides
**Rules:** The arena cycles between High Tide (slow moves +10% power, Speed ties go to the lower Speed) and Low Tide (priority and fast moves +10%). The current tide changes every 3 turns and is shown on the turn bar. **Loop:** time your setup and big attacks to the tide. **Interacts:** Trick Room, priority moves, weather, boss schedule. **Balance:** Trick Room swaps tides; Dynamax stops the change. **Cx:** Low.

### M-022 Showdown
**Rules:** When each side has one Pokémon left, the battle enters a Showdown: all stat stages reset, both gain a 20% Barrier, and a gauge fills with each move used; the first side to fill it can unleash a signature Finisher. If either side has a nemesis or rival ace, the Showdown includes a cue and unique line. **Loop:** the final duel is its own mini-game. **Interacts:** Nemesis, Living Rival, Last Stand, Overdrive. **Balance:** Finishers are 1.5x moves with no extra effect; disabled in raids. **Cx:** Med.

### M-023 Spare Move Pocket
**Rules:** Each Pokémon can carry one fifth move that is a single-use Pocket Move per battle (e.g. a Z-move-lite or a TM the Pokémon cannot normally learn at half PP). The Pocket Move is chosen at heal stops. **Loop:** a surprise tool for the right matchup. **Interacts:** TM tutoring, Z-Moves, held items. **Balance:** Pocket Moves have no PP restore and cannot be copied. **Cx:** Low.

### M-024 Scout and Lead Bid
**Rules:** Before a trainer battle you see silhouettes of the foe's first two Pokémon (and types, not species) and arrange your lead order in a short pick screen. In raids you also see which type the shield will require. **Loop:** the battle starts with a decision. **Interacts:** Trainer taunts, Observe, formation presets. **Balance:** the foe's lead is still revealed on the first turn; unknown boss leads show "???" **Cx:** Low.

### M-025 Overheal Barrier
**Rules:** Healing beyond max HP converts to a Barrier (up to 25% of max HP) that absorbs damage before HP and fades at the end of the battle. Leftovers and Drain moves also overheal. **Loop:** healing at full HP is no longer a waste. **Interacts:** Leech Seed, Wish, Pressure stacks, Overkill carry. **Balance:** Barrier does not stack with Substitute; Sudden death rules ignore it. **Cx:** Low.

### M-026 Exposed Turn
**Rules:** A status move that fails or lands (setup, hazards, weather) leaves the user Exposed for that turn: the foe's next hit cannot be blocked by Protect or Reaction and takes +10%. The AI does the same. **Loop:** setup is a real risk. **Interacts:** Counter window, Protect spam, Substitute. **Balance:** Pokémon with Focus Sash, Magic Guard or a Substitute are immune. **Cx:** Low.

### M-027 Link Ability
**Rules:** Two party members whose abilities rhyme (Drizzle + Swift Swim, Intimidate + Defiant opponent, Lightning Rod + Plus) form a Link when both are on the field. The Link adds a small effect (rain+swimmer: +1 Speed again; Intimidate+Anger Point: opponent starts with Taunt). Discovered Links are logged in the party codex. **Loop:** pair Pokémon deliberately. **Interacts:** Abilities, Party synergy codex, Team chemistry. **Balance:** Links are small, never doubles stats; around 40 authored. **Cx:** Med.

### M-028 Active Held Items
**Rules:** Some held items gain a Use command: activate once per battle for an effect scaled to the item (Choice Scarf: swap Speed order for a turn; Eject Button: free pivot; Leftovers: Rest meal instead of passive). While used it is consumed for the battle and rearmed at a heal stop. **Loop:** items become decisions, not passive stats. **Interacts:** Held items, Item curses, Set bonuses. **Balance:** each item is either passive or active, never both. **Cx:** Med.

### M-029 Marked Target Contract
**Rules:** Before a trainer battle you may mark one of their Pokémon as your Contract target. KO it first for double prize money and a rep point; if it KOs one of yours first you lose a small amount of money and the foe's morale rises. **Loop:** pick fights within the fight. **Interacts:** Nemesis, trainer taunts, Ante (M-101, part 4), Rival adaptation. **Balance:** only one mark; boss and raid contracts are disabled. **Cx:** Low.
