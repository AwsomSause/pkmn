# Master Idea Library 05: Randomized Content & Procedural Generation (PG-001 to PG-080)

Legend and fields as in file 01. Design only. All randomness must use named seeded streams so runs stay reproducible.

## A. Map and run structure generation

**PG-001 Grammar-Built Routes** — Routes are generated from a grammar (Entry, Obstacle, Choice, Reward, Exit) so every route reads as a tiny story. *Trigger:* route gen. *Feel:* coherent variety. *Rarity:* Always. *Cx:* L. *Deps:* map gen. *Balance:* grammar weights tuned by playtest.

**PG-002 Node Mood Palette** — Each act gets a mood palette (Tense, Playful, Eerie) shifting node odds and music. *Trigger:* act start. *Feel:* acts feel different. *Rarity:* Always. *Cx:* M. *Deps:* encounter director. *Balance:* limited odds shift.

**PG-003 Map Mutators** — Per-run mutators (Fog Year, Gold Rush, Double Trouble) announced at start. *Trigger:* run start. *Feel:* identity per run. *Rarity:* Always. *Cx:* M. *Deps:* challenge modifiers. *Balance:* mutators pairwise tested.

**PG-004 Hidden Shortcuts** — Occasionally a shortcut appears after a specific event; skips nodes but misses rewards. *Trigger:* event. *Feel:* gamble. *Rarity:* Rare. *Cx:* M. *Deps:* map. *Balance:* rewards scale.

**PG-005 Dead-End Gifts** — Dead ends hide a consolation item. *Trigger:* map gen. *Feel:* soft failure. *Rarity:* Common. *Cx:* S. *Deps:* map. *Balance:* low.

**PG-006 Rewritable Maps** — Mid-run the map rewrites after an event (bridge collapse removes a branch, opens another). *Trigger:* event. *Feel:* dynamic. *Rarity:* Uncommon. *Cx:* L. *Deps:* map. *Balance:* fair.

**PG-007 Nested Sub-Maps** — Enter a cave node to play a mini-map with its own nodes. *Trigger:* node. *Feel:* depth. *Rarity:* Common. *Cx:* L. *Deps:* map. *Balance:* time cap.

**PG-008 Boss Foreshadowing Generator** — Each act seeds clues about the boss (feathers on paths if flying boss). *Trigger:* act start. *Feel:* detective. *Rarity:* Always. *Cx:* M. *Deps:* bosses. *Balance:* hints.

**PG-009 Procedural Landmarks** — Unique named landmarks generated from name parts with mini-events attached. *Trigger:* map gen. *Feel:* memorable places. *Rarity:* Common. *Cx:* M. *Deps:* text. *Balance:* none.

**PG-010 Run Length Variants** — Short, standard and epic run lengths with scaled content. *Trigger:* run start. *Feel:* flexibility. *Rarity:* Always. *Cx:* M. *Deps:* run structure. *Balance:* scaling.

## B. Procedural Pokémon and encounters

**PG-011 Individual Backstory Generator** — Each wild Pokémon rolls a micro-backstory (orphan, retired champion's partner) that surfaces if caught. *Trigger:* catch. *Feel:* every catch unique. *Rarity:* Always. *Cx:* L. *Deps:* text, personality. *Balance:* flavour.

**PG-012 Encounter Moods** — Wild groups roll a mood (hungry, nesting, panicked) altering fights and options. *Trigger:* encounter. *Feel:* variety. *Rarity:* Always. *Cx:* M. *Deps:* encounters. *Balance:* modest.

**PG-013 Procedural Variants** — Species get minor variant traits (extra-large, albino patch, alt spots) from seed. *Trigger:* spawn. *Feel:* collectibles. *Rarity:* Common. *Cx:* M. *Deps:* sprites. *Balance:* cosmetic.

**PG-014 Wild Parties** — Wild Pokémon spawn as themed groups (a band, a choir, a family) with unique battle rules. *Trigger:* spawn. *Feel:* surprise. *Rarity:* Uncommon. *Cx:* L. *Deps:* doubles. *Balance:* tuned.

**PG-015 Procedural Trainer Classes** — Hybrid trainer classes generated from two parts (Mystic Fisher) with matching teams and lines. *Trigger:* trainer gen. *Feel:* freshness. *Rarity:* Always. *Cx:* L. *Deps:* trainer data. *Balance:* team rules.

**PG-016 Mutated Moves** — Occasionally a Pokémon learns a mutated move (Water Gun that also heals). *Trigger:* learn. *Feel:* surprise. *Rarity:* Rare. *Cx:* L. *Deps:* move data. *Balance:* capped power.

**PG-017 Odd Held Items** — Wild Pokémon hold odd items (a spoon, a tooth) with minor effects. *Trigger:* spawn. *Feel:* charm. *Rarity:* Common. *Cx:* M. *Deps:* items. *Balance:* tiny.

**PG-018 Name Generation** — Procedural nicknames reflecting nature and history ("Sir Sneeze"). *Trigger:* catch. *Feel:* fun. *Rarity:* Always. *Cx:* S. *Deps:* text. *Balance:* none.

**PG-019 Gendered Behaviour Quirks** — Gender affects minor dialogue and behaviors where species-appropriate (Combee queen). *Trigger:* always. *Feel:* naturalism. *Rarity:* Always. *Cx:* M. *Deps:* gender. *Balance:* none.

**PG-020 Evolution Path Variants** — Procedural alt evolution conditions per run (this run, Eevee evolves into Sylveon if friendly to rain). *Trigger:* run start. *Feel:* fresh. *Rarity:* Uncommon. *Cx:* L. *Deps:* evolution. *Balance:* telegraphed.

## C. Event and dialogue generation

**PG-021 Template-Slot Events** — Events are templates with slots (who, where, what) filled from run state. *Trigger:* event gen. *Feel:* endless combos. *Rarity:* Always. *Cx:* L. *Deps:* event director. *Balance:* guard rails.

**PG-022 Grudge Generator** — Generates grudge events from your battle log (a trainer you embarrassed returns). *Trigger:* battle log. *Feel:* personal. *Rarity:* Common. *Cx:* L. *Deps:* nemesis. *Balance:* scale.

**PG-023 Rumor Mill** — Rumors generated each town, some true some false, tied to future nodes. *Trigger:* town. *Feel:* intrigue. *Rarity:* Common. *Cx:* M. *Deps:* event hints. *Balance:* accuracy tuned.

**PG-024 Dilemma Builder** — Dilemma events compose from value pairs (Mercy vs Profit) matched to context. *Trigger:* event gen. *Feel:* moral options. *Rarity:* Common. *Cx:* L. *Deps:* reputation. *Balance:* equal.

**PG-025 Letter Generator** — Letters from NPCs composed from relationship state. *Trigger:* time. *Feel:* personal. *Rarity:* Common. *Cx:* M. *Deps:* letters. *Balance:* none.

**PG-026 Banter Combinatorics** — Banter lines combine speaker-listener-topic slots with weighted rarity. *Trigger:* idle. *Feel:* freshness. *Rarity:* Always. *Cx:* L. *Deps:* dialogue. *Balance:* none.

**PG-027 Legend Generator** — Each run produces a legend name (The Run of Seven Rains) based on its events. *Trigger:* run end. *Feel:* myth. *Rarity:* Always. *Cx:* M. *Deps:* run history. *Balance:* none.

**PG-028 Procedural Side Quests** — Side quests from templates (find, escort, deliver, mediate) with unique NPC flavour. *Trigger:* town. *Feel:* variety. *Rarity:* Common. *Cx:* L. *Deps:* quests. *Balance:* rewards scaled.

**PG-029 Prophecy System** — At run start receive a vague prophecy; it resolves in surprising ways. *Trigger:* run start. *Feel:* intrigue. *Rarity:* Uncommon. *Cx:* L. *Deps:* event director. *Balance:* optional.

**PG-030 Procedural Puzzles** — Door/lock puzzles generated from item sets in the pack. *Trigger:* node. *Feel:* varied. *Rarity:* Uncommon. *Cx:* L. *Deps:* puzzles. *Balance:* solvability verified.

## D. Loot and economy randomization

**PG-031 Affix Loot** — Items roll prefixes/suffixes ("Gentle Potion of Echoes"). *Trigger:* loot. *Feel:* Diablo-ish excitement. *Rarity:* Common. *Cx:* L. *Deps:* items. *Balance:* affix budget.

**PG-032 Cursed Loot** — Some items are powerful but cursed; curses appear in descriptions with riddles. *Trigger:* loot. *Feel:* gamble. *Rarity:* Rare. *Cx:* M. *Deps:* items. *Balance:* tuned.

**PG-033 Merchant Personalities** — Each merchant rolls a personality (cheat, generous, chatty) affecting prices and info. *Trigger:* shop. *Feel:* interesting. *Rarity:* Always. *Cx:* M. *Deps:* shop. *Balance:* mild.

**PG-034 Market Events** — Price swings from events (berry blight). *Trigger:* world event. *Feel:* economy alive. *Rarity:* Common. *Cx:* M. *Deps:* economy. *Balance:* bounded.

**PG-035 Mystery Boxes** — Boxes with weighted outcomes shown as odds. *Trigger:* loot. *Feel:* thrill. *Rarity:* Common. *Cx:* S. *Deps:* items. *Balance:* transparent.

**PG-036 Seeded Daily Shop** — Daily shop seeded by date; share with friends. *Trigger:* date. *Feel:* community. *Rarity:* Daily. *Cx:* M. *Deps:* seeds. *Balance:* none.

**PG-037 Rune Crafting** — Combine runes randomly to form effects; discovered recipes persist. *Trigger:* crafting. *Feel:* experimentation. *Rarity:* Common. *Cx:* L. *Deps:* crafting. *Balance:* limited.

**PG-038 Unlabelled Items** — Items arrive unidentified until used or appraised; side effects possible. *Trigger:* loot. *Feel:* surprise. *Rarity:* Common. *Cx:* M. *Deps:* items. *Balance:* safe-ish.

**PG-039 Treasure Maps** — Procedural treasure maps leading to specific nodes with riddles. *Trigger:* loot. *Feel:* quest. *Rarity:* Rare. *Cx:* L. *Deps:* map. *Balance:* reward.

**PG-040 Loot Tables With Personality** — Different NPC types drop themed loot (fisher drops baits). *Trigger:* battle. *Feel:* thematic. *Rarity:* Always. *Cx:* M. *Deps:* trainer classes. *Balance:* none.

## E. Challenge and difficulty shaping

**PG-041 Director AI Pacing** — A director monitors stress (HP lows) and adjusts spawns for a rollercoaster, never dull. *Trigger:* run. *Feel:* pacing. *Rarity:* Always. *Cx:* L. *Deps:* encounter director. *Balance:* transparent.

**PG-042 Rubber-Band Gifts** — After heavy losses a kind NPC may appear; after dominance a challenger. *Trigger:* state. *Feel:* fair. *Rarity:* Common. *Cx:* M. *Deps:* director. *Balance:* subtle.

**PG-043 Weighted Chaos Dial** — Settings dial from Calm to Wild, scaling event randomness. *Trigger:* setting. *Feel:* control. *Rarity:* Setting. *Cx:* M. *Deps:* settings. *Balance:* tests.

**PG-044 Fair Seeds** — Seeds validated for solvability by simulated bots. *Trigger:* seed gen. *Feel:* trust. *Rarity:* Always. *Cx:* L. *Deps:* bot walker. *Balance:* internal.

**PG-045 Challenge Seeds Of The Week** — Weekly handpicked seeds with story hooks. *Trigger:* week. *Feel:* shared goal. *Rarity:* Weekly. *Cx:* M. *Deps:* weekly events. *Balance:* none.

**PG-046 Curated Randomness** — Hand-authored events woven into procedural ones for a quality floor. *Trigger:* gen. *Feel:* polish. *Rarity:* Always. *Cx:* M. *Deps:* events. *Balance:* none.

**PG-047 Anti-Repetition Memory** — Generator remembers last N events and avoids repeats across runs. *Trigger:* gen. *Feel:* freshness. *Rarity:* Always. *Cx:* M. *Deps:* save. *Balance:* none.

**PG-048 Difficulty Personas** — Named personas (Cautious, Cruel, Whimsical) shape the whole run's generation tone. *Trigger:* start. *Feel:* theme. *Rarity:* Always. *Cx:* M. *Deps:* director. *Balance:* tests.

**PG-049 Luck Streak Tracking** — Visible luck meter that stores rare drops; spend to reroll. *Trigger:* run. *Feel:* agency. *Rarity:* Always. *Cx:* M. *Deps:* luck attribute. *Balance:* cap.

**PG-050 Mercy Mechanic** — After repeated defeats at the same boss, the boss reveals a weakness hint. *Trigger:* defeats. *Feel:* kind. *Rarity:* Common. *Cx:* S. *Deps:* bosses. *Balance:* subtle.

## F. Procedural art and audio

**PG-051 Procedural Weather Palettes** — Weather tints generated from time and region. *Trigger:* always. *Feel:* alive. *Rarity:* Always. *Cx:* M. *Deps:* shaders. *Balance:* none.

**PG-052 Generated Jingles** — Short motifs for each trainer class from small musical rules. *Trigger:* trainer intro. *Feel:* identity. *Rarity:* Always. *Cx:* L. *Deps:* audio. *Balance:* none.

**PG-053 Sprite Accessories** — Randomly attach accessories (scarf, glasses) to trainers. *Trigger:* gen. *Feel:* variety. *Rarity:* Always. *Cx:* M. *Deps:* sprites. *Balance:* none.

**PG-054 Background Mashups** — Procedurally combine layers to form battle backgrounds. *Trigger:* battle. *Feel:* variety. *Rarity:* Always. *Cx:* M. *Deps:* battlebacks. *Balance:* none.

**PG-055 Title Screen Variation** — Title screen reflects your latest run (silhouettes, weather). *Trigger:* launch. *Feel:* personal. *Rarity:* Always. *Cx:* M. *Deps:* title. *Balance:* none.

**PG-056 Procedural Cries Remix** — Rare Pokémon cries remixed slightly in special states. *Trigger:* state. *Feel:* creepy. *Rarity:* Rare. *Cx:* M. *Deps:* audio. *Balance:* none.

**PG-057 Wanted Posters** — Posters generated for nemesis and notorious runs. *Trigger:* nemesis. *Feel:* ominous. *Rarity:* Uncommon. *Cx:* M. *Deps:* nemesis. *Balance:* none.

**PG-058 Run Postcards** — Auto-made postcards with sprite, location and a caption per run. *Trigger:* nodes. *Feel:* shareable. *Rarity:* Common. *Cx:* M. *Deps:* screenshots. *Balance:* none.

**PG-059 Crest Generator** — Teams get crests from party types and history. *Trigger:* run. *Feel:* identity. *Rarity:* Always. *Cx:* M. *Deps:* UI. *Balance:* none.

**PG-060 Procedural Ruin Murals** — Murals depicting your past runs inside ancient ruins. *Trigger:* ruin. *Feel:* mythic. *Rarity:* Rare. *Cx:* L. *Deps:* Legacy. *Balance:* none.

## G. Meta-generation and emergent systems

**PG-061 Seed Stories** — Every seed gets a one-paragraph premise summarizing mutators and quirks. *Trigger:* seed. *Feel:* narrative hook. *Rarity:* Always. *Cx:* M. *Deps:* seeds. *Balance:* none.

**PG-062 Persistent Procedural NPCs** — NPCs generated once then persist across runs, aging. *Trigger:* NPC gen. *Feel:* community. *Rarity:* Always. *Cx:* L. *Deps:* Legacy. *Balance:* none.

**PG-063 Crossover Seeds** — Combine two seeds' mutators for chaos. *Trigger:* menu. *Feel:* tinkering. *Rarity:* Setting. *Cx:* S. *Deps:* seeds. *Balance:* none.

**PG-064 Procedural Rival Archetypes** — Rival regenerates style based on how you beat them. *Trigger:* rival. *Feel:* adaptive. *Rarity:* Always. *Cx:* L. *Deps:* rival. *Balance:* tests.

**PG-065 Weather Generator Histories** — Weather has weeks-long patterns recorded in an almanac. *Trigger:* world. *Feel:* realism. *Rarity:* Always. *Cx:* M. *Deps:* weather. *Balance:* none.

**PG-066 Biome Blending** — Biomes blend at borders producing hybrid habitats (marsh-forest). *Trigger:* map. *Feel:* naturalistic. *Rarity:* Always. *Cx:* L. *Deps:* biomes. *Balance:* none.

**PG-067 Legend-Seeds** — Seeds that create mythic mutated worlds, unlocked by feats. *Trigger:* unlock. *Feel:* prestige. *Rarity:* Rare. *Cx:* M. *Deps:* seeds. *Balance:* tests.

**PG-068 Rare Variant Rolls** — A one in ten thousand roll turns a node into a "Miracle Node" with a unique scenario. *Trigger:* roll. *Feel:* legend. *Rarity:* Extremely rare. *Cx:* M. *Deps:* event director. *Balance:* hand-authored.

**PG-069 Generator Mistakes As Features** — Rare "glitch" generations are curated as celebrated weirdness (a trainer with only Magikarp). *Trigger:* roll. *Feel:* funny. *Rarity:* Rare. *Cx:* M. *Deps:* gen. *Balance:* harmless.

**PG-070 Procedural Epitaphs** — Fallen Pokémon epitaphs from history. *Trigger:* faint. *Feel:* poignant. *Rarity:* Always. *Cx:* S. *Deps:* text. *Balance:* none.

## H. Player-seeded generation

**PG-071 Name Your Seed** — Type a word to generate a seed; words produce flavour hints. *Trigger:* menu. *Feel:* creative. *Rarity:* Setting. *Cx:* S. *Deps:* seeds. *Balance:* none.

**PG-072 Pokémon-Seeded Worlds** — Seed from your Pokémon's nickname or stats. *Trigger:* menu. *Feel:* personal. *Rarity:* Setting. *Cx:* S. *Deps:* seeds. *Balance:* none.

**PG-073 Dream Journal Seeds** — Dream events generate future seeds. *Trigger:* sleeping. *Feel:* meta. *Rarity:* Rare. *Cx:* M. *Deps:* dreams. *Balance:* none.

**PG-074 Randomised Starters Reveal** — Starters shown as shadows revealed gradually. *Trigger:* start. *Feel:* suspense. *Rarity:* Always. *Cx:* S. *Deps:* starter sets. *Balance:* none.

**PG-075 Bingo Runs** — A bingo card of objectives generated per run; completing lines gives rewards. *Trigger:* run start. *Feel:* goals. *Rarity:* Always. *Cx:* M. *Deps:* achievements. *Balance:* tuned.

**PG-076 Drafted Hazards** — Each act pick a hazard to face in exchange for a boon. *Trigger:* act. *Feel:* risk. *Rarity:* Always. *Cx:* M. *Deps:* mutators. *Balance:* equal.

**PG-077 Chain Events** — Events chain into multi-node stories with branches. *Trigger:* event. *Feel:* narrative. *Rarity:* Uncommon. *Cx:* L. *Deps:* event director. *Balance:* none.

**PG-078 Procedural Superlatives** — End-of-run awards generated from stats (Most Dramatic Faint). *Trigger:* run end. *Feel:* funny. *Rarity:* Always. *Cx:* S. *Deps:* stats. *Balance:* none.

**PG-079 Seeded Shiny Hunts** — Hunt shinies within seeds with chain visual. *Trigger:* menu. *Feel:* tradition. *Rarity:* Setting. *Cx:* M. *Deps:* shiny. *Balance:* none.

**PG-080 Procedural Ending Variation** — The final scene composes from run history with variants. *Trigger:* ending. *Feel:* payoff. *Rarity:* Always. *Cx:* L. *Deps:* run history. *Balance:* none.
