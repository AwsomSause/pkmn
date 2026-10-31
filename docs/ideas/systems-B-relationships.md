# Systems B: Relationships, chemistry, party social life and recurring characters (SYS-B01 to SYS-B65)

Legend as in file A (Class N/E/O/L/X, C = S/M/L/XL, P = Ess/High/Med/Low/Exp/Rare, ★F = foundation). Existing code touched: `core/bond`, `core/story/chemistry.ts`, `core/relationships.ts`, `core/friendship.ts`, `core/partyLife`, `core/story/mentorship.ts`, `core/story/promises.ts`, `core/story/reunion.ts`, `core/rivals/bonds.ts`, `core/memories`.

## B1. Chemistry and bond frameworks

**SYS-B01 Relationship Graph ★F** · O · C:L · P:Ess
Replace scattered pairwise numbers with one party graph: nodes are Pokémon, trainer, rival and key NPCs; edges carry typed values (trust, rivalry, affection, fear, respect, envy) plus a short history list. Every dialogue, event and battle hook reads the same graph. Player sees a "Web" screen with lines of different colors. Deps: chemistry, bond, rival bonds, memories; save migration folds existing values in. Impact: single source of truth; removes duplicated numbers. Balance: edge values clamp ±100; caps per edge type.

**SYS-B02 Edge Types Beyond Friendship** · E · C:M · P:High
Add distinct edge types: Respect (earned by wins together), Envy, Debt (owed a rescue), Mentorship, Protectiveness, Fascination. Each type has its own battle/dialogue effect. Deps: B01. Impact: relationships stop being one-dimensional. Balance: effects capped and shown in tooltips.

**SYS-B03 Chemistry Archetypes** · N · C:M · P:Med
Pairs are classified into labeled archetypes (Rival Siblings, Odd Couple, Mentor-Protégé, Comic Duo, Quiet Pair) once enough history accumulates. The label unlocks a pack of lines and a small passive. Deps: B01, dialogue packs. Impact: readable shorthand for the story. Balance: passives are +2% to a niche situation.

**SYS-B04 Chemistry Compatibility Preview** · N · C:S · P:Med
Before adding a catch, a small hint shows how they might get along with party members (a heart/spark icon). Deps: B01, disposition. Impact: strategy plus personality. Balance: preview is honest to 80%.

**SYS-B05 Relationship Decay and Maintenance** · N · C:M · P:Med
Bonds weaken without shared fights or care; maintenance happens through rest stops. Deps: B01, Camps. Impact: stops static min-maxing. Balance: decay floors at neutral; deaths never zero a bond.

**SYS-B06 Multi-Party Dynamics** · N · C:M · P:Med
Triads and groups: three-way chemistry gives group labels (Trio, Found Family) with team-wide mood. Deps: B01. Impact: bigger social structure. Balance: group buffs ≤3%.

**SYS-B07 Love and Romance (platonic and otherwise) Frameworks** · X · C:M · P:Exp
A non-explicit "pair-bond" for species with courtship behavior; high pair-bond lets two Pokémon share an egg moment and special dialogue. Deps: eggs, B01. Impact: charming. Balance: neutral to power.

**SYS-B08 Rival Mons** · N · C:M · P:Med
Two party members can develop a competitive rivalry that boosts both when one outperforms; a "scorecard" tracks head-to-head KOs. Deps: B01, battle stats. Impact: friendly competition in the team. Balance: gain only to the loser after a defeat.

**SYS-B09 Betrayal Possibility** · X · C:M · P:Exp
A low-trust Pokémon can leave at a Camp (taking a keepsake) if neglected; returns as a wild or rival's Pokémon. Deps: B01, rivals. Impact: stakes for care. Balance: always telegraphed 3 events earlier.

**SYS-B10 Forgiveness Mechanic** · N · C:S · P:Low
After conflicts, apology items and heartfelt choices can restore edges; time alone heals half. Deps: B01. Impact: relief valve. Balance: items rare.

**SYS-B11 Jealousy Triangles** · N · C:M · P:Low
When a new catch outshines an old favorite, a tension event fires; the player picks how to handle it. Deps: B01, usage stats. Impact: drama. Balance: choices permanent but mild.

**SYS-B12 Found Family Milestone** · N · C:M · P:Med
After a long run together a party earns the "Found Family" milestone: shared aura buff, a group photo, a Hub frame. Deps: Hub photo, B03. Impact: reward for staying together. Balance: buff small (+2% to all).

**SYS-B13 Pokémon Friendships Across Teams** · N · C:M · P:Low
Wild mons or enemy mons occasionally befriend a party member, leaving a mark that spares you from a future fight or gives an assist. Deps: encounters, B01. Impact: connectivity. Balance: spare once per region.

**SYS-B14 Cross-Run Friendship** · L · C:L · P:High
A box Pokémon remembers friends from previous runs; reuniting them (same party) triggers a Reunion event using `story/reunion.ts`. Deps: Legacy, B01. Impact: continuity. Balance: bonus only if they were bonded.

**SYS-B15 Heart-to-Heart Scenes** · N · C:M · P:High
Triggered by high edges at Camps: short branching scenes between two party members (choose a topic from the player). Deps: dialogue, B01. Impact: story engine. Balance: results are edge changes.

## B2. Social structures within a run

**SYS-B16 Party Meetings** · N · C:M · P:Med
At each region boundary the party holds a meeting; each member states a mood and a want. Responses raise trust. Deps: A01, regions. Impact: pacing beat. Balance: none.

**SYS-B17 Camp Fire Chats** · N · C:M · P:High
At Camps a random pair converses by chemistry; the player may "listen in" for a hint, a joke or a clue. Deps: dialogue packs. Impact: world-building delivery. Balance: hint tier low.

**SYS-B18 Party Rituals** · N · C:S · P:Low
The party picks a pre-boss ritual (cheer, silent prayer, group stretch) that gives a tiny buff and evolves over time. Deps: boss intro. Impact: ownership. Balance: ≤2%.

**SYS-B19 Party Roles Reworked** · E · C:M · P:Med
Extends `partyRoles.ts` to include social roles (Joker, Anchor, Mediator, Scout) that matter in events and chemistry resolutions. Deps: partyRoles. Impact: more than battle roles. Balance: role changes are cheap.

**SYS-B20 Disagreement Resolution Mini-Choices** · N · C:M · P:Med
When two members clash the player chooses a style (mediate, side with one, ignore). Each option shapes B01 edges. Deps: events. Impact: leadership expression. Balance: ignoring has a small cost.

**SYS-B21 Shared Memories Album** · E · C:M · P:Med
Pairs and groups build albums from memory events; open in the Hub as a scrapbook. Deps: `memories`, Hub. Impact: tangible output. Balance: none.

**SYS-B22 Group Photo Moments** · N · C:S · P:Low
Triggered at milestones; a little screenshot-like card with all mons posing by relationship. Deps: photo mode. Impact: shareable. Balance: none.

**SYS-B23 Pair Moves** · N · C:L · P:High
Bonded duos unlock a pair move (two attackers resolve a single combined attack) usable once per battle. Deps: B01, doubles. Impact: signature cooperation. Balance: usage once per battle, cooldown across.

**SYS-B24 Team Name and Banner** · N · C:S · P:Low
The party names itself, picks a banner; NPCs and rivals address you by it. Deps: trainer identity. Impact: ownership. Balance: none.

**SYS-B25 Culture Clashes** · N · C:M · P:Low
Region-born mons have preferences that clash with other regions (spicy vs bitter). Deps: A11, regions. Impact: fun friction. Balance: moods.

**SYS-B26 Mentor Chains** · E · C:M · P:Med
Chains of mentors: your veteran mentors a mid-levelled mon who mentors a newcomer, with passive inherited tips. Deps: mentorship. Impact: roster flow. Balance: diminishing returns.

**SYS-B27 Heroes and Sidekicks Pair** · N · C:S · P:Low
Identifies a Hero (most KOs) and Sidekick (most assists); lines are written accordingly. Deps: stats. Impact: story framing. Balance: none.

**SYS-B28 Last Meal Rule** · N · C:S · P:Low
Before a boss, the party shares a meal; cooking quality sets tiny buffs. Deps: crafting, B18. Impact: ritual. Balance: ≤2%.

**SYS-B29 Birthday and Anniversary Markers** · N · C:S · P:Rare
Each mon has a catch date; on anniversaries (real-world day) the Hub has a small gift event. Deps: save timestamps. Impact: surprise. Balance: gift cosmetic.

**SYS-B30 Group Mood Contagion** · N · C:M · P:Med
Moods spread across edges with strength by trust; one panic can cascade, one cheer lifts all. Deps: A05, B01. Impact: emergent group states. Balance: contagion capped.

## B3. Recurring characters and NPC relationships

**SYS-B31 Recurring Cast Registry ★F** · O · C:L · P:Ess
A single registry of recurring NPCs (merchants, trainers, nurses, rivals, mentors), each with an ID, persistent traits, a place in the world, and a history with the player. Randomised encounters draw from it before generating new ones. Deps: encounters, rivals manager, events. Impact: unifies "returning characters" behavior. Balance: caps on recurrences.

**SYS-B32 NPC Memory** · E · C:M · P:High
NPCs remember what you did (spared, bargained, cheated) and reference it in later dialogue, prices and events. Deps: B31, ledger. Impact: the world reacts. Balance: effects ≤10%.

**SYS-B33 NPC Aging and Career Paths** · N · C:L · P:Med
Recurring NPCs evolve across runs: a youngster becomes a gym leader, a merchant opens a shop. Deps: B31, persistent world. Impact: world continuity. Balance: persistence in profile.

**SYS-B34 NPC Relationships With Each Other** · N · C:M · P:Med
NPCs like/dislike each other; their gossip changes encounters (a merchant refuses to appear if their rival is here). Deps: B31. Impact: emergent social web. Balance: nothing blocked completely.

**SYS-B35 Merchant Loyalty Tiers** · E · C:M · P:Med
Frequent merchants unlock exclusive wares and backstory; betrayal ends the line. Deps: shop system. Impact: attachment. Balance: discounts ≤15%.

**SYS-B36 Rival Family Tree** · E · C:M · P:Low
Rivals have family (siblings, mentors) who arrive later with grudges or help. Deps: rivals/legacy. Impact: depth. Balance: stat caps.

**SYS-B37 Mentors as Characters** · N · C:L · P:Med
Choose a mentor NPC for the run; they appear at forks with advice, bonus, and a backstory arc. Deps: B31. Impact: narrative spine. Balance: one mentor per run.

**SYS-B38 Retired Trainer Ghosts** · L · C:M · P:Med
Teams of your past runs appear as friendly or hostile wanderers; their Pokémon remember you. Deps: Legacy runs, timeline. Impact: ties runs together. Balance: reward optional.

**SYS-B39 Enemy Party Bonds** · N · C:M · P:Med
Enemy trainers' Pokémon show bonds (a sister duo shouts at the loss). Deps: trainer data. Impact: enemies feel real. Balance: flavor.

**SYS-B40 Gym Leader Households** · N · C:M · P:Low
Gym leaders have visible relationships (siblings, rivals) altering their dialogue if you've fought the other. Deps: B31, gym data. Impact: connected world. Balance: none.

**SYS-B41 Traveler Companions** · N · C:L · P:High
A temporary NPC joins a stretch of the run with their own Pokémon, a personality, and a quest. They can help or hinder. Deps: B31, map events. Impact: dynamics. Balance: companion power capped.

**SYS-B42 Companion Departures** · N · C:M · P:Med
Companions leave on their terms (goals met, offended) and may reappear later with changes. Deps: B41. Impact: bittersweet. Balance: none.

**SYS-B43 Pen Pals** · N · C:S · P:Low
Recurring NPCs write letters (like Living Rival letters) with hints, jokes and gifts. Deps: Hub letters. Impact: world present between runs. Balance: gifts minor.

**SYS-B44 NPC Reputation Web** · L · C:M · P:Med
Individual NPC opinions aggregate into regional reputation (loved/feared/infamous) that shifts shops and events. Deps: factions. Impact: persistent consequence. Balance: floors prevent lockouts.

**SYS-B45 Wedding, Funeral and Festival NPC Events** · N · C:M · P:Rare
Rare run events that celebrate or mourn recurring NPCs with special items and lore. Deps: B31, events. Impact: emotional spikes. Balance: small rewards.

## B4. Social-simulation extras

**SYS-B46 Gossip Propagation** · N · C:M · P:Med
Your recent deeds spread through towns as rumors with distortion; later NPCs speak of exaggerated versions. Deps: B31, dialogue. Impact: legend crafting. Balance: effects limited.

**SYS-B47 Public Image Meter** · N · C:M · P:Med
Hero / Rogue / Mystery axes affect NPC trust and shop access. Deps: B44. Impact: role-play. Balance: no best axis.

**SYS-B48 Fame and Fans** · N · C:M · P:Low
Fans (NPCs with fan-club ranks) gift items and cheers in battles. Deps: B44. Impact: reward for performance. Balance: cheer buffs minor.

**SYS-B49 Scandal System** · X · C:M · P:Exp
Certain choices produce scandals (rumor chains) with opportunities to spin or confess; impacts shop prices. Deps: B46. Impact: comedic drama. Balance: moderate.

**SYS-B50 Debts and Favors Ledger** · E · C:M · P:Med
Extends `story/ledger.ts`: any NPC can be owed or owe favors; favors can be called in at crucial moments. Deps: ledger. Impact: transaction memory. Balance: favors single-use.

**SYS-B51 Oaths and Vows** · N · C:M · P:Med
Sworn vows (no healing items, spare all) give strong boons but heavy penalties for breaking. Deps: promises. Impact: roleplay + risk. Balance: vow tiers.

**SYS-B52 Hospitality Network** · N · C:M · P:Low
Befriended NPCs offer free rests or hints when you pass their towns. Deps: B31. Impact: soft recovery. Balance: once per run per NPC.

**SYS-B53 Rumor Quests** · N · C:M · P:Med
Overheard rumors seed side quests that may be false; verifying costs a node. Deps: quests. Impact: curiosity. Balance: false rumors give consolation.

**SYS-B54 Mutual Aid Calls** · N · C:S · P:Low
Befriended NPCs send help during emergencies (boss wipes): an item, a brief ally. Deps: B31. Impact: safety net with story. Balance: single-use.

**SYS-B55 Social Status Titles** · E · C:S · P:Low
Titles from reputation appear on trainer card and shape greetings. Deps: titles. Impact: identity. Balance: cosmetic.

## B5. Rivalry-adjacent relationship ideas

**SYS-B56 Rival Compatibility** · L · C:M · P:Med
Your rival's Pokémon form crushes, feuds and friendships with yours; their dialogue changes by who's on the field. Deps: rivals bonds, B01. Impact: personal rivalries. Balance: flavor.

**SYS-B57 Fan Rivalry Debates** · N · C:S · P:Low
NPC fans argue over you vs your rival; the outcome sets minor shop and event shifts. Deps: B44. Impact: world presence. Balance: none.

**SYS-B58 Truce Events** · N · C:M · P:Med
Rivals call temporary truces to fight a shared enemy; their team joins as an AI ally. Deps: rivals, raids. Impact: variety. Balance: ally AI limited.

**SYS-B59 Team Reconciliation Arc** · N · C:L · P:Med
A multi-run arc to turn a nemesis into an ally, requiring different choices than beating them. Deps: nemesis, legacy. Impact: redemption. Balance: lengthy.

**SYS-B60 Shared Trauma Bonds** · N · C:M · P:Rare
Surviving a hard wipe with a specific group creates a rare "survivors" edge with strong unique lines and a mild buff. Deps: B01, wipe handling. Impact: emotional payoff. Balance: ≤3%.

**SYS-B61 Mirror Pairs** · X · C:M · P:Exp
A player Pokémon and an enemy Pokémon share a bond arc across runs (e.g., twin Eevees on opposite teams). Deps: legacy. Impact: story pairs. Balance: flavor.

**SYS-B62 Heartbreak Events** · N · C:M · P:Low
Permanent partings (a loan returned, a mon choosing the wild) delivered as optional stories. Deps: B09, events. Impact: emotional weight. Balance: opt-in toggle.

**SYS-B63 Surprise Reunions** · E · C:M · P:Med
Extends reunion: released mons rejoin at a later stage as wild encounters recognizing you. Deps: release logs. Impact: payoff for kindness. Balance: capture bonus.

**SYS-B64 Inheritance of Bonds** · L · C:L · P:Med
Bond with an ancestor transmits to its egg-born descendants as a "family legacy" starting edge. Deps: eggs, legacy. Impact: generational play. Balance: capped to 1 tier.

**SYS-B65 Social Ledger Screen** · N · C:M · P:High
A single UI summarizing all current edges, debts, vows, rumors and reputations with filters. Deps: B01, B50. Impact: legibility for all social systems. Balance: none.
