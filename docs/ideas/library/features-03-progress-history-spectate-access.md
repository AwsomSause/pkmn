# Feature Library, part 3: Progression, Statistics and History, Spectator and Replay, Accessibility (F-PRG, F-HIS, F-SPEC, F-ACC)

Design only; nothing approved or built. Field key and ID scheme: see `features-00-index-and-priorities.md`. Fields: What · How · Trigger · Feel · Deps · Rarity · Cx (S/M/L/XL) · Balance.

---

## I. Additional Progression Opportunities (F-PRG)

### F-PRG-01 · Apprenticeship Ladder
**What:** Take on an apprentice NPC across runs who grows with your teaching choices. **How:** At the end of each run, spend one lesson (a move, a tactic, a rule of thumb); the apprentice later shows up as an ally or rival who fights how you taught them. **Trigger:** Win a run with a bonded Pokémon. **Feel:** Legacy that talks back; seeing your own habits in someone else. **Deps:** Legacy, rival engine, trainer AI profiles. **Rarity:** one apprentice at a time. **Cx:** XL. **Balance:** apprentice assists are single-use; never required.

### F-PRG-02 · Regional Reputation Paths
**What:** Each region tracks a separate reputation (Locals, Rangers, Syndicate) that alters shops, events, and gym attitudes. **How:** Choices in events move three sliders; thresholds unlock stalls, hidden stops, and gym dialogue. **Trigger:** Any region visit. **Feel:** Being "known" differently in each place. **Deps:** Plaza, events, Regional Board. **Rarity:** always on. **Cx:** L. **Balance:** each path trades something (cheap shops vs safer events).

### F-PRG-03 · Skill Constellations
**What:** A trainer skill web where nodes are earned by playstyle, not points. **How:** Using Potions sparingly lights "Frugal", chain-KOs light "Sweeper"; nodes grant small passives for later runs. **Trigger:** Run end tally. **Feel:** The build you played becomes the build you have. **Deps:** playstyle titles, Research Tree. **Rarity:** always on. **Cx:** L. **Balance:** passives are sidegrades; cap equipped nodes at 3.

### F-PRG-04 · Hall of Fame Ascension
**What:** Winning the League repeatedly "ascends" a Hall of Fame Pokémon into a mythic form shown in the Hub. **How:** Enshrine up to six; each additional win upgrades the portrait and adds a dossier line; the top rank can be summoned as a once-per-run assist. **Trigger:** Win with the same Pokémon thrice. **Feel:** Heroes of your own legend. **Deps:** legacy runs, assists. **Rarity:** rare. **Cx:** L. **Balance:** assist is cosmetic-leaning and capped.

### F-PRG-05 · Scar and Glory Marks
**What:** Pokémon earn permanent marks from extreme experiences (survived at 1 HP, beat a Totem alone). **How:** Marks give a tiny lasting quirk and a unique summary line; some are negative ("Skittish after the flood"). **Trigger:** Specific battle events. **Feel:** Battle-tested individuals. **Deps:** memories, moment system. **Rarity:** uncommon. **Cx:** M. **Balance:** negative marks must be removable via story.

### F-PRG-06 · Expedition Licences
**What:** A tiered licence system gating hazardous routes. **How:** Bronze/Silver/Gold licences earned via objectives; higher tiers open harder stops with better loot. **Trigger:** Objective completion. **Feel:** Credentials that open doors. **Deps:** expeditions, map. **Rarity:** always on. **Cx:** M. **Balance:** higher tiers raise risk, not just rewards.

### F-PRG-07 · The Long Apprenticeship (Mastery Seasons)
**What:** Mastery works in seasons of ten runs with a theme and a reset of soft goals. **How:** Each season picks a theme (Fighting, Fog, Strategy); completing it grants a permanent cosmetic. **Trigger:** Seasonal tick by run count. **Feel:** Fresh goals without grinding. **Deps:** mastery. **Rarity:** always on. **Cx:** M. **Balance:** no loss on season end.

### F-PRG-08 · Rank-Up Exams
**What:** A set-piece exam when you hit a rank threshold. **How:** A themed mini-run (3 fights with fixed rules) must be passed to rank up. **Trigger:** Rank threshold. **Feel:** Real milestone moments. **Deps:** Prestige. **Rarity:** at thresholds. **Cx:** M. **Balance:** retry free.

### F-PRG-09 · Sponsored Careers
**What:** Pick a career path (Ranger, Breeder, Gambler, Scholar) shaping available perks. **How:** Each path has its own tiny tree, flavour events, and a capstone reward. **Trigger:** After 3 runs. **Feel:** Roleplay depth. **Deps:** trainer classes, events. **Rarity:** always on. **Cx:** L. **Balance:** careers equal in power.

### F-PRG-10 · Pokémon Seniority System
**What:** Veteran Pokémon (many runs) gain seniority giving mentorship bonuses to juniors. **How:** Seniority tracks runs together; a senior can pass a trick to a junior. **Trigger:** Run count. **Feel:** Generational teams. **Deps:** bonds, legacy. **Rarity:** always on. **Cx:** L. **Balance:** trick copies limited.

### F-PRG-11 · Unlock Roadmap with Forecast
**What:** A roadmap showing future unlocks as fogged silhouettes with hint text. **How:** Hints become clear as you approach. **Trigger:** Always. **Feel:** Goals visible. **Deps:** unlock system. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-PRG-12 · Catch-Up Windfalls
**What:** After a streak of losses, a gentle windfall appears. **How:** Hidden counter grants a one-time starter boost or extra hint. **Trigger:** 3 losses in a row. **Feel:** Kindness without handouts. **Deps:** run finalize. **Rarity:** conditional. **Cx:** S. **Balance:** rare and modest.

### F-PRG-13 · World Rank (Global Standing)
**What:** An offline "world ranking" computed against seeded NPC trainers. **How:** Your results move you in a leaderboard of fictional rivals. **Trigger:** Run end. **Feel:** Climb. **Deps:** rival simulation. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-PRG-14 · Progress Journals by Region
**What:** Region journals showing completion percentages and unfinished business. **How:** Pages list undiscovered stops, trainers, and secrets. **Trigger:** Always. **Feel:** Clear completion targets. **Deps:** Regional Board. **Rarity:** always on. **Cx:** M. **Balance:** none.

---

## J. Statistics and Player-History Features (F-HIS)

### F-HIS-01 · Season Recap ("Year in Pokémon")
**What:** A shareable recap of the last N runs. **How:** Highlights MVP, nemesis, biggest comeback, funniest moment. **Trigger:** Manual or on the date. **Feel:** Wrapped-style delight. **Deps:** chronicle, stats. **Rarity:** periodic. **Cx:** M. **Balance:** none.

### F-HIS-02 · MVP and Villain Awards
**What:** After each run, award MVP, Unsung Hero, and Villain (the foe that hurt most). **How:** Derived from damage, assists, and nemesis data. **Trigger:** Run end. **Feel:** Narrative closure. **Deps:** run stats. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-HIS-03 · Heat Map of Mistakes
**What:** A post-run heat map showing where HP was lost. **How:** Timeline with spikes and tags (status, crit, hazard). **Trigger:** Run end. **Feel:** Learning tool. **Deps:** battle log. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-HIS-04 · Matchup Ledger
**What:** A ledger of species vs species outcomes. **How:** Track KO ratios per matchup. **Trigger:** Battles. **Feel:** Data nerd pleasure. **Deps:** battle log. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-HIS-05 · Decision Replay Points
**What:** Mark pivotal decisions and show "what if" summaries. **How:** Uses deterministic replay to compute alternative outcome only for the first branch. **Trigger:** Run end. **Feel:** Reflection. **Deps:** replay. **Rarity:** always on. **Cx:** XL. **Balance:** no changes to saves.

### F-HIS-06 · Luck Report
**What:** Show how lucky you were (crits, catches, drops) vs expectation. **How:** Compares to expected distribution. **Trigger:** Run end. **Feel:** Fair narrative of luck. **Deps:** RNG logs. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-HIS-07 · Personal Records Wall
**What:** Records for fastest win, longest streak, biggest hit. **How:** Hub wall with plaques. **Trigger:** Always. **Feel:** Pride. **Deps:** stats. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-HIS-08 · Pokémon Career Pages
**What:** Lifetime stats per Pokémon species. **How:** Tracks wins, KOs, favourite partners. **Trigger:** Always. **Feel:** Fandom. **Deps:** stats. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-HIS-09 · Timeline of Your Career
**What:** A zoomable timeline of all runs. **How:** Milestones plotted with icons. **Trigger:** Always. **Feel:** Long view. **Deps:** chronicle. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-HIS-10 · Rival Head-to-Head Ledger
**What:** Detailed history with rival(s). **How:** Win/loss, memorable lines. **Trigger:** Always. **Feel:** Rivalry history. **Deps:** rival. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-HIS-11 · Comparison with Past Self
**What:** Compare this run to your average. **How:** Overlay charts. **Trigger:** Run end. **Feel:** Growth. **Deps:** stats. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-HIS-12 · Lifetime Odometer
**What:** Totals (steps, battles, catches) with quirky equivalents. **How:** "You walked the length of Kanto". **Trigger:** Always. **Feel:** Charm. **Deps:** stats. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-HIS-13 · Streak Calendar
**What:** Calendar of play days. **How:** Colored days, gentle notes. **Trigger:** Always. **Feel:** Habit tracking without guilt. **Deps:** profile. **Rarity:** always on. **Cx:** S. **Balance:** no penalties.

### F-HIS-14 · Export Stats
**What:** Export history as JSON/CSV. **How:** Save file. **Trigger:** Settings. **Feel:** Control. **Deps:** files.ts. **Rarity:** always on. **Cx:** S. **Balance:** none.

---

## K. Spectator and Replay Features (F-SPEC)

### F-SPEC-01 · Instant Replay Booth
**What:** Rewatch any battle from a log. **How:** Deterministic replay of actions with camera controls. **Trigger:** Post-battle. **Feel:** Sports replay. **Deps:** deterministic engine. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-SPEC-02 · Commentator Track
**What:** Optional announcer lines during replays. **How:** Template-driven commentary using memories and rivalry. **Trigger:** Replay. **Feel:** Esports. **Deps:** dialogue. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-SPEC-03 · Replay Export (GIF/Clip)
**What:** Export a replay moment. **How:** Canvas capture of a time range. **Trigger:** Replay. **Feel:** Sharing. **Deps:** capture. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-SPEC-04 · Spectator Seeds
**What:** Watch an AI play a seed. **How:** Auto-pilot runs with explanations. **Trigger:** Mode. **Feel:** Learning. **Deps:** AI. **Rarity:** optional. **Cx:** L. **Balance:** none.

### F-SPEC-05 · Ghost Overlay
**What:** Overlay a friend's/previous run on the map. **How:** Show ghost path. **Trigger:** Seed share. **Feel:** Race. **Deps:** seeds. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-SPEC-06 · Director's Cut Camera
**What:** Cinematic camera for replays. **How:** Preset camera moves. **Trigger:** Replay. **Feel:** Spectacle. **Deps:** presentation cues. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-SPEC-07 · Highlight Reel
**What:** Auto-built reel of biggest moments. **How:** Scores moments by drama. **Trigger:** Run end. **Feel:** Memories. **Deps:** moments. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-SPEC-08 · Replay Annotations
**What:** Add notes to a replay timeline. **How:** Time-stamped notes. **Trigger:** Replay. **Feel:** Analysis. **Deps:** replay. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-SPEC-09 · Slow-Mo Critical Moments
**What:** Auto slow-mo on crits and clutch KOs. **How:** Presentation cue. **Trigger:** Event. **Feel:** Cinematic. **Deps:** presentation. **Rarity:** always on. **Cx:** S. **Balance:** none, respects settings.

### F-SPEC-10 · Tournament Broadcast View
**What:** Spectator mode UI for Tournament Hall. **How:** Bracket, stats, commentary. **Trigger:** Tournament. **Feel:** Event. **Deps:** F-HUB-05. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-SPEC-11 · Replay Share Codes
**What:** Short code that recreates a replay. **How:** Seed + action log compressed. **Trigger:** Replay. **Feel:** Social. **Deps:** save format. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-SPEC-12 · Stat Overlay for Spectators
**What:** Toggle overlays of damage numbers and probabilities. **How:** Live numbers. **Trigger:** Replay. **Feel:** Nerd. **Deps:** engine. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-SPEC-13 · Photo Finish Mode
**What:** Freeze-frame on final KO. **How:** Pause plus caption. **Trigger:** Win. **Feel:** Dramatic. **Deps:** presentation. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-SPEC-14 · Storybook Replay
**What:** Run replay as illustrated storybook pages. **How:** Pages from chronicle with screenshots. **Trigger:** Run end. **Feel:** Cosy. **Deps:** chronicle. **Rarity:** always on. **Cx:** L. **Balance:** none.

---

## L. Accessibility Improvements (F-ACC)

### F-ACC-01 · Cognitive Load Mode
**What:** A mode that simplifies screens and shows one decision at a time. **How:** Hides secondary panels; step-by-step wizards. **Trigger:** Settings. **Feel:** Calm. **Deps:** UI layers. **Rarity:** optional. **Cx:** L. **Balance:** none.

### F-ACC-02 · One-Handed Control Scheme
**What:** Full play with one hand. **How:** Remapped inputs, sticky selections. **Trigger:** Settings. **Feel:** Inclusive. **Deps:** input. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-ACC-03 · Text-to-Speech Narration
**What:** Read dialogue and menu items aloud. **How:** Web Speech API, voice choice. **Trigger:** Settings. **Feel:** Accessible. **Deps:** text system. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-ACC-04 · Audio Cues for Battle State
**What:** Sound cues for HP, status, super-effective. **How:** Distinct tones. **Trigger:** Settings. **Feel:** Blind-friendly. **Deps:** audio. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-ACC-05 · Pause-Anywhere with Timers Off
**What:** Remove all real-time pressure. **How:** Global setting. **Trigger:** Settings. **Feel:** Safe. **Deps:** minigames. **Rarity:** optional. **Cx:** S. **Balance:** none.

### F-ACC-06 · High-Contrast and Outline Pack
**What:** High-contrast themes with outlines. **How:** Theme tokens. **Trigger:** Settings. **Feel:** Clear. **Deps:** theme. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-ACC-07 · Type Icon Shapes
**What:** Types distinguished by shape and pattern, not only color. **How:** Icon variants. **Trigger:** Settings. **Feel:** Colourblind friendly. **Deps:** icons. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-ACC-08 · Dwell-Click and Switch Support
**What:** Support for assistive switch devices. **How:** Dwell timers. **Trigger:** Settings. **Feel:** Inclusive. **Deps:** input. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-ACC-09 · Plain Language Mode
**What:** Rewrite jargon into simple text. **How:** Alternate text strings. **Trigger:** Settings. **Feel:** Clear. **Deps:** text data. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-ACC-10 · Rebindable Everything with Profiles
**What:** Full rebind with saved profiles. **How:** Binding UI. **Trigger:** Settings. **Feel:** Control. **Deps:** input. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-ACC-11 · Motion Sickness Guard
**What:** Disable camera shakes, parallax, zooms with one toggle. **How:** Presentation cue switch. **Trigger:** Settings. **Feel:** Comfortable. **Deps:** presentation. **Rarity:** optional. **Cx:** S. **Balance:** none.

### F-ACC-12 · Captions for Sounds
**What:** Text captions for sound effects. **How:** Caption layer. **Trigger:** Settings. **Feel:** Deaf-friendly. **Deps:** audio. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-ACC-13 · Adjustable Hit Targets and Spacing
**What:** Bigger buttons with spacing control. **How:** Layout scale. **Trigger:** Settings. **Feel:** Easier. **Deps:** UI. **Rarity:** optional. **Cx:** M. **Balance:** none.

### F-ACC-14 · Guided Tutorial Companion
**What:** An optional helper that explains each new screen once. **How:** Contextual first-time overlays. **Trigger:** Settings. **Feel:** Gentle. **Deps:** tutorial. **Rarity:** optional. **Cx:** M. **Balance:** none.
