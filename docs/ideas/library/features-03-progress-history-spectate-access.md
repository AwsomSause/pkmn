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
**What:** Watch an AI play a seed, with commentary. **How:** A fixed-policy auto-pilot plays a chosen seed; a side panel explains each decision ("Chose Water: next boss is Fire"). You can take over at any node. **Trigger:** Spectate mode. **Feel:** Learn by watching, or relax. **Deps:** AI policy, replay. **Rarity:** optional. **Cx:** L. **Balance:** AI results never count for achievements; label policy clearly.

### F-SPEC-05 · Ghost Overlay
**What:** See a prior run's path as a ghost. **How:** Translucent markers on the map show where a past or shared run went; the ghost's choices are revealed only after you pass each node. **Trigger:** Seed share or own history. **Feel:** A race against yourself or a friend. **Deps:** seeds, map. **Rarity:** optional. **Cx:** M. **Balance:** reveal-after-pass prevents spoilers; ghost data is read-only.

### F-SPEC-06 · Director's Cut Camera
**What:** Cinematic replay camera. **How:** Presets (push-in on crits, wide on field effects, orbit on boss intros), chosen per replay or auto. **Trigger:** Replay. **Feel:** Spectacle. **Deps:** presentation cues. **Rarity:** always on. **Cx:** M. **Balance:** off in Reduced Motion; replay-only so live battle pacing is unchanged.

### F-SPEC-07 · Highlight Reel
**What:** Auto-cut best moments. **How:** Each battle event gets a drama score (comeback, crit, nemesis, last-HP win); the top 8 are stitched with captions. **Trigger:** Run end. **Feel:** A personal montage. **Deps:** moments, replay. **Rarity:** always on. **Cx:** L. **Balance:** scoring deterministic; cap reel length at 60 s.

### F-SPEC-08 · Replay Annotations
**What:** Notes on a replay timeline. **How:** Add text pins at timestamps (≤120 chars), export with the replay code, and view others' notes. **Trigger:** Replay. **Feel:** Analysis and teaching. **Deps:** replay. **Rarity:** always on. **Cx:** S. **Balance:** length-limited and filtered when imported.

### F-SPEC-09 · Slow-Mo Critical Moments
**What:** Automatic slow-motion beats. **How:** 0.4 s slow-mo plus a small zoom on clutch KOs, crits, and last-HP survivals, replay and live (optional). **Trigger:** Event. **Feel:** Cinematic drama. **Deps:** presentation cues. **Rarity:** always on. **Cx:** S. **Balance:** never delays input; skipped by skip/Reduced settings.

### F-SPEC-10 · Tournament Broadcast View
**What:** A broadcast layout for Tournament Hall. **How:** Bracket on one side, live battle with stat overlays, commentary ticker, and a pre-match "tale of the tape". **Trigger:** Tournament. **Feel:** Event-night energy. **Deps:** F-HUB-05, commentator track. **Rarity:** always on. **Cx:** L. **Balance:** purely view layer.

### F-SPEC-11 · Replay Share Codes
**What:** A short code that recreates a replay. **How:** Seed + action log compressed with a version prefix; importing rebuilds the replay; mismatched versions show a clear message. **Trigger:** Replay. **Feel:** Easy sharing. **Deps:** save format, engine version. **Rarity:** always on. **Cx:** M. **Balance:** engine changes can break old codes, so ship version tags and a compatibility note.

### F-SPEC-12 · Stat Overlay for Spectators
**What:** Live numbers in replays. **How:** Toggle overlays for damage range, speed order, crit chance, and remaining PP. **Trigger:** Replay. **Feel:** Insight for nerds and coaches. **Deps:** engine. **Rarity:** always on. **Cx:** M. **Balance:** replay-only; hidden info (unrevealed foe sets) stays hidden unless run is finished.

### F-SPEC-13 · Photo Finish Mode
**What:** Freeze on the winning KO. **How:** A 0.8 s freeze with a caption card ("Won by 3 HP") and a share button. **Trigger:** Win. **Feel:** Dramatic punctuation. **Deps:** presentation. **Rarity:** always on. **Cx:** S. **Balance:** skippable; no effect on battle state.

### F-SPEC-14 · Storybook Replay
**What:** Run replay as storybook pages. **How:** One page per region: a snapshot, three auto-captions from Chronicle, a rival aside; page flips with bouncy animation. **Trigger:** Run end. **Feel:** Cosy keepsake. **Deps:** chronicle. **Rarity:** always on. **Cx:** L. **Balance:** captions deterministic and reviewed to avoid spoilers for new players.

---

## L. Accessibility Improvements (F-ACC)

### F-ACC-01 · Cognitive Load Mode
**What:** A calm mode that shows one decision at a time. **How:** Shops, rewards, party, and map choices become step-by-step cards (what you have → options → confirm); side panels collapse; text is chunked to ≤2 short lines; animations are minimal. A "See everything" button reveals the full screen at any moment. **Trigger:** Settings or first-run prompt. **Feel:** Less overwhelm, more confidence; helpful for ADHD, fatigue, and beginners. **Deps:** UI layers, Picker, settings. **Rarity:** optional. **Cx:** L. **Balance:** no mechanics change; risk is hiding critical info (status, low HP), so those warnings always stay visible.

### F-ACC-02 · One-Handed Control Scheme
**What:** Full play with one hand on keyboard, mouse, or touch. **How:** Sticky selection (press once to pick, again to confirm), a radial menu on one key, and optional auto-advance after a delay; every action reachable from 6 keys on one side. **Trigger:** Settings. **Feel:** No awkward chords or two-handed gestures. **Deps:** input.ts, Quick Wheel (F-MENU-03). **Rarity:** optional. **Cx:** M. **Balance:** none; test every screen incl. minigames, and avoid timing-based confirmations.

### F-ACC-03 · Text-to-Speech Narration
**What:** Read dialogue and menu focus aloud. **How:** Web Speech API with voice, rate, pitch; chooses what to read (dialogue, menus, battle log); speaker names spoken once per scene; Pokémon names pronounced via a small override dictionary. **Trigger:** Settings. **Feel:** Playable without reading. **Deps:** text system, settings. **Rarity:** optional. **Cx:** M. **Balance:** queue and interrupt rules so speech never lags battle; handle missing voices and mobile autoplay limits; avoid double announcements with screen-reader labels.

### F-ACC-04 · Audio Cues for Battle State
**What:** Distinct sounds that convey battle state. **How:** Pitch-coded HP bands (rising tone ↔ falling), unique tones for super effective, resisted, crit, status, and a low-HP heartbeat; a "read turn summary" key repeats the last turn. **Trigger:** Settings. **Feel:** Play by ear. **Deps:** audio, battle log. **Rarity:** optional. **Cx:** M. **Balance:** keep volume independent of music; throttle overlapping cues to ≤3 per turn to avoid noise.

### F-ACC-05 · Pause-Anywhere with Timers Off
**What:** Remove every real-time pressure. **How:** One switch turns timed minigames into turn-based versions (e.g. rhythm → step-through), disables auto-advance timeouts, and allows pause in all scenes. **Trigger:** Settings. **Feel:** Zero panic. **Deps:** minigames, scene manager. **Rarity:** optional. **Cx:** S. **Balance:** achievements still earnable, but speed-based ones are flagged as unavailable with a clear label rather than silently locked.

### F-ACC-06 · High-Contrast and Outline Pack
**What:** A high-visibility theme. **How:** Pure foreground/background colours, 2 px outlines on sprites and UI, thicker focus ring, no gradients under text; passes WCAG AA (7:1 for body text). **Trigger:** Settings. **Feel:** Crisp and readable. **Deps:** theme tokens. **Rarity:** optional. **Cx:** M. **Balance:** must not break the aesthetic style guide for other themes; ensure status colours stay distinct.

### F-ACC-07 · Type Icon Shapes
**What:** Type icons readable without colour. **How:** Each of 18 types gets a unique silhouette (flame, leaf, drop...) and a pattern fill; labels optionally always shown. **Trigger:** Settings. **Feel:** Fair for colourblind players. **Deps:** type icons, battle UI. **Rarity:** optional. **Cx:** M. **Balance:** keep silhouettes distinct at 16 px; test with deuteranopia/protanopia simulation.

### F-ACC-08 · Dwell-Click and Switch Support
**What:** Play with a single switch or dwell pointing. **How:** Dwell timer on hover (configurable 0.5–3 s) and scanning mode that cycles through focusable elements with one switch input. **Trigger:** Settings. **Feel:** Independent play. **Deps:** input, focus manager. **Rarity:** optional. **Cx:** M. **Balance:** scanning speed adjustable; every screen needs a defined focus order (test via automated focus-walk).

### F-ACC-09 · Plain Language Mode
**What:** Simpler wording for rules text. **How:** Alternate strings for moves, abilities, items, and statuses ("Makes the foe slower for 3 turns"), generated from structured effect data where possible and hand-checked for the top 200. **Trigger:** Settings. **Feel:** Understandable without jargon. **Deps:** data text, dexInfo. **Rarity:** optional. **Cx:** M. **Balance:** auto-generation can drift from rules; a unit test compares numbers in plain text vs data.

### F-ACC-10 · Rebindable Everything
**What:** Full rebinding with profiles. **How:** Binding screen for keyboard and gamepad with conflict detection, per-device profiles, and a reset; touch gestures configurable. **Trigger:** Settings. **Feel:** Control. **Deps:** input. **Rarity:** optional. **Cx:** M. **Balance:** reserve Esc and a recovery combo so a bad binding cannot lock the user out.

### F-ACC-11 · Motion Sickness Guard
**What:** One toggle for all motion triggers. **How:** Disables camera shake, parallax, zoom, scroll bounce, screen flashes, and spin transitions, replacing them with fades. **Trigger:** Settings. **Feel:** Comfortable play. **Deps:** presentation cues, animation settings. **Rarity:** optional. **Cx:** S. **Balance:** gameplay unaffected; must also cover Hub idle animation and Quick Wheel.

### F-ACC-12 · Sound Captions
**What:** Text captions for important sounds. **How:** A caption lane shows "[Crowd cheers]", "[Low HP warning]", "[Rival laughs]" with direction hints; positioned bottom-left, resizable. **Trigger:** Settings. **Feel:** Deaf and hard-of-hearing friendly. **Deps:** audio events. **Rarity:** optional. **Cx:** M. **Balance:** throttle to avoid spam; caption only gameplay-relevant sounds.

### F-ACC-13 · Adjustable Hit Targets
**What:** Larger, more spaced controls. **How:** Scale slider 100–200% for buttons and spacing between actionable items, with minimum 44 px targets in Large mode. **Trigger:** Settings. **Feel:** Easier taps and clicks. **Deps:** UI layout. **Rarity:** optional. **Cx:** M. **Balance:** layouts must reflow without overlap; test small screens.

### F-ACC-14 · Guided Tutorial Companion
**What:** An optional helper explaining each screen once. **How:** A small companion character shows one tip per new screen with "Got it" and "Don't show again"; tips are replayable from the Journal. **Trigger:** Settings (default on for new profiles). **Feel:** Gentle onboarding. **Deps:** tutorial system, Journal. **Rarity:** optional. **Cx:** M. **Balance:** never blocks input or hides important UI; limit to 1 tip per 30 seconds.
