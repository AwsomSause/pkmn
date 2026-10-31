# Master Idea Library 01: Pokémon Individuality & Behavior (PB-001 to PB-080)

Legend: Cx = implementation complexity S/M/L/XL. Fields per idea: what it is and how it works, Trigger, Feel (player-facing and why memorable), Rarity, Cx, Deps (existing systems it touches), Balance (concerns). Design only; nothing here is approved. IDs are permanent.

## A. Habits, quirks and body language

**PB-001 Signature Fidget** — Each Pokémon rolls one idle fidget at catch (Pikachu sniffs the air, Snorlax scratches belly, Gengar peeks behind the HP bar). Plays in party screen and battle idle loop. *Trigger:* always on, chosen from species+personality pool. *Feel:* you recognise your Pokémon by how it moves. *Rarity:* Always. *Cx:* M. *Deps:* animated icons, personality, party UI. *Balance:* none, cosmetic.

**PB-002 Favourite Spot** — Every Pokémon picks a favourite tile type on the map (grass, water edge, rocks). Walking nodes of that type gives a tiny bond gain and a one-line remark. *Trigger:* map node of matching biome. *Feel:* the team has tastes. *Rarity:* Common. *Cx:* S. *Deps:* map nodes, Bond. *Balance:* cap bond gain per run.

**PB-003 Pet Peeve** — Each Pokémon dislikes one concrete thing (rain, being in slot 6, being given Potions, a specific teammate species). Triggering it drops mood and shows a sulk emote. *Trigger:* peeve condition met. *Feel:* puzzle of keeping everyone content. *Rarity:* Uncommon. *Cx:* M. *Deps:* mood/Bond, weather, items. *Balance:* penalties small, never run-ending.

**PB-004 Comfort Item** — A Pokémon latches onto one held item and refuses to swap it without a bond check; with it held, panics less (status resist small). *Trigger:* held for 3 battles. *Feel:* attachments you can break. *Rarity:* Uncommon. *Cx:* M. *Deps:* held items, Bond. *Balance:* value of the item must not stack with its own effect.

**PB-005 Nervous Flinch** — Shy/Timid-type natures visibly flinch at crits taken and have a 5% self-flinch chance on first turn vs bosses; after beating a boss they lose it for the run. *Trigger:* boss first turn. *Feel:* growth arc from jitters to courage. *Rarity:* Common. *Cx:* M. *Deps:* natures, boss battles. *Balance:* keep chance low.

**PB-006 Show-Off Streak** — Cocky natures sometimes do a flourish after a KO, delaying text by about 1s and granting a 1-turn Attack bump, only on a clean one-shot. *Trigger:* one-shot KO. *Feel:* swagger. *Rarity:* Common. *Cx:* S. *Deps:* nature, animation registry. *Balance:* respect skip setting, bonus not gated on watching.

**PB-007 Yawn Contagion** — If one party member falls asleep on the map screen idle, others nearby yawn in sequence; if all yawn, a free Rest event heals 10%. *Trigger:* idle 20s on camp screen. *Feel:* an easter-egg-y moment of calm. *Rarity:* Rare. *Cx:* S. *Deps:* camp screen. *Balance:* once per node.

**PB-008 Tail-Wag Meter** — Dog/cat species show a happiness tail-wag on the summary screen, speeding with Bond and shown in battle intros. Doubles as a readable bond indicator. *Trigger:* always. *Feel:* instant emotional read. *Rarity:* Always. *Cx:* M. *Deps:* Bond screen, sprites. *Balance:* none.

**PB-009 Hoarding Instinct** — Certain species (Meowth, Pachirisu, Zigzagoon) pocket a random small item after battles and show it on request; occasionally they forget where they put it and it reappears events later. *Trigger:* post-battle roll. *Feel:* funny recurring "where did it get that". *Rarity:* Uncommon. *Cx:* M. *Deps:* item pool, post-battle. *Balance:* item value tier cap.

**PB-010 Sleep Posture Puzzle** — At rest nodes Pokémon pick sleep positions based on neighbours (back-to-back, curled together, one stands guard). The layout reveals relationship strength at a glance. *Trigger:* rest node. *Feel:* read the party's bonds without a menu. *Rarity:* Always at rest. *Cx:* L. *Deps:* rest node art, relationship matrix. *Balance:* none.

## B. Autonomy and initiative

**PB-011 Hesitation** — A Pokémon with low trust occasionally takes one turn to decide, forcing the player's chosen move to resolve at -1 priority. *Trigger:* trust below threshold and facing its fear type. *Feel:* bond has teeth. *Rarity:* Uncommon. *Cx:* M. *Deps:* Bond, engine priority. *Balance:* telegraph with a visible "unsure" icon the turn before.

**PB-012 Unprompted Heroics** — A max-bond Pokémon about to faint may, once per run, survive at 1 HP and strike anyway (separate from Focus Sash). *Trigger:* lethal hit, bond maxed. *Feel:* tears and cheers. *Rarity:* Rare. *Cx:* M. *Deps:* Bond, damage resolution. *Balance:* once per run, tracked in run save.

**PB-013 Disobedient Streak** — Over-levelled traded or caught-late Pokémon may ignore commands, but they pick a different sensible move on their own, sometimes better. *Trigger:* level far above badge count. *Feel:* risk and surprise. *Rarity:* Common. *Cx:* M. *Deps:* levels past 100, AI move scoring. *Balance:* use deterministic RNG stream, never pick suicidal moves.

**PB-014 Protective Instinct** — Parent-like species (Chansey, Miltank, Clefable, Lopunny) jump in front of a weaker teammate's lethal hit in doubles once per battle. *Trigger:* ally under 20% HP targeted. *Feel:* motherly guardian. *Rarity:* Uncommon. *Cx:* M. *Deps:* doubles targeting. *Balance:* guard takes the hit at reduced damage.

**PB-015 Rival Recognition** — A Pokémon who lost to a specific enemy species earlier gains +10% damage and a growl line next time it meets one. *Trigger:* prior KO by the species. *Feel:* grudges across fights. *Rarity:* Common. *Cx:* M. *Deps:* battle history log. *Balance:* cap total bonuses from grudges at once.

**PB-016 Curiosity Detours** — Curious natures pause at "?" nodes and nudge the player toward them with a bobbing marker; following yields a small find. *Trigger:* map with unexplored side stop. *Feel:* the Pokémon guides you. *Rarity:* Common. *Cx:* M. *Deps:* map events, nature. *Balance:* find tier low.

**PB-017 Territory Marking** — Territorial species mark a camp tile; resting later at marked nodes gives bond, and wild encounters nearby are wary. *Trigger:* rest node. *Feel:* the map carries your history. *Rarity:* Uncommon. *Cx:* M. *Deps:* map memory. *Balance:* minimal.

**PB-018 Second Wind Pride** — A Pokémon who fainted earlier in the run and was revived fights harder against the thing that KO'd it. *Trigger:* revive item then same encounter type. *Feel:* redemption. *Rarity:* Uncommon. *Cx:* S. *Deps:* revive, battle log. *Balance:* temporary +1 stage only.

**PB-019 Nap On Command** — Lazy natures may ask for a nap mid-route: accept to heal 15% but lose a step of the map timer; refuse to lose bond slightly. *Trigger:* random on long routes. *Feel:* tiny dilemma with personality. *Rarity:* Common. *Cx:* S. *Deps:* map timer, Bond. *Balance:* tune tradeoff to be neutral.

**PB-020 Stage Fright Audience** — In Hall of Fame / gym broadcast moments, shy Pokémon hide behind taller teammates; confident ones pose centre. Their poses are saved in the Hall photo. *Trigger:* Hall of Fame. *Feel:* a photo that is truly yours. *Rarity:* Always. *Cx:* M. *Deps:* Hall of Fame. *Balance:* none.

## C. Species-specific behaviours

**PB-021 Ditto Mimic-Self Quirk** — Your Ditto picks up a habit from whichever teammate is in slot 1 (walk bob, cry pitch). *Trigger:* time spent next to a teammate. *Feel:* funny, sweet. *Rarity:* Species. *Cx:* M. *Deps:* Ditto, sprite anims. *Balance:* cosmetic.

**PB-022 Eevee Indecision** — Eevee has a visible "wish" toward the evolution it prefers based on how you treat it (night battles, water events, being held). Evolution then needs its wish granted, but you may override with a stone. *Trigger:* eevee in party. *Feel:* you shape its destiny through actions, not a menu. *Rarity:* Species. *Cx:* L. *Deps:* evolution, events. *Balance:* stones remain a safe fallback.

**PB-023 Magikarp Training Montage** — Magikarp that gets zero wins until threshold shows increasingly absurd flail animations; the evolution event is a staged reversal. *Trigger:* Magikarp progression. *Feel:* classic underdog payoff. *Rarity:* Species. *Cx:* M. *Deps:* evolution animation. *Balance:* existing.

**PB-024 Snorlax Blockade** — A wild Snorlax can sleep on a path node; instead of battling, you can wake it with a flute, tempt it with berries (opens a free recruit), or go around (costs steps). *Trigger:* wild encounter variant. *Feel:* iconic Pokémon moment. *Rarity:* Rare. *Cx:* M. *Deps:* map blockers, items. *Balance:* reward gating.

**PB-025 Psychic Premonitions** — Abra, Kadabra, Alakazam, Espeon sometimes flash a one-line warning before an event node ("trap ahead") visible only with them in the party. *Trigger:* hazard event next on path. *Feel:* feels like the team knows. *Rarity:* Uncommon. *Cx:* M. *Deps:* event director, species tags. *Balance:* accuracy 70%.

**PB-026 Ghost Phasing** — Ghost-types occasionally wander out of the party tray on the map and peek at other nodes, revealing one node's type. *Trigger:* ghost in party. *Feel:* little scout. *Rarity:* Common. *Cx:* M. *Deps:* map fog. *Balance:* reveal one node per act.

**PB-027 Grass Photosynthesis Naps** — Sun-loving Grass types regain 1% per map step in sunny weather. *Trigger:* sunny day on map. *Feel:* biome flavour. *Rarity:* Common. *Cx:* S. *Deps:* weather map layer. *Balance:* cap 10% per node.

**PB-028 Water-Type Puddle Bonding** — Water types splash in puddles after rain nodes, gaining bond and cheering the team. *Trigger:* rain weather. *Feel:* small happy visual. *Rarity:* Common. *Cx:* S. *Deps:* weather, Bond. *Balance:* bond +1.

**PB-029 Fighting-Type Sparring** — Two Fighting types at rest spar; a mini result (win/draw) nudges respective stats ±1 EV for the next fight. *Trigger:* two fighters at rest. *Feel:* training montage. *Rarity:* Uncommon. *Cx:* M. *Deps:* rest, EVs. *Balance:* tiny EV swing.

**PB-030 Bug-Type Molt Rituals** — Bug types occasionally molt at rest, leaving a shed item (String Shot silk, Silver Powder). *Trigger:* rest node. *Feel:* creepy-cute loot. *Rarity:* Uncommon. *Cx:* S. *Deps:* crafting, item pool. *Balance:* low tier.

**PB-031 Electric Static Build-Up** — Electric Pokémon build charge walking; at 100 their next move gets +1 priority once. Thunderstorm doubles the rate. *Trigger:* steps taken. *Feel:* feel the crackle. *Rarity:* Common. *Cx:* M. *Deps:* map steps, engine. *Balance:* resets after use.

**PB-032 Poison-Type Taste Test** — Poison types sample unknown berries; reveals the berry's effect before you eat it (but risk poisoning themselves harmlessly). *Trigger:* find unknown item. *Feel:* identify-by-friend. *Rarity:* Uncommon. *Cx:* M. *Deps:* unidentified items. *Balance:* identification only.

**PB-033 Flying-Type Aerial Scouting** — Flying types circle ahead; the map shows an extra node ahead for each Flying type (max 2). *Trigger:* always with Flying type. *Feel:* team utility with flavour. *Rarity:* Always. *Cx:* M. *Deps:* map preview. *Balance:* cap prevents full-map info.

**PB-034 Rock-Type Statue Mode** — In stalls, Rock types can stand still for a turn to gain Defense but clearly look like statues; wild Pokémon sometimes ignore them. *Trigger:* player picks "Hold Still". *Feel:* fun new action. *Rarity:* Common. *Cx:* M. *Deps:* battle action menu. *Balance:* mirrors Defense Curl.

**PB-035 Steel-Type Rust Fear** — Steel types visibly panic on rain maps and lose Speed unless carrying an oil item. *Trigger:* rain. *Feel:* trade-offs with weather. *Rarity:* Common. *Cx:* S. *Deps:* weather. *Balance:* only -1 Spd.

**PB-036 Dragon Pride Gate** — Dragon-types refuse to be in slot 6 or hold a common item; keeping them honoured raises damage by 5% but pride dents bond if ignored. *Trigger:* party ordering. *Feel:* regal. *Rarity:* Species. *Cx:* M. *Deps:* party UI. *Balance:* mild.

**PB-037 Fairy-Type Charm Offensive** — Fairies can use a charm emote at wild Pokémon pre-battle, rarely persuading a shy foe to flee (no fight, no reward) or even befriend. *Trigger:* pre-battle option. *Feel:* non-violent path. *Rarity:* Uncommon. *Cx:* M. *Deps:* pre-battle menu. *Balance:* success low.

**PB-038 Dark-Type Sneak Looting** — Dark types may swipe an item from a defeated trainer's table after battle (risk: trainer remembers and becomes a nemesis). *Trigger:* post-battle. *Feel:* morally grey. *Rarity:* Uncommon. *Cx:* M. *Deps:* nemesis system. *Balance:* risk/reward.

**PB-039 Normal-Type Adaptability** — Normal types "learn" the last type that hit them super effectively and take 10% less from it for the battle. *Trigger:* hit by SE move. *Feel:* "the ordinary survive". *Rarity:* Common. *Cx:* M. *Deps:* engine. *Balance:* only once per type.

**PB-040 Ice-Type Frostbitten Weather Sync** — Ice types enjoy hail/snow nodes: visible breath puffs, +bond; in sunlight they sweat and show tired. *Trigger:* weather. *Feel:* cosmetic personality. *Rarity:* Common. *Cx:* S. *Deps:* weather. *Balance:* cosmetic.

## D. Emotional states and growth

**PB-041 Mood Ring** — Each Pokémon has a mood (Content, Excited, Anxious, Sulky, Determined, Heartbroken) shown as an icon; mood modifies one stat by ±5% and picks dialogue. *Trigger:* run events/battle outcomes. *Feel:* team as living thing. *Rarity:* Always. *Cx:* L. *Deps:* Bond, dialogue pools, event director. *Balance:* modest.

**PB-042 Grief** — When a bonded teammate is permanently lost, partners enter Grief for 3 battles: fight at -5% but gain a unique tribute option (carry a keepsake). *Trigger:* permadeath. *Feel:* emotional weight. *Rarity:* Common after loss. *Cx:* M. *Deps:* permadeath, relationships. *Balance:* offer opt-out in settings.

**PB-043 Jealousy** — If you pay far more attention (healing, items) to one Pokémon, another jealous one gets a mood hit; a petting scene fixes it. *Trigger:* heal ratio skew. *Feel:* a human social wrinkle. *Rarity:* Uncommon. *Cx:* M. *Deps:* mood, items. *Balance:* meter hidden but legible.

**PB-044 Pride After Evolving** — Newly evolved Pokémon show off to evolved-less teammates; the unevolved get a tiny motivation buff ("I'll catch up") but some sulk. *Trigger:* evolution. *Feel:* family dynamics. *Rarity:* Common. *Cx:* S. *Deps:* evolution. *Balance:* tiny.

**PB-045 Brave Face** — Hurt Pokémon at under 25% HP can hide pain; a Brave Face roll hides the HP bar's red for a turn and boosts their stats while visually trembling. *Trigger:* low HP. *Feel:* dramatic. *Rarity:* Uncommon. *Cx:* M. *Deps:* HP bar. *Balance:* telegraph tradeoff clearly.

**PB-046 Homesick** — A Pokémon captured far from the previous route longs for its biome; spending time in it restores its mood. *Trigger:* biome mismatch. *Feel:* geography matters. *Rarity:* Uncommon. *Cx:* M. *Deps:* biomes, mood. *Balance:* low penalty.

**PB-047 Imposter Syndrome** — Low-level strong Pokémon (gifts, eggs, event rewards) doubt themselves; first victory over a stronger foe permanently clears it and bumps Atk/SpA. *Trigger:* gifted Pokémon. *Feel:* underdog arc. *Rarity:* Uncommon. *Cx:* M. *Deps:* mood. *Balance:* only once per Pokémon.

**PB-048 Mentor Glow** — A veteran teaching a young Pokémon (shared battle) both gain tiny XP; the pupil copies one trait from mentor's moves list. *Trigger:* shared fights. *Feel:* lineage. *Rarity:* Uncommon. *Cx:* L. *Deps:* move learning, Bond. *Balance:* pupil gets move choice offered.

**PB-049 Nostalgia** — A Pokémon seeing its original trainer's city or old route triggers a soft memory scene and rare stat tweak. *Trigger:* traded-in Pokémon plus location. *Feel:* story. *Rarity:* Rare. *Cx:* M. *Deps:* Trainer history. *Balance:* flavour.

**PB-050 Joy Spikes** — After a hard-won victory, the whole party celebrates in a cheering sequence; if everyone cheers, bond +1 each. *Trigger:* boss win with all alive. *Feel:* payoffs. *Rarity:* Common. *Cx:* S. *Deps:* boss victory. *Balance:* one per boss.

## E. Physical state and appearance

**PB-051 Scars and Battle Marks** — Pokémon who survive at 1 HP or take heavy status gain a small cosmetic scar sprite overlay and a +2% defence vs that source. *Trigger:* survival at 1 HP. *Feel:* history shows. *Rarity:* Rare. *Cx:* M. *Deps:* sprite overlays. *Balance:* tiny.

**PB-052 Weather-Worn Coat** — After long exposure to a biome, a Pokémon's sprite gains a tint (dusty, snowy, mossy) that fades slowly. *Trigger:* repeated biome. *Feel:* visual journey. *Rarity:* Common. *Cx:* M. *Deps:* palette swap. *Balance:* cosmetic.

**PB-053 Growth Measurements** — Each Pokémon's height/weight vary and drift with level; a tall Rattata really is taller; "Size Record" for the Hub. *Trigger:* always. *Feel:* individuality. *Rarity:* Always. *Cx:* M. *Deps:* IVs, sprite scale. *Balance:* heavy-weight-based moves feel it.

**PB-054 Accessory Memories** — Items worn (scarf, bow) are given by events and show in sprites, tied to a story. *Trigger:* event rewards. *Feel:* personalisation. *Rarity:* Uncommon. *Cx:* L. *Deps:* sprite compositing. *Balance:* cosmetic.

**PB-055 Fatigue Posture** — Pokémon who fought many consecutive battles slump visibly; rest nodes restore posture. *Trigger:* battle count. *Feel:* readable stamina. *Rarity:* Common. *Cx:* M. *Deps:* stamina meter. *Balance:* optional hint-only.

**PB-056 Colour Quirks** — Rare pigment variants beyond shinies (faded, vivid, banded) with no stat change but their own title. *Trigger:* encounter roll. *Feel:* collectible. *Rarity:* Rare. *Cx:* M. *Deps:* palettes. *Balance:* none.

**PB-057 Voice Pitch Individuality** — Cries vary subtly per individual (pitch/speed) from IV signature; you learn to recognise yours. *Trigger:* always. *Feel:* auditory identity. *Rarity:* Always. *Cx:* M. *Deps:* audio. *Balance:* none.

**PB-058 Signature Pose** — At victory, each Pokémon strikes a pose tied to its nature; saved in team portrait. *Trigger:* victory. *Feel:* shareable. *Rarity:* Always. *Cx:* M. *Deps:* animation registry. *Balance:* none.

**PB-059 Age System** — Pokémon age over many runs (Legacy); elders retire to the Hub as trainers/guides and pass on a trait. *Trigger:* run count. *Feel:* generations. *Rarity:* Long-term. *Cx:* L. *Deps:* Legacy, Hub. *Balance:* retirement optional.

**PB-060 Hatchling Imprint** — A hatched baby imprints on the first teammate it sees, copying a move preference or nature quirk. *Trigger:* egg hatch. *Feel:* parenthood. *Rarity:* Common. *Cx:* M. *Deps:* eggs. *Balance:* small.

## F. Skills, tricks and personalities in practice

**PB-061 Party Tricks** — Pokémon learn one non-battle trick through bond (juggle, play dead, bow). Used in events to solve prompts or bribe merchants. *Trigger:* bond milestones. *Feel:* expressive tool. *Rarity:* Uncommon. *Cx:* L. *Deps:* event conditions. *Balance:* tricks are situational.

**PB-062 Talent Trees Lite** — Each Pokémon gets 3 rare "talents" (Early Riser, Crisis Calm, Berry Nose) from personality; each is a single-line behaviour modifier. *Trigger:* at catch. *Feel:* variety within species. *Rarity:* Always. *Cx:* L. *Deps:* abilities, nature. *Balance:* talents low-impact.

**PB-063 Dream Diary** — At rest, a sleeping Pokémon dreams: a short procedural vignette, sometimes foreshadowing a real event. *Trigger:* rest. *Feel:* mystery. *Rarity:* Uncommon. *Cx:* M. *Deps:* event director, text pools. *Balance:* foreshadow accuracy 60%.

**PB-064 Sixth Sense** — High-bond Pokémon alert you to hidden items on the node with a tail flick or ear twitch. *Trigger:* hidden item on node. *Feel:* partnership. *Rarity:* Common. *Cx:* M. *Deps:* hidden item system. *Balance:* low-value finds.

**PB-065 Taste Preferences** — Each Pokémon likes certain flavors; berries matching give extra, disliked ones do nothing and reduce mood. *Trigger:* feeding berry. *Feel:* thoughtful gifts. *Rarity:* Always. *Cx:* M. *Deps:* nature flavor, berries. *Balance:* use existing nature flavors.

**PB-066 Rival Pet Pairing** — A Pokémon's rivalry with a specific teammate (friendly or grumpy) drives bickering and sparring; resolved by an event. *Trigger:* species pairs. *Feel:* soap opera. *Rarity:* Uncommon. *Cx:* L. *Deps:* relationship matrix. *Balance:* resolution gives permanent perk.

**PB-067 Language Learning** — Pokémon pick up phrases from NPCs; later they repeat them at wrong times ("Gym Leader's catchphrase"). *Trigger:* listening to NPCs. *Feel:* comedic. *Rarity:* Rare. *Cx:* M. *Deps:* dialogue. *Balance:* flavour.

**PB-068 Hide And Seek** — Small Pokémon sometimes hide on the camp screen; finding them yields a small bond. *Trigger:* camp. *Feel:* tiny game. *Rarity:* Common. *Cx:* S. *Deps:* camp screen. *Balance:* bond cap.

**PB-069 Training Regimens** — Assign a regimen (run, lift, meditate) at rest; Pokémon succeed or complain by nature, shifting EV-like growth slightly. *Trigger:* rest. *Feel:* agency. *Rarity:* Common. *Cx:* L. *Deps:* EV system. *Balance:* capped.

**PB-070 Fear Tolerance** — A Pokémon scared of Ghost types gradually conquers it after repeated exposure; seen as inline growth notes. *Trigger:* repeated fights. *Feel:* concrete character arc. *Rarity:* Uncommon. *Cx:* M. *Deps:* fear mechanic, mood. *Balance:* clear progress bar.

## G. Odd and spectacular Pokémon moments

**PB-071 Sudden Sing-Along** — A Jigglypuff-line plus a Chatot sing at camp; others join; unlocks a one-time team buff song. *Trigger:* rare camp event. *Feel:* delight. *Rarity:* Rare. *Cx:* M. *Deps:* audio. *Balance:* single buff.

**PB-072 Shiny Reaction** — Party members react to a shiny sighting with gasps; the finder gets proud. Unique per Pokémon. *Trigger:* shiny encounter. *Feel:* shared excitement. *Rarity:* Rare. *Cx:* S. *Deps:* dialogue. *Balance:* none.

**PB-073 Mimic Gone Wrong** — Mimic-capable species imitate trainers in dialogue events; Ditto/Zoroark/Smeargle go further, impersonating NPCs to fool merchants. *Trigger:* event option. *Feel:* comedic. *Rarity:* Rare. *Cx:* M. *Deps:* event options. *Balance:* risk of disaster.

**PB-074 Evolution Hesitation** — A Pokémon may refuse to evolve (E-cancel by choice) if it loves its form, offering a Cute Charm-like bonus for staying. *Trigger:* evolution prompt. *Feel:* meaningful decision. *Rarity:* Uncommon. *Cx:* M. *Deps:* evolution. *Balance:* offer a unique perk.

**PB-075 Deep Sleep Dreams Gift** — Drowzee/Hypno events: eat a dream to give you a temporary clairvoyance of the next boss move. *Trigger:* rest with Hypno line. *Feel:* creepy and powerful. *Rarity:* Rare. *Cx:* M. *Deps:* boss intel. *Balance:* single intel.

**PB-076 Legendary Awe** — Low-bond Pokémon freeze in awe when a Legendary shows; high-bond ones step forward, changing opening moves. *Trigger:* legendary encounter. *Feel:* dramatic staging. *Rarity:* Rare. *Cx:* M. *Deps:* legendary encounters. *Balance:* low.

**PB-077 Pokémon Prank** — Playful species prank the player at camp (hide your item, swap berries), resolved via mini-game. *Trigger:* camp event. *Feel:* funny. *Rarity:* Uncommon. *Cx:* M. *Deps:* camp. *Balance:* harmless.

**PB-078 Echo Cries** — Cave maps echo Pokémon cries; hearing your lead's echo gives a layout hint. *Trigger:* cave node. *Feel:* atmospheric. *Rarity:* Common. *Cx:* S. *Deps:* audio, map. *Balance:* none.

**PB-079 Sacrificial Spirit** — A very bonded Pokémon can volunteer to be left behind to buy the party escape from a deadly event, becoming a Hub resident forever. *Trigger:* lethal event. *Feel:* heartbreak and legacy. *Rarity:* Rare. *Cx:* L. *Deps:* Hub residents, events. *Balance:* player consent.

**PB-080 Pokémon Autobiography** — At run end every Pokémon gets a procedurally written 3-line biography from its event log; the best are kept in a book. *Trigger:* run end. *Feel:* storytelling payoff. *Rarity:* Always. *Cx:* L. *Deps:* run history, text templates. *Balance:* none.
