# Master Idea Library 02: Battle Mechanics & Combat Presentation (BT-001 to BT-085)

Legend and fields as in file 01. Cx = S/M/L/XL. Design only.

## A. Positioning, space and action economy

**BT-001 Stance Dial** — Before each turn choose Aggressive, Balanced or Guarded for the active Pokémon; changes damage dealt/taken by ±15% and move accuracy. *Trigger:* every turn, one tap. *Feel:* a second decision layer without more menus. *Rarity:* Always. *Cx:* M. *Deps:* engine, AI. *Balance:* AI uses it too; keep totals zero-sum.

**BT-002 Flank Lanes** — Doubles field has three lanes (left, centre, right); spread moves hit by lane and Pokémon can step lanes as a free action once per turn. *Trigger:* doubles. *Feel:* chess-like. *Rarity:* Doubles. *Cx:* XL. *Deps:* doubles engine, UI. *Balance:* limits on movement.

**BT-003 Retreat Gauge** — Instead of switching, a Pokémon can "back off" to reduce incoming damage 40% for one turn while still being active. *Trigger:* player action. *Feel:* tactical retreat. *Rarity:* Always. *Cx:* M. *Deps:* action menu. *Balance:* cooldown 3 turns.

**BT-004 Telegraphed Enemy Intent** — Elite foes show an icon of their next move category (attack, setup, support) one turn ahead. *Trigger:* elite/boss. *Feel:* Slay-the-Spire clarity. *Rarity:* Boss. *Cx:* M. *Deps:* AI. *Balance:* AI sometimes lies when smart.

**BT-005 Bluff Move** — Use a move as a feint: costs the turn but plants doubt, making the enemy AI waste a turn on a defensive reply 40% of the time. *Trigger:* player option. *Feel:* mind games. *Rarity:* Always. *Cx:* M. *Deps:* AI. *Balance:* AI trained to ignore after 2 uses.

**BT-006 Rhythm Turns** — Every third turn is a "Beat Turn" where moves hit +10% harder; rhythm shown by a visible metronome. *Trigger:* turn counter. *Feel:* pace and anticipation. *Rarity:* Always. *Cx:* M. *Deps:* engine. *Balance:* symmetric for both sides.

**BT-007 Momentum Ladder** — KO or crit shifts a shared ladder; the side holding the top rung gains priority bracket advantage. *Trigger:* events in battle. *Feel:* swing battles. *Rarity:* Always. *Cx:* L. *Deps:* priority. *Balance:* ladder resets on switch.

**BT-008 Hand-Off Pass** — Switching out hands the incoming Pokémon one stat boost from the outgoing one (Baton-lite, one stage only). *Trigger:* voluntary switch. *Feel:* team play. *Rarity:* Always. *Cx:* M. *Deps:* switching. *Balance:* cap one stage.

**BT-009 Reserve Interrupt** — Bench Pokémon with high bond may interrupt once per battle to take a hit meant for the active one. *Trigger:* active Pokémon about to KO. *Feel:* heroic subs. *Rarity:* Rare. *Cx:* L. *Deps:* Bond. *Balance:* once per battle.

**BT-010 Terrain Grid Moves** — Some moves rewrite a single "tile" under a Pokémon (Spikes tile, Mist tile) rather than the whole field. *Trigger:* move. *Feel:* spatial. *Rarity:* Move-based. *Cx:* XL. *Deps:* field effects. *Balance:* tiles decay in 3 turns.

## B. Moves with new rules

**BT-011 Echo Moves** — Some moves leave an "echo" which repeats at half power next turn unless the user switches. *Trigger:* move tag. *Feel:* delayed consequence. *Rarity:* Species. *Cx:* M. *Deps:* move scripting. *Balance:* echo can be blocked.

**BT-012 Channeled Moves** — Move needs two turns of channeling but can be disrupted; success gives a big effect, disruption stuns the user. *Trigger:* certain moves. *Feel:* risk and interruption. *Rarity:* Move-based. *Cx:* L. *Deps:* two-turn moves. *Balance:* telegraph interrupt window.

**BT-013 Combo Finishers** — Two allies using complementary moves in sequence (Water then Electric) trigger a bonus follow-up hit. *Trigger:* doubles. *Feel:* synergy discovery. *Rarity:* Uncommon. *Cx:* L. *Deps:* doubles. *Balance:* catalogue of 20 combos.

**BT-014 Move Fatigue** — Spamming one move builds fatigue (-5% per consecutive use, resets on switching moves). Encourages variety. *Trigger:* repeated use. *Feel:* anti-stall. *Rarity:* Always. *Cx:* M. *Deps:* engine. *Balance:* legendary moves exempt.

**BT-015 Risky Variants** — Hold a button to "overcharge" a move: +30% power but 15% chance of self-recoil/miss. *Trigger:* player option. *Feel:* gambler's thrill. *Rarity:* Always. *Cx:* M. *Deps:* UI. *Balance:* tune fail chance.

**BT-016 Learning By Doing** — Moves used repeatedly in a run gain a "mastery tier" adding small riders (burn chance, wider crit). *Trigger:* usage count. *Feel:* specialisation. *Rarity:* Always. *Cx:* L. *Deps:* Species Mastery. *Balance:* tier cap.

**BT-017 Reversal Windows** — After being hit by a super-effective move, the defender has a 20% chance to "Counter-Read" and gain a free +1 on the next turn. *Trigger:* SE hit. *Feel:* comebacks. *Rarity:* Common. *Cx:* M. *Deps:* engine. *Balance:* low chance.

**BT-018 Stacked Hazards Interactions** — Hazards interact: Toxic Spikes + Sticky Web triggers a corrosive web slowing and poisoning. *Trigger:* multiple hazards. *Feel:* experimentation. *Rarity:* Uncommon. *Cx:* L. *Deps:* hazards. *Balance:* only three combos.

**BT-019 Weather Chains** — Weather can chain into a second effect (rain then thunder-lightning storm) forecast on the weather clock. *Trigger:* rain 3 turns. *Feel:* dramatic. *Rarity:* Rare. *Cx:* L. *Deps:* weather. *Balance:* telegraphed.

**BT-020 Silent Moves** — Moves can be used with no announcement for ambush; opposing AI loses the intent hint for that turn. *Trigger:* Dark/Ghost. *Feel:* stealthy. *Rarity:* Uncommon. *Cx:* M. *Deps:* telegraph. *Balance:* limited.

## C. Status, stats and ailments, rethought

**BT-021 Layered Status** — Status ailments have intensity levels (Burn I-III) that deepen if reapplied; cures reduce by one step. *Trigger:* repeated status. *Feel:* status matters more. *Rarity:* Always. *Cx:* L. *Deps:* status. *Balance:* tune.

**BT-022 Mood-Swing Confusion** — Confusion randomizes among three outcomes (hit self, swing wild, fine) with visuals instead of a flat 33%. *Trigger:* confusion. *Feel:* clearer. *Rarity:* Always. *Cx:* M. *Deps:* engine. *Balance:* parity.

**BT-023 Stat Fatigue Floor** — Stat drops below -3 give a "desperation" flash: next move gets a damage floor. *Trigger:* heavy debuffs. *Feel:* comeback. *Rarity:* Rare. *Cx:* M. *Deps:* stages. *Balance:* only one move.

**BT-024 Fear Status** — New Fright status: 25% chance to skip the first move vs a type you fear; removed by Bond heal. *Trigger:* certain moves. *Feel:* psychological. *Rarity:* Move-based. *Cx:* M. *Deps:* mood. *Balance:* not stacking with Flinch.

**BT-025 Soaked** — Wet status amplifies Electric and Ice damage and cancels Burn; removed by Sun or Fire. *Trigger:* Water moves. *Feel:* elemental play. *Rarity:* Common. *Cx:* M. *Deps:* statuses. *Balance:* short duration.

**BT-026 Adrenaline** — Below 20% HP Pokémon gain -10% accuracy but +15% crit; displayed by a pulsing vignette. *Trigger:* low HP. *Feel:* last stand. *Rarity:* Always. *Cx:* M. *Deps:* engine. *Balance:* compare with Berserk.

**BT-027 Mutual Exhaustion** — Both active Pokémon tire if the battle exceeds 12 turns; stats gradually decay encouraging closure. *Trigger:* long fights. *Feel:* stops stall. *Rarity:* Rare. *Cx:* M. *Deps:* turn counter. *Balance:* start at turn 12.

**BT-028 Marked Target** — Mark a foe: all allies gain +10% accuracy vs it; the mark falls on switch. *Trigger:* move. *Feel:* focus fire. *Rarity:* Common. *Cx:* M. *Deps:* doubles. *Balance:* only one mark.

**BT-029 Curse Accumulation** — Cursed status ticks up each turn and bursts at 4, dealing damage; removal needs a cleanse. *Trigger:* Ghost move. *Feel:* ticking dread. *Rarity:* Rare. *Cx:* M. *Deps:* statuses. *Balance:* clear timer.

**BT-030 Overflow Heal** — Healing above max HP stores a decaying shield bar of 25% of overflow. *Trigger:* heal over max. *Feel:* rewards big heals. *Rarity:* Common. *Cx:* M. *Deps:* HP bar. *Balance:* cap shield.

## D. Enemy behavior and AI

**BT-031 Personality AI** — Trainers have AI personalities (cautious, reckless, tricky, showboat) affecting moves and swaps; shown in their intro blurb. *Trigger:* trainer. *Feel:* every trainer plays differently. *Rarity:* Always. *Cx:* L. *Deps:* AAI system. *Balance:* deterministic via seed.

**BT-032 Learning Opponent** — Rival AI remembers your last run's opening and counters it. *Trigger:* rival battle. *Feel:* creeping dread. *Rarity:* Rival. *Cx:* L. *Deps:* Legacy, nemesis. *Balance:* limited memory.

**BT-033 Taunt Banter** — Enemy trainer taunts during battle shift AI aggression (anger makes them sloppy). Provoking is a tactic. *Trigger:* player option. *Feel:* mind games. *Rarity:* Always. *Cx:* M. *Deps:* dialogue. *Balance:* risk of enraged boosts.

**BT-034 Panic Swap** — AI trainers panic when their ace is down and make worse swaps in the next turn. *Trigger:* ace KO. *Feel:* human. *Rarity:* Common. *Cx:* S. *Deps:* AI. *Balance:* small penalty.

**BT-035 Wild Herd Response** — Wild Pokémon in groups protect weak members; attacking the herd leader draws all. *Trigger:* group encounter. *Feel:* ecosystem. *Rarity:* Uncommon. *Cx:* L. *Deps:* encounters. *Balance:* scales.

**BT-036 Boss Phase Interludes** — Between boss phases a short non-combat beat (dialogue, environment shift) where players choose a one-time prep action. *Trigger:* phase change. *Feel:* cinematic. *Rarity:* Boss. *Cx:* M. *Deps:* boss phases. *Balance:* one action.

**BT-037 Enemy Ace Reveal** — Opponent hides its ace until the last turn then flips a dramatic reveal with its own intro. *Trigger:* trainer. *Feel:* showmanship. *Rarity:* Common. *Cx:* M. *Deps:* animations. *Balance:* none.

**BT-038 Surrender Option** — Some trainers will yield if you beat their lead hard enough, giving half rewards but saving resources. *Trigger:* overwhelming lead. *Feel:* alternate ending. *Rarity:* Rare. *Cx:* M. *Deps:* AI. *Balance:* partial reward.

**BT-039 Counter Training Memory** — Gym leaders adapt their team to your party types over repeated rematches. *Trigger:* rematch. *Feel:* living gym. *Rarity:* Rematch. *Cx:* L. *Deps:* rematch. *Balance:* bounded.

**BT-040 Wild Mood Variance** — Wild Pokémon enter fights in moods (aggressive, scared, curious) that change their first move. *Trigger:* wild fight. *Feel:* variety. *Rarity:* Always. *Cx:* M. *Deps:* encounters. *Balance:* low.

## E. Environmental and field play

**BT-041 Arena Hazard Events** — Mid-battle arena events (crumbling floor, ceiling drops rocks) with a one-turn warning and a safe-slot rule. *Trigger:* certain arenas. *Feel:* dynamic. *Rarity:* Rare. *Cx:* L. *Deps:* arenas. *Balance:* equal to both sides.

**BT-042 Time-of-Day Battles** — Battles carry day/dusk/night, buffing Fairy/Dark/Ghost; night wild moves differ. *Trigger:* map clock. *Feel:* flavor. *Rarity:* Always. *Cx:* M. *Deps:* map time. *Balance:* small.

**BT-043 Crowd Pressure** — Spectator-filled arenas shift morale: crowd favours underdog, giving small buffs when behind. *Trigger:* gyms. *Feel:* drama. *Rarity:* Gym. *Cx:* M. *Deps:* crowd sprites. *Balance:* small.

**BT-044 Environmental Interaction Moves** — Moves interact with scenery: Fire burns grass tiles, Surf floods a cave floor. *Trigger:* biome + move. *Feel:* living stages. *Rarity:* Common. *Cx:* L. *Deps:* battle backs. *Balance:* visual first.

**BT-045 Echoing Caves** — Sound moves in caves gain +10% but also hit allies lightly. *Trigger:* cave. *Feel:* risk. *Rarity:* Common. *Cx:* S. *Deps:* battlebacks. *Balance:* small.

**BT-046 Underwater Battles** — Water routes put fights underwater: Fire moves weakened, Electric strengthened, new Dive tile. *Trigger:* ocean node. *Feel:* variety. *Rarity:* Uncommon. *Cx:* L. *Deps:* terrain. *Balance:* clear UI.

**BT-047 Ruins With Memory** — Ancient ruin battles trigger spectral echoes of past trainers who assist randomly once. *Trigger:* ruins. *Feel:* eerie. *Rarity:* Rare. *Cx:* L. *Deps:* Legacy. *Balance:* one assist.

**BT-048 Sudden Weather Reversal** — A random rare event flips weather mid-battle; trainers react. *Trigger:* rare. *Feel:* chaos. *Rarity:* Rare. *Cx:* M. *Deps:* weather. *Balance:* symmetrical.

**BT-049 Fog of War Battles** — Fog hides enemy HP bars and moves until a scout move or spotter Pokémon reveals them. *Trigger:* swamp. *Feel:* tension. *Rarity:* Uncommon. *Cx:* L. *Deps:* UI. *Balance:* accessibility toggle.

**BT-050 Boss Arena Phases** — The arena visibly transforms across boss phases (ice thaws, lava rises) with actual field effects. *Trigger:* boss phase. *Feel:* spectacle. *Rarity:* Boss. *Cx:* L. *Deps:* boss, field effects. *Balance:* telegraphed.

## F. Presentation and spectacle

**BT-051 Camera Director** — Dynamic camera angles keyed to move category (swoop for charges, zoom for crits) with a motion toggle. *Trigger:* battles. *Feel:* cinematic. *Rarity:* Always. *Cx:* L. *Deps:* BattleScene, settings. *Balance:* none.

**BT-052 Super-Effective Slow-Mo** — A brief hit-stop and sound sting on super-effective crits, scaled by damage %. *Trigger:* SE crit. *Feel:* punch. *Rarity:* Common. *Cx:* S. *Deps:* animation registry. *Balance:* none.

**BT-053 Dramatic Last Hit** — The final KO of a boss gets a replayable cinematic angle and freeze frame saved to the Hall. *Trigger:* boss KO. *Feel:* memory. *Rarity:* Boss. *Cx:* M. *Deps:* Hall. *Balance:* none.

**BT-054 Move Name Typography** — Move names slam on screen in type-coloured lettering with unique style per move category. *Trigger:* every move. *Feel:* style. *Rarity:* Always. *Cx:* M. *Deps:* UI. *Balance:* settings to reduce.

**BT-055 Damage Number Personality** — Damage numbers' style depends on attacker nature (jittery, big and bold, tiny and precise). *Trigger:* damage. *Feel:* personality. *Rarity:* Always. *Cx:* S. *Deps:* UI. *Balance:* none.

**BT-056 Hit Reaction Library** — Each species has distinct hit reactions (Snorlax wobbles, Gengar stretches) rather than generic shakes. *Trigger:* hit. *Feel:* craft. *Rarity:* Always. *Cx:* L. *Deps:* sprites. *Balance:* none.

**BT-057 Victory Pose Replay** — After a win the winner's best move replays in 0.5x on a small corner screen. *Trigger:* victory. *Feel:* highlight reel. *Rarity:* Common. *Cx:* M. *Deps:* recap. *Balance:* skippable.

**BT-058 Announcer Commentary** — Optional announcer lines ("A bold swap!") reflecting battle state, in text bubbles. *Trigger:* turn events. *Feel:* esports. *Rarity:* Setting. *Cx:* M. *Deps:* dialogue. *Balance:* toggle.

**BT-059 Soundtrack Layers** — Battle music adds stems as tension rises (low HP adds strings, boss phase adds choir). *Trigger:* state. *Feel:* alive music. *Rarity:* Always. *Cx:* L. *Deps:* audio. *Balance:* none.

**BT-060 Screen Lighting States** — Dynamic lighting for weather/time: lightning flashes, sunset glare on the battle scene. *Trigger:* state. *Feel:* atmosphere. *Rarity:* Always. *Cx:* M. *Deps:* shaders. *Balance:* accessibility flash cap.

## G. Special combat modes and rules

**BT-061 Duel Mode** — Rival or gym leader may call a Duel: lead vs lead only, no swaps; winner earns a big reward. *Trigger:* rival event. *Feel:* intense. *Rarity:* Rare. *Cx:* M. *Deps:* rival. *Balance:* opt-in.

**BT-062 Gauntlet Battles** — Fight five trainers back to back with limited healing between; running totals shown. *Trigger:* event node. *Feel:* endurance. *Rarity:* Rare. *Cx:* M. *Deps:* events. *Balance:* big rewards.

**BT-063 Sudden Death Round** — Tied boss fights end with sudden death: one Pokémon each, one-hit KO rules. *Trigger:* long fights. *Feel:* tension. *Rarity:* Rare. *Cx:* M. *Deps:* bosses. *Balance:* optional.

**BT-064 Handicap Matches** — Gain stakes by accepting a handicap (no items, cut HP) for better loot. *Trigger:* pre-battle. *Feel:* risk-taking. *Rarity:* Common. *Cx:* M. *Deps:* challenge modifiers. *Balance:* scale reward.

**BT-065 Team Battle Royale** — Three-way fights with a third party that attacks the strongest. *Trigger:* event. *Feel:* chaotic. *Rarity:* Rare. *Cx:* XL. *Deps:* engine. *Balance:* experimental.

**BT-066 Capture Duels** — Catching a tough Pokémon requires a mini battle objective (keep it above 20%, not KO). *Trigger:* rare capture. *Feel:* skill-based. *Rarity:* Uncommon. *Cx:* M. *Deps:* capture. *Balance:* clear rules.

**BT-067 Mirror Matches** — Fight a shadow copy of your own team shaped by your habits (used moves, items). *Trigger:* rare event. *Feel:* self-confrontation. *Rarity:* Rare. *Cx:* L. *Deps:* run history. *Balance:* tuned.

**BT-068 Escort Battles** — Protect an NPC trainer's Pokémon from KO while defeating foes. *Trigger:* event. *Feel:* variety. *Rarity:* Uncommon. *Cx:* L. *Deps:* doubles. *Balance:* simple fail state.

**BT-069 Timed Battles** — Beat a foe in N turns for bonus; timer visible. *Trigger:* challenge node. *Feel:* pace. *Rarity:* Uncommon. *Cx:* M. *Deps:* nodes. *Balance:* fair.

**BT-070 Ritual Battles** — Gym leaders require a pre-battle ritual (bring an item, order of party); correct prep grants an advantage. *Trigger:* gym. *Feel:* lore. *Rarity:* Rare. *Cx:* M. *Deps:* gyms. *Balance:* hints.

## H. Items, moves and utility in combat

**BT-071 Battle Items As Gestures** — Use items by dragging to targets; Potions heal, Whistles distract. *Trigger:* UI. *Feel:* tactile. *Rarity:* Always. *Cx:* M. *Deps:* UI. *Balance:* none.

**BT-072 Coach Commands** — Limited-use trainer commands (Hustle, Hold, Watch Out) that apply short buffs. *Trigger:* player. *Feel:* trainer identity. *Rarity:* Always. *Cx:* L. *Deps:* trainer identity. *Balance:* cooldown.

**BT-073 Lucky Cry** — A Pokémon with high Bond may let out a cry that rerolls the next miss once per battle. *Trigger:* miss. *Feel:* luck. *Rarity:* Rare. *Cx:* M. *Deps:* Bond. *Balance:* limited.

**BT-074 Gadget Slots** — Equip small gadgets (Smoke Bomb, Reflector Pad) to the trainer, used once in battle. *Trigger:* player. *Feel:* inventory play. *Rarity:* Common. *Cx:* M. *Deps:* items. *Balance:* limit.

**BT-075 Rhythm Switching** — Switch when your Pokémon is hit to gain a short stat shield. *Trigger:* hit then switch. *Feel:* skill. *Rarity:* Always. *Cx:* M. *Deps:* switching. *Balance:* small.

**BT-076 Dying Declaration** — A fainting Pokémon says last words; high Bond gives a final-moment buff to the next. *Trigger:* faint. *Feel:* emotional. *Rarity:* Common. *Cx:* M. *Deps:* dialogue, Bond. *Balance:* small.

**BT-077 Recall Bonus** — Recalling a Pokémon on time (not low HP) gives it a rest heal. *Trigger:* switch. *Feel:* reward. *Rarity:* Common. *Cx:* S. *Deps:* switch. *Balance:* tiny.

**BT-078 Item Chain Bonus** — Using items in combination (Potion then X-Attack) yields a combo bonus. *Trigger:* item use. *Feel:* synergy. *Rarity:* Rare. *Cx:* M. *Deps:* items. *Balance:* low.

**BT-079 Scouting Preview** — Spend a node resource to preview boss moves partially. *Trigger:* pre-boss. *Feel:* preparation. *Rarity:* Common. *Cx:* M. *Deps:* boss intel. *Balance:* limited.

**BT-080 Defiant Flags** — Raising a flag (surrender, challenge) before a fight modifies rules. *Trigger:* pre-battle. *Feel:* theatrical. *Rarity:* Uncommon. *Cx:* M. *Deps:* trainer pre-battle. *Balance:* each flag clear.

## I. Meta-battle ideas

**BT-081 Battle Replay Scrubbing** — Post-battle timeline lets you scrub and see damage turn by turn. *Trigger:* post. *Feel:* analysis. *Rarity:* Always. *Cx:* L. *Deps:* recap. *Balance:* none.

**BT-082 Betting On Battles** — Wager currency on your own performance goals (win without items) for payout. *Trigger:* pre. *Feel:* risk. *Rarity:* Common. *Cx:* M. *Deps:* economy. *Balance:* house edge.

**BT-083 Audience Votes** — Optionally, spectators vote on a field twist for the next turn (Kice-friendly local sim). *Trigger:* arena. *Feel:* show. *Rarity:* Rare. *Cx:* M. *Deps:* arena. *Balance:* symmetric.

**BT-084 Move Cinematics Unlock** — Using a move 100 times unlocks its signature cinematic. *Trigger:* usage. *Feel:* reward. *Rarity:* Long-term. *Cx:* M. *Deps:* animations. *Balance:* none.

**BT-085 Battle Memories** — The best moment of each run (largest comeback, closest win) is auto-tagged and saved as a "Highlight". *Trigger:* run end. *Feel:* story. *Rarity:* Always. *Cx:* M. *Deps:* recap, Legacy. *Balance:* none.
