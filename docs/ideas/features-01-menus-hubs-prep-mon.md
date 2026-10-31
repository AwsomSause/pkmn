# Feature Library, part 1: Menus, Hubs, Preparation, Pokémon Management (F-MENU, F-HUB, F-PREP, F-MON)

Initiative 5 of Kice's expansion brief (New Features, 200+). Design only; nothing here is approved or built. See `features-00-index-and-priorities.md` for the ID scheme, what already exists, and the prioritization framework.

Field key per entry: **What** (concept) · **How** (function) · **Trigger** (when/requirements) · **Feel** (player-facing experience) · **Deps** (systems touched) · **Rarity** (frequency) · **Cx** (complexity S/M/L/XL) · **Balance** (concerns).

---

## A. Menus and Interfaces (F-MENU)

### F-MENU-01 · Run Dashboard Drawer
**What:** A pull-out drawer on the map that answers "how is my run going?" at a glance. **How:** Shows party health trend sparkline, money flow, boss countdown, open quests, active nemesis and rival status, in one scrollable card strip. **Trigger:** Always available on the map (key `Tab`/swipe). **Feel:** Never needing to dig through five menus to remember what you were doing. **Deps:** map UI, quests, nemesis, rival, `runStats`. **Rarity:** always on. **Cx:** M. **Balance:** none; information only, but must not reveal hidden seeds.

### F-MENU-02 · Pokémon Cards Fan
**What:** The party shown as a fanned hand of collectible cards instead of a list. **How:** Each card is a flip card: front art + types, back stats, moves, memories; drag to reorder; hover tilts it (Frutiger Aero gloss). **Trigger:** Party screen layout toggle. **Feel:** Holding your team like a trading card hand. **Deps:** partyPanel, summaryLook, style guide. **Rarity:** always on (optional layout). **Cx:** M. **Balance:** none.

### F-MENU-03 · Quick Wheel
**What:** A radial wheel for the 8 most-used actions (bag, party, map, dex, notes, settings, favourite item, repeat last). **How:** Hold a key or long-press; flick toward a slice; slices are rebindable. **Trigger:** Enabled in Settings. **Feel:** Gamepad/touch friendly, snappy. **Deps:** input.ts, touchControls, settings. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-MENU-04 · Context Whisper Bar
**What:** A single line at the screen bottom that explains the thing under the cursor in plain words and one "so what" hint ("Burn halves Attack: good against your Machamp problem"). **How:** Generated from data (move/ability/status/item) plus the team's current gap analysis. **Trigger:** Hover/focus on any item, move, status. **Feel:** A quiet coach for beginners that experts can switch off. **Deps:** dexInfo, tooltips, battleText. **Rarity:** always on. **Cx:** M. **Balance:** must avoid spoiling hidden rolls; hints use only known info.

### F-MENU-05 · Pinned Panels
**What:** Float up to three small panels (type chart, bag, rival notes) over any screen, draggable and resizable. **How:** Each panel is a read-only widget that stays between screens in a run. **Trigger:** Pin button on a panel header. **Feel:** Desktop-style multitasking in a game menu. **Deps:** widgets.ts, layout manager. **Rarity:** optional. **Cx:** L. **Balance:** none; must keep mobile layout usable.

### F-MENU-06 · Universal Search (`/`)
**What:** One search box that finds any Pokémon, move, item, trainer, event, memory, or setting in the game. **How:** Indexes validated data and your save; results show a mini-card and a "Go to" jump. **Trigger:** Press `/` anywhere. **Feel:** Jump anywhere in two keystrokes. **Deps:** data loaders, Dex, Codex, Settings. **Rarity:** always on. **Cx:** L. **Balance:** only searches things you have discovered ("???" otherwise).

### F-MENU-07 · Breadcrumb Rail with History
**What:** A breadcrumb trail on every nested screen plus a "recently opened" list. **How:** Click any crumb to jump back; Alt+Left goes back one screen. **Trigger:** Always. **Feel:** Deep Hub pages stop feeling like mazes. **Deps:** scene routing, `Picker`. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-MENU-08 · Side-by-Side Compare Table
**What:** Compare 2 to 4 Pokémon (party, box, offered rewards, foes) in one table with highlight of best per row. **How:** Rows: stats, moves, ability, bond, memories, held item, matchup vs the next boss. **Trigger:** Select compare on reward screens, party, and Bank. **Feel:** Reward choices become decisions instead of guesses. **Deps:** reward screen, party, matchup calc. **Rarity:** always on. **Cx:** M. **Balance:** matchup column limited to known foe types.

### F-MENU-09 · Reward Screen "Why This" Tags
**What:** Every reward option shows small tags explaining why it is on offer ("Seeded for your Water gap", "Rival's gift", "Nemesis spoils"). **How:** Reward generator already knows its source; surface it. **Trigger:** All reward screens. **Feel:** Rewards feel authored, not random. **Deps:** reward generation, memories. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-MENU-10 · Party Pulse Strip
**What:** A thin strip under the party showing each member's mood glyph, bond heart, and "wants something" bubble. **How:** Driven by party-life/bond state; click a bubble to open that interaction. **Trigger:** Always during runs. **Feel:** The party looks alive even in menus. **Deps:** partyLife, bondLook, memories. **Rarity:** always on. **Cx:** M. **Balance:** no mechanical effect; just a view.

### F-MENU-11 · Journal Tab Bar
**What:** One notebook UI with tabs: Run Log, Rumours, Quests, People, Clues, Pokédex Notes, Your Notes. **How:** Replaces scattered lists; Run Log appends from the Chronicle; free-text notes are editable. **Trigger:** `J` key. **Feel:** An in-world adventurer's notebook. **Deps:** chronicle, quests, rumours, Dex. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-MENU-12 · Confirm Preview ("What will happen")
**What:** Risky choices (release, trade, sell rare item, take curse) show a plain preview of consequences before confirming. **How:** A reversible "ghost state" is computed and diffed against the real state. **Trigger:** Any destructive or permanent action. **Feel:** No more "I didn't mean that". **Deps:** save/run state diff utilities. **Rarity:** common. **Cx:** M. **Balance:** none.

### F-MENU-13 · Layout Presets per Device
**What:** Auto-detected and manually switchable layouts: Desktop, Handheld, Phone Portrait, TV (10-foot). **How:** Scales fonts, spacing, and hit targets; TV mode enlarges everything and shows controller glyphs. **Trigger:** Settings or first-run detection. **Feel:** Comfortable everywhere. **Deps:** display.ts, touchControls. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-MENU-14 · Marginalia Stickers on Menus
**What:** Little player-placed stickers on Hub pages that remember where you put them. **How:** Unlockable stickers (from mastery, events) dropped onto Hub rooms; purely cosmetic. **Trigger:** Sticker drawer in Hub. **Feel:** Personal ownership of the UI. **Deps:** hubProps, collection system, profile save. **Rarity:** optional. **Cx:** S. **Balance:** none.

---

## B. Additional Hubs and Locations (F-HUB)

### F-HUB-01 · The Lighthouse (Daily Beacon)
**What:** A lighthouse room where the Hub's "daily" content lives: Daily Run result, tomorrow's modifier teaser, weekly beacon challenge. **How:** Each real day lights a new lamp; completing three lamps in a week unlocks a rare cosmetic. **Trigger:** Unlocked after the first Daily Run. **Feel:** A calm ritual spot to check in. **Deps:** `core/daily.ts`, rewards claim ledger. **Rarity:** always on. **Cx:** M. **Balance:** cosmetic and small claim-keyed rewards only.

### F-HUB-02 · Observatory (Star Charts)
**What:** A telescope room tracking long-term "constellations" (multi-run goals). **How:** Each constellation is a graph of achievements/mastery goals; completing a star lights a sky tile and reveals lore. **Trigger:** Hub unlock at Prestige 1. **Feel:** A slow-burn map of hundreds of hours. **Deps:** achievements, mastery, legacy. **Rarity:** always on. **Cx:** L. **Balance:** rewards are unlocks, not power.

### F-HUB-03 · Greenhouse & Berry Garden
**What:** A persistent garden that grows berries across runs in real time or run-count. **How:** Plant a berry before a run; harvest after N runs; crossbreeding yields rare berries used as starter-pack items. **Trigger:** After 5 runs. **Feel:** Plants you tend between adventures. **Deps:** items, start grants, Trainer Network. **Rarity:** always on. **Cx:** L. **Balance:** cap yield per run; stock a limit of 3 start-berries.

### F-HUB-04 · Archive Basement (Cold Storage of Ghost Runs)
**What:** A basement with dust-sheeted displays of past runs as dioramas. **How:** Each finished run becomes a tiny diorama (team, rival, final scene); click to open its Chronicle. **Trigger:** Always. **Feel:** Walking through your own history. **Deps:** Legacy Gallery, chronicle. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-HUB-05 · Tournament Hall (Offline Brackets)
**What:** A stadium where past teams fight each other in brackets. **How:** Pick 8 of your saved Hall of Fame teams; simulate with deterministic seeded battles; winner earns a banner. **Trigger:** Win 8 runs. **Feel:** Settling arguments between your own teams. **Deps:** legacy records, battle sim, replay. **Rarity:** always on. **Cx:** XL. **Balance:** needs team-level normalization option; no currency payout.

### F-HUB-06 · Workshop (Tinker Bench)
**What:** A bench where you modify items permanently for future runs ("etch" a held item with a small flavour perk). **How:** Spend Research Points to unlock etchings; one etched item may be carried via item locker. **Trigger:** Research Tree node. **Feel:** Your signature loadout. **Deps:** Research Tree, Item Museum, locker. **Rarity:** always on. **Cx:** M. **Balance:** perks are sidegrades (e.g. +1 PP, nothing raw stat).

### F-HUB-07 · Café (Rest & Rumours)
**What:** A cosy café where NPC contacts chat and drop rumours. **How:** Each visit shows 2 conversations tied to your history; sipping a drink gives a one-run "mood" buff. **Trigger:** Always. **Feel:** A living lounge between runs. **Deps:** Trainer Network, rumour system, dialogue. **Rarity:** always on. **Cx:** M. **Balance:** buff is small and picked, not stacked.

### F-HUB-08 · Training Yard (Sparring Dummies)
**What:** A practice area to test teams without risk. **How:** Choose any Pokémon you've owned (from the Dex/Bank), set level, fight a configurable dummy (move, status, ability); logs damage ranges. **Trigger:** Always. **Feel:** Theorycrafting without a run. **Deps:** engine, Dex, Bank. **Rarity:** always on. **Cx:** L. **Balance:** no rewards; pure sandbox. Note: must not consume gameplay RNG.

### F-HUB-09 · Museum of Moments
**What:** A hall where every Moment Codex entry has a framed scene. **How:** Each scene is a small pixel diorama built from battle/event sprites; rarer moments get bigger frames. **Trigger:** After finding the first moment. **Feel:** Collecting memories as art. **Deps:** Moment Codex, sprites. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-HUB-10 · Rooftop (Photo Garden)
**What:** A roof terrace with a posing stage and backdrops. **How:** Place up to six Pokémon and trainer on a stage with props and lighting; export a postcard. **Trigger:** Unlocked via photo mode. **Feel:** A little studio for sharing. **Deps:** photo mode, wardrobe, collection. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-HUB-11 · Lost & Found Office
**What:** An office returning things you dropped across runs (released Pokémon, unused items). **How:** Each run end may place one "lost" item in the office; claim it by a small fee or a favor. **Trigger:** A run ending with unused rare consumables. **Feel:** Leaving behind something is never completely final. **Deps:** run finalize, item ledger, Bank. **Rarity:** 1 in 8 runs. **Cx:** M. **Balance:** capped to one claim per run; cannot be farmed.

### F-HUB-12 · Radio Tower
**What:** A tower with the in-game radio, jukebox, and "broadcasts" delivering world news. **How:** Plays unlocked music; between songs, short news clips reference your history and world events. **Trigger:** Always. **Feel:** The world talks about you. **Deps:** audio, game-wide events, dialogue. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-HUB-13 · Cellar (Challenge Vault)
**What:** A locked cellar of cursed challenge runs. **How:** Seals open with seals earned from achievements; each seal starts a punishing preset run with a unique relic reward. **Trigger:** Win a Hard run. **Feel:** A hardcore endgame spot. **Deps:** modes, modifiers, Vault. **Rarity:** always on. **Cx:** L. **Balance:** relics are sidegrades, optional.

### F-HUB-14 · Graveyard Garden (Memorial Grove)
**What:** A quiet grove where fallen Pokémon have small stones with epitaphs. **How:** On permanent loss, a stone appears with a generated epitaph from memories; visiting a stone replays a memory. **Trigger:** First permadeath. **Feel:** Emotional weight; a place to pause. **Deps:** chronicle, memories, nuzlocke/permadeath mode. **Rarity:** always on. **Cx:** M. **Balance:** none; avoid morbid tone, stay gentle.

---

## C. Preparation Options (F-PREP)

### F-PREP-01 · Pack Your Bag (Capacity Puzzle)
**What:** Before a run, fit items into a grid pack where size matters. **How:** Items have shapes; a bigger pack is unlocked via the Workshop; unspent space converts to starting gold. **Trigger:** Run Prep. **Feel:** Tetris-like loadout tension. **Deps:** bag, start grants. **Rarity:** optional mode. **Cx:** L. **Balance:** watch hoarding of heals; set maximum shapes.

### F-PREP-02 · Scout Report
**What:** Pay to learn something about the first region before leaving. **How:** Choose 1 of: first gym type, a rare spawn hint, a rival's starter, or weather forecast. **Trigger:** Run Prep with enough Research Points. **Feel:** Strategy before step one. **Deps:** Regional Intelligence Board, seed. **Rarity:** always on. **Cx:** M. **Balance:** only reveals info already decided by the seed; no reroll.

### F-PREP-03 · Pre-Run Mentor Briefing
**What:** A mentor picks one piece of advice based on your history and sets a "lesson" goal. **How:** Completing the lesson (e.g. "Win a fight with a bonded Pokémon") pays a small bonus. **Trigger:** Run Prep. **Feel:** Gentle guidance. **Deps:** playstyle titles, quests. **Rarity:** always on. **Cx:** M. **Balance:** bonus modest.

### F-PREP-04 · Team Rehearsal (Dry-Run Matchups)
**What:** Preview your starter team against the first boss in a no-reward test. **How:** Runs the engine against the seeded first boss with a shortened script; shows "likely outcome" band. **Trigger:** Run Prep after drafting. **Feel:** Confidence or a nudge to change. **Deps:** engine, determinism. **Rarity:** always on. **Cx:** L. **Balance:** only first boss, never later ones.

### F-PREP-05 · Sponsor Contracts
**What:** Take a sponsor that pays out for a self-imposed rule. **How:** "Never use Potions", "Only Water types in gyms"; fulfil → money/cosmetic; break → sponsor drops you. **Trigger:** Run Prep. **Feel:** Self-made challenge with stakes. **Deps:** modifiers, objectives tracker. **Rarity:** always on. **Cx:** M. **Balance:** contract payout scales to difficulty.

### F-PREP-06 · Companion Pick (Hub NPC joins)
**What:** Choose a Hub contact to walk with you as a passive companion. **How:** Provides a small unique perk (map hints, mid-run mail, a one-use assist). **Trigger:** Trainer Network. **Feel:** You don't walk alone. **Deps:** Trainer Network, events. **Rarity:** always on. **Cx:** M. **Balance:** one companion; perks match mastery level.

### F-PREP-07 · Loadout Snapshots
**What:** Save and name complete pre-run setups (set, mode, modifiers, items, contract). **How:** Slot list with one-click apply; share as short codes. **Trigger:** Run Prep. **Feel:** Fast repeat of favourites. **Deps:** run rules, seed codes. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-PREP-08 · Fortune Cookie / Omen Draw
**What:** Draw an omen for the run: a cryptic line tied to a hidden seeded flag. **How:** Omens like "A stranger shall repay a debt" actually bias an event from the pool toward appearing. **Trigger:** Optional at Run Prep. **Feel:** Superstition with real teeth. **Deps:** encounter director, events. **Rarity:** optional. **Cx:** M. **Balance:** the bias is small and positive/negative equally.

### F-PREP-09 · Training Montage (Pre-Run Minigame)
**What:** A 30-second rhythm/timing minigame granting a tiny pre-run bonus. **How:** Score tiers give +1 starting level to one starter or +1 Potion. **Trigger:** Run Prep (skippable). **Feel:** Warm-up that feels earned. **Deps:** minigame framework, input. **Rarity:** optional. **Cx:** M. **Balance:** skip must be equal to a baseline; max bonus small.

### F-PREP-10 · Travel Wardrobe Check (Weather Gear)
**What:** Pick gear sets that matter by region (rain cape, desert veil). **How:** Matching gear gives a small perk on map hazards; cosmetics unlock more. **Trigger:** Run Prep. **Feel:** Dress for the road. **Deps:** wardrobe, regional hazards. **Rarity:** always on. **Cx:** M. **Balance:** perks small, no stat power.

### F-PREP-11 · Gift Exchange (Pre-Run Parcels)
**What:** Receive and send parcels from friends/contacts at run start. **How:** Contacts you favoured send parcels; sending a parcel to a contact raises their affinity for next time. **Trigger:** Trainer Network. **Feel:** Gift-giving relationship. **Deps:** Trainer Network. **Rarity:** always on. **Cx:** M. **Balance:** capped.

### F-PREP-12 · Rival Pre-Match Scouting
**What:** See your rival's last-run team summary before starting. **How:** A dossier panel updated from the rival's history; reading it sets a "study" flag that improves a first meeting dialogue. **Trigger:** Run Prep. **Feel:** Rivalry with homework. **Deps:** living rival. **Rarity:** always on. **Cx:** S. **Balance:** no stat advantage.

### F-PREP-13 · Starter Interview
**What:** Short Q&A with each starter candidate giving it a personality hint. **How:** Answers shape its starting personality trait (a minor weighting) and unlock a starter-specific line. **Trigger:** Starter select. **Feel:** You pick a partner, not a statline. **Deps:** personality, starter sets. **Rarity:** always on. **Cx:** M. **Balance:** small effect.

### F-PREP-14 · Lucky Charm Lottery
**What:** Spin a Hub lottery for one run-long minor charm. **How:** One free spin per real day; spend tickets for more; charm effects are small and flavourful. **Trigger:** Always. **Feel:** Daily ritual hit. **Deps:** items, daily system. **Rarity:** daily. **Cx:** S. **Balance:** limit stacking; cap one charm.

---

## D. Pokémon Management Features (F-MON)

### F-MON-01 · Pokémon Scrapbook
**What:** An auto-curated scrapbook per Pokémon: first catch, best fight, funniest moment. **How:** Pulls memories and screenshots; arranges pages; shareable as a card. **Trigger:** Always, per Pokémon. **Feel:** Each monster has a story book. **Deps:** memories, chronicle, snapshots. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-MON-02 · Training Plans (Weekly Regimen)
**What:** Assign a short "training plan" at rest stops (agility, endurance, focus). **How:** Plan gives small tradeoff boosts for the next 3 nodes (e.g. +speed -defence). **Trigger:** Rest stop. **Feel:** Coaching decisions. **Deps:** rest stops, stats. **Rarity:** common. **Cx:** M. **Balance:** make all plans sidegrades.

### F-MON-03 · Move Tutor Roulette
**What:** A tutor offers 3 unusual moves for a Pokémon, each with an odd price (a memory, a berry, a favor). **How:** Pay in non-gold; moves come from rarer pools with preview. **Trigger:** Event/shop stop. **Feel:** Strange bargains. **Deps:** moves, memories, items. **Rarity:** uncommon. **Cx:** M. **Balance:** price must hurt a little.

### F-MON-04 · Nature Therapy
**What:** Reshape a Pokémon's nature through a 3-fight "counselling" arc. **How:** Choose target nature; fights with conditions (use X type) gradually shift stat modifiers. **Trigger:** Hub or rest. **Feel:** Slow, earned customisation. **Deps:** natures, objectives. **Rarity:** rare. **Cx:** L. **Balance:** cap changes per Pokémon.

### F-MON-05 · Roommate Pairing
**What:** Two Pokémon "share a room" at rest stops and gain pair bonuses. **How:** Pick pairs; each night they can bond, argue, or learn from each other (small move/ability echo). **Trigger:** Rest stop. **Feel:** Chemistry you steer. **Deps:** team chemistry, bonds, party life. **Rarity:** common. **Cx:** M. **Balance:** limited pairs.

### F-MON-06 · Vet Clinic (Condition Checks)
**What:** A stop that diagnoses hidden conditions (low-grade fatigue, nervous, homesick) and offers treatment. **How:** Condition flags set by run events; treatments cost items or time. **Trigger:** Map stop. **Feel:** Care and consequence. **Deps:** party life moods. **Rarity:** common. **Cx:** M. **Balance:** conditions are mild.

### F-MON-07 · Pokémon Diary Pages
**What:** Short generated diary entries per Pokémon after notable events. **How:** Entries use templates keyed to personality and event, viewable in the summary. **Trigger:** After event types. **Feel:** Hearing the monster's view. **Deps:** dialogue, memories. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-MON-08 · Heirloom Slot
**What:** A single slot per Pokémon to hold a keepsake carried across runs. **How:** Keepsakes unlock via mastery; appears with its owner in future runs as a small passive. **Trigger:** Mastery rank. **Feel:** Heirlooms matter. **Deps:** mastery, items. **Rarity:** rare. **Cx:** M. **Balance:** passive small.

### F-MON-09 · Pokéball Customisation
**What:** Cosmetic ball designs and capture effects chosen per Pokémon. **How:** Unlocks from achievements; effect plays on catch and on send-out. **Trigger:** Collection unlocked. **Feel:** Personal flair. **Deps:** capture VFX, collection. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-MON-10 · Fusion Fairground (Temporary Fusion Booth)
**What:** A rare map stop where two Pokémon fuse for one boss. **How:** Merges stats/moves visually and mechanically; splits after the fight with a lingering memory. **Trigger:** Rare map stop. **Feel:** Spectacle. **Deps:** battle, animation registry. **Rarity:** very rare. **Cx:** XL. **Balance:** high; strict one-time use.

### F-MON-11 · Retirement Home (Pasture)
**What:** Retire a Pokémon to a Hub pasture where it generates small passive gifts for future runs. **How:** Retired Pokémon grow content and send a letter each run end; recallable via a legacy slot. **Trigger:** After mastery. **Feel:** Fond farewell. **Deps:** Bank, legacy. **Rarity:** always on. **Cx:** L. **Balance:** gifts small.

### F-MON-12 · Species Study Mode
**What:** A dedicated mini-campaign page per species with goals ("win with this species at level cap"). **How:** Goals add titles and species-specific cosmetics. **Trigger:** Mastery. **Feel:** Species fandom. **Deps:** mastery. **Rarity:** always on. **Cx:** M. **Balance:** cosmetic.

### F-MON-13 · Dream Team Editor
**What:** Build "dream teams" in the Hub and set them as aspirational goals. **How:** Each slot shows % progress (do you own or have mastery); completing grants a title. **Trigger:** Always. **Feel:** Chasing a lineup. **Deps:** Dex, mastery. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-MON-14 · Mood Ring Item (Mood Reader)
**What:** A utility that exposes hidden mood and bond states of your party. **How:** Equip to reveal numeric values; otherwise only vague glyphs appear. **Trigger:** Item find. **Feel:** Insight is rewarding. **Deps:** party life. **Rarity:** uncommon. **Cx:** S. **Balance:** none.
