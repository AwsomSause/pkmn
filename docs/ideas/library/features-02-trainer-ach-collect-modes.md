# Feature Library, part 2: Trainer Customization, Achievements, Collections, Game Modes (F-TRN, F-ACH, F-COL, F-MODE)

Design only; nothing approved or built. Field key and ID scheme: see `features-00-index-and-priorities.md`. Fields: What · How · Trigger · Feel · Deps · Rarity · Cx (S/M/L/XL) · Balance.

---

## E. Trainer Customization (F-TRN)

### F-TRN-01 · Catchphrase Forge
**What:** Write or pick your trainer's signature battle shout. **How:** Choose from word-bank slots (verb + noun + flourish) or free text with a filter; it appears at send-out and in rival replays. **Trigger:** Trainer Card. **Feel:** A line other trainers can quote back at you. **Deps:** trainer card, dialogue, rival memory. **Rarity:** always on. **Cx:** M. **Balance:** none; cosmetic.

### F-TRN-02 · Signature Pose Library
**What:** Unlockable send-out and victory poses. **How:** Each pose is a short sprite cue played in battle; unlocked by titles and mastery. **Trigger:** Wardrobe. **Feel:** Style as achievement. **Deps:** wardrobe, presentation cues, animation registry. **Rarity:** always on. **Cx:** M. **Balance:** none; respects motion settings.

### F-TRN-03 · Trainer Backstory Picker
**What:** Choose a short backstory that colors NPC reactions for the run. **How:** E.g. "Ex-Ranger", "Failed Champion's Apprentice": three NPC lines change, one event gets a bonus option. **Trigger:** Run Prep. **Feel:** Roleplay hook. **Deps:** trainer classes, events, dialogue. **Rarity:** always on. **Cx:** L. **Balance:** options should be sidegrades.

### F-TRN-04 · Aging Trainer Portrait
**What:** Your portrait visibly ages and scars across milestones. **How:** Prestige and long careers add subtle marks (scar, medal, gray hair), purely cosmetic and optional. **Trigger:** Profile milestones. **Feel:** A face with history. **Deps:** portraits, prestige. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-TRN-05 · Team Uniform Designer
**What:** Color and badge your party's shared "team look". **How:** Bandanas, scarves, and trainer-matching palettes applied to party sprites in menus. **Trigger:** Wardrobe. **Feel:** Cohesive squad identity. **Deps:** sprite tinting, wardrobe. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-TRN-06 · Gym Leader Style (Trainer Archetype Badge)
**What:** Self-declare a specialty type and earn a Hub display for it. **How:** Win with a themed team enough times to earn the title "Water Specialist" with a banner room. **Trigger:** Mastery. **Feel:** Identity through play. **Deps:** playstyle titles. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-TRN-07 · Voice Pack (Text Blips)
**What:** Pick a text-blip voice for your trainer's dialogue. **How:** Short procedural blip sound per character; unlockable packs. **Trigger:** Settings. **Feel:** Tiny audio personality. **Deps:** procAudio. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-TRN-08 · Trainer Rank Plate
**What:** A shared-looking plate summarizing rank, title, and region progress. **How:** Appears on loading screens and rival dossiers. **Trigger:** Always. **Feel:** Status. **Deps:** prestige, titles. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-TRN-09 · Rival Rename and Persona Pick
**What:** Let the player name their rival and pick one of several persona flavours. **How:** Persona changes dialogue tone (friendly, snide, nervous), not stats. **Trigger:** New profile or Prep. **Feel:** Personal ownership. **Deps:** living rival, dialogue tags. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-TRN-10 · Hub Mascot Companion
**What:** Pick a retired Pokémon as a Hub mascot that roams and comments. **How:** It wanders, reacts to your actions, and gives tiny hints. **Trigger:** After retirement. **Feel:** A pet in the Hub. **Deps:** pasture, hub props. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-TRN-11 · Trainer Signature Move (Technique)
**What:** A once-per-battle trainer technique (a shout, a whistle). **How:** Cosmetic variant of a small existing trainer ability with unique flavour. **Trigger:** Unlocked via mastery. **Feel:** Drama on command. **Deps:** trainer abilities, battle UI. **Rarity:** always on. **Cx:** M. **Balance:** keep effect minor and shared across variants.

### F-TRN-12 · Custom Title Composer
**What:** Combine unlocked title fragments into your own title ("Storm-Bound Wanderer"). **How:** Two to three fragments from a unlock pool; shown on cards and replays. **Trigger:** Titles unlocked. **Feel:** Self-authored legend. **Deps:** playstyle titles. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-TRN-13 · Walk Animation Chooser
**What:** Pick map walking style (stroll, strut, tired shuffle). **How:** Pure sprite animation variants. **Trigger:** Wardrobe. **Feel:** Charm. **Deps:** map sprites. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-TRN-14 · Signature Item Charm
**What:** Pick one cosmetic keepsake that shows up in dialogues ("Nice scarf!"). **How:** NPCs remark on it based on class; some rare NPCs have special lines. **Trigger:** Wardrobe. **Feel:** Being noticed. **Deps:** dialogue, wardrobe. **Rarity:** always on. **Cx:** M. **Balance:** none.

---

## F. Achievement Expansions (F-ACH)

### F-ACH-01 · Achievement Chains with Story
**What:** Chains of achievements that unlock narrative scenes. **How:** Completing a chain plays a short vignette in the Hub. **Trigger:** Chain completion. **Feel:** Achievements lead somewhere. **Deps:** achievements, cutscene player. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-ACH-02 · Secret Achievements with Riddle Hints
**What:** Hidden achievements shown as riddles. **How:** Riddle text reveals more after each partial progress. **Trigger:** Progress on hidden counters. **Feel:** Puzzle solving. **Deps:** achievements. **Rarity:** rare. **Cx:** M. **Balance:** none.

### F-ACH-03 · Achievement Shiny Variants
**What:** Gold-tier versions of achievements with stricter conditions. **How:** Each normal achievement has a "gold" variant with an extra rule (no healing, no items). **Trigger:** After normal tier. **Feel:** Mastery depth. **Deps:** achievements, run rules. **Rarity:** always on. **Cx:** M. **Balance:** reward cosmetic.

### F-ACH-04 · Anti-Achievements (Dubious Honours)
**What:** Funny "achievements" for bad moments (lose to a Magikarp). **How:** Light-hearted titles with unique animations; no punishment. **Trigger:** Unlucky events. **Feel:** Laughing at failure. **Deps:** achievements, moments. **Rarity:** uncommon. **Cx:** S. **Balance:** none.

### F-ACH-05 · Species-Specific Achievement Sets
**What:** Dedicated achievements for each species family. **How:** Quirky goals ("Win a fight with Slowpoke in under 10 seconds"). **Trigger:** Species use. **Feel:** Fandom nods. **Deps:** achievements, mastery. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-ACH-06 · Rival-Linked Achievements
**What:** Achievements about your rival's arc. **How:** E.g. "Be rescued by your rival 3 times". **Trigger:** Rival events. **Feel:** Shared story credit. **Deps:** living rival. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-ACH-07 · Time-of-Day Achievements
**What:** Achievements tied to real clock times (win a boss at midnight). **How:** Uses local time, offline-safe. **Trigger:** Local clock. **Feel:** Ritual feel. **Deps:** achievements. **Rarity:** rare. **Cx:** S. **Balance:** none; never required.

### F-ACH-08 · Cooperative Achievement Pairs
**What:** Achievements requiring two Pokémon with matching memories. **How:** Pair-level goals (win using bonded duo). **Trigger:** Pair tracking. **Feel:** Chemistry rewarded. **Deps:** chemistry, achievements. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-ACH-09 · Achievement Medals Wall
**What:** A Hub wall displaying earned medals with art. **How:** Pin favourites; rarer ones glow. **Trigger:** Always. **Feel:** Trophy pride. **Deps:** hub props. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-ACH-10 · Achievement Rewards Choice
**What:** Choose one of three cosmetic rewards per tier. **How:** Pick pipeline with preview. **Trigger:** Achievement claim. **Feel:** Agency. **Deps:** collection. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-ACH-11 · Seasonal Achievement Tracks
**What:** Limited-time tracks that return annually. **How:** Local date based; cosmetic prizes. **Trigger:** Date. **Feel:** Event rhythm. **Deps:** seasonal events. **Rarity:** seasonal. **Cx:** M. **Balance:** no catch-up pressure; always claimable later via Event Archive.

### F-ACH-12 · "Firsts" Ledger
**What:** A ledger of your first-ever of everything (first shiny, first loss, first nemesis). **How:** Timestamped entries with a one-line quip. **Trigger:** First occurrences. **Feel:** Personal history. **Deps:** chronicle. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-ACH-13 · Community Percent Badges
**What:** Show how rare an achievement is (offline estimate seeded from tuned data). **How:** Ships a static table; no network. **Trigger:** Always. **Feel:** Bragging rights. **Deps:** achievements. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-ACH-14 · Achievement Mastery Scores
**What:** A total score with tiers that unlock Hub rooms. **How:** Weighted points per achievement. **Trigger:** Always. **Feel:** Long-term goal. **Deps:** hub, achievements. **Rarity:** always on. **Cx:** S. **Balance:** none.

---

## G. Collection Systems (F-COL)

### F-COL-01 · Pokémon Photo Album
**What:** Auto-captured stills per species (first seen, shiny, evolve). **How:** Stills stored as tiny image strips. **Trigger:** Events. **Feel:** Real album. **Deps:** snapshots, storage budget. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-COL-02 · Ribbon Shelf
**What:** Ribbons for specific feats per Pokémon. **How:** Attached to the Pokémon and displayed on summary. **Trigger:** Feats. **Feel:** Pride. **Deps:** achievements. **Rarity:** always on. **Cx:** M. **Balance:** cosmetic.

### F-COL-03 · Sticker Book
**What:** Stickers from events, placed in a book or Hub rooms. **How:** Each event can grant a unique sticker. **Trigger:** Events. **Feel:** Scrapbook joy. **Deps:** F-MENU-14. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-COL-04 · Type Trophy Cabinet
**What:** A trophy for every type mastered. **How:** Win n runs with a given type theme. **Trigger:** Mastery. **Feel:** Completion goal. **Deps:** mastery. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-COL-05 · Trainer Card Collection
**What:** Collect trading cards of trainers you beat. **How:** Card art from trainer sprites with rarity border. **Trigger:** Win. **Feel:** Gotta-collect-them-all feeling for people. **Deps:** trainer archive. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-COL-06 · Cry Collection
**What:** A library of Pokémon cries and rare sound variants. **How:** Plays when selected; rare variants via events. **Trigger:** Catch. **Feel:** Audio nostalgia. **Deps:** audio. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-COL-07 · Fossil Wing
**What:** Fossils discovered across runs displayed in Hub. **How:** Revive via Workshop into rare starter options. **Trigger:** Fossil finds. **Feel:** Museum feel. **Deps:** items, starter sets. **Rarity:** rare. **Cx:** M. **Balance:** revival once per profile milestone.

### F-COL-08 · Postcard Collection
**What:** Postcards from regions with variants from events. **How:** Each region has 10 postcards with illustrations. **Trigger:** Region events. **Feel:** Travel memories. **Deps:** regions. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-COL-09 · Move Tape Library
**What:** Collect "tapes" of animations for moves seen. **How:** Tape viewer replays move animations. **Trigger:** Seen in battle. **Feel:** Animation museum. **Deps:** animation registry. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-COL-10 · Item Catalogue Completion
**What:** Complete item catalogue with silhouette placeholders. **How:** Tracks every item ever held. **Trigger:** Item pick. **Feel:** Completionism. **Deps:** Item Museum. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-COL-11 · Souvenir Shelf
**What:** Souvenirs from unique events (a broken umbrella). **How:** Each has a flavour text and no mechanical effect. **Trigger:** Events. **Feel:** Story trinkets. **Deps:** events. **Rarity:** rare. **Cx:** S. **Balance:** none.

### F-COL-12 · Weather Jar
**What:** A jar collecting remembered weather. **How:** Each weather seen is bottled; set Hub ambience. **Trigger:** Weather. **Feel:** Cosy. **Deps:** weather, hub. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-COL-13 · Shiny Gallery with Stories
**What:** Showcase for shinies with a story blurb per catch. **How:** Auto text pulls from run context. **Trigger:** Shiny. **Feel:** Memorable. **Deps:** chronicle. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-COL-14 · Rival's Collection Peek
**What:** See what your rival collects and compete. **How:** Rival counters shown on a shared page. **Trigger:** Always. **Feel:** Friendly competition. **Deps:** living rival. **Rarity:** always on. **Cx:** M. **Balance:** none.

---

## H. New Game Modes (F-MODE)

### F-MODE-01 · Tag Team Mode
**What:** Two parties in one run alternating control. **How:** Each party has its own HP pool; swaps at checkpoints. **Trigger:** Mode select. **Feel:** Partner-style strategy. **Deps:** run state. **Rarity:** optional. **Cx:** XL. **Balance:** rewards scaled.

### F-MODE-02 · Lighthouse Keeper Mode
**What:** Defend a fixed location against waves. **How:** Between waves, spend resources to prep; waves are seeded foes. **Trigger:** Mode select. **Feel:** Tower-defence mood. **Deps:** battle, shops. **Rarity:** optional. **Cx:** XL. **Balance:** scaling curve.

### F-MODE-03 · One-Pokémon Journey
**What:** A run with a single Pokémon that grows by events. **How:** Events focus on that Pokémon with unique branches. **Trigger:** Mode select. **Feel:** Deep bond. **Deps:** events, memories. **Rarity:** optional. **Cx:** L. **Balance:** tuned for solo.

### F-MODE-04 · Reverse Run
**What:** Start at the final boss and walk backward through regions. **How:** Foes scale down as you proceed. **Trigger:** Unlock. **Feel:** Novelty. **Deps:** region data. **Rarity:** optional. **Cx:** L. **Balance:** reversed scaling.

### F-MODE-05 · Swap Meet Mode
**What:** Every battle you swap your team with the foe's afterward. **How:** Your Pokémon change hands. **Trigger:** Mode select. **Feel:** Chaos. **Deps:** trade system. **Rarity:** optional. **Cx:** L. **Balance:** unbalanced, flagged.

### F-MODE-06 · Cursed Calendar Mode
**What:** Each node has a daily curse that rotates. **How:** Modifiers selected by date seed per node. **Trigger:** Mode select. **Feel:** Variety. **Deps:** modifiers. **Rarity:** optional. **Cx:** M. **Balance:** curses are balanced pairs.

### F-MODE-07 · Cinematic Mode
**What:** A story-first mode with reduced difficulty. **How:** Scripted narrative beats added, battles are shorter. **Trigger:** Mode select. **Feel:** Narrative. **Deps:** story, difficulty. **Rarity:** optional. **Cx:** L. **Balance:** rewards low.

### F-MODE-08 · Time Attack
**What:** Race the clock across a seeded route. **How:** Pauses count; fast play earns bonus. **Trigger:** Mode select. **Feel:** Speedrun. **Deps:** timers. **Rarity:** optional. **Cx:** M. **Balance:** real-time pressure only on UI.

### F-MODE-09 · Mirror Match Mode
**What:** Fight your own previous team. **How:** Loads a saved Hall of Fame team as the final boss. **Trigger:** Win a run. **Feel:** Self-rivalry. **Deps:** legacy. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-MODE-10 · Pacifist Challenge
**What:** Win by capturing or befriending foes instead of KOs. **How:** Alternative battle objectives. **Trigger:** Mode select. **Feel:** Different play. **Deps:** capture, battle. **Rarity:** optional. **Cx:** XL. **Balance:** high.

### F-MODE-11 · Lottery Mode
**What:** Party randomizes after every battle. **How:** Reroll from a pool. **Trigger:** Mode select. **Feel:** Chaos. **Deps:** pool. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-MODE-12 · Archive Replay Mode
**What:** Replay past seeds with new rules. **How:** Choose a past seed and apply twists. **Trigger:** Profile. **Feel:** Fresh. **Deps:** seeds. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-MODE-13 · Co-Op Hotseat
**What:** Two players share a screen choosing alternately. **How:** Turn-based control. **Trigger:** Mode select. **Feel:** Social. **Deps:** input. **Rarity:** optional. **Cx:** L. **Balance:** none.

### F-MODE-14 · Story Seeds
**What:** Seeds with curated stories. **How:** Hand-authored seeds with notes. **Trigger:** Unlock. **Feel:** Guided. **Deps:** seeds. **Rarity:** optional. **Cx:** M. **Balance:** none.
