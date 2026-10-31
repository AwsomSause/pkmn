# Systems H: Meta progression, unlocks, difficulty, modes, tooling and game-redefining experiments (SYS-H01 to SYS-H70)

Legend as in file A. Existing code touched: `core/mastery.ts`, `core/unlocks.ts`, `core/progress.ts`, `core/quests.ts`, `core/objectives.ts`, `core/modeObjectives.ts`, `core/modeRewards.ts`, `core/rules.ts`, `core/runPrep.ts`, `core/seedCode.ts`, `core/configPack.ts`, `core/daily.ts`, `core/settingsRegistry.ts`, `core/accessibility.ts`, `core/campaign`, `src/save`, `src/quality`, `src/debug`.

## H1. Meta progression and unlock structure

**SYS-H01 Unlock Graph Unified ★F** · O · C:L · P:Ess
Every unlock (starters, perks, perks, items, modes, cosmetics) lives in one graph with typed prerequisites and an inspectable "why locked" explanation. Deps: unlocks, achievements. Impact: removes scattered gating logic; powers hints. Balance: graph validated for reachability.

**SYS-H02 Achievements That Unlock Content** · E · C:M · P:High
Achievements reward new events, trainers and mechanics (not only titles), tied to the codex. Deps: H01. Impact: meaning for achievements. Balance: no required achievements for basic content.

**SYS-H03 Mastery Seasons** · N · C:M · P:Med
Seasonal mastery goals rotate with rewards that remain cosmetic or sidegrade. Deps: mastery, E02. Impact: ongoing hooks. Balance: no FOMO lockouts.

**SYS-H04 Prestige With Teeth** · N · C:M · P:Med
Optional prestige resets earn "Marks" that add permanent run modifiers (harder, richer). Deps: profile. Impact: endgame. Balance: opt-in.

**SYS-H05 Meta Currency Sinks With Choices** · N · C:M · P:Med
Meta currency spent on branches that exclude each other per profile "era". Deps: G01. Impact: identity. Balance: respec per era.

**SYS-H06 Hub Workshops That Evolve** · N · C:L · P:Med
Hub buildings unlock features and look different as you progress. Deps: Hub pages. Impact: visible progress. Balance: paced.

**SYS-H07 Collection Books With Stories** · E · C:M · P:Med
Collections (shinies, items, memories) produce stories upon completion. Deps: collection. Impact: payoff. Balance: none.

**SYS-H08 Titles With Gameplay Effects** · E · C:S · P:Low
Titles apply minor, swappable effects. Deps: playstyle titles. Impact: expression. Balance: tiny.

**SYS-H09 Run Contracts (Pre-Run Commitments)** · N · C:M · P:High
Choose contracts before a run (No Healing at Gyms, Rival Always) for reward multipliers and unique rewards. Deps: runPrep. Impact: self-directed difficulty. Balance: multiplier table.

**SYS-H10 Milestone Gifts From Past Selves** · N · C:S · P:Low
Past achievements gift time-delayed items in later runs. Deps: D21. Impact: nostalgia. Balance: minor.

**SYS-H11 Account Level Unified** · N · C:M · P:Low
A single profile level from varied activities with cosmetic perks. Deps: profile. Impact: sense of progress. Balance: none.

**SYS-H12 Learning Curve Unlock Gating** · N · C:M · P:Med
New mechanics introduced gradually; veterans can opt to unlock all. Deps: tutorial. Impact: onboarding. Balance: toggle.

**SYS-H13 Secret Unlock Hunts** · N · C:M · P:Rare
Unlocks tied to cryptic actions; journal hints fragments. Deps: H01. Impact: discovery. Balance: documented after.

**SYS-H14 Mod Packs as Unlocks** · N · C:L · P:Low
Official content packs unlocked by play (Spooky pack style). Deps: configPack. Impact: variety. Balance: modular.

**SYS-H15 Trainer Class Mastery Paths** · E · C:M · P:Med
Long-term paths per class with signature endgame abilities. Deps: C02. Impact: depth. Balance: bounded.

## H2. Difficulty, modes and rulesets

**SYS-H16 Ruleset Compiler ★F** · N · C:L · P:High
Rulesets (Nuzlocke, Monotype, Inverse) are data-defined bundles of rule flags with a validator and UI card; custom rulesets can be shared via seed code. Deps: rules.ts, seedCode. Impact: infinite modes. Balance: preview of risk.

**SYS-H17 Mutator Deck** · N · C:M · P:High
Draw mutators per run (3 from deck of 60) with synergies and conflicts. Deps: H16. Impact: variety. Balance: scoring.

**SYS-H18 Dynamic Difficulty Ladders** · N · C:M · P:Med
After wins, opt-in ladders raise heat with rewards. Deps: C42. Impact: endgame scaling. Balance: capped.

**SYS-H19 Assist Options Framework** · E · C:M · P:High
Granular assists (extra revives, damage preview, slower timers) with honest labeling. Deps: accessibility. Impact: inclusivity. Balance: flagged in score.

**SYS-H20 Marathon Mode** · N · C:L · P:Low
A 20-region run with save-and-continue checkpoints. Deps: campaign. Impact: long play. Balance: scaling.

**SYS-H21 Sprint Mode** · N · C:M · P:Med
15-minute runs with condensed map and bosses. Deps: modes. Impact: quick play. Balance: separate board.

**SYS-H22 Roguelite Safety Nets** · N · C:S · P:Low
Optional rubber-banding (extra revive after repeated early losses). Deps: C42. Impact: friendliness. Balance: toggle.

**SYS-H23 Challenge of the Week** · E · C:M · P:Med
Weekly curated rulesets with featured rewards. Deps: daily. Impact: rhythm. Balance: cosmetic rewards.

**SYS-H24 Hardcore Permadeath Variants** · N · C:M · P:Low
Variants: party-wipe resets profile slot items (not content). Deps: legacy. Impact: stakes. Balance: opt-in.

**SYS-H25 Handicap Bidding** · N · C:M · P:Low
Before a run bid handicaps against a rival for score. Deps: rivals. Impact: bragging. Balance: bounded.

**SYS-H26 Gauntlet Scoring Overhaul** · O · C:M · P:Med
Score reflects style, risk, creativity (diverse moves) not just speed. Deps: scoring. Impact: replay. Balance: audited.

**SYS-H27 Level Cap Rules Per Mode** · E · C:S · P:Low
Level caps modeled as rule flags (Level 50 Cup). Deps: levels decision. Impact: modes. Balance: none.

**SYS-H28 Draft-Based Runs** · E · C:M · P:Med
Draft your team from pools shared with rivals. Deps: starter sets. Impact: strategy. Balance: fair.

**SYS-H29 Mirror Runs** · N · C:M · P:Low
Play a run with the rival's starting conditions. Deps: false protagonist. Impact: perspective. Balance: scored.

**SYS-H30 Scenario Mode** · N · C:L · P:Med
Hand-authored scenarios (Escort the Egg, Siege of Lavender) using the same systems. Deps: E38. Impact: authored content. Balance: tracked.

## H3. Tooling, QoL and technical systems

**SYS-H31 Content Pipeline Dashboard** · N · C:M · P:Med
Status board for all content (supported, limited, disabled, invalid) with filters. Deps: QUALITY_GATES. Impact: transparency. Balance: dev only.

**SYS-H32 Save Time Machine** · N · C:M · P:Med
Auto-snapshots at checkpoints with manual restore (single slot). Deps: saveManager. Impact: safety. Balance: not for competitive modes.

**SYS-H33 Deterministic Replay Packages** · N · C:L · P:High
Seed + action logs export as shareable replays that verify results. Deps: rng, replay. Impact: trust and sharing. Balance: size limits.

**SYS-H34 Quick Resume & Session Recovery** · E · C:M · P:Med
Robust resume after crash with minimal data loss. Deps: save. Impact: reliability. Balance: none.

**SYS-H35 In-Game Wiki / Glossary** · N · C:M · P:Med
Searchable glossary reflecting current rules and unlocked info. Deps: UI. Impact: clarity. Balance: spoiler-safe.

**SYS-H36 Smart Tooltips** · E · C:S · P:Med
Context-aware tooltips that adapt to knowledge level. Deps: UI. Impact: onboarding. Balance: none.

**SYS-H37 Undo Safe UI** · N · C:S · P:Low
Undo for non-committal menu actions. Deps: UI. Impact: QoL. Balance: none.

**SYS-H38 Keybinding & Controller Profiles** · E · C:M · P:Med
Profiles with remapping and controller layouts. Deps: input. Impact: access. Balance: none.

**SYS-H39 Content Hot-Reload for Authors** · N · C:M · P:Low
Dev hot reload for event/dialogue data. Deps: Vite. Impact: speed. Balance: dev only.

**SYS-H40 Localization Pipeline** · N · C:L · P:Med
Strings extracted, versioned, and previewed in multiple languages. Deps: text. Impact: reach. Balance: process.

**SYS-H41 Performance Budget Overlay** · N · C:S · P:Low
Shows frame time per system. Deps: debug. Impact: perf. Balance: dev only.

**SYS-H42 Telemetry-Free Local Analytics** · N · C:M · P:Low
Local stats of usage for the player only. Deps: profile. Impact: privacy-friendly insights. Balance: none.

**SYS-H43 Save Inspector and Repair** · N · C:M · P:Med
View/validate/repair saves with backups. Deps: save. Impact: trust. Balance: safe.

**SYS-H44 Test Scenario Recorder** · N · C:M · P:Low
Record play as a test fixture. Deps: Playwright. Impact: QA. Balance: dev only.

**SYS-H45 Fuzz/Soak Bots Expanded** · E · C:M · P:Med
Bot variants (aggressive, cautious, chaos) find broken combos. Deps: report scripts. Impact: balance. Balance: dev only.

**SYS-H46 Data Pack SDK** · N · C:L · P:Low
Documented pack format with validation CLI. Deps: configPack. Impact: community. Balance: gated.

**SYS-H47 Accessibility Audit Mode** · N · C:S · P:Med
Run an automated contrast/size audit on screens. Deps: accessibility. Impact: quality. Balance: dev only.

**SYS-H48 Offline-First Sync** · N · C:L · P:Low
Optional encrypted export/import sync via files. Deps: save. Impact: portability. Balance: none.

**SYS-H49 Share Cards** · N · C:S · P:Med
Generate shareable images of runs, teams and moments. Deps: recap. Impact: community. Balance: none.

**SYS-H50 Weekly Digest of Your Play** · N · C:S · P:Low
A summary of your sessions for nostalgia. Deps: stats. Impact: retention. Balance: none.

## H4. Community and social (offline-safe)

**SYS-H51 Seed Gallery** · N · C:M · P:Low
Curated seeds with descriptions. Deps: seedCode. Impact: discoverability. Balance: moderated.

**SYS-H52 Asynchronous Ghost Sharing** · N · C:L · P:Low
Import a friend's ghost party file. Deps: D26. Impact: social. Balance: sandboxed.

**SYS-H53 Community Challenges (Local Files)** · N · C:M · P:Low
Challenge packs shared as files with leaderboards stored locally. Deps: H16. Impact: community. Balance: honor system.

**SYS-H54 Pen-Pal Rivals (Imported)** · N · C:L · P:Low
Imported player profiles act as rivals. Deps: rivals. Impact: social. Balance: caps.

**SYS-H55 Co-op Draft & Hot-Seat Versus** · N · C:M · P:Low
Local multiplayer modes. Deps: modes. Impact: friends. Balance: fair.

**SYS-H56 Spectator Replay Rooms** · N · C:M · P:Low
Watch replays with commentary tracks. Deps: F66. Impact: sharing. Balance: none.

**SYS-H57 Fan Content Frames** · N · C:S · P:Low
Frames/stickers for share cards. Deps: H49. Impact: expression. Balance: none.

**SYS-H58 Tournament Brackets Local** · N · C:M · P:Low
Local bracket generator. Deps: modes. Impact: events. Balance: none.

**SYS-H59 Clubs & Guilds Offline Records** · N · C:S · P:Low
Imported records of friends' feats. Deps: H53. Impact: social. Balance: none.

**SYS-H60 Anniversary Community Events (Game-Wide)** · N · C:S · P:Rare
Special in-game events on release anniversaries. Deps: calendar. Impact: culture. Balance: cosmetic.

## H5. Experimental systems that could redefine the game

**SYS-H61 The Living Pokédex** · X · C:XL · P:Exp
The Pokédex becomes a simulated ecosystem: entries evolve with your findings, species mutate regionally, and your notes change world data. Deps: E04, researchNotes. Impact: collection becomes world-shaping. Balance: guard rails.

**SYS-H62 Story Engine Seeds as Cartridges** · X · C:XL · P:Exp
Swappable "story cartridges" that change game identity (Detective, Horror, Rom-Com) reweighting systems. Deps: D41, H16. Impact: mini-games-as-games. Balance: modular.

**SYS-H63 Roguelike Multiverse** · X · C:XL · P:Exp
Runs occur in parallel timelines you hop between, carrying one item and one memory. Deps: timeline. Impact: macro-structure. Balance: caps.

**SYS-H64 Pokémon as Players** · X · C:XL · P:Exp
Play a run as a Pokémon character with human NPCs. Deps: false protagonist. Impact: perspective flip. Balance: separate mode.

**SYS-H65 Trainer-less Mode** · X · C:L · P:Exp
A mode where your party acts autonomously and you only guide decisions. Deps: A61. Impact: unique. Balance: scored.

**SYS-H66 World Council Governance** · X · C:XL · P:Exp
Meta-layer where you vote on world rules each era shaping future runs. Deps: E01. Impact: agency. Balance: preview.

**SYS-H67 Narrative Roguelite Card Layer** · X · C:XL · P:Exp
A card-based narrative overlay selecting story beats like a deckbuilder. Deps: D41. Impact: new play loop. Balance: separate.

**SYS-H68 Persistent Rival Simulation Across Players** · X · C:XL · P:Exp
Optional sync where rival profiles evolve from anonymized player data (offline-safe imports). Deps: rivals. Impact: community-living. Balance: opt-in.

**SYS-H69 Ghost Dimension Layer** · X · C:XL · P:Exp
A parallel layer of ghost-state battles where fallen mons fight for you. Deps: A65. Impact: afterlife. Balance: bounded.

**SYS-H70 The Archive of All Runs** · X · C:L · P:Rare
A museum compiling every run as explorable dioramas and records. Deps: D21. Impact: nostalgia. Balance: none.
