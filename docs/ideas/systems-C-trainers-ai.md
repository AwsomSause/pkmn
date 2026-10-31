# Systems C: Player trainer systems, enemy trainers and AI (SYS-C01 to SYS-C65)

Legend as in file A. Existing code touched: `core/trainerEvolution.ts`, `core/trainerPerks.ts`, `core/trainerResearch.ts`, `core/trainerTiers.ts`, `core/archetypes.ts`, `core/playstyle.ts`, `core/profile.ts`, `core/battle` AI, `core/rivals/adapt.ts`, `core/rivals/tricks.ts`, `docs/status/aai-*.md`.

## C1. Player trainer identity and growth

**SYS-C01 Trainer Skill Tree Rebuilt as a Web** · O · C:L · P:High
Replace linear perk lists with a web where nodes link by theme (Scout, Tamer, Duelist, Mystic, Merchant); adjacent nodes get a synergy bonus. Player sees a constellation screen. Deps: trainerPerks, mastery. Impact: replaces flat perk choice. Balance: synergy ≤+10% over lone nodes.

**SYS-C02 Trainer Classes With Real Verbs** · E · C:L · P:High
Classes grant new actions: Scout reveals node contents, Tamer calms wild mons, Duelist reads enemy movesets, Mystic trades luck. Each action costs a per-battle "Resolve". Deps: trainer identity. Impact: classes change decisions. Balance: Resolve 2 per battle.

**SYS-C03 Resolve Resource** · N · C:M · P:High ★F
A small trainer-side resource (Resolve) that fuels trainer actions, regenerates on wins, and is spent by calling plays. It unifies items-in-battle, commands and class abilities. Deps: battle UI. Impact: gives the trainer presence in fights. Balance: starts at 3, caps 6.

**SYS-C04 Calling Plays** · N · C:M · P:Med
Preset team tactics (Focus Fire, Cover the Weak, Rush) cost Resolve and adjust AI-less mons' priorities. Deps: C03, doubles. Impact: orchestrating. Balance: lasts 2 turns.

**SYS-C05 Trainer Stamina and Health** · X · C:M · P:Exp
The trainer can be hurt by wild attacks and rival tricks; low health disables actions. Deps: C03. Impact: stakes. Balance: toggle.

**SYS-C06 Trainer Backstory Picker** · N · C:M · P:Med
Pick an origin (Orphan, Ranger's Child, Gym Dropout) at run start: tiny perk plus tailored dialogue and recurring character hooks. Deps: B31, dialogue. Impact: replay variety. Balance: mild perks.

**SYS-C07 Trainer Quirks** · N · C:S · P:Low
Like mon quirks: phobias, habits, lucky items. NPCs notice them. Deps: dialogue. Impact: personality. Balance: small.

**SYS-C08 Trainer Aptitudes Radar** · N · C:M · P:Med
Hidden aptitudes (Catching, Breeding, Bartering, Tactics, Mysticism) grow with use; thresholds unlock options. Deps: playstyle. Impact: play-derived growth. Balance: soft caps.

**SYS-C09 Training Regimens** · N · C:M · P:Med
Between regions the trainer picks a regimen (Marathon, Library, Dojo) raising specific aptitudes. Deps: C08. Impact: planning. Balance: opportunity cost of time.

**SYS-C10 Trainer Signature Move** · N · C:L · P:Med
One signature trainer ability (a once-per-battle "Trainer Strike") earned by mastery. Deps: mastery. Impact: spectacle. Balance: cooldown.

**SYS-C11 Trainer Aging** · X · C:M · P:Exp
Across a long campaign the trainer visibly ages and gains wisdom/fatigue tradeoffs. Deps: campaign. Impact: time passing. Balance: tradeoffs even.

**SYS-C12 Trainer Equipment Loadout** · N · C:M · P:Med
Slots: Cap, Bag, Boots, Charm. Items trade between utility and flavor (Boots reduce hazard damage). Deps: items. Impact: build identity. Balance: ≤5%.

**SYS-C13 Wardrobe Perks** · E · C:S · P:Low
`wardrobe.ts` outfits gain small situational perks (Rain Coat vs rain events). Deps: wardrobe. Impact: cosmetics matter. Balance: ≤3%.

**SYS-C14 Trainer Card as Living Document** · E · C:M · P:Med
The trainer card updates with stamps, scars, notes and notable people; shareable image. Deps: profile. Impact: identity. Balance: none.

**SYS-C15 Alt Identities / Aliases** · N · C:M · P:Rare
Use an alias for a run; NPCs treat you as a stranger until your deeds reveal you. Deps: B32. Impact: fresh start flavor. Balance: ledger split.

## C2. Trainer actions in the world

**SYS-C16 Scouting Verb** · N · C:M · P:High
Spend Resolve to scout the next fork: reveal encounter type or trap. Deps: map, C03. Impact: planning. Balance: reveals only category.

**SYS-C17 Bargaining Verb** · N · C:M · P:Med
Haggle at shops via aptitude check with risk. Deps: C08, shops. Impact: social play. Balance: failure raises prices temporarily.

**SYS-C18 Diplomacy Verb** · N · C:M · P:Med
Avoid some fights by talking, with fail states. Deps: reputation. Impact: alternative route. Balance: reward smaller than winning.

**SYS-C19 Survival Verb** · N · C:S · P:Low
Forage at Camps for berries and clues, with aptitude. Deps: Camp. Impact: resource. Balance: capped.

**SYS-C20 Disguise Verb** · N · C:M · P:Low
Wear disguises to sneak past faction nodes. Deps: factions. Impact: stealth. Balance: costs item.

**SYS-C21 Rite and Prayer Verb** · N · C:S · P:Low
Shrines accept offerings for luck tweaks; trainers with Mystic aptitude get better odds. Deps: events. Impact: variety. Balance: small.

**SYS-C22 First Aid Verb** · N · C:S · P:Med
Trainers heal small HP between fights with a skill and cooldown. Deps: C03. Impact: attrition control. Balance: ≤10% HP.

**SYS-C23 Training Montage Verb** · N · C:M · P:Low
Short minigame turned into EXP on the active mon. Deps: minigames. Impact: grind alternative. Balance: modest.

**SYS-C24 Tame Verb for Wild Fights** · N · C:M · P:High
Special "Calm" option in wild encounters: win by empathy, not damage, if bond and species fit. Deps: capture. Impact: non-violent route. Balance: gives capture bonus not a guarantee.

**SYS-C25 Field Notes Verb** · E · C:S · P:Low
Extends research notes: write observations that unlock hints about species. Deps: researchNotes. Impact: learning. Balance: none.

## C3. Enemy trainer intelligence and behavior

**SYS-C26 Trainer Personalities for AI ★F** · E · C:L · P:Ess
Each enemy trainer gets a personality vector (Cautious, Reckless, Showboat, Tactician, Sadist) that sets AI weights: switching, healing, setup, prediction. Deps: `core/battle` AI, aai-*. Impact: fights feel authored. Balance: bounded weights; difficulty slider scales.

**SYS-C27 Opponent Memory Within a Run** · E · C:M · P:High
Trainers remember your tricks (a Fire-heavy party gets Water counters later). Deps: rivals/adapt. Impact: dynamic opposition. Balance: modest.

**SYS-C28 Tells and Bluffs** · N · C:M · P:Med
Trainers give readable tells (taunts, stalling) and sometimes bluff; a Duelist aptitude lets you read them. Deps: C26. Impact: mind games. Balance: bluffs limited.

**SYS-C29 Prediction Engine With Fairness** · E · C:L · P:Med
AI predicts your switch with a probability model that never uses hidden info beyond what a human could infer. Deps: aai-prediction. Impact: smarter opponents. Balance: tuneable.

**SYS-C30 Mind Games Options** · N · C:M · P:Med
Player can fake out AI via "bait" actions with Resolve. Deps: C03. Impact: strategic depth. Balance: costly.

**SYS-C31 Teamwork AI in Doubles** · E · C:L · P:High
Enemy pairs coordinate (protect partner, set combos). Deps: doubles AI. Impact: harder doubles. Balance: caps.

**SYS-C32 Fatigue and Morale AI** · N · C:M · P:Low
Enemies tire across a gauntlet; their choices degrade late. Deps: Gauntlet. Impact: pacing. Balance: ≤5%.

**SYS-C33 Item-Use Strategies per Trainer** · E · C:M · P:Med
Trainers have preferred item timing (panic heal, preemptive buff). Deps: AI. Impact: variety. Balance: item counts bounded.

**SYS-C34 Trainer Prep Phase** · N · C:M · P:Med
Before a fight, trainers can set up (field effects, hazards) based on personality; you see it in their intro. Deps: field effects. Impact: pre-battle texture. Balance: small.

**SYS-C35 Trainer Retreat/Forfeit Logic** · N · C:M · P:Low
Unwinnable battles end with a forfeit after a morale check, rewarding speed. Deps: rewards. Impact: pacing. Balance: lower rewards.

**SYS-C36 Trainer Counter-Build Generator** · N · C:L · P:High
Generates enemy teams that deliberately counter your last 3 parties (never your exact party). Deps: encounter director. Impact: anti-stagnation. Balance: fuzz so not perfectly countered.

**SYS-C37 Trainer Career Records** · N · C:M · P:Med
Every named trainer has a record (wins, signature Pokémon, rivals) that persists and appears on a card. Deps: B31. Impact: living world. Balance: none.

**SYS-C38 Trainer Pride Moves** · N · C:M · P:Med
Each major trainer has one signature action (flair) with unique animation and mechanical effect. Deps: drama engine. Impact: memorable fights. Balance: telegraphed.

**SYS-C39 Pokémon-Trainer Pairing Logic** · N · C:M · P:Med
Enemy teams built around coherent themes and stories (Hiker with sturdy mons that evolved over trade). Deps: trainer data. Impact: authored feel. Balance: validated by content gate.

**SYS-C40 Learning Opponents (Rival Adapt Extension)** · E · C:L · P:Med
Extends `rivals/adapt` to non-rival named trainers via a limited-memory model. Deps: C27. Impact: more adaptive. Balance: caps.

## C4. AI systems, difficulty and assistance

**SYS-C41 Difficulty Personas** · E · C:M · P:High
Named difficulty personas (Friendly Coach, Stern Judge, Cruel Prodigy) change AI weights, shop stingy-ness and text tone together. Deps: difficulty settings. Impact: richer difficulty. Balance: persona sheets validated.

**SYS-C42 Dynamic Difficulty with Transparency** · N · C:M · P:High
A visible "heat" meter explains adaptive changes; players can freeze it. Deps: encounterDirector. Impact: trust. Balance: freeze reduces score multiplier.

**SYS-C43 Coach Mode Hints** · N · C:M · P:Med
Optional hints from a coach NPC based on the AI's evaluation (not spoilers). Deps: AI eval. Impact: onboarding. Balance: hint counts.

**SYS-C44 Replay Review AI** · N · C:L · P:Med
After losses, an AI reviews the battle log, pointing out two critical decisions. Deps: battle log. Impact: learning. Balance: none.

**SYS-C45 Opponent Scouting Report** · N · C:M · P:Med
Collected intel on a named trainer (seen mons, habits) shown before the fight. Deps: C37. Impact: planning. Balance: partial info.

**SYS-C46 Training Dummy AI Profiles** · N · C:S · P:Low
Hub dummies emulate known trainers' AI for practice. Deps: Hub sandbox. Impact: practice. Balance: none.

**SYS-C47 AI Sandbox Tuning Screen** · N · C:M · P:Low
Dev/advanced screen to tweak AI weights and run sims. Deps: playtest bot. Impact: tooling. Balance: dev only.

**SYS-C48 AI Explainability Log** · N · C:M · P:Low
Optional "why did it do that" log for opponents. Deps: AI. Impact: transparency. Balance: spoilery; hidden by default.

**SYS-C49 Boss Phase Directors** · E · C:L · P:High
Boss phases controlled by a small director script (reads player state, selects mood phase, fires dialogue). Deps: boss phases. Impact: dramatic arcs. Balance: bounded.

**SYS-C50 Adaptive Boss Hints** · N · C:S · P:Low
After two losses to the same boss, in-fight hints become available. Deps: bossRematch. Impact: fairness. Balance: score penalty.

## C5. Gauntlets, gyms and organized play

**SYS-C51 Gym Leaders With Rules** · E · C:M · P:High
Each leader enforces a unique rule set (no switching, field themes, handicap) on top of type specialties. Deps: gyms. Impact: each gym is a puzzle. Balance: rules published.

**SYS-C52 Gym Challenges Before the Leader** · N · C:M · P:Med
A short challenge (puzzle, obstacle) before the leader matches their theme and yields a boon. Deps: minigames. Impact: variety. Balance: optional.

**SYS-C53 League Season Structure** · N · C:L · P:Med
Seasonal League with standings and rival trainers' win-loss records. Deps: timeline. Impact: macro progress. Balance: soft.

**SYS-C54 Trainer Schools/Academies** · N · C:M · P:Low
Hub academy teaches aptitudes with homework. Deps: C08. Impact: persistent training. Balance: slow.

**SYS-C55 Elite Four Order by Reputation** · E · C:M · P:Low
Order and boons change by player reputation. Deps: B47. Impact: replay. Balance: fair.

**SYS-C56 Champion Titles Cycle** · E · C:M · P:Med
The champion changes over meta runs (a rival may hold the title). Deps: timeline. Impact: living league. Balance: no lock.

**SYS-C57 Specialist Trainer Guilds** · N · C:M · P:Low
Guilds of Bug/Rock/Ghost specialists host exhibition fights. Deps: factions. Impact: type fantasy. Balance: optional.

**SYS-C58 Trainer Exchange Program** · N · C:M · P:Low
Borrow an enemy trainer's Pokémon for a node and return it with a gift. Deps: B31. Impact: novelty. Balance: cannot keep.

**SYS-C59 Coach Companion Slot** · E · C:M · P:Med
Companion NPC provides a passive that evolves with their bond. Deps: B41. Impact: sense of team. Balance: capped.

**SYS-C60 Referee/Commentator System** · N · C:M · P:Med
Commentator reacts to battles with dynamic commentary (uses drama engine). Deps: presentation cues. Impact: spectacle. Balance: toggle.

**SYS-C61 Judge Scores for Style** · N · C:M · P:Low
Judges rate a battle's style (variety, comebacks) for bonus rewards. Deps: recap. Impact: play-style rewards. Balance: small.

**SYS-C62 Trainer Exams** · N · C:M · P:Low
Certification tests with hard rules unlock hub perks. Deps: unlocks. Impact: goals. Balance: optional.

**SYS-C63 Mock Battles / Spars** · N · C:M · P:Low
Non-lethal fights with allies/rivals for minor EXP and bonds. Deps: B01. Impact: bonding. Balance: low reward.

**SYS-C64 Underground Fight Clubs** · N · C:M · P:Rare
Hidden venues with odd rules and big rewards; reputation required. Deps: B47. Impact: secrets. Balance: risky.

**SYS-C65 Trainer Legacies** · L · C:M · P:Med
Great trainers (including you) leave "styles" that future trainers copy with variants. Deps: legacy. Impact: world memory. Balance: flavor.
