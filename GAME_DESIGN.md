# GAME_DESIGN.md — Pokémon Roguelike

**Status:** Approved by the director on 2026-10-25 (open decisions in section 12 still apply).
**Sources:** the project pitch, `Master_Development_Brief.md`, and `DESIGN_DECISIONS.md` (the authoritative spec). Where they disagreed, this document follows `DESIGN_DECISIONS.md` and lists the disagreement in section 12 so you can confirm it.

Items marked **[PROPOSED]** are my suggestions that need your yes/no. Items marked **[OPEN]** have no answer yet and need a decision from you before the related system is built.

---

## 1. The game in one paragraph

A single-player, browser-based Pokémon roguelike. You pick a trainer archetype and one of three random first-stage starters, then travel through branching stage maps fighting wild Pokémon and trainers. After every encounter you draft one of five rewards. Each stage ends with a gym leader; eight stages make a region, followed by the Elite Four and a champion. Nine regular regions in random order lead to a final Grand Region. Losing ends the run but keeps permanent progress (unlocks, bank currency, achievements).

## 2. Run start

1. Create run ID and seed.
2. Load permanent profile.
3. Player picks an unlocked trainer archetype (Red, Blue, Green at first).
4. Shuffle the nine regular regions once; save the order (never reshuffled).
5. Offer three distinct, eligible, first-stage species; player picks one.
6. Party = that starter. Initialize money, inventory, candies, key items, temporary attribute modifiers.
7. Generate stage 1 map. Autosave.

## 3. Trainer archetypes (data-driven)

| Trainer | Upside | Downside | Numbers (tunable config) |
|---|---|---|---|
| Red | none | none | baseline |
| Blue | Faster leveling | Higher-level enemies | +25% XP; enemy level +2 before caps |
| Green | More money; weaker wild/trainer Pokémon | Harder catching | +25% money; enemy level −1 (respecting minimums); capture probability ×0.85 |

Green's "weaker enemies" and "harder catching" are separate rule entries. Archetypes are defined in a data file with: id, name, flavor text, art asset IDs, unlock condition, and a list of modifier entries (e.g. `{ kind: "xpMultiplier", value: 1.25 }`). Code never checks a trainer's name.

**Modifier order [PROPOSED]:** base value → region/stage/route → party-strength correction → archetype → items/buffs → clamp (levels to region caps, probabilities to 0–1).

## 4. Campaign structure

- 9 regular regions, random order, each appears once. Grand Region always last.
- Regular region = 8 stages → Elite Four (4 battles, full heal between) → Champion.
- Stage = exactly 20 numbered levels. Level 20 is the gym leader. Levels 1–19 contain exactly 2 designated trainer battles and 17 other primary encounters (mostly wild).
- Unnumbered optional nodes (shops, healing, trades, events, detours, rare Pokémon) sit beside the main path and don't count toward 20.
- Grand Region **[PROPOSED in spec]**: 8 stages of 20, then a final boss and an ending.
- A developer "short campaign" uses the same rules with tiny numbers (e.g. 2 regions × 2 stages × 4 levels) for testing.

**Built in Milestone 4 (2026-10-25):**
- Each region (Kanto to Paldea, plus Alola) lists its own gym leaders, Elite Four and champions in `regions.json`. A region's stages prefer its own leaders whose speciality fits the stage theme; its league prefers its own Elite Four and champion. Nobody appears twice in a run (D6), across all three roles.
- The league is its own map: one straight line of Elite Four members, then the champion. The party is fully healed on arrival and after every Elite Four win, and each win gives a reward draft (D13).

### 4b. Bosses and their teams (director, 2026-10-25)
- 229 bosses (`bosses.json`): every trainer from the director's boss pack plus the earlier gym leaders, Elite Four and champions. **Any boss can be a gym leader, an Elite Four member or a champion.** Each has a speciality (one or two types, or none for mixed teams), portraits (with optional champion or Elite Four outfits) and a list of signature Pokémon.
- Every boss has **36 teams** (`bossTeams.json`, built by `npm run data:bosses`):
  - **16 gym teams.** Gym team 1–8 are used for the run's first eight stages, 9–16 for the next eight, and team 16 (the hardest) again for every later gym.
  - **10 Elite Four teams**, one per region (the Grand Region is the tenth), harder every region.
  - **10 champion teams**, one per region, always six Pokémon and far harder than the Elite Four.
- Early teams use their Pokémon's latest level-up moves and lower evolutions (Cynthia's first gym has a Gible). Later teams use fully evolved signature Pokémon with strong same-type attacks, coverage moves, TM moves and set-up or status moves.
- Bosses get **training**: extra vitamin-style stat stacks (gym teams 9–16 a few, Elite Four one more per region, champions 4 in region 1 up to 22 in the Grand Region, spread over attack stat, Speed, HP and defences).
- Bosses **choose moves cleverly**: each turn, with chance `ai` (gym 0.15 → 0.7, Elite Four 0.6 → 0.9, champion 0.85 → 1.0) they pick their best move against your Pokémon instead of a random one.
- Legendary and mythical Pokémon only appear in a boss's team if they're in its signature list, and then only for champions from region 5 and Elite Four from region 9.
- Levels still come from the difficulty curve (§4); a team only decides who is in it, their moves and their training. The stage theme picks the gym leader (one whose speciality fits), who brings their own team.
- **Level cap (D14):** 50 in the first region, +50 per region, stopped at 100 for now because levels above 100 aren't decided. Enemy levels climb from the previous cap to just under the new one across the region's 8 stages; the league sits at the top.
- After the champion the next region starts at stage 1. Beating the last champion wins the run.
- The developer campaign is 2 regions × 2 stages × 5 levels with an Elite Four of 2 (`?campaign=dev`, or pick it in the debug panel).
- Shops unlock more stock as you earn badges (`minBadges` in `shop.json`).

**Scale warning:** a full run is 9×8×20 + 160 ≈ **1,600 numbered encounters plus ~100 bosses**. At about one minute each, that is 25–30+ hours per run. See section 12, item D1.

## 5. Stage maps (branching routes)

**[PROPOSED] Layered graph.** Think of the stage as 20 columns. Each column holds 1–3 parallel nodes. Paths only move forward one column at a time, so *every* route from start to gym passes through exactly 20 numbered nodes. That guarantees the "20 levels" rule on every route, not just on average.

- The two trainer battles are placed on two specific columns, and every node in those columns is a trainer battle, so every route meets exactly two trainers.
- Column 20 has a single node: the gym leader.
- Forks show a risk/reward indicator (e.g. "Harder: +1–2 enemy levels, better rewards"). Hidden details stay hidden unless an item reveals them.
- Optional nodes hang off a numbered node as side branches that return to the same column.
- Generator validation: connected, no dead ends, no duplicate IDs, each node records how it was generated (for debugging).

### 5b. Stage themes (director rule, 2026-10-25)

Every stage has a **theme**: a named pair of two types. Examples from the director: **"Stormy Nightmares"** (Electric/Ghost), **"Firey Promises"** (Fire/Psychic), **"Lazy Rivers"** (Water/Normal).

- **Every two-type combination is used:** all 153 pairs of the 18 types (director confirmed "all 153", not only the pairs real Pokémon have). Each has a unique name in `src/data/themes.json`.
- The theme decides **which wild Pokémon appear** (species with either type; species with both types are more common), **which trainers appear** (trainer classes whose speciality matches a theme type, with teams drawn from the theme), and **the gym leader** (a leader whose speciality matches a theme type when one is unused; they bring their own team, §4b).
- The battle background is the arena for the theme's first type.
- Themes and gym leaders don't repeat within a run (D6).

### 5c. Pokémon, forms, evolution and region eligibility (Milestone 6)

- **The whole Pokédex is in the game data:** all 1,025 species plus 264 forms (regional, alternate, Mega, Gigantamax, Primal and battle-only forms). Base data comes from PokeAPI's open data; level-up moves come from the director's move dataset. Megas, Gigantamax, Primal and battle-only forms wait for their mechanics (M8.5) and never appear in the wild, on teams or as starters.
- **Moves the battle engine can't run yet** are in the data, flagged "not supported", and skipped: no Pokémon learns or uses them until they are built (they then switch on by re-running the move import). A Pokémon whose moves are all unsupported (Ditto, Smeargle, Unown, Cosmog, Abra) never appears until its moves work.
- **Wild Pokémon** are first-stage species (babies don't count as a stage, so Pikachu is first-stage) that are not legendary or mythical, with a base stat total of at most 560 (keeps Ultra Beasts and Paradox Pokémon out). Regional forms appear like any other species.
- **Region eligibility:** within a stage's theme, Pokémon native to the current region (its generation, or its regional forms, e.g. Alolan Vulpix in Alola, Hisuian forms in Sinnoh) are 3× as likely as others (`nativeWeight`). The Grand Region treats everyone as native.
- **Evolution rules.** Level evolutions happen by level (D15). Every other method becomes an **evolution item** used from the Bag:
  - stones and other "use an item" evolutions use that item (Fire Stone, Galarica Cuff, Tart Apple, …);
  - trade evolutions use their held item (Metal Coat, King's Rock, …) or a **Linking Cord**;
  - friendship and affection evolutions use a **Soothe Bell**;
  - location evolutions use their modern stone (Magnezone and Probopass: Thunder Stone; Leafeon: Leaf Stone; Glaceon: Ice Stone);
  - "knows a move" evolutions happen at the level the Pokémon learns that move;
  - methods the game has no equivalent for (steps walked, critical hits, Gimmighoul coins, …) become a fixed level, listed in `tools/import-species.ts`. Shedinja can't be obtained by evolution.
  - The game has no gender, time of day or weather, so those conditions are ignored. Where several evolutions apply at the same level (Wurmple, Burmy, Rockruff, Toxel, Cosmoem), one is picked from the Pokémon's id, so it is always the same for that Pokémon; Tyrogue follows its Attack and Defense.
  - **Regional evolutions** happen in their region: Pikachu, Exeggcute and Cubone evolve into their Alolan forms in Alola, Koffing and Mime Jr. into Galarian ones in Galar, and the Hisuian final forms in Sinnoh.
  - When an item has several possible results (Eevee and a Soothe Bell: Espeon, Umbreon or Sylveon), the player chooses.
  - Trainers' Pokémon evolve by item at level 30 (level 15 for baby Pokémon).
- **Evolution items** appear in the reward draft only when someone in the party can use them (stones, Linking Cord and Soothe Bell are uncommon, the rest rare), and shops sell the Soothe Bell (1 badge), the ten stones (2 badges) and the Linking Cord (3 badges).

### 5d. Custom Pokémon and forms (Milestone 8, director request 2026-10-25)

The director supplied sprites for Pokémon that aren't in the main games; the data was filled in as follows (all of it editable in `tools/custom-forms.json`, then `npm run data:custom`).
- **Delta Pokémon** (from Pokémon Insurgence) keep Insurgence's types, base stats, evolutions and level-up moves. Delta forms that only exist through a mechanic (Megas, Mega Delta Typhlosion's active form, Fired-up Delta Emolga, Armored Delta Volcarona, Crystal Delta Metagross, Magician Delta Meloetta) wait for M8.5.
- **Designed forms** (Z-Forms, Spooky forms, new Megas, Delta Muk's cages, Delta Snorlax's seasons, Delta Ditto's type forms): types chosen from the art; base stats are the base species' unless a design lists its own; catch rate, experience, growth rate and generation come from the base species.
- **New Megas** get the base species' stats + 100: +30 to its better attacking stat, +10 to the other, +20 each to Defense, Sp. Def and Speed (capped at 255).
- **Learnsets of designed forms** start from the base species' level-up moves, drop attacks of the types they lost, and learn a ladder of attacks for each new type (an early, middle and late attack, physical or special to match their better attacking stat). Any custom Pokémon with no usable attack of one of its types, or fewer than four usable attacks, gets those ladders too.
- **Evolutions** follow the base species' method (Z-Kadabra → Z-Alakazam by Linking Cord, Spooky Lampent → Spooky Chandelure by Dusk Stone); two new final forms evolve by level: Raticate → **Bruticate** at 38, Mightyena → **Alphayena** at 40. A form whose pre-evolution has no matching sprite is another branch of the normal pre-evolution, with the same method (Electabuzz → Electivire or Z-Electivire with an Electirizer; Delta Grimer → Delta Muk or any of its six cages); which branch a Pokémon takes is fixed per Pokémon, as with other level branches.
- **Female sprites** in the pack (Delta Bulbasaur's line, Delta Deino's line) aren't used, because the game has no gender. Delta Ditto's "???"-type sprite isn't used, because there is no ??? type.
- **Icons:** forms without one use Minior's icon.

## 6. Battles

Traditional single battles (1v1 active Pokémon), turn-based.

**[PROPOSED] Baseline ruleset: modern (Gen 9-style) mechanics**, simplified where noted:
- Physical/special split; standard damage formula with STAB 1.5×, random factor 0.85–1.00, type chart (18 types).
- Critical hits: 1/24 base chance, 1.5× damage.
- Order: move priority first, then Speed, then a seeded coin flip for ties.
- Accuracy check per move.
- Statuses: burn, poison, bad poison, paralysis, sleep, freeze (main); confusion later.
- Abilities and held items: off in the first milestones, added later through data.
- Battle stats: the standard stat formula from base stats and level. **[PROPOSED]** No IVs/EVs/natures at first (keeps it readable); could be added later.

Battle actions: Fight, Bag, Pokémon (switch). No Run option (D3).

## 7. Capture

**[PROPOSED]** Use the standard modern catch formula: a catch value from species catch rate, current/max HP, ball multiplier, and status multiplier, converted to a probability. Then apply Green's ×0.85 and other modifiers, and clamp to 0–1. One random roll decides success (simpler and easier to test than the four "shake" checks; the shakes can still be shown as animation).

Successful capture:
- Party < 6: offer to add it.
- Party = 6: choose a party member to replace (shown by name, with confirmation) **or** convert the new Pokémon into candies (confirmed). Never silent.

## 8. Rewards (the five-choice draft)

After every completed encounter, show five *different* rewards; pick exactly one.
- Each reward entry has: id, category, rarity tier, effect, stacking rule, duration, scope, restrictions.
- Rarity tiers **[PROPOSED]**: Common, Uncommon, Rare, Epic, Legendary, each with a base weight.
- Bosses improve the weights (gym < Elite Four < champion < final boss).
- Luck multiplies the uncommon and rare weights (§9); common is unchanged, so luck never guarantees rare.
- Too few valid rewards → configuration error, never duplicates.

## 9. Attributes (built in Milestone 7)

Six plain attributes from 0 to 100 (Strength, Intelligence, Speed, Charisma, Luck, Love) and two meters from −100 to 100 (Rage ↔ Peace, Good ↔ Evil; D9). Each has a **permanent value** (grown on the profile) plus the **run's modifiers** → the effective value, clamped. All numbers live in `balance.json` (`attributeEffects`, `attributeGrowth`).

**Effects** (director decision 2026-10-25: each point is worth the full percentage, no cap. Balance pass the same day, left to me by the director: Charisma's price cut and Peace's damage cut are half a percent per point, so Charisma 100 is half price instead of a free shop and Peace 100 halves damage instead of 1 damage per hit):

| Attribute | Per point | At 100 |
|---|---|---|
| Strength | Physical moves +1% damage | +100% |
| Intelligence | Special moves +1% damage | +100% |
| Speed | Your Pokémon +1% Speed | +100% |
| Charisma | Shop prices −0.5%, experience +1% | half price, double experience |
| Luck | Uncommon reward weight +0.5%, rare +1%, shiny chance +1% | rare ×2, shinies ×2 |
| Love | +0.1% chance to hang on at 1 HP after a lethal hit, once per Pokémon per battle | 10% |
| Rage | Damage dealt +2%, damage taken +1% | +200% / +100% |
| Peace | Healing +2%, damage taken −0.5% | +200% / half damage taken |
| Good | Catching +2% easier | ×3 catch rate |
| Evil | Prize money +1% | +100% |

**Permanent growth** (D10), from lifetime counters:
- +1 Strength / Intelligence / Speed per Fighting / Psychic / Electric-type Pokémon defeated or caught (a dual-type Pokémon counts for both types).
- +1 toward Rage per Fire type, toward Peace per Grass type, toward Good per Fairy type, toward Evil per Dark type defeated or caught.
- +1 Charisma per stat your Pokémon raise on themselves with a move (Bulk Up raises two, so +2).
- +1 Luck per 10 Pokémon caught, +5 per shiny found.
- +1 Love per evolution and per region cleared with your starter still in the party.

**Run modifiers:** after-battle rewards (Power Band, Shiny Charm, …: +15 to +30) and shop items bought from 1 badge (the Plates, Lucky Egg, Love Sweet: +5 each, used as soon as they're bought). Special encounters and "Between-Level" interactions with your Pokémon will also change attributes once those events exist (Milestone 8.75).

## 10. Items, shops, economy

- Run money (temporary) vs bank currency (permanent). Always shown separately.
- Shops sell from data-defined stock with prices from data; better items unlock with badges (Great Ball at 2, Ultra Ball at 5, Full Restore at 7). Charisma/archetype price effects come later.
- **Last Stand Charm:** rare, single-use. When your last usable Pokémon would faint (run-ending loss), it's consumed, that Pokémon stays at 1 HP, a message is shown, and the battle continues. Once per battle.

## 11. Permanent progression and saving

- Separate save records: profile, active run, settings, metadata. Each has a schema version and migrations.
- Autosave at safe points: after starter pick, after each reward pick, on entering a map node.
- Run ends in defeat: apply Charm if any → compute permanent rewards → write profile → then clear the run. Each run end has a transaction ID so a refresh can't pay out twice.
- Export/import save as a file. Local browser storage only for now.

## 12. Contradictions and open decisions

### Contradictions found (with my proposed resolution)

| # | Conflict | Proposed resolution |
|---|---|---|
| C1 | Brief says "implement Milestone 1 now"; spec says "don't code until approved". | Follow the spec. Plans only until you approve. |
| C2 | Original pitch says Green's *con* is "fight slightly weaker Pokémon", the same as her pro. | Treat it as a typo. Weaker enemies = pro; harder catching = con. |
| C3 | Pitch: "randomly generated number of stages (usually eight)" and "repeat about nine times". Spec: exactly 8 stages and exactly 9 regions. | Use the spec's exact numbers. |
| C4 | Pitch reads as 20 levels *plus* a gym battle; spec makes the gym the 20th level. | Gym = level 20. |
| C5 | "Exactly two trainer battles per stage" vs branching routes (a route could skip a trainer). | Layered map (section 5): both trainers sit on columns every route crosses. |
| C6 | Pitch: reward pick "before moving to the next stage"; brief/spec: after *every encounter*. | After every encounter. |
| C7 | Spec's party-strength correction raises enemy levels as your party gets stronger, which cancels out Blue's main benefit (faster leveling) and partly Green's (weaker enemies). | Apply archetype modifiers after the correction, and cap how much the correction can add. |
| C8 | The Last Stand Charm triggers on "run-ending defeat", but the spec never says whether *every* battle loss ends the run. | Any loss where all party Pokémon faint ends the run. |

### Decisions needed from you

**Needed before Milestone 1**
- **D0 Repository.** Decided: `AwsomSause/pkmn` (switch to private before assets go in).
- **D2 Battle ruleset.** Decided (2026-10-25): modern Gen 9-style, no IVs/EVs/natures for now.
- **D3 Fleeing.** Decided (2026-10-25): **no running** from any battle.
- **D4 Asset licensing and hosting.** Decided (2026-10-25): keep private, no public deploy.
- **D5 Starter pool for the prototype.** Decided (2026-10-25): ~12 hand-picked Gen 1 first-stage Pokémon for now.

**Needed before later milestones**
- **D1 Campaign length.** Decided (2026-10-25): keep the full length (9 regions × 8 stages × 20 levels, plus the Grand Region).
- **D6 Regions.** Decided (2026-10-25): the regions are a mix of the original regions and custom regions. Every gym leader, Elite Four member and champion is chosen at random, and none repeats within one run. *(The custom regions are left to me by the director, 2026-10-25; designed in Milestone 8.75 part G. What the Grand Region contains is M9.)*
- **D7 Candies.** Decided (2026-10-25): candies are a permanent currency spent outside a run (unlocking trainers, starting buffs, etc.). Candies earned in a run are added to the profile when the run ends. *(Confirmed 2026-10-25 with the Out-of-Run design: candies stay as a fourth currency beside Poké Dollars, Bank Credits and Research Points, see D16.)*
- **D8 Shiny odds.** Decided (2026-10-25): 1/2000 per wild Pokémon; Luck raises it (×2 at Luck 100) and each shiny found adds 5 Luck (§9).
- **D9 Attribute meters.** Decided (2026-10-25): Rage/Peace and Good/Evil are each one meter with two ends. Effect formulas decided the same day: each point is worth the full percentage (§9).
- **D10 Permanent attributes.** Decided (2026-10-25): earned by defeating or catching Pokémon of certain types, raising stats with moves, catching, shinies, evolutions and keeping your starter (§9).
- **D11 Bank.** Decided (2026-10-25): works like candies in the long run, as a permanent currency for out-of-run purchases. *(Superseded in detail by the Out-of-Run design, §14: the Bank's currency is Bank Credits.)*
- **D12 Trainer unlocks.** Decided (2026-10-25): future trainers include Gold, Silver, Crystal, Brendan, May, Wally, Dawn, Lucas, Barry, Looker and more. *(Unlock conditions and pros/cons to be proposed in Milestone 5.)*
- **D13 Elite Four rewards.** Decided (2026-10-25): a reward draft after each Elite Four member.
- **D14 Level caps.** Decided (2026-10-25): each region raises the level cap by 50. **Levels go above 100, up to a maximum of 500** (director, 2026-10-25). Built in Milestone 8.75 part G; until then levels stop at 100.
- **D15 Evolution.** Decided (2026-10-25): standard level-up evolution.
- **D16 Currencies.** Decided (2026-10-25): four currencies. Poké Dollars (spent during a run), Bank Credits (permanent upgrades and unlocks), Research Points (Pokédex, starters, research) and candies (kept as a separate fourth currency, D7).

## 14. Out-of-Run and Run-Prep (director design, 2026-10-25)

The director's expanded design. **Guiding rule:** permanent progression should open up more choices and strategies. It should not make veteran players so strong that early content becomes trivial.

Two layers:
- **Out-of-Run (Milestone 5):** permanent progression, collection, unlocks, achievements, banking, long-term goals.
- **Run-Prep (Milestone 5.5):** decisions made just before a run: campaign mode, trainer, starter options, loadout, optional preparation bonuses.

### 14.1 The hub
Before a run the player is in a hub that can grow visually as they unlock things. Rooms: **Bank**, **Trainer Archive**, **Achievement Hall**, **Starter Laboratory**, **Preparation Desk**, **Pokédex & Research**, and a **Run History** terminal (past runs, what ended them, builds, best achievements).

### 14.2 Bank and currencies (D16)
| Currency | Earned from | Used for |
|---|---|---|
| Poké Dollars | battles, shops, events, selling items | spending during a run |
| Bank Credits | run completion, achievements, milestones, conversion bonuses | permanent upgrades and unlocks |
| Research Points | discovering species, catching, seeing forms and moves | Pokédex, starters, research unlocks |
| Candies (D7) | releasing Pokémon | kept as a fourth currency |

Bank features:
- **Savings:** at run end a percentage of leftover Poké Dollars converts to Bank Credits, plus bonuses for stages, champions and new regions, plus a fixed stipend based on progress so a failed run still counts.
- **Bank tiers** unlock services rather than multiplying rewards: 1 basic savings and purchases; 2 better item catalog and extra loadout presets; 3 research exchange and special contracts; 4 regional item catalog and advanced preparation; 5 Grand Region archive and prestige cosmetics.
- **Daily/weekly contracts** (e.g. win five battles with a Water-type, beat a gym leader without losing a Pokémon) pay credits, research, cosmetics or unlock progress.
- **Permanent item catalog:** unlocking an item makes it *eligible* to appear in future runs, not guaranteed.
- More: interest-free savings milestones, Emergency Reserve (protects a little run money on defeat), Exchange Counter, Collector's Vault, Regional Accounts (shop stock after certain champions), Loan Challenges (extra starting resources with a repayment condition), savings milestones that unlock titles and decorations.
- **Investment Licenses** (the big idea): spend credits to *broaden options* rather than buy stats. Field Medic (a healing item among starting preparation choices), Scavenger (small chance of bonus currency in special encounters), Research (more unusual starter candidates), Type Specialist (type-focused preparation options), Fortune (new reward modifiers in the pool), Survival (a rare defeat-prevention item in shop stock).

### 14.3 Player trainers
Each trainer has: identity, portrait and unlock requirement; one primary passive; a drawback where fitting; a signature preparation option or interaction; optional mastery challenges; cosmetic variants and titles. One trainer per run, with effects readable before the run starts. All numbers live in data.
- **Red** (starting): no passive, no drawback; the baseline. Mastery: win a champion battle with at least three Pokémon standing.
- **Blue** (starting): +25% experience; enemies +2 levels before caps. Mastery: beat a champion with a party averaging below the regional benchmark.
- **Green** (starting): +25% money from eligible rewards, enemies −1 level; catching 15% harder. Mastery: complete a region with a minimum number of catches and a money target.
- **Professor Oak** (discover 100 species): more Research Points from new species and forms; less money from ordinary battles; once per stage preview an unknown encounter.
- **Brock** (clear a region without a party wipe): healing items work better; Poké Balls cost more; starts with a small healing supply.
- **Misty** (win a run with a Water-type leading every boss battle): small Water-type combat bonus; more danger from encounters that hit Water's weaknesses; a Water-focused preparation option.
- **Cynthia** (defeat champions in several regions): more information about boss teams before battle; no economy or experience bonus.
- **Giovanni** (collect rare items or reach a high lifetime earnings milestone): better special shop stock; healing costs more; occasional black-market merchants.
- **N** (a friendship and Pokémon-care challenge): stronger friendship effects; some aggressive event choices unavailable; friendship opens alternate event outcomes.

**Mastery tracks** per trainer (e.g. Blue: win 10 battles → badge; 3 gym leaders in one run → alternate portrait; regional champion → title; restricted region clear → cosmetic; final campaign → emblem). Mastery gives cosmetics, titles, options and collection content, not stacking combat multipliers. **Trainer Research:** using a trainer reveals their background, dialogue and special events.

### 14.4 Achievements
Nine categories: Campaign, Pokémon collection, Battle, Exploration, Economy, Roguelike, Relationship, Secret, Endgame. Examples: First Steps (win your first battle, 100 Bank Credits), Champion Material (first champion: title and trainer unlock progress), A Little Different (first shiny), Beyond the Regions (final Grand Region boss). **Chains** with tiers (catch 10 → 50 → 100 species → full Pokédex; gym leaders 1 → 10 → 50 → all; shinies 1 → 5 → 20; finish a run → region → campaign → challenge campaign). **Hidden achievements** such as Against the Odds, Penny Pincher, No Turning Back, The Collector, One of a Kind, The Long Game, Lucky Break, Wrong Way Right Result, No Safety Net. Progress is tracked automatically. The strongest gameplay unlocks come from meaningful milestones, not grinding.

### 14.5 Starters: the Starter Laboratory
- **Pools** in data (eligibility never hard-coded): Classic (Kanto starters, available from the start), Johto, Hoenn, Regional, Rare (hard achievements), Research (unusual first-stage species, bought or earned with licenses), Grand (endgame).
- **Draft modifiers** (optional rules, not power): Expanded Research, Type Focus, Regional Research, Rare Specimen License, Evolution Specialist, Blind Draft, Balanced Draft. The draft must never reroll forever chasing an impossible rule; it shows a clear fallback instead.
- **Starter mastery** per species (e.g. Bulbasaur: win five battles with it, evolve it, a Grass-type boss win, a stage without it fainting, a campaign with it surviving), rewarding badges, backgrounds, palettes (with supplied art), titles, Research Points and events. Mastery is account-level and never carries a previous run's levels.
- **Research panel:** encountered, caught, used against bosses, evolutions, forms, shinies, move and type interactions, mastered starters. Research unlocks information more than power.
- **Starter events** driven by species tags; **legendary and mythical starters** in a separate Special Specimen category with restrictions.

### 14.6 More Out-of-Run systems (later; Milestone 8.75 part H)
Pokédex and Collection Archive; Trainer Wardrobe (outfits, frames, poses, hub decorations); Research Laboratory (spend Research Points on encounter pools, species info, events, starters); Battle Records and Hall of Fame; Berry Garden (grows per completed run); Move Research and Training Center; Regional Intelligence Board; Permanent Item Museum.

### 14.7 Run-Prep flow
1. Select campaign mode (standard, challenge, unlocked modifiers). 2. Select trainer. 3. Configure preparation (optional license, limited consumable, or draft modifier). 4. Review permanent bonuses (attributes, research unlocks, challenge conditions). 5. Roll three starters and pick one. 6. Campaign briefing (region order, seed, starting resources, special rules). 7. Begin.

Features: **loadout presets** (store preferences only; an option that became unavailable must be resolved before starting); **preparation tokens** from achievements and progression, one token choice per run at first (extra money, a basic healing item, better odds for a starter type, first-region intel, an item category in the reward pool, a small run attribute bonus); **challenge modifiers** with their difficulty and reward shown before confirming; **campaign briefing**; **seed management** (copy/export a seed, a developer reproduction tool, shared seeds later). A **Run Build Summary** before starting shows the combined effect of trainer, attributes, token, licenses and modifiers.

### 14.8 Bigger systems (later; Milestone 8.75 part H)
Trainer Network (non-selected trainers give small utility services; only one main passive), Research Tree, Prestige and Legacy (never deletes collection or achievements), Contract Board, Legacy Records and Rival Ghosts.

### 14.9 Balancing rules
Progression mainly unlocks choices, information and customization; combat bonuses have documented stacking rules and caps; luck shifts odds without guarantees; rare items and defeat prevention stay valuable; starter mastery gives collection and cosmetics; Bank Credits can't be duplicated by saving, loading or repeat claims; challenge modifiers pay more only when genuinely harder; optional content is never needed to beat the default campaign.

### 14.10 Order and scope
The director's priorities: 1 profile, banks, trainer unlocks; 2 achievements and event tracking; 3 starter pools and selection; 4 Run-Prep and presets; 5 Pokédex and research; 6 contracts and challenge modifiers; 7 wardrobe, hub upgrades, legacy records; 8 prestige, trainer network, rival ghosts. **First package = priorities 1–4**, built as Milestone 5 (1–2) and Milestone 5.5 (3–4). Every unlock uses one architecture: a data-defined requirement, a progress tracker, a reward definition, and a claim or activation rule.

### 14.11 Conflicts with earlier decisions (flagged, not guessed)
| # | Conflict | Status |
|---|---|---|
| C9 | D7/D11 made candies the out-of-run currency; this design adds Bank Credits and Research Points. | **Resolved** by the director: candies stay as a fourth currency (D16). |
| C10 | D12 listed future trainers Gold, Silver, Crystal, Brendan, May, Wally, Dawn, Lucas, Barry, Looker; this design proposes Oak, Brock, Misty, Cynthia, Giovanni, N. | Proposed: both lists are wanted; this design's six come first because their passives are specified. |
| C11 | Brock, Misty, Cynthia and Giovanni are also gym leaders and a champion in the boss roster, so a run could pit player-trainer Brock against Gym Leader Brock. | Proposed: allow it for now (they are separate entries); revisit if it reads oddly. |
| C12 | The asset pack has no sprites for Professor Oak or N (and none for Green, as before). | **Resolved** 2026-10-25: the director supplied Oak's and N's sprites (N's matches the boss pack's), and Green uses the boss pack's portrait. Both are in the Trainer Archive as "coming later" until their passives' systems exist (Milestone 8.75). |
| C13 | Several trainer passives need systems that don't exist yet: friendship (N), events and merchants (Giovanni's black market, Oak's preview), boss intel (Cynthia), Research Points from forms. | Each trainer ships when the systems behind its passive exist; the Archive shows them as "coming later". |
| C14 | "Discover 100 species" (Oak) is more than the game's current 89 species. | Kept as written; reachable once Milestone 6 adds the full Pokédex. |

## 13. Assets: what you supplied

All assets appear to come from **PokeRogue** (Pagefault Games). The audio pack includes PokeRogue's `REUSE.toml`, which marks the project **AGPL-3.0** and states that many files are sourced from Nintendo/Game Freak/Creatures (cries, music, sprites via Pokémon Showdown).

What that means in plain language:
- It's fine for building and playing privately.
- Hosting it publicly means using Nintendo-owned material, and PokeRogue's AGPL license may require the game's code to be released under AGPL too.
- **Recommendation:** keep the repo private and don't publish a public build until you've decided how you want to handle this. The code will load assets only through a manifest, so the art can be swapped later without touching gameplay.

| Pack | Size | Contents (counted, not guessed) |
|---|---|---|
| images.zip | 99 MB zipped / ~261 MB unzipped, 57,068 entries (about half are macOS `__MACOSX` junk) | `pokemon/` 24k files: front sprites as `ID.png` + `ID.json` atlas (e.g. `1.json`), plus `back/`, `shiny/`, `variant/`, `female/`, `exp/` (animated), `icons/1–9/`. `trainer/` 620 (includes `red`, `blue`, `player_m/f`, `rival_m/f`, **no `green`**). `items/` 535 + `items.json` atlas. `arenas/` 202 (39 `*_bg.png` battle backgrounds). `ui/` 1,765 (windows, HP/EXP bars, party slots, cursors, type badges). `pokeball/` 18. `battle_anims/` 653 effect sheets. Localized type sheets. |
| audio.zip | 424 MB zipped, 5,490 entries | `bgm/` 181 (incl. `title.mp3`, `menu.mp3`, `battle_wild.mp3`, `town.mp3`, gym/elite/champion tracks), `cry/` 1,201 (`.m4a` by dex number), `se/` 40 (hit, faint, level_up, pb_throw, pb_catch, buy, save…), `ui/` 4 (select, menu_open, error…), `battle_anims/` 1,317 sound effects. |
| battle-anims.zip | 1.9 MB, 929 `.json` files | Per-move animation data (e.g. `tackle.json`, frame lists referencing graphics like `PRAS- Strike`). Needs a custom player; planned for a later milestone. |
| fonts.zip | 1.8 MB | `pokemon-emerald-pro.ttf`, `pkmnems.ttf`, `rogue-thai.ttf`, `terrible-thaifix.ttf`, `8-bit-devanagari.ttf`, `item-count.png/.xml` (bitmap font). |

**Not supplied (needed):**
- **Game data.** Species stats, types, moves, learnsets, catch rates, evolutions. These packs are art and sound only. **[PROPOSED]** Generate our own JSON from an open dataset (Pokémon Showdown's data is MIT-licensed) with an import script; M1 uses a small hand-checked subset.
- A **Green** trainer sprite. *(Proposed: placeholder, or `player_f` as a stand-in, your call.)*

Sprites are small pixel art (Bulbasaur's frames are ~37×38), so the game will render at a low internal resolution and scale up crisply.
