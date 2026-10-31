# New Mechanics 4/4: Trainer, world, risk/reward, progression, competitive, procedural, narrative (M-086 to M-117)

Part 4 of 4 (117 mechanics in total). Design only. Existing: trainer taunts, challenge modifiers, mutators, daily seed, ascension, legacy bonus, landmarks, danger meter, fog of war, Living Rival, Nemesis, Legacy runs.
Format: **Rules / Loop / Interacts / Balance / Cx**.

---

## Trainer abilities

### M-086 Command Skills
**Rules:** The trainer (player) has 3 equipped active Skills with cooldowns chosen from a tree: Rally (+1 to all stats of the active Pokémon for a turn), Field Medic (heal 15% once per battle outside the item menu), Read the Room (reveal foe's next move category), Second Wind (revive a fainted Pokémon at 10% once per run). Skills are unlocked by trainer class and perks. **Loop:** the player's own agency in battle. **Interacts:** Trainer classes, Focus (M-088), Perfect Counter. **Balance:** Skills cost Focus; cooldowns are visible; banned in some challenge gyms. **Cx:** High.

### M-087 Bluff
**Rules:** Bluff is a command that costs your Pokémon's turn: you feint (pretending to use an item or swap). The foe's AI rolls to react (waste Protect, switch, set up) based on Behavior Profile. Success gives your next move a bonus. **Loop:** mind games with a seeded AI roll. **Interacts:** Behavior Profiles, Pattern Reading, Exposed Turn. **Balance:** Bosses see through Bluff after phase 1; usage limited per battle. **Cx:** Med.

### M-088 Focus Points
**Rules:** The trainer has Focus (starts at 3, max 5). Focus is spent on Skills, Reactions assigned by the trainer and Double Down. It regenerates +1 per two turns and +1 on each clean win. Low Focus shows as a dimmed UI bar. **Loop:** a shared resource across fights. **Interacts:** Command Skills, Nerve (M-089), Rest stops. **Balance:** refills at rest stops; challenge modes can reduce max. **Cx:** Low.

### M-089 Trainer Nerve
**Rules:** Nerve is the trainer's composure. Near-defeats and faints reduce it; wins and calm Pokémon restore it. Low Nerve adds friction (some commands cost extra Focus; the UI jitters slightly, motion setting permitting); high Nerve gives accuracy and crit bonuses. **Loop:** a morale loop for the player character. **Interacts:** Morale meter, Focus, Rival speeches. **Balance:** Nerve never blocks commands outright; cosmetic jitter respects Reduced motion. **Cx:** Med.

### M-090 Satchel Gear
**Rules:** The trainer's satchel holds three Gear slots with active tools: Binoculars (reveal next node's trainers), Whistle (call one wild Pokémon), Lantern (safe route in dark nodes), Compass (shortcuts), Net (+catch). Gear has uses per region; repairs cost currency. **Loop:** loadout decisions per run. **Interacts:** Fog of war, Field Talents, Shops. **Balance:** Gear uses cap per region; meta unlocks add gear options. **Cx:** Med.

### M-091 Relics
**Rules:** Rare Relics are run-wide passive artifacts with a trade-off (Glass Compass: see +1 node but all heals -20%; Rusted Crown: +1 level cap but -1 party slot). Relics drop from bosses and events; you may hold up to 6. **Loop:** the run's identity from relic stacking. **Interacts:** Item curses, Ascension, Legacy. **Balance:** about 60 relics, all flagged "keep" or "banish" at shops. **Cx:** Med.

### M-092 Vows
**Rules:** At shrines or run start you may swear a Vow: a voluntary restriction in exchange for a blessing (Vow of Silence: no items in battle, +10% damage; Vow of Mercy: no KOs on trainers' last Pokémon, bonus rep; Vow of One: only a single Pokémon in boss fights, +stats). Breaking a Vow removes the blessing and lightly harms. **Loop:** self-imposed challenge for reward. **Interacts:** Mutators, Achievements, Chronicle. **Balance:** vows are visible and tracked; no more than two active. **Cx:** Med.

## Environment and world

### M-093 Storm Fronts
**Rules:** Weather Fronts travel along the map in a pattern shown by the forecast (e.g. a Sandstorm front crosses nodes 3-5). Nodes under a front have weather in battle, modify prices, and block certain routes. You can plan around fronts or chase them for weather-specific encounters. **Loop:** route planning around moving hazards. **Interacts:** Map weather, Weather Tug-of-War, Field Talents. **Balance:** fronts move deterministically from the run seed; always telegraphed. **Cx:** Med.

### M-094 Battlefield Objects
**Rules:** Battles can contain interactables: Boulders (Rock Smash to create cover), Tall Grass (Grass moves hide the user), Puddles (Water pools boost Electric), Roots (trap a foe). Objects are pre-placed from the node's biome and consumed by use. **Loop:** the environment becomes a toolkit. **Interacts:** Terrain, Ring Positions, Elemental Reactions. **Balance:** objects are shown before the battle; bosses ignore objects. **Cx:** High.

### M-095 Terrain Memory
**Rules:** Notable battles permanently modify the node for the rest of the run: fire scorches grass, floods leave puddles, boulders collapse. Revisiting or passing nearby shows the aftermath and sometimes gives resources (burned tree = ember, flooded floor = fish). **Loop:** the map remembers. **Interacts:** Legacy records, Landmarks, Wild Goodwill. **Balance:** at most one scar per node; purely local modifiers. **Cx:** Med.

### M-096 Run Clock
**Rules:** Each node advances the clock by a fixed amount (Dawn, Noon, Dusk, Night). Time controls shop hours, species spawn tables, trainer types (night owls), and some events. Camp can skip or pass time. **Loop:** schedule route choices around the clock. **Interacts:** Time-of-day battle modifiers, Day/Night species, Events. **Balance:** clock is deterministic; a setting locks the time to Day. **Cx:** Med.

### M-097 Season Roll
**Rules:** Each region rolls a Season at run start (Bloom, Heat, Fall, Frost) that changes its weather odds, berries, trainer outfits, available evolutions and event pool. Some Pokémon (Deerling, Sawsbuck) change form by season. **Loop:** the same region plays differently each run. **Interacts:** Form swaps, Encounters, Freshness Clock. **Balance:** seasons are visible on the map; each affects odds, not core rules. **Cx:** Med.

### M-098 Exposure Meter
**Rules:** Hazard nodes (swamp, volcano, blizzard) fill party Exposure each turn/node: Heat, Cold, Toxin, Dark. Types resist (Fire resists cold). At full exposure a Pokémon gets a debuff (Chilled, Parched, Nauseous). Counter with items, shelter nodes or camp. **Loop:** manage environment attrition. **Interacts:** Rations, Gear, Types. **Balance:** meter starts forgiving and scales with Ascension. **Cx:** Med.

### M-099 Layered Routes
**Rules:** The map has three layers: Surface, Underground (caves, mines), Sky (cliffs, cloud routes). Layer travel needs a talent or gear (Dig, Fly, rope). Each layer has species tables, hazards and rewards of its own, and layers connect at bridges. **Loop:** vertical exploration. **Interacts:** Field Talents, Fog of war, Encounter director. **Balance:** layer connectors are shown at region start; there is always a surface path. **Cx:** High.

## Risk and reward

### M-100 Greed Ladder
**Rules:** Treasure rooms offer a ladder: open the next chest for a better reward but a higher chance (shown as %) of a trap or ambush. Cash out any time. Previous rungs' rewards are lost on a trap but the run continues. **Loop:** push-your-luck with visible odds. **Interacts:** Risk events, Notoriety, Relics. **Balance:** odds are seeded and rolled at node creation; "Cautious" setting caps at 3 rungs. **Cx:** Low.

### M-101 Ante
**Rules:** Before a trainer battle you may Ante: stake money, an item or a Favor on victory for a multiplier payout (money x2, item x2, Favor x3). Losing means the stake is gone. The opposing trainer may raise the Ante if confident. **Loop:** self-chosen stakes. **Interacts:** Marked Target Contract (M-029), Capture Contracts (M-061), Notoriety. **Balance:** not available in bosses; stake caps scale with region. **Cx:** Low.

### M-102 Notoriety
**Rules:** Aggressive choices (stealing, bullying, using Forceful capture, breaking Vows) raise Notoriety. High Notoriety draws Hunter trainers and changes shop prices but unlocks shady stalls and respect among certain factions. Good deeds lower it. **Loop:** morality with mechanical weight. **Interacts:** Factions, Loan Sharks, Events. **Balance:** two-sided: both extremes give perks; stays in the Album. **Cx:** Med.

### M-103 Favor Ledger
**Rules:** NPC favors are tracked as named IOUs (e.g. "Nurse Joy owes you a free revive"). Favors can be called in at later nodes, traded, or inherited by a rival. Some IOUs expire. **Loop:** social currency with names. **Interacts:** Events, Promise Ledger, Legacy. **Balance:** favors are small and visible; unredeemed favors give a Chronicle line. **Cx:** Med.

### M-104 Revival Policy
**Rules:** At a clinic node you may buy a Policy for a Pokémon: if it faints permanently, it is revived once at 25% HP at the next Center at a deductible. Policies cost more for fragile or high-level Pokémon and lapse after the region. **Loop:** price your safety. **Interacts:** Hardcore toggle, Economy, Ghost Companion. **Balance:** one policy per Pokémon per run; not available in Hardcore Plus. **Cx:** Low.

### M-105 Pacts
**Rules:** Legendary, Ghost or Dark entities offer Pacts at rare events: take a power now (+2 levels on your whole team for 3 battles) in exchange for a Debt due later (a boss gets a boost, a Pokémon is "claimed" for a stage). Pacts are shown with clear terms. **Loop:** Faustian bargains. **Interacts:** Relics, Legends, Nemesis. **Balance:** terms are exact and readable; accept/decline never blocks the run. **Cx:** Med.

## Progression

### M-106 Badge Boons
**Rules:** Each gym badge gives a choice of one of three Boons (Type Mastery, Team Rule, Trainer Skill) that persist for the run: e.g. "Wall Builder: Defenders gain +5% Defense", "Open Road: skip one battle per region". Boons are themed to the gym's type and leader. **Loop:** run identity per badge. **Interacts:** Gym challenge rules, Ascension, Legacy. **Balance:** boons are small, with a reroll cost; the pool is balanced by data. **Cx:** Med.

## Competitive

### M-107 Pick and Ban Prep
**Rules:** Before a boss or rival fight you see its roster and ban one of its moves or abilities for the fight; it bans one of yours (shown after you choose). Banned elements are replaced by a default. Rivals counter-ban by profile. **Loop:** competitive prep. **Interacts:** Rival adaptation, Boss phases, Behavior Profiles. **Balance:** bans are limited to non-signature moves; bosses never ban your Pokémon. **Cx:** Med.

### M-108 Tournament Rule Rotation
**Rules:** Tournament nodes run a bracket of 3-4 rounds, each with a randomly rolled ruleset from a pool (Singles 3v3, Doubles, No items, Level cap, Type ban, Mono-type). You enter with a registered team of six and each round draws what you can bring. **Loop:** adapt to changing rules. **Interacts:** Challenge modifiers, World championship events, Formation presets. **Balance:** prizes scale with rounds survived; rounds are seeded. **Cx:** High.

## Procedural

### M-109 Move Affixes
**Rules:** A move can roll an Affix when learned or found: Blazing (+Burn chance), Swift (+1 priority), Leeching (heals 10%), Echoing (repeats at 30%), Cursed (-power, +crit). Affixes carry names ("Blazing Waterfall") and show in the summary. Affix tutors can remove or move them. **Loop:** loot-like move builds. **Interacts:** Move mastery, Tutoring, Move Fusion. **Balance:** max one affix per move; bosses never use Cursed. **Cx:** High.

### M-110 Elite Affixes
**Rules:** Elite wild Pokémon roll 1-2 Affixes: Armored (flat damage reduction), Vampiric (heals when hitting), Splitting (spawns a weaker echo when KO'd), Mirroring (copies your boosts), Raging (stronger when low). Each affix has a visual cue and a guaranteed drop. **Loop:** unusual wilds with readable rules. **Interacts:** Alpha encounters, Drops, Observe. **Balance:** limit of elites per region; unfair combos blocked by data. **Cx:** Med.

### M-111 Doctrine Generator
**Rules:** Trainers are given a procedurally generated Doctrine at creation: a name, a strategy (Hyper Offense, Weather, Stall, Hazards), and an exploitable weakness (e.g. "overspecialised on Fire"). The doctrine drives AI behavior and dialogue; defeating them reveals it in the Album. **Loop:** trainers feel like designed opponents. **Interacts:** Behavior Profiles, Trainer classes, Rival adaptation. **Balance:** weaknesses are honest and show once scouted; the pool is authored. **Cx:** Med.

### M-112 Node Rule Cards
**Rules:** Each battle node rolls a Rule Card visible on the map: "Quick Fight" (first turn priority), "Sunlit" (weather), "Narrow Stage" (no spread moves), "Wild Grudge" (foe starts boosted), "Gift Wrap" (an item drops on win). Cards affect both sides. **Loop:** each node is a short puzzle. **Interacts:** Arena modifiers, Terrain, Gym rules. **Balance:** cards come in tiers; never lethal; "No cards" setting. **Cx:** Med.

## Narrative-driven

### M-113 Promise Ledger
**Rules:** When you make a promise in dialogue (e.g. "I'll bring you back a berry"), it enters the Ledger with a deadline in nodes. Keeping it grants trust, gifts or unique events; breaking it has consequences (cold shoulders, unfavorable trades, rival taunts). **Loop:** promises matter. **Interacts:** Favor Ledger, Events, Rival dialogue. **Balance:** promises are optional and displayed; no hidden failures. **Cx:** Med.

### M-114 Witness Testimony
**Rules:** Events record which Pokémon were present. Later, NPCs may ask a witness to testify (the Pokémon that saw the thief, the one that was at the shrine). Having the witness in the party changes outcomes; absent witnesses leave a "no proof" penalty. **Loop:** party composition meets narrative. **Interacts:** Event history, Party Life, Chronicle. **Balance:** witnesses recorded for key events only; always flagged in the Album. **Cx:** Med.

### M-115 Rumor Network
**Rules:** NPCs trade Rumors (a rare Pokémon seen at node X, a merchant selling a relic, a trap ahead). Rumors may be true, partial or false; verifying costs a Scout action. Followed true rumors lead to spawned content; false ones waste time but give lore. **Loop:** information as a resource. **Interacts:** Fog of war, Events, Merchants. **Balance:** rumor truth is seeded at creation; rumor reliability is tied to the NPC (visible stars). **Cx:** Med.

### M-116 Letters from Past Runs
**Rules:** After a run ends, you write (or the game generates) a short Letter for the next run: a warning, a hint, a plea, a taunt. Letters appear at random nodes in later runs as notes or ghost messages, and may include a bonus (a stash, a map fragment). **Loop:** your history talks to you. **Interacts:** Legacy runs, Timeline replays, Rival lines. **Balance:** letters give one small perk and are optional to open; stored with the legacy record. **Cx:** Med.

### M-117 Bond Burn
**Rules:** Spend chemistry points with a partner for a one-time Burn effect: a once-per-battle super move (Full-Bond Strike), a double revive, or an instant escape. The pair's chemistry drops a stage afterwards but regrows if they keep fighting together. **Loop:** relationships as spendable power. **Interacts:** Chemistry stages, Final Act, Overdrive, Teamwork moves. **Balance:** cannot be used on the same pair twice in a run; costs tuned by stage; stays out of raids. **Cx:** Med.
