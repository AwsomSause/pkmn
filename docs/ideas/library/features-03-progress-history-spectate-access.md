# Feature Library, part 3: Progression, Statistics and History, Spectator and Replay, Accessibility (F-PRG, F-HIS, F-SPEC, F-ACC)

Design only; nothing approved or built. Field key and ID scheme: see `features-00-index-and-priorities.md`. Fields: What · How · Trigger · Feel · Deps · Rarity · Cx (S/M/L/XL) · Balance. Depth pass applied: every entry has concrete rules and a specific balance or risk note.

---

## I. Additional Progression Opportunities (F-PRG)

### F-PRG-01 · Apprenticeship Ladder
**What:** Teach an apprentice across runs who grows by your choices. **How:** At run end, spend one lesson (a move style, a tactic tag, a rule of thumb); the apprentice (seeded name and look) later shows as an ally or rival fighting with the habits you taught, up to 3 lessons stored. **Trigger:** Win with a bonded Pokémon. **Feel:** Legacy that talks back; you see your habits in someone else. **Deps:** Legacy, rival engine, trainer AI profiles. **Rarity:** one apprentice at a time. **Cx:** XL. **Balance:** apprentice assist is single-use; apprentice-as-rival uses normal rival strength curves so teaching cannot create an unbeatable foe.

### F-PRG-02 · Regional Reputation Paths
**What:** Per-region standing with three factions. **How:** Event choices move Locals/Rangers/Syndicate sliders (0 to 100). 30 unlocks per region: cheaper shop, hidden stops, gym leader greetings; opposing factions lock each other's top tier. **Trigger:** Region visits. **Feel:** Being "known" differently everywhere. **Deps:** Plaza, events, Regional Board. **Rarity:** always on. **Cx:** L. **Balance:** each faction trades something (Syndicate cheap but risky); sim must show no faction wins by more than 4 points.

### F-PRG-03 · Skill Constellations
**What:** A web of trainer skills earned by how you play. **How:** Run counters light nodes ("Frugal" for ≤2 healing items, "Sweeper" for 3 chain KOs); each node gives a tiny passive for later runs. Equip up to 3. **Trigger:** Run end tally. **Feel:** The build you played becomes the build you have. **Deps:** playstyle titles, Research Tree. **Rarity:** always on. **Cx:** L. **Balance:** passives are sidegrades (e.g. +1 PP vs +2% money); respec free to avoid lock-in.

### F-PRG-04 · Hall of Fame Ascension
**What:** Repeated League wins elevate a Pokémon. **How:** Win thrice with the same Pokémon to "ascend": portrait upgrade, dossier line, and a once-per-run assist call-in (lesser effect than a Totem ally). **Trigger:** Third League win. **Feel:** Heroes of your own legend. **Deps:** legacy runs, assist system. **Rarity:** rare. **Cx:** L. **Balance:** assist cooldown of one use per run; cannot stack; leans cosmetic.

### F-PRG-05 · Scar and Glory Marks
**What:** Permanent marks from extreme moments. **How:** 24 marks (survived at 1 HP, solo-beat a Totem, burned in a flood...). Each adds a quirk and a summary line; ~one in three is a mild negative (Skittish: -5% accuracy in rain), curable by a story event. **Trigger:** Specific battle events. **Feel:** Battle-tested individuals. **Deps:** memories, moment system. **Rarity:** uncommon. **Cx:** M. **Balance:** negatives are small and removable; cap three marks per Pokémon; marks stored in the Pokémon record to avoid save bloat.

### F-PRG-06 · Expedition Licences
**What:** Licence tiers gating risky routes. **How:** Bronze/Silver/Gold earned by objectives; higher tiers open dangerous stops with richer loot and unique Totem variants. **Trigger:** Objective completion. **Feel:** Credentials that open doors. **Deps:** expeditions, map. **Rarity:** always on. **Cx:** M. **Balance:** reward and risk rise together; Gold loot gives variety, not raw power.

### F-PRG-07 · Mastery Seasons
**What:** Mastery cycles in themed seasons of ten runs. **How:** Each season picks a theme (Fighting, Fog, Strategy) with soft goals; completing them grants a permanent cosmetic; progress resets only for the season tracker, not mastery itself. **Trigger:** Run-count tick. **Feel:** Fresh goals without grinding. **Deps:** mastery. **Rarity:** always on. **Cx:** M. **Balance:** nothing lost on rollover; seasonal goals must be compatible with normal play.

### F-PRG-08 · Rank-Up Exams
**What:** A set-piece exam at rank thresholds. **How:** Three fixed-rule fights (e.g. only Normal moves, no items, double battle) with a sponsor commentator. **Trigger:** Rank threshold. **Feel:** A milestone moment. **Deps:** Prestige. **Rarity:** at thresholds. **Cx:** M. **Balance:** free retries; the exam must be winnable with any starter set (sim verified).

### F-PRG-09 · Sponsored Careers
**What:** Choose a career path with a tiny tree. **How:** Ranger, Breeder, Gambler, Scholar; each has 5 perks, flavour events, and a capstone that changes one event type (Breeder sees egg events). **Trigger:** After 3 runs. **Feel:** Roleplay depth. **Deps:** trainer classes, events. **Rarity:** always on. **Cx:** L. **Balance:** careers equal in value in sim; capstones must not skip core progression.

### F-PRG-10 · Pokémon Seniority System
**What:** Veterans mentor juniors. **How:** Seniority counts runs together; a senior with 5+ runs teaches one move or ability echo to a junior at rest stops, once per run. **Trigger:** Run count. **Feel:** Generational teams. **Deps:** bonds, legacy. **Rarity:** always on. **Cx:** L. **Balance:** limited to one transfer per run and level-gated to avoid move laundering.

### F-PRG-11 · Unlock Roadmap with Forecast
**What:** A roadmap of future unlocks. **How:** Fogged silhouettes with hint text; hints sharpen as you approach thresholds; locked systems show the first requirement. **Trigger:** Always. **Feel:** Goals visible, discovery preserved. **Deps:** unlock system. **Rarity:** always on. **Cx:** S. **Balance:** hide secret unlock hints entirely.

### F-PRG-12 · Catch-Up Windfalls
**What:** Gentle help after a bad streak. **How:** After 3 straight losses, the next Run Prep offers one extra scout report or +10% starting money, shown openly. **Trigger:** Loss streak. **Feel:** Kindness without handouts. **Deps:** run finalize. **Rarity:** conditional. **Cx:** S. **Balance:** transparent, optional, never stacks beyond one.

### F-PRG-13 · World Rank
**What:** An offline ranking among fictional trainers. **How:** 200 seeded NPC trainers have deterministic results; your score slots into the list. **Trigger:** Run end. **Feel:** Climb. **Deps:** rival simulation. **Rarity:** always on. **Cx:** M. **Balance:** NPC scores follow a published curve so you can trust the ladder.

### F-PRG-14 · Region Progress Journals
**What:** Region completion pages. **How:** Lists undiscovered stops, trainers, secrets as fogged entries with percent bars. **Trigger:** Always. **Feel:** Clear completion targets. **Deps:** Regional Board. **Rarity:** always on. **Cx:** M. **Balance:** do not spoil secret areas (show a "?" slot count only).

---

## J. Statistics and Player-History Features (F-HIS)

### F-HIS-01 · Season Recap
**What:** A shareable recap of recent runs. **How:** Picks MVP, nemesis, biggest comeback, funniest moment; renders a poster and a 30 s slide sequence. **Trigger:** Manual, or every 25 runs. **Feel:** Wrapped-style delight. **Deps:** chronicle, stats. **Rarity:** periodic. **Cx:** M. **Balance:** avoid shaming stats; show only highlights by default.

### F-HIS-02 · MVP and Villain Awards
**What:** Per-run awards. **How:** MVP (most contribution), Unsung Hero (support), Villain (foe that dealt most damage or beat you). **Trigger:** Run end. **Feel:** Narrative closure. **Deps:** run stats, nemesis. **Rarity:** always on. **Cx:** S. **Balance:** formulas published in the help page so awards feel fair.

### F-HIS-03 · Heat Map of Mistakes
**What:** A post-run map of where HP was lost. **How:** Timeline strips with spikes and tags (status, crit, hazard, bad switch); hovering shows the decision point. **Trigger:** Run end. **Feel:** A learning tool. **Deps:** battle log. **Rarity:** always on. **Cx:** M. **Balance:** use neutral language ("high-risk turn") not "mistake".

### F-HIS-04 · Matchup Ledger
**What:** Species vs species history. **How:** KO ratios and damage ranges per pair; filter by type. **Trigger:** Battles. **Feel:** Data nerd pleasure. **Deps:** battle log. **Rarity:** always on. **Cx:** M. **Balance:** cap stored pairs to the 500 most recent to bound save size.

### F-HIS-05 · Decision Replay Points
**What:** "What if" for pivotal choices. **How:** Mark up to 5 pivot points per run; the replay engine re-simulates the first alternate branch with the same seed and shows the outcome summary. **Trigger:** Run end. **Feel:** Reflection. **Deps:** deterministic replay. **Rarity:** always on. **Cx:** XL. **Balance:** read-only; uses a separate RNG stream so it never alters history; cap compute with a 3 s budget.

### F-HIS-06 · Luck Report
**What:** How lucky the run was. **How:** Compares crits, catches, drops, and accuracy rolls to expected values; shows a "luck score" with sparkline. **Trigger:** Run end. **Feel:** Fair, honest narrative of luck. **Deps:** RNG logs. **Rarity:** always on. **Cx:** M. **Balance:** log only events already counted; do not expose future rolls.

### F-HIS-07 · Personal Records Wall
**What:** Plaques for records. **How:** Fastest win, longest streak, biggest hit, most money, fewest items. **Trigger:** Always. **Feel:** Pride. **Deps:** stats. **Rarity:** always on. **Cx:** S. **Balance:** records separated by mode.

### F-HIS-08 · Pokémon Career Pages
**What:** Lifetime stats per species. **How:** Wins, KOs, favourite partner, first and latest run, best moment. **Trigger:** Always. **Feel:** Fandom. **Deps:** stats. **Rarity:** always on. **Cx:** M. **Balance:** none.

### F-HIS-09 · Timeline of Your Career
**What:** A zoomable timeline. **How:** Zoom levels (year, month, run); icons for milestones; click opens the Chronicle. **Trigger:** Always. **Feel:** The long view. **Deps:** chronicle. **Rarity:** always on. **Cx:** M. **Balance:** virtualise the list for 1000+ runs.

### F-HIS-10 · Rival Head-to-Head Ledger
**What:** Detailed rival history. **How:** W/L, signature moments, favourite lines, by region. **Trigger:** Always. **Feel:** Rivalry history. **Deps:** rival. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-HIS-11 · Compare with Past Self
**What:** Compare a run to your average. **How:** Overlay bars for pace, healing, money, risk. **Trigger:** Run end. **Feel:** Growth. **Deps:** stats. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-HIS-12 · Lifetime Odometer
**What:** Quirky totals. **How:** Steps, battles, catches, with comparisons ("You walked the length of Kanto twice"). **Trigger:** Always. **Feel:** Charm. **Deps:** stats. **Rarity:** always on. **Cx:** S. **Balance:** none.

### F-HIS-13 · Streak Calendar
**What:** A calendar of play days. **How:** Colour intensity by runs; gentle notes. **Trigger:** Always. **Feel:** Habit tracking without guilt. **Deps:** profile. **Rarity:** always on. **Cx:** S. **Balance:** never penalises missed days.

### F-HIS-14 · Stats Export
**What:** Export history. **How:** JSON/CSV from files.ts with schema version. **Trigger:** Settings. **Feel:** Control. **Deps:** files. **Rarity:** always on. **Cx:** S. **Balance:** strip any unfinished-run seeds that would spoil Daily Runs.

---

## K. Spectator and Replay Features (F-SPEC)

### F-SPEC-01 · Instant Replay Booth
**What:** Rewatch any recent battle. **How:** Deterministic re-run from battle start state and action log; camera, speed, and step controls. **Trigger:** Post-battle. **Feel:** Sports replay. **Deps:** deterministic engine, action log. **Rarity:** always on. **Cx:** L. **Balance:** replay must never mutate state; logs kept for the last 20 battles only.

### F-SPEC-02 · Commentator Track
**What:** Announcer lines in replays. **How:** Template commentary from memories, rivalry, and type matchups (2 commentators, 200 lines). **Trigger:** Replay. **Feel:** Esports. **Deps:** dialogue. **Rarity:** always on. **Cx:** M. **Balance:** muteable; no spoilers during live battles.

### F-SPEC-03 · Replay Export (GIF/Clip)
**What:** Export a moment as a clip. **How:** Canvas capture up to 10 s at 30 fps, WebM/GIF. **Trigger:** Replay. **Feel:** Sharing. **Deps:** capture. **Rarity:** always on. **Cx:** L. **Balance:** memory use; cap resolution and run capture off the render loop.

### F-SPEC-04 · Spectator Seeds
**What:** Watch an AI play a seed. **How:** Auto-pilot with commentary explaining its choices. **Trigger:** Mode. **Feel:** Learning. **Deps:** AI. **Rarity:** optional. **Cx:** L. **Balance:** clearly labelled; AI uses a fixed policy.

### F-SPEC-05 · Ghost Overlay
**What:** See a prior run's path. **How:** Translucent ghost markers on the map with their choices revealed after you pass each node. **Trigger:** Seed share. **Feel:** A race. **Deps:** seeds. **Rarity:** optional. **Cx:** M. **Balance:** reveal only after passing to avoid spoilers.

### F-SPEC-06 · Director's Cut Camera
**What:** Cinematic replay camera. **How:** Preset moves (push-in on crits, wide on field effects). **Trigger:** Replay. **Feel:** Spectacle. **Deps:** presentation cues. **Rarity:** always on. **Cx:** M. **Balance:** off when Motion is reduced.

### F-SPEC-07 · Highlight Reel
**What:** Auto-cut best moments. **How:** Scores each battle event by drama (comeback, crit, nemesis) and picks the top 8 for a reel. **Trigger:** Run end. **Feel:** Memories. **Deps:** moments. **Rarity:** always on. **Cx:** L. **Balance:** deterministic scoring.

### F-SPEC-08 · Replay Annotations
**What:** Timeline notes. **How:** Add time-stamped notes; export with the replay code. **Trigger:** Replay. **Feel:** Analysis. **Deps:** replay. **Rarity:** always on. **Cx:** S. **Balance:** length-limit notes.

### F-SPEC-09 · Slow-Mo Critical Moments
**What:** Auto slow-mo. **How:** 0.4 s slow-mo on clutch KOs and crits. **Trigger:** Event. **Feel:** Cinematic. **Deps:** presentation. **Rarity:** always on. **Cx:** S. **Balance:** respects skip/animation settings.

### F-SPEC-10 · Tournament Broadcast View
**What:** A broadcast UI for tournaments. **How:** Bracket, stats, commentary ticker. **Trigger:** Tournament. **Feel:** Event. **Deps:** F-HUB-05. **Rarity:** always on. **Cx:** L. **Balance:** none.

### F-SPEC-11 · Replay Share Codes
**What:** Short code for a replay. **How:** Seed + action log, compressed and base64. **Trigger:** Replay. **Feel:** Social. **Deps:** save format. **Rarity:** always on. **Cx:** M. **Balance:** versioned so old codes stay valid or fail clearly.

### F-SPEC-12 · Stat Overlay for Spectators
**What:** Overlay with live numbers. **How:** Damage rolls, speed order, crit chance. **Trigger:** Replay. **Feel:** Nerd. **Deps:** engine. **Rarity:** always on. **Cx:** M. **Balance:** replay-only to avoid giving live-play info if not wanted.

### F-SPEC-13 · Photo Finish Mode
**What:** Freeze on the last KO. **How:** Pause plus caption card. **Trigger:** Win. **Feel:** Dramatic. **Deps:** presentation. **Rarity:** always on. **Cx:** S. **Balance:** short; skippable.

### F-SPEC-14 · Storybook Replay
**What:** Run replay as storybook pages. **How:** One page per region with 3 captions and a snapshot. **Trigger:** Run end. **Feel:** Cosy. **Deps:** chronicle. **Rarity:** always on. **Cx:** L. **Balance:** caption text deterministic.

---

## L. Accessibility Improvements (F-ACC)

### F-ACC-01 · Cognitive Load Mode
**What:** Simplified screens. **How:** One decision at a time; hides secondary panels; wizards for shops, party, and rewards. **Trigger:** Settings. **Feel:** Calm. **Deps:** UI layers. **Rarity:** optional. **Cx:** L. **Balance:** must not hide critical info.

### F-ACC-02 · One-Handed Control Scheme
**What:** Single-hand play. **How:** Sticky selection and remapped inputs; cursor wheel for menus. **Trigger:** Settings. **Feel:** Inclusive. **Deps:** input. **Rarity:** optional. **Cx:** M. **Balance:** test all screens.

### F-ACC-03 · Text-to-Speech Narration
**What:** Read text aloud. **How:** Web Speech API with voice, rate, and which text to read. **Trigger:** Settings. **Feel:** Accessible. **Deps:** text system. **Rarity:** optional. **Cx:** M. **Balance:** queue interrupts; handle missing voices.

### F-ACC-04 · Audio Cues for Battle State
**What:** Sound cues for state. **How:** Distinct tones for low HP, status, super effective. **Trigger:** Settings. **Feel:** Blind-friendly. **Deps:** audio. **Rarity:** optional. **Cx:** M. **Balance:** avoid clutter; volumes adjustable.

### F-ACC-05 · Pause-Anywhere with Timers Off
**What:** Remove real-time pressure. **How:** Global setting; minigames switch to turn-based versions. **Trigger:** Settings. **Feel:** Safe. **Deps:** minigames. **Rarity:** optional. **Cx:** S. **Balance:** achievements remain earnable.

### F-ACC-06 · High-Contrast and Outline Pack
**What:** High-contrast theme. **How:** Heavy outlines and pure colours. **Trigger:** Settings. **Feel:** Clear. **Deps:** theme. **Rarity:** optional. **Cx:** M. **Balance:** meet WCAG contrast.

### F-ACC-07 · Type Icon Shapes
**What:** Type icons distinguished by shape. **How:** Each type gets a shape and pattern. **Trigger:** Settings. **Feel:** Colourblind friendly. **Deps:** icons. **Rarity:** optional. **Cx:** M. **Balance:** keep recognisable.

### F-ACC-08 · Dwell-Click and Switch Support
**What:** Switch device support. **How:** Dwell timers and scanning. **Trigger:** Settings. **Feel:** Inclusive. **Deps:** input. **Rarity:** optional. **Cx:** M. **Balance:** adjustable timers.

### F-ACC-09 · Plain Language Mode
**What:** Simplified wording. **How:** Alternate strings for effects ("Makes foe slower"). **Trigger:** Settings. **Feel:** Clear. **Deps:** text data. **Rarity:** optional. **Cx:** M. **Balance:** keep in sync with data changes (generated where possible).

### F-ACC-10 · Rebindable Everything
**What:** Full rebinding. **How:** Binding UI with profiles. **Trigger:** Settings. **Feel:** Control. **Deps:** input. **Rarity:** optional. **Cx:** M. **Balance:** conflict detection.

### F-ACC-11 · Motion Sickness Guard
**What:** One toggle disables motion triggers. **How:** Turns off camera shake, parallax, zoom, and scroll effects at once. **Trigger:** Settings. **Feel:** Comfortable. **Deps:** presentation. **Rarity:** optional. **Cx:** S. **Balance:** gameplay unaffected.

### F-ACC-12 · Sound Captions
**What:** Captions for effects. **How:** "[Crowd cheers]" in a caption lane. **Trigger:** Settings. **Feel:** Deaf-friendly. **Deps:** audio. **Rarity:** optional. **Cx:** M. **Balance:** throttle captions.

### F-ACC-13 · Adjustable Hit Targets
**What:** Bigger buttons. **How:** Scale and spacing sliders. **Trigger:** Settings. **Feel:** Easier. **Deps:** UI. **Rarity:** optional. **Cx:** M. **Balance:** test on mobile.

### F-ACC-14 · Guided Tutorial Companion
**What:** A helper explaining screens once. **How:** Contextual first-time overlays with "Don't show again". **Trigger:** Settings. **Feel:** Gentle. **Deps:** tutorial. **Rarity:** optional. **Cx:** M. **Balance:** never blocks input.
