# Feature Library, part 4: Customization, Secrets and Unlockables, Community, New Ways to Use Existing Content (F-CUS, F-SEC, F-COM, F-NEW)

Design only; nothing approved or built. Field key and ID scheme: see `features-00-index-and-priorities.md`. Fields: What · How · Trigger · Feel · Deps · Rarity · Cx (S/M/L/XL) · Balance.

---

## M. Customization Options (F-CUS)

### F-CUS-01 · Skin Forge (Theme Builder)
**What:** Build your own UI theme from the four house aesthetics. **How:** Sliders for gloss, bounce, neon, pixel-grain; live preview on Hub; save and name. **Trigger:** Settings. **Feel:** Frutiger Aero to Cyber-Maximalism and everything between. **Deps:** theme.ts, aero.ts. **Rarity:** always on. **Cx:** L. **Balance:** none; contrast guard prevents unreadable combos.

### F-CUS-02 · Battle Frame Sets
**What:** Swap the battle HUD frame between eras (DS, Wii, Aero, Cyber). **How:** Each set swaps frames, HP bar shapes, and move buttons. **Trigger:** Settings or unlock. **Feel:** The same fight in a different decade. **Deps:** battleUiStyles. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-CUS-03 · Music Mixer Playlists
**What:** Build playlists per context (map, boss, shop). **How:** Choose tracks from unlocked songs per slot, with shuffle or fixed order. **Trigger:** Radio Tower. **Feel:** Your run, your soundtrack. **Deps:** audio, jukebox. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-CUS-04 · Text Box Skins
**What:** Dialogue box styles (parchment, terminal, bubble). **How:** Skin tokens plus per-speaker overrides. **Trigger:** Settings. **Feel:** Taste. **Deps:** battleText. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-CUS-05 · Nickname Style Tags
**What:** Add emoji-free style tags to nicknames (the Brave, the Sleepy). **How:** Tag chips shown on cards and in dialogue. **Trigger:** Summary screen. **Feel:** Personality labels. **Deps:** nickname system. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-CUS-06 · Sprite Palette Swaps (Fun Recolors)
**What:** Unlockable alternate palettes for any species, non-shiny. **How:** Palette maps applied at render; earned by mastery. **Trigger:** Mastery. **Feel:** Collectible variety. **Deps:** sprites. **Rarity:** always on. **Cx:** M. **Balance:** none; never confusable with shiny odds.

### F-CUS-07 · Custom Rival Entrance
**What:** Choose how your rival's entrance looks from unlocked variants. **How:** Picks from animation registry presets. **Trigger:** After 5 rival fights. **Feel:** Cinema. **Deps:** storyAnims. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-CUS-08 · Hub Layout Editor
**What:** Rearrange Hub tiles and rooms. **How:** Drag-and-drop; save layouts. **Trigger:** Settings. **Feel:** Your base. **Deps:** HubScene. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-CUS-09 · Pronoun and Name Preferences
**What:** Set trainer name, pronouns, and how NPCs address you. **How:** Template tokens in dialogue. **Trigger:** New profile. **Feel:** Inclusion. **Deps:** dialogue tokens. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-CUS-10 · Difficulty Dials (Per-Axis)
**What:** Tune difficulty by axis (foe level, shop price, event risk, heal supply) instead of one slider. **How:** Axis sliders with a combined score multiplier; shown in the run recap. **Trigger:** Run Prep. **Feel:** Exactly the challenge you want. **Deps:** balance.json, modifiers. **Rarity:** always on. **Cx:** L. **Balance:** score multiplier must reward real challenge only.

### F-CUS-11 · Accent Sound Packs
**What:** Alternate UI sound sets. **How:** Swap click, confirm, and error sounds. **Trigger:** Settings. **Feel:** Texture. **Deps:** procAudio. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-CUS-12 · Pokémon Idle Poses
**What:** Pick idle animations for menu displays. **How:** Preset animations. **Trigger:** Summary screen. **Feel:** Charm. **Deps:** sprites. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-CUS-13 · Seasonal Wardrobe Auto-Switch
**What:** Auto-swap wardrobe by real season or region. **How:** Rules editor. **Trigger:** Settings. **Feel:** Alive. **Deps:** wardrobe. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-CUS-14 · Colour Grade Filters
**What:** Optional colour grade (Sunset, Gameboy Green, Sepia). **How:** Post-process filter. **Trigger:** Settings. **Feel:** Mood. **Deps:** display. **Rarity:** always on. **Cx:** S. **Balance:** none.

---

## N. Secrets and Unlockables (F-SEC)

### F-SEC-01 · The Konami Closet
**What:** A hidden input sequence opens a closet with joke cosmetics. **How:** Sequence on the title screen unlocks 5 absurd items. **Trigger:** Input code. **Feel:** Old-school delight. **Deps:** title scene. **Rarity:** secret. **Cx:** S. **Balance:** cosmetic.

### F-SEC-02 · Echo Rooms in the Hub
**What:** Rooms that only appear after a specific run history (e.g. lose to your own rival 3 times). **How:** Hidden door appears; contains a unique scene and cosmetic. **Trigger:** History flags. **Feel:** The Hub notices you. **Deps:** chronicle. **Rarity:** rare. **Cx:** M. **Balance:** none.

### F-SEC-03 · Cipher Notes
**What:** Cryptic notes found across runs that decode into a secret location. **How:** Collect cipher fragments in the Journal; solving unlocks a hidden stop. **Trigger:** Fragments. **Feel:** ARG vibe. **Deps:** Journal, events. **Rarity:** very rare. **Cx:** L. **Balance:** reward cosmetic plus lore.

### F-SEC-04 · Developer Room
**What:** An in-world developer room with commentary. **How:** Unlocked by 100 runs; plaques with design notes and cut ideas. **Trigger:** Run count. **Feel:** Behind-the-scenes. **Deps:** hub. **Rarity:** rare. **Cx:** M. **Balance:** none.

### F-SEC-05 · Hidden Legendary Rituals
**What:** Legendary encounters unlocked by ritual (arrange party types, visit at a time). **How:** Hints in rumours; satisfy hidden conditions. **Trigger:** Ritual. **Feel:** Myth-making. **Deps:** encounter director. **Rarity:** extremely rare. **Cx:** L. **Balance:** high stakes, cannot be farmed.

### F-SEC-06 · Mirror Trainer
**What:** A secret opponent copying your best run. **How:** Appears after a perfect run. **Trigger:** Condition. **Feel:** Uncanny. **Deps:** legacy. **Rarity:** rare. **Cx:** M. **Balance:** tuned.

### F-SEC-07 · Glitch Zone
**What:** A rare corrupted stop with scrambled sprites and odd rules. **How:** Safe, comedic, with unique items. **Trigger:** Random 1/500. **Feel:** Legend. **Deps:** map. **Rarity:** extremely rare. **Cx:** M. **Balance:** isolated.

### F-SEC-08 · Birthday Mode
**What:** On the profile's anniversary, a special party. **How:** Hub celebrates, small gifts. **Trigger:** Date. **Feel:** Warmth. **Deps:** profile. **Rarity:** yearly. **Cx:** S. **Balance:** none.

### F-SEC-09 · The Unfinished Room
**What:** A Hub room that is literally under construction and changes each update. **How:** Shows hints at future content. **Trigger:** Always. **Feel:** Anticipation. **Deps:** hub. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-SEC-10 · Secret Starter Unlocks
**What:** Hidden starters unlocked by odd feats. **How:** Feats tracked silently. **Trigger:** Feats. **Feel:** Discovery. **Deps:** starter sets. **Rarity:** rare. **Cx:** M. **Balance:** sidegrade.

### F-SEC-11 · Talking Wall Poster
**What:** A poster in Hub that changes with every 10th run. **How:** Cryptic phrases. **Trigger:** Run count. **Feel:** Mystery. **Deps:** hub. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-SEC-12 · Hall of Absurd Feats
**What:** A hidden hall listing ridiculous feats you did. **How:** Detects weird combos. **Trigger:** Combos. **Feel:** Humour. **Deps:** stats. **Rarity:** rare. **Cx:** M. **Balance:** none.

### F-SEC-13 · Ghost Pokémon in the Hub
**What:** Occasionally a ghost species wanders the Hub. **How:** Appears rarely, interacts with props. **Trigger:** Random. **Feel:** Spooky. **Deps:** hub. **Rarity:** rare. **Cx:** S. **Balance:** none.

### F-SEC-14 · Final Secret Ending
**What:** An ending behind long-term conditions. **How:** Multi-run trail. **Trigger:** Conditions. **Feel:** Payoff. **Deps:** story. **Rarity:** extremely rare. **Cx:** XL. **Balance:** none.

---

## O. Community-Oriented Features (F-COM)

### F-COM-01 · Seed Postcards
**What:** Share a run's seed as an illustrated postcard. **How:** Image with embedded code. **Trigger:** Run end. **Feel:** Gifting. **Deps:** seeds. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-COM-02 · Weekly Community Challenge (Offline-Verified)
**What:** A weekly seed everyone plays, results compared via shared codes. **How:** Deterministic seed; results pasted into a leaderboard sheet. **Trigger:** Date. **Feel:** Together. **Deps:** daily. **Rarity:** weekly. **Cx:** M. **Balance:** none.

### F-COM-03 · Team Sharing Codes
**What:** Share a team as a code others can play against. **How:** Compact encoding. **Trigger:** Menu. **Feel:** Social. **Deps:** save format. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-COM-04 · Rival Exchange
**What:** Import a friend's team as your rival for a run. **How:** Code import. **Trigger:** Menu. **Feel:** Personal. **Deps:** rival. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-COM-05 · Mod Packs (Data-Driven)
**What:** Load community data packs (events, trainers). **How:** Validated JSON. **Trigger:** Settings. **Feel:** Extensible. **Deps:** Zod schemas. **Rarity:** optional. **Cx:** XL. **Balance:** sandboxed.

### F-COM-06 · Fan Art Frames
**What:** Hub frames showing player-supplied images. **How:** Local files. **Trigger:** Settings. **Feel:** Personal. **Deps:** files. **Rarity:** optional. **Cx:** S. **Balance:** none.

### F-COM-07 · Community Name Pools
**What:** Shared lists of trainer names and quotes. **How:** Import. **Trigger:** Settings. **Feel:** Variety. **Deps:** data. **Rarity:** optional. **Cx:** S. **Balance:** none.

### F-COM-08 · Guestbook
**What:** A guestbook in the Hub with messages from other players' codes. **How:** Local import. **Trigger:** Code. **Feel:** Warm. **Deps:** hub. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-COM-09 · Challenge Creator
**What:** Design a custom rule set and share. **How:** Rule builder. **Trigger:** Menu. **Feel:** Creative. **Deps:** modifiers. **Rarity:** optional. **Cx:** L. **Balance:** none.

### F-COM-10 · Co-Writing Events
**What:** Players write events in a template and share. **How:** Event editor. **Trigger:** Menu. **Feel:** Creative. **Deps:** events. **Rarity:** optional. **Cx:** XL. **Balance:** validation.

### F-COM-11 · Leaderboard Sheets (Static)
**What:** Static leaderboards for seeds. **How:** Exportable. **Trigger:** Menu. **Feel:** Competitive. **Deps:** seeds. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-COM-12 · Community Bingo
**What:** A bingo card of run goals. **How:** Shared card per week. **Trigger:** Date. **Feel:** Fun. **Deps:** quests. **Rarity:** weekly. **Cx:** M. **Balance:** none.

### F-COM-13 · Tip Exchange
**What:** Players write tips displayed on loading screens. **How:** Imported lists. **Trigger:** Settings. **Feel:** Community voice. **Deps:** loading screens. **Rarity:** optional. **Cx:** S. **Balance:** moderation.

### F-COM-14 · Shared Hall of Fame Export
**What:** Export Hall of Fame as a web page. **How:** Static HTML. **Trigger:** Menu. **Feel:** Pride. **Deps:** files. **Rarity:** optional. **Cx:** M. **Balance:** none.

---

## P. New Ways to Interact with Existing Content (F-NEW)

### F-NEW-01 · Totem Hunting Journal
**What:** Track Totem sightings, weaknesses found, and rewards. **How:** Journal pages unlock tactical notes per Totem. **Trigger:** Totem fights. **Feel:** Monster hunting. **Deps:** Totems. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-NEW-02 · Raid Strategy Board
**What:** Plan a raid with a whiteboard (assign roles, cheers). **How:** Pre-raid planning UI. **Trigger:** Raid entry. **Feel:** Co-ordination. **Deps:** raids. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-NEW-03 · SOS Calling Cards
**What:** Choose a calling style for SOS (shout, whistle, flare). **How:** Changes call visuals. **Trigger:** SOS. **Feel:** Style. **Deps:** SOS. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-NEW-04 · Plaza Regulars
**What:** NPCs in the Plaza remember purchases and develop favourites. **How:** Regular tags. **Trigger:** Plaza. **Feel:** Alive. **Deps:** Plaza. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-NEW-05 · Bank Heists (Story)
**What:** A story event at the Bank. **How:** Rare run event. **Trigger:** Random. **Feel:** Surprise. **Deps:** Bank. **Rarity:** rare. **Cx:** M. **Balance:** none.

### F-NEW-06 · Nemesis Shrine
**What:** A shrine where defeated nemeses are honoured. **How:** Shows their history. **Trigger:** Defeat nemesis. **Feel:** Closure. **Deps:** nemesis. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-NEW-07 · Rival Letters Archive
**What:** Collect and reread rival letters. **How:** Letter album. **Trigger:** Always. **Feel:** Story. **Deps:** rival letters. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-NEW-08 · Moment Codex Quests
**What:** Quests to find missing moments. **How:** Hints. **Trigger:** Codex. **Feel:** Completionist. **Deps:** Moment Codex. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-NEW-09 · Expedition Logbooks
**What:** A logbook per expedition. **How:** Auto journal. **Trigger:** Expeditions. **Feel:** Adventure. **Deps:** expeditions. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-NEW-10 · Legacy Gallery Tours
**What:** Guided walkthrough narrated by your rival. **How:** Scripted tour. **Trigger:** Gallery. **Feel:** Story. **Deps:** gallery. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-NEW-11 · Research Tree Preview Runs
**What:** Try a Tree node for one run before buying. **How:** Trial. **Trigger:** Tree. **Feel:** Try before buy. **Deps:** Tree. **Rarity:** always on. **Cx:** M. **Balance:** limited.

### F-NEW-12 · Trainer Network Gossip
**What:** Contacts gossip about each other. **How:** Dialogue pairs. **Trigger:** Cafe. **Feel:** Alive. **Deps:** network. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-NEW-13 · Event Archive Rewind
**What:** Replay past events as a sandbox. **How:** Event simulator. **Trigger:** Archive. **Feel:** Learn. **Deps:** Event Archive. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-NEW-14 · Item Museum Tours
**What:** Items tell their story. **How:** Tour. **Trigger:** Museum. **Feel:** Lore. **Deps:** museum. **Rarity:** always on. **Cx:** S. **Balance:** none.
