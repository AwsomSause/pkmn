# New Mechanics 2/4: Pokémon autonomy, individuality and relationships (M-030 to M-057)

Part 2 of 4. Design only. Builds on shipped Party Life (12 personalities, quirks, pair chemistry, grudges, revenge pacts, gifts, scenes), Bond Engine, Team Chemistry labels. Everything here must route through the seeded `partyLife`-style streams, never gameplay RNG used by previews.
Format: **Rules / Loop / Interacts / Balance / Cx** (Low, Med, High).

---

### M-030 Initiative Moments
**Rules:** A Pokémon with high trust (affection 60+) may take Initiative once per battle: before your command resolves it adds a free small action matching its personality (Brave: a taunt-flinch on the foe, Caring: heals the lowest ally 8%, Showy: a crit-boosting pose). A low-trust Pokémon may Hesitate instead (skips the free action, never your command). **Loop:** you watch for little favors from the team. **Interacts:** Personality, Command Trust (M-048), Perfect Counter. **Balance:** 20% base roll on a seeded stream, once per battle; bosses suppress Hesitate. **Cx:** Med.

### M-031 Comfort Move
**Rules:** At catch each Pokémon rolls a Comfort Move (one of its known moves). Using it heals 3% HP and raises mood; using it 3 times in a battle raises Pride. If the move is removed, the Pokémon sulks (-1 Speed for a battle). **Loop:** build around moves your Pokémon loves. **Interacts:** Move tutoring, Mood, Move mastery. **Balance:** picks only from moves it can legitimately learn; the reveal appears in the Album. **Cx:** Low.

### M-032 Phobias and Affinities
**Rules:** Each Pokémon rolls 0-2 Fears and 0-2 Loves from a data list (a type, a weather, a species, the dark, water, loud moves). Facing a Fear gives -1 to a stat for the first two turns unless a bonded partner is adjacent; facing a Love gives +1 Speed. Overcoming a Fear 3 times removes it and gives a permanent stat nudge. **Loop:** adventure routes become personal. **Interacts:** Weather, Brave personalities, Album scenes. **Balance:** fears can be steered by Pokémon choice, never lethal; 50 authored combinations. **Cx:** Med.

### M-033 Teammate Rivalry Spark
**Rules:** Two same-role Pokémon (e.g. two fast attackers) may form a Spark: each battle the one that deals more damage wins a Spark point; the loser gains +5% damage next battle ("Fired Up"). At 5 points the winner gets a title and a boost; the loser may train up a rival move. **Loop:** rotation of who leads becomes a friendly competition. **Interacts:** Chemistry (rivals ≠ grudges), Competitive Duo label. **Balance:** Sparks do not change party chemistry negatively; a Spark clears if one faints. **Cx:** Med.

### M-034 Attention Economy
**Rules:** Pokémon have an Attention need based on personality (Needy, Independent). Items, heals, praise and leading the party give Attention; ignoring a Needy Pokémon for 5 nodes causes Jealousy (-1 chemistry to the favoured partner, small sulk). Independent Pokémon get stronger when left alone. **Loop:** distributing love is a resource puzzle. **Interacts:** Gifts, Party Vote, Life Goals. **Balance:** no permanent punishments; one tap action "Spend time" at camp. **Cx:** Med.

### M-035 Learned Habits
**Rules:** A Pokémon that uses the same move type 15 times builds a Habit (Fire Habit, Defensive Habit). A habit gives a +4% effect on that type and a tiny AI-style tell (it opens battle with a signature pose). Habits are exclusive per Pokémon and can be broken by long idleness, but flavor text cites the history. **Loop:** your playstyle shapes the Pokémon. **Interacts:** Move mastery, Stat streaks, Album. **Balance:** max 1 Habit per Pokémon; Habit and Type Resonance don't stack. **Cx:** Low.

### M-036 Shared Dreams
**Rules:** After a rest stop, each Pokémon that slept dreams. Dreams are chosen by recent events (a win, a loss, a scare) and grant a Dream effect for the next two battles (e.g. "Dreamed of flight": +1 Speed on the first turn). Two bonded sleepers can have a Shared Dream with a stronger effect. **Loop:** camp becomes a quiet payoff for run events. **Interacts:** Rest stops, Chronicle memories, Scene system. **Balance:** dreams cannot stack above 1 per Pokémon; effects sit at Low/Medium tiers. **Cx:** Med.

### M-037 Pack Roles
**Rules:** Pokémon from pack species (Wolf/Canine, Bird flocks, Bug swarms) take pack roles in the party: Alpha (+1 Atk when two others share its egg group), Scout (reveals the next node's type), Rear Guard (cannot be ambushed). Mixed-species parties still form loose packs through chemistry. **Loop:** compose a pack with a leader. **Interacts:** Map scouting, ambush events, Role slots. **Balance:** only one of each role; Scout reveals type, not content. **Cx:** Med.

### M-038 Territory Instinct
**Rules:** Territorial species (Gyarados, Arcanine, Tyranitar) mark a map node when they win a battle there. On later visits the node changes: wild encounters flee, or rival Pokémon contest it. Marked nodes grant a small recurring item or intimidate wilds for the region. **Loop:** your team leaves a trace on the world. **Interacts:** Landmarks, Legacy records, wild AI. **Balance:** limited marks per region; marks vanish on faint of the owner. **Cx:** Med.

### M-039 Flavor Palate
**Rules:** Each nature favours two flavors (sweet, spicy, dry, bitter, sour). At camp you cook a meal from berries; a matching flavor gives +2 mood and a small stat edge, a disliked flavor gives -1 mood but a bigger one-time edge. Recipes are discovered by pairing flavors. **Loop:** per-Pokémon cooking plans. **Interacts:** Berries, Rest choices, Consumable crafting, Mood. **Balance:** one cook per rest stop; meals expire after 3 battles. **Cx:** Med.

### M-040 Emotional Surge
**Rules:** In battle a Pokémon can enter a Surge: Elated (after a crit or KO: +1 Speed), Shaken (after a big hit: -1 Accuracy), Furious (after an ally faints: +1 Atk, -1 Def), Calm (after a Protect: -1 damage taken). Surges last 3 turns and depend on personality (Hothead gets Furious more easily). **Loop:** momentum is emotional, not just numeric. **Interacts:** Personality, Last Stand, Ability Awakening. **Balance:** one Surge at a time; Calm items counter Shaken. **Cx:** Med.

### M-041 Kin Recognition
**Rules:** Facing a foe of the same species (or evolution line) as one of yours triggers Kin Recognition: both Pokémon pause, and the player picks Fight (normal), Parley (the foe leaves the field and the battle skips with a bonus), or Salute (a small friendship gain, foe weakens). Rival kin trigger special lines. **Loop:** unexpected mercy and mirror matches. **Interacts:** Parley (M-058), rival teams, Legacy. **Balance:** limited per run; bosses can't Parley. **Cx:** Med.

### M-042 Field Talents
**Rules:** Species have Field Talents usable on the map between nodes with a cooldown: Pikachu lights a dark route, Growlithe sniffs a hidden item, Abra teleports past one node, Machop moves a boulder, Butterfree dusts a calm node. Talents cost Energy that recharges at rest stops. **Loop:** party composition changes route choices. **Interacts:** Map nodes, Fog of war, Pack Roles. **Balance:** two uses per region per talent; pool of about 80 species. **Cx:** High.

### M-043 Size Quirks
**Rules:** Each Pokémon rolls a Size (XXS to XXL) at generation. Large: +8% HP, -6% Speed, Poise +1. Small: -8% HP, +6% Speed, harder to hit by spread moves. Extreme sizes appear in the Album and unlock cosmetic scale. Evolutions inherit scaled sizes. **Loop:** each catch is individual in feel. **Interacts:** Weight Poise (M-014), Alpha encounters, Ring Positions. **Balance:** modifiers are small; shown on the summary. **Cx:** Low.

### M-044 Battle Scars
**Rules:** A Pokémon that faints with a boss or crit KO may earn a Scar: a permanent mark with an upside and downside (Torn Ear: +accuracy vs Normal types, -Sp. Def; Cracked Shell: +Defense, -Speed). Scars can be treated at the hub, which erases the downside only. **Loop:** history shapes stats. **Interacts:** Nemesis, Legacy, Memories. **Balance:** max two scars; scars are mostly cosmetic plus one stat swing. **Cx:** Med.

### M-045 Invented Moves
**Rules:** A bonded duo that has used a specific two-move combo in 10 battles can invent a Signature Technique: a named move built from their moves, with a short authored description. It appears in both movesets and costs a Memory slot. **Loop:** creative duos create real moves. **Interacts:** Move Fusion (M-003), Chronicle, Teamwork moves. **Balance:** 1 per run; effect never exceeds 100 power and uses the shared PP pool. **Cx:** High.

### M-046 Party Vote
**Rules:** At some events the party votes: each Pokémon's personality gives a leaning (Brave votes Fight, Cautious votes Avoid). If the vote disagrees with your choice, a Trust cost applies, but a clear majority gives a bonus if you follow it. You may skip the vote with a Direct order. **Loop:** the team's voice shapes decisions. **Interacts:** Events, Command Trust, Rest stops. **Balance:** votes are tiebreakers shown with portraits; choose the cost yourself. **Cx:** Med.

### M-047 Life Goals
**Rules:** Each Pokémon has a personal goal at catch (see a Dragon, win a duel, evolve, meet its idol species, protect a friend). Completing it grants a permanent boon and a scene; abandoning it causes slow Drift (-chemistry). Goals are visible in the summary and are seeded. **Loop:** run-length tasks to steer. **Interacts:** Events, Legacy, Mastery. **Balance:** about 40 goal templates; at most two goals per Pokémon per run. **Cx:** Med.

### M-048 Command Trust
**Rules:** Trust has tiers. Low: the Pokémon may ignore risky commands (no Sleep, no sacrifices). Mid: normal. High: it accepts Double Down (a command that raises damage 20% but exposes it to +10% damage taken). Trust grows through victories and care. **Loop:** relationships open new commands. **Interacts:** Initiative Moments, Stance Shift, Perfect Counter. **Balance:** Trust never hurts bosses' fairness; ignoring is visible and short. **Cx:** Med.

### M-049 Ghost Companion
**Rules:** A Pokémon fainted permanently stays as a Ghost Companion (only in runs with permadeath): it provides a minor aura (+2% to chemistry bonuses, a whisper of advice at events) but cannot battle. Revival at a shrine event ends the aura. **Loop:** loss is remembered instead of erased. **Interacts:** Hardcore toggle, Retire to ranch, Legacy. **Balance:** only one Ghost per run active; aura cap. **Cx:** Med.

### M-050 Mon-Speak Translation
**Rules:** Through a run, you collect Phrases: each repeated cry pattern ("Piiika" with a certain state) unlocks a translation for that species. Translated cries reveal intentions in the Album and let you understand wild Pokémon intentions at encounters (hostile, scared, hungry, curious). **Loop:** a language-learning layer for interactions. **Interacts:** Parley, Alpha encounters, Dialogue. **Balance:** purely informational; unlocks tiers of dialogue in Parley. **Cx:** High.

### M-051 Mood Contagion
**Rules:** Mood spreads between neighbors in the party order. Each node, a Pokémon's mood drifts 20% toward the average of the adjacent party members. A Furious teammate can ruin a calm sleeper; a joyful Pokémon lifts both sides. Moving the party order changes who infects whom. **Loop:** party order is also a social map. **Interacts:** Mood, March Order (M-084), Formation presets. **Balance:** drift is slow; items can lock a mood. **Cx:** Med.

### M-052 Origin Imprint
**Rules:** Pokémon remember how they joined: caught wild, hatched, gifted, rescued, traded, won from a rival. Each origin gives a small imprint (rescued: +loyalty to the one who rescued it; won from a rival: +vs that rival's type). The origin is listed in the Album. **Loop:** acquisition choices matter later. **Interacts:** Capture Style (M-060), Rival gift swap, Hatch Care. **Balance:** imprints are tiny; 8 origin kinds. **Cx:** Low.

### M-053 Night Watch
**Rules:** At camp, assign one Pokémon to Night Watch. The watcher gives -50% ambush chance for the next node but is tired next battle (-5% Speed). Watchers with Keen Eye or Insomnia double the effect; Nocturnal Pokémon are not tired. **Loop:** camp becomes a quick, personal assignment. **Interacts:** Ambush events, Fatigue, Abilities. **Balance:** one watcher; no stacking. **Cx:** Low.

### M-054 Shared Senses
**Rules:** Two bonded Pokémon (Close+ chemistry) can Share Senses once per node: one scouts, revealing the next node's details (items, trainers, hazards), the other covers it with full alertness. Pokémon with Telepathy or Psychic types do it free. **Loop:** relationships reveal information. **Interacts:** Fog of war, Chemistry stages, Abilities. **Balance:** one reveal per node; reveals do not disclose rewards. **Cx:** Med.

### M-055 Pride and Humility
**Rules:** Winning raises Pride (+damage) up to a cap; at high Pride the Pokémon refuses to be swapped out mid-battle (a free stat gain but loses switch control). Loss raises Humility (+defense, more cooperation). A balanced Pokémon gets bonus chemistry. **Loop:** manage egos. **Interacts:** Mood, Command Trust, Rival lines. **Balance:** Pride resets on loss; refusal is shown beforehand. **Cx:** Med.

### M-056 Keepsake Exchange
**Rules:** Two bonded Pokémon can exchange keepsakes at camp (a pebble, a leaf, a feather). Each keepsake is a tiny held-item equivalent that can only be carried by the partner and grants a pair bonus while both are on the field. Losing a partner returns the keepsake as a memory. **Loop:** symbolic gifts with real effects. **Interacts:** Gifts, Memories, Team chemistry. **Balance:** one keepsake each, small effects; no extra slots. **Cx:** Low.

### M-057 Hatch Care
**Rules:** Eggs reflect how they were carried: carried by a warm Fire type (+HP growth), a calm Pokémon (+Trust), a fast flyer (+Speed). The egg's carrier is recorded and shapes the hatchling's first stat nudge and nickname hint. **Loop:** egg logistics matter. **Interacts:** Egg incubation, Origin Imprint, Party Life. **Balance:** carriage is a free choice on the party screen; effect tiny. **Cx:** Low.
