# New Mechanics 3/4: Catching, evolution, resources and party management (M-058 to M-085)

Part 3 of 4. Design only. Existing: weakened capture bonus, lures, alpha encounters, chains, befriend, egg incubation, item durability, crafting, held-item slots, bag, shops, perks. These add new decisions on top.
Format: **Rules / Loop / Interacts / Balance / Cx**.

---

### M-058 Parley
**Rules:** Instead of fighting some wild encounters you may Parley: a 3-round exchange where the wild Pokémon's mood (shown by cry and posture) reacts to your offers (a berry, a move display, a bonded partner standing forward). Success: it joins as a recruit, leaves a gift, or guides you; failure starts a normal battle with its stats +1. **Loop:** a non-battle encounter route. **Interacts:** Mon-Speak (M-050), Kin Recognition, Flavor Palate. **Balance:** the offer set is seeded per encounter; uncatchables cannot be parleyed. **Cx:** High.

### M-059 Trail Tracking
**Rules:** A hunter Pokémon (Growlithe, Houndour, Linoone) can follow Trail Marks left by a species across 2-4 nodes. Following correctly leads to a guaranteed encounter with that species at a chosen level; skipping the trail loses it. Tracks are shown as paw prints on the map. **Loop:** commit to a hunt across the route. **Interacts:** Roaming Pokémon, Habitat reading, Shiny odds. **Balance:** one active trail; trail rewards are modest, never legendary. **Cx:** Med.

### M-060 Capture Style
**Rules:** Pick a Style before throwing: Gentle (uses berries and talking; success lower but the mon gains Trust), Forceful (heavy damage; success higher but resentment lowers early Trust), Trap (needs a held item; success highest but the mon starts Skittish). The style stamps the Pokémon's Origin Imprint (M-052). **Loop:** every catch is a character choice. **Interacts:** Befriend, Weakened capture, Personality. **Balance:** style never changes IV/level; differences are early-game friendship and mood. **Cx:** Med.

### M-061 Capture Contracts
**Rules:** Announce a Contract target at an encounter node (e.g. "I'll catch a Ghost type here") for a +10% catch rate and a bonus if met; failing deducts a small amount. Contracts stack with chain bonuses. **Loop:** commitment as a risk. **Interacts:** Ante (M-101), Pokédex goals, Shiny meter. **Balance:** only one contract at a time; contract bonus applies only to named types. **Cx:** Low.

### M-062 Flee Tells
**Rules:** Wild Pokémon telegraph flee chance (a tail twitch, glance back). The bar fills each turn; at full the Pokémon flees unless cornered by Trap, Mean Look, or terrain walls. Cornered Pokémon fight harder (+10%). **Loop:** the catch window is a clock. **Interacts:** Catch rate, Mean Look, Ring Positions. **Balance:** speed matters; fast species have faster bars. **Cx:** Med.

### M-063 Flavor Lures
**Rules:** Lures are now flavors, not generic bait. Spicy attracts Fire/Fighting, Dry attracts Water/Ice, Sweet attracts Fairy/Grass, Sour attracts Poison/Bug, Bitter attracts Dark/Ghost. Combined flavors bias deeper (Spicy + Sour = Ground). Lures have a time limit. **Loop:** hunt a specific type through cooking. **Interacts:** Flavor Palate (M-039), Lure items, Encounter director. **Balance:** only biases the weighted table; never guarantees. **Cx:** Low.

### M-064 Wild Goodwill
**Rules:** Each species family has a Goodwill value toward you. Befriending, sparing and parleying raises it; catching rapidly (chain) lowers it. High Goodwill makes the family appear more kindly (Parley easier, Gifts, guidance); low Goodwill makes them flee earlier or aggro. **Loop:** how you treat the wild shapes the next encounters. **Interacts:** Encounter director, Legacy, Events. **Balance:** goodwill is per run, with small carryover as a Legacy trait. **Cx:** Med.

### M-065 Evolution Trials
**Rules:** Some evolutions require a Trial, not a level: survive 3 turns at 1/4 HP, win a battle without taking super-effective hits, lead a Duel, hold a Weather for 5 turns. Trials show as a gold ring, tracked during battles. Completing a trial lets you evolve at the next safe moment. **Loop:** evolution becomes an achievement. **Interacts:** Evolution data, Move mastery, Mega. **Balance:** trials are short and authored; level evolution remains a fallback at +10 levels. **Cx:** High.

### M-066 Evolution Hesitation
**Rules:** When a Pokémon is ready to evolve it may Hesitate (based on personality and bonds): it pauses and the player is shown a choice: evolve now, wait, or stay as is. Staying gives Eternal Form: a permanent stat bonus and a cosmetic aura but no further evolution. Waiting offers a better trigger later. **Loop:** evolution is a choice with consequences. **Interacts:** Everstone, Personality, Mastery. **Balance:** Eternal bonuses capped by BST difference to stay fair. **Cx:** Med.

### M-067 Personality Evolution
**Rules:** Branching evolutions (Eevee, Wurmple, Tyrogue, Ralts) can be driven by personality and chemistry in addition to items: Eevee goes Umbreon with a Calm companion at night, Sylveon with a Close partner, Leafeon after a long hike with nature chemistry. A hint appears in the Album. **Loop:** evolve by living the story. **Interacts:** Party Life, Chemistry stages, Time of day. **Balance:** items still force evolutions; hints prevent hidden fail states. **Cx:** Med.

### M-068 Evolution Echo
**Rules:** Once per Pokémon per run, borrow the next evolution's form for a single battle (Echo): stats shift to the evolved ones for 5 turns, with a ghostly glow, and the Pokémon "remembers" it (+15% progress toward evolving). **Loop:** preview a form and speed progress. **Interacts:** Mega, Dynamax cues, Evolution Trials. **Balance:** Echo costs a rare item; it cannot be used in raids. **Cx:** Med.

### M-069 Revert Rite
**Rules:** At a shrine node you may Revert an evolved Pokémon to its earlier form in exchange for a permanent perk (lower level, higher friendship, a move retained, a second chance at a different evolution). Reverting loses stat totals but returns Candy. **Loop:** retreat as strategy. **Interacts:** Branching evolutions, Trial, Candies. **Balance:** reversion limited to once per run per Pokémon. **Cx:** Med.

### M-070 Merge Rite
**Rules:** Merge two Pokémon of the same species at a shrine: keep the better IVs of each, average levels, and gain a Fusion Aura (a mark on the sprite). The sacrificed Pokémon leaves a keepsake; chemistry carries partial. **Loop:** duplicates become useful. **Interacts:** IV system, Release for reward, Legacy. **Balance:** merged Pokémon cannot be merged again; the sacrificed one is gone. **Cx:** Med.

### M-071 Delivery Cargo
**Rules:** NPCs ask you to carry a Parcel (an egg, a letter, a crate, a cursed idol) across N nodes. Parcels occupy a bag slot and may have Conditions (stay cold, avoid water, never battle). Delivering earns rewards; failing costs rep. **Loop:** a travel puzzle layered over the map. **Interacts:** Events, Weather, Bag Tetris. **Balance:** only one parcel at a time; cancel for a small fee. **Cx:** Med.

### M-072 Bag Tetris
**Rules:** The bag is a grid. Items occupy shapes (Potion 1x1, Rope 1x3, Machine 2x2). Weight and shape matter; gear upgrades expand the grid. Dumping items at shops or giving them to Pokémon frees space. **Loop:** manage a packing puzzle. **Interacts:** Parcels, Rations, Shops. **Balance:** a "compact bag" setting reverts to simple counts for accessibility. **Cx:** High.

### M-073 Freshness Clock
**Rules:** Berries, meals and herbs have a Freshness value that falls each node: Fresh (full effect), Ripe (+10% effect), Stale (-50%), Spoiled (poisons the eater). Preservation items or the Cooling field talent pause the clock. **Loop:** use consumables in time. **Interacts:** Flavor Palate, Rations, Item durability. **Balance:** tooltips show the clock; spoilage never silently harms. **Cx:** Low.

### M-074 Rations
**Rules:** Travel consumes Rations. Each node costs a ration; well-fed parties get a small boost, hungry ones get Hungry (-5% Speed) and increased irritability. Rations come from shops, foraging, cooking. Pokémon with Pickup/Forage abilities produce rations. **Loop:** supply pressure shapes route length. **Interacts:** Rest stops, Foraging, Mood. **Balance:** costs scale with party size; an "assist" setting gives free rations. **Cx:** Med.

### M-075 Loan Sharks
**Rules:** An NPC offers money now with interest due after N nodes. Missing the payment triggers a Collector trainer encounter with escalating strength. Paying early earns a discount and a gift. **Loop:** borrowing as a risk lever. **Interacts:** Economy, Trainers, Notoriety (M-102). **Balance:** max loan capped by region; the collector's team is shown at signing. **Cx:** Med.

### M-076 Barter Ladder
**Rules:** A trader accepts swaps, offering a slightly better item each time you chain deals (berry → herb → TM → Ever-item). You may stop at any step; each step has a growing chance the trader leaves. **Loop:** the thrill of trade-up. **Interacts:** Traveling merchants, Item curses, Rare drops. **Balance:** seeded and preview-safe: the chain is rolled at node creation, never at click. **Cx:** Low.

### M-077 Regional Coins
**Rules:** Each region uses its own coin as well as ₽. Coins are gained from local trainers, events and mini-games; they buy region-only gear and expire when you leave unless exchanged at a rate shown on the map. **Loop:** spend where you earn. **Interacts:** Shops, Exchange bureau events, Regions. **Balance:** exchange is lossy (-20%); carrying leftover coins gives a keepsake. **Cx:** Med.

### M-078 Capacity Points
**Rules:** Instead of 6 slots, the active party has 12 Capacity: Pokémon cost 1-4 by rarity/BST (Magikarp 1, Dragapult 4). You can field many weak Pokémon or a few legends. The cap rises with badges. **Loop:** team building is knapsack. **Interacts:** Party size, Role slots, Challenge modes. **Balance:** costs are data-driven; "Classic slots" remains default for normal runs. **Cx:** High.

### M-079 Reserve Duties
**Rules:** Pokémon not in the active party are assigned Duties at each node: Forager (+ration), Lookout (reveals ambushes), Medic (+5% healing at rest), Guard (-enemy ambush), Tinkerer (crafts). Duties depend on species and personality, and a duty Pokémon is tired for the next battle if called in. **Loop:** the bench has jobs. **Interacts:** Backline aura, Rations, Fatigue. **Balance:** only 3 duty slots; duty yields are small. **Cx:** Med.

### M-080 Rental Mons
**Rules:** Pay a Rental fee at a ranch node to borrow a strong Pokémon for N battles. It obeys at a lower Trust tier, ignores Command Trust, and when returned leaves a Memory. If it faints, you owe a replacement fee. **Loop:** quick power boost and risk. **Interacts:** Shop, Trainer classes, Debts. **Balance:** rentals are one level under the region cap and cannot evolve. **Cx:** Med.

### M-081 Draft Picks
**Rules:** After special battles you may Draft: choose one of three Pokémon offered (based on recent play: types faced, personality) to join as a recruit or to replace one in your party. Draft rarity increases with boss wins; a Reroll costs a token. **Loop:** run-building like a roguelike draft. **Interacts:** Starter pool, Legacy, Boss rewards. **Balance:** drafted Pokémon are level-matched; offers use a dedicated seeded stream. **Cx:** Med.

### M-082 Move Hand
**Rules:** In "Hand Mode" each Pokémon has a Move Library of 8 and draws a hand of 4 each battle (plus 1 card swap per turn). Movepool upgrades add library slots; certain moves are "Eternal" and always in hand. **Loop:** deckbuilder meets Pokémon moves. **Interacts:** Move tutoring, TMs, PP economy. **Balance:** opt-in run mode; AI uses hand mode too in its tiers. **Cx:** High.

### M-083 XP Jar
**Rules:** Surplus XP (from over-leveled fights or capped Pokémon) flows into a shared Jar. At rest stops you may pour Jar XP into any one Pokémon, up to the region cap. Pouring gives a small Mastery tick for that species. **Loop:** control growth decisions. **Interacts:** Level cap, Bench XP share, Candies. **Balance:** Jar capped at 2 levels worth; cannot exceed the cap. **Cx:** Low.

### M-084 March Order
**Rules:** Party order on the map decides who faces events: the front Pokémon takes traps, the rear is hit by ambushes, the middle receives thrown items. Pokémon abilities (Sturdy, Keen Eye) alter what they notice. Rearranging is free at any time on the map. **Loop:** order matters beyond battle. **Interacts:** Mood Contagion (M-051), Formation presets, Events. **Balance:** none of these events can hit a fainted slot; a fainted Pokémon is skipped. **Cx:** Med.

### M-085 Ghost Trade
**Rules:** At shrine/Trade nodes, you can trade a Pokémon with an NPC "ghost" that returns later with an evolved form and a story (after N nodes it reappears as a rival or a gift). The returned form may be a trade evolution. **Loop:** a delayed payoff you set in motion. **Interacts:** Trade evolutions, Rival gift swap, Legacy. **Balance:** your Pokémon returns within the same region at a fixed time; the trade is displayed in advance. **Cx:** Med.
