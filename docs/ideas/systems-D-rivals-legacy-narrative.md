# Systems D: Rivals, nemeses, legacy, run history and narrative frameworks (SYS-D01 to SYS-D65)

Legend as in file A. Already shipped and extended here: Living Rival (`core/rivals/*`), Nemesis (`core/story/nemesis.ts`), Legacy (`core/legacy.ts`, `core/story/legacy.ts`, `legacyRuns.ts`), False Protagonist replays, timeline (`core/timeline`), chronicle (`rivals/chronicle.ts`), moment codex, hall of fame, storybook, endings (`ending.ts`).

## D1. Rival and nemesis frameworks

**SYS-D01 Rival Roster Pool ★F** · E · C:L · P:Ess
Instead of one rival, keep a pool of 6 to 10 persistent rivals with styles, flaws and arcs; each run draws 1-3 as active. Others live in the world and may be allies. Deps: rivals manager, B31. Impact: richer cast, more replays. Balance: each rival has one signature gimmick.

**SYS-D02 Rival Doctrine Evolution** · E · C:M · P:High
A rival adopts a doctrine (Speed, Stall, Weather, Gimmick) and shifts based on what beat them; the doctrine is shown on their card. Deps: rivals/adapt. Impact: arcs that react. Balance: doctrine changes ≤1 per region.

**SYS-D03 Rival Falls From Grace** · N · C:M · P:Med
Rival suffers public humiliation, loses sponsors, and returns changed (harder, kinder or bitter). Deps: living rival. Impact: dramatic arc. Balance: new team stats bounded.

**SYS-D04 Rival Redemption Quests** · N · C:M · P:Med
Multi-stage tasks to bring a bitter rival back (shared fights, gifts). Deps: B59. Impact: alternative to nemesis. Balance: payoff meaningful.

**SYS-D05 Rival Mentors the Player** · N · C:M · P:Low
Rarely a rival teaches a technique after a decisive win; a gift with their personality. Deps: rival bonds. Impact: variety. Balance: one move.

**SYS-D06 Rival Teams Share a World** · L · C:L · P:Med
Rivals fight each other offscreen with results printed in the Newspaper; standings shape the final tournament. Deps: world sim, timeline. Impact: living league. Balance: seeded determinism.

**SYS-D07 Rival Coup / Takeover** · X · C:M · P:Exp
A rival replaces a gym leader or champion mid-run (visible shift of the world). Deps: gyms. Impact: shock. Balance: replacement team stats equal.

**SYS-D08 Rival Siblings / Duos** · N · C:M · P:Low
Rivals come as pairs requiring doubles tactics. Deps: doubles. Impact: variety. Balance: stats shared.

**SYS-D09 Rival Weakness Dossier** · N · C:S · P:Low
A growing dossier of what works against a rival (visible after several fights). Deps: chronicle. Impact: reward for study. Balance: none.

**SYS-D10 Rival Backstories as Playable Legacies** · L · C:L · P:Med
Complete a rival's arc to unlock a short playable "rival's run" mode with their team and viewpoint. Deps: false protagonist. Impact: perspective switch. Balance: separate score.

**SYS-D11 Nemesis Raids** · E · C:L · P:Med
Raised in STATUS limits: a nemesis can anchor a raid with bound minions and an arc. Deps: raid, nemesis. Impact: spectacle. Balance: scheduled rarely.

**SYS-D12 Nemesis Dynasties** · E · C:L · P:Med
A defeated nemesis's apprentice returns with a vendetta that inherits their moves. Deps: nemesis, legacy. Impact: multi-run grudges. Balance: capped chain length.

**SYS-D13 Nemesis Truces and Betrayals** · N · C:M · P:Low
A nemesis may help against a bigger threat and betray later. Deps: B58. Impact: tension. Balance: telegraphed.

**SYS-D14 Nemesis Shrine** · N · C:S · P:Low
Hub display listing defeated nemeses with their final lines and trophies. Deps: Hub. Impact: legacy. Balance: none.

**SYS-D15 Spare or Slay Choice** · N · C:M · P:Med
After a nemesis defeat, choose mercy (ally later, weaker reward) or finality (reward now). Deps: nemesis (STATUS notes no spare cause yet). Impact: moral choice. Balance: both viable.

**SYS-D16 Rival Fan/Hater Camps** · L · C:S · P:Low
NPCs split into pro/anti rival groups, influencing small things. Deps: B57. Impact: worldbuilding. Balance: none.

**SYS-D17 Rival Wedding/Retirement** · X · C:M · P:Rare
Late arcs for rivals: retire, marry, mentor, vanish, with ceremonies. Deps: timeline. Impact: closure. Balance: none.

**SYS-D18 Time-Lost Rival** · X · C:M · P:Rare
A rival from "another timeline" (a past run version) appears with a mismatched memory. Deps: timeline replays. Impact: eerie. Balance: unique encounter.

**SYS-D19 Rival Counter-Legacy** · N · C:M · P:Med
Each rival builds a legacy of their own; at meta-victory you see their museum hall. Deps: legacy. Impact: parity. Balance: none.

**SYS-D20 Rival Voting** · N · C:S · P:Low
The player votes on which rival emerges next; weighted by past fights. Deps: D01. Impact: player agency. Balance: none.

## D2. Legacy and run history

**SYS-D21 Run Genome ★F** · N · C:L · P:Ess
Every run saves a compact "genome" (key choices, party arc, rivals met, events, causes of death) used to seed reactive content: ghosts, dreams, dialogue, achievements. Stored in profile with schema versioning. Deps: legacyRuns, recap. Impact: unlocks "references previous runs" ideas. Balance: storage capped by pruning.

**SYS-D22 Ancestor Pokémon** · E · C:M · P:High
Pokémon from retired runs become "ancestors" whose eggs, items and echoes appear in later runs. Deps: Legacy, eggs. Impact: generational play. Balance: tier caps.

**SYS-D23 Heirlooms** · N · C:M · P:High
Items that carry across runs with lore built from your use. Deps: items. Impact: attachment. Balance: only one per run.

**SYS-D24 Run Epitaphs** · N · C:S · P:Med
Each run ends with an epitaph generated from the genome; displayed at the Hub graveyard. Deps: D21. Impact: story. Balance: none.

**SYS-D25 Rival Reads Your Previous Runs** · L · C:M · P:Med
Rivals' tactics are shaped by the last few runs (their adapt state persists). Deps: rival adapt. Impact: accumulation. Balance: capped.

**SYS-D26 Ghost Parties** · E · C:M · P:Med
Past parties show up as ghost rivals; defeating them yields small bonuses. Deps: legacy runs. Impact: meta challenge. Balance: opt-in.

**SYS-D27 Memorial Hall** · N · C:M · P:Med
Hub hall listing fallen Pokémon with epitaph lines. Deps: A65. Impact: emotional. Balance: none.

**SYS-D28 Dynasty Mode** · X · C:XL · P:Exp
A multi-run mode where each run's trainer is a descendant of the previous; legacies shape stats. Deps: D21, D22. Impact: saga. Balance: tuned.

**SYS-D29 Time Capsule Runs** · N · C:M · P:Low
Seal a message and item for future runs to find. Deps: events. Impact: personal. Balance: item caps.

**SYS-D30 Retrospective Editing** · N · C:S · P:Low
Annotate past runs with notes and photos in the chronicle. Deps: chronicle. Impact: player expression. Balance: none.

**SYS-D31 Echoes of Failure** · N · C:M · P:Med
A wipe leaves an "echo" at that node in future runs that shifts the encounter. Deps: wipe handling. Impact: consequence. Balance: easy to clear.

**SYS-D32 Legacy Titles Grid** · E · C:S · P:Low
Titles appear on a grid showing connections and hidden combos. Deps: titles. Impact: discovery. Balance: none.

**SYS-D33 Seasonal Run Reviews** · N · C:S · P:Low
Quarterly summaries of play with stats and highlights. Deps: stats. Impact: nostalgia. Balance: none.

**SYS-D34 Family Heirloom Bloodlines** · N · C:L · P:Low
Mons carry a bloodline tag affecting egg moves/nature inheritance. Deps: eggs. Impact: breeding depth. Balance: bounded.

**SYS-D35 Inherited Debts** · N · C:M · P:Low
Past runs' unpaid favors or debts reappear. Deps: B50. Impact: consequences. Balance: forgivable.

**SYS-D36 Cross-Run Rumors** · N · C:M · P:Low
NPC rumors about "a legendary trainer" reference your best prior run. Deps: D21, B46. Impact: legend feel. Balance: none.

**SYS-D37 Hall of Fame Sculptures** · N · C:M · P:Low
Winning parties become Hub statues that visitors comment on. Deps: Hub. Impact: visible progress. Balance: none.

**SYS-D38 Reverse Legacy** · X · C:M · P:Exp
Start a run as a descendant forced to undo a prior run's decision. Deps: D21. Impact: story engine. Balance: scripted.

**SYS-D39 Past-Run Alibis** · N · C:S · P:Rare
Characters accuse you of crimes from a past run; investigations resolve it. Deps: D21. Impact: odd drama. Balance: reward small.

**SYS-D40 Epoch Resets** · X · C:L · P:Exp
After 100 runs the world "ages": a new era with changed rules, retained history. Deps: timeline. Impact: long-term freshness. Balance: carefully previewed.

## D3. Narrative progression frameworks

**SYS-D41 Narrative Director ★F** · N · C:XL · P:Ess
A seeded director chooses which story beats to schedule per run from a pool of arcs, balancing pacing (calm/tense), recurring cast and unresolved threads. Deps: events, B31, D21. Impact: every run gets an arc. Balance: pacing params.

**SYS-D42 Arc Library** · N · C:L · P:High
Modular multi-node arcs (Missing Mon, Heist, Haunting) with entry conditions and outcomes. Deps: D41. Impact: reusable stories. Balance: authoring guidelines.

**SYS-D43 Thread Tracker** · N · C:M · P:High
Unresolved narrative threads display in the journal; reminders push closure. Deps: D41. Impact: clarity. Balance: none.

**SYS-D44 Foreshadowing Planner** · N · C:M · P:Med
The director seeds omens (a feather, a graffito) that pay off later. Deps: events. Impact: perceived design. Balance: payoff guaranteed.

**SYS-D45 Themed Runs** · N · C:M · P:Med
Runs start with a theme (Revenge, Discovery, Redemption) that biases arcs and endings. Deps: D41. Impact: replay variety. Balance: weighted.

**SYS-D46 Multiple Endings Matrix** · E · C:L · P:Med
Endings derived from bonds, vows, rivals, themes. Deps: ending.ts. Impact: payoff. Balance: all reachable.

**SYS-D47 Secret Ending Tracker** · N · C:M · P:Low
Journal hints at hidden endings without spoiling. Deps: D46. Impact: curiosity. Balance: clues.

**SYS-D48 Narrator Voices** · N · C:M · P:Low
Selectable narrator tones (Epic, Deadpan, Documentary) affecting text. Deps: dialogue. Impact: tone. Balance: none.

**SYS-D49 Story Chapters** · N · C:M · P:Low
Runs have chapter headings and recap cards. Deps: recap. Impact: structure. Balance: none.

**SYS-D50 Branching Consequence Ledger** · E · C:M · P:Med
Visible consequences list of past choices; "what you changed" overlay. Deps: ledger. Impact: clarity. Balance: none.

**SYS-D51 Villain Campaigns** · N · C:L · P:Med
Faction villains plan across runs, with progress meters you can slow. Deps: world events. Impact: stakes. Balance: pause options.

**SYS-D52 Legendary Lore Quests Chain** · N · C:L · P:Med
Multi-run quest chains toward encountering legendaries. Deps: quests. Impact: aspirational. Balance: long.

**SYS-D53 Dream Sequences** · N · C:M · P:Low
Narrative interludes in dreams giving lore and a small buff. Deps: A46. Impact: tone. Balance: none.

**SYS-D54 Interlude Chapters Between Regions** · N · C:M · P:Med
Short cinematic or text chapters between regions summarizing rivals' progress. Deps: timeline. Impact: pacing. Balance: skippable.

**SYS-D55 Unreliable Narrator Mode** · X · C:M · P:Exp
The game occasionally lies in text, later corrected by event; flagged by an achievement. Deps: dialogue. Impact: meta delight. Balance: opt-in.

**SYS-D56 Story Seeds Share** · N · C:M · P:Low
Share a run's story seed so others replay the same narrative arcs. Deps: seed code. Impact: community. Balance: none.

**SYS-D57 Prologue/Epilogue Generators** · N · C:M · P:Low
Procedural run prologue and epilogue texts from the genome. Deps: D21. Impact: bookends. Balance: none.

**SYS-D58 Player Journal Entries** · N · C:M · P:Low
The trainer writes diary lines unlocking small perks. Deps: journal. Impact: voice. Balance: none.

**SYS-D59 Lore Fragments Collection** · N · C:M · P:Med
Collectible lore fragments scattered across runs revealing a metaplot. Deps: collection. Impact: mystery. Balance: no gating.

**SYS-D60 Metaplot Reveal Stages** · X · C:XL · P:Exp
The game's overall mystery reveals in stages across hundreds of hours. Deps: D59. Impact: long-term hook. Balance: no hard gate.

**SYS-D61 Cutscene Rulebook** · N · C:S · P:Med
Cutscenes must follow rules (skippable, short, replayable from codex). Deps: presentation. Impact: pacing. Balance: none.

**SYS-D62 Story Modifiers** · N · C:M · P:Low
Run modifiers that alter narrative (No Rival, Rival Always, All Legendary). Deps: run rules. Impact: variety. Balance: scoring flagged.

**SYS-D63 Epilogue Cards for Characters** · N · C:S · P:Low
Final screens show fates of recurring characters. Deps: B31. Impact: closure. Balance: none.

**SYS-D64 Collaborative Authors Mode** · X · C:L · P:Exp
Players edit story arcs via data packs shared as seeds. Deps: config packs. Impact: community. Balance: validated.

**SYS-D65 Anniversary Retrospective Engine** · N · C:M · P:Rare
After many hours, a generated documentary of your journey. Deps: D21. Impact: emotional capstone. Balance: none.
