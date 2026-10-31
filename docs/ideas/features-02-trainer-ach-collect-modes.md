# Feature Library, part 2: Trainer Customization, Achievements, Collections, Game Modes (F-TRN, F-ACH, F-COL, F-MODE)

Design only; nothing approved or built. Field key and ID scheme: see `features-00-index-and-priorities.md`. Fields: What · How · Trigger · Feel · Deps · Rarity · Cx (S/M/L/XL) · Balance. Depth pass applied: every entry has concrete rules and a specific balance or risk note.

---

## E. Trainer Customization (F-TRN)

### F-TRN-01 · Catchphrase Forge
**What:** Compose your trainer's signature send-out shout. **How:** Word-bank slots (verb + noun + flourish, 40 words each, unlocked by titles) or filtered free text up to 28 characters. The line shows at the first send-out of each battle and is stored in the run record, so your rival can mock or quote it ("Time to *burn bright*, huh?") and a Legacy replay uses it. **Trigger:** Trainer Card, any time. **Feel:** A line other characters throw back at you. **Deps:** trainer card, dialogue tokens, rival memory, profanity filter. **Rarity:** always on. **Cx:** M. **Balance:** cosmetic only; free text must be length-capped and filtered, and must be escaped everywhere it is printed (replays, share codes).

### F-TRN-02 · Signature Pose Library
**What:** Unlockable send-out and victory poses. **How:** Each pose is a 0.6 to 1.2 s sprite cue registered in the animation registry; 20 poses, each tied to a title or mastery goal (e.g. "Wanderer" gives the shielded-eyes look). One send-out pose and one victory pose equipped. **Trigger:** Wardrobe. **Feel:** Style as a trophy. **Deps:** wardrobe, presentation cues, settings (Reduced/Off). **Rarity:** always on. **Cx:** M. **Balance:** must be skippable and never delay battle input; Reduced mode swaps to a static frame so slow poses cannot tax repeat players.

### F-TRN-03 · Trainer Backstory Picker
**What:** A short backstory that tints the run. **How:** 12 backstories (Ex-Ranger, Disgraced Prodigy, Lighthouse Orphan...). Each changes three NPC greeting lines, flags two events with an extra option, and sets one tiny start quirk (e.g. Ex-Ranger sees one extra map hint). **Trigger:** Run Prep. **Feel:** Roleplay hook; replays feel like a different character. **Deps:** trainer classes, events, dialogue conditions. **Rarity:** always on. **Cx:** L. **Balance:** quirks must be sidegrades at equal value; track win rate per backstory in the sim report and trim outliers above +3 points.

### F-TRN-04 · Aging Trainer Portrait
**What:** The portrait quietly shows your career. **How:** At Prestige ranks and run milestones (50, 100, 250 runs) overlay layers: a scar after a nemesis loss, a medal after a title, grey at the temples at 100 runs. Pure overlays on the existing portrait with an Off toggle. **Trigger:** Profile milestones. **Feel:** A face with history, noticed by NPCs in one line. **Deps:** portraits, prestige, profile stats. **Rarity:** always on. **Cx:** M. **Balance:** none mechanical; offer "Keep me young" so no one feels aged against their will.

### F-TRN-05 · Team Uniform Designer
**What:** One shared "team look" for the whole party. **How:** Pick a bandana colour, emblem, and scarf pattern from unlocked options; applied as small overlays on party menu sprites and the send-out flash. Saved per loadout. **Trigger:** Wardrobe. **Feel:** Cohesive squad identity, like gym-team gear. **Deps:** sprite overlay layer, wardrobe, loadout snapshots (F-PREP-07). **Rarity:** always on. **Cx:** M. **Balance:** overlays must not hide status icons or shiny sparkle; test on all sprite sizes.

### F-TRN-06 · Specialist Banner Rooms
**What:** Declare a specialty type and earn a Hub banner for it. **How:** Win N runs where ≥4 team members share that type (N = 1/3/10 for three banner tiers). Tier 3 unlocks a themed Hub corner (props, music loop). **Trigger:** Run end check. **Feel:** Identity through play; bragging space. **Deps:** playstyle titles, Hub props, mastery. **Rarity:** always on. **Cx:** S. **Balance:** purely cosmetic; check it does not push players into mono-type to farm banners at the cost of fun, so one dual-type team also counts at tier 1.

### F-TRN-07 · Voice Pack (Text Blips)
**What:** Pick the sound your trainer's dialogue makes. **How:** Procedural blip (pitch, wave, rhythm) synthesized by `procAudio`; 8 packs from unlocks, plus a pitch slider. **Trigger:** Settings. **Feel:** Tiny audio personality, like Undertale blips. **Deps:** procAudio, settings audio mixer. **Rarity:** always on. **Cx:** S. **Balance:** blips obey the dialogue-sound slider and a mute option; avoid frequencies that fatigue at long text.

### F-TRN-08 · Trainer Rank Plate
**What:** A reusable rank plate shown in loading screens, rival dossiers, and share codes. **How:** Combines rank, equipped title, region progress ring, and last result. **Trigger:** Always. **Feel:** A tidy, shareable status summary. **Deps:** prestige, titles, Regional Board. **Rarity:** always on. **Cx:** S. **Balance:** none; ensure share-code plates cannot be forged to display a rank you have not earned (derive from signed run summary or label as unverified).

### F-TRN-09 · Rival Rename and Persona Pick
**What:** Name your rival and pick a temperament. **How:** Persona (Friendly Needler, Anxious Overachiever, Cold Perfectionist, Chaos Gremlin) selects dialogue banks and one running gag; the relationship engine stays the same. Name tokens flow through all rival events and letters. **Trigger:** New profile; changeable between runs (history kept). **Feel:** Ownership of the one character that follows you everywhere. **Deps:** living rival, dialogue tokens. **Rarity:** always on. **Cx:** M. **Balance:** persona must not change stats or rival strength; sim report should show identical win rates across personas.

### F-TRN-10 · Hub Mascot Companion
**What:** A retired Pokémon roams the Hub as your mascot. **How:** Pick one from the pasture; it wanders between props, naps on the sofa, reacts to claim events, and gives one hint per day ("Rival's letter arrived"). Personality picks its idle animations. **Trigger:** After first retirement (F-MON-11). **Feel:** A pet that proves your runs mattered. **Deps:** pasture, Hub props, animation registry. **Rarity:** always on. **Cx:** M. **Balance:** hints are information already shown elsewhere; pathing must be cheap (few waypoints) and pause when menus open.

### F-TRN-11 · Signature Technique Flavours
**What:** A cosmetic variant of your once-per-battle trainer technique. **How:** The existing trainer ability stays identical; you choose how it looks and sounds (whistle, snap, raised fist, thrown cap), each with a unique 1-line shout. **Trigger:** Mastery thresholds. **Feel:** Your command feels like yours. **Deps:** trainer abilities, battle UI, animation registry. **Rarity:** always on. **Cx:** M. **Balance:** identical numbers across flavours is a hard rule (unit test asserts it); timing must not exceed the base animation length.

### F-TRN-12 · Custom Title Composer
**What:** Assemble your own title from earned fragments. **How:** Fragments come in three slots (Epithet, Noun, Place) earned from titles, achievements, regions. Compose "Storm-Bound Wanderer of Hoenn"; shown on card, plate, replay intro. **Trigger:** Titles unlocked. **Feel:** Self-authored legend. **Deps:** playstyle titles, achievements. **Rarity:** always on. **Cx:** S. **Balance:** a title is only valid if you own every fragment; recheck on load so a deleted unlock cannot leave an invalid title.

### F-TRN-13 · Walk Animation Chooser
**What:** Choose how your trainer walks on the map. **How:** Stroll, strut, tired shuffle, skip, sneak; speed identical. Tired shuffle auto-triggers as a flourish when the party is hurt (optional). **Trigger:** Wardrobe. **Feel:** Charm and readable mood. **Deps:** map sprites. **Rarity:** always on. **Cx:** S. **Balance:** animation length must not alter map input timing or gameplay speed.

### F-TRN-14 · Signature Item Charm
**What:** A cosmetic keepsake NPCs notice. **How:** Pick one (scarf, compass, cracked goggles); 60 NPC classes get a unique remark, 5 rare NPCs have chains of lines ("Where did you get that compass?" → a mini-story). **Trigger:** Wardrobe. **Feel:** Being noticed; small narrative payoffs. **Deps:** dialogue conditions, wardrobe. **Rarity:** always on (rare NPC chains rare). **Cx:** M. **Balance:** rare chains grant story or cosmetics only; writing cost scales with item count, so ship 6 charms.

---

## F. Achievement Expansions (F-ACH)

### F-ACH-01 · Achievement Chains with Story
**What:** Achievement chains that unlock authored vignettes. **How:** 12 chains of 4 to 6 steps (e.g. "The Long Road": win with 1/3/10 starters, finish a region barefoot-style no-heal). Each step unlocks a short Hub scene with art and dialogue; the final step grants a keepsake. **Trigger:** Chain steps. **Feel:** Achievements lead somewhere and tell a tale. **Deps:** achievements, cutscene player, Hub scenes. **Rarity:** always on. **Cx:** M. **Balance:** steps must be achievable by normal play in 20 to 60 runs; avoid chains that force a gimmick run.

### F-ACH-02 · Secret Achievements with Riddle Hints
**What:** Hidden achievements shown as riddles. **How:** A riddle ("Three crowns, one pocket") shows at start; each partial progress reveals one word; solved text becomes the real name. **Trigger:** Hidden counters. **Feel:** Puzzle solving across weeks. **Deps:** achievements, counters. **Rarity:** rare. **Cx:** M. **Balance:** never gate meaningful rewards behind obscure riddles; reward is a cosmetic or lore page, and an in-game hint token reveals it after 20 runs of stalling.

### F-ACH-03 · Achievement Gold Variants
**What:** Gold versions with stricter conditions. **How:** Each of 40 achievements gets an optional Gold rule ("...without using a Revive", "...with a Magikarp on the team"). Gold shows as a glow on the medal. **Trigger:** Normal tier unlocked. **Feel:** Mastery depth for the experts. **Deps:** achievements, run counters. **Rarity:** always on. **Cx:** M. **Balance:** Gold rules must be checkable with existing counters; avoid contradictory rules in the same run.

### F-ACH-04 · Dubious Honours
**What:** Funny anti-achievements. **How:** 25 light-hearted entries ("Beaten by a Caterpie", "Sold the Master Ball for 12 coins") with unique snarky flavor and no negative effect. **Trigger:** Specific unlucky or silly events. **Feel:** Failure becomes a story. **Deps:** achievements, moment system. **Rarity:** uncommon. **Cx:** S. **Balance:** avoid shaming real mistakes; no rewards that incentivize throwing runs, so rewards are stickers only.

### F-ACH-05 · Species Achievement Sets
**What:** Quirky goals per species family. **How:** 3 goals each for ~50 iconic species ("Win with a Slowpoke that never moved first", "Evolve Eevee into all forms across runs"). **Trigger:** Species used. **Feel:** Fan service and discovery. **Deps:** achievements, mastery. **Rarity:** always on. **Cx:** M. **Balance:** keep species goals mutually non-contradictory and do not require rare spawns beyond a fair sample.

### F-ACH-06 · Rival-Linked Achievements
**What:** Credit for your shared story. **How:** 15 achievements from rival data ("Be rescued 3 times", "Lose to the same rival Pokémon twice and win the third"). **Trigger:** Rival events. **Feel:** Shared history acknowledged. **Deps:** living rival counters. **Rarity:** always on. **Cx:** S. **Balance:** do not encourage deliberately losing; no stat rewards.

### F-ACH-07 · Time-of-Day Achievements
**What:** Rituals tied to the clock. **How:** Local clock checks (win a boss between 00:00 and 04:00, start a run at dawn). **Trigger:** Local time. **Feel:** Small rituals. **Deps:** achievements. **Rarity:** rare. **Cx:** S. **Balance:** never required for any chain; respect timezone changes and do not reward clock manipulation (rewards cosmetic).

### F-ACH-08 · Cooperative Pair Achievements
**What:** Achievements for bonded duos. **How:** Pair counters (two Pokémon share 3 victory memories, KO in the same turn 10 times). Pair achievements reward a pair-specific duo emblem shown on the party screen. **Trigger:** Pair tracking. **Feel:** Chemistry honoured. **Deps:** chemistry, memories. **Rarity:** always on. **Cx:** M. **Balance:** pairs tracked per run to avoid combinatorial save growth; cap stored pairs.

### F-ACH-09 · Achievement Medals Wall
**What:** A wall in the Hub for your favourite medals. **How:** Pin 12; rarer ones glow; clicking a medal replays its unlock moment. **Trigger:** Always. **Feel:** Trophy pride. **Deps:** Hub props. **Rarity:** always on. **Cx:** M. **Balance:** none; mobile layout must stay legible.

### F-ACH-10 · Achievement Reward Choice
**What:** Pick your cosmetic reward. **How:** Each tier offers three cosmetics; choose one, others stay claimable by later tiers. **Trigger:** Claim. **Feel:** Agency. **Deps:** collection, claim ledger. **Rarity:** always on. **Cx:** S. **Balance:** claims keyed so a reward never applies twice.

### F-ACH-11 · Seasonal Achievement Tracks
**What:** Time-limited tracks that recur yearly. **How:** Local date selects the track; progress persists; missed tracks reappear in the Event Archive at 50% speed. **Trigger:** Date. **Feel:** Rhythm without FOMO. **Deps:** seasonal events, archive. **Rarity:** seasonal. **Cx:** M. **Balance:** no power rewards; no daily-streak pressure.

### F-ACH-12 · Firsts Ledger
**What:** A ledger of your firsts. **How:** Timestamped lines with a deterministic quip ("First shiny: a Zubat. Feel the shame."). **Trigger:** First occurrences. **Feel:** Personal history. **Deps:** chronicle. **Rarity:** always on. **Cx:** S. **Balance:** none; quips must be seeded text, not live RNG.

### F-ACH-13 · Rarity Percent Badges
**What:** Show how rare each achievement is. **How:** Shipped static table from sim data and playtests; labels such as Common, Uncommon, Rare, Legendary. **Trigger:** Always. **Feel:** Bragging rights. **Deps:** achievements, sim reports. **Rarity:** always on. **Cx:** S. **Balance:** must be labelled "estimated" and refreshed per release to avoid fiction.

### F-ACH-14 · Achievement Score Tiers
**What:** A single score unlocking Hub rooms. **How:** Weighted points; tiers at 100/500/1500/4000 unlock a room or lore set. **Trigger:** Always. **Feel:** Long-term horizon. **Deps:** Hub, achievements. **Rarity:** always on. **Cx:** S. **Balance:** weights should not favour grindy repeatable achievements; cap contribution per category.

---

## G. Collection Systems (F-COL)

### F-COL-01 · Pokémon Photo Album
**What:** Auto-captured stills per species. **How:** Capture a small crop at first catch, first shiny, evolution, and a clutch KO; store as compressed indexed-PNG strips (≤8 KB each) in a separate store with a size budget of 4 MB and an LRU purge. **Trigger:** Events. **Feel:** A real album you fill by playing. **Deps:** snapshot capture, storage budget, Dex. **Rarity:** always on. **Cx:** L. **Balance:** none; storage must not break save load, so the album lives outside the save blob and failure is silent.

### F-COL-02 · Ribbon Shelf
**What:** Ribbons for per-Pokémon feats. **How:** 30 ribbons (Clutch, Steadfast, Globetrotter...) attached to the Pokémon, displayed on the summary and in the Bank. **Trigger:** Feats at run end. **Feel:** Pride in specific monsters. **Deps:** achievements, Bank. **Rarity:** always on. **Cx:** M. **Balance:** cosmetic; ribbons persist only if the Pokémon persists (Bank/Legacy), otherwise archived in the Chronicle.

### F-COL-03 · Sticker Book
**What:** Stickers from events, collected and placed. **How:** Every run event can drop a unique sticker (≈150 total); place them in a book or onto Hub rooms via F-MENU-14. **Trigger:** Events. **Feel:** Scrapbook joy. **Deps:** F-MENU-14, events. **Rarity:** always on. **Cx:** M. **Balance:** duplicates convert to a tiny ink currency to avoid dead drops.

### F-COL-04 · Type Trophy Cabinet
**What:** A trophy per type mastered. **How:** 18 trophies, three tiers each (win with 4+ members, win a boss using only that type, win no-heal). **Trigger:** Run end. **Feel:** Completion target. **Deps:** mastery. **Rarity:** always on. **Cx:** S. **Balance:** tiers must be reachable for hard types like Normal and Ice; Bug and Flying need extra fairness checks.

### F-COL-05 · Trainer Card Trading Cards
**What:** Trading cards of every trainer you beat. **How:** Card art from trainer sprite with a rarity border by encounter rarity; back shows their team and a quip. **Trigger:** Win. **Feel:** Gotta-collect-them-all for people. **Deps:** trainer archive. **Rarity:** always on. **Cx:** M. **Balance:** cosmetic; the generator must be deterministic so shared cards match.

### F-COL-06 · Cry Collection
**What:** A library of every cry heard. **How:** Plays on select; rare variants (pitched, echoed) from events. **Trigger:** Catch. **Feel:** Audio nostalgia. **Deps:** audio. **Rarity:** always on. **Cx:** S. **Balance:** lazy-load audio so load times do not grow.

### F-COL-07 · Fossil Wing
**What:** Fossils displayed and revived. **How:** Fossil items drop in dig events; display in Hub; Workshop revival gives a one-time starter option for that fossil species. **Trigger:** Fossil finds. **Feel:** Museum feel. **Deps:** items, starter sets, Workshop. **Rarity:** rare. **Cx:** M. **Balance:** revival token per unlock milestone; fossil starters must sit at equal power to standard starters.

### F-COL-08 · Postcard Collection
**What:** Postcards per region. **How:** 10 per region, illustrated, unlocked by events and rest-stop writing; reading shows a short note from an NPC. **Trigger:** Region events. **Feel:** Travel memories. **Deps:** regions. **Rarity:** always on. **Cx:** M. **Balance:** none; art budget is the limit, so reuse backgrounds.

### F-COL-09 · Move Tape Library
**What:** A viewer of animations you have seen. **How:** Tape viewer replays each seen move animation on dummy sprites; type filters. **Trigger:** Seen in battle. **Feel:** Animation museum. **Deps:** animation registry. **Rarity:** always on. **Cx:** M. **Balance:** viewer must honour Reduced/Off settings.

### F-COL-10 · Item Catalogue Completion
**What:** A catalogue of every item ever held. **How:** Silhouettes for unknowns; item page shows first found, times used. **Trigger:** Item pick. **Feel:** Completionism. **Deps:** Item Museum. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-COL-11 · Souvenir Shelf
**What:** Souvenirs from odd events. **How:** ~60 non-mechanical trinkets with a one-line story ("A broken umbrella from the Rainy Stop"). **Trigger:** Events. **Feel:** Story trinkets. **Deps:** events. **Rarity:** rare. **Cx:** S. **Balance:** none; avoid implying mechanical use.

### F-COL-12 · Weather Jar
**What:** A jar collecting weather. **How:** Each weather type seen is bottled; selecting one sets the Hub ambience (rain on windows, snow). **Trigger:** Weather. **Feel:** Cosy. **Deps:** weather, Hub. **Rarity:** always on. **Cx:** S. **Balance:** ambience must be quiet and loop-friendly.

### F-COL-13 · Shiny Gallery with Stories
**What:** A gallery with a story per shiny. **How:** Auto text from run context: "A Zubat that followed you through the Mine." Stored once. **Trigger:** Shiny. **Feel:** Memorable. **Deps:** chronicle. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-COL-14 · Rival's Collection Peek
**What:** See what your rival collects. **How:** Rival keeps simple counters (species caught per type) advancing each run; a page compares yours. **Trigger:** Always. **Feel:** Friendly competition. **Deps:** living rival. **Rarity:** always on. **Cx:** M. **Balance:** rival counters follow a seeded curve so they cannot be farmed or stalled.

---

## H. New Game Modes (F-MODE)

### F-MODE-01 · Tag Team Mode
**What:** Two parties alternate through one run. **How:** Each party has its own HP pool and bag; at each map stop control passes; boss fights call both parties for a double fight. **Trigger:** Mode select. **Feel:** Co-op strategy for one person. **Deps:** run state, doubles, map. **Rarity:** optional. **Cx:** XL. **Balance:** shared money to avoid hoarding; tune rewards to 90% so the doubled roster is not a free lunch.

### F-MODE-02 · Lighthouse Keeper Mode
**What:** Defend one location across waves. **How:** Each night a seeded wave attacks; days let you scout, trade, and set traps; the lighthouse has a durability meter. **Trigger:** Mode select. **Feel:** Tower-defence flavour. **Deps:** battle, shops, raids. **Rarity:** optional. **Cx:** XL. **Balance:** enemy scaling must have a visible curve and a soft cap at wave 30.

### F-MODE-03 · One-Pokémon Journey
**What:** A run with only one Pokémon. **How:** It earns special slots (extra held item, extra move) each region; events are rewritten for solo play; fainting ends the run. **Trigger:** Mode select. **Feel:** A deep bond. **Deps:** events, memories. **Rarity:** optional. **Cx:** L. **Balance:** foe levels and trainer counts drop; one-Pokémon rewards are cosmetic plus a species mastery star.

### F-MODE-04 · Reverse Run
**What:** Start at the League and walk backward. **How:** Region order reversed; foes scale down; you begin with a legendary-grade team and lose a member per region. **Trigger:** Unlock after a win. **Feel:** Novelty; a farewell tour. **Deps:** region data, scaling. **Rarity:** optional. **Cx:** L. **Balance:** curve reversal can feel like a pity run, so shifts must still threaten.

### F-MODE-05 · Swap Meet Mode
**What:** After each battle, trade a Pokémon with the foe. **How:** You pick one of yours to hand over and receive a foe's Pokémon of similar level. **Trigger:** Mode select. **Feel:** Chaos and attachment crises. **Deps:** trade system. **Rarity:** optional. **Cx:** L. **Balance:** flagged as an unbalanced fun mode; leaderboards separate.

### F-MODE-06 · Cursed Calendar Mode
**What:** A daily curse per node. **How:** Each node's curse chosen by date+node seed (e.g. "all moves lose 1 PP"). Curses are published in advance on the map. **Trigger:** Mode select. **Feel:** Variety and planning. **Deps:** modifiers. **Rarity:** optional. **Cx:** M. **Balance:** curse pool is mildly harsh; avoid curses that invalidate whole teams.

### F-MODE-07 · Cinematic Mode
**What:** Story-first, reduced difficulty. **How:** Scripted narrative beats are added at each region; battles shortened with auto-win thresholds on trivial fights. **Trigger:** Mode select. **Feel:** An interactive storybook. **Deps:** story, difficulty. **Rarity:** optional. **Cx:** L. **Balance:** rewards 50%; no leaderboard.

### F-MODE-08 · Time Attack
**What:** Race the clock. **How:** Timer excludes menus, counts only battle and map moves; fast clears earn bonus time; ghost splits display. **Trigger:** Mode select. **Feel:** Speedrun. **Deps:** timers. **Rarity:** optional. **Cx:** M. **Balance:** must not reward skipping dialogue pacing for accessibility users; separate board.

### F-MODE-09 · Mirror Match Mode
**What:** Fight your own previous team. **How:** Loads a Hall of Fame team as the final boss with its remembered tactics. **Trigger:** After a win. **Feel:** Self-rivalry. **Deps:** legacy. **Rarity:** optional. **Cx:** M. **Balance:** level-normalise to prevent overpowered old teams.

### F-MODE-10 · Pacifist Challenge
**What:** Win by capture and befriending. **How:** Battles have alternate objectives (calm a foe via moves, hold a ball chance meter); KOs lose points. **Trigger:** Mode select. **Feel:** A different game. **Deps:** capture, battle. **Rarity:** optional. **Cx:** XL. **Balance:** very high effort; ensure bosses have fair non-lethal routes.

### F-MODE-11 · Lottery Mode
**What:** Randomised party every battle. **How:** After each fight, redraw from a pool of caught Pokémon with equalised levels. **Trigger:** Mode select. **Feel:** Chaos. **Deps:** pool. **Rarity:** optional. **Cx:** M. **Balance:** seeded for fairness; no persistent progress.

### F-MODE-12 · Archive Replay Mode
**What:** Replay a past seed with twists. **How:** Pick a past seed and add a twist (reverse items, rival swap). **Trigger:** Profile. **Feel:** Fresh view on familiar. **Deps:** seeds. **Rarity:** optional. **Cx:** M. **Balance:** twists must be deterministic and labelled.

### F-MODE-13 · Co-Op Hotseat
**What:** Two players share a screen. **How:** Turn choices alternate by phase (one picks routes, one battles). **Trigger:** Mode select. **Feel:** Social. **Deps:** input. **Rarity:** optional. **Cx:** L. **Balance:** no profile progression conflicts, so rewards go to the shared profile.

### F-MODE-14 · Story Seeds
**What:** Hand-authored curated seeds. **How:** Each seed ships with a premise, notes, and a surprise; a shelf of 12 at launch. **Trigger:** Unlock. **Feel:** A guided adventure. **Deps:** seeds. **Rarity:** optional. **Cx:** M. **Balance:** must be tested via the sim for winnability; label difficulty.
