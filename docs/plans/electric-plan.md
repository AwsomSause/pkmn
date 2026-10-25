# **Pokémon Roguelike: Taking the Project From Functional to Spectacular**



1\. Make every run a story

Rivals remember you. Nemeses evolve in response to your strategies. Pokémon develop bonds with their trainers. Rare encounters become memorable decisions instead of generic reward screens.



2\. Turn battles into spectacles

Multi-phase bosses, signature attacks, dynamic arenas, battle cinematics, transformation sequences, adaptive trainer AI, and satisfying victory moments.



3\. Make the world react

Regional events, changing routes, rare discoveries, faction encounters, weather, escalating crises, secret detours, and consequences that persist through a campaign.



4\. Make progression addictive without making it pay-to-win

Research, collections, trainer mastery, challenge records, unlockable starting strategies, legacy runs, and a hub that visibly grows with your achievements.

The critical distinction: your project already has a lot of systems planned. What it needs now is a framework for making those systems interact, a prioritization strategy to prevent feature overload, and a rigorous way to direct Claude to implement the game without quietly leaving half the mechanics as placeholders.

## **1\. The biggest change: build an interconnected game, not a collection of features**

Your existing M8.75 milestone is doing a lot of heavy lifting. It includes events, friendship, unsupported battle mechanics, abilities, held items, challenges, research, trainer unlocks, custom regions, and legacy progression.

IMPLEMENTATION\_PLAN.md

I'd split that work into independently testable systems, then make those systems communicate through a common set of game events.

For example, imagine a single run:

* You choose Silver as your trainer and start with a Pokémon you've mastered.  
* Your rival is generated from your history and starts using counter-strategies based on previous encounters.  
* A rare event offers to evolve one of your Pokémon early, but the evolution changes how your nemesis prepares for the next fight.  
* You detour into a dangerous ruin to obtain a transformation item.  
* A gym leader recognizes your previous victory and opens with a counter to your strongest strategy.  
* You defeat them using an unexpected team combination, unlocking a unique research discovery.  
* When the run ends, your trainer archive records the rivalry, your Pokémon gain mastery, and the next run can reference what happened.

None of those features is particularly groundbreaking in isolation. The spectacle comes from the connections between them.

### **The shared architecture I'd add**

## **Core Game Event Bus**

One authoritative stream of gameplay events

Battle won · Pokémon caught · Boss defeated · Rival encountered · Evolution triggered

Battle systems

AI adaptation, boss phases, abilities, transformations

Run systems

Rivals, nemeses, events, branching routes

Relationship systems

Friendship, interactions, trainer bonds

Persistent progression

Research, mastery, achievements, legacy

Presentation & narrative

Dialogue, cut-ins, battle cameras, music cues, UI reactions and recap screens

This is a proposed extension, not something I can confirm already exists in the repository. It fits your current pure-TypeScript core architecture and keeps Phaser responsible for presentation rather than game rules. Phaser's scene model also supports separating gameplay, menus, and layered presentation into manageable scenes.

I'd introduce five contracts:

1. Domain events: immutable records of what happened, with unique IDs and run context.  
2. Commands: player or AI requests, validated by the core before changing state.  
3. Effects: explicit results such as damage, currency changes, friendship changes, or map mutations.  
4. Presentation cues: instructions for visuals and audio that never determine gameplay outcomes.  
5. Persistence rules: durable state is saved; cosmetic playback and transient effects can be reconstructed.

A crucial rule: the game must never apply a reward twice because an animation played again, a page refreshed, or a save resumed.

## **2\. Add systems that generate memorable stories**

These are the systems I'd prioritize for the next major expansion.



## **A. Rivalry System**

Highest priority

Rivals should be persistent characters with a relationship to the player, not just another trainer pulled from a pool.

* Rivals develop teams based on their identity, available Pokémon, and campaign stage.  
* Track wins, losses, narrow victories, rematches, and significant battle events.  
* Rival encounters change dialogue, team composition within valid constraints, and rewards.  
* Rivals can appear at unexpected route nodes, challenge the player after a gym, or return during the Elite Four.  
* Rivalries can conclude with a unique final encounter and a permanent archive entry.

Signature moment: your rival's ace returns in a championship battle, now evolved, with a new strategy and a callback to your first encounter.

![\[閒聊\] 寶可夢珍鑽 BGM投票 - 看板C\_Chat - PTT網頁版][image6]

## **B. Nemesis System**

Nemeses should be rarer, more dangerous, and more persistent than rivals.

* Create a nemesis from a major defeat, a failed event, a recurring boss, or a campaign-specific threat.  
* Track an identity, history, signature strategy, and escalating threat level.  
* Let a nemesis exploit repeated player habits without cheating or reading future RNG.  
* Give each nemesis a limited pool of counter-strategies, team upgrades, and possible battle phases.  
* Resolve the rivalry through victory, escape, redemption, or a campaign-specific conclusion.

Signature moment: a boss that defeated you in an earlier run returns in a later campaign, and its battle log shows how it adapted to your previous tactics.

Important: persistence should be deterministic and bounded. Nemeses need cooldowns, encounter limits, and counters that remain beatable.



## **C. Dynamic Event Director**

Turn the planned event system into a curated encounter director.

* Offer common, rare, dangerous, and legendary-tier events.  
* Use party composition, friendship, attributes, items, route choices, and prior events as eligibility conditions.  
* Provide two to four meaningful options with clearly communicated risks.  
* Support branching outcomes, battles, trades, sacrifices, transformations, and permanent discoveries.  
* Prevent repetitive events and remember important choices.

Signature moment: a researcher recognizes a rare form in your party. You can hand it over for a permanent research unlock, refuse and earn a battle, or negotiate a different reward.

This expands your M8.75 plan while taking inspiration from the event-driven structure documented for PokéRogue's Mystery Encounters.

![]()  
GitHub  
\+1  


## **D. Pokémon Bond & Protege System**

Friendship should influence more than evolution requirements.

* Between-stage interactions: train, play, talk, rest, feed, or study.  
* Individual bond histories and personality-flavored dialogue.  
* Proteges: select one Pokémon for a training focus, such as speed, resilience, or move mastery.  
* Rare bond events triggered by battle history, attributes, and species tags.  
* Optional clutch moments with strict balance rules, not automatic victories.

Signature moment: a Pokémon you've used since the beginning unlocks a unique once-per-run recovery opportunity after surviving a boss's signature attack.

Keep the core bond mechanics independent of any particular animation, and use a shared ruleset for every eligible species.



## **E. Raid & World Crisis System**

Add rare, high-stakes encounters that temporarily change the structure of a run.

* Multi-phase raid bosses with telegraphed attacks and environmental hazards.  
* Optional preparation nodes that let players scout weaknesses or gather supplies.  
* Regional crisis meters that increase when the player ignores certain threats.  
* Different boss phases depending on battle performance, not random cutscene triggers.  
* Rewards that alter future routes, unlock forms, or permanently add research entries.

Signature moment: a region-wide crisis culminates in a boss fight where the arena changes after each phase, and previously completed event choices determine which resources are available.

Start with a solo, turn-based raid. Online co-op would be a separate architectural project, not a requirement for this feature.

### **The rule for all five systems**

Don't ask Claude to implement all of them simultaneously. Give each system a small playable slice, define its state and event contracts, test it independently, and then connect it to the other systems.

That's how you get surprising emergent behavior without turning the codebase into a web of special cases.

## **3\. Turn the battle engine into the centerpiece**

Your plan currently has a large gap between importing the Pokédex and implementing all the move effects, abilities, and held items. The plan itself recognizes that hundreds of moves still require engine support.

IMPLEMENTATION\_PLAN.md

I'd treat battle completeness as its own major engineering program, with a separate presentation program layered on top.

### **The battle spectacle stack**

****

Layer 1 — Mechanical correctness

Accurate damage, move effects, abilities, status conditions, switching, priority, held items, battle forms, and fainting rules. No fake or silently skipped moves.



Layer 2 — Feedback

Hit-stop, screen shake, damage numbers, type-effectiveness indicators, status icons, HP transitions, cry playback, and clear telegraphs.



Layer 3 — Transformations

Mega Evolution, Z-Moves, Terastallization, Dynamax, and your custom Z-Forms and Mega forms. Each should have distinct presentation, rules, and meaningful counterplay.



Layer 4 — Boss spectacle

Multi-phase fights, changing backgrounds, scripted introductions, signature attacks, music transitions, phase-specific AI, and special victory sequences.

### **Features that would make battles feel extraordinary**

| Feature | Proposed implementation |
| ----- | ----- |
| Boss phases | Phase transitions triggered by explicit battle-state conditions, not animation timing |
| Signature moves | Unique effects, telegraphs, camera cues, and sound events |
| Transformation cinematics | Reusable animation sequences driven by validated gameplay results |
| Dynamic music | Separate battle, danger, transformation, and victory layers |
| Battle commentary | Contextual text for critical hits, rival reactions, type counters, and clutch victories |
| Arena modifiers | Weather, terrain, hazards, and special boss environments with defined rules |
| Victory moments | Slowdowns, team lineup, rare-form reveals, and boss-specific endings |
| Animation fallback | A readable, fast fallback when an asset is missing or the player disables effects |

The supplied animation JSON should be treated as an asset format to inspect and implement against, not assumed to be compatible with Phaser out of the box. Phaser supports frame-based animations, but your team will still need a translation layer from the supplied format into your own presentation commands.

One particularly important improvement: give every move two independent definitions:

* A mechanical definition that determines the actual battle result.  
* A presentation definition that describes how to show the result.

That separation lets Claude build impressive animations without accidentally changing damage, turn order, or status effects.

## **4\. Make the campaign feel like a world, not 1,600 encounters**

Your full campaign is currently planned at approximately 1,600 encounters across ten regions. That's an enormous amount of gameplay.

IMPLEMENTATION\_PLAN.md

More encounters aren't automatically better. You need pacing, escalation, and variation.

I'd add a Campaign Director that orchestrates existing systems without taking ownership of their rules.

## **Example: One region's dramatic arc**

1. Act I — Arrival  
   Introduce the region's identity, native Pokémon, a rival, and a local mystery. Give the player a meaningful early route decision.  
2. Act II — Escalation  
   Unlock side paths, faction encounters, rare events, and a developing crisis. The nemesis begins reacting to the player's successes.  
3. Act III — The turning point  
   A major event changes available routes or resources. The player can prepare for the gym, take a risk for a rare reward, or pursue the crisis directly.  
4. Act IV — The climax  
   The gym leader uses a signature strategy. The arena, music, and battle presentation respond to the encounter, with difficulty based on the actual rules and player strength.  
5. Act V — The aftermath  
   Record the victory, update rival relationships, unlock discoveries, show a regional recap, and preview the next region's stakes.

Not every region should use precisely the same structure. One could be mystery-focused, another dominated by rival battles, another by raids, and another by exploration and rare forms.

### **Add a route consequence engine**

Routes should communicate more than difficulty labels.

* Safe path: healing, shops, and low risk.  
* High-risk path: tougher trainers, better rewards, and rarer encounters.  
* Mystery path: event-heavy, with unknown but bounded outcomes.  
* Research path: species discoveries, unusual forms, and research rewards.  
* Nemesis path: an increased chance of a dangerous recurring encounter.  
* Story path: region-specific events that affect later battles.

The map should generate a valid path first, then attach rewards and events subject to eligibility rules. Every generated map should remain completable, including under unusual seeds and party conditions.

## **5\. Expand permanent progression into a living hub**

You already have the Hub, Bank, Trainer Archive, Achievement Hall, Run History, Research Points, starter pools, licenses, and loadout presets.

IMPLEMENTATION\_PLAN.md

Rather than adding dozens of disconnected menus, make the hub evolve visibly with the player's accomplishments.



Research Laboratory

Discoveries unlock form records, species dossiers, encounter clues, and research-based starter options.



Hall of Fame

Display champion teams, unusual wins, rare forms, challenge completions, and personal records.



Training Center

Move research, starter mastery, training challenges, and non-combat cosmetic progression.



Contract Board

Rotating daily and weekly objectives, themed challenges, unusual party requirements, and special rewards.

Additional high-value systems:

* Legacy runs: a new campaign inherits a small, carefully balanced set of discoveries from a previous campaign.  
* Trainer mastery: unlock portraits, titles, dialogue, and alternate preparation options.  
* Starter mastery: record milestones for individual species, including victories, evolutions, boss defeats, and unusual forms.  
* Rival ghosts: recreate a saved rival's team and strategy in an optional challenge.  
* Collection goals: form families, regional dexes, shiny collections, and custom-form discoveries.  
* Campaign chronicle: a recap of major events, rival outcomes, nemesis encounters, and champion victories.

Keep permanent unlocks primarily horizontal: they should offer more choices, not make every future run trivially easy.

## **6\. The implementation roadmap I'd give Claude**

I would not simply append 100 features to the bottom of M8.75. I'd restructure the remaining work into clear release gates.

These are proposed milestones, not claims that the work has already been implemented.

## **M8.5**

Transformation mechanics

Implement Mega Evolution, Z-Moves, Tera, Dynamax, and relevant custom forms as separate, testable mechanics. Define compatibility and interaction rules before expanding their visual effects.

Exit gate: every enabled mechanic works correctly in battle, survives save/load, and has tested interactions.

## **M8.75**

Engine and systems completion

Finish the move-effect engine, abilities, held items, battle AI, friendship, research, contracts, challenges, events, and trainer unlocks. Partition the work into small independently testable packages.

Exit gate: no enabled species or move silently falls back to an incorrect or incomplete implementation.

## **M8.9**

Narrative systems

Add the shared event architecture, rivalry, nemeses, dynamic events, relationship tracking, and campaign consequences.

Exit gate: replayable seeds, deterministic decisions, valid event outcomes, and integration tests for connected systems.

## **M9**

Grand Region and complete campaign

Build the final roster, campaign climax, final boss, ending, animation player, music, and deployment.

Exit gate: the entire campaign can be completed from a clean save without developer intervention.

## **M9.5**

Spectacle pass

Improve boss cinematics, camera transitions, audio mixing, transformation effects, event staging, victory sequences, and regional storytelling.

Exit gate: presentation remains smooth, readable, accessible, and synchronized with actual battle outcomes.

## **M10**

Polish, performance, and release

Apply the shared visual identity, fix layout issues, optimize loading, validate save migration, balance the campaign, and test deployment.

Exit gate: production build, full regression suite, accessibility checks, performance budget, and release checklist all pass.

### **What about the other long-term systems?**

Your existing M8.75 section H contains a substantial collection of permanent progression features. I'd make those a separate M11: Legacy & Live Systems milestone, rather than risk delaying a complete playable campaign.

That milestone could include prestige, legacy records, the trainer network, a berry garden, permanent item collections, shared seeds, advanced research, and cosmetic hub upgrades.

Online multiplayer, cloud synchronization, and cross-device profiles should be separate projects with their own threat models and architecture decisions. They shouldn't be smuggled into a browser-only roguelike milestone.

## **7\. Push Claude to its limits with a better operating procedure**

The biggest improvement to your Claude workflow is to stop measuring progress by how many files Claude creates. Measure it by how much of the game works, how thoroughly it has been verified, and how much of the implementation is genuinely complete.

I'd give Claude the following permanent development contract.

# **CLAUDE DEVELOPMENT DIRECTIVE — POKÉMON ROGUELIKE**

## **Mission**

Act as the lead engineer, gameplay systems designer, technical artist, QA engineer, and build/release engineer for this project.

The objective is to deliver a complete, polished, deterministic, browser-based Pokémon roguelike with deep replayability, expressive battles, meaningful progression, and high-quality presentation.

Do not optimize for the number of features written. Optimize for a working, integrated, maintainable game.

## **1\. Establish the truth before changing code**

Before every milestone:

1. Read IMPLEMENTATION\_PLAN.md, GAME\_DESIGN.md, CHECKLIST.md, and relevant design decisions.  
2. Inspect the actual repository, git status, current branch, recent commits, and package scripts.  
3. Run the existing type check, unit tests, production build, and relevant browser tests.  
4. Verify which planned features are actually implemented and which are stubbed, partially implemented, disabled, or untested.  
5. Identify save compatibility risks, data migrations, architecture constraints, and dependencies.  
6. Produce a short implementation proposal with files affected, acceptance criteria, tests, and rollback considerations.

Never infer that a feature works merely because its milestone is marked complete.

## **2\. Work in vertical slices**

Implement one independently verifiable feature slice at a time.

Each slice must include:

* Core rules and validated data.  
* UI and presentation integration.  
* Save/load behavior where applicable.  
* Unit tests for normal, boundary, and failure cases.  
* Integration tests for connected systems.  
* Browser-level tests for player-facing workflows.  
* Documentation and checklist updates.  
* A clean, reviewable git diff.

Prefer small, reversible changes over large rewrites.

Do not start unrelated features until the current slice passes its acceptance criteria.

## **3\. Preserve the architecture**

* Core gameplay rules must remain independent of Phaser.  
* Use strict TypeScript and runtime validation for imported data.  
* Use named deterministic RNG streams.  
* Keep game outcomes independent of animation timing and UI state.  
* Use explicit commands, domain events, and validated effects for cross-system communication.  
* Keep all balance-sensitive values in centralized configuration or validated content data.  
* Use versioned save migrations and preserve existing player progress.  
* Never silently substitute placeholder behavior for a requested mechanic.

## **4\. Make content completeness measurable**

Maintain a machine-generated compatibility report for species, forms, moves, abilities, held items, evolutions, transformations, and battle mechanics.

Each entry must have an explicit implementation status, such as:

* Fully supported.  
* Supported with documented limitations.  
* Disabled pending implementation.  
* Invalid data.

Do not mark a feature complete based only on successful import or schema validation.

Every enabled move must have verified mechanical behavior, including accuracy, damage, secondary effects, target rules, and interactions where applicable.

Every enabled species must have valid usable moves and legal battle data.

## **5\. Design for spectacle without compromising correctness**

Use a presentation-command layer for animation, audio, camera effects, dialogue, and transitions.

A presentation failure must never corrupt the battle state.

Support configurable visual intensity, reduced motion, animation skipping, audio controls, and readable battle information.

Boss phases and transformation sequences must be triggered by authoritative game-state events. Animation playback must not decide whether an attack hits or whether a reward is granted.

## **6\. Enforce deterministic and reliable behavior**

* Identical initial state, seed, and actions must produce identical mechanical results.  
* Separate RNG streams by purpose.  
* Do not allow UI previews, hover states, asset loading, or animation playback to consume gameplay RNG.  
* Prevent duplicate rewards and duplicate event application.  
* Test saving and reloading at every meaningful checkpoint.  
* Validate imported saves and recover safely from malformed data.  
* Never silently discard an existing save during migration.

## **7\. Quality gates**

Before declaring a slice complete:

1. Run type checking.  
2. Run unit and integration tests.  
3. Run a production build.  
4. Run relevant Playwright workflows.  
5. Review browser console errors and failed network requests.  
6. Check the actual rendered UI at multiple viewport sizes.  
7. Inspect asset loading, missing files, and memory/performance regressions.  
8. Review the diff for unrelated changes and regressions.  
9. Update implementation documentation and known limitations.

Never claim a test passed unless it was actually run and its result inspected.

If a tool, browser, asset, or environment limitation prevents verification, state the limitation explicitly.

## **8\. Final report after every slice**

Report:

* What was implemented.  
* What the player can now do.  
* Files and systems changed.  
* Tests actually executed and their results.  
* Features still stubbed or incomplete.  
* Known bugs, risks, and design decisions requiring approval.  
* Exact commands to reproduce verification.  
* Recommended next slice.

Do not claim repository changes, commits, deployment, or successful tests without evidence.

## **Definition of success**

The final game must be completable, deterministic, mechanically coherent, visually polished, save-safe, and enjoyable to replay.

A large feature count is not a substitute for a finished game.

### **Three additional Claude techniques I'd use**

1\. Have Claude build its own quality dashboard.

Generate reports for unsupported moves, invalid species, missing assets, unreachable map nodes, duplicate boss teams, broken evolutions, incomplete translations, unused balance settings, and save migrations without tests.

The dashboard should report concrete counts and offending IDs, not just say "validation passed."

2\. Use specialized review passes.

After an implementation slice, have separate review passes inspect the same diff for:

* Gameplay correctness and edge cases.  
* Architecture and maintainability.  
* UI quality and visual hierarchy.  
* Determinism and save integrity.  
* Performance and asset-loading behavior.

These can be sequential roles in the same Claude session; they do not require multiple paid agents or extra API usage. The important part is independent review criteria, not the number of agents.

3\. Require proof of completion.

For every major feature, demand a short playable browser demonstration, test results, and a list of remaining limitations. A system that compiles but hasn't been exercised in the actual game is not finished.

## **8\. Don't let the content scale overwhelm the experience**

There are three particularly important risks in the current plan.

Balance explosion

Over 1,000 species, hundreds of custom forms, and hundreds of move effects create an enormous interaction surface. Build automated balance reports, battle simulations, and regression tests before trying to manually balance the whole Pokédex.

Save and performance pressure

Keep run history bounded, avoid loading every sprite and cry at startup, validate imported content, and test old saves against every migration. Your current lazy-loading approach should remain a core design rule.

Asset licensing

Your plan already flags the licensing implications of Pokémon assets and PokeRogue-derived material. Keep provenance and license records for every asset and dataset, and don't assume that a private repository automatically makes redistribution or public deployment permissible.

## **9\. The next concrete step**

I'd have Claude perform a post-M8 systems audit and M9 readiness assessment before it writes another large feature.

It should produce four artifacts:

1. `SYSTEMS_AUDIT.md` — actual implementation status of every planned system, with evidence and gaps.  
2. `FEATURE_INTERACTION_MATRIX.md` — how battle mechanics, events, progression, rivalries, forms, and saves interact.  
3. `IMPLEMENTATION_PLAN_ELECTRIC.md` — the revised milestone plan, dependency graph, acceptance criteria, and spectacle roadmap.  
4. `QUALITY_GATES.md` — automated checks that prevent incomplete content and regressions from reaching release.

Only after the audit should Claude choose the first implementation slice. Otherwise, you risk building an elaborate rivalry system on top of battle, save, or event behavior that isn't stable enough to support it.

My recommendation is to prioritize battle completeness → event architecture → rivalry and nemesis → cinematic boss encounters → final campaign → polish, with permanent progression and hub features developed in parallel only where dependencies allow.

The goal isn't to make Claude write the most code possible. It's to use Claude to build the game that would be difficult to create alone: one with thousands of content entries, dozens of interconnected systems, deterministic mechanics, a living campaign, and a presentation layer that makes every major moment feel earned.

















