# Feature Library, part 4: Customization, Secrets and Unlockables, Community, New Ways to Use Existing Content (F-CUS, F-SEC, F-COM, F-NEW)

Design only; nothing approved or built. Field key and ID scheme: see `features-00-index-and-priorities.md`. Fields: What · How · Trigger · Feel · Deps · Rarity · Cx (S/M/L/XL) · Balance. Depth pass applied: concrete rules and a specific balance or risk note per entry.

---

## M. Customization Options (F-CUS)

### F-CUS-01 · Skin Forge (Theme Builder)
**What:** Build your own UI theme from the four house aesthetics. **How:** Sliders for gloss, bounce, neon, and pixel grain; live preview on a Hub page; save and name up to 8 skins; share as a short code. **Trigger:** Settings. **Feel:** Frutiger Aero to Cyber-Maximalism and everything between. **Deps:** theme.ts, aero.ts. **Rarity:** always on. **Cx:** L. **Balance:** a contrast guard clamps unreadable combos; bounce obeys Reduced Motion.

### F-CUS-02 · Battle Frame Sets
**What:** Swap the battle HUD era. **How:** Four sets (DS, Wii, Aero, Cyber) change frames, HP bar shapes, and move buttons; all share the same layout hit areas. **Trigger:** Settings or unlock. **Feel:** The same fight in a different decade. **Deps:** battleUiStyles. **Rarity:** always on. **Cx:** M. **Balance:** identical hit boxes and text size so no set is harder to read.

### F-CUS-03 · Music Mixer Playlists
**What:** Build playlists per context. **How:** Choose tracks for map, boss, shop, and rest slots from unlocked songs; shuffle or fixed order; cross-fade length. **Trigger:** Radio Tower. **Feel:** Your run, your soundtrack. **Deps:** audio, jukebox. **Rarity:** always on. **Cx:** M. **Balance:** boss-role songs keep their urgency; fall back to defaults if a track fails to load.

### F-CUS-04 · Text Box Skins
**What:** Dialogue box styles. **How:** Parchment, terminal, speech bubble, glass; per-speaker overrides optional. **Trigger:** Settings. **Feel:** Taste. **Deps:** battleText. **Rarity:** always on. **Cx:** S. **Balance:** text contrast and size unchanged.

### F-CUS-05 · Nickname Style Tags
**What:** Short tags on nicknames. **How:** Pick one tag from a list ("the Brave", "the Sleepy") unlocked by personality and memories; shown on cards and in dialogue once per scene. **Trigger:** Summary screen. **Feel:** Personality labels. **Deps:** nickname system. **Rarity:** always on. **Cx:** S. **Balance:** length-capped; avoid slurs by using fixed lists.

### F-CUS-06 · Sprite Palette Swaps
**What:** Alternate palettes per species. **How:** Palette maps applied at render; earned via species mastery; labelled so they cannot be mistaken for shiny. **Trigger:** Mastery. **Feel:** Collectible variety. **Deps:** sprites. **Rarity:** always on. **Cx:** M. **Balance:** never use the shiny sparkle effect; must not affect shiny odds.

### F-CUS-07 · Custom Rival Entrance
**What:** Pick your rival's entrance style. **How:** Presets from the animation registry (dash in, drop in, slow walk with wind). **Trigger:** After 5 rival fights. **Feel:** Cinema. **Deps:** storyAnims. **Rarity:** always on. **Cx:** M. **Balance:** duration capped at the existing entrance length.

### F-CUS-08 · Hub Layout Editor
**What:** Rearrange Hub tiles. **How:** Drag and drop tiles and props within a grid; reset button; saved to the profile. **Trigger:** Settings. **Feel:** Your base. **Deps:** HubScene. **Rarity:** always on. **Cx:** L. **Balance:** required tiles (Settings, Run) cannot be hidden.

### F-CUS-09 · Pronoun and Name Preferences
**What:** Set how the game refers to you. **How:** Name and pronoun set with template tokens used in dialogue; defaults to neutral phrasing. **Trigger:** New profile. **Feel:** Inclusion. **Deps:** dialogue tokens. **Rarity:** always on. **Cx:** M. **Balance:** every string using a pronoun needs a test to catch missing tokens.

### F-CUS-10 · Difficulty Dials
**What:** Per-axis difficulty. **How:** Axes for foe level, shop price, event risk, heal supply, rival pressure (each −2..+2), producing a transparent score multiplier shown on the recap and share code. **Trigger:** Run Prep. **Feel:** The exact challenge you want. **Deps:** balance.json, modifiers. **Rarity:** always on. **Cx:** L. **Balance:** multiplier must be derived from sim measurements; clamp combos that make runs unwinnable.

### F-CUS-11 · Accent Sound Packs
**What:** Alternate UI sounds. **How:** Swap click, confirm, error sets (soft, arcade, crystal). **Trigger:** Settings. **Feel:** Texture. **Deps:** procAudio. **Rarity:** always on. **Cx:** S. **Balance:** keep within loudness limits.

### F-CUS-12 · Pokémon Idle Poses
**What:** Pick menu idle animations. **How:** Preset loops (bounce, sway, nap). **Trigger:** Summary screen. **Feel:** Charm. **Deps:** sprites. **Rarity:** always on. **Cx:** M. **Balance:** stays within reduced-motion rules.

### F-CUS-13 · Seasonal Wardrobe Auto-Switch
**What:** Auto-swap outfits. **How:** Rules by real season or region (winter coat in cold regions). **Trigger:** Settings. **Feel:** Alive. **Deps:** wardrobe. **Rarity:** always on. **Cx:** S. **Balance:** manual override always wins.

### F-CUS-14 · Colour Grade Filters
**What:** Optional colour grading. **How:** Post-process filters (Sunset, Gameboy Green, Sepia, Neon). **Trigger:** Settings. **Feel:** Mood. **Deps:** display. **Rarity:** always on. **Cx:** S. **Balance:** disable on low-end devices; keep status colours readable.

---

## N. Secrets and Unlockables (F-SEC)

### F-SEC-01 · The Konami Closet
**What:** A hidden input opens a joke closet. **How:** Title-screen sequence unlocks 5 absurd cosmetics (clown nose, sock puppet). **Trigger:** Input code. **Feel:** Old-school delight. **Deps:** title scene. **Rarity:** secret. **Cx:** S. **Balance:** cosmetic; never required.

### F-SEC-02 · Echo Rooms in the Hub
**What:** Rooms that appear from specific histories. **How:** A hidden door shows after conditions like "lose to your own rival 3 times"; inside is a unique scene and cosmetic. 12 rooms. **Trigger:** History flags. **Feel:** The Hub notices you. **Deps:** chronicle. **Rarity:** rare. **Cx:** M. **Balance:** conditions must be reachable by normal play; no punishing hints.

### F-SEC-03 · Cipher Notes
**What:** Cryptic notes that decode into a secret location. **How:** Collect fragments across runs into the Journal; a simple substitution cipher with in-game clues; success opens a hidden stop in one region. **Trigger:** Fragments. **Feel:** ARG vibe. **Deps:** Journal, events. **Rarity:** very rare. **Cx:** L. **Balance:** reward cosmetic plus lore; give a hint ladder to avoid permanent blocks.

### F-SEC-04 · Developer Room
**What:** A room of design notes. **How:** Unlocked at 100 runs; plaques with cut ideas and the story behind features. **Trigger:** Run count. **Feel:** Behind the scenes. **Deps:** Hub. **Rarity:** rare. **Cx:** M. **Balance:** keep notes spoiler-light.

### F-SEC-05 · Hidden Legendary Rituals
**What:** Legendary encounters from rituals. **How:** Hints in rumours describe a ritual (party types, a node, an item combination); satisfying it spawns a special encounter. **Trigger:** Ritual. **Feel:** Myth-making. **Deps:** encounter director. **Rarity:** extremely rare. **Cx:** L. **Balance:** cannot be farmed (once per profile per legend); rewards avoid power creep.

### F-SEC-06 · Mirror Trainer
**What:** A secret opponent copying your best run. **How:** After a flawless run, a hidden node hosts a mirror trainer with your own team and quirks. **Trigger:** Perfect-run condition. **Feel:** Uncanny. **Deps:** legacy. **Rarity:** rare. **Cx:** M. **Balance:** level-normalised and optional.

### F-SEC-07 · Glitch Zone
**What:** A rare corrupted stop. **How:** 1/500 map spawn; scrambled sprites, odd text, absurd items, all harmless. **Trigger:** Random. **Feel:** Legend. **Deps:** map. **Rarity:** extremely rare. **Cx:** M. **Balance:** must never corrupt state or saves; purely presentation.

### F-SEC-08 · Birthday Mode
**What:** An anniversary party. **How:** On the profile's creation date, Hub decorates, rival sends a card, small cosmetic gift. **Trigger:** Date. **Feel:** Warmth. **Deps:** profile. **Rarity:** yearly. **Cx:** S. **Balance:** gift keyed once per year.

### F-SEC-09 · The Unfinished Room
**What:** A Hub room under construction. **How:** Shows blueprints hinting at future features; changes each update. **Trigger:** Always. **Feel:** Anticipation. **Deps:** Hub. **Rarity:** always on. **Cx:** S. **Balance:** avoid promising unscheduled features.

### F-SEC-10 · Secret Starter Unlocks
**What:** Hidden starters from odd feats. **How:** Silent counters (win without leaving the first region, own 100 Pokémon) unlock a starter. **Trigger:** Feats. **Feel:** Discovery. **Deps:** starter sets. **Rarity:** rare. **Cx:** M. **Balance:** sidegrade power; hints available after 30 runs.

### F-SEC-11 · Talking Wall Poster
**What:** A poster that changes. **How:** Every 10th run shows a new cryptic phrase tied to your history. **Trigger:** Run count. **Feel:** Mystery. **Deps:** Hub. **Rarity:** always on. **Cx:** S. **Balance:** phrases are flavour only.

### F-SEC-12 · Hall of Absurd Feats
**What:** A hall for ridiculous combos. **How:** Detect odd conditions (win with five Magikarp) and display a plaque. **Trigger:** Combos. **Feel:** Humour. **Deps:** stats. **Rarity:** rare. **Cx:** M. **Balance:** not required for any progress.

### F-SEC-13 · Ghost Pokémon in the Hub
**What:** A visiting ghost. **How:** Rarely a ghost species wanders, interacts with props, and vanishes. **Trigger:** Random on Hub load. **Feel:** Spooky. **Deps:** Hub. **Rarity:** rare. **Cx:** S. **Balance:** seeded by profile to avoid reload-farming.

### F-SEC-14 · Final Secret Ending
**What:** An ending behind long-term conditions. **How:** A multi-run trail (rituals, fragments, relationships) culminating in an epilogue run. **Trigger:** Conditions. **Feel:** Payoff. **Deps:** story. **Rarity:** extremely rare. **Cx:** XL. **Balance:** one-time claim; hint system after a threshold.

---

## O. Community-Oriented Features (F-COM)

### F-COM-01 · Seed Postcards
**What:** Share a seed as a postcard. **How:** Illustrated image with the seed code embedded as text; shows team and result. **Trigger:** Run end. **Feel:** Gifting. **Deps:** seeds. **Rarity:** always on. **Cx:** M. **Balance:** images contain no personal data.

### F-COM-02 · Weekly Community Challenge
**What:** A weekly shared seed. **How:** Deterministic seed; results compared via pasted codes. **Trigger:** Date. **Feel:** Together. **Deps:** daily. **Rarity:** weekly. **Cx:** M. **Balance:** results are self-reported; label as unverified.

### F-COM-03 · Team Sharing Codes
**What:** Share a team as a code. **How:** Compact versioned encoding of species, moves, items, nicknames. **Trigger:** Menu. **Feel:** Social. **Deps:** save format. **Rarity:** always on. **Cx:** M. **Balance:** validate with Zod on import; reject illegal sets.

### F-COM-04 · Rival Exchange
**What:** Use a friend's team as your rival. **How:** Import a code; it becomes your rival's ace line-up with their name. **Trigger:** Menu. **Feel:** Personal. **Deps:** rival. **Rarity:** always on. **Cx:** L. **Balance:** level-normalised.

### F-COM-05 · Mod Packs
**What:** Community data packs. **How:** Zod-validated JSON for events, trainers, dialogue; sandboxed with a content status of "community". **Trigger:** Settings. **Feel:** Extensible. **Deps:** schemas. **Rarity:** optional. **Cx:** XL. **Balance:** packs cannot change core saves; show a warning and disable achievements.

### F-COM-06 · Fan Art Frames
**What:** Frames for your own images. **How:** Local image files displayed in Hub frames. **Trigger:** Settings. **Feel:** Personal. **Deps:** files. **Rarity:** optional. **Cx:** S. **Balance:** local only.

### F-COM-07 · Community Name Pools
**What:** Shared lists of names. **How:** Import names and quotes lists. **Trigger:** Settings. **Feel:** Variety. **Deps:** data. **Rarity:** optional. **Cx:** S. **Balance:** filter and length cap.

### F-COM-08 · Guestbook
**What:** A Hub guestbook. **How:** Import message codes from friends. **Trigger:** Code. **Feel:** Warm. **Deps:** Hub. **Rarity:** optional. **Cx:** M. **Balance:** filter messages.

### F-COM-09 · Challenge Creator
**What:** Design your own rules. **How:** Rule builder (modifiers, starters, limits) exporting a share code. **Trigger:** Menu. **Feel:** Creative. **Deps:** modifiers. **Rarity:** optional. **Cx:** L. **Balance:** validate solvability by sim hint.

### F-COM-10 · Co-Writing Events
**What:** Players write events. **How:** Template editor with validation; export packs. **Trigger:** Menu. **Feel:** Creative. **Deps:** events. **Rarity:** optional. **Cx:** XL. **Balance:** validation and sandbox.

### F-COM-11 · Leaderboard Sheets
**What:** Static leaderboards. **How:** Export a seed's scores as a sheet. **Trigger:** Menu. **Feel:** Competitive. **Deps:** seeds. **Rarity:** optional. **Cx:** M. **Balance:** unverified label.

### F-COM-12 · Community Bingo
**What:** Weekly bingo card. **How:** 5x5 goals from quests; shared by seed. **Trigger:** Date. **Feel:** Fun. **Deps:** quests. **Rarity:** weekly. **Cx:** M. **Balance:** no gating.

### F-COM-13 · Tip Exchange
**What:** Player tips on loading screens. **How:** Imported tip lists. **Trigger:** Settings. **Feel:** Community voice. **Deps:** loading screens. **Rarity:** optional. **Cx:** S. **Balance:** filter and length cap.

### F-COM-14 · Shared Hall of Fame Export
**What:** Export your Hall of Fame as a web page. **How:** Static HTML. **Trigger:** Menu. **Feel:** Pride. **Deps:** files. **Rarity:** optional. **Cx:** M. **Balance:** self-contained, no tracking.

---

## P. New Ways to Interact with Existing Content (F-NEW)

### F-NEW-01 · Totem Hunting Journal
**What:** A hunter's journal for Totems. **How:** Per-Totem pages gain notes as you fight (weaknesses, aura rule, phase tells); sketches fill in. **Trigger:** Totem fights. **Feel:** Monster hunting. **Deps:** Totems. **Rarity:** always on. **Cx:** M. **Balance:** only reveals information the player observed.

### F-NEW-02 · Raid Strategy Board
**What:** Plan a raid before entering. **How:** Whiteboard with roles, cheers, and item plans, saved per raid type. **Trigger:** Raid entry. **Feel:** Coordination. **Deps:** raids. **Rarity:** always on. **Cx:** M. **Balance:** advisory only.

### F-NEW-03 · SOS Calling Cards
**What:** Pick how you call allies. **How:** Shout, whistle, flare styles with unique effects and sound. **Trigger:** SOS. **Feel:** Style. **Deps:** SOS. **Rarity:** always on. **Cx:** S. **Balance:** cosmetic.

### F-NEW-04 · Plaza Regulars
**What:** Plaza NPCs remember you. **How:** Regular tags grow with purchases and favourites; they greet you and reserve items. **Trigger:** Plaza. **Feel:** Alive. **Deps:** Plaza. **Rarity:** always on. **Cx:** M. **Balance:** discounts remain within existing caps.

### F-NEW-05 · Bank Heists
**What:** A story event at the Bank. **How:** Rare run event where a robber targets your stash; choices decide losses and rewards. **Trigger:** Random 1/200 runs. **Feel:** Surprise. **Deps:** Bank. **Rarity:** rare. **Cx:** M. **Balance:** loss capped; insured.

### F-NEW-06 · Nemesis Shrine
**What:** A shrine to defeated nemeses. **How:** Plaques with their history; leaving offerings gives a tiny cosmetic. **Trigger:** Defeat a nemesis. **Feel:** Closure. **Deps:** nemesis. **Rarity:** always on. **Cx:** M. **Balance:** cosmetic.

### F-NEW-07 · Rival Letters Archive
**What:** Reread rival letters. **How:** Album with filters and favourites. **Trigger:** Always. **Feel:** Story. **Deps:** rival letters. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-NEW-08 · Moment Codex Quests
**What:** Hints for missing moments. **How:** Codex quests suggest conditions without full spoilers. **Trigger:** Codex. **Feel:** Completionist. **Deps:** Moment Codex. **Rarity:** always on. **Cx:** M. **Balance:** hints vague.

### F-NEW-09 · Expedition Logbooks
**What:** A logbook per expedition. **How:** Auto journal entries. **Trigger:** Expeditions. **Feel:** Adventure. **Deps:** expeditions. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-NEW-10 · Legacy Gallery Tours
**What:** Guided gallery tour. **How:** Narrated by your rival with commentary on each Hall of Fame team. **Trigger:** Gallery. **Feel:** Story. **Deps:** gallery. **Rarity:** always on. **Cx:** M. **Balance:** skippable.

### F-NEW-11 · Research Tree Trial Runs
**What:** Try a node for a run. **How:** Trial grants the node for one run; buying later is discounted. **Trigger:** Tree. **Feel:** Try before buy. **Deps:** Tree. **Rarity:** always on. **Cx:** M. **Balance:** one trial per week.

### F-NEW-12 · Trainer Network Gossip
**What:** Contacts talk about each other. **How:** Dialogue pairs in the café referencing your contacts' services. **Trigger:** Café. **Feel:** Alive. **Deps:** network. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-NEW-13 · Event Archive Sandbox
**What:** Replay past events as a sandbox. **How:** Event simulator with no rewards. **Trigger:** Archive. **Feel:** Learn. **Deps:** Event Archive. **Rarity:** always on. **Cx:** M. **Balance:** no gameplay RNG use.

### F-NEW-14 · Item Museum Tours
**What:** Items tell their story. **How:** A tour with each item's lore and your history with it. **Trigger:** Museum. **Feel:** Lore. **Deps:** museum. **Rarity:** always on. **Cx:** S. **Balance:** none.
